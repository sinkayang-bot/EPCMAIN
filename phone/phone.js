import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getFirestore,collection,doc,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store=getFirestore(initializeApp(window.EPC_FIREBASE_CONFIG,'epc-phone')),col=collection(store,'epc_events');
let events=[],selected='',unsubscribe,members=new Map();const drafts=new Map(),busy=new Set();
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


let seatPicked='',seatBusy=false;
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
 tables.innerHTML=Array.from({length:6},(_,i)=>'<div class="seat-table"><h3>'+(i+1)+' 號桌</h3><div class="seat-grid">'+Array.from({length:10},(_,j)=>{const code=seatCode(i+1,j+1),p=seatOwner(e,code);return '<button type="button" class="seat-slot '+(p?'occupied':'')+'" data-seat-code="'+code+'">'+(j+1)+' 號座'+(p?'<div><b>'+esc(seatLabel(p))+'</b></div>':'<div>空位</div>')+'</button>'}).join('')+'</div></div>').join('');
}
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

let activePanel='';
function showPanel(id=''){
 activePanel=id;
 $('dashboard').hidden=!!id;$('backDashboard').hidden=!id;
 document.querySelectorAll('.mobile-panel').forEach(el=>el.hidden=el.id!==id);
 window.scrollTo({top:0,behavior:'instant'});
}
document.querySelectorAll('[data-panel]').forEach(btn=>btn.addEventListener('click',()=>showPanel(btn.dataset.panel)));
$('backDashboard').addEventListener('click',()=>showPanel());
function updateDashboard(){
 const e=events.find(x=>x.eventId===selected),ps=e?.players||[];
 renderSeating();
 $('dashEventName').textContent=e?.name||'目前沒有進行中的賽事';
 $('dashPlayers').textContent=ps.length+' 人';
 $('dashRebuys').textContent=ps.reduce((n,p)=>n+(+p.rebuy||0),0)+' 組';
 $('dashGroups').textContent=ps.reduce((n,p)=>n+(+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0),0)+' 組';
 $('overviewStats').textContent=e?'賽事：'+(e.name||'')+'｜報名 '+ps.length+' 人｜總買入 '+ps.reduce((n,p)=>n+(+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0),0)+' 組':'無進行中賽事';
}

