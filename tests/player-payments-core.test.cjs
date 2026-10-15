const assert=require('node:assert/strict');
const C=require('../player-payments-core.js');
const memberId='42';let sequence=0;
function op(s,kind,info={},extra={}){return C.apply(s,{id:'test-'+(++sequence),memberId,kind,...extra},info).state;}
const event=(charge,extra={})=>({charge,date:'2026-10-16',name:'EPC#1',...extra});
let s=C.empty(memberId);
s=op(s,'deposit',{}, {amount:5000});assert.equal(s.wallet,5000);
s=op(s,'add',{A:event(3400,{newPlayer:true})},{eventId:'A',paidNow:false});
assert.equal(s.wallet,1600);assert.equal(s.accounts.A.paid,3400);assert.equal(C.totalDue(s),0);
s=op(s,'change',{A:event(6600)},{eventId:'A'});
assert.equal(s.wallet,0);assert.equal(s.accounts.A.paid,5000);assert.equal(C.totalDue(s),1600);
s=op(s,'cash',{A:event(6600)},{eventId:'A',amount:600});assert.equal(C.totalDue(s),1000);
s=op(s,'transfer',{A:event(6600)},{eventId:'A',amount:1000});assert.equal(C.totalDue(s),0);
const transfer=s.items.at(-1).id;
s=op(s,'void',{A:event(6600)},{targetId:transfer});assert.equal(C.totalDue(s),1000);
assert.throws(()=>op(s,'void',{}, {targetId:transfer}),/撤銷/);
const original=JSON.stringify(s);assert.throws(()=>op(s,'cash',{}, {eventId:'A',amount:1001}),/超過/);assert.equal(JSON.stringify(s),original);
assert.throws(()=>op(s,'cash',{}, {eventId:'A',amount:-1}),/整數/);
assert.throws(()=>op(s,'deposit',{}, {amount:0.1}),/整數/);
const command={id:'retry-deposit',memberId,kind:'deposit',amount:1000,expectedRevision:s.revision};
const once=C.apply(s,command,{}).state,again=C.apply(once,command,{});assert(again.replayed);assert.equal(again.state.wallet,1000);
assert.throws(()=>C.apply(once,{...command,id:'other'},{}),/已有更新/);
let old=op(null,'reconcile',{OLD:event(6500,{legacyDue:2000})},{eventId:'OLD'});
assert.equal(old.accounts.OLD.paid,4500);assert.equal(C.totalDue(old),2000);
let historic=op(null,'reconcile',{OLD:event(6500)},{eventId:'OLD'});assert.equal(C.totalDue(historic),0);
// Prior profit is net profit, not the entire prize. It requires explicit confirmation.
let p=op(null,'add',{NEW:event(3400,{newPlayer:true})},{eventId:'NEW',paidNow:false});
const source={NEW:event(3400),PREV:event(3400,{settled:true,profit:2000,date:'2026-10-15'})};
assert.throws(()=>op(p,'profit',source,{eventId:'NEW',sourceEventId:'PREV',amount:1000}),/尚未發/);
p=op(p,'profit',source,{eventId:'NEW',sourceEventId:'PREV',amount:1500,confirmUnpaidProfit:true});
assert.equal(C.totalDue(p),1900);assert.equal(p.profits.PREV.used,1500);
assert.throws(()=>op(p,'profit',source,{eventId:'NEW',sourceEventId:'PREV',amount:501}),/餘額不足/);
p=op(p,'profitCash',source,{sourceEventId:'PREV',amount:500});assert.equal(p.profits.PREV.cash,500);
assert.throws(()=>op(p,'profit',source,{eventId:'NEW',sourceEventId:'PREV',amount:1}),/餘額不足/);
assert.throws(()=>op(p,'profit',{...source,PREV:event(3400,{settled:true,profit:3000})},{eventId:'NEW',sourceEventId:'PREV',amount:1}),/已變更/);
// Deposits cannot be withdrawn or undone after their money has been spent.
let u=op(null,'deposit',{}, {amount:3400}),depositId=u.items[0].id;
u=op(u,'add',{A:event(3400,{newPlayer:true})},{eventId:'A',paidNow:false});
assert.throws(()=>op(u,'void',{}, {targetId:depositId}),/不足/);
assert.throws(()=>op(u,'withdraw',{}, {amount:1}),/不足/);
// A price/count correction keeps overpayment explicit until staff moves it to deposit.
u=op(u,'change',{A:event(3200)},{eventId:'A'});assert.equal(u.accounts.A.paid,3400);assert.equal(u.wallet,0);
u=op(u,'creditExcess',{A:event(3200)},{eventId:'A'});assert.equal(u.wallet,200);assert.equal(u.accounts.A.paid,3200);
let all=op(null,'add',{A:event(3400,{newPlayer:true})},{eventId:'A',paidNow:false});
all=op(all,'add',{B:event(6600,{newPlayer:true})},{eventId:'B',paidNow:false});all=op(all,'deposit',{}, {amount:2000});
assert.throws(()=>op(all,'settleAll',{}, {expectedDue:9999}),/已變更/);
all=op(all,'settleAll',{}, {expectedDue:10000});assert.equal(C.totalDue(all),0);assert.equal(all.wallet,0);
const clearedId=all.items.at(-1).id;all=op(all,'void',{}, {targetId:clearedId});assert.equal(C.totalDue(all),10000);assert.equal(all.wallet,2000);
// A second terminal sees the first terminal's revision and cannot spend it again.
const staleRevision=all.revision;const first=op(all,'withdraw',{}, {amount:1500});
assert.throws(()=>C.apply(first,{id:'terminal-B',memberId,kind:'withdraw',amount:1500,expectedRevision:staleRevision},{}),/已有更新/);
assert.equal(first.wallet,500);
console.log('PASS: legacy baseline; add/rebuy auto-deposit; partial payments; net-profit confirmation/limits; retries; stale revision; reversals; overpayments; cross-event clear.');
