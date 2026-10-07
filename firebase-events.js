// EPCMAIN Firestore realtime event bridge — phase 1
(async()=>{
 const cfg=window.EPC_FIREBASE_CONFIG;if(!cfg)return;
 try{
  const appMod=await import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js');
  const fs=await import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js');
  const app=appMod.initializeApp(cfg,'epcmain-v3');
  window.EPC_FIRESTORE_DIAG={state:'connecting',projectId:cfg.projectId,count:0,error:''};
  const db=fs.getFirestore(app);
  const col=fs.collection(db,'epc_events');
  const accountingCol=fs.collection(db,'epc_daily_accounting');
  const clean=x=>{const y={};Object.entries(x||{}).forEach(([k,v])=>{if(v!==undefined&&typeof v!=='function')y[k]=v});return y};
  window.EPCFirestore={
   ready:true,
   async upsertEvent(e){if(!e?.eventId)return;await fs.setDoc(fs.doc(col,String(e.eventId)),{...clean(e),updatedAt:fs.serverTimestamp()},{merge:true})},
   async createEvent(e){const eventId=String(e?.eventId||('EV-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)));const row={...clean(e),eventId,status:e?.status||'open',revision:Number(e?.revision||1),createdAt:Date.now()};await fs.setDoc(fs.doc(col,eventId),{...row,updatedAt:fs.serverTimestamp()});return row},
   async deleteEvent(id){if(id)await fs.deleteDoc(fs.doc(col,String(id)))},
   async upsertDailyAccounting(row){
    const date=String(row?.date||'').trim();if(!date)return;
    await fs.setDoc(fs.doc(accountingCol,date),{...clean(row),date,updatedAt:fs.serverTimestamp()},{merge:false});
   },
   async deleteDailyAccounting(date){date=String(date||'').trim();if(date)await fs.deleteDoc(fs.doc(accountingCol,date))}
  };
  fs.onSnapshot(accountingCol,snap=>{
   const rows=[];snap.forEach(d=>{const x=d.data()||{};rows.push({...x,date:x.date||d.id})});
   window.EPC_FIRESTORE_LAST_ACCOUNTING=rows;
   window.dispatchEvent(new CustomEvent('epcFirestoreAccounting',{detail:{rows}}));
  },err=>console.warn('Firestore accounting sync failed',err));
  fs.onSnapshot(col,snap=>{
   const rows=[];snap.forEach(d=>{const x=d.data()||{};if(x.status!=='deleted')rows.push({...x,eventId:x.eventId||d.id})});
   window.EPC_FIRESTORE_LAST_EVENTS=rows;
   window.EPC_FIRESTORE_DIAG={state:'connected',projectId:cfg.projectId,count:rows.length,error:''};
   window.dispatchEvent(new CustomEvent('epcFirestoreEvents',{detail:{events:rows}}));
  },err=>{window.EPC_FIRESTORE_DIAG={state:'error',projectId:cfg.projectId,count:0,error:String(err?.message||err)};window.dispatchEvent(new CustomEvent('epcFirestoreError',{detail:{message:String(err?.message||err)}}))});
 }catch(e){window.EPC_FIRESTORE_DIAG={state:'error',projectId:cfg?.projectId||'?',count:0,error:String(e?.message||e)};window.dispatchEvent(new CustomEvent('epcFirestoreError',{detail:{message:String(e?.message||e)}}))}
})();