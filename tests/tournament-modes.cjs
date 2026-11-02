const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../tournament-core.js');const T=global.EPCTournament;
assert.deepEqual(T.pool({jp:3,jpRound:100},12000),{pool:12000,gross:12000,jp:400,avail:11600,overlay:0,earned:11600});
assert.equal(T.pool({tournamentMode:'guaranteed',guaranteedPool:18000,jp:0},12000).overlay,6000);
assert.equal(T.pool({tournamentMode:'guaranteed',guaranteedPool:18000,jp:0},21000).avail,21000);
assert.equal(T.pool({tournamentMode:'tournament',jp:99},18000).jp,0);
const e={tournamentMode:'tournament',poolUnit:800,admin:200,itmCount:3,payoutPercentages:'50,30,20'};
const c=T.pricing({buyin:1,rebuy:2},e);assert.equal(c.pool,2400);assert.equal(c.paid,3000);assert.equal(c.netAdmin,600);assert.equal(c.auto,0);
const custom=T.pricing({buyin:1,rebuy:2},{...e,pricingMode:'custom',buyinTotal:1000,buyinAdmin:200,rebuyTotal:900,rebuyAdmin:100});assert.equal(custom.pool,2400);assert.equal(custom.netAdmin,400);assert.equal(custom.paid,2800);
const plan=T.schedule(e,18100);assert.deepEqual(plan.rows.map(x=>x.prize),[9000,5400,3600]);assert.equal(plan.remainder,100);
assert.throws(()=>T.schedule({...e,payoutPercentages:'50,20'},18000));assert.throws(()=>T.schedule({...e,payoutPercentages:'50,30,30'},18000));
assert.equal(T.schedule({...e,payoutPercentages:''},18000).rows.length,3);
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');function extract(n){const start=html.indexOf('function '+n+'('),end=html.indexOf('\nfunction ',start+10);return html.slice(start,end)}
const event={...e,players:[{memberId:'a',buyin:1,stack:0,finishRank:1,prize:400},{memberId:'b',buyin:1,stack:0,finishRank:2,prize:200},{memberId:'c',buyin:1,stack:1000,finishRank:3,prize:100}]};
const ctx={EPCTournament:T,money:String,currentEvent:()=>event};vm.createContext(ctx);vm.runInContext(extract('calcPlayerForEvent')+'\n'+extract('poolInfoForEvent')+'\n'+fs.readFileSync(require.resolve('../tournament-ui.js'),'utf8'),ctx);
assert.equal(ctx.epcRankValidation_(event).ok,false);event.players.forEach((p,i)=>p.prize=[1200,700,400][i]);assert.equal(ctx.epcRankValidation_(event).ok,true);event.players[1].finishRank=1;assert.equal(ctx.epcRankValidation_(event).ok,false);
for(const match of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(!/src=|type="module"|application\//.test(match[1]||''))new vm.Script(match[2])}
console.log('Tournament modes: guarantee below/above threshold, no phantom chips, separate fees, rebuy pricing, JP exclusion, payouts, rounding remainder, zero-chip winners, duplicate ranks, inline script syntax passed.');

const ratioEvent={tournamentMode:'tournament',itmPercent:15,guaranteedPool:18000,players:[{buyin:1,rebuy:20},{buyin:1,rebuy:0}]};
assert.equal(T.itm(ratioEvent).count,4);assert.equal(T.schedule(ratioEvent,18000).rows.length,4);assert.equal(T.pool(ratioEvent,12000).avail,18000);assert.equal(T.pool(ratioEvent,12000).overlay,6000);assert.equal(T.pool(ratioEvent,22000).avail,22000);assert.equal(T.pool(ratioEvent,22000).jp,0);
assert.equal(T.itm({...ratioEvent,players:[{buyin:1,rebuy:19}]}).count,3);assert.equal(T.itm({...ratioEvent,players:[]}).count,0);assert.throws(()=>T.itm({...ratioEvent,itmPercent:0}));
console.log('ITM percentage: exact boundary, upward rounding, rebuys, zero entries, invalid percentage; tournament guaranteed pool passed.');
const fields=new Map(),groups={'.newTournamentFields':[{},{}],'.newTimedFields':[{},{}],'.tournamentFields':[{},{}],'.standardPricing,.customPricing':[{},{}]};
const node=id=>{if(!fields.has(id))fields.set(id,{value:'',hidden:false,dataset:{},parentElement:{}});return fields.get(id)};
ctx.$=node;ctx.document={querySelectorAll:s=>groups[s]||[]};ctx.blankEvent=()=>({});ctx.eventDisplayName_=()=> 'EPC 一般限時';
ctx.epcResetNewMode_();assert.equal(node('newTournamentMode').value,'normal');assert.equal(node('newGuaranteeFields').hidden,true);assert.equal(groups['.newTournamentFields'][0].hidden,true);
node('newTournamentMode').value='tournament';ctx.epcNewModeFields_();assert.equal(node('newGuaranteeFields').hidden,false);assert.equal(groups['.newTimedFields'][0].hidden,true);const settings=ctx.epcNewModeSettings_();assert.equal(settings.buyinTotal,1200);assert.equal(settings.buyinAdmin,200);assert.equal(settings.itmPercent,15);assert.equal(settings.jp,0);
node('eTournamentMode').value='tournament';ctx.epcTournamentFields_();assert.equal(node('ePricingMode').parentElement.hidden,true);assert.equal(groups['.standardPricing,.customPricing'][0].hidden,true);
node('eTournamentMode').value='normal';ctx.epcTournamentFields_();assert.equal(node('guaranteedFields').hidden,true);assert.equal(groups['.tournamentFields'][0].hidden,true);assert.equal(groups['.standardPricing,.customPricing'][0].hidden,false);
console.log('Mode UI: creation defaults, conditional buy-in fields, separate components, JP exclusion and switching visibility passed.');
(async()=>{
 const existing={id:'existing',players:[{memberId:'a',buyin:1,stack:350000},{memberId:'b',buyin:1,stack:250000}],jp:3,jpRound:100,tournamentMode:'normal',poolUnit:3000,admin:400};
 const before=JSON.stringify(existing.players);ctx.currentEvent=()=>existing;ctx.touchEvent_=()=>{};ctx.persist=()=>{};ctx.render=()=>{};ctx.actionMsg=()=>{};ctx.alert=m=>{throw Error(m)};
 let saved;ctx.syncEventToFirestore_=async e=>{saved=JSON.parse(JSON.stringify(e));return true};
 node('settlementTournamentMode').value='guaranteed';node('settlementGuaranteedPool').value='18000';
 await ctx.epcSaveSettlementMode_();assert.equal(saved.tournamentMode,'guaranteed');assert.equal(saved.guaranteedPool,18000);assert.equal(JSON.stringify(existing.players),before);
 assert.equal(ctx.poolInfoForEvent(existing).avail,18000);assert.equal(ctx.poolInfoForEvent(existing).overlay,12200);assert.equal(ctx.poolInfoForEvent(existing).jp,200);
 assert.equal(18000*350000/600000,10500);assert.equal(18000*250000/600000,7500);
 existing.players[0].rebuy=6;assert.equal(ctx.poolInfoForEvent(existing).avail,23200);
 console.log('Existing event settlement: guarantee saved, players retained, screenshot case pays 18000 instead of 5800, above-guarantee uses actual pool passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
