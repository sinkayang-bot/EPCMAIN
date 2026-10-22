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
  const timerStore=await import('./timer-store.js?v=20261022-background26');
  const clean=x=>{const y={};Object.entries(x||{}).forEach(([k,v])=>{if(v!==undefined&&typeof v!=='function')y[k]=v});return y};
  window.EPCFirestore={
   ready:true,
   accountingReady:false,
   requireAccountingAccess(){throw new Error('帳務登入服務尚未載入，請稍後再試')},
   async upsertEvent(e,options={}){
    window.EPCMode?.assertWrite();
    if(!e?.eventId)return;
    const base=(window.EPC_FIRESTORE_LAST_EVENTS||[]).find(x=>String(x.eventId)===String(e.eventId));
    const job=window.EPCEventPatch?.job(e.eventId,base||{},e);
    const ref=fs.doc(col,String(e.eventId));
    const execute=()=>fs.runTransaction(db,async tx=>{
     window.EPCMode?.assertWrite();
     const snap=await tx.get(ref),old=snap.exists()?snap.data():{};
     if(!snap.exists()||old.status==='deleted'){window.EPCEventPatch?.drop(e.eventId);throw Error('此賽事已被刪除，請重新選擇賽事');}
     const settled=x=>x==='settled'||x==='已結算';
     if(options.rename&&snap.exists()){tx.update(ref,{name:String(e.name||''),updatedAt:fs.serverTimestamp()});return;}
     if(settled(old.status)&&options.accountingOnly){
      if(!settled(e.status))throw Error('已結算賽事不能變更結算狀態');
      tx.update(ref,{accountingGroup:String(e.accountingGroup||''),accountingItems:Array.isArray(e.accountingItems)?e.accountingItems:[],updatedAt:fs.serverTimestamp()});
      return;
     }
     if(settled(old.status)&&!options.unlock){
      if(options.settle)throw Error('這場賽事已在雲端結算，請重新整理查看正式結果');
      if(!settled(e.status))throw Error('這場賽事已結算，已阻止舊資料覆蓋；請重新整理');
      // A settled event is immutable until explicitly unlocked.
      return;
     }
     for(const op of job?.ops||[]){if(op.path?.[0]==='players'&&op.path.length===2&&op.remove&&(old.players||[]).some(p=>String(p.memberId)===String(op.path[1])&&Number(p._paymentRevision||0)>0))throw Error('此玩家已有帳務紀錄，不能直接移除；請先核對玩家帳務');}
     // Rebase only fields explicitly changed on this terminal onto the newest document.
     // Firestore commit order determines the last saved value for the same field.
     let protectedEvent=job?window.EPCEventPatch.apply(old,job.ops):window.EPCStackCore.protectStacks(e,old,options);
     if(options.settle){
      for(const p of e.players||[]){const latest=(old.players||[]).find(x=>String(x.memberId)===String(p.memberId));if(latest&&['stack','seat','hunterHeads'].some(k=>Number(latest['_'+k+'Revision']||0)>Number(p['_'+k+'Revision']||0)||(latest[k]??null)!==(p[k]??null)))throw Error('玩家籌碼已有更新，請重新計算後再結算');}
      protectedEvent={...protectedEvent,status:e.status,finalJP:e.finalJP,finalAccounting:e.finalAccounting};
     }
     protectedEvent._eventUpdatedAt=Math.max(Date.now(),Number(old._eventUpdatedAt||0)+1);
     const row={...clean(protectedEvent),status:settled(protectedEvent.status)?'settled':'open',updatedAt:fs.serverTimestamp()};
     // Keep mobile hunter audit entries even if a desktop snapshot is older.
     const oldHistory=Array.isArray(old.hunterHeadHistory)?old.hunterHeadHistory:[];
     const newHistory=Array.isArray(row.hunterHeadHistory)?row.hunterHeadHistory:[];
     const historyById=new Map();
     [...oldHistory,...newHistory].forEach((h,i)=>{if(h&&typeof h==='object')historyById.set(String(h.id||'legacy-'+i),h)});
     row.hunterHeadHistory=[...historyById.values()];
     if(options.unlock){row.finalJP=fs.deleteField();row.finalAccounting=fs.deleteField();}
     if(options.timerTemplateId){
      const linked=await timerStore.stageEventTimer({tx,fs,db,event:row,templateId:String(options.timerTemplateId),replaceExisting:!!options.replaceTimerTemplate,expectedTemplateId:options.expectedTimerTemplateId});
      Object.assign(row,linked.event);
      if(linked.timer)tx.set(linked.ref,{...linked.timer,updatedAt:fs.serverTimestamp()});
     }
     tx.set(ref,row,{merge:true});
    });
    if(window.EPCMode)await EPCMode.runWrite(execute);else await execute();
    if(job)window.EPCEventPatch.ack(job);
   },
   async getEvent(id){const snap=await fs.getDocFromServer(fs.doc(col,String(id)));if(!snap.exists())throw Error('找不到賽事');return {...snap.data(),eventId:String(id)}},
   async createEvent(e,options={}){window.EPCMode?.assertWrite();const eventId=String(e?.eventId||('EV-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)));const row={...clean(e),eventId,status:e?.status||'open',revision:Number(e?.revision||1),createdAt:Date.now()};if(options.timerTemplateId)return timerStore.createEventWithTimer({fs,db,event:row,templateId:String(options.timerTemplateId),assertWrite:()=>window.EPCMode?.assertWrite()});await fs.setDoc(fs.doc(col,eventId),{...row,updatedAt:fs.serverTimestamp()});return row},
   async deleteEvent(id){window.EPCMode?.assertWrite();if(id)await fs.deleteDoc(fs.doc(col,String(id)))},
   async upsertDailyAccounting(row){
    window.EPCMode?.assertWrite();this.requireAccountingAccess();
    const date=String(row?.date||'').trim();if(!date)return;
    await fs.setDoc(fs.doc(accountingCol,date),{...clean(row),date,updatedAt:fs.serverTimestamp()},{merge:false});
   },
   async deleteDailyAccounting(date){window.EPCMode?.assertWrite();this.requireAccountingAccess();date=String(date||'').trim();if(date)await fs.deleteDoc(fs.doc(accountingCol,date))}
  };
  for(const name of ['upsertEvent','createEvent','deleteEvent','upsertDailyAccounting','deleteDailyAccounting']){const original=window.EPCFirestore[name];window.EPCFirestore[name]=async function(...args){return window.EPCMode?EPCMode.runWrite(()=>original.apply(this,args)):original.apply(this,args);};}
  const paymentModule=await import('./player-payments-cloud.js?v=20261023-rebuy-no-ladies30');
  paymentModule.setupPlayerPayments({fs,db,col,accountingCol,bridge:window.EPCFirestore});
  const eventIndex=new Map();

  fs.onSnapshot(col,snap=>{
   const changedIds=[];for(const change of snap.docChanges()){const d=change.doc,x=d.data()||{};changedIds.push(d.id);if(change.type==='removed'||x.status==='deleted')eventIndex.delete(d.id);else eventIndex.set(d.id,{...x,eventId:x.eventId||d.id});}
   const rows=[...eventIndex.values()];
   window.EPC_FIRESTORE_LAST_EVENTS=rows;
   window.EPC_FIRESTORE_DIAG={state:'connected',projectId:cfg.projectId,count:rows.length,error:''};
   window.dispatchEvent(new CustomEvent('epcFirestoreEvents',{detail:{events:rows,changedIds}}));
  },err=>{window.EPC_FIRESTORE_DIAG={state:'error',projectId:cfg.projectId,count:0,error:String(err?.message||err)};window.dispatchEvent(new CustomEvent('epcFirestoreError',{detail:{message:String(err?.message||err)}}))});
  // Keep the event bridge available even when Auth configuration is not ready yet.
  try{
   const [authMod,accountingAuth]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js'),
    import('./firebase-accounting-auth.js?v=20261016-phone-payments1')
   ]);
   accountingAuth.setupAccountingAuth({app,fs,accountingCol,bridge:window.EPCFirestore,authMod});
  }catch(err){
   const state=document.getElementById('epcAccountingAuthState');
   if(state)state.textContent='帳務登入服務載入失敗，請重新整理：'+String(err?.message||err);
   console.error('Accounting Auth initialization failed',err);
  }
 }catch(e){window.EPC_FIRESTORE_DIAG={state:'error',projectId:cfg?.projectId||'?',count:0,error:String(e?.message||e)};window.dispatchEvent(new CustomEvent('epcFirestoreError',{detail:{message:String(e?.message||e)}}))}
})();

