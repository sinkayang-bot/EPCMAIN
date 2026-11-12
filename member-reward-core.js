/* Member reward points are derived from event participation, never accounting totals. */
(function(root){
 'use strict';
 const defaults={from:'2026-11-16',to:'2026-11-27',base1200:1,base3400:2,base6600:3,weekdayFirst:1,weekendFirst:2,weekendExtra:1,paidThreshold:21,freeThreshold:45};
 const scoreFields={base1200:'1200 級別點數',base3400:'3400 級別點數',base6600:'6600 以上級別點數',weekdayFirst:'平日首場加分',weekendFirst:'假日首場加分',weekendExtra:'假日非首場加分',paidThreshold:'付費報名門檻',freeThreshold:'免費參賽基準'};
 function settings(options={}){
  options=options||{};
  const result={...defaults,...options};
  for(const [key,label] of Object.entries(scoreFields)){
   const value=options[key]==null?defaults[key]:Number(options[key]);
   if(options[key]===''||!Number.isSafeInteger(value)||value<0)throw Error(label+'須為非負整數');
   result[key]=value;
  }
  if(result.freeThreshold<result.paidThreshold)throw Error('免費參賽基準不得低於付費報名門檻');
  return result;
 }
 const eventId=e=>String(e.eventId||e.id||'');
 const day=e=>String(e.businessDate||e.date||'').slice(0,10);
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 const weekend=date=>[0,6].includes(new Date(date+'T12:00:00Z').getUTCDay());
 const time=value=>{const m=String(value||'').match(/^(\d{1,2}):(\d{2})$/);return m&&+m[1]<24&&+m[2]<60?+m[1]*60+(+m[2]):null;};
 function independent(e){
  const group=String(e.accountingGroup||e.accountGroup||'').trim();
  return e.memberRewardIndependent===true||!!group&&!['一般帳','一般','主帳'].includes(group);
 }
 function basePoints(e,config){
  const level=Number(String(e.level??e.buyinTotal??'').replace(/,/g,''));
  if(level>=6600)return config.base6600;
  return level===3400?config.base3400:level===1200?config.base1200:null;
 }
 function overrideKey(period,id,memberId){return JSON.stringify([period.from,period.to,id,memberId]);}
 function qualification(points,options={}){
  const config=settings(options);
  return {canRegister:points>=config.paidThreshold,freeEntry:points>config.freeThreshold,chips:Math.min(30000,20000+Math.max(0,points-config.freeThreshold)*500)};
 }
 function rules(options={}){
  const c=settings(options);
  return '1200 每場 '+c.base1200+' 點，3400 每場 '+c.base3400+' 點，6600 以上每場 '+c.base6600+' 點。每位玩家每場計一次，重買與加購不另加點。店內當日首場，平日 19:10 前報名 +'+c.weekdayFirst+' 點，假日 17:10 前報名 +'+c.weekendFirst+' 點。假日非首場額外 +'+c.weekendExtra+' 點，首場不疊加。'+c.paidThreshold+' 點以上可付費報名，超過 '+c.freeThreshold+' 點首次免費參賽。起始 20,000，超過 '+c.freeThreshold+' 點每多 1 點 +500，含加成最高 30,000。點數為資格門檻，不扣點。';
 }
 function registration(player,date,cutoff){
  const raw=player.registeredAt;
  if(raw==null||raw==='')return {early:null,time:''};
  const numeric=Number(raw),stamp=Number.isFinite(numeric)?numeric:Date.parse(raw);
  if(!Number.isFinite(stamp)||stamp<=0)return {early:null,time:''};
  const d=new Date(stamp);
  if(Number.isNaN(d.getTime()))return {early:null,time:''};
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
  const get=key=>parts.find(x=>x.type===key).value;
  const civil=get('year')+'-'+get('month')+'-'+get('day'),hm=get('hour')+':'+get('minute');
  return {early:civil===date&&time(hm)<=cutoff,time:civil+' '+hm};
 }
 function score(events,period=defaults,options={}){
  const config=settings({...period,...options});
  if(!validDate(period.from)||!validDate(period.to)||period.from>period.to)throw Error('活動日期無效，結束日不得早於開始日');
  const unique=new Map();
  for(const e of events||[]){
   if(!e||!eventId(e)||!validDate(day(e))||day(e)<period.from||day(e)>period.to||e.deleted||['deleted','cancelled','canceled','已取消'].includes(e.status)||independent(e)||e.tournamentMode==='tournament')continue;
   if(!unique.has(eventId(e)))unique.set(eventId(e),e);
  }
  const days=new Map();
  for(const e of unique.values()){const date=day(e);if(!days.has(date))days.set(date,[]);days.get(date).push(e);}
  const totals=new Map();
  for(const [date,all] of days){
   // Explicit day sequence takes priority. Missing sequences fall back to opening order.
   const order=e=>{const minutes=time(e.startTime);return minutes===null?Infinity:(minutes+17*60)%(24*60);};
   all.sort((a,b)=>(Number(a.seq)>0?Number(a.seq):Infinity)-(Number(b.seq)>0?Number(b.seq):Infinity)||order(a)-order(b)||eventId(a).localeCompare(eventId(b)));
   const holiday=weekend(date),first=all[0];
   for(const e of all){
    const base=basePoints(e,config);if(base===null)continue;
    const seen=new Set();
    for(const p of e.players||[]){
     const memberId=String(p.memberId||p.memberKey||'').trim();
     if(!memberId||seen.has(memberId)||p.deleted||['deleted','cancelled','canceled','已取消'].includes(p.status))continue;
     // Preserve legacy rows without a buyin field, but ignore explicitly zero participation.
     if(p.buyin!=null&&!(Number(p.buyin)>0||Number(p.rebuy)>0||Number(p.addon)>0))continue;
     seen.add(memberId);
     const isFirst=e===first&&(!(Number(e.seq)>0)||Number(e.seq)===1),registered=registration(p,date,holiday?17*60+10:19*60+10);
     const key=overrideKey(period,eventId(e),memberId),override=options.earlyOverrides?.[key];
     const early=typeof override==='boolean'?override:registered.early;
     const firstRate=holiday?config.weekendFirst:config.weekdayFirst;
     const firstBonus=isFirst&&early===true?firstRate:0,holidayBonus=holiday&&!isFirst?config.weekendExtra:0;
     const detail={eventId:eventId(e),date,level:e.level??e.buyinTotal,base,firstBonus,holidayBonus,points:base+firstBonus+holidayBonus,isFirst,pending:isFirst&&firstRate>0&&early===null,registeredTime:registered.time,overrideKey:key};
     const row=totals.get(memberId)||{memberId,points:0,games:0,pending:0,details:[]};
     row.points+=detail.points;row.games++;row.pending+=detail.pending?1:0;row.details.push(detail);totals.set(memberId,row);
    }
   }
  }
  return [...totals.values()].map(row=>({...row,...qualification(row.points,config)})).sort((a,b)=>b.points-a.points||a.memberId.localeCompare(b.memberId));
 }
 const api={defaults,scoreFields,settings,score,qualification,overrideKey,rules};
 root.EPCMemberReward=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
