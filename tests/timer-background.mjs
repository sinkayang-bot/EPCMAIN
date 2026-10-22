import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8'),data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const core=data(read('timer-core.js').replace("'./player-pricing.js'",JSON.stringify(data(read('player-pricing.js')))));
const {command,newTimer,remaining}=await import(core);
const {STANDARD_TEMPLATE,templateData,buildEventTimer}=await import(data(read('timer-store.js').replace("'./timer-core.js?v=20261023-tablet-rgb41'",JSON.stringify(core))));
for(const background of ['classic','black-gold','light','emerald','velvet']){
 const template=templateData({...STANDARD_TEMPLATE,background});
 const built=buildEventTimer({eventId:'test'},template,'test');assert.equal(built.timer.background,background);
 const running=command({...newTimer(),background:'classic'},'toggle',undefined,1000);
 const next=command(running,'settings',{announcement:'公告',payoutInput:'第一名 1000',background},7500);
 assert.equal(next.background,background);assert.equal(next.endsAt,running.endsAt);assert.equal(next.running,true);
 const reloaded=JSON.parse(JSON.stringify(next));assert.equal(remaining(reloaded,12000),1189);assert.equal(reloaded.background,background);
 const oldClient=command(next,'settings',{announcement:'新版公告',payoutInput:''},8000);assert.equal(oldClient.background,background);
}
assert.equal(templateData(STANDARD_TEMPLATE).background,'classic');
assert.equal(templateData({...STANDARD_TEMPLATE,background:'https://untrusted.invalid'}).background,'classic');
const running=command({...newTimer(),announcement:'保持公告'},'toggle',undefined,1000);
const changed=command(running,'background','velvet',5000);assert.equal(changed.endsAt,running.endsAt);assert.equal(changed.announcement,'保持公告');assert.deepEqual(changed.levels,running.levels);assert.equal(changed.background,'velvet');
assert(read('firebase-events.js').includes('timer-store.js?v=20261023-tablet-rgb41'));
assert(read('index.html').includes('firebase-events.js?v=20261023-tablet-rgb41'));
console.log('Backgrounds: template snapshots, all four art choices, legacy fallback, live countdown preservation, reload and old-client text edits passed.');
