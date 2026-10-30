'use strict';
// GitHub Actions trusted publisher. Requires FIREBASE_SERVICE_ACCOUNT_JSON secret.
const admin=require('firebase-admin');
const service=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'null');
if(!service?.project_id)throw Error('FIREBASE_SERVICE_ACCOUNT_JSON secret is required');
admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const {publishPublicActivities}=require('./publisher.server.cjs');
(async()=>{
 const events=await db.collection('epc_events').get();
 const byId=new Map();
 for(const snap of events.docs){
  const e=snap.data();if(e.status==='deleted')continue;
  const seen=new Set();
  for(const p of Array.isArray(e.players)?e.players:[]){
   const id=String(p.memberId||'').trim().toUpperCase();
   if(!/^[A-Z0-9_-]{3,32}$/.test(id))continue;
   const r=byId.get(id)||{memberId:id,summary:{events:0,entries:0},activities:{}};
   if(!seen.has(id)){r.summary.events++;seen.add(id)}
   r.summary.entries+=Math.max(0,Number(p.buyin||1)||1)+Math.max(0,Number(p.rebuy||0)||0)+Math.max(0,Number(p.addon||0)||0);
   byId.set(id,r);
  }
 }
 const result=await publishPublicActivities([...byId.values()]);
 console.log(JSON.stringify({events:events.size,...result}));
})().catch(e=>{console.error(e);process.exitCode=1});
