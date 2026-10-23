// Snapshot of the authoritative back-office functions in index.html.
// Server-only: raw member IDs and event players must never be returned to clients.
import {calcPlayerForEvent as price,fromRawEvent} from './shared/player-pricing.js';
export const ACTIVITY_KINDS=['rank','hunter','umbrella','extremeTen'];
export function calculateActivities(activity,events,names={}){
 const db={activityManagement:activity,events,settings:{businessStart:'16:00'}},window={EPC_FIRESTORE_LAST_EVENTS:events};
 const ensureActDb_=()=>{},businessDateForEvent=e=>String(e.businessDate||e.date||''),eventDisplayName_=e=>e.name||'',epcPlayerDisplayName_=id=>names[String(id)]||String(id);
 const hmMinutes=(v,fallback)=>{const a=String(v||fallback).split(':').map(Number);return a[0]*60+a[1]},calcPlayerForEvent=(p,e)=>price(p,fromRawEvent(e));
 const actActivityRange_=kind=>activity.activityRanges?.[kind]||{from:'',to:''};
function accountingGroupForEvent(e){
 const raw=String(e&&e.accountingGroup||'').trim();
 // "一般帳" is the main ledger label, not an independent accounting group.
 // Older data/UI could persist this display label as a real group value, which
 // made accountingEventsForDate() exclude every event and zeroed the on-screen totals.
 if(!raw || raw==='一般帳' || raw==='一般' || raw==='主帳')return '';
 return raw;
}
// Any event with an accounting group is independent accounting and must never enter the main ledger/dashboard.
function isIndependentAccountingEvent(e){
 return !!accountingGroupForEvent(e);
}
function actBusinessDate_(e){return String(e?.businessDate||e?.date||businessDateForEvent(e)||'').slice(0,10)}
// Local event state is authoritative for accounting-group changes.
function actRecordEvent_(record){
 const id=String(record?.eventId||'');
 if(!id)return null;
 return (db.events||[]).find(e=>String(e.id)===id||String(e.eventId||'')===id)
  ||(window.EPC_FIRESTORE_LAST_EVENTS||[]).find(e=>String(e.eventId||e.id)===id)||null;
}
function actRecordEligible_(record){
 const e=actRecordEvent_(record);
 return !e||!isIndependentAccountingEvent(e);
}
function actNeedsSettled_(kind){return ['rank','hunter'].includes(String(kind||''))}
function isPioneerEvent_(e){return /^(?:第(?:一|1)場|EPC#1\s+\d+限時錦標賽)$/.test(String(eventDisplayName_(e)).trim());}
function actEvents_(kind=actTab_){
 const {from,to}=actActivityRange_(kind),needsSettled=kind==='weekly'?false:actNeedsSettled_(kind);
 const seenRankEvents=new Set();
 return (db.events||[]).filter(e=>{
  if(isIndependentAccountingEvent(e))return false;
  const d=actBusinessDate_(e),settled=e.status==='已結算'||e.status==='settled';
  if(kind==='pioneer'&&!isPioneerEvent_(e))return false;
  if(!d||(from&&d<from)||(to&&d>to)||(needsSettled&&!settled))return false;
  // Weekly rank is derived solely from settled events. Never count the same
  // event ID twice if a cloud merge introduced duplicate event records.
  if(kind==='rank'){
   const id=rankEventId_(e);
   if(id&&seenRankEvents.has(id))return false;
   if(id)seenRankEvents.add(id);
  }
  return true;
 }).sort((a,b)=>String(actBusinessDate_(b)||'').localeCompare(String(actBusinessDate_(a)||''))||(Number(b.seq||0)-Number(a.seq||0))||String(b.startTime||'').localeCompare(String(a.startTime||'')));
}
function rankDayNum_(dateStr){
 const d=new Date(String(dateStr||'')+'T12:00:00');
 return isNaN(d)?null:d.getDay();
}
function rankEventId_(e){return String(e?.eventId||e?.id||'').trim()}
function rankEventSeqOfDay_(e){
 const day=actBusinessDate_(e),opening=hmMinutes(db.settings?.businessStart||'16:00','16:00');
 const offset=x=>{
  const t=String(x.startTime||'');
  if(!/^\d{1,2}:\d{2}$/.test(t))return null;
  const m=hmMinutes(t,'00:00');return (m-opening+1440)%1440;
 };
 const seen=new Set();
 const same=(db.events||[]).filter(x=>{
  if(isIndependentAccountingEvent(x)||actBusinessDate_(x)!==day)return false;
  const id=rankEventId_(x);
  if(id&&seen.has(id))return false;
  if(id)seen.add(id);
  return true;
 }).slice().sort((a,b)=>{
  // The saved business-day sequence is authoritative. Some imported events
  // carry a default 16:00 start time, which must not move them ahead of #1.
  const sa=Number(a.seq),sb=Number(b.seq);
  if(Number.isFinite(sa)&&sa>0&&Number.isFinite(sb)&&sb>0&&sa!==sb)return sa-sb;
  const ta=offset(a),tb=offset(b);
  if(ta!==null&&tb!==null&&ta!==tb)return ta-tb;
  return bossEventOrder_(a)-bossEventOrder_(b)||rankEventId_(a).localeCompare(rankEventId_(b));
 });
 const id=rankEventId_(e);
 const idx=same.findIndex(x=>id?rankEventId_(x)===id:x===e);
 return idx>=0?idx+1:Math.max(1,Number(e?.seq)||1);
}
function rankTimeMatch_(time,from,to){
 time=String(time||'').slice(0,5);from=String(from||'').slice(0,5);to=String(to||'').slice(0,5);
 if(!time||!from||!to)return false;
 if(from===to)return time===from; // 00:00~00:00 = exact 00:00 start
 if(from<to)return time>=from&&time<=to;
 return time>=from||time<=to; // crosses midnight
}
function rankRuleMatch_(e,r){
 if(!r||!r.enabled)return false;
 const day=rankDayNum_(actBusinessDate_(e));
 if(Array.isArray(r.days)&&r.days.length&&!r.days.includes(day))return false;
 if(r.mode==='firstN')return rankEventSeqOfDay_(e)<=Math.max(1,+r.firstN||1);
 if(r.mode==='time')return rankTimeMatch_(e.startTime,r.from,r.to);
 return false;
}
function rankMultiplier_(e){
 const A=db.activityManagement||{},rules=A.rankRecurringRules||[];
 let mult=1;
 rules.forEach(r=>{if(rankRuleMatch_(e,r))mult=Math.max(mult,+r.mult||1)});
 return mult; // overlapping rules take highest multiplier, never multiply together
}
function eventTopScores_(e){
 const arr=(e.players||[]).filter(p=>p.stack!==null&&p.stack!==undefined&&p.stack!==''&&String(p.memberId||'').trim()).map(p=>({id:String(p.memberId),name:epcPlayerDisplayName_(p.memberId),net:chipGrowthFor(p,e),stack:+p.stack||0})).sort((a,b)=>b.net-a.net||b.stack-a.stack);
 let last=null,rank=0,seen=0;const mult=rankMultiplier_(e),out=[];
 for(const x of arr){seen++;const key=`${x.net}|${x.stack}`;if(key!==last){rank=seen;last=key}if(rank>3)break;const base=x.stack>0?(rank===1?3:rank===2?2:1):0;out.push({...x,rank,base,score:base*mult,mult})}
 return out;
}
function chipGrowthFor(p,e){
 let c=calcPlayerForEvent(p,e);
 let original=(+e.chips||0);
 if(original<=0)return 0;
 let invested=c.groups*original;
 return ((+p.stack||0)-invested)/original;
}
function bossEventOrder_(e){
 const match=String(e.name||'').match(/^第([一二三四五六七八九十\d]+)場/);
 const ord={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
 return match?(ord[match[1]]||Number(match[1])||(+e.seq||1)):(+e.seq||1);
}
function hunterRows_(){
 const phone=(Array.isArray(window.EPC_FIRESTORE_LAST_EVENTS)&&window.EPC_FIRESTORE_LAST_EVENTS.length?window.EPC_FIRESTORE_LAST_EVENTS:db.events||[]).flatMap(e=>{
  if(!actRecordEligible_({eventId:e.eventId||e.id})||isIndependentAccountingEvent(e))return [];
  const history=Array.isArray(e.hunterHeadHistory)?e.hunterHeadHistory:[];
  const byMember=new Map();
  for(const h of history){const k=String(h.memberId||'');if(k)byMember.set(k,(byMember.get(k)||0)+Number(h.delta||0))}
  const records=history.map(h=>({id:String(h.id),date:actBusinessDate_(e),eventId:e.eventId||e.id,killer:String(h.memberId),points:Number(h.delta||0),phone:true,note:'手機人頭登記｜'+Number(h.previous||0)+' → '+Number(h.total||0)}));
  const legacy=(e.players||[]).filter(p=>Number(p.hunterHeads||0)!==Number(byMember.get(String(p.memberId))||0)).map(p=>({id:'PHONE:'+(e.eventId||e.id)+':'+p.memberId,date:actBusinessDate_(e),eventId:e.eventId||e.id,killer:String(p.memberId),points:Number(p.hunterHeads||0)-Number(byMember.get(String(p.memberId))||0),phone:true,note:'歷史累計／其他來源調整'}));
  return [...records,...legacy];
 });
 const {from,to}=actActivityRange_('hunter');
 const corrections=db.activityManagement.hunterPhoneCorrections||{};
 const correctedPhone=phone.map(x=>{
   const correction=corrections[String(x.id)];
   return correction?{...x,points:Number(correction.points)||0,note:x.note+'｜後台修正 '+(Number(correction.points)||0)}:x;
 });
 return [...(db.activityManagement.hunter||[]),...correctedPhone].filter(x=>actRecordEligible_(x)&&(!from||x.date>=from)&&(!to||x.date<=to)).sort((a,b)=>{const day=String(b.date||'').localeCompare(String(a.date||''));if(day)return day;const eventFor=x=>(db.events||[]).find(e=>String(e.id)===String(x.eventId))||(window.EPC_FIRESTORE_LAST_EVENTS||[]).find(e=>String(e.eventId||e.id)===String(x.eventId));const ea=eventFor(a),eb=eventFor(b);const seq=(+eb?.seq||0)-(+ea?.seq||0);if(seq)return seq;const time=String(eb?.startTime||'').localeCompare(String(ea?.startTime||''));return time||String(b.id||'').localeCompare(String(a.id||''))});
}
function extremeTenRows_(){
 const A=db.activityManagement,{from,to}=actActivityRange_('extremeTen');
 return (A.extremeTen||[]).filter(x=>!x.deleted&&actRecordEligible_(x)&&(!from||x.date>=from)&&(!to||x.date<=to))
 .map(x=>({...x,difference:Math.abs(Number(x.cents)-1000),success:Number(x.cents)===1000}))
 .sort((a,b)=>a.difference-b.difference||String(a.createdAt||a.id).localeCompare(String(b.createdAt||b.id)));
}
function extremeTenStats_(){
 const rows=extremeTenRows_(),best=new Map(),awardByMember=new Map(),awardCounts=new Map();
 for(const row of rows){
  const member=String(row.memberId??'').trim();if(!member)continue;
  if(!best.has(member))best.set(member,row);
  if(row.awardType||row.claimed){
   if(!awardByMember.has(member))awardByMember.set(member,row);
   awardCounts.set(member,(awardCounts.get(member)||0)+1);
  }
 }
 const awarded=rows.filter(x=>x.awardType||x.claimed),remaining=Math.max(0,8-awarded.length);
 const leaderboard=[...best.entries()].map(([member,row])=>{
  const award=awardByMember.get(member);
  return {...row,awardType:award?.awardType||'',claimed:!!award?.claimed,awardRecordId:award?.id||'',awardCount:awardCounts.get(member)||0};
 });
 const successful=leaderboard.filter(x=>x.success&&!awardByMember.has(String(x.memberId)));
 // Only one best attempt per unawarded member can occupy a remaining prize slot.
 const candidates=leaderboard.filter(x=>!awardByMember.has(String(x.memberId))).slice(0,remaining);
 return {rows,leaderboard,awarded,remaining,successful,candidates,awardByMember};
}
function umbrellaRows_(range=actActivityRange_('umbrella')){
 const {from,to}=range;
 return (db.activityManagement.umbrella||[]).filter(x=>!x.deleted&&actRecordEligible_(x)&&(!from||x.date>=from)&&(!to||x.date<=to));
}
function umbrellaRanking_(rows){
 const totals=new Map();
 rows.forEach(x=>{const id=String(x.memberId??'');if(id)totals.set(id,(totals.get(id)||0)+(Number(x.coupons)||0));});
 return [...totals].map(([id,score])=>({id,memberId:id,name:epcPlayerDisplayName_(id),score})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
function displayLeaderboard_(kind){
 ensureActDb_();const A=db.activityManagement||{},tot={};
 if(kind==='pioneer'){
  Object.assign(tot,pioneerTotals_());
 }else if(kind==='hunter'){
  hunterRows_().forEach(x=>tot[x.killer]=(tot[x.killer]||0)+(+x.points||0));
 }else if(kind==='umbrella'){
  umbrellaRows_().forEach(x=>tot[x.memberId]=(tot[x.memberId]||0)+(+x.coupons||0));
 }else if(kind==='rank'){
  // Use the exact same calculation as 活動管理 → 週排行榜.
  actEvents_('rank').forEach(e=>{
   eventTopScores_(e).forEach(x=>tot[x.id]=(tot[x.id]||0)+(+x.score||0));
  });
  const ids=new Set([...Object.keys(tot),...Object.keys(A.rankAdjust||{})]);
  return [...ids].map(id=>{
   const auto=+tot[id]||0,adj=+(A.rankAdjust||{})[id]||0;
   return {id,memberId:id,name:epcPlayerDisplayName_(id),auto,adj,score:auto+adj};
  }).filter(x=>x.score!==0||x.auto!==0||x.adj!==0)
    .sort((a,b)=>b.score-a.score||b.auto-a.auto||String(a.name).localeCompare(String(b.name),'zh-Hant'))
    ;
 }
 return Object.entries(tot).map(([id,score])=>({id,memberId:id,name:epcPlayerDisplayName_(id),score})).sort((a,b)=>b.score-a.score);
}
 const output={};
 for(const kind of ACTIVITY_KINDS){
  const range=actActivityRange_(kind);
  if(!range.from||!range.to)continue;
  if(kind==='extremeTen'){
   let last=null,rank=0;output[kind]=extremeTenStats_().leaderboard.map((r,i)=>{if(last!==r.difference)rank=i+1;last=r.difference;return {memberId:String(r.memberId),rank,value:(r.cents/100).toFixed(2)}});
  }else output[kind]=displayLeaderboard_(kind).map((r,i)=>({memberId:String(r.memberId||r.id),rank:i+1,value:String(r.score)}));
 }
 return output;
}
export function publicActivity(kind,settings,range,ranked,identities,today){
 if(!ACTIVITY_KINDS.includes(kind)||settings?.enabled!==true)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(range?.from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(range?.to||'')||range.from>range.to)throw Error('活動區間必須完整且正確');
 const titles={rank:'週排行榜',hunter:'獵人排行榜',umbrella:'保護傘',extremeTen:'極限 10 秒'};
 return {active:true,name:titles[kind],subtitle:String(settings.subtitle||'').slice(0,120),from:range.from,to:range.to,status:today<range.from?'即將開始':today>range.to?'已結束':'進行中',metric:kind==='extremeTen'?'最佳秒數':kind==='umbrella'?'抽獎券':'積分',unit:kind==='extremeTen'?'秒':kind==='umbrella'?'張':'分',rules:(settings.rules||[]).map(r=>String(r).slice(0,500)).slice(0,20),entries:ranked.map(r=>{const p=identities[r.memberId];if(!p?.key)throw Error('缺少匿名身分');return {key:p.key,rank:r.rank,value:r.value,displayName:p.public===true?String(p.nickname||'玩家').slice(0,30):'匿名玩家'}})};
}
