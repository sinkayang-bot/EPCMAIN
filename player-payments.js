(function(){
 'use strict';
 const Core=window.EPCPlayerPaymentsCore,el=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cash=n=>'$'+Number(n||0).toLocaleString(),state=new Map(),attempts=new Map();let loaded=false,busy=false,selection=null,autoTimer=null,uncertain=null,registration=null,registrationSaving=false;
 const events=()=>window.epcDb?.events||db.events||[],members=()=>window.epcDb?.members||db.members||[];
 const findEvent=id=>events().find(e=>String(e.id)===String(id));
 const player=(e,id)=>(e?.players||[]).find(p=>String(p.memberId)===String(id));
 const name=id=>{const m=members().find(x=>String(x.id)===String(id));return m?.nickname||m?.name||String(id)};
 const legacyDue=p=>Math.max(0,Number(p?.registrationUnpaidAmount)||0)+Math.max(0,Number(p?.rebuyUnpaidAmount)||0);
 const ledger=id=>state.get(String(id))||Core.empty(id);
 window.epcPlayerPaymentPrice_=(raw,p)=>{
  const e={...raw,poolUnit:raw.buyin,admin:raw.fee,jp:raw.jpRate,overbuyThreshold:Math.max(1,Number(raw.freeAdminFrom||11)-1)};
  const n=Number(calcPlayerForEvent(p,e).paid);if(!Number.isSafeInteger(n)||n<0)throw Error('應付金額不正確');return n;
 };
 function info(e,p){
  const charge=Number(calcPlayerForEvent(p,e).paid)||0,a=ledger(p.memberId).accounts[String(e.id)];
  const paid=a?Number(a.paid||0):Math.max(0,charge-Math.min(charge,legacyDue(p)));
  return {charge,paid,due:Math.max(0,charge-paid),excess:Math.max(0,paid-charge),tracked:!!a};
 }
 function pending(id){return events().flatMap(e=>(e.players||[]).filter(p=>id==null||String(p.memberId)===String(id)).map(p=>({e,p,...info(e,p)}))).filter(x=>x.due>0).sort((a,b)=>String(businessDateForEvent(a.e)).localeCompare(String(businessDateForEvent(b.e)))||Number(a.e.seq||0)-Number(b.e.seq||0));}
 function refresh(){
  if(typeof epcPlayerEditing_==='function'&&!epcPlayerEditing_()&&el('event')?.classList.contains('active'))renderEventFast_();
  renderPending();if(el('playerpayments')?.classList.contains('active'))renderPage();
  if(selection&&el('ppDialog')?.open&&!busy)renderDialog();
 }
 function ensure(){
  if(!loaded||!window.EPCFirestore?.accountingReady)throw Error('請先到「EPC帳務」完成 Google 管理員登入，確認帳務已連線');
  if(!window.EPCFirestore?.playerPayment)throw Error('玩家帳務服務尚未載入，請重新整理');
 }
 async function run(command,retry=false){
  if(busy)return;ensure();const commandKey=JSON.stringify(command),previous=attempts.get(commandKey);
  if(uncertain&&commandKey!==uncertain.key)throw Error('上一筆款項尚未確認，請先按「確認上一筆儲存結果」，避免重複收款');
  busy=true;
  const cmd=previous||{...command,id:'PP_'+Date.now()+'_'+crypto.randomUUID(),memberId:String(command.memberId),expectedRevision:ledger(command.memberId).revision};
  attempts.set(commandKey,cmd);setStatus('儲存中，請稍候…');
  document.querySelectorAll('[data-pp-action]').forEach(x=>x.disabled=true);
  try{
   const result=await window.EPCFirestore.playerPayment(cmd);state.set(String(cmd.memberId),result.ledger);attempts.delete(commandKey);uncertain=null;
   if(result.event){
    const remote=[...(window.EPC_FIRESTORE_LAST_EVENTS||[])],i=remote.findIndex(e=>String(e.eventId||e.id)===String(result.event.eventId));
    if(i>=0)remote[i]=result.event;else remote.push(result.event);
    window.EPC_FIRESTORE_LAST_EVENTS=remote;applyFirestoreEventsToLegacy_(remote);
   }
   setStatus('已儲存');return result;
  }catch(err){
   // Do not silently replay a failed operation against a newer revision.
   // Network failures retain the same request ID so a lost acknowledgement is safe.
   if(!['unavailable','deadline-exceeded','unknown'].includes(err?.code))attempts.delete(commandKey);
   else uncertain={key:commandKey,command};
   setStatus(String(err.message||err),true);throw err;
  }finally{busy=false;document.querySelectorAll('[data-pp-action]').forEach(x=>x.disabled=false);refresh();scheduleAuto();}
 }
 function setStatus(message,error=false){if(el('ppStatus')){el('ppStatus').textContent=message;el('ppStatus').className=error?'neg':'small';}if(error||!el('ppStatus'))actionMsg(message,error);}
 function button(label,e,id,fn='open',extra=''){return `<button type="button" class="pp-player-link ${extra}" data-e="${esc(e||'')}" data-m="${esc(id)}" onclick="PP.${fn}(this.dataset.e,this.dataset.m)">${label}</button>`;}
 function nameCell(e,p,html){const v=info(e,p);return button(html,e.id,p.memberId,'open',v.due?'pp-unpaid':'pp-clear');}
 function amountCell(e,p){const v=info(e,p);return button(cash(v.charge)+(v.due?`<small>欠 ${cash(v.due)}</small>`:v.excess?`<small>溢付 ${cash(v.excess)}</small>`:''),e.id,p.memberId,'open',v.due?'pp-unpaid':'pp-clear');}
 function rebuyCell(e,p,i){return `<div class="pp-rebuy"><input aria-label="重買組數" type="number" min="0" value="${Number(p.rebuy)||0}" onchange="setP(${i},'rebuy',this.value)"><button type="button" aria-label="重買加一組" data-pp-action data-e="${esc(e.id)}" data-m="${esc(p.memberId)}" onclick="PP.increment(this.dataset.e,this.dataset.m)">＋</button></div>`;}
 function renderPending(){
  const root=el('epcUnpaidPlayers');if(!root)return;const e=currentEvent();if(!e){root.innerHTML='';return;}
  const rows=(e.players||[]).map(p=>({p,...info(e,p)})).filter(x=>x.due);
  root.innerHTML=(uncertain?'<div class="notice">上一筆款項尚未確認，請勿再次收款。<button data-pp-action onclick="PP.retryPending()">確認上一筆儲存結果</button></div>':'')+'<b>本場未結帳 '+rows.length+' 人｜尚欠 '+cash(rows.reduce((n,x)=>n+x.due,0))+'</b><div class="pp-pending">'+(rows.map(x=>button(esc(name(x.p.memberId))+'｜欠 '+cash(x.due),e.id,x.p.memberId,'open','pp-unpaid')).join('')||'<span class="small">本場目前無未結帳玩家</span>')+'</div>';
 }
 function renderPage(){
  const root=el('ppPageBody');if(!root)return;
  const q=String(el('ppSearch')?.value||'').trim().toLowerCase(),dues=pending(),ids=new Set([...state.keys(),...dues.map(x=>String(x.p.memberId))]);
  const rows=[...ids].map(id=>({id,s:ledger(id),debts:dues.filter(x=>String(x.p.memberId)===id)})).filter(x=>x.debts.length>0).filter(x=>!q||[name(x.id),x.id].join(' ').toLowerCase().includes(q));
  el('ppConnection').innerHTML=(loaded?'玩家帳務已連線':'請先到 EPC帳務完成 Google 管理員登入')+(uncertain?' <button data-pp-action onclick="PP.retryPending()">確認上一筆儲存結果</button>':'');
  el('ppMemberList').innerHTML=actMemberSearchOptions_();
  root.innerHTML='<div class="grid"><div class="card kpi"><div class="l">寄存金合計</div><div class="v">'+cash([...state.values()].reduce((n,x)=>n+x.wallet,0))+'</div></div><div class="card kpi"><div class="l">未結清合計</div><div class="v neg">'+cash(dues.reduce((n,x)=>n+x.due,0))+'</div></div></div><div class="tablewrap"><table><thead><tr><th>玩家</th><th>會員編號</th><th>寄存金</th><th>未結清</th><th>操作</th></tr></thead><tbody>'+(!rows.length?'<tr><td colspan="5" class="small">'+(q?'沒有符合搜尋的未結帳玩家':'目前沒有未結帳玩家')+'</td></tr>':'')+rows.map(x=>'<tr><td>'+button(esc(name(x.id)),'',x.id)+'</td><td>'+esc(x.id)+'</td><td>'+cash(x.s.wallet)+'</td><td class="neg">'+cash(x.debts.reduce((n,r)=>n+r.due,0))+'</td><td>'+button('帳務明細／寄存','',x.id)+' '+button('結清剩餘帳款','',x.id,'clearAll')+' '+button('刪除','',x.id,'removeAccount')+'</td></tr>').join('')+'</tbody></table></div><p class="small">寄存、獎金抵扣及補帳屬付款紀錄，不會改動原賽事的獎池、JP 或優惠。此列表只顯示未結帳玩家，結清後自動移除；寄存與歷史明細可從上方選擇會員開啟。舊紀錄沿用既有付款狀態，不追溯產生新欠款。</p>';
 }
 function open(e,id){selection={eventId:String(e||''),memberId:String(id)};renderDialog();if(!el('ppDialog').open)el('ppDialog').showModal();}
 function renderDialog(){
  if(!selection)return;const {eventId,memberId}=selection,e=findEvent(eventId),p=player(e,memberId),s=ledger(memberId),rows=pending(memberId),v=p?info(e,p):null;
  const options=events().filter(x=>String(x.id)!==eventId&&['settled','已結算'].includes(x.status)&&player(x,memberId)&&(!e||String(businessDateForEvent(x))<String(businessDateForEvent(e))||(String(businessDateForEvent(x))===String(businessDateForEvent(e))&&Number(x.seq||0)<Number(e.seq||0)))).map(x=>{
   const source=player(x,memberId),net=Math.max(0,Number(source.prize||0)-Number(calcPlayerForEvent(source,x).paid||0)),known=s.profits[String(x.id)],available=known?known.limit-known.used-known.cash:net;
   return {x,net,available,known};
  }).filter(x=>x.net>0&&x.available>0).sort((a,b)=>String(businessDateForEvent(b.x)).localeCompare(String(businessDateForEvent(a.x)))||Number(b.x.seq||0)-Number(a.x.seq||0));
  el('ppDialogTitle').textContent=name(memberId)+'｜玩家帳務';
  el('ppDialogBody').innerHTML=`${uncertain?'<div class="notice">上一筆款項的儲存結果尚未確認。<button data-pp-action onclick="PP.retryPending()">確認上一筆儲存結果</button></div>':''}<div class="pp-summary"><b>寄存 ${cash(s.wallet)}</b><b class="neg">跨場尚欠 ${cash(rows.reduce((n,x)=>n+x.due,0))}</b></div>${v?`<h3>${esc(businessDateForEvent(e))}｜${esc(eventDisplayName_(e))}</h3><p>應付 ${cash(v.charge)}｜已付 ${cash(v.paid)}｜<b class="${v.due?'neg':'pos'}">尚欠 ${cash(v.due)}</b>${v.excess?'｜溢付 '+cash(v.excess):''}</p>`:''}
  <div class="formgrid" style="grid-template-columns:1fr 1fr"><div><label>本次金額</label><input type="number" min="1" step="1" id="ppAmount" value="${v?.due||''}" placeholder="輸入實際金額"></div><div><label>方式</label><select id="ppMethod" onchange="PP.methodChanged()">${v?'<option value="cash">補帳／現金收款</option><option value="transfer">轉帳收款</option><option value="profit">上一場盈餘抵扣</option><option value="walletPay">使用寄存金</option>':''}<option value="deposit">存入寄存金</option><option value="withdraw">領回寄存金</option><option value="profitCash">登記盈餘已領現金</option>${v?.excess?'<option value="creditExcess">將溢付轉為寄存金</option>':''}</select></div><div><label>備註</label><input id="ppNote" placeholder="收款說明"></div></div>
  <div id="ppProfitArea" hidden><label>盈餘來源（領回減該場應付；不是整筆獎金）</label><select id="ppSource"><option value="">選擇來源場次</option>${options.map(({x,available,known})=>`<option value="${esc(x.id)}">${esc(businessDateForEvent(x))}｜${esc(eventDisplayName_(x))}｜${known?'可用':'未確認領取'} ${cash(available)}</option>`).join('')}</select><label style="margin-top:8px"><input type="checkbox" id="ppProfitConfirmed" style="width:auto">我已確認這筆盈餘尚未發給玩家，且未在其他地方抵扣</label></div>
  <div class="toolbar"><button class="primary" data-pp-action onclick="PP.submit()">確認登記</button><button data-pp-action data-m="${esc(memberId)}" onclick="PP.clearAll('',this.dataset.m)">結清剩餘帳款</button></div><div id="ppStatus" class="small"></div>
  <h3>未結帳場次</h3><div class="pp-pending">${rows.map(r=>button(esc(businessDateForEvent(r.e))+'｜'+esc(eventDisplayName_(r.e))+'｜欠 '+cash(r.due),r.e.id,memberId)).join('')||'無未結帳紀錄'}</div>
  <details style="margin-top:14px"><summary>盈餘抵扣／領取餘額</summary>${Object.entries(s.profits||{}).map(([id,x])=>'<p>'+esc(x.date)+'｜'+esc(x.name)+'：盈餘 '+cash(x.limit)+'；已抵扣 '+cash(x.used)+'；已領現金 '+cash(x.cash)+'；剩餘 '+cash(x.limit-x.used-x.cash)+'</p>').join('')||'<p>尚無已確認的盈餘來源</p>'}</details>
  <details style="margin-top:14px"><summary>付款與異動紀錄（${s.items.length} 筆）</summary><div class="tablewrap"><table><thead><tr><th>時間</th><th>項目</th><th>金額／異動</th><th>備註</th><th>操作</th></tr></thead><tbody>${s.items.slice().reverse().map(x=>`<tr><td>${esc(new Date(x.at).toLocaleString('zh-TW'))}</td><td>${esc(({add:'報名',rebuy:'手機重買',change:'買入／優惠調整',reconcile:'寄存自動抵扣／欠款登記',walletPay:'寄存抵扣',cash:'現金補帳',transfer:'轉帳收款',deposit:'存入寄存',withdraw:'領回寄存',profit:'盈餘抵扣',profitCash:'盈餘已領現金',creditExcess:'溢付轉寄存',settleAll:'跨場結清',archive:'刪除帳務名單',void:'撤銷'})[x.kind]||x.kind)}${x.eventId?'<br>'+esc(s.accounts[x.eventId]?.date||'')+'｜'+esc(s.accounts[x.eventId]?.name||''):''}</td><td>${x.amount?cash(x.amount):''}${['add','rebuy','settleAll'].includes(x.kind)&&x.cashAmount?'<br>現金收款 '+cash(x.cashAmount):''}${x.effects?.wallet?'<br>寄存 '+(x.effects.wallet>0?'+':'')+cash(x.effects.wallet):''}${Object.entries(x.effects?.paid||{}).map(([id,n])=>'<br>付款 '+(n>0?'+':'')+cash(n)).join('')}</td><td>${esc(x.note||'')}${x.voidedBy?'（已撤銷）':''}</td><td>${!x.voidedBy&&!['change','reconcile','void','archive'].includes(x.kind)&&(!['add','rebuy'].includes(x.kind)||x.cashAmount>0)?`<button data-pp-action data-id="${esc(x.id)}" onclick="PP.undo(this.dataset.id)">撤銷</button>`:'—'}</td></tr>`).join('')}</tbody></table></div></details>`;
 }
 function methodChanged(){el('ppProfitArea').hidden=!['profit','profitCash'].includes(el('ppMethod').value);}
 async function submit(){
  if(!selection||busy)return;const {eventId,memberId}=selection,kind=el('ppMethod').value;
  try{
   const cmd={kind,eventId,memberId,note:el('ppNote').value};
   if(!['walletPay','creditExcess'].includes(kind))cmd.amount=Core.amount(el('ppAmount').value);
   if(['profit','profitCash'].includes(kind)){cmd.sourceEventId=el('ppSource').value;cmd.confirmUnpaidProfit=el('ppProfitConfirmed').checked;if(!cmd.sourceEventId)throw Error('請選擇盈餘來源');}
   if(kind==='withdraw'&&!confirm('確認已交付玩家 '+cash(cmd.amount)+' 寄存金？'))return;
   if(kind==='profitCash'&&!confirm('確認已將 '+cash(cmd.amount)+' 盈餘現金交付玩家？'))return;
   await run(cmd);
  }catch(err){setStatus(err.message||String(err),true);}
 }
 async function clearAll(unused,id){
  if(busy)return;try{
   ensure();const rows=pending(id),total=rows.reduce((n,r)=>n+r.due,0),wallet=ledger(id).wallet;
   if(!total)return actionMsg('此玩家沒有未結帳款');
   const used=Math.min(total,wallet),rest=total-used;
   if(!confirm(name(id)+' 尚欠 '+cash(total)+'\n寄存金抵扣 '+cash(used)+'，其餘 '+cash(rest)+' 記為現金收款。\n確認已收到現金後再按確定。'))return;
   await run({kind:'settleAll',memberId:id,eventIds:events().filter(e=>player(e,id)).map(e=>String(e.id)),expectedDue:total,note:'寄存金優先，其餘現金結清'});
  }catch(err){setStatus(err.message||String(err),true);}
 }
 async function removeAccount(unused,id){
  if(busy)return;
  try{
   ensure();const s=ledger(id),debts=pending(id);
   if(s.wallet||debts.length)throw Error('此玩家還有寄存金或未結清款項，請先處理餘額再刪除');
   if(!confirm('將 '+name(id)+' 從玩家帳務名單刪除？\n原始收付款紀錄會保留；之後新增帳務會重新顯示。'))return;
   await run({kind:'archive',memberId:String(id),eventIds:events().filter(e=>player(e,id)).map(e=>String(e.id)),note:'從玩家帳務名單刪除，保留歷史紀錄'});
   if(selection?.memberId===String(id)){el('ppDialog').close();selection=null;}
   renderPage();
  }catch(err){setStatus(err.message||String(err),true);}
 }
 async function undo(id){if(!selection||busy||!confirm('撤銷此筆付款／寄存紀錄？相關餘額會一起回復。'))return;try{await run({kind:'void',memberId:selection.memberId,targetId:id});}catch(err){setStatus(err.message,true);}}
 function registrationPrice(){
  if(!registration)return null;const e=findEvent(registration.eventId);if(!e)throw Error('找不到本場賽事');
  const manual=Number(el('ppRegManual').value||0);if(!Number.isSafeInteger(manual)||manual<0)throw Error('手動優惠須為非負整數');
  const p={buyin:1,rebuy:0,addon:0,earlyBird:el('ppRegEarly').checked,lateBird:el('ppRegLate').checked,ladies:el('ppRegLadies').checked,manualDiscount:manual};
  const c=calcPlayerForEvent(p,e),base=calcPlayerForEvent({...p,earlyBird:false,lateBird:false,ladies:false,manualDiscount:0},e).paid;
  if(manual+Number(c.earlyDiscount||0)+Number(c.lateDiscount||0)+Number(c.ladiesDiscount||0)>base)throw Error('優惠總額不能超過買入金額');
  return {e,p,c,base};
 }
 function registrationPreview(changed){
  if(!registration)return;
  if(changed==='early'&&el('ppRegEarly').checked)el('ppRegLate').checked=false;
  if(changed==='late'&&el('ppRegLate').checked)el('ppRegEarly').checked=false;
  try{
   const {c}=registrationPrice(),wallet=ledger(registration.memberId).wallet,used=Math.min(wallet,c.paid),cashDue=c.paid-used;
   el('ppRegTotal').textContent=cash(c.paid);
   el('ppRegBreakdown').textContent='優惠合計 '+cash(c.totalDiscount)+'｜寄存金抵扣 '+cash(used)+'｜'+(el('ppRegistrationPaid').checked?'本次收款 ':'尚待收款 ')+cash(cashDue);
   el('ppRegStatus').textContent='';el('ppRegConfirm').disabled=registrationSaving||busy;
  }catch(err){el('ppRegStatus').textContent=err.message;el('ppRegConfirm').disabled=true;}
 }
 function cancelRegistration(){if(registrationSaving||busy)return;registration=null;el('ppRegistrationDialog').close();}
 function add(){
  if(busy||registrationSaving)return;
  try{
   ensure();const e=currentEvent(),id=el('addPlayerMember').value,m=members().find(x=>String(x.id)===String(id));
   if(!e||!m)throw Error('請先搜尋並選擇會員');
   if(['settled','已結算'].includes(e.status))throw Error('此賽事已結算，不能加入玩家');
   if(player(e,id))throw Error('此玩家已在本場');
   registration={eventId:String(e.id),memberId:String(id)};
   const base=calcPlayerForEvent({buyin:1,rebuy:0,addon:0,manualDiscount:0},e).paid;
   const ladies=e.ladiesDiscount??Math.floor(Number((e.pricingMode==='custom'?e.buyinAdmin:e.admin)||0)/2);
   el('ppRegistrationTitle').textContent=name(id)+'｜加入本場';
   el('ppRegistrationBody').innerHTML=`<p>${esc(businessDateForEvent(e))}｜${esc(eventDisplayName_(e))}</p><label>應付金額（本場買入）</label><input aria-label="應付金額" readonly value="${cash(base)}"><div class="pp-reg-discounts"><label><input type="checkbox" id="ppRegEarly" onchange="PP.registrationPreview('early')">早鳥 −${cash(e.earlyBirdDiscount)}</label><label><input type="checkbox" id="ppRegLate" onchange="PP.registrationPreview('late')">晚鳥 −${cash(e.lateBirdDiscount)}</label><label><input type="checkbox" id="ppRegLadies" onchange="PP.registrationPreview('ladies')">女士 −${cash(ladies)}</label></div><p class="small">早鳥、晚鳥擇一；女士與手動優惠另計。各優惠每場折一次。</p><div class="formgrid" style="grid-template-columns:1fr 1fr"><div><label>手動優惠</label><input id="ppRegManual" type="number" min="0" step="1" value="0" oninput="PP.registrationPreview()"></div><div><label>本場結帳群組</label><input id="addPlayerGroup" value="${esc(m.group||'')}" placeholder="可留白"></div></div><label style="margin-top:16px">實際支付金額</label><div class="pp-reg-total" id="ppRegTotal"></div><p id="ppRegBreakdown" class="small"></p><label style="display:flex;align-items:center;gap:8px"><input id="ppRegistrationPaid" type="checkbox" onchange="PP.registrationPreview()">已收到本次應收款（寄存金會優先抵扣）</label><div class="toolbar"><button class="primary" id="ppRegConfirm" data-pp-action onclick="PP.confirmRegistration()">確認加入本場</button></div><div id="ppRegStatus" class="pp-reg-feedback" role="status"></div>`;
   el('addPlayerMember').hidden=true;registrationPreview();el('ppRegistrationDialog').showModal();
  }catch(err){actionMsg(err.message||String(err),true);}
 }
 async function confirmRegistration(){
  if(!registration||busy||registrationSaving)return;
  let saved=false;
  try{
   ensure();const {e,p,c}=registrationPrice(),id=registration.memberId,m=members().find(x=>String(x.id)===id),wasPaid=el('ppRegistrationPaid').checked;
   if(!m)throw Error('找不到會員');
   const group=el('addPlayerGroup').value.trim()||m.group||'';
   registrationSaving=true;el('ppRegConfirm').disabled=true;el('ppRegConfirm').textContent='加入中…';el('ppRegStatus').textContent='正在儲存報名與付款，請稍候…';
   if(typeof EPC_FIRESTORE_EVENT_SAVE_TIMERS!=='undefined'){
    const t=EPC_FIRESTORE_EVENT_SAVE_TIMERS.get(String(e.id));if(t){clearTimeout(t);EPC_FIRESTORE_EVENT_SAVE_TIMERS.delete(String(e.id));await syncEventToFirestore_(e,true);}
   }
   await run({kind:'add',memberId:id,eventId:String(e.id),paidNow:wasPaid,expectedCharge:c.paid,player:{...p,nickname:m.nickname||'',group},note:wasPaid?'依優惠後金額報名收款，寄存金優先抵扣':'依優惠後金額報名待收，寄存金優先抵扣'});
   saved=true;registration=null;el('ppRegistrationDialog').close();
   if(el('addPlayerSearch'))el('addPlayerSearch').value='';
   if(typeof filterAddPlayerMembers==='function')filterAddPlayerMembers('');
   actionMsg('已加入本場');
  }catch(err){el('ppRegStatus').textContent=err.message||String(err);}
  finally{
   registrationSaving=false;
   if(!saved&&el('ppRegConfirm')){el('ppRegConfirm').disabled=false;el('ppRegConfirm').textContent='確認加入本場';}
   if(saved)el('addPlayerSearch')?.focus();
  }
 }
 async function edit(e,id,field,value,increment=false){
  if(busy){actionMsg('帳務儲存中，請稍候再操作',true);refresh();return;}
  try{
   ensure();const p=player(e,id);if(!p)throw Error('找不到玩家');
   if(typeof EPC_FIRESTORE_EVENT_SAVE_TIMERS!=='undefined'){const t=EPC_FIRESTORE_EVENT_SAVE_TIMERS.get(String(e.id));if(t){clearTimeout(t);EPC_FIRESTORE_EVENT_SAVE_TIMERS.delete(String(e.id));await syncEventToFirestore_(e,true);}}
   const bool=['earlyBird','lateBird','ladies'].includes(field),baseline=p[field]??(bool?false:0);
   await run({kind:'change',memberId:String(id),eventId:String(e.id),field,baseline,value:bool?!!value:Number(value),increment});
  }catch(err){setStatus(err.message||String(err),true);refresh();}
 }
 const autoSeen=new Map();
 function scheduleAuto(){clearTimeout(autoTimer);autoTimer=setTimeout(async()=>{
  if(!loaded||busy||uncertain||!window.EPCFirestore?.accountingReady)return;
  for(const e of events())for(const p of e.players||[]){
   const s=ledger(p.memberId),v=info(e,p),key=String(e.id)+'|'+String(p.memberId),sig=[s.revision,v.charge,v.due,s.wallet].join(':');
   if(!v.due||(!s.accounts[String(e.id)]&&!legacyDue(p))||autoSeen.get(key)===sig)continue;
   if(s.accounts[String(e.id)]&&!s.wallet)continue;
   autoSeen.set(key,sig);
   try{await run({kind:'reconcile',eventId:String(e.id),memberId:String(p.memberId),note:'自動檢查欠款並使用寄存金'});}catch(err){autoSeen.delete(key);return;}
   return;
  }
 },250);}
 window.PP={registrationPreview,confirmRegistration,cancelRegistration,open,clearAll,removeAccount,undo,submit,methodChanged,nameCell,amountCell,rebuyCell,renderPage,refresh,pending,info,renderPending,
  retryPending:async()=>{if(!uncertain||busy)return;try{await run(uncertain.command);}catch(err){setStatus(err.message,true);}},
  increment:(e,id)=>edit(findEvent(e),id,'rebuy',0,true),
  openMember:()=>{const id=actResolveMember_('ppMember');if(!members().some(m=>String(m.id)===String(id)))return actionMsg('請選擇會員',true);open('',id);}
 };
 // The existing table retains editable numeric inputs; only money-related changes use transactions.
 window.addPlayer=add;
 const originalSetP=setP;
 window.setP=(i,k,v)=>{if(['buyin','rebuy','addon','manualDiscount','earlyBird','lateBird','ladies'].includes(k)){const e=currentEvent(),p=e?.players?.[i];if(p)return edit(e,p.memberId,k,v);}else return originalSetP(i,k,v);};
 window.openPlayerCheckout_=id=>open(currentEvent()?.id||'',id);
 window.renderEventUnpaidStatus_=renderPending;
 for(const fn of ['removePlayerSafe','removePlayerByIndex','delP']){
  const original=window[fn];if(typeof original!=='function')continue;
  window[fn]=function(arg){const e=currentEvent(),p=fn==='removePlayerSafe'?player(e,arg):e?.players?.[Number(arg)];if(p&&ledger(p.memberId).accounts[String(e.id)])return actionMsg('此玩家已有帳務紀錄；請先將買入／重買改為 0，再處理溢付與撤銷付款，保留紀錄供查核。',true);return original(arg);};
 }
 window.addEventListener('epcPlayerPayments',ev=>{
  if(!ev.detail?.connected)state.clear();
  for(const x of ev.detail?.rows||[]){const old=state.get(String(x.memberId));if(!old||Number(x.revision)>=Number(old.revision))state.set(String(x.memberId),x);}
  loaded=!!ev.detail?.connected;refresh();scheduleAuto();
 });
 window.addEventListener('epcFirestoreEvents',()=>{renderPending();if(el('playerpayments')?.classList.contains('active'))renderPage();scheduleAuto();});
 el('ppRegistrationDialog').addEventListener('cancel',ev=>{if(registrationSaving||busy)ev.preventDefault();else registration=null;});
 document.addEventListener('click',ev=>{if(!ev.target.closest('.pp-search-box'))el('addPlayerMember').hidden=true;});
 if(window.EPCFirestore?.accountingReady){for(const x of window.EPC_PLAYER_PAYMENT_ROWS||[])state.set(String(x.memberId),x);loaded=true;}
 renderPage();refresh();scheduleAuto();
})();
