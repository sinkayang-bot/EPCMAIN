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
 // Other leaderboards require EPCMAIN event-derived scoring. Never publish misleading approximations.
 const catalog={version:1,sourceRevision:numeric(body.revision),generatedAt:admin.firestore.FieldValue.serverTimestamp(),activities};
 await db.collection('epc_public_activity_catalog').doc('current').set(catalog);
 console.log(JSON.stringify({published:true,revision:body.revision,activities:activities.map(x=>({id:x.id,players:x.leaderboard.length}))}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
