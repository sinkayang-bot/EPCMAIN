'use strict';
// Trusted server-side publisher. Never expose V3 raw activity data to public clients.
const admin=require('firebase-admin');
const credential=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'null');
if(!credential?.project_id)throw Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing');
admin.initializeApp({credential:admin.credential.cert(credential)});
const db=admin.firestore();
const API='https://script.google.com/macros/s/AKfycbwZi5bXuFJdtXiE6oxPmn4NZti-wZyOwEfTKZ8VPo5nXP5GK1mPOYrfkxz714AN4UQx9w/exec';
const inside=(x,r)=>!x.deleted&&(!r?.from||String(x.date||'')>=r.from)&&(!r?.to||String(x.date||'')<=r.to);
const numeric=v=>Number.isFinite(Number(v))?Number(v):0;
const valid=id=>/^[A-Za-z0-9_-]{3,32}$/.test(String(id||''));
function rank(rows,scoreKey){rows.sort((a,b)=>numeric(b[scoreKey])-numeric(a[scoreKey])||a.memberId.localeCompare(b.memberId));rows.forEach((r,i)=>r.rank=i+1);return rows}
(async()=>{
 const res=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'activity.get'}),signal:AbortSignal.timeout(30000)});
 if(!res.ok)throw Error('V3 API HTTP '+res.status);
 const body=await res.json();if(!body.ok||!body.data)throw Error('V3 activity.get failed');
 const a=body.data,ranges=a.activityRanges||{},activities=[];
 const umbrella=new Map();
 for(const x of a.umbrella||[]){if(!inside(x,ranges.umbrella)||!valid(x.memberId))continue;const id=String(x.memberId);umbrella.set(id,(umbrella.get(id)||0)+numeric(x.coupons))}
 activities.push({id:'umbrella',title:'保護傘',active:true,period:[ranges.umbrella?.from,ranges.umbrella?.to].filter(Boolean).join(' ～ '),rules:'依後台登記的牌型券數累計。',leaderboard:rank([...umbrella].map(([memberId,points])=>({memberId,points})), 'points')});
 const best=new Map();
 for(const x of a.extremeTen||[]){if(!inside(x,ranges.extremeTen)||!valid(x.memberId))continue;const cents=numeric(x.cents);if(cents<=0)continue;const id=String(x.memberId),difference=Math.abs(cents-1000),prev=best.get(id);if(!prev||difference<prev.difference)best.set(id,{memberId:id,seconds:(cents/100).toFixed(2),difference,claimed:!!x.claimed,awardType:String(x.awardType||'')})}
 const extreme=[...best.values()].sort((a,b)=>a.difference-b.difference||a.memberId.localeCompare(b.memberId));let place=0,last=null;extreme.forEach((x,i)=>{if(x.difference!==last)place=i+1;last=x.difference;x.rank=place;x.progress=x.seconds+' 秒';delete x.difference});
 activities.push({id:'extreme',title:'極限 10 秒',active:true,period:[ranges.extremeTen?.from,ranges.extremeTen?.to].filter(Boolean).join(' ～ '),rules:'每位會員只取最接近 10.00 秒的有效成績。',leaderboard:extreme});

 // Derive weekly tasks and rank from the same Firestore event fields and V3 adjustments used by EPCMAIN.
 const eventSnaps=await db.collection('epc_events').get();
 const events=eventSnaps.docs.map(d=>({id:d.id,...d.data()})).filter(e=>e.status!=='deleted'&&!e.deleted);
 const day=e=>String(e.businessDate||e.date||'').slice(0,10);
 const eventId=e=>String(e.eventId||e.id||'');
 const eligible=e=>!e.accountingGroup&&!e.independentAccounting&&!e.isIndependentAccounting;
 const inRange=(e,key)=>{const date=day(e),r=ranges[key]||{};return date&&(!r.from||date>=r.from)&&(!r.to||date<=r.to)};
 const ids=e=>[...new Set((e.players||[]).map(p=>String(p.memberId||'').trim()).filter(valid))];
 const weekly=new Map();
 for(const e of events){if(!eligible(e)||!inRange(e,'weekly'))continue;for(const id of ids(e)){if(!weekly.has(id))weekly.set(id,{memberId:id,games:0,dates:new Set()});const x=weekly.get(id);x.games++;x.dates.add(day(e))}}
 const weeklyRows=[...new Set([...weekly.keys(),...Object.keys(a.weeklyAdjust||{})])].filter(valid).map(id=>{
  const x=weekly.get(id),adj=a.weeklyAdjust?.[id]||{},games=(x?.games||0)+numeric(adj.games),days=(x?.dates.size||0)+numeric(adj.days);
  const gameLevel=games>=15?3:games>=10?2:games>=5?1:0,dayLevel=days>=7?3:days>=5?2:days>=3?1:0;
  const claimKey=[ranges.weekly?.from||'',ranges.weekly?.to||'',id].join('_');
  return {memberId:id,games,days,gameLevel,dayLevel,claimed:!!a.weeklyClaims?.[claimKey],progress:days+' 天／'+games+' 場',points:gameLevel+dayLevel};
 }).sort((x,y)=>y.gameLevel-x.gameLevel||y.dayLevel-x.dayLevel||y.games-x.games||y.days-x.days);
 weeklyRows.forEach((x,i)=>x.rank=i+1);
 activities.push({id:'weekly',title:'每週任務卡',active:true,period:[ranges.weekly?.from,ranges.weekly?.to].filter(Boolean).join(' ～ '),rules:'簽到線 3／5／7 天；場次線 5／10／15 場，各線分三階。',leaderboard:weeklyRows});
 const rankEvents=events.filter(e=>eligible(e)&&inRange(e,'rank')&&(e.status==='已結算'||e.status==='settled'));
 const unique=new Map();for(const e of rankEvents)if(!unique.has(eventId(e)))unique.set(eventId(e),e);
 const byDay=new Map();for(const e of events.filter(e=>eligible(e))){const d=day(e);if(!byDay.has(d))byDay.set(d,[]);byDay.get(d).push(e)}
 for(const list of byDay.values())list.sort((x,y)=>(numeric(x.seq)||999)-(numeric(y.seq)||999)||String(x.startTime||'').localeCompare(String(y.startTime||'')));
 const scores=new Map();
 let missingChips=0;
 for(const e of unique.values()){
  const chips=numeric(e.chips);if(chips<=0){missingChips++;continue}
  const date=day(e),seq=(byDay.get(date)||[]).findIndex(x=>eventId(x)===eventId(e))+1,weekday=new Date(date+'T12:00:00Z').getUTCDay();
  let mult=1;
  for(const rule of a.rankRecurringRules||[]){
   if(!rule.enabled||(rule.days?.length&&!rule.days.includes(weekday)))continue;
   const first=rule.mode==='firstN'&&seq<=Math.max(1,numeric(rule.firstN)||1);
   const time=String(e.startTime||'').slice(0,5),from=rule.from||'',to=rule.to||'';
   const matched=rule.mode==='time'&&time&&from&&to&&(from===to?time===from:from<to?time>=from&&time<=to:time>=from||time<=to);
   if(first||matched)mult=Math.max(mult,numeric(rule.mult)||1);
  }
  const players=(e.players||[]).filter(p=>valid(p.memberId)&&p.stack!==null&&p.stack!==undefined&&p.stack!=='').map(p=>{
   const stack=numeric(p.stack),groups=numeric(p.buyin)+numeric(p.rebuy)+numeric(p.addon);
   return {memberId:String(p.memberId),stack,net:(stack-groups*chips)/chips};
  }).sort((x,y)=>y.net-x.net||y.stack-x.stack);
  let previous='',place=0;
  players.forEach((p,i)=>{const key=p.net+'|'+p.stack;if(key!==previous){place=i+1;previous=key}if(place>3)return;const points=p.stack>0?(place===1?3:place===2?2:1)*mult:0;if(points)scores.set(p.memberId,(scores.get(p.memberId)||0)+points)});
 }
 if(missingChips)throw Error('Cannot publish weekly rank: '+missingChips+' settled events missing initial chips');
 const rankRows=[...new Set([...scores.keys(),...Object.keys(a.rankAdjust||{})])].filter(valid).map(id=>({memberId:id,points:(scores.get(id)||0)+numeric(a.rankAdjust?.[id]),auto:scores.get(id)||0})).filter(x=>x.points||x.auto).sort((x,y)=>y.points-x.points||y.auto-x.auto||x.memberId.localeCompare(y.memberId));
 rankRows.forEach((x,i)=>x.rank=i+1);
 activities.push({id:'weeklyRank',title:'週排行榜',active:true,period:[ranges.rank?.from,ranges.rank?.to].filter(Boolean).join(' ～ '),rules:'每場前三名 3／2／1 分；依後台加倍規則及人工調整計算。',leaderboard:rankRows});

 const visibility=a.publicActivityVisibility||{};
 const activityKeys={umbrella:'umbrella',extreme:'extremeTen',weekly:'weekly',weeklyRank:'rank',hunter:'hunter',pioneer:'pioneer'};
 const publicActivities=activities.filter(item=>visibility[activityKeys[item.id]]===true);
 const catalog={version:1,sourceRevision:numeric(body.revision),generatedAt:admin.firestore.FieldValue.serverTimestamp(),activities:publicActivities};
 await db.collection('epc_public_activity_catalog').doc('current').set(catalog);
 console.log(JSON.stringify({published:true,revision:body.revision,activities:publicActivities.map(x=>({id:x.id,players:x.leaderboard.length}))}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
