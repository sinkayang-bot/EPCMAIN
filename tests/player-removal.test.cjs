const assert=require('node:assert/strict'),C=require('../player-payments-core.js');
const info={E:{charge:3300,newPlayer:true,name:'測試場',date:'2026-10-16'}};
const start=C.apply(C.empty('1'),{id:'add',kind:'add',memberId:'1',eventId:'E',paidNow:true},info,1).state;
const command=(disposition,extra={})=>({id:'remove',kind:'cancelRegistration',memberId:'1',eventId:'E',expectedPaid:3300,expectedCharge:3300,disposition,...extra});
for(const disposition of ['mistake','refund','wallet']){
 const out=C.apply(start,command(disposition),info,2);assert.equal(out.state.accounts.E.charge,0);assert.equal(out.state.accounts.E.paid,0);assert.equal(C.totalDue(out.state),0);assert.equal(out.state.wallet,disposition==='wallet'?3300:0);assert.equal(out.state.items[0].kind,'add');assert.equal(out.state.items[1].kind,'cancelRegistration');
 assert.equal(C.apply(out.state,command(disposition),info,3).state.wallet,out.state.wallet,'duplicate acknowledgement must not refund twice');
 assert.throws(()=>C.apply(out.state,{id:'undo',kind:'void',memberId:'1',targetId:'add'},{}),/不能重複撤銷/);
 const readd=C.apply(out.state,{id:'new',kind:'add',memberId:'1',eventId:'E',paidNow:false},{E:{...info.E,newPlayer:true}},4).state;
 assert.equal(readd.accounts.E.cancelled,false);assert.equal(readd.accounts.E.charge,3300);assert.equal(readd.accounts.E.paid,disposition==='wallet'?3300:0);
}
assert.throws(()=>C.apply(start,command('wallet',{expectedPaid:3200}),info),/已變更/);
assert.throws(()=>C.apply(start,command('wallet'),{E:{...info.E,settled:true}}),/已結算/);
const unpaid=C.apply(C.empty('1'),{id:'unpaid',kind:'add',memberId:'1',eventId:'E',paidNow:false},info).state;
assert.equal(C.totalDue(C.apply(unpaid,command('mistake',{expectedPaid:0}),info).state),0);
const deposited=C.apply(C.empty('1'),{id:'deposit',kind:'deposit',memberId:'1',amount:4000},{}).state;
const funded=C.apply(deposited,{id:'walletAdd',kind:'add',memberId:'1',eventId:'E'},info).state;
assert.throws(()=>C.apply(funded,command('mistake'),info),/曾使用寄存金或盈餘/);
assert.equal(C.apply(funded,command('wallet'),info).state.wallet,4000);
console.log('PASS: paid/unpaid cancellation, mistake/refund/wallet choices, no duplicate refund, retained audit, stale totals, settled guard, re-registration and wallet funding protection.');
