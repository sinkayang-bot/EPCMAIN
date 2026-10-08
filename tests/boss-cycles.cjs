const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const events=[1,2,3].map(n=>({id:'E'+n,status:'已結算',date:'2026-10-07',seq:n,startTime:n+':00',players:Array.from({length:4},()=>({groups:2}))}));
const B={activityFrom:'',activityTo:'',excludedEventIds:[],startPrize:3000,attackThreshold:10000,cap:14000,normalPersonStep:1,normalPersonAmount:100,normalPersonIgnore:0,normalGroupStep:8,normalGroupAmount:200,normalGroupIgnore:8,huntGroupStep:8,huntGroupAmount:200,huntGroupIgnore:0,bosses:[{id:'ONE',startEventId:'E1',endEventId:'E2',cycleVersion:1,startPrize:3000,attacks:[],killed:false}],activeBossId:'ONE',attackEnabled:true};
const ctx={db:{events,activityManagement:{boss:B}},actBusinessDate_:e=>e.date,actGroups_:p=>p.groups,persist(){},window:{},renderActivities(){}};
vm.createContext(ctx);vm.runInContext(slice('function bossEventOrder_(e){','function bossEventOptions_'),ctx);vm.runInContext(slice('function bossBonus_(','function bossCurrentHp_'),ctx);vm.runInContext(slice('function addNewBoss_(){','function bossRename_'),ctx);
assert.equal(ctx.bossStats_().pool,3800);assert.equal(ctx.bossStats_().active,false,'new cycle ignores old global attack toggle');
const first=B.bosses[0];first.frozenStats={...ctx.bossStats_()};first.killed=true;events[0].players.push({groups:30});events.push({...events[2],id:'E4',startTime:'4:00',seq:4});assert.equal(ctx.bossStats_().pool,3800,'killed pool is frozen despite event edits and additions');
ctx.addNewBoss_();const second=ctx.activeBoss_();assert.equal(second.startEventId,'E3');assert.equal(ctx.bossStats_().pool,3800,'new cycle includes E3 and E4 only');assert.equal(ctx.bossStats_().active,false);second.startEventId='MISSING';assert.equal(ctx.bossStats_().pool,3000,'missing boundary cannot include all past events');second.startEventId='';assert.equal(ctx.bossEvents_().length,0,'unselected start waits for selection');B.activeBossId=first.id;assert.equal(ctx.bossStats_().pool,3800);console.log('PASS: inclusive boss bounds, next-event start, separate attack state, frozen killed pool and safe missing boundaries.');

const actual=[["D5-FOURTH","2026-10-05","第四場",6,17],["D6-FIRST","2026-10-06","第一場",6,7],["D5-THIRD","2026-10-05","第三場",5,10],["D6-SECOND","2026-10-06","第二場",7,13],["D6-THIRD","2026-10-06","第三場",6,14],["D6-FOURTH","2026-10-06","第四場",7,23]].map(([id,date,name,n,g])=>({id,date,name,status:'已結算',seq:1,startTime:'',players:Array.from({length:n},(_,i)=>({groups:i?1:g-n+1}))}));
ctx.db.events=actual;B.activeBossId='FIXTURE';B.bosses.push({id:'FIXTURE',startEventId:'D5-THIRD',startPrize:3000,cycleVersion:1,attacks:[]});const result=ctx.bossStats_();assert.equal(result.pool,7100);assert.equal(result.npb,3700);assert.equal(result.ngb,400);assert.equal(result.ng,84);console.log('PASS: actual 10/5 third through 10/6 fourth includes fourth event, 37 people + per-event groups = 7100.');

// Running events calculate both people and groups immediately.
ctx.db.events=[{id:'LIVE',date:'2026-10-07',seq:1,status:'進行中',players:[{groups:16},{groups:0}]}];
B.activeBossId='LIVE-BOSS';B.bosses.push({id:'LIVE-BOSS',startEventId:'LIVE',startPrize:3000,cycleVersion:1,attacks:[]});
assert.equal(ctx.bossStats_().pool,3400);assert.equal(ctx.bossStats_().npb,200);assert.equal(ctx.bossStats_().ngb,200);
ctx.db.events[0].status='settled';assert.equal(ctx.bossStats_().pool,3400,'settlement must not duplicate bonuses');
ctx.db.events[0].players.push({groups:8});assert.equal(ctx.bossStats_().pool,3700,'live changes recalculate people and groups');
B.bosses.at(-1).startPrize=9800;ctx.db.events[0].players=[{groups:16}];ctx.db.events[0].status='進行中';
assert.equal(ctx.bossStats_().pool,10400,'live event crosses attack threshold');
ctx.db.events.push({id:'LIVE2',date:'2026-10-07',seq:2,status:'進行中',players:[{groups:24}]});
assert.equal(ctx.bossStats_().pool,11000);assert.equal(ctx.bossStats_().hgb,1000,'16 groups +400 and 24 groups +600');assert.equal(ctx.bossStats_().hpb,0);
ctx.db.events[1].status='已結算';assert.equal(ctx.bossStats_().pool,11000);
console.log('PASS: live people/groups, threshold switching, every-eight hunt bonus, settlement without duplication.');
