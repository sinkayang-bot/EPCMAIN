const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
require('../player-payments-core.js');
(async()=>{
 const {setupPlayerPayments}=await import('../player-payments-cloud.js');
 const pricing=await import('../player-pricing.js');
 const html=fs.readFileSync(require.resolve('../phone/index.html'),'utf8'),dom=new JSDOM(html,{url:'https://example.test/phone/',runScripts:'outside-only'}),w=dom.window;
 global.window=w;const clone=x=>JSON.parse(JSON.stringify(x));
 const records=new Map([['events/E',{eventId:'E',name:'EPC#1',date:'2026-10-16',businessDate:'2026-10-16',status:'open',buyin:3000,fee:400,level:3400,buyinTotal:3400,buyinAdmin:400,rebuyTotal:3400,rebuyAdmin:400,earlyBirdDiscount:100,lateBirdDiscount:200,ladiesDiscount:200,chips:300000,players:[]}]]);
 let eventCallback,bridge,lock=Promise.resolve();
 const api={doc:(col,id)=>col+'/'+id,collection:(db,name)=>name==='epc_events'?'events':'accounting',serverTimestamp:()=>0,
 runTransaction(db,callback){const task=lock.then(async()=>{const data=new Map([...records].map(([k,v])=>[k,clone(v)]));let writes=false;
  const tx={get:async key=>{assert(!writes);const x=data.get(key);return {exists:()=>!!x,data:()=>clone(x)}},set:(key,x)=>{writes=true;data.set(key,clone(x))},update:(key,x)=>{writes=true;data.set(key,{...data.get(key),...clone(x)})}};
  const out=await callback(tx);records.clear();data.forEach((v,k)=>records.set(k,v));return out;});lock=task.catch(()=>{});return task;}};
 Object.assign(w,api,{fs:api,authMod:{},initializeApp:()=>({}),getFirestore:()=>({}),onSnapshot:(col,cb)=>{eventCallback=cb;return ()=>{}},setupPlayerPayments:options=>{bridge=options.bridge;setupPlayerPayments(options)},setupAccountingAuth:options=>{options.bridge.accountingReady=true;options.bridge.requireAccountingAccess=()=>{}},...pricing});
 w.ResizeObserver=class{observe(){}};w.confirm=()=>true;
 w.fetch=async()=>({ok:true,json:async()=>({ok:true,members:[{memberId:'42',name:'甲'},{memberId:'43',name:'乙'}]})});
 w.eval(fs.readFileSync(require.resolve('../phone/stack-core.js'),'utf8'));
 const source=fs.readFileSync(require.resolve('../phone/phone.js'),'utf8').replace(/^import .*;\n/gm,'');w.eval(source);
 const $=id=>w.document.getElementById(id),tick=()=>new Promise(r=>setImmediate(r));await tick();await tick();
 function snapshot(){eventCallback({docs:[{id:'E',data:()=>clone(records.get('events/E'))}],metadata:{fromCache:false}});}
 snapshot();assert(!$('registrationLadies'));assert(!$('rebuyLadies'));assert($('birdType').querySelector('[value=ladies]'));assert($('rebuyDiscountType'));
 async function click(id){$(id).click();await tick();await lock;await tick();}
 function choose(id){$('memberSearch').value=id;$('memberSearch').dispatchEvent(new w.Event('input'));w.document.querySelector(`[data-memberkey="${id}"]`).click();}
 choose('42');$('birdType').value='ladies';$('birdType').dispatchEvent(new w.Event('change'));assert.equal($('amountPaid').value,'3200');assert($('amountPaid').readOnly);
 assert.equal($('registrationUnpaid').checked,false);assert.equal($('rebuyUnpaid').checked,false);$('registrationUnpaid').checked=true;await click('registerBtn');assert.equal($('registrationUnpaid').checked,false);
 let ledger=records.get('accounting/PLAYER_PAYMENTS_42');assert(ledger);assert.equal(ledger.accounts.E.charge,3200);assert.equal(ledger.accounts.E.paid,0);assert(records.get('events/E').players[0].ladies);assert.equal(records.get('events/E').players[0].registrationUnpaid,true);
 snapshot();assert($('rebuyPriceNote').textContent.includes('3,200'));assert($('rebuyDiscountType').disabled);assert($('overviewPlayers').textContent.includes('未結帳 $3,200'));
 $('rebuyManualDiscount').value='20';assert.equal($('rebuyUnpaid').checked,false);await click('rebuySaveBtn');assert.equal($('rebuyUnpaid').checked,false);
 ledger=records.get('accounting/PLAYER_PAYMENTS_42');assert.equal(ledger.accounts.E.charge,6380);assert.equal(ledger.accounts.E.paid,3180);assert.equal(ledger.items.at(-1).kind,'rebuy');assert.equal(ledger.items.at(-1).cashAmount,3180);assert.equal(records.get('events/E').players[0].rebuy,1);
 // A deposit is spent before cash; marking the new rebuy paid must retain previous debt.
 await bridge.playerPayment({id:'deposit',kind:'deposit',memberId:'42',amount:1000});
 w.dispatchEvent(new w.CustomEvent('epcPlayerPayments',{detail:{rows:[clone(records.get('accounting/PLAYER_PAYMENTS_42'))],connected:true}}));
 $('rebuyUnpaid').checked=false;await click('rebuySaveBtn');ledger=records.get('accounting/PLAYER_PAYMENTS_42');assert.equal(ledger.wallet,0);assert.equal(ledger.accounts.E.charge-ledger.accounts.E.paid,2200);assert.equal(ledger.items.at(-1).cashAmount,3200);assert.equal(records.get('events/E').players[0].rebuyUnpaidAmount,2200);
 choose('43');$('buyinGroups').value='2';$('birdType').value='ladies';$('manualDiscount').value='50';$('registrationUnpaid').checked=false;await click('registerBtn');ledger=records.get('accounting/PLAYER_PAYMENTS_43');assert.equal(ledger.accounts.E.charge,6350);assert.equal(ledger.accounts.E.paid,6350);assert.equal(records.get('events/E').players.find(p=>p.memberId==='43').registrationUnpaid,false);
 // An acknowledgement lost after commit must reuse the same transaction request ID.
 const originalPayment=bridge.playerPayment;let lost=true;
 bridge.playerPayment=async command=>{const result=await originalPayment(command);if(lost){lost=false;throw Object.assign(Error('acknowledgement lost'),{code:'unavailable'})}return result};
 $('rebuyPlayer').value='42';$('rebuyPlayer').dispatchEvent(new w.Event('change'));$('rebuyUnpaid').checked=false;
 const oldCount=records.get('events/E').players.find(p=>p.memberId==='42').rebuy;
 await click('rebuySaveBtn');assert(!$('mobilePaymentRetry').hidden);assert(w.sessionStorage.getItem('epcMobilePaymentPendingV1'));
 await click('mobilePaymentRetry');assert($('mobilePaymentRetry').hidden);assert.equal(records.get('events/E').players.find(p=>p.memberId==='42').rebuy,oldCount+1);assert.equal(w.sessionStorage.getItem('epcMobilePaymentPendingV1'),null);
 snapshot();assert($('overviewPlayers').textContent.includes('未結帳 $2,200'));
 console.log('PASS: uncertain mobile commits retry the same request without duplicate rebuy or cash collection.');
 console.log('PASS: mobile registration/ladies/late/manual pricing, paid/unpaid flags, rebuy net prices, preserved previous debts, deposit consumption, shared desktop ledger.');
 dom.window.close();
})().catch(err=>{console.error(err);process.exitCode=1});
