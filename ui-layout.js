/* Local presentation preferences; never changes event or activity records. */
(()=>{
'use strict';
const KEY='epcLayoutV1',nav=document.getElementById('nav');
if(!nav)return;
const buttons=[...nav.querySelectorAll('button[data-page]')];
const tabs=[...document.querySelectorAll('#activities button[onclick]')].filter(b=>/^setActTab_\('/.test(b.getAttribute('onclick')||''));
const activityKey=b=>b.getAttribute('onclick').match(/setActTab_\('([^']+)'/)[1];
let prefs={order:[],hidden:[]};
try{const p=JSON.parse(localStorage.getItem(KEY)||'null');if(p)prefs={order:Array.isArray(p.order)?p.order:[],hidden:Array.isArray(p.hidden)?p.hidden:[]};}catch(_){}
const dialog=document.createElement('dialog');dialog.id='epcLayoutDialog';
dialog.style.cssText='width:min(520px,92vw);max-height:85vh;overflow:auto;background:var(--bg,#151a22);color:var(--text,#eee);border:1px solid #b9954d;border-radius:14px;padding:20px';
dialog.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><h2>版面設定</h2><button type="button" data-mode-control data-close>關閉</button></div><p class="small">僅記住本機瀏覽器的版面。隱藏活動仍保留資料與計算，投影內容由「顯示設備」設定。</p><h3>左側選單順序</h3><p class="small">拖曳項目排序，或使用上下按鈕。</p><div data-menu-list data-mode-control></div><h3>顯示的活動</h3><div data-activity-list></div><p data-layout-status role="status" class="small"></p><button type="button" data-mode-control data-reset>恢復預設版面</button>';
document.body.append(dialog);
const opener=document.createElement('button');opener.type='button';opener.textContent='版面設定';opener.dataset.modeControl='';opener.id='epcLayoutOpen';nav.append(opener);
const ordered=()=>{const ids=new Set(buttons.map(b=>b.dataset.page));return [...new Set([...prefs.order.filter(id=>ids.has(id)),...buttons.map(b=>b.dataset.page)])];};
function apply(){
 ordered().forEach(id=>nav.insertBefore(buttons.find(b=>b.dataset.page===id),nav.querySelector('#epcThemeToggle')||opener));
 tabs.forEach(b=>{b.hidden=prefs.hidden.includes(activityKey(b));b.style.display=b.hidden?'none':'';});
 const available=tabs.filter(b=>!b.hidden);
 if(typeof actTab_!=='undefined'&&prefs.hidden.includes(actTab_)&&available.length){setActTab_(activityKey(available[0]));}
}
function save(){
 try{localStorage.setItem(KEY,JSON.stringify(prefs));dialog.querySelector('[data-layout-status]').textContent='已儲存本機版面';}
 catch(_){dialog.querySelector('[data-layout-status]').textContent='瀏覽器無法儲存設定；目前版面仍可使用。';}
 apply();
}
function move(id,offset){const order=ordered(),i=order.indexOf(id),j=i+offset;if(i<0||j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];prefs.order=order;save();renderMenu();dialog.querySelector(`[data-id="${id}"] button[data-step="${offset}"]`)?.focus();}
let dragging='';
function renderMenu(){
 const list=dialog.querySelector('[data-menu-list]');list.replaceChildren();const order=ordered();
 order.forEach((id,i)=>{
 const row=document.createElement('div');row.dataset.id=id;row.dataset.modeControl='';row.draggable=true;row.style.cssText='display:flex;gap:8px;align-items:center;padding:8px;border:1px solid #54504a;border-radius:8px;margin:5px 0;cursor:grab';
 const label=document.createElement('span');label.dataset.modeControl='';label.textContent='⋮⋮ '+buttons.find(b=>b.dataset.page===id).textContent;label.style.flex='1';row.append(label);
 [-1,1].forEach(step=>{const b=document.createElement('button');b.type='button';b.dataset.modeControl='';b.dataset.step=step;b.textContent=step<0?'上移':'下移';b.disabled=step<0?i===0:i===order.length-1;b.setAttribute('aria-label',label.textContent+(step<0?'上移':'下移'));b.onclick=()=>move(id,step);row.append(b);});
 row.addEventListener('dragstart',e=>{dragging=id;e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';row.style.opacity='.5';});
 row.addEventListener('dragend',()=>{dragging='';row.style.opacity='1';});
 row.addEventListener('dragover',e=>{if(dragging){e.preventDefault();e.dataTransfer.dropEffect='move';}});
 row.addEventListener('drop',e=>{e.preventDefault();if(!dragging||dragging===id)return;const ids=ordered().filter(x=>x!==dragging);ids.splice(ids.indexOf(id),0,dragging);prefs.order=ids;dragging='';save();renderMenu();});
 list.append(row);
 });
}
function renderActivities(){
 const list=dialog.querySelector('[data-activity-list]');list.replaceChildren();
 tabs.forEach(tab=>{const id=activityKey(tab),label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:10px;padding:7px';const input=document.createElement('input');input.type='checkbox';input.dataset.modeControl='';input.style.width='auto';input.checked=!prefs.hidden.includes(id);input.onchange=()=>{if(!input.checked&&tabs.filter(b=>!prefs.hidden.includes(activityKey(b))).length<=1){input.checked=true;dialog.querySelector('[data-layout-status]').textContent='至少保留一個活動顯示';return;}prefs.hidden=prefs.hidden.filter(x=>x!==id);if(!input.checked)prefs.hidden.push(id);save();};label.append(input,document.createTextNode(tab.textContent));list.append(label);});
}
opener.onclick=()=>{renderMenu();renderActivities();dialog.showModal();};
dialog.querySelector('[data-close]').onclick=()=>dialog.close();
dialog.querySelector('[data-reset]').onclick=()=>{prefs={order:[],hidden:[]};save();renderMenu();renderActivities();};
apply();
if(typeof window.renderActivities==='function'){const original=window.renderActivities;window.renderActivities=function(){const result=original.apply(this,arguments);apply();return result;};}
window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{const p=JSON.parse(e.newValue||'{}');prefs={order:Array.isArray(p.order)?p.order:[],hidden:Array.isArray(p.hidden)?p.hidden:[]};apply();if(dialog.open){renderMenu();renderActivities();}}catch(_){}});
})();
