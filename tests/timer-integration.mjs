import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const pricing=read('player-pricing.js');
const {newTimer,command,remaining,parseTime,eventTotals,validateLevels}=await import(data(read('timer-core.js').replace("'./player-pricing.js'",JSON.stringify(data(pricing)))));
let t=newTimer();t=command(t,'set','12:35',1000);assert.equal(t.remaining,755);
t=command(t,'toggle',undefined,1000);assert.equal(remaining(t,6000),750);
const restored=JSON.parse(JSON.stringify(t));assert.equal(remaining(restored,11000),745);
t=command(t,'toggle',undefined,11000);assert.equal(remaining(t,90000),745);
t=command(t,'shift',-60,90000);assert.equal(t.remaining,685);
t=command(t,'structure',[{sb:100,bb:200,ante:200,min:1},{break:true,min:5}],90000);
t=command(t,'level',1,90000);assert.equal(t.levels[t.index].break,true);assert.equal(t.remaining,300);
t=command(t,'toggle',undefined,90000);assert.equal(remaining(t,390000),0);
t=command(t,'set','00:10',400000);assert.equal(t.running,false);
assert.equal(parseTime('05：09'),309);for(const bad of ['12:60','755','-1:00','NaN:00','6000:00'])assert.throws(()=>parseTime(bad));
assert.throws(()=>validateLevels([{min:0,sb:1,bb:2,ante:2}]));assert.throws(()=>validateLevels([]));
const raw={buyin:3000,fee:400,jpRate:3,jpRound:100,chips:300000,players:[{buyin:1,rebuy:2,addon:0},{buyin:1,rebuy:0,addon:1}]};
assert.deepEqual(eventTotals(raw),{players:2,rebuyPlayers:2,groups:5,chips:1500000,average:750000,pool:14500,gross:15000,jp:500});
assert.equal(eventTotals({...raw,finalJP:300}).pool,14700);assert.equal(eventTotals({...raw,players:[]}).average,null);
const html=read('index.html');
function extract(name){const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+10);return html.slice(start,end)}
const official=new Function(extract('calcPlayerForEvent')+'\n'+extract('poolInfoForEvent')+'\nreturn poolInfoForEvent;')();
for(const extra of [{},{pricingMode:'custom',buyinTotal:6900,buyinAdmin:900,rebuyTotal:6500,rebuyAdmin:500}, {jpRate:0},{jpRate:3.5,jpRound:1000}]){
 const r={...raw,...extra},legacy={...r,poolUnit:r.buyin,admin:r.fee,jp:r.jpRate};
 assert.equal(eventTotals(r).pool,official(legacy).avail);
}
assert(!read('timer-cloud.js').includes('upsertEvent'));assert(!read('timer-view.js').includes('.change('));
console.log('Timer integration: countdown, restore, pause, break, validation, JP/pricing parity and read-only projector checks passed.');
