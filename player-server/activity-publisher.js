import {randomUUID} from 'node:crypto';
import {calculateActivities,publicActivity,ACTIVITY_KINDS} from './activities.js';
const DEFAULT_SOURCE='https://script.google.com/macros/s/AKfycbwZi5bXuFJdtXiE6oxPmn4NZti-wZyOwEfTKZ8VPo5nXP5GK1mPOYrfkxz714AN4UQx9w/exec';
const date=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());
// All input and source documents remain private. Only explicit allowlisted projections leave this service.
export function activityPublisher(db,stamp,fetcher=fetch){
 const config=db.doc('epc_player_activity_settings/current'),source=db.doc('epc_player_activity_source/current'),lease=db.doc('epc_player_activity_jobs/current');
 async function refresh({poll=false}={}){
  const token=randomUUID();let settings;
  const started=await db.runTransaction(async tx=>{const s=await tx.get(config);settings=s.data();if(!settings||!ACTIVITY_KINDS.some(k=>settings[k]?.enabled))return false;tx.set(lease,{token});return true});if(!started)return {ok:true,disabled:true};
  let snapshot=await source.get(),payload=snapshot.data();
  if(poll){
   const response=await fetcher(DEFAULT_SOURCE,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'activity.get'}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('活動來源讀取失敗：HTTP '+response.status);
   const raw=await response.text();if(raw.length>4000000)throw Error('活動來源資料過大');const input=JSON.parse(raw);if(input.ok!==true||!input.data||typeof input.data!=='object'||Array.isArray(input.data)||!Number.isSafeInteger(input.revision)||input.revision<0)throw Error('活動來源格式錯誤');
   const accepted=await db.runTransaction(async tx=>{const [job,old]=await Promise.all([tx.get(lease),tx.get(source)]);if(job.data()?.token!==token)return false;if(Number(old.data()?.revision||0)>input.revision)throw Error('拒絕舊版活動資料');tx.set(source,{data:input.data,revision:input.revision,checkedAt:stamp()});return true});if(!accepted)return {ok:true,superseded:true};payload={data:input.data,revision:input.revision};
  }
  if(!payload?.data)throw Error('尚未讀取正式活動來源，請由管理員重新同步');
  const A=payload.data,ranges=ACTIVITY_KINDS.filter(k=>settings[k]?.enabled).map(k=>A.activityRanges?.[k]);
  for(const r of ranges)if(!/^\d{4}-\d{2}-\d{2}$/.test(r?.from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(r?.to||'')||r.from>r.to)throw Error('請先在後台設定完整活動區間');
  const from=ranges.map(r=>r.from).sort()[0],to=ranges.map(r=>r.to).sort().at(-1);if(Date.parse(to)-Date.parse(from)>366*86400000)throw Error('活動同步區間不可超過一年');
  const collections=await Promise.all(['date','businessDate'].map(field=>db.collection('epc_events').where(field,'>=',from).where(field,'<=',to).get())),eventsById=new Map();
  for(const s of collections)for(const d of s.docs)if(!d.id.startsWith('_'))eventsById.set(d.id,{...d.data(),id:d.id});
  // Records may refer to events outside this query; point-read them to retain independent-ledger exclusions.
  const refs=new Set();for(const k of ['hunter','umbrella','extremeTen'])if(settings[k]?.enabled)for(const row of A[k]||[]){const r=A.activityRanges[k];if(row.eventId&&row.date>=r.from&&row.date<=r.to&&!eventsById.has(String(row.eventId)))refs.add(String(row.eventId))}
  for(const id of refs){const d=await db.collection('epc_events').doc(id).get();if(d.exists)eventsById.set(id,{...d.data(),id})}
  const events=[...eventsById.values()],names={};for(const e of events)for(const p of e.players||[])if(!names[p.memberId])names[p.memberId]=p.nickname||p.name||String(p.memberId);
  const visible={...A,activityRanges:Object.fromEntries(ACTIVITY_KINDS.filter(k=>settings[k]?.enabled).map(k=>[k,A.activityRanges[k]]))},ranked=calculateActivities(visible,events,names),ids=new Set(Object.values(ranked).flat().map(r=>r.memberId)),identities={};
  for(const id of ids){const m=await db.collection('epc_player_members').doc(id).get(),p=m.data()?.active?await db.collection('epc_player_profiles').doc(m.data().uid).get():null,profile=p?.data();const ref=db.collection('epc_player_activity_aliases').doc(id);
   const key=await db.runTransaction(async tx=>{const old=await tx.get(ref),value=profile?.active&&profile.leaderboardKey?profile.leaderboardKey:old.data()?.key||randomUUID();tx.set(ref,{key:value});return value});identities[id]={key,public:profile?.active===true&&profile.publicRanking===true,nickname:profile?.publicNickname||''};
  }
  const output={};for(const kind of ACTIVITY_KINDS)output[kind]=publicActivity(kind,settings[kind],A.activityRanges?.[kind],ranked[kind]||[],identities,date());
  return db.runTransaction(async tx=>{const [job,current,latestSource]=await Promise.all([tx.get(lease),tx.get(config),tx.get(source)]);if(job.data()?.token!==token||JSON.stringify(current.data())!==JSON.stringify(settings)||latestSource.data()?.revision!==payload.revision)return {ok:true,superseded:true};
   // Re-read identities before publishing: a concurrent privacy withdrawal must never leak an old nickname.
   for(const id of ids){const m=await tx.get(db.collection('epc_player_members').doc(id)),p=m.data()?.active?await tx.get(db.collection('epc_player_profiles').doc(m.data().uid)):null,v=p?.data();if(v?.active!==true||v.publicRanking!==true||v.publicNickname!==identities[id].nickname||v.leaderboardKey!==identities[id].key)identities[id]={key:identities[id].key,public:false,nickname:''}}
   for(const kind of ACTIVITY_KINDS){const ref=db.collection('epc_player_public_activities').doc(kind),value=publicActivity(kind,settings[kind],A.activityRanges?.[kind],ranked[kind]||[],identities,date());if(value)tx.set(ref,{...value,sourceRevision:payload.revision,updatedAt:stamp()});else tx.delete(ref)}
   return {ok:true,count:Object.values(output).filter(Boolean).length,sourceRevision:payload.revision};
  });
 }
 async function redact(key){if(!key)return;await db.runTransaction(async tx=>{const docs=await Promise.all(ACTIVITY_KINDS.map(kind=>tx.get(db.collection('epc_player_public_activities').doc(kind))));for(let i=0;i<docs.length;i++){const d=docs[i];if(!d.exists)continue;const value=d.data(),rows=value.entries||[];if(rows.some(r=>r.key===key&&r.displayName!=='匿名玩家'))tx.set(db.collection('epc_player_public_activities').doc(ACTIVITY_KINDS[i]),{...value,entries:rows.map(r=>r.key===key?{...r,displayName:'匿名玩家'}:r)})}})}
 return {refresh,config,redact};
}
