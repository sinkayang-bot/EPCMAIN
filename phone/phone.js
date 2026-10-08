import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getFirestore,collection,doc,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store=getFirestore(initializeApp(window.EPC_FIREBASE_CONFIG,'epc-phone')),col=collection(store,'epc_events');
let events=[],selected='',unsubscribe,members=new Map();const drafts=new Map(),busy=new Set();
const fieldLabels={seat:'座位',stack:'下桌籌碼',hunterHeads:'獵人頭（本場累計）'};
const key=(e,m)=>JSON.stringify([e,String(m)]),num=n=>Number(n||0).toLocaleString('zh-TW');
function status(s,bad=false){$('status').textContent=s;$('status').className=bad?'error':''}
function render(){
 const open=events.filter(e=>!['settled','已結算','deleted'].includes(e.status)).sort((a,b)=>String(b.businessDate||b.date||'').localeCompare(String(a.businessDate||a.date||''))||Number(b.seq||1)-Number(a.seq||1));
 if(!open.some(e=>e.eventId===selected))selected=open[0]?.eventId||'';
 $('eventSelect').innerHTML=open.map(e=>`<option value="${esc(e.eventId)}">${esc(e.businessDate||e.date||'')}｜${esc(e.name||'賽事')}</option>`).join('');$('eventSelect').value=selected;
 const e=open.find(e=>e.eventId===selected);if(!e){$('summary').textContent='';$('players').innerHTML='<div class="empty">目前沒有進行中的賽事</div>';return}
 const players=(e.players||[]).slice().sort((a,b)=>String(a.seat||'').localeCompare(String(b.seat||''),'zh-TW',{numeric:true})),groups=players.reduce((n,p)=>n+(+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0),0);
 $('summary').textContent=`${players.length} 位玩家｜${num(groups)} 組`;
 const focus=document.activeElement?.dataset.member,focusField=document.activeElement?.dataset.field,start=document.activeElement?.selectionStart;
 $('players').innerHTML=players.map(p=>{const id=String(p.memberId),d=drafts.get(key(selected,id)),m=members.get(id);return `<div class="card"><div class="name">${esc(p.nickname||m?.nickname||p.name||m?.name||id)}</div><div class="meta">會員編號 ${esc(id)}｜${num((+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0))} 組｜已儲存籌碼：${p.stack==null?'未輸入':num(p.stack)}｜人頭：${num(p.hunterHeads)}</div>${Object.entries(fieldLabels).map(([field,label])=>`<label>${label}</label><input type="text" ${field==='seat'?'maxlength="20"':'inputmode="numeric" pattern="[0-9]*"'} data-member="${esc(id)}" data-field="${field}" value="${esc(d?.patch&&field in d.patch?d.patch[field]:(p[field]??(field==='hunterHeads'?0:'')))}" ${busy.has(key(selected,id))?'disabled':''}>`).join('')}<div class="toolbar"><button data-save="${esc(id)}" ${busy.has(key(selected,id))?'disabled':''}>${busy.has(key(selected,id))?'儲存中':'儲存'}</button></div><div class="message ${d?.error?'error':d?.saved?'good':''}">${esc(d?.message||'')}</div></div>`}).join('');
 if(focus){const input=Array.from($('players').querySelectorAll('input')).find(x=>x.dataset.member===focus&&x.dataset.field===focusField);if(input&&!input.disabled){input.focus();if(start!=null)input.setSelectionRange(start,start)}}

}
function subscribe(){unsubscribe?.();status('正在連線…');unsubscribe=onSnapshot(col,snap=>{events=snap.docs.map(d=>({...d.data(),eventId:d.id}));render();status(snap.metadata.fromCache?'顯示暫存資料，等待網路確認…':'已連線｜賽事與玩家名單即時更新')},err=>status('連線失敗：'+err.message,true));}
$('players').addEventListener('input',e=>{
 const id=e.target.dataset.member,field=e.target.dataset.field;if(!id||!field)return;
 const k=key(selected,id),p=events.find(e=>e.eventId===selected)?.players?.find(p=>String(p.memberId)===id),previous=drafts.get(k),d=previous?.patch?previous:{patch:{},baseline:{}};
 if(!(field in d.baseline)||d.error)d.baseline[field]=p?.[field]??null;
 d.patch[field]=e.target.value;d.error=false;d.message='尚未儲存';drafts.set(k,d);
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
$('eventSelect').addEventListener('change',()=>{selected=$('eventSelect').value;render()});$('reload').addEventListener('click',subscribe);subscribe();
// Read-only member labels; roster and writes always use EPCMAIN Firestore.
fetch('https://script.google.com/macros/s/AKfycbwZi5bXuFJdtXiE6oxPmn4NZti-wZyOwEfTKZ8VPo5nXP5GK1mPOYrfkxz714AN4UQx9w/exec',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'member.list'})}).then(r=>r.json()).then(r=>{if(r.ok){members=new Map((r.members||[]).map(m=>[String(m.memberId),m]));render()}}).catch(()=>{});
