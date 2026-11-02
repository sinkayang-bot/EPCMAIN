(function(root){
'use strict';
const n=x=>Math.max(0,Number(x)||0);
function mode(e){return ['normal','guaranteed','tournament'].includes(e?.tournamentMode)?e.tournamentMode:'normal'}
function pool(e,gross){
 gross=n(gross);const m=mode(e),rate=m==='tournament'?0:n(e.jp??e.jpRate),unit=Math.max(1,n(e.jpRound)||1);
 const jp=rate?Math.ceil(gross*rate/100/unit)*unit:0;
 const earned=Math.max(0,gross-jp),guarantee=m!=='normal'?n(e.guaranteedPool):0;
 let avail=Math.max(earned,guarantee);const unroundedAvail=avail,overlay=Math.max(0,guarantee-earned);
 if(m==='tournament'){
  avail=Math.floor(unroundedAvail/100)*100;
 }
 return {pool:gross+overlay,gross,jp,avail,overlay,earned,...(m==='tournament'?{unroundedAvail,roundingRemainder:unroundedAvail-avail}:{})};
}
function itm(e){
 const entries=(e.players||[]).reduce((s,p)=>s+n(p.buyin)+n(p.rebuy)+n(p.addon),0);
 if(e.itmPercent!=null){const percent=Number(e.itmPercent);if(!Number.isFinite(percent)||percent<=0||percent>100)throw Error('ITM 比例須大於 0 且不超過 100%');return {entries,percent,count:Math.ceil(entries*percent/100)}}
 return {entries,percent:null,count:Math.floor(n(e.itmCount))};
}
function schedule(e,amount){
 const count=itm(e).count;if(count===0&&e.itmPercent!=null)return {rows:[],total:0,remainder:n(amount)};if(count<1||count>500)throw Error('ITM 人數須為 1–500 人');
 const custom=String(e.payoutPercentages||'').trim();
 const weights=custom?custom.split(/[,，\s]+/).map(Number):Array.from({length:count},(_,i)=>1/Math.pow(i+1,1.15));
 if(weights.length!==count||weights.some(x=>!Number.isFinite(x)||x<=0))throw Error('獎金比例筆數須等於 ITM 人數，每個比例須大於 0');
 const sum=weights.reduce((a,b)=>a+b,0);
 if(custom&&Math.abs(sum-100)>0.00001)throw Error('自訂獎金比例合計須為 100%');
 if(weights.some((v,i)=>i>0&&v>weights[i-1]))throw Error('名次獎金比例須由高至低');
 const rows=weights.map((v,i)=>({rank:i+1,percent:v/sum*100,prize:Math.floor(n(amount)*v/sum/100)*100}));
 return {rows,total:rows.reduce((a,b)=>a+b.prize,0),remainder:n(amount)-rows.reduce((a,b)=>a+b.prize,0)};
}
function adminRemainder(e,gross){
 if(mode(e)!=='tournament')return 0;
 const info=pool(e,gross);
 try{const plan=schedule(e,info.unroundedAvail);return plan.rows.length?plan.remainder:0}catch(_){return 0}
}
function pricing(p,e){
 const buy=n(p.buyin),re=n(p.rebuy)+n(p.addon),groups=buy+re,custom=e.pricingMode==='custom';
 const ba=n(custom?e.buyinAdmin:e.admin),ra=n(custom?e.rebuyAdmin:e.admin);
 const bt=custom?n(e.buyinTotal):n(e.poolUnit)+ba,rt=custom?n(e.rebuyTotal):n(e.poolUnit)+ra;
 const earlyDiscount=groups&&p.earlyBird?n(e.earlyBirdDiscount):0,lateDiscount=groups&&p.lateBird?n(e.lateBirdDiscount):0,ladiesDiscount=groups&&p.ladies?n(e.ladiesDiscount??Math.floor(ba/2)):0;
 const manual=n(p.manualDiscount)+earlyDiscount+lateDiscount+ladiesDiscount,original=buy*bt+re*rt,grossAdmin=buy*ba+re*ra;
 return {groups,original,paid:Math.max(0,original-manual),pool:buy*Math.max(0,bt-ba)+re*Math.max(0,rt-ra),grossAdmin,netAdmin:Math.max(0,grossAdmin-manual),manual,auto:0,totalDiscount:manual,earlyDiscount,lateDiscount,ladiesDiscount,birdDiscount:earlyDiscount+lateDiscount,rebuyDiscount:0,overbuyDiscount:0,accountingRebuyDiscount:0,accountingGroupDiscount:0};
}
const api={version:6,mode,pool,schedule,pricing,itm,adminRemainder};
 const old=root.EPCTournament;let active=Number(old?.version)>api.version?old:api;
 Object.defineProperty(root,'EPCTournament',{configurable:true,enumerable:true,get(){return active},set(value){if(Number(value?.version)>=Number(active.version))active=value}});
})(globalThis);
