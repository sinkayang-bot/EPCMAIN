import assert from 'node:assert/strict';
import {setupPlayerPayments} from '../player-payments-cloud.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const store=new Map(),eventKey=id=>'events/'+id,ledgerKey=id=>'accounting/PLAYER_PAYMENTS_'+id;
const p={memberId:'42',buyin:1,rebuy:0,manualDiscount:0,prize:0,stack:25000,_stackRevision:2};
store.set(eventKey('A'),{eventId:'A',status:'open',date:'2026-10-16',name:'EPC#1',players:[copy(p)],_eventUpdatedAt:1});
store.set(eventKey('B'),{eventId:'B',status:'open',date:'2026-10-16',name:'EPC#2',players:[],_eventUpdatedAt:1});
const bridge={requireAccountingAccess(){}};
globalThis.window={epcPlayerPaymentPrice_:(e,p)=>3400*(Number(p.buyin||0)+Number(p.rebuy||0))-Number(p.manualDiscount||0)};
let locked=Promise.resolve();
const fs={doc:(col,id)=>col+'/'+id,serverTimestamp:()=>123,
 runTransaction(db,callback){const task=locked.then(async()=>{
  const draft=new Map([...store].map(([k,v])=>[k,copy(v)]));let writes=false;
  const tx={get:async key=>{assert(!writes,'All reads must precede writes');const v=draft.get(key);return {exists:()=>!!v,data:()=>copy(v)};},set:(key,v)=>{writes=true;draft.set(key,copy(v));},update:(key,v)=>{writes=true;assert(draft.has(key));draft.set(key,{...draft.get(key),...copy(v)});}};
  const result=await callback(tx);store.clear();draft.forEach((v,k)=>store.set(k,v));return result;
 });locked=task.catch(()=>{});return task;}};
setupPlayerPayments({fs,db:{},col:'events',accountingCol:'accounting',bridge});
let n=0;const cmd=(kind,extra={})=>({id:'cloud-'+(++n),kind,memberId:'42',...extra});
await bridge.playerPayment(cmd('deposit',{amount:5000}));
const add=cmd('add',{eventId:'B',paidNow:false,player:{nickname:'測試'}});
let result=await bridge.playerPayment(add);assert.equal(result.ledger.wallet,1600);assert.equal(result.ledger.accounts.B.paid,3400);
await bridge.playerPayment(add);assert.equal(store.get(eventKey('B')).players.length,1);assert.equal(store.get(ledgerKey('42')).wallet,1600);
let revision=store.get(ledgerKey('42')).revision;
// Concurrent +1 operations retry against live event counts, preserving both increments.
await Promise.all([bridge.playerPayment(cmd('change',{eventId:'B',field:'rebuy',increment:true})),bridge.playerPayment(cmd('change',{eventId:'B',field:'rebuy',increment:true}))]);
let row=store.get(eventKey('B')).players[0];assert.equal(row.rebuy,2);assert.equal(store.get(ledgerKey('42')).wallet,0);assert.equal(row.rebuyUnpaidAmount,5200);
await assert.rejects(bridge.playerPayment(cmd('change',{eventId:'B',field:'rebuy',value:3,baseline:0})),/其他設備/);
// A legacy paid registration is not re-created as a new debt when one rebuy is added.
await bridge.playerPayment(cmd('change',{eventId:'A',field:'rebuy',increment:true}));
assert.equal(store.get(ledgerKey('42')).accounts.A.paid,3400);assert.equal(store.get(eventKey('A')).players[0].stack,25000);
const pay=cmd('cash',{eventId:'B',amount:2000});await bridge.playerPayment(pay);await bridge.playerPayment(pay);
assert.equal(store.get(ledgerKey('42')).accounts.B.paid,7000);assert.equal(store.get(eventKey('B')).players[0].rebuyUnpaidAmount,3200);
await assert.rejects(bridge.playerPayment(cmd('cash',{eventId:'B',amount:100,expectedRevision:revision})),/已有更新/);
const before=JSON.stringify([...store]);await assert.rejects(bridge.playerPayment(cmd('withdraw',{amount:1})),/不足/);assert.equal(JSON.stringify([...store]),before);
store.get(eventKey('A')).status='settled';
await assert.rejects(bridge.playerPayment(cmd('change',{eventId:'A',field:'rebuy',increment:true})),/已結算/);
// Rules-compatible protected document shape; normal daily accounting never receives wallet entries.
const ledger=store.get(ledgerKey('42'));assert.equal(ledger.date,'PLAYER_PAYMENTS_42');assert(Array.isArray(ledger.items));assert.equal(ledger.kind,'playerPaymentsV1');
assert([...store.keys()].every(k=>k.startsWith('events/')||k.startsWith('accounting/PLAYER_PAYMENTS_')));
console.log('PASS: cloud atomicity/idempotency, concurrent rebuy, stale revision, immutable settled entries, legacy baseline, debt mirror, protected ledger isolation.');

