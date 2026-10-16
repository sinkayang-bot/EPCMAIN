import './player-payments-core.js?v=20261017-remove1';
export function setupPlayerPayments({fs,db,col,accountingCol,bridge}){
 const Core=globalThis.EPCPlayerPaymentsCore;
 bridge.playerPaymentDocId=id=>'PLAYER_PAYMENTS_'+encodeURIComponent(String(id));
 bridge.playerPayment=async function(command){
  window.EPCMode?.assertWrite();bridge.requireAccountingAccess();
  const cmd=JSON.parse(JSON.stringify(command));
  if(!cmd.memberId||!cmd.id)throw Error('帳務指令不完整');
  const ledgerRef=fs.doc(accountingCol,bridge.playerPaymentDocId(cmd.memberId));
  const execute=()=>fs.runTransaction(db,async tx=>{
   window.EPCMode?.assertWrite();
   const snap=await tx.get(ledgerRef),stored=snap.exists()?snap.data():Core.empty(cmd.memberId);
   // Request IDs survive retries, including a response lost after a committed write.
   if((stored.items||[]).some(x=>x.id===cmd.id)){
    const eventSnap=cmd.eventId?await tx.get(fs.doc(col,String(cmd.eventId))):null;
    return {ledger:stored,replayed:true,event:eventSnap?.exists()?{...eventSnap.data(),eventId:String(cmd.eventId)}:null};
   }
   const ids=[...new Set([...Object.keys(stored.accounts||{}),...(cmd.eventIds||[]),cmd.eventId,cmd.sourceEventId].filter(Boolean).map(String))];
   const snapshots=await Promise.all(ids.map(id=>tx.get(fs.doc(col,id))));
   const raws=new Map();snapshots.forEach((x,i)=>{if(x.exists())raws.set(ids[i],{...x.data(),eventId:ids[i]});});
   let changed=null;
   if(cmd.kind==='add'||cmd.kind==='change'||cmd.kind==='rebuy'){
    const old=raws.get(String(cmd.eventId));if(!old)throw Error('找不到賽事');
    if(['settled','已結算'].includes(old.status))throw Error('已結算賽事不能新增買入或重買');
    const players=(old.players||[]).map(x=>({...x}));
    let p=players.find(x=>String(x.memberId)===String(cmd.memberId));
    if(cmd.kind==='add'){
     if(p)throw Error('此玩家已加入本場，請重新整理');
     const details=cmd.player||{};
     if(!Number.isSafeInteger(Number(details.manualDiscount||0))||Number(details.manualDiscount||0)<0)throw Error('手動優惠須為非負整數');
     if(details.earlyBird&&details.lateBird)throw Error('早鳥與晚鳥只能擇一');
     const groups=Number(details.buyin??1);if(!Number.isSafeInteger(groups)||groups<1||groups>100)throw Error('首次買入須為 1～100 組');
     p={memberKey:String(details.memberKey||''),name:String(details.name||''),nickname:String(details.nickname||''),group:String(details.group||''),earlyBird:!!details.earlyBird,lateBird:!!details.lateBird,ladies:!!details.ladies,manualDiscount:Number(details.manualDiscount||0),memberId:String(cmd.memberId),buyin:groups,rebuy:0,addon:0,prize:0,stack:details.stack===null?null:0,registrationUnpaid:!cmd.paidNow};players.push(p);
    }else if(cmd.kind==='rebuy'){
     if(!p)throw Error('這位玩家已不在本場');
     const groups=Number(cmd.groups),discount=Number(cmd.manualDiscount||0);
     if(!Number.isSafeInteger(groups)||groups<1||groups>100||!Number.isSafeInteger(discount)||discount<0)throw Error('重買組數或優惠不正確');
     const oldCharge=window.epcPlayerPaymentPrice_(old,p);
     p.rebuy=Number(p.rebuy||0)+groups;p.manualDiscount=Number(p.manualDiscount||0)+discount;
     if(cmd.ladies)p.ladies=true;
     if(discount){p._manualDiscountEditedAt=Date.now();p._manualDiscountEditedValue=p.manualDiscount;}
     p._rebuyRevision=Number(p._rebuyRevision||0)+1;
     const delta=window.epcPlayerPaymentPrice_(old,p)-oldCharge;
     if(!Number.isSafeInteger(delta)||delta<0)throw Error('本次優惠不能超過重買金額');
     if(cmd.expectedDelta!=null&&Number(cmd.expectedDelta)!==delta)throw Error('玩家組數或優惠已有變更，請重新確認本次應收金額');
     cmd.chargeDelta=delta;
    }else{
     if(!p)throw Error('這位玩家已不在本場');
     const fields=['buyin','rebuy','addon','manualDiscount','earlyBird','lateBird','ladies'];
     if(!fields.includes(cmd.field))throw Error('不支援的修改欄位');
     const current=p[cmd.field]??(['earlyBird','lateBird','ladies'].includes(cmd.field)?false:0);
     if(cmd.increment){if(cmd.field!=='rebuy')throw Error('僅重買支援加一');p.rebuy=Number(p.rebuy||0)+1;}
     else{
      if(current!==cmd.baseline&&!cmd.lastSavedWins)throw Error('數量或優惠已被其他設備修改，請確認最新資料');
      const bool=['earlyBird','lateBird','ladies'].includes(cmd.field),v=bool?!!cmd.value:Number(cmd.value);
      if(!bool&&(!Number.isSafeInteger(v)||v<0))throw Error('數值須為非負整數');
      p[cmd.field]=v;if(['earlyBird','lateBird'].includes(cmd.field)&&v)p[cmd.field==='earlyBird'?'lateBird':'earlyBird']=false;
     }
     if(cmd.field==='manualDiscount'){p._manualDiscountEditedAt=Date.now();p._manualDiscountEditedValue=p.manualDiscount;}
    }
    p._paymentRevision=(Number(p._paymentRevision)||0)+1;
    changed={...old,players,_eventUpdatedAt:Math.max(Date.now(),Number(old._eventUpdatedAt||0)+1)};
    // Baseline must be captured BEFORE applying a change to a legacy player.
    if(['change','rebuy'].includes(cmd.kind)&&!stored.accounts?.[String(cmd.eventId)]){
     const previous=(old.players||[]).find(x=>String(x.memberId)===String(cmd.memberId));
     const oldCharge=window.epcPlayerPaymentPrice_(old,previous);
     const legacyDue=Math.max(0,Number(previous.registrationUnpaidAmount)||0)+Math.max(0,Number(previous.rebuyUnpaidAmount)||0);
     stored.accounts=stored.accounts||{};
     stored.accounts[String(cmd.eventId)]={paid:Math.max(0,oldCharge-Math.min(oldCharge,legacyDue)),openingPaid:Math.max(0,oldCharge-Math.min(oldCharge,legacyDue)),charge:oldCharge,date:old.businessDate||old.date||'',name:old.name||''};
    }
    raws.set(String(cmd.eventId),changed);
   }
   const info={};
   for(const [id,e] of raws){
    const p=(e.players||[]).find(x=>String(x.memberId)===String(cmd.memberId));
    if(!p){if(stored.accounts?.[id]&&Core.due(stored.accounts[id]))throw Error('欠款來源玩家已被移除，請先核對該場資料');continue;}
    const charge=window.epcPlayerPaymentPrice_(e,p);
    info[id]={charge,date:e.businessDate||e.date||'',name:e.name||'',settled:['settled','已結算'].includes(e.status),profit:Math.max(0,Number(p.prize||0)-charge),legacyDue:Math.max(0,Number(p.registrationUnpaidAmount)||0)+Math.max(0,Number(p.rebuyUnpaidAmount)||0),newPlayer:cmd.kind==='add'&&id===String(cmd.eventId)};
   }
   if(cmd.kind==='add'&&cmd.expectedCharge!=null&&Number(cmd.expectedCharge)!==info[String(cmd.eventId)]?.charge)throw Error('本場價格或優惠已變更，請取消並重新開啟加入視窗確認金額');
   if(cmd.kind==='profit'){
    const source=raws.get(String(cmd.sourceEventId)),target=raws.get(String(cmd.eventId));
    const sourceDate=String(source?.businessDate||source?.date||''),targetDate=String(target?.businessDate||target?.date||'');
    if(!source||!target||sourceDate>targetDate||(sourceDate===targetDate&&Number(source.seq||0)>=Number(target.seq||0)))throw Error('僅能使用本場之前已結算的盈餘');
   }
   const result=Core.apply(stored,cmd,info);
   if(cmd.kind==='cancelRegistration'){
    const old=raws.get(String(cmd.eventId));
    if(!old||!info[String(cmd.eventId)])throw Error('這位玩家已不在本場，請重新整理');
    if(['settled','已結算'].includes(old.status))throw Error('已結算賽事請先解鎖，再取消報名');
    const players=(old.players||[]).filter(p=>String(p.memberId)!==String(cmd.memberId));
    changed={...old,players,_eventUpdatedAt:Math.max(Date.now(),Number(old._eventUpdatedAt||0)+1)};
    raws.set(String(cmd.eventId),changed);
   }
   if(!result.unchanged){
    const ledger={...result.state,date:bridge.playerPaymentDocId(cmd.memberId),updatedAt:fs.serverTimestamp()};
    tx.set(ledgerRef,ledger);
   }
   if(cmd.kind==='cancelRegistration')tx.update(fs.doc(col,String(cmd.eventId)),{players:changed.players,_eventUpdatedAt:changed._eventUpdatedAt,updatedAt:fs.serverTimestamp()});
   // Keep legacy/mobile status fields consistent without touching prize, stack or JP.
   for(const [id,raw] of raws){
    const a=result.state.accounts[id];if(!a)continue;
    const players=(raw.players||[]).map(x=>({...x})),p=players.find(x=>String(x.memberId)===String(cmd.memberId));if(!p)continue;
    const balance=Core.due(a),isEdited=changed&&id===String(cmd.eventId);
    if(!isEdited&&(Number(p.registrationUnpaidAmount)||0)===0&&(Number(p.rebuyUnpaidAmount)||0)===balance&&p.registrationUnpaid===(balance>0))continue;
    if(result.unchanged&&!isEdited)continue;
    p.registrationUnpaidAmount=0;p.rebuyUnpaidAmount=balance;p.registrationUnpaid=balance>0;
    p._paymentRevision=(Number(p._paymentRevision)||0)+1;
    const next={...raw,players,_eventUpdatedAt:Math.max(Date.now(),Number(raw._eventUpdatedAt||0)+1)};
    tx.update(fs.doc(col,id),{players,_eventUpdatedAt:next._eventUpdatedAt,updatedAt:fs.serverTimestamp()});
    if(id===String(cmd.eventId))changed=next;
   }
   return {ledger:result.state,event:changed};
  });
  return window.EPCMode?window.EPCMode.runWrite(execute):execute();
 };
}
