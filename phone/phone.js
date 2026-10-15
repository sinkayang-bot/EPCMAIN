import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getFirestore,collection,doc,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import * as fs from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import * as authMod from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {setupAccountingAuth} from '../firebase-accounting-auth.js?v=20261016-phone-payments1';
import {setupPlayerPayments} from '../player-payments-cloud.js?v=20261016-phone-payments1';
import {pricePlayer,registrationPrice,rebuyPrice} from '../player-pricing.js?v=20261016-phone-payments1';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=initializeApp(window.EPC_FIREBASE_CONFIG,'epc-phone'),store=getFirestore(app),col=collection(store,'epc_events');
let events=[],selected='',unsubscribe,members=new Map(),memberRows=[];const drafts=new Map(),busy=new Set();
// Share the desktop transaction ledger; every money write requires verified admin access.
const paymentBridge={accountingReady:false,requireAccountingAccess(){throw Error('請先完成 Google 管理員登入')}};
window.epcPlayerPaymentPrice_=(raw,p)=>pricePlayer(raw,p).paid;
setupPlayerPayments({fs,db:store,col,accountingCol:collection(store,'epc_daily_accounting'),bridge:paymentBridge});
let paymentRows=new Map(),mobilePaymentBusy=false,mobilePending=null;
try{mobilePending=JSON.parse(sessionStorage.getItem('epcMobilePaymentPendingV1')||'null')}catch(_){}
function playerDue(e,p){const a=paymentRows.get(String(p.memberId))?.accounts?.[e.eventId];return a?Math.max(0,pricePlayer(e,p).paid-Number(a.paid||0)):Math.max(0,Number(p.registrationUnpaidAmount)||0)+Math.max(0,Number(p.rebuyUnpaidAmount)||0);}
function paymentBadge(e,p){const due=playerDue(e,p);return '<span class="payment-badge '+(due?'unpaid':'clear')+'">'+(due?'未結帳 $'+num(due):'已結帳')+'</span>';}
function showPaymentPending(){$('mobilePaymentRetry').hidden=!mobilePending;}
async function mobilePayment(command){
 paymentBridge.requireAccountingAccess();
 if(mobilePaymentBusy)throw Error('上一筆正在儲存，請稍候');
 if(mobilePending)throw Error('上一筆儲存結果尚未確認，請先按「確認上一筆報名／重買結果」');
 const ledger=paymentRows.get(String(command.memberId));
 mobilePending={...command,id:'MP_'+Date.now()+'_'+crypto.randomUUID(),expectedRevision:ledger?.revision||0};
 sessionStorage.setItem('epcMobilePaymentPendingV1',JSON.stringify(mobilePending));showPaymentPending();
 return flushMobilePayment();
}
async function flushMobilePayment(){
 paymentBridge.requireAccountingAccess();if(!mobilePending||mobilePaymentBusy)return;
 mobilePaymentBusy=true;$('mobilePaymentRetry').disabled=true;$('mobilePaymentState').textContent='正在確認報名／重買儲存結果…';
 try{
  const cmd=mobilePending,result=await paymentBridge.playerPayment(cmd);
  if(result.ledger)paymentRows.set(String(cmd.memberId),result.ledger);
  if(result.event){const i=events.findIndex(e=>e.eventId===result.event.eventId);if(i>=0&&Number(events[i]._eventUpdatedAt||0)<=Number(result.event._eventUpdatedAt||0))events[i]=result.event;}
  mobilePending=null;sessionStorage.removeItem('epcMobilePaymentPendingV1');
  $('mobilePaymentState').textContent='已儲存，玩家帳務同步完成';$('mobilePaymentState').className='message good';render();calculateRegistrationPrice();return result;
 }catch(err){
  if(!['unavailable','deadline-exceeded','unknown'].includes(err?.code)){mobilePending=null;sessionStorage.removeItem('epcMobilePaymentPendingV1');}
  $('mobilePaymentState').textContent=err.message;$('mobilePaymentState').className='message error';throw err;
 }finally{mobilePaymentBusy=false;$('mobilePaymentRetry').disabled=false;showPaymentPending();}
}
$('mobilePaymentRetry').addEventListener('click',()=>flushMobilePayment().catch(err=>status(err.message,true)));showPaymentPending();
window.addEventListener('epcPlayerPayments',ev=>{if(!ev.detail?.connected)paymentRows.clear();for(const x of ev.detail?.rows||[]){const old=paymentRows.get(String(x.memberId));if(!old||Number(x.revision)>=Number(old.revision))paymentRows.set(String(x.memberId),x);}calculateRegistrationPrice();render();});
setupAccountingAuth({app,fs,accountingCol:collection(store,'epc_daily_accounting'),bridge:paymentBridge,authMod});
// Keep the summary below the actual header height, including wrapped status text.
const header=document.querySelector('header');
const updateHeaderHeight=()=>document.documentElement.style.setProperty('--phone-header-height',header.getBoundingClientRect().height+'px');
new ResizeObserver(updateHeaderHeight).observe(header);updateHeaderHeight();
const fieldLabels={seat:'座位',stack:'下桌籌碼',hunterHeads:'獵人頭（本場累計）'};
const key=(e,m)=>JSON.stringify([e,String(m)]),num=n=>Number(n||0).toLocaleString('zh-TW');
function status(s,bad=false){$('status').textContent=s;$('status').className=bad?'error':''}
function renderChipSummary(e){
 const patches={};for(const p of e.players||[]){const d=drafts.get(key(e.eventId,p.memberId));if(d?.patch)patches[String(p.memberId)]=d.patch;}
 const s=window.EPCStackCore.chipSummary(e,patches);
 const gap=d=>d===0?'差額 0｜籌碼已平':d<0?'還差 '+num(-d):'多出 '+num(d);
 $('summary').innerHTML=`<div class="chip-summary"><div class="meta">${(e.players||[]).length} 位玩家｜${num(s.groups)} 組${s.missing?'｜'+s.missing+' 位未輸入':''}</div><div class="chip-totals"><div>應有籌碼<strong>${num(s.expected)}</strong></div><div>已儲存籌碼<strong>${num(s.saved)}</strong></div></div><div class="chip-gap ${s.difference===0?'good':'error'}">${gap(s.difference)}</div>${s.pending?`<div class="chip-preview">目前輸入合計：${num(s.preview)}<br><span class="${s.invalid||s.previewDifference!==0?'error':'good'}">${s.invalid?'有 '+s.invalid+' 位籌碼輸入不完整':gap(s.previewDifference)}</span><div class="meta">${s.pending} 位籌碼尚未儲存，按「儲存」才會同步電腦。</div></div>`:''}</div>`;
}