const previous=JSON.stringify([...store]);
await assert.rejects(bridge.playerPayment({id:'wrong-price',kind:'add',memberId:'43',eventId:'B',paidNow:true,expectedCharge:3300,player:{manualDiscount:0}}),/價格或優惠已變更/);
assert.equal(JSON.stringify([...store]),previous);
await assert.rejects(bridge.playerPayment({id:'dual-bird',kind:'add',memberId:'43',eventId:'B',player:{earlyBird:true,lateBird:true}}),/只能擇一/);
assert.equal(JSON.stringify([...store]),previous);
console.log('PASS: changed registration prices and incompatible discount selections cannot create a charge or receipt.');
// Desktop operation mode permits the last explicit quantity/discount edit to win,
// while receipts remain append-only and retry IDs still deduplicate the command.
const paidBefore=store.get(ledgerKey('42')).accounts.B.paid;
const latestDiscount=cmd('change',{eventId:'B',field:'manualDiscount',value:100,baseline:999,expectedRevision:0,lastSavedWins:true});
await bridge.playerPayment(latestDiscount);assert.equal(store.get(eventKey('B')).players[0].manualDiscount,100);assert.equal(store.get(ledgerKey('42')).accounts.B.paid,paidBefore);
const revisionAfter=store.get(ledgerKey('42')).revision;await bridge.playerPayment(latestDiscount);assert.equal(store.get(ledgerKey('42')).revision,revisionAfter);
console.log('PASS: explicit desktop last-save edits preserve receipts and remain idempotent.');

// Cancellation updates the live roster and protected ledger atomically.
const c99=(kind,extra={})=>({id:'remove-cloud-'+(++n),kind,memberId:'99',...extra});
await bridge.playerPayment(c99('add',{eventId:'B',paidNow:true,expectedCharge:3400,player:{nickname:'誤加'}}));
const otherPlayerBefore=copy(store.get(eventKey('B')).players.find(x=>x.memberId==='42'));
const cancel=c99('cancelRegistration',{eventId:'B',expectedCharge:3400,expectedPaid:3400,disposition:'wallet',amount:3400});
const beforeStale=JSON.stringify([...store]);
await assert.rejects(bridge.playerPayment({...cancel,id:'stale-remove',expectedPaid:3300}),/已變更/);
assert.equal(JSON.stringify([...store]),beforeStale);
const cancelled=await bridge.playerPayment(cancel);
assert.equal(cancelled.event.players.some(x=>x.memberId==='99'),false);
assert.equal(store.get(eventKey('B')).players.some(x=>x.memberId==='99'),false);
assert.deepEqual(store.get(eventKey('B')).players.find(x=>x.memberId==='42'),otherPlayerBefore);
assert.equal(cancelled.ledger.wallet,3400);assert.equal(cancelled.ledger.accounts.B.paid,0);assert.equal(cancelled.ledger.accounts.B.charge,0);
await bridge.playerPayment(cancel);assert.equal(store.get(ledgerKey('99')).wallet,3400);
await bridge.playerPayment(c99('deposit',{amount:100}));assert.equal(store.get(ledgerKey('99')).wallet,3500);
await bridge.playerPayment(c99('add',{eventId:'B',paidNow:false,expectedCharge:3400,player:{nickname:'重新報名'}}));
assert.equal(store.get(ledgerKey('99')).wallet,100);assert.equal(store.get(ledgerKey('99')).accounts.B.paid,3400);
store.get(eventKey('B')).status='settled';
const beforeSettled=JSON.stringify([...store]);
await assert.rejects(bridge.playerPayment(c99('cancelRegistration',{eventId:'B',expectedCharge:3400,expectedPaid:3400,disposition:'refund'})),/已結算/);
assert.equal(JSON.stringify([...store]),beforeSettled);
console.log('PASS: cancellation removes only target player atomically, preserves paid audit, guards stale totals and settlements, deduplicates wallet returns, and permits clean re-registration.');