function render(){
 const open=events.filter(e=>!['settled','已結算','deleted'].includes(e.status)).sort((a,b)=>String(b.businessDate||b.date||'').localeCompare(String(a.businessDate||a.date||''))||Number(b.seq||1)-Number(a.seq||1));
 if(!open.some(e=>e.eventId===selected))selected=open[0]?.eventId||'';
 $('eventSelect').innerHTML=open.map(e=>`<option value="${esc(e.eventId)}">${esc(e.businessDate||e.date||'')}｜${esc(e.name||'賽事')}</option>`).join('');$('eventSelect').value=selected;
 const e=open.find(e=>e.eventId===selected);if(!e){updateDashboard();$('summary').textContent='';$('players').innerHTML='<div class="empty">目前沒有進行中的賽事</div>';return}
 const players=(e.players||[]).slice().sort((a,b)=>String(a.seat||'').localeCompare(String(b.seat||''),'zh-TW',{numeric:true}));
 renderChipSummary(e);updateDashboard();
 const total=(e.players||[]).reduce((a,p)=>a+(+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0),0);
 const reb=(e.players||[]).reduce((a,p)=>a+(+p.rebuy||0),0);
 if($('entrySummary'))$('entrySummary').textContent='報名 '+(e.players||[]).length+' 人｜重買 '+reb+' 組｜總買入 '+total+' 組';
 const focus=document.activeElement?.dataset.member,focusField=document.activeElement?.dataset.field,start=document.activeElement?.selectionStart;
 $('players').innerHTML=players.map(p=>{const id=String(p.memberId),d=drafts.get(key(selected,id)),m=members.get(id);return `<div class="card"><div class="name">${esc([p.nickname,m?.nickname,m?.name,p.name,id].map(v=>String(v??'').trim()).find(Boolean))}</div><div class="meta">會員編號 ${esc(id)}｜${num((+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0))} 組｜已儲存籌碼：${p.stack==null?'未輸入':num(p.stack)}｜人頭：${num(p.hunterHeads)}</div>${Object.entries(fieldLabels).map(([field,label])=>`<label>${label}</label><input type="text" ${field==='seat'?'maxlength="20"':'inputmode="numeric" pattern="[0-9]*"'} data-member="${esc(id)}" data-field="${field}" value="${esc(d?.patch&&field in d.patch?d.patch[field]:(p[field]??(field==='hunterHeads'?0:'')))}" ${busy.has(key(selected,id))?'disabled':''}>`).join('')}<div class="toolbar"><button data-save="${esc(id)}" ${busy.has(key(selected,id))?'disabled':''}>${busy.has(key(selected,id))?'儲存中':'儲存'}</button></div><div class="message ${d?.error?'error':d?.saved?'good':''}">${esc(d?.message||'')}</div></div>`}).join('');
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
 try{const ref=doc(col,eventId);await runTransaction(store,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('賽事已刪除');const updated=window.EPCStackCore.updatePlayerFields(snap.data(),id,patch,draft.baseline);tx.update(ref,{players:updated.players,_eventUpdatedAt:Date.now(),updatedAt:serverTimestamp()})});drafts.set(k,{message:'已儲存，電腦與活動會自動更新',saved:true});}
 catch(err){drafts.set(k,{...draft,message:err.message,error:true});status('儲存失敗，輸入已保留',true)}finally{busy.delete(k);render()}
});
$('eventSelect').addEventListener('change',()=>{selected=$('eventSelect').value;render();calculateRegistrationPrice()});$('reload').addEventListener('click',subscribe);subscribe();
// Read-only member labels; roster and writes always use EPCMAIN Firestore.
const API='https://script.google.com/macros/s/AKfycbwZi5bXuFJdtXiE6oxPmn4NZti-wZyOwEfTKZ8VPo5nXP5GK1mPOYrfkxz714AN4UQx9w/exec';
let memberRows=[];
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
$('memberSearch').addEventListener('input',()=>{$('memberSelect').value='';$('memberChosen').textContent='尚未選擇會員';renderMemberOptions()});
$('memberResults').addEventListener('click',e=>{
 const btn=e.target.closest('[data-memberkey]');if(!btn)return;
 const m=memberRows.find(x=>memberKeyOf(x)===btn.dataset.memberkey);if(!m)return;
 const k=memberKeyOf(m);
 $('memberSelect').innerHTML='<option value="'+esc(k)+'">'+esc(m.name||m.memberId)+'</option>';
 $('memberSelect').value=k;
 $('memberSearch').value=[m.name,m.nickname,m.memberId].filter(Boolean).join(' / ');
 $('memberChosen').textContent='已選擇：'+$('memberSearch').value;
 $('memberResults').innerHTML='';
});
function selectedEvent(){return events.find(x=>x.eventId===selected)}
function calculateRegistrationPrice(){
 const e=selectedEvent(),groups=Number($('buyinGroups').value),bird=$('birdType').value,manual=Number($('manualDiscount').value||0);
 if(!e||!Number.isSafeInteger(groups)||groups<1||groups>100){$('priceNote').textContent='請選擇賽事並輸入有效組數';return}
 const unit=Number(e.buyinTotal||e.level||0),discount=bird==='early'?Number(e.earlyBirdDiscount||0):bird==='late'?Number(e.lateBirdDiscount||0):0;
 const base=groups*unit,amount=Math.max(0,base-discount-Math.max(0,manual));
 $('amountPaid').value=amount;
 $('priceNote').textContent='每組 '+num(unit)+' 元 × '+groups+' 組；'+(discount?'優惠 '+num(discount)+' 元':'無早晚鳥優惠')+'；手動優惠 '+num(manual)+' 元；應收 '+num(amount)+' 元';
}
$('buyinGroups').addEventListener('input',calculateRegistrationPrice);
$('birdType').addEventListener('change',calculateRegistrationPrice);
$('manualDiscount').addEventListener('input',calculateRegistrationPrice);
$('registerBtn').addEventListener('click',async()=>{
 const e=selectedEvent(),memberKey=$('memberSelect').value,m=memberRows.find(x=>memberKeyOf(x)===memberKey),msg=$('registerMessage');
 if(!e||!m){msg.textContent='請先選擇賽事及會員';msg.className='message error';return}
 const groups=Number($('buyinGroups').value),amount=Number($('amountPaid').value),unit=Number(e.buyinTotal||e.level||0),bird=$('birdType').value;
 const discount=bird==='early'?Number(e.earlyBirdDiscount||0):bird==='late'?Number(e.lateBirdDiscount||0):0;
 const standard=groups*unit-discount,manual=Number($('manualDiscount').value);
 if(!Number.isSafeInteger(groups)||groups<1||groups>100||!Number.isSafeInteger(manual)||manual<0||manual>standard||!Number.isSafeInteger(amount)||amount<0||amount!==standard-manual||!Number.isFinite(unit)||unit<=0){msg.textContent='組數或金額無效，應收金額不可超過標準金額';msg.className='message error';return}
 const btn=$('registerBtn');btn.disabled=true;msg.textContent='正在寫入賽事…';msg.className='message';
 try{
  await runTransaction(store,async tx=>{
   const ref=doc(col,e.eventId),snap=await tx.get(ref);
   if(!snap.exists())throw Error('Firebase 賽事不存在，請重新整理');
   const current=snap.data();
   if(['settled','已結算','deleted'].includes(current.status))throw Error('賽事已結算，禁止報名');
   const players=Array.isArray(current.players)?current.players.slice():[];
   if(players.some(p=>String(p.memberKey||'')===memberKey||String(p.memberId||'')===String(m.memberId)))throw Error('此會員已報名本場');
   players.push({memberId:String(m.memberId),memberKey:memberKeyOf(m),name:m.name||'',nickname:m.nickname||'',group:m.group||'',buyin:groups,rebuy:0,addon:0,earlyBird:bird==='early',lateBird:bird==='late',manualDiscount:manual,stack:null,hunterHeads:0,seat:'',prize:0});
   tx.update(ref,{players,_eventUpdatedAt:Date.now(),updatedAt:serverTimestamp()});
  });
  msg.textContent='報名成功｜'+groups+' 組｜應收 '+num(amount)+' 元';msg.className='message good';
  $('memberSearch').value='';$('memberSelect').innerHTML='<option value="">尚未選擇</option>';$('memberChosen').textContent='尚未選擇會員';renderMemberOptions();
 }catch(err){msg.textContent='報名失敗：'+err.message;msg.className='message error'}
 finally{btn.disabled=false}
});
api('member.list').then(r=>{memberRows=Array.isArray(r.members)?r.members:[];members=new Map(memberRows.map(m=>[String(m.memberId),m]));renderMemberOptions();render();$('memberChosen').textContent='會員已載入 '+memberRows.length+' 筆，點擊搜尋框選擇'}).catch(err=>{$('registerMessage').textContent='會員載入失敗：'+err.message;$('registerMessage').className='message error'});
