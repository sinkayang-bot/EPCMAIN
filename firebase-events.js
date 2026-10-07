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
   accountingReady:false,
   requireAccountingAccess(){throw new Error('帳務登入服務尚未載入，請稍後再試')},
   async upsertEvent(e,options={}){
    if(!e?.eventId)return;
    const ref=fs.doc(col,String(e.eventId));
    await fs.runTransaction(db,async tx=>{
     const snap=await tx.get(ref),old=snap.exists()?snap.data():{};
     const settled=x=>x==='settled'||x==='已結算';
     if(options.rename&&snap.exists()){tx.update(ref,{name:String(e.name||''),updatedAt:fs.serverTimestamp()});return;}
     if(settled(old.status)&&!options.unlock){
      if(!settled(e.status))throw Error('這場賽事已結算，已阻止舊資料覆蓋；請重新整理');
      // A settled event is immutable until explicitly unlocked.
      return;
     }
     if(old._eventUpdatedAt&&e._eventUpdatedAt&&Number(old._eventUpdatedAt)>Number(e._eventUpdatedAt))throw Error('賽事已有較新修改，請重新整理後再編輯');
     const row={...clean(e),status:settled(e.status)?'settled':'open',updatedAt:fs.serverTimestamp()};
     if(options.unlock){row.finalJP=fs.deleteField();row.finalAccounting=fs.deleteField();}
     tx.set(ref,row,{merge:true});
    });
   },
   async createEvent(e){const eventId=String(e?.eventId||('EV-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)));const row={...clean(e),eventId,status:e?.status||'open',revision:Number(e?.revision||1),createdAt:Date.now()};await fs.setDoc(fs.doc(col,eventId),{...row,updatedAt:fs.serverTimestamp()});return row},
   async deleteEvent(id){if(id)await fs.deleteDoc(fs.doc(col,String(id)))},
   async upsertDailyAccounting(row){
    this.requireAccountingAccess();
    const date=String(row?.date||'').trim();if(!date)return;
    await fs.setDoc(fs.doc(accountingCol,date),{...clean(row),date,updatedAt:fs.serverTimestamp()},{merge:false});
   },
   async deleteDailyAccounting(date){this.requireAccountingAccess();date=String(date||'').trim();if(date)await fs.deleteDoc(fs.doc(accountingCol,date))}
  };
  fs.onSnapshot(col,snap=>{
   const rows=[];snap.forEach(d=>{const x=d.data()||{};if(x.status!=='deleted')rows.push({...x,eventId:x.eventId||d.id})});
   window.EPC_FIRESTORE_LAST_EVENTS=rows;
   window.EPC_FIRESTORE_DIAG={state:'connected',projectId:cfg.projectId,count:rows.length,error:''};
   window.dispatchEvent(new CustomEvent('epcFirestoreEvents',{detail:{events:rows}}));
  },err=>{window.EPC_FIRESTORE_DIAG={state:'error',projectId:cfg.projectId,count:0,error:String(err?.message||err)};window.dispatchEvent(new CustomEvent('epcFirestoreError',{detail:{message:String(err?.message||err)}}))});
  // Keep the event bridge available even when Auth configuration is not ready yet.
  try{
   const [authMod,accountingAuth]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js'),
    import('./firebase-accounting-auth.js?v=20261007-admin-auth')
   ]);
   accountingAuth.setupAccountingAuth({app,fs,accountingCol,bridge:window.EPCFirestore,authMod});
  }catch(err){
   const state=document.getElementById('epcAccountingAuthState');
   if(state)state.textContent='帳務登入服務載入失敗，請重新整理：'+String(err?.message||err);
   console.error('Accounting Auth initialization failed',err);
  }
 }catch(e){window.EPC_FIRESTORE_DIAG={state:'error',projectId:cfg?.projectId||'?',count:0,error:String(e?.message||e)};window.dispatchEvent(new CustomEvent('epcFirestoreError',{detail:{message:String(e?.message||e)}}))}
})();
