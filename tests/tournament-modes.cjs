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
