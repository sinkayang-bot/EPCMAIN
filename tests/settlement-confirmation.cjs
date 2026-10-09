const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),core=require('../phone/stack-core.js');
const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
(async()=>{
 const remote={status:'open',players:[{memberId:'A',stack:100,_stackRevision:1,prize:200}]};
 const event=JSON.parse(JSON.stringify(remote));event.id='E';event.endTime='04:55';
 const c={currentEvent:()=>event,persist:()=>{},calcPlayerForEvent:()=>({groups:1}),$:()=>null,manualPrizeValidation:()=>({ok:true}),money:String};
 vm.createContext(c);vm.runInContext(extract('function setStackFast_','function calculateICM'),c);
 // Original report editor changed stack without revision: exact server rejection.
 assert.throws(()=>core.protectStacks({...remote,players:[{...remote.players[0],stack:200}]},remote),/較新/);
 c.setStackFast_(0,200);assert.equal(event.players[0]._stackRevision,2);
 assert.equal(core.protectStacks(event,remote,{settle:true}).players[0].stack,200);
 assert.throws(()=>core.protectStacks(remote,event,{settle:true}),/重算獎金/);
 assert.equal(core.protectStacks(remote,event).players[0].stack,200,'normal stale saves still preserve latest phone chips');
 event.status='已結算';c.setStackFast_(0,999);assert.equal(event.players[0].stack,200);event.status='進行中';
 let writes=0,release,fail=true,messages=[];
 const history=[{eventId:'OTHER',net:12}];
 Object.assign(c,{db:{events:[event],members:[{id:'A',history}]},requireEvent:()=>event,validateSettlement:()=>({ok:true}),poolInfo:()=>({jp:4200}),accountingInfo:()=>({net:5600}),touchEvent_:e=>e._eventUpdatedAt=10,memberHistory_:m=>m.history,closeSettlementConfirm:()=>{},actionMsg:m=>messages.push(m),render:()=>{},cloudReady:false,showPage:()=>{},persist:()=>writes++,syncEventToFirestore_:async(candidate,immediate,options)=>{assert.equal(event.status,'進行中','local event stays open while saving');assert.equal(candidate.status,'已結算');assert.equal(options.settle,true);if(fail)throw Error('conflict');await new Promise(r=>release=r);return true;}});
 vm.runInContext(extract('let settlementInFlight_=','async function unlockSettledEvent'),c);
 await c.executeFormalSettlement();assert.equal(event.status,'進行中');assert.equal(event.finalJP,undefined);assert.equal(c.db.members[0].history,history);assert.equal(writes,0);assert.match(messages.at(-1),/conflict/);
 fail=false;const pending=c.executeFormalSettlement();await c.executeFormalSettlement();assert.equal(event.status,'進行中');release();await pending;
 assert.equal(event.status,'已結算');assert.equal(event.finalJP,4200);assert.equal(writes,1);assert.equal(c.db.members[0].history.length,2);
 console.log('PASS: report stack revision, real conflict protection, failed settlement preserves status/history, confirmed commit and duplicate-click guard.');
})();
