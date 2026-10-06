// EPCMAIN Firestore realtime event bridge — phase 1
(async()=>{
 const cfg=window.EPC_FIREBASE_CONFIG;if(!cfg)return;
 try{
  const appMod=await import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js');
  const fs=await import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js');
  const app=appMod.initializeApp(cfg,'epcmain-v3');
  const db=fs.getFirestore(app);
  const col=fs.collection(db,'epc_events');
  const clean=x=>{const y={};Object.entries(x||{}).forEach(([k,v])=>{if(v!==undefined&&typeof v!=='function')y[k]=v});return y};
  window.EPCFirestore={
   ready:true,
   async upsertEvent(e){if(!e?.eventId)return;await fs.setDoc(fs.doc(col,String(e.eventId)),{...clean(e),updatedAt:fs.serverTimestamp()},{merge:true})},
   async deleteEvent(id){if(id)await fs.deleteDoc(fs.doc(col,String(id)))}
  };
  fs.onSnapshot(col,snap=>{
   const rows=[];snap.forEach(d=>{const x=d.data()||{};if(x.status!=='deleted')rows.push({...x,eventId:x.eventId||d.id})});
   window.EPC_FIRESTORE_LAST_EVENTS=rows;
   window.dispatchEvent(new CustomEvent('epcFirestoreEvents',{detail:{events:rows}}));
  },err=>window.dispatchEvent(new CustomEvent('epcFirestoreError',{detail:{message:String(err?.message||err)}})));
 }catch(e){window.dispatchEvent(new CustomEvent('epcFirestoreError',{detail:{message:String(e?.message||e)}}))}
})();