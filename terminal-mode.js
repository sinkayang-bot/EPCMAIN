(function(){
 'use strict';
 const listeners=new Set(),saved=new WeakMap();let mode='view',writes=0;
 const isView=()=>mode==='view',message='目前是檢視模式，請切換操作模式後再修改';
 function assertWrite(){if(isView())throw Error(message);}
 function notify(text){const el=document.getElementById('epcTerminalModeMessage');if(el)el.textContent=text;}
 function runWrite(fn){assertWrite();writes++;try{const out=fn();if(out&&typeof out.then==='function')return Promise.resolve(out).finally(()=>{writes--;});writes--;return out;}catch(err){writes--;throw err;}}
 const readAction=action=>/^(ping|bootstrap|changes|load|loadStacks|devices|activity\.get|member\.list|event\.list|player\.list|settlement\.report|get.*|.*\.get|.*\.list|.*\.report)$/.test(String(action));
 function assertAction(action){if(!readAction(action))assertWrite();}
 function queryControl(el){const id=el.id||'';return el.hasAttribute('data-mode-control')||el.closest('#nav')||/^epcTheme/.test(id)||/Search|Filter|Query|DateFrom|DateTo|RangeFrom|RangeTo/.test(id)||['eventBusinessDate','eventDate','eventSelect','memberDateFrom','memberDateTo','dashFrom','dashTo','actFrom','actTo','actQuery','ppSearch','ppMember','phonePaymentAuth','epcAccountingLogin','epcAccountingLogout','epcAccountingRetry'].includes(id)||(el.type==='date'&&id!=='eDate')||/^(render|filter|search|showPage|setPlayerColumnPreference)/.test(el.getAttribute('onchange')||el.getAttribute('oninput')||'')||el.closest('#settlementGroupFilter')||el.matches('[data-player-col]')||el.closest('.report-filters,.filter-bar');}
 function protectControls(){
  document.querySelectorAll('input,textarea,select').forEach(el=>{
   if(queryControl(el))return;
   if(isView()){
    if(!saved.has(el))saved.set(el,{disabled:el.disabled,readOnly:el.readOnly});
    if(!el.disabled)el.disabled=true;el.dataset.modeLocked='1';
   }else if(saved.has(el)){
    const old=saved.get(el);el.disabled=old.disabled;if('readOnly' in el)el.readOnly=old.readOnly;saved.delete(el);delete el.dataset.modeLocked;
   }
  });
  const select=document.getElementById('epcTerminalMode');if(select)select.value=mode;
  document.documentElement.dataset.terminalMode=mode;
 }
 function set(next){
  next=next==='view'?'view':'operate';if(next===mode){protectControls();return true;}
  if(writes||(next==='view'&&window.EPCEventPatch?.hasPending())){notify('仍有資料儲存中或尚未送出，請等儲存完成後切換');protectControls();return false;}
  mode=next;
  protectControls();notify(next==='view'?'檢視模式：自動接收更新，禁止修改與上傳':'操作模式：可修改並儲存；同一欄位以最後成功儲存為準');
  window.dispatchEvent(new CustomEvent('epcTerminalModeChanged',{detail:{mode}}));listeners.forEach(fn=>fn(mode));return true;
 }
 function patchChildren(root,html){
  if(!root)return;const box=document.createElement(root.tagName==='TBODY'?'tbody':'div');box.innerHTML=html;
  const old=new Map([...root.children].map((el,i)=>[el.dataset.playerId||el.dataset.eventId||String(i),el]));
  [...box.children].forEach((node,i)=>{const key=node.dataset.playerId||node.dataset.eventId||String(i),existing=old.get(key);old.delete(key);const comparable=el=>{const c=el.cloneNode(true),source=[...el.querySelectorAll('[data-mode-locked]')],copies=[...c.querySelectorAll('[data-mode-locked]')];source.forEach((x,j)=>{copies[j].disabled=saved.get(x)?.disabled||false;delete copies[j].dataset.modeLocked;});return c.outerHTML;};const next=existing&&comparable(existing)===node.outerHTML?existing:node;const position=root.children[i];if(next!==position)root.insertBefore(next,position||null);if(existing&&next!==existing)existing.remove();});old.forEach(el=>el.remove());
 }
 // Apps Script read endpoints also use POST, so gate by action rather than HTTP verb.
 const fetchOriginal=window.fetch?.bind(window);
 if(fetchOriginal)window.fetch=function(input,init){let action;try{const body=typeof init?.body==='string'?JSON.parse(init.body):null;action=body?.action;}catch(_){}
  if(action&&!readAction(action)){try{return runWrite(()=>fetchOriginal(input,init));}catch(err){return Promise.reject(err);}}
  return fetchOriginal(input,init);
 };
 window.EPCMode={isView,assertWrite,assertAction,runWrite,set,get:()=>mode,on:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},patchChildren,protectControls};
 const mutation=/新增|儲存|刪除|移除|確認|結清|抵扣|補帳|領回|寄存|套用|配對|解除|建立|解鎖|上傳|修改|編輯|登記|取消得獎|啟用攻擊|計算\s*ICM/;
 document.addEventListener('click',ev=>{if(!isView())return;const el=ev.target.closest('button,[role=button],a');if(!el||queryControl(el)||el.closest('#epcTerminalModeBar'))return;
  if(/^PP\.(open|openMember)\(/.test(el.getAttribute('onclick')||''))return;
  if(el.closest('#nav')||/列印|查詢|搜尋|進入|查看|返回|關閉|取消$|重新讀取|重試連線/.test(el.textContent))return;
  const code=el.getAttribute('onclick')||'';
  if(el.matches('[data-pp-action],[data-save],[data-epc-seat-target],[data-seat-code],[data-seat-player],[data-table-handle]')||/(boss|hunter|umbrella|pioneer|extremeTen).*(Adj|Attack|Save|Delete|Edit|Award|Claim|Confirm|Reset|Start)/i.test(code)||mutation.test(el.textContent)||/\b(setP|setStackFast_|delP|save|add|delete|remove|actAdj_|persist|publish|pair|unlock|calculateICM)/.test(code)){
   ev.preventDefault();ev.stopImmediatePropagation();notify(message);
  }
 },true);
 ['beforeinput','change','input','submit','drop'].forEach(type=>document.addEventListener(type,ev=>{if(!isView()||queryControl(ev.target))return;if(type==='drop'||type==='submit'||ev.target.matches('input,textarea,select')){ev.preventDefault();ev.stopImmediatePropagation();notify(message);}},true));
 function mount(){
  const main=document.querySelector('main');if(!main)return;
  const bar=document.createElement('div');bar.id='epcTerminalModeBar';bar.className='card';bar.style.cssText='display:flex;gap:12px;align-items:center;flex-wrap:wrap;border:1px solid #b9954d;padding:12px;margin-bottom:12px';
  bar.innerHTML='<label for="epcTerminalMode" style="font-weight:800">本機模式</label><select id="epcTerminalMode" data-mode-control style="width:150px"><option value="operate">操作模式</option><option value="view">檢視模式</option></select><span id="epcTerminalModeMessage" role="status" style="font-size:13px"></span>';main.prepend(bar);
  document.getElementById('epcTerminalMode').addEventListener('change',ev=>set(ev.target.value));
  notify(isView()?'檢視模式：自動接收更新，禁止修改與上傳':'操作模式：可修改並儲存；同一欄位以最後成功儲存為準');protectControls();
  new MutationObserver(()=>protectControls()).observe(document.body,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
