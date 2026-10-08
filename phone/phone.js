import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getFirestore,collection,doc,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store=getFirestore(initializeApp(window.EPC_FIREBASE_CONFIG,'epc-phone')),col=collection(store,'epc_events');
let events=[],selected='',unsubscribe,members=new Map();const drafts=new Map(),busy=new Set();
const key=(e,m)=>JSON.stringify([e,String(m)]),num=n=>Number(n||0).toLocaleString('zh-TW');
function status(s,bad=false){$('status').textContent=s;$('status').className=bad?'error':''}
function render(){
 const open=events.filter(e=>!['settled','已結算','deleted'].includes(e.status)).sort((a,b)=>String(b.businessDate||b.date||'').localeCompare(String(a.businessDate||a.date||''))||Number(b.seq||1)-Number(a.seq||1));
 if(!open.some(e=>e.eventId===selected))selected=open[0]?.eventId||'';
 $('eventSelect').innerHTML=open.map(e=>`<option value="${esc(e.eventId)}">${esc(e.businessDate||e.date||'')}｜${esc(e.name||'賽事')}</option>`).join('');$('eventSelect').value=selected;
 const e=open.find(e=>e.eventId===selected);if(!e){$('summary').textContent='';$('players').innerHTML='<div class="empty">目前沒有進行中的賽事</div>';return}
 const players=e.players||[],groups=players.reduce((n,p)=>n+(+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0),0);
 $('summary').textContent=`${players.length} 位玩家｜${num(groups)} 組`;
 // Keep focused inputs and drafts while realtime roster changes arrive.
 const focus=document.activeElement?.dataset.member,start=document.activeElement?.selectionStart;
 $('players').innerHTML=players.map(p=>{const id=String(p.memberId),d=drafts.get(key(selected,id)),m=members.get(id),value=d&&!d.saved?d.value:(p.stack??'');return `<div class="card"><div class="name">${esc(p.nickname||m?.nickname||p.name||m?.name||id)}</div><div class="meta">會員編號 ${esc(id)}｜${num((+p.buyin||0)+(+p.rebuy||0)+(+p.addon||0))} 組｜已儲存：${p.stack==null?'未輸入':num(p.stack)}</div><label>下桌籌碼</label><div class="controls"><input type="text" inputmode="numeric" pattern="[0-9]*" data-member="${esc(id)}" value="${esc(value)}" ${busy.has(key(selected,id))?'disabled':''}><button data-save="${esc(id)}" ${busy.has(key(selected,id))?'disabled':''}>${busy.has(key(selected,id))?'儲存中':'儲存'}</button></div><div class="message ${d?.error?'error':d?.saved?'good':''}">${esc(d?.message||'')}</div></div>`}).join('');
 if(focus){const input=Array.from($('players').querySelectorAll('input')).find(x=>x.dataset.member===focus);if(input&&!input.disabled){input.focus();if(start!=null)input.setSelectionRange(start,start)}}
}
function subscribe(){unsubscribe?.();status('正在連線…');unsubscribe=onSnapshot(col,snap=>{events=snap.docs.map(d=>({...d.data(),eventId:d.id}));render();status(snap.metadata.fromCache?'顯示暫存資料，等待網路確認…':'已連線｜賽事與玩家名單即時更新')},err=>status('連線失敗：'+err.message,true));}
$('players').addEventListener('input',e=>{const id=e.target.dataset.member;if(!id)return;const k=key(selected,id),p=events.find(e=>e.eventId===selected)?.players?.find(p=>String(p.memberId)===id);const previous=drafts.get(k);drafts.set(k,{value:e.target.value,baseline:previous&&!previous.saved&&!previous.error?previous.baseline:(p?.stack??null)});});
$('players').addEventListener('click',async e=>{
 const id=e.target.closest('[data-save]')?.dataset.save;if(!id)return;const eventId=selected,k=key(eventId,id);if(busy.has(k))return;
 const p=events.find(e=>e.eventId===eventId)?.players?.find(p=>String(p.memberId)===id),draft=drafts.get(k),input=Array.from($('players').querySelectorAll('input')).find(x=>x.dataset.member===id),value=String(draft?.value??input?.value??'').trim();
 if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))){drafts.set(k,{...draft,value,message:'請輸入非負整數籌碼',error:true});render();return}
 busy.add(k);drafts.set(k,{...draft,value,baseline:draft?draft.baseline:(p?.stack??null),message:'儲存中…'});render();
 try{const stack=Number(value),baseline=drafts.get(k).baseline,ref=doc(col,eventId);await runTransaction(store,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('賽事已刪除');const latest=snap.data(),updated=window.EPCStackCore.updateStack(latest,id,stack,baseline);tx.update(ref,{players:updated.players,_eventUpdatedAt:Date.now(),updatedAt:serverTimestamp()})});drafts.set(k,{value,baseline:stack,message:'已儲存，電腦會自動更新',saved:true});}
 catch(err){drafts.set(k,{...drafts.get(k),message:err.message,error:true});status('儲存失敗，輸入已保留',true)}finally{busy.delete(k);render()}
});
$('eventSelect').addEventListener('change',()=>{selected=$('eventSelect').value;render()});$('reload').addEventListener('click',subscribe);subscribe();
// Read-only member labels; roster and writes always use EPCMAIN Firestore.
fetch('https://script.google.com/macros/s/AKfycbwZi5bXuFJdtXiE6oxPmn4NZti-wZyOwEfTKZ8VPo5nXP5GK1mPOYrfkxz714AN4UQx9w/exec',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'member.list'})}).then(r=>r.json()).then(r=>{if(r.ok){members=new Map((r.members||[]).map(m=>[String(m.memberId),m]));render()}}).catch(()=>{});
