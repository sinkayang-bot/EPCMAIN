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
store.set(eventKey('C'),{eventId:'C',status:'open',date:'2026-10-23',name:'EPC 重買優惠驗證',players:[{memberId:'88',buyin:1,rebuy:0,ladies:false,manualDiscount:0}]});
await bridge.playerPayment(cmd('rebuy',{eventId:'C',memberId:'88',groups:1,manualDiscount:0,ladies:true,paidNow:true,expectedDelta:3400}));
assert.equal(store.get(eventKey('C')).players[0].ladies,false,'An old client cannot add a ladies discount through rebuy');
store.get(eventKey('C')).players[0].ladies=true;
await bridge.playerPayment(cmd('rebuy',{eventId:'C',memberId:'88',groups:1,manualDiscount:0,paidNow:true,expectedDelta:3400}));
assert.equal(store.get(eventKey('C')).players[0].ladies,true,'Rebuy preserves the original registration discount');
console.log('PASS: rebuy rejects adding ladies discount while preserving an existing registration discount.');

// One event checkout is atomic across players, scoped to that event and retry-safe.
const Core=globalThis.EPCPlayerPaymentsCore;
const batchEvent={eventId:'BATCH',date:'2026-11-13',name:'本場結帳測試',status:'settled',finalJP:900,players:[
 {memberId:'201',buyin:1,rebuy:0,stack:25000,prize:1000,registrationUnpaid:true,registrationUnpaidAmount:3000},
 {memberId:'202',buyin:1,rebuy:0,stack:30000,prize:2000,registrationUnpaid:true,registrationUnpaidAmount:3400},
 {memberId:'203',buyin:1,rebuy:0,stack:50000,prize:3000,registrationUnpaid:false}
]};
store.set(eventKey('BATCH'),copy(batchEvent));
const s201=Core.empty('201');s201.wallet=1000;s201.accounts={BATCH:{charge:3400,paid:400},OTHER:{charge:2000,paid:0}};store.set(ledgerKey('201'),s201);
const batch={kind:'settleEvent',id:'batch-once',eventId:'BATCH',payments:[
 {memberId:'201',expectedRevision:0,expectedDue:3000,expectedWalletUsed:1000},
 {memberId:'202',expectedRevision:0,expectedDue:3400,expectedWalletUsed:0}
]};
const untouched=JSON.stringify([...store]);
await assert.rejects(bridge.playerPayment({...batch,payments:[batch.payments[0]]}),/玩家已變更/);
await assert.rejects(bridge.playerPayment({...batch,payments:[batch.payments[0],{...batch.payments[1],expectedRevision:9}]}),/已有更新/);
await assert.rejects(bridge.playerPayment({...batch,payments:[batch.payments[0],{...batch.payments[1],expectedDue:3300}]}),/已變更/);
await assert.rejects(bridge.playerPayment({...batch,payments:[{...batch.payments[0],expectedWalletUsed:0},batch.payments[1]]}),/寄存金/);
assert.equal(JSON.stringify([...store]),untouched,'failed batch must not pay the earlier player');
const batchResult=await bridge.playerPayment(batch);
assert.equal(batchResult.ledgers.length,2);
assert.equal(store.get(ledgerKey('201')).wallet,0);
assert.equal(store.get(ledgerKey('201')).accounts.BATCH.paid,3400);
assert.equal(store.get(ledgerKey('201')).accounts.OTHER.paid,0,'other events remain unpaid');
assert.equal(store.get(ledgerKey('201')).items.at(-1).cashAmount,2000);
assert.equal(store.get(ledgerKey('202')).items.at(-1).cashAmount,3400);
assert(!store.has(ledgerKey('203')),'already paid member needs no new ledger');
assert.deepEqual(store.get(eventKey('BATCH')).players[2],batchEvent.players[2]);
assert.equal(store.get(eventKey('BATCH')).finalJP,900);
assert.equal(store.get(eventKey('BATCH')).status,'settled');
for(const p of store.get(eventKey('BATCH')).players){assert(!p.registrationUnpaid);assert.equal(p.stack,batchEvent.players.find(x=>x.memberId===p.memberId).stack);assert.equal(p.prize,batchEvent.players.find(x=>x.memberId===p.memberId).prize);}
const afterBatch=JSON.stringify([...store]);
assert.equal((await bridge.playerPayment(batch)).replayed,true);
assert.equal(JSON.stringify([...store]),afterBatch,'lost acknowledgements must not produce duplicate receipts');
await bridge.playerPayment({id:'batch-void',kind:'void',memberId:'201',targetId:batch.id});
assert.equal(store.get(ledgerKey('201')).wallet,1000);
assert.equal(store.get(ledgerKey('201')).accounts.BATCH.paid,400);
assert.equal(store.get(ledgerKey('201')).accounts.OTHER.paid,0);
const concurrent={...batch,id:'batch-concurrent-a',payments:[{...batch.payments[0],expectedRevision:store.get(ledgerKey('201')).revision}]};
const outcomes=await Promise.allSettled([bridge.playerPayment(concurrent),bridge.playerPayment({...concurrent,id:'batch-concurrent-b'})]);
assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
assert.equal(store.get(ledgerKey('201')).items.filter(x=>x.kind==='settleEvent'&&!x.voidedBy).length,1);
console.log('PASS: event-wide checkout is atomic, isolates other events, preserves settled results, guards changed totals/wallet/revisions, supports receipt reversal and deduplicates retries/concurrent submits.');

store.get(eventKey('B')).status='open';store.get(eventKey('B')).payoutSnapshot={lockedAt:1};
await assert.rejects(bridge.playerPayment(cmd('change',{eventId:'B',field:'rebuy',increment:true})),/截止買入/);
await assert.rejects(bridge.playerPayment({...cmd('add',{eventId:'B'}),memberId:'99'}),/截止買入/);
console.log('PASS: published tournament blocks new registration and rebuy transactions.');