let seatPicked='',seatBusy=false,tableMoveFrom=null;
const tableOrder=e=>{const a=Array.isArray(e?.tableOrder)?e.tableOrder.map(Number):[];return a.length===8&&new Set(a).size===8&&a.every(n=>n>=1&&n<=8)?a:[1,2,3,4,5,6,7,8]};
const seatCode=(table,seat)=>table+'-'+seat;
function seatOwner(e,code){return (e.players||[]).find(p=>String(p.seat||'')===code)}
function seatLabel(p){return [p.nickname,members.get(String(p.memberId))?.nickname,members.get(String(p.memberId))?.name,p.name,p.memberId].find(Boolean)||'玩家'}
function renderSeating(){
 const e=events.find(x=>x.eventId===selected),roster=$('seatRoster'),tables=$('seatTables');
 if(!roster||!tables)return;
 if(!e){roster.innerHTML='';tables.innerHTML='';$('seatWaitingCount').textContent='（0）';$('seatRosterEmpty').hidden=false;return}
 if(seatPicked&&!(e.players||[]).some(p=>String(p.memberId)===seatPicked))seatPicked='';
 const waiting=(e.players||[]).filter(p=>!String(p.seat||'').trim());
 $('seatWaitingCount').textContent='（'+waiting.length+'）';$('seatRosterEmpty').hidden=waiting.length>0;
 roster.innerHTML=waiting.map(p=>'<button type="button" draggable="true" data-seat-player="'+esc(p.memberId)+'" class="seat-person '+(seatPicked===String(p.memberId)?'picked':'')+'">'+esc(seatLabel(p))+(p.seat?' · '+esc(p.seat):' · 未入座')+'</button>').join('');
 tables.innerHTML=tableOrder(e).map(t=>'<div class="seat-table" data-table="'+t+'"><h3 draggable="true" data-table-handle="'+t+'" style="cursor:grab;touch-action:none">☰ '+t+' 號桌</h3><div class="seat-grid">'+Array.from({length:10},(_,j)=>{const code=seatCode(t,j+1),p=seatOwner(e,code);return '<button type="button" class="seat-slot '+(p?'occupied':'')+'" data-seat-code="'+code+'">'+(j+1)+' 號座'+(p?'<div><b>'+esc(seatLabel(p))+'</b></div>':'<div>空位</div>')+'</button>'}).join('')+'</div></div>').join('');
}
async function reorderTables(from,to){
 const e=events.find(x=>x.eventId===selected);if(!e||seatBusy||from===to)return;
 const msg=$('seatMessage');seatBusy=true;msg.textContent='正在儲存桌子排列…';
 try{await runTransaction(store,async tx=>{
  const ref=doc(col,e.eventId),snap=await tx.get(ref);if(!snap.exists())throw Error('賽事不存在');
  const current=snap.data(),order=tableOrder(current),a=order.indexOf(from),b=order.indexOf(to);
  if(a<0||b<0)throw Error('桌號無效');order.splice(b,0,order.splice(a,1)[0]);
  tx.update(ref,{tableOrder:order,_eventUpdatedAt:Date.now(),updatedAt:serverTimestamp()});
 });msg.textContent='桌子排列已儲存';msg.className='message good'}
 catch(err){msg.textContent='排列失敗：'+err.message;msg.className='message error'}
 finally{seatBusy=false;tableMoveFrom=null;renderSeating()}
}
$('seatTables').addEventListener('dragstart',ev=>{const h=ev.target.closest('[data-table-handle]');if(!h)return;tableMoveFrom=Number(h.dataset.tableHandle);ev.dataTransfer?.setData('application/x-epc-table',String(tableMoveFrom))});
$('seatTables').addEventListener('dragover',ev=>{if(tableMoveFrom&&ev.target.closest('[data-table]'))ev.preventDefault()});
$('seatTables').addEventListener('drop',ev=>{if(!tableMoveFrom)return;const t=ev.target.closest('[data-table]');if(t){ev.preventDefault();reorderTables(tableMoveFrom,Number(t.dataset.table))}});
let tableTouchStart=null;
$('seatTables').addEventListener('pointerdown',ev=>{const h=ev.target.closest('[data-table-handle]');if(!h||ev.pointerType==='mouse')return;tableTouchStart={id:ev.pointerId,from:Number(h.dataset.tableHandle),x:ev.clientX,y:ev.clientY};h.setPointerCapture(ev.pointerId)});
$('seatTables').addEventListener('pointerup',ev=>{if(!tableTouchStart||ev.pointerId!==tableTouchStart.id)return;const start=tableTouchStart;tableTouchStart=null;const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-table]');if(target&&Math.hypot(ev.clientX-start.x,ev.clientY-start.y)>25)reorderTables(start.from,Number(target.dataset.table))});
async function moveSeat(id,destination){
 const e=events.find(x=>x.eventId===selected),message=$('seatMessage');
 if(!e||seatBusy)return;
 seatBusy=true;message.textContent='正在同步座位…';message.className='message';
 try{
  await runTransaction(store,async tx=>{
   const ref=doc(col,e.eventId),snap=await tx.get(ref);
   if(!snap.exists())throw Error('賽事不存在');
   const current=snap.data();
   if(['settled','已結算','deleted'].includes(current.status))throw Error('賽事已結算');
   const ps=(current.players||[]).map(p=>({...p})),p=ps.find(p=>String(p.memberId)===String(id));
   if(!p)throw Error('玩家不在本場');
   const other=ps.find(x=>String(x.seat||'')===destination&&String(x.memberId)!==String(id));
   const previous=String(p.seat||'');
   if(other){other.seat=previous;other._seatRevision=(Number(other._seatRevision)||0)+1}
   p.seat=destination;p._seatRevision=(Number(p._seatRevision)||0)+1;
   tx.update(ref,{players:ps,_eventUpdatedAt:Date.now(),updatedAt:serverTimestamp()});
  });
  seatPicked='';message.textContent='座位已儲存並同步';message.className='message good';
 }catch(err){message.textContent='座位更新失敗：'+err.message;message.className='message error'}
 finally{seatBusy=false;renderSeating()}
}
$('seatRoster').addEventListener('click',e=>{const b=e.target.closest('[data-seat-player]');if(!b)return;seatPicked=b.dataset.seatPlayer;renderSeating()});
$('seatTables').addEventListener('click',e=>{const b=e.target.closest('[data-seat-code]');if(!b)return;const current=events.find(x=>x.eventId===selected),p=seatOwner(current,b.dataset.seatCode);if(!seatPicked){if(p){seatPicked=String(p.memberId);renderSeating();$('seatMessage').textContent='已選擇 '+seatLabel(p)+'，請點擊目標座位'}else $('seatMessage').textContent='請先選擇上方玩家';return}moveSeat(seatPicked,b.dataset.seatCode)});
$('seatRoster').addEventListener('dragstart',e=>{const b=e.target.closest('[data-seat-player]');if(!b)return;seatPicked=b.dataset.seatPlayer;e.dataTransfer?.setData('text/plain',seatPicked)});
$('seatTables').addEventListener('dragover',e=>{if(e.target.closest('[data-seat-code]'))e.preventDefault()});
$('seatTables').addEventListener('drop',e=>{const b=e.target.closest('[data-seat-code]');if(!b)return;e.preventDefault();const id=e.dataTransfer?.getData('text/plain')||seatPicked;if(id)moveSeat(id,b.dataset.seatCode)});

let activePanel='';let selectedChipTable='all';
function showPanel(id=''){
 activePanel=id;
 $('dashboard').hidden=!!id;$('backDashboard').hidden=!id;$('floatingBack').hidden=!id;
 document.querySelectorAll('.mobile-panel').forEach(el=>el.hidden=el.id!==id);
 window.scrollTo({top:0,behavior:'instant'});
}
document.querySelectorAll('[data-panel]').forEach(btn=>btn.addEventListener('click',()=>showPanel(btn.dataset.panel)));
$('backDashboard').addEventListener('click',()=>showPanel());$('floatingBack').addEventListener('click',()=>showPanel());$('overviewShortcut').addEventListener('click',()=>showPanel('overviewPanel'));
function updateDashboard(){
 const e=events.find(x=>x.eventId===selected),ps=e?.players||[];
 renderSeating();
 $('dashEventName').textContent=e?.name||'目前沒有進行中的賽事';
 $('dashPlayers').textContent=ps.length+' 人';
 $('dashRebuys').textContent=ps.reduce((n,p)=>n+(+p.rebuy||0),0)+' 組';
 $('dashGroups').textContent=ps.reduce((n,p)=>n+(+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0),0)+' 組';
 $('overviewStats').textContent=e?'賽事：'+(e.name||'')+'｜報名 '+ps.length+' 人｜總買入 '+ps.reduce((n,p)=>n+(+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0),0)+' 組':'無進行中賽事';
 $('overviewPlayers').innerHTML=e?'<h3 class="overview-player-title">參賽玩家（點擊可操作）</h3>'+ps.map(p=>'<button type="button" class="overview-person" data-overview-player="'+esc(p.memberId)+'"><b>'+esc(seatLabel(p))+'</b>'+paymentBadge(e,p)+'<small>會員編號 '+esc(p.memberId)+'｜首次 '+num(p.buyin)+' 組｜重買 '+num(p.rebuy)+' 組｜總計 '+num((+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0))+' 組｜'+([p.earlyBird?'早鳥':p.lateBird?'晚鳥':'',p.ladies?'女士':''].filter(Boolean).join('＋')||'一般')+'</small></button>').join(''):'<div class="empty">目前沒有進行中的賽事</div>';
}

function renderRebuy(){
 const e=events.find(x=>x.eventId===selected),sel=$('rebuyPlayer');if(!sel)return;
 const old=sel.value;sel.innerHTML=(e?.players||[]).map(p=>'<option value="'+esc(p.memberId)+'">'+esc(seatLabel(p))+'｜已重買 '+num(p.rebuy)+' 組'+(playerDue(e,p)?'｜未結帳 $'+num(playerDue(e,p)):'｜已結帳')+'</option>').join('');
 if((e?.players||[]).some(p=>String(p.memberId)===old))sel.value=old;
 const p=(e?.players||[]).find(p=>String(p.memberId)===sel.value),ladies=$('rebuyLadies');
 if(p?.ladies){ladies.checked=true;ladies.disabled=true;ladies.dataset.player=sel.value;}else{if(ladies.dataset.player!==sel.value){ladies.checked=false;ladies.dataset.player=sel.value;}ladies.disabled=false;}
 try{
  const cost=rebuyPrice(e,p,Number($('rebuyGroups').value),Number($('rebuyManualDiscount').value||0),ladies.checked),due=playerDue(e,p),wallet=paymentRows.get(String(p.memberId))?.wallet||0;
  const used=Math.min(wallet,due+cost.amount),cashDue=Math.max(0,cost.amount-Math.max(0,used-due));
  $('rebuyPriceNote').textContent='本次新增 '+$('rebuyGroups').value+' 組｜應付 '+num(cost.amount)+' 元｜原欠 '+num(due)+' 元｜寄存抵扣 '+num(used)+' 元｜本次另收 '+num(cashDue)+' 元（不含原欠款）';
 }catch(err){$('rebuyPriceNote').textContent=err.message;}
}
$('overviewPlayers').addEventListener('click',ev=>{const b=ev.target.closest('[data-overview-player]');if(!b)return;showPanel('rebuyPanel');$('rebuyPlayer').value=b.dataset.overviewPlayer;renderRebuy();});
$('rebuyPlayer').addEventListener('change',renderRebuy);
$('rebuyGroups').addEventListener('input',renderRebuy);
$('rebuyManualDiscount').addEventListener('input',renderRebuy);
$('rebuyLadies').addEventListener('change',renderRebuy);
$('rebuySaveBtn').addEventListener('click',async()=>{
 const e=events.find(x=>x.eventId===selected),id=$('rebuyPlayer').value,groups=Number($('rebuyGroups').value),discount=Number($('rebuyManualDiscount').value||0),msg=$('rebuyMessage'),btn=$('rebuySaveBtn');
 if(btn.disabled||mobilePaymentBusy)return;
 try{
  const p=e?.players?.find(p=>String(p.memberId)===id),cost=rebuyPrice(e,p,groups,discount,$('rebuyLadies').checked),unpaid=$('rebuyUnpaid').checked;
  if(!confirm('新增 '+groups+' 組重買｜本次應付 '+num(cost.amount)+' 元｜'+(unpaid?'尚未付款':'確認已收本次款項')+'（寄存金優先抵扣）'))return;
  btn.disabled=true;msg.textContent='正在儲存重買與付款…';msg.className='message';
  await mobilePayment({kind:'rebuy',eventId:e.eventId,memberId:id,groups,manualDiscount:discount,ladies:$('rebuyLadies').checked,paidNow:!unpaid,expectedDelta:cost.amount,note:'手機重買｜'+(unpaid?'本次待收':'本次已收款')});
  msg.textContent='重買成功，新增 '+groups+' 組｜款項已同步玩家帳務';msg.className='message good';$('rebuyGroups').value='1';$('rebuyManualDiscount').value='0';$('rebuyUnpaid').checked=true;
 }catch(err){msg.textContent='重買失敗：'+err.message;msg.className='message error';}
 finally{btn.disabled=false;renderRebuy();}
});

function render(){
 const open=events.filter(e=>!['settled','已結算','deleted'].includes(e.status)).sort((a,b)=>String(b.businessDate||b.date||'').localeCompare(String(a.businessDate||a.date||''))||Number(b.seq||1)-Number(a.seq||1));
 if(!open.some(e=>e.eventId===selected))selected=open[0]?.eventId||'';
 $('eventSelect').innerHTML=open.map(e=>`<option value="${esc(e.eventId)}">${esc(e.businessDate||e.date||'')}｜${esc(e.name||'賽事')}</option>`).join('');$('eventSelect').value=selected;
 const e=open.find(e=>e.eventId===selected);if(!e){updateDashboard();$('summary').textContent='';$('players').innerHTML='<div class="empty">目前沒有進行中的賽事</div>';return}
 const allPlayers=(e.players||[]).slice().sort((a,b)=>String(a.seat||'').localeCompare(String(b.seat||''),'zh-TW',{numeric:true}));
 const tables=[...new Set(allPlayers.map(p=>String(p.seat||'').trim().match(/^(\d+)-/)?.[1]).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
 const tableSel=$('chipTableSelect'),available=['all',...tables,'unseated'];if(!available.includes(selectedChipTable))selectedChipTable=tables[0]||'unseated';
 tableSel.innerHTML=tables.map(t=>'<option value="'+esc(t)+'">第 '+esc(t)+' 桌</option>').join('')+'<option value="unseated">未安排座位</option><option value="all">全部玩家</option>';tableSel.value=selectedChipTable;
 const players=allPlayers.filter(p=>selectedChipTable==='all'||(selectedChipTable==='unseated'?!String(p.seat||'').trim():String(p.seat||'').startsWith(selectedChipTable+'-')));
 renderChipSummary(e);updateDashboard();renderRebuy();
 const total=(e.players||[]).reduce((a,p)=>a+(+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0),0);
 const reb=(e.players||[]).reduce((a,p)=>a+(+p.rebuy||0),0);
 if($('entrySummary'))$('entrySummary').textContent='報名 '+(e.players||[]).length+' 人｜重買 '+reb+' 組｜總買入 '+total+' 組';
 const focus=document.activeElement?.dataset.member,focusField=document.activeElement?.dataset.field,start=document.activeElement?.selectionStart;
 $('players').innerHTML=players.map(p=>{const id=String(p.memberId),d=drafts.get(key(selected,id)),m=members.get(id);return `<div class="card"><div class="name ${playerDue(e,p)?'unpaid-player':''}">${esc([p.nickname,m?.nickname,m?.name,p.name,id].map(v=>String(v??'').trim()).find(Boolean))}</div>${paymentBadge(e,p)}<div class="meta">會員編號 ${esc(id)}｜${num((+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0))} 組｜已儲存籌碼：${p.stack==null?'未輸入':num(p.stack)}｜人頭：${num(p.hunterHeads)}</div>${Object.entries(fieldLabels).map(([field,label])=>`<label>${label}</label><input type="text" ${field==='seat'?'maxlength="20"':'inputmode="numeric" pattern="[0-9]*"'} data-member="${esc(id)}" data-field="${field}" value="${esc(d?.patch&&field in d.patch?d.patch[field]:(p[field]??(field==='hunterHeads'?0:'')))}" ${busy.has(key(selected,id))?'disabled':''}>`).join('')}<div class="toolbar"><button data-save="${esc(id)}" ${busy.has(key(selected,id))?'disabled':''}>${busy.has(key(selected,id))?'儲存中':'儲存'}</button></div><div class="message ${d?.error?'error':d?.saved?'good':''}">${esc(d?.message||'')}</div></div>`}).join('');
 if(focus){const input=Array.from($('players').querySelectorAll('input')).find(x=>x.dataset.member===focus&&x.dataset.field===focusField);if(input&&!input.disabled){input.focus();if(start!=null)input.setSelectionRange(start,start)}}

}
function subscribe(){unsubscribe?.();status('正在連線…');unsubscribe=onSnapshot(col,snap=>{events=snap.docs.map(d=>({...d.data(),eventId:d.id}));render();calculateRegistrationPrice();status(snap.metadata.fromCache?'顯示暫存資料，等待網路確認…':'已連線｜賽事與玩家名單即時更新')},err=>status('連線失敗：'+err.message,true));}
$('players').addEventListener('input',e=>{
 const id=e.target.dataset.member,field=e.target.dataset.field;if(!id||!field)return;
 const k=key(selected,id),p=events.find(e=>e.eventId===selected)?.players?.find(p=>String(p.memberId)===id),previous=drafts.get(k),d=previous?.patch?previous:{patch:{},baseline:{}};
 if(!(field in d.baseline)||d.error)d.baseline[field]=p?.[field]??null;
 d.patch[field]=e.target.value;d.error=false;d.message='尚未儲存';drafts.set(k,d);
 const event=events.find(e=>e.eventId===selected);if(event)renderChipSummary(event);
});
$('players').addEventListener('click',async e=>{
 const id=e.target.closest('[data-save]')?.dataset.save;if(!id)return;const eventId=selected,k=key(eventId,id);if(busy.has(k))return;
 const draft=drafts.get(k);if(!draft?.patch||!Object.keys(draft.patch).length){status('資料沒有變更');return}
 const patch={};
 for(const [field,raw] of Object.entries(draft.patch)){
  const value=String(raw).trim();
  if(field==='seat')patch.seat=value;
  else if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))){drafts.set(k,{...draft,message:fieldLabels[field]+'請輸入非負整數',error:true});render();return}
  else patch[field]=Number(value);
 }
 busy.add(k);draft.message='儲存中…';render();
 try{const ref=doc(col,eventId);await runTransaction(store,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('賽事已刪除');const current=snap.data(),updated=window.EPCStackCore.updatePlayerFields(current,id,patch,draft.baseline);
 const before=(current.players||[]).find(p=>String(p.memberId)===String(id));
 const after=(updated.players||[]).find(p=>String(p.memberId)===String(id));
 const oldHeads=Number(before?.hunterHeads||0),newHeads=Number(after?.hunterHeads||0);
 const changes={players:updated.players,_eventUpdatedAt:Date.now(),updatedAt:serverTimestamp()};
 if('hunterHeads' in patch&&newHeads!==oldHeads){
  const history=Array.isArray(current.hunterHeadHistory)?current.hunterHeadHistory.slice():[];
  history.push({id:'MH'+Date.now()+'-'+Math.random().toString(36).slice(2,9),memberId:String(id),delta:newHeads-oldHeads,previous:oldHeads,total:newHeads,at:new Date().toISOString(),source:'EPC Mobile'});
  changes.hunterHeadHistory=history;
 }
 tx.update(ref,changes)});drafts.set(k,{message:'已儲存，電腦與活動會自動更新',saved:true});}
 catch(err){drafts.set(k,{...draft,message:err.message,error:true});status('儲存失敗，輸入已保留',true)}finally{busy.delete(k);render()}
});
$('chipTableSelect').addEventListener('change',()=>{selectedChipTable=$('chipTableSelect').value;render()});
$('eventSelect').addEventListener('change',()=>{selected=$('eventSelect').value;selectedChipTable='all';render();calculateRegistrationPrice()});$('reload').addEventListener('click',subscribe);subscribe();
// Read-only member labels; roster and writes always use EPCMAIN Firestore.
const API='https://script.google.com/macros/s/AKfycbwZi5bXuFJdtXiE6oxPmn4NZti-wZyOwEfTKZ8VPo5nXP5GK1mPOYrfkxz714AN4UQx9w/exec';
async function api(action,data={}){
 const response=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...data})});
 if(!response.ok)throw Error('伺服器 HTTP '+response.status);
 const result=await response.json();if(!result.ok)throw Error(result.error||result.message||'操作失敗');return result;
}
function memberKeyOf(m){return String(m.memberKey||m.memberId||'')}
function renderMemberOptions(){
 const q=($('memberSearch').value||'').trim().toLowerCase();
 const list=memberRows.filter(m=>!q||[m.name,m.nickname,m.memberId,m.pokerfansId,m.POKERFANSID].some(x=>String(x||'').toLowerCase().includes(q))).slice(0,50);
 $('memberResults').innerHTML=list.map(m=>'<button type="button" class="member-result" data-memberkey="'+esc(memberKeyOf(m))+'">'+esc([m.name,m.nickname,m.memberId].filter(Boolean).join(' / '))+'</button>').join('');
 if(!memberRows.length)$('memberResults').innerHTML='<div class="meta">會員資料尚未載入，請稍候或重新整理</div>';
 else if(q&&!list.length)$('memberResults').innerHTML='<div class="meta">找不到符合的會員（目前已載入 '+memberRows.length+' 筆）</div>';
}
$('memberSearch').addEventListener('focus',renderMemberOptions);
$('memberSearch').addEventListener('input',()=>{$('memberSelect').value='';$('memberChosen').textContent='尚未選擇會員';renderMemberOptions();calculateRegistrationPrice()});
$('memberResults').addEventListener('click',e=>{
 const btn=e.target.closest('[data-memberkey]');if(!btn)return;
 const m=memberRows.find(x=>memberKeyOf(x)===btn.dataset.memberkey);if(!m)return;
 const k=memberKeyOf(m);
 $('memberSelect').innerHTML='<option value="'+esc(k)+'">'+esc(m.name||m.memberId)+'</option>';
 $('memberSelect').value=k;
 $('memberSearch').value=[m.name,m.nickname,m.memberId].filter(Boolean).join(' / ');
 $('memberChosen').textContent='已選擇：'+$('memberSearch').value;
 $('memberResults').innerHTML='';calculateRegistrationPrice();
});
function selectedEvent(){return events.find(x=>x.eventId===selected)}
function calculateRegistrationPrice(){
 const e=selectedEvent();if(!e)return;
 $('registrationLadiesAmount').textContent='−'+num(e.ladiesDiscount??Math.floor(Number(e.pricingMode==='custom'?e.buyinAdmin:e.fee||0)/2))+' 元／場';
 try{
  const cost=registrationPrice(e,Number($('buyinGroups').value),$('birdType').value,$('registrationLadies').checked,Number($('manualDiscount').value||0));
  const m=memberRows.find(x=>memberKeyOf(x)===$('memberSelect').value),wallet=paymentRows.get(String(m?.memberId))?.wallet||0;
  $('amountPaid').value=cost.paid;$('priceNote').textContent='應付 '+num(cost.paid)+' 元｜優惠合計 '+num(cost.totalDiscount)+' 元｜寄存抵扣 '+num(Math.min(wallet,cost.paid))+' 元｜本次另收 '+num(Math.max(0,cost.paid-wallet))+' 元';
 }catch(err){$('amountPaid').value='';$('priceNote').textContent=err.message;}
}
$('buyinGroups').addEventListener('input',calculateRegistrationPrice);
$('birdType').addEventListener('change',calculateRegistrationPrice);
$('registrationLadies').addEventListener('change',calculateRegistrationPrice);
$('manualDiscount').addEventListener('input',calculateRegistrationPrice);
$('registerBtn').addEventListener('click',async()=>{
 const e=selectedEvent(),memberKey=$('memberSelect').value,m=memberRows.find(x=>memberKeyOf(x)===memberKey),msg=$('registerMessage'),btn=$('registerBtn');
 if(btn.disabled||mobilePaymentBusy)return;
 try{
  if(!e||!m)throw Error('請先選擇賽事及會員');
  const cost=registrationPrice(e,Number($('buyinGroups').value),$('birdType').value,$('registrationLadies').checked,Number($('manualDiscount').value||0)),unpaid=$('registrationUnpaid').checked;
  btn.disabled=true;msg.textContent='正在儲存報名與付款…';msg.className='message';
  await mobilePayment({kind:'add',eventId:e.eventId,memberId:String(m.memberId),paidNow:!unpaid,expectedCharge:cost.paid,player:{...cost.p,memberKey:memberKeyOf(m),name:m.name||'',nickname:m.nickname||'',group:m.group||'',stack:null},note:'手機報名｜'+(unpaid?'待收':'已收款')});
  msg.textContent='報名成功｜'+cost.p.buyin+' 組｜應付 '+num(cost.paid)+' 元｜已同步玩家帳務';msg.className='message good';
  $('memberSearch').value='';$('memberSelect').innerHTML='<option value="">尚未選擇</option>';$('memberChosen').textContent='尚未選擇會員';$('memberResults').innerHTML='';$('registrationUnpaid').checked=true;$('registrationLadies').checked=false;$('birdType').value='none';$('manualDiscount').value='0';$('buyinGroups').value='1';calculateRegistrationPrice();
 }catch(err){msg.textContent='報名失敗：'+err.message;msg.className='message error';}
 finally{btn.disabled=false;}
});
api('member.list').then(r=>{memberRows=Array.isArray(r.members)?r.members:[];members=new Map(memberRows.map(m=>[String(m.memberId),m]));renderMemberOptions();render();$('memberChosen').textContent='會員已載入 '+memberRows.length+' 筆，點擊搜尋框選擇'}).catch(err=>{$('registerMessage').textContent='會員載入失敗：'+err.message;$('registerMessage').className='message error'});

