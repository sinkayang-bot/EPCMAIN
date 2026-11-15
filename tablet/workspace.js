(function(){
'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mount(){
 document.title='EPC 平板工作台';const main=document.querySelector('main'),header=document.querySelector('header');if(!main||!header)return;
 header.querySelector('h1 span').textContent='平板工作台';
 const nav=document.createElement('nav');nav.id='tabletRail';nav.setAttribute('aria-label','工作項目');nav.innerHTML='<div class="rail-title">現場工作</div>'+[['playerPanel','點碼'],['registration','玩家報名'],['rebuyPanel','重買收款'],['seatingPanel','安排座位'],['overviewPanel','賽事總覽']].map(([id,label])=>'<button data-task="'+id+'">'+label+'</button>').join('')+'<a href="../" target="_blank" rel="noopener">完整後臺 ↗</a><div class="rail-note">與手機、電腦共用資料<br>輸入後按儲存才會送出</div>';document.body.append(nav);
 nav.addEventListener('click',e=>{const b=e.target.closest('[data-task]');if(b)window.epcTabletGo?.(b.dataset.task)});
 const connection=document.createElement('details');connection.id='tabletConnection';connection.innerHTML='<summary>帳務登入與連線</summary>';const auth=$('phonePaymentAuth');auth.before(connection);connection.append(auth);connection.open=true;
 const context=document.createElement('div');context.id='tabletEventContext';const select=$('eventSelect'),label=main.querySelector('label[for=eventSelect]'),toolbar=$('reload').parentElement;label.before(context);context.append(label,select,toolbar);
 const panel=$('playerPanel'),work=document.createElement('div');work.id='tabletChipWorkspace';work.innerHTML='<section id="tabletRosterPane"><h3>1　選擇玩家</h3><label for="tabletPlayerSearch">快速找人</label><input id="tabletPlayerSearch" type="search" autocomplete="off" placeholder="姓名、編號或座位"><div id="tabletRoster"></div></section><section id="tabletEditorPane"><h3>2　輸入並儲存</h3><div class="toolbar"><button type="button" id="tabletPrev">← 上一位</button><button type="button" id="tabletNext">下一位 →</button></div><p class="meta">本場資料即時同步；點碼草稿會保留，尚未儲存前不會覆蓋雲端。</p></section>';panel.append(work);$('tabletEditorPane').append($('players'));
 let roster=[],chosen='',filter='';
 function renderRoster(){const found=roster.filter(p=>!filter||[p.name,p.number,p.seat].some(v=>String(v).toLowerCase().includes(filter)));$('tabletRoster').innerHTML=found.map(p=>'<button type="button" data-player="'+esc(p.id)+'" aria-pressed="'+(chosen===p.id)+'"><span class="roster-seat">'+esc(p.seat)+'</span><strong>'+esc(p.name)+'</strong><span>#'+esc(p.number)+'</span><small>'+(p.stack==null?'未點碼':Number(p.stack).toLocaleString()+' 碼')+' · '+p.groups+' 組'+(p.due?' · 待收 $'+Number(p.due).toLocaleString():'')+'</small></button>').join('')||'<div class="empty">'+(roster.length?'沒有符合的玩家':'這一桌尚無玩家，請切換桌號或先報名')+'</div>'}
 function step(delta){if(!roster.length)return;const at=roster.findIndex(p=>p.id===chosen),next=roster[(at+delta+roster.length)%roster.length];chosen=next.id;window.epcTabletSelectedPlayer=chosen;window.epcTabletRefresh?.()}
 $('tabletPrev').onclick=()=>step(-1);$('tabletNext').onclick=()=>step(1);
 $('tabletPlayerSearch').addEventListener('input',e=>{filter=e.target.value.trim().toLowerCase();renderRoster()});
 $('tabletRoster').addEventListener('click',e=>{const b=e.target.closest('[data-player]');if(!b)return;chosen=b.dataset.player;window.epcTabletSelectedPlayer=chosen;window.epcTabletRefresh?.();});
 window.addEventListener('epcTabletRoster',e=>{roster=e.detail.players;chosen=roster.some(p=>p.id===window.epcTabletSelectedPlayer)?window.epcTabletSelectedPlayer:roster[0]?.id||'';window.epcTabletSelectedPlayer=chosen;renderRoster()});
 window.addEventListener('epcTabletPanel',e=>{nav.querySelectorAll('[data-task]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.task===e.detail.id)));});
 const ready=()=>{window.epcTabletGo?.('playerPanel');};window.addEventListener('epcTabletReady',ready,{once:true});if(window.epcTabletGo)ready();
 // Keep the login panel available, collapse it only after an authenticated state is observed.
 window.addEventListener('epcPlayerPayments',e=>{if(e.detail?.connected)connection.open=false});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
