const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),ctx={};vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('function calcPlayerForEvent('),html.indexOf('function memberHistoryInRange(')),ctx);
const calc=(p,e)=>ctx.calcPlayerForEvent(p,e),e={poolUnit:3000,admin:400,earlyBirdDiscount:100,lateBirdDiscount:200},p={buyin:1,rebuy:0,addon:0,manualDiscount:0};
assert.equal(calc({...p,ladies:true},e).paid,3200);assert.equal(calc({...p,ladies:true},e).pool,3000);
assert.equal(calc({...p,ladies:true,rebuy:1},e).paid,6400); // ladies discount applies once per event
assert.equal(calc({...p,ladies:true},{...e,ladiesDiscount:0}).paid,3400);
assert.equal(calc({...p,ladies:true,earlyBird:true,manualDiscount:50},{...e,ladiesDiscount:300}).paid,2950);
assert.equal(calc({...p,ladies:true},{pricingMode:'custom',buyinTotal:5700,buyinAdmin:700,rebuyTotal:5350,rebuyAdmin:350}).paid,5350);
assert.equal(calc({...p,ladies:true,buyin:0},e).paid,0);
// Compact search: never enumerate the directory before typing; omit current entrants.
const nodes={addPlayerMember:{value:'',innerHTML:'',hidden:false}};
ctx.$=id=>nodes[id];ctx.db={members:[{id:'1',name:'甲',nickname:'小甲'},{id:'2',name:'乙',nickname:'小乙'}]};ctx.currentEvent=()=>({players:[{memberId:'1'}]});ctx.memberSearchLabel_=m=>m.name+' '+m.nickname+' '+m.id;ctx.epcDisplayEscape_=x=>x;
vm.runInContext(html.slice(html.indexOf('function filterAddPlayerMembers('),html.indexOf('function syncAddPlayerSearch(')),ctx);
ctx.filterAddPlayerMembers('');assert(nodes.addPlayerMember.hidden);assert(!nodes.addPlayerMember.innerHTML.includes('小乙'));
ctx.filterAddPlayerMembers('小');assert(!nodes.addPlayerMember.hidden);assert(nodes.addPlayerMember.innerHTML.includes('小乙'));assert(!nodes.addPlayerMember.innerHTML.includes('小甲'));
ctx.filterAddPlayerMembers('2');assert.equal(nodes.addPlayerMember.value,'2');
assert(html.lastIndexOf('id="ppRegistrationDialog"')<html.lastIndexOf('<script src="player-payments.js'));
console.log('PASS: ladies defaults/custom price/once-only/pool protection; compact keyword search and registration DOM order.');
// Realtime player updates render the current event instead of hidden dashboards and reports.
const calls={full:0,fast:0,members:0,dashboard:0};ctx.window=ctx;ctx.cloneCloud_=x=>JSON.parse(JSON.stringify(x));ctx.db={events:[]};ctx.$=id=>({classList:{contains:()=>id==='event'},style:{display:'none'}});ctx.currentEvent=()=>ctx.db.events[0];ctx.render=()=>calls.full++;ctx.renderEventFast_=()=>calls.fast++;ctx.renderMemberRows=()=>calls.members++;ctx.renderDashboardSummary=()=>calls.dashboard++;ctx.renderEventList=()=>{};ctx.renderActivities=()=>{};
vm.runInContext(html.slice(html.indexOf('function applyFirestoreEventsToLegacy_('),html.indexOf('\nwindow.epcModeRefreshEventFields_=')),ctx);
const raw={eventId:'A',businessDate:'2026-10-16',createdAt:1,status:'open',players:[]};ctx.applyFirestoreEventsToLegacy_([raw]);ctx.applyFirestoreEventsToLegacy_([{...raw,players:[{memberId:'2',buyin:1}]}]);assert.equal(calls.full,1);assert.equal(calls.fast,1);assert.equal(calls.members,0);assert.equal(calls.dashboard,0);
ctx.applyFirestoreEventsToLegacy_([{...raw,fee:600}]);assert.equal(calls.full,2);
console.log('PASS: player-only snapshots use scoped event rendering; configuration changes still refresh settings.');
