import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8'),data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const core=data(read('timer-core.js').replace("'./player-pricing.js'",JSON.stringify(data(read('player-pricing.js')))));
const {STANDARD_TEMPLATE,buildEventTimer,createEventWithTimer,stageEventTimer}=await import(data(read('timer-store.js').replace("'./timer-core.js?v=20261021-3'",JSON.stringify(core))));
const template={...STANDARD_TEMPLATE,name:'EPC 3400 範本',startingStack:50000,levels:[{sb:100,bb:200,ante:200,min:12},{break:true,min:5}],announcement:'歡迎參賽',payoutInput:'第一名 10,000'};
const event={eventId:'E-test',name:'EPC 測試',chips:300000,players:[],status:'open'};
const built=buildEventTimer(event,template,'T-test',{creating:true});assert.equal(built.event.chips,50000);assert.equal(built.event.timerId,event.eventId);assert.equal(built.timer.remaining,720);assert.equal(built.timer.running,false);assert.equal(built.timer.announcement,'歡迎參賽');
template.levels[0].min=30;assert.equal(built.timer.levels[0].min,12,'Future template edits must not reset a live timer');
assert.equal(buildEventTimer(event,template,'T-test').event.chips,300000,'Attaching to an existing event must preserve its chips');
function fakeStore({failTimer=false}={}){
 const memory=new Map([['epc_events/_epc_timer/templates/T-test',structuredClone(template)]]);
 const fs={doc:(db,...parts)=>parts.join('/'),serverTimestamp:()=>123,runTransaction:async(db,fn)=>{const writes=[];let writing=false;const tx={get:async ref=>{assert(!writing,'All Firestore reads must precede writes');return {exists:()=>memory.has(ref),data:()=>structuredClone(memory.get(ref))}},set:(ref,value)=>{writing=true;if(failTimer&&ref.includes('/timers/'))throw Error('write denied');writes.push([ref,structuredClone(value)])}};const value=await fn(tx);for(const [ref,row] of writes)memory.set(ref,row);return value}};
 return {fs,memory};
}
let {fs,memory}=fakeStore(),guardCalls=0;
const created=await createEventWithTimer({fs,db:{},event,templateId:'T-test',assertWrite:()=>guardCalls++});
assert.equal(guardCalls,1);assert.equal(created.timerTemplateId,'T-test');assert(memory.has('epc_events/E-test'));assert(memory.has('epc_events/_epc_timer/timers/E-test'));
const saved=structuredClone(memory.get('epc_events/_epc_timer/timers/E-test'));saved.remaining=47;saved.running=true;saved.endsAt=123456;memory.set('epc_events/_epc_timer/timers/E-test',saved);
const attach=await fs.runTransaction({},tx=>stageEventTimer({tx,fs,db:{},event,templateId:'T-test'}));assert.equal(attach.timer,null);assert.equal(memory.get('epc_events/_epc_timer/timers/E-test').remaining,47);
await assert.rejects(()=>createEventWithTimer({fs,db:{},event,templateId:'T-test'}),/已存在/);
for(const options of [{templateId:'missing'},{templateId:'T-test',assertWrite:()=>{throw Error('view only')}},{templateId:'T-test',failTimer:true}]){
 const store=fakeStore(options);await assert.rejects(()=>createEventWithTimer({fs:store.fs,db:{},event,...options}));assert(!store.memory.has('epc_events/E-test'));assert(!store.memory.has('epc_events/_epc_timer/timers/E-test'));
}
const source=read('index.html');assert(source.includes('data-page="timers"'));assert(source.includes('newEventTimerTemplate'));assert(source.includes('createEvent({...firestoreEventPayload_(e),status:\'open\',revision:1},{timerTemplateId})'));assert(!read('timer-control.html').includes('建立本場計時器'));
console.log('Timer creation: atomic event/timer creation, template snapshot, chips, failed-write rollback, duplicate prevention, view guard and independent navigation passed.');
