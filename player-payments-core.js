(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)),money=n=>Number.isSafeInteger(n)&&n>=0;
 const safeId=x=>String(x||'')&&!['__proto__','prototype','constructor'].includes(String(x));
 function amount(value){const n=Number(value);if(!money(n)||n===0)throw Error('金額須為大於 0 的整數');return n;}
 function empty(memberId){return {kind:'playerPaymentsV1',memberId:String(memberId),revision:0,wallet:0,accounts:{},profits:{},items:[]};}
 function due(account){return Math.max(0,Number(account?.charge||0)-Number(account?.paid||0));}
 function totalDue(s){return Object.values(s.accounts||{}).reduce((n,a)=>n+due(a),0);}
 function verify(s){
  if(!money(s.wallet))throw Error('寄存金不足，可能已被其他場次使用');
  for(const a of Object.values(s.accounts||{}))if(!money(a.paid)||!money(a.charge))throw Error('付款餘額異常，無法套用');
  for(const p of Object.values(s.profits||{}))if(!money(p.used)||!money(p.cash)||p.used+p.cash>p.limit)throw Error('此筆盈餘已使用，請先撤銷後續抵扣');
 }
 function apply(original,command,eventInfo,now=Date.now()){
  const s=clone(original||empty(command.memberId)),cmd=clone(command),events=eventInfo||{};
  if(!safeId(cmd.id)||!safeId(cmd.memberId)||String(s.memberId)!==String(cmd.memberId))throw Error('玩家帳務識別錯誤');
  if(s.items.some(x=>x.id===cmd.id))return {state:s,replayed:true};
  if(cmd.expectedRevision!=null&&Number(cmd.expectedRevision)!==Number(s.revision)&&cmd.kind!=='reconcile'&&!(cmd.kind==='change'&&cmd.lastSavedWins))throw Error('玩家帳務已有更新，請確認最新餘額後再操作');
  const before=clone(s),eventId=String(cmd.eventId||'');
  for(const [id,e] of Object.entries(events)){
   if(!safeId(id)||!money(e.charge))throw Error('賽事應付金額不正確');
   if(!s.accounts[id]){
    const baseline=e.newPlayer?0:Math.max(0,e.charge-Math.min(e.charge,Number(e.legacyDue)||0));
    s.accounts[id]={paid:baseline,charge:e.charge,date:e.date||'',name:e.name||'',openingPaid:baseline};
   }
   Object.assign(s.accounts[id],{charge:e.charge,date:e.date||'',name:e.name||''});
   if(e.newPlayer)s.accounts[id].cancelled=false;
  }
  const account=()=>{if(!s.accounts[eventId])throw Error('找不到本場玩家帳務');return s.accounts[eventId];};
  const useWallet=id=>{const a=s.accounts[id];if(!a)return;const used=Math.min(s.wallet,due(a));s.wallet-=used;a.paid+=used;return used;};
  const pay=(n,id=eventId)=>{if(!s.accounts[id])throw Error('找不到欠款場次');if(n>due(s.accounts[id]))throw Error('付款超過尚欠金額；多出的款項請另登記寄存');s.accounts[id].paid+=n;};
  if(['add','rebuy','change','reconcile','walletPay'].includes(cmd.kind)){
   const a=account(),previousDue=cmd.kind==='rebuy'?Math.max(0,a.charge-Number(cmd.chargeDelta||0)-a.paid):0;
   const used=useWallet(eventId)||0;
   if(cmd.kind==='add'&&cmd.paidNow)pay(due(account()));
   if(cmd.kind==='rebuy'&&cmd.paidNow){
    const delta=Number(cmd.chargeDelta);if(!money(delta))throw Error('本次重買金額不正確');
    pay(Math.min(due(a),Math.max(0,delta-Math.max(0,used-previousDue))));
   }
  }else if(cmd.kind==='cancelRegistration'){
   const a=account();
   if(events[eventId]?.settled)throw Error('已結算賽事請先解鎖，再取消報名');
   if(a.paid!==Number(cmd.expectedPaid)||a.charge!==Number(cmd.expectedCharge))throw Error('應付或已付金額已變更，請重新開啟移除視窗');
   if(!['mistake','refund','wallet'].includes(cmd.disposition))throw Error('請選擇已付款的處理方式');
   const profit=s.profits[eventId];
   if(profit&&(profit.used||profit.cash))throw Error('本場盈餘已有抵扣或領取，請先撤銷相關紀錄');
   if(cmd.disposition==='mistake'){
    // Do not erase real wallet/profit funding under a mistaken-cash correction.
    const funding=s.items.some(x=>!x.voidedBy&&((x.eventId===eventId&&['add','rebuy','change','reconcile','walletPay','profit'].includes(x.kind)&&((x.effects?.wallet||0)<0||Object.values(x.effects?.profits||{}).some(v=>v.used>0)))||(x.kind==='settleAll'&&(x.effects?.paid?.[eventId]||0)>0&&(x.effects?.wallet||0)<0)));
    if(funding)throw Error('本場曾使用寄存金或盈餘，請選擇「轉寄存」或確認已退款，避免刪掉實際款項');
   }
   if(cmd.disposition==='wallet')s.wallet+=a.paid;
   a.cancelled=true;a.cancelledAt=now;a.cancelDisposition=cmd.disposition;a.cancelledPaid=a.paid;a.cancelledCharge=a.charge;
   a.paid=0;a.charge=0;
   if(profit)profit.limit=0;
  }else if(cmd.kind==='cash'||cmd.kind==='transfer')pay(amount(cmd.amount));
  else if(cmd.kind==='deposit')s.wallet+=amount(cmd.amount);
  else if(cmd.kind==='withdraw'){const n=amount(cmd.amount);if(n>s.wallet)throw Error('寄存金不足');s.wallet-=n;}
  else if(cmd.kind==='creditExcess'){
   const a=account(),n=Math.max(0,a.paid-a.charge);if(!n)throw Error('沒有溢付金額');a.paid-=n;s.wallet+=n;
  }else if(cmd.kind==='profit'||cmd.kind==='profitCash'){
   const id=String(cmd.sourceEventId||''),source=events[id];
   if(!source?.settled||!money(source.profit)||!source.profit||id===eventId)throw Error('請選擇其他已結算且有盈餘的場次');
   if(due(s.accounts[id]))throw Error('來源場次尚有欠款，請先處理該場結帳');
   if(!s.profits[id]){
    if(!cmd.confirmUnpaidProfit)throw Error('請先確認這筆盈餘尚未發給玩家');
    s.profits[id]={limit:source.profit,used:0,cash:0,date:source.date||'',name:source.name||''};
   }
   const p=s.profits[id],n=amount(cmd.amount);
   if(source.profit!==p.limit)throw Error('來源賽事盈餘已變更，請先核對原場結算');
   if(n>p.limit-p.used-p.cash)throw Error('來源盈餘餘額不足，可能已被其他電腦抵扣');
   if(cmd.kind==='profit'){pay(n);p.used+=n;}else p.cash+=n;
  }else if(cmd.kind==='settleAll'){
   const total=totalDue(s);if(total!==Number(cmd.expectedDue))throw Error('尚欠總額已變更，請重新確認收款');
   for(const id of Object.keys(s.accounts).sort((a,b)=>String(s.accounts[a].date).localeCompare(String(s.accounts[b].date))))useWallet(id);
   for(const a of Object.values(s.accounts))a.paid+=due(a);
  }else if(cmd.kind==='archive'){
   if(s.wallet||totalDue(s))throw Error('尚有寄存金或未結清款項，請先處理餘額再刪除');
   if(Object.values(s.accounts).some(a=>a.paid>a.charge))throw Error('尚有溢付金額，請先處理後再刪除');
   if(Object.values(s.profits).some(p=>p.limit>p.used+p.cash))throw Error('尚有未領取盈餘，請先處理後再刪除');
   s.archived=true;
  }else if(cmd.kind==='adminCorrection'){
   if(!String(cmd.note||'').trim())throw Error('請填寫管理員修正原因');
   if(!cmd.targetId||!s.items.some(x=>x.id===cmd.targetId))throw Error('找不到要修正的原始紀錄');
   if(!money(cmd.wallet))throw Error('寄存餘額須為非負整數');
   if(eventId){
    const a=account();
    if(!money(cmd.paid))throw Error('已付款金額須為非負整數');
    if(a.cancelled)throw Error('此場報名已取消，請先核對取消紀錄');
    a.paid=cmd.paid;
   }
   s.wallet=cmd.wallet;
  }else if(cmd.kind==='void'){
   const old=s.items.find(x=>x.id===cmd.targetId);
   if(!old||old.voidedBy||!old.effects||['void','change','reconcile','archive','cancelRegistration'].includes(old.kind)||(['add','rebuy'].includes(old.kind)&&!old.cashAmount))throw Error('此筆紀錄不能撤銷；請修正場次數量或核對後續使用');
   if(Object.keys(old.effects.paid||{}).some(id=>s.accounts[id]?.cancelledAt&&old.at<=s.accounts[id].cancelledAt))throw Error('此筆付款所屬報名已取消，請查看取消紀錄，不能重複撤銷');
   s.wallet-=old.effects.wallet||0;
   for(const [id,n] of Object.entries(old.effects.paid||{})){if(!s.accounts[id])throw Error('原始場次帳務不存在');s.accounts[id].paid-=n;}
   for(const [id,v] of Object.entries(old.effects.profits||{})){if(!s.profits[id])throw Error('原始盈餘不存在');s.profits[id].used-=v.used;s.profits[id].cash-=v.cash;}
   old.voidedBy=cmd.id;
  }else throw Error('不支援的帳務操作');
  verify(s);
  const effects={wallet:s.wallet-before.wallet,paid:{},profits:{}};
  for(const [id,a] of Object.entries(s.accounts)){
   const opening=before.accounts[id]?.paid??a.openingPaid,n=a.paid-opening;if(n)effects.paid[id]=n;
  }
  for(const [id,p] of Object.entries(s.profits)){const old=before.profits[id]||{used:0,cash:0};if(p.used!==old.used||p.cash!==old.cash)effects.profits[id]={used:p.used-old.used,cash:p.cash-old.cash};}
  const changed=effects.wallet||Object.keys(effects.paid).length||Object.keys(effects.profits).length||JSON.stringify(s.accounts)!==JSON.stringify(before.accounts);
  if(cmd.kind==='reconcile'&&!changed)return {state:original||s,unchanged:true};
  if(cmd.kind!=='archive')s.archived=false;
  const cashAmount=['add','rebuy','settleAll'].includes(cmd.kind)?Object.values(effects.paid).reduce((n,x)=>n+x,0)+effects.wallet:cmd.kind==='cash'?Number(cmd.amount):0;
  s.items.push({id:cmd.id,kind:cmd.kind,at:now,eventId,sourceEventId:cmd.sourceEventId||'',amount:Number(cmd.amount)||0,cashAmount,note:String(cmd.note||''),targetId:cmd.targetId||'',effects});
  s.revision=(Number(s.revision)||0)+1;
  if(JSON.stringify(s).length>750000)throw Error('玩家帳務紀錄容量接近上限，請先匯出封存');
  return {state:s};
 }
 const api={empty,due,totalDue,apply,amount};root.EPCPlayerPaymentsCore=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
