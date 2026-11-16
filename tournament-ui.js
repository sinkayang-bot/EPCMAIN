/* Tournament fields use the existing event persistence and Firestore patch flow. */
function epcTournamentFields_(){
 const m=$('eTournamentMode')?.value||'normal',tour=m==='tournament';
 $('guaranteedFields').hidden=m==='normal';
 document.querySelectorAll('.tournamentFields').forEach(el=>el.hidden=!tour);
 for(const id of ['ePricingMode','eLevel','eJP','eJPRound','ePayout'])if($(id))$(id).parentElement.hidden=tour;
 document.querySelectorAll('.standardPricing,.customPricing').forEach(el=>el.hidden=tour);
 if($('eventTimedPricing'))$('eventTimedPricing').hidden=tour;
 if($('eventTourPricing'))$('eventTourPricing').hidden=!tour;
 if($('ePayout'))$('ePayout').parentElement.hidden=true;
 if($('eventModeDescription'))$('eventModeDescription').textContent=tour?'按名次發放獎金｜買入與重買分開設定｜不抽 JP':m==='guaranteed'?'依籌碼比例分獎｜不足保底自動補足，超過則按實際獎池':'依籌碼比例分獎｜沿用一般限時買入、折扣與 JP 規則';
}
function epcNewModeFields_(){
 const mode=$('newTournamentMode').value,tour=mode==='tournament';
 $('newGuaranteeFields').hidden=mode==='normal';
 document.querySelectorAll('.newTournamentFields').forEach(el=>el.hidden=!tour);
 document.querySelectorAll('.newTimedFields').forEach(el=>el.hidden=tour);
 $('newModeHint').textContent=tour?'買入、重買分別設定進獎池＋行政費；不抽 JP。ITM 依總買入組數無條件進位。':mode==='guaranteed'?'依實際剩餘籌碼分配；不足保底時自動計算店家補足金額。':'沿用一般限時錦標賽的買入、重買折扣與 JP 規則。';
 const name=$('newEventName');if(!name.value||name.value===name.dataset.defaultName){const e=blankEvent();e.tournamentMode=mode;const value=mode==='tournament'?'EPC 一般賽事':mode==='guaranteed'?'EPC 保底限時':eventDisplayName_(e);name.value=value;name.dataset.defaultName=value;}
}
function epcResetNewMode_(){
 $('newGuaranteedChampion').value='';$('newTimedPool').value=3000;$('newTimedAdmin').value=400;$('newTournamentMode').value='normal';$('newGuaranteedPool').value=18000;$('newItmPercent').value=15;
 for(const [id,value] of [['newTourBuyPool',1000],['newTourBuyFee',200],['newTourRePool',1000],['newTourReFee',200]])$(id).value=value;
 epcNewModeFields_();
}
function epcNewModeSettings_(){
 const mode=$('newTournamentMode').value,guaranteedPool=Number($('newGuaranteedPool').value);
 if(mode!=='normal'&&(!Number.isFinite(guaranteedPool)||guaranteedPool<0||(mode==='guaranteed'&&guaranteedPool===0)))throw Error('保底獎金須為非負數');
 const result={tournamentMode:mode,guaranteedPool:mode==='normal'?0:guaranteedPool};
 if(mode==='tournament'){
  result.guaranteedChampion=Math.max(0,Number($('newGuaranteedChampion').value)||0);
  result.itmPercent=Number($('newItmPercent').value);EPCTournament.itm(result);
  const nums=['newTourBuyPool','newTourBuyFee','newTourRePool','newTourReFee'].map(id=>Number($(id).value));
  if(nums.some(x=>!Number.isFinite(x)||x<0))throw Error('買入與重買金額須為非負數');
  const [bp,bf,rp,rf]=nums;
  Object.assign(result,{pricingMode:'custom',poolUnit:bp,admin:bf,buyinTotal:bp+bf,buyinAdmin:bf,rebuyTotal:rp+rf,rebuyAdmin:rf,jp:0,itmCount:0,payoutPercentages:'',level:bp+bf,name:'EPC 一般賽事'});
 }else{const pool=Number($('newTimedPool').value),fee=Number($('newTimedAdmin').value);if(!Number.isFinite(pool)||!Number.isFinite(fee)||pool<0||fee<0)throw Error('進獎池與行政費須為非負數');Object.assign(result,{poolUnit:pool,admin:fee,level:pool+fee,buyinTotal:pool+fee,buyinAdmin:fee,rebuyTotal:pool+fee,rebuyAdmin:fee});if(mode==='guaranteed')result.name='EPC 保底限時';}
 return result;
}
function epcRankPlan_(e){const info=poolInfoForEvent(e);return EPCTournament.schedule(e,info.unroundedAvail??info.avail)}
function epcRankValidation_(e){
 const total=(e.players||[]).reduce((s,p)=>s+(+p.prize||0),0);
 try{
  const plan=epcRankPlan_(e),seen=new Set();
  if(!plan.rows.length)throw Error('本場尚無買入組數');
  if(plan.total<poolInfoForEvent(e).avail)throw Error('完整獎池尚未分配到各名次，不能發獎');
  for(const p of e.players||[]){const rank=Number(p.finishRank||0);if(rank&&(!Number.isInteger(rank)||rank<1||rank>e.players.length||seen.has(rank)))throw Error('名次須為有效整數且不能重複');if(rank)seen.add(rank);
   const expected=plan.rows.find(r=>r.rank===rank)?.prize||0;
   if(Number(p.prize||0)!==expected)throw Error('名次或獎池已變更，請重新計算名次獎金');
  }
  if(plan.rows.length>e.players.length)throw Error('依組數計算的 ITM 超過參賽人數，請調整 ITM %');
  if(plan.rows.some(r=>!seen.has(r.rank)))throw Error('請填妥全部 ITM 名次並計算獎金');
  return {ok:true,total,target:plan.total,diff:0,message:'全部獎金已分配，各名次合計 '+money(plan.total)};
 }catch(err){return {ok:false,total,target:0,diff:0,message:err.message}}
}
function epcTournamentSave_(e){touchEvent_(e);persist();render();}
function epcCloseTournamentBuyin_(){
 const e=currentEvent();if(!e||e.payoutSnapshot?.lockedAt||['已結算','settled'].includes(e.status))return;
 try{const plan=epcRankPlan_(e),info=poolInfoForEvent(e),itm=EPCTournament.itm(e);
 if(!plan.rows.length)throw Error('本場尚無買入組數');
 if(plan.rows.length>e.players.length)throw Error('錢圈超過參賽人數，請調整 ITM');
 if(plan.rows.some(r=>r.prize<=0))throw Error('獎池不足以分配全部錢圈');
 if(plan.total!==info.avail)throw Error('獎金表必須先分配完整實發獎池，才能截止買入並開放領獎');
 if(!confirm('截止買入並公布 '+plan.rows.length+' 個錢圈、鎖定各名次獎金？'))return;
 e.payoutSnapshot={lockedAt:Date.now(),plan,itm,gross:info.gross,overlay:info.overlay};
 epcTournamentSave_(e);
 }catch(err){alert(err.message)}
}
function epcReopenTournamentBuyin_(){
 const e=currentEvent();if(!e||['已結算','settled'].includes(e.status))return;
 if(e.players.some(p=>p.prizePaidAt))return alert('已有獎金發放，不能重新開放買入');
 if(!confirm('重新開放買入將撤銷已公布獎金表，並清除尚未發放的名次獎金，確定繼續？'))return;
 e.payoutSnapshot=null;e.players.forEach(p=>{p.prize=0;p.finishRank=0});epcTournamentSave_(e);
}
function epcSetFinishRank_(index,value){
 const e=currentEvent();if(!e||['已結算','settled'].includes(e.status))return;
 const p=e.players[index];if(p.prizePaidAt)return alert('已發放獎金的玩家不能修改名次');
 if(!e.payoutSnapshot?.lockedAt)return alert('請先截止買入並鎖定獎金表');
 const rank=Number(value)||0;
 if(!Number.isInteger(rank)||rank<0||rank>e.players.length||rank&&e.players.some((p,i)=>i!==index&&Number(p.finishRank)===rank))return alert('名次須為有效整數且不能重複');
 p.finishRank=rank;p.prize=epcRankPlan_(e).rows.find(r=>r.rank===rank)?.prize||0;epcTournamentSave_(e);
}
function epcMarkTournamentPaid_(index){
 const e=currentEvent(),p=e?.players[index];if(!p||!e.payoutSnapshot?.lockedAt||!p.prize||p.prizePaidAt||['已結算','settled'].includes(e.status))return;
 if(epcRankPlan_(e).total<poolInfoForEvent(e).avail)return alert('獎池尚未完整分配，不能開始發獎');
 if(!confirm('確認已發放第 '+p.finishRank+' 名獎金 '+money(p.prize)+'？'))return;
 p.prizePaidAt=Date.now();epcTournamentSave_(e);
}
function epcAssignRankPrizes_(){
 const e=currentEvent();if(!e||['已結算','settled'].includes(e.status))return;
 if(!e.payoutSnapshot?.lockedAt)return alert('請先截止買入並鎖定獎金表');
 const plan=epcRankPlan_(e);e.payoutSnapshot.overlay=poolInfoForEvent(e).overlay;e.players.forEach(p=>{if(!p.prizePaidAt)p.prize=plan.rows.find(r=>r.rank===Number(p.finishRank))?.prize||0});epcTournamentSave_(e);
}
function epcUpdateAwardGuarantee_(){
 const e=currentEvent();if(!e||e.payoutSnapshot?.lockedAt||['已結算','settled'].includes(e.status))return alert('正式獎金表已鎖定，不能在發獎中變更保底');
 const value=Number($('tourGuaranteeSetup').value);if(!Number.isSafeInteger(value)||value<0||value%100)return alert('請輸入非負的整百保底金額');
 if(!confirm('將本場保底設定為 '+money(value)+'，重新計算完整實發獎金表？'))return;e.guaranteedPool=value;epcTournamentSave_(e);
}
function epcSetRankWinner_(rank,memberId){
 const e=currentEvent();if(!e||!e.payoutSnapshot?.lockedAt||['已結算','settled'].includes(e.status))return;
 const row=epcRankPlan_(e).rows.find(r=>r.rank===rank);if(!row)return;
 const old=e.players.find(p=>Number(p.finishRank)===rank),next=memberId?e.players.find(p=>String(p.memberId)===String(memberId)):null;
 if(old?.prizePaidAt)return alert('已發放的獎金不能更換得主');
 if(memberId&&!next)return alert('請選擇本場參賽玩家');
 if(next&&(next.prizePaidAt||epcRankPlan_(e).rows.some(r=>r.rank===Number(next.finishRank)&&r.rank!==rank)))return alert('此玩家已經有得獎名次');
 if(old){old.finishRank=0;old.prize=0}if(next){next.finishRank=rank;next.prize=row.prize}epcTournamentSave_(e);
}
function epcRepairGuarantee_(){
 const e=currentEvent();if(!e?.payoutSnapshot?.lockedAt||['已結算','settled'].includes(e.status))return;
 if(e.players.some(p=>p.prizePaidAt))return alert('已開始發獎，不能重新分配已公布獎金；請先核對已發放紀錄');
 try{const old=epcRankPlan_(e),plan=EPCTournament.completeGuarantee(e,old,e.players.filter(p=>p.prizePaidAt).map(p=>Number(p.finishRank)));if(!confirm('將已公布獎金由 '+money(old.total)+' 補足為 '+money(plan.total)+'，更新投影獎金表？已發放的名次維持原值。'))return;
 e.payoutSnapshot={...e.payoutSnapshot,plan,overlay:poolInfoForEvent(e).overlay,revisions:[...(e.payoutSnapshot.revisions||[]),{at:Date.now(),plan:old}]};e.payoutSnapshot.overlay=poolInfoForEvent(e).overlay;e.players.forEach(p=>{if(!p.prizePaidAt)p.prize=plan.rows.find(r=>r.rank===Number(p.finishRank))?.prize||0});epcTournamentSave_(e);
 }catch(err){alert(err.message)}
}
function epcRenderModeSummary_(e){
 const el=$('tournamentModeSummary');if(!el)return;
 const tour=EPCTournament.mode(e)==='tournament';
 // Separate tournament award workflow from timed chip settlement.
 for(const id of ['sJP','sStartingChips','sChipDiff'])if($(id))$(id).parentElement.hidden=tour;
 if($('settleTable'))$('settleTable').parentElement.hidden=tour;
 const sync=document.querySelector('[onclick="syncPhoneStacksOnly()"]');if(sync)sync.hidden=tour;
 if($('btnCalcICM'))$('btnCalcICM').hidden=tour;
 const heading=document.querySelector('#settle h2');if(heading)heading.textContent=tour?'錦標賽｜名次與發獎':'ICM / 結算';
 if(!tour){epcSettlementModeEditor_(e);return}
 const locked=['已結算','settled'].includes(e.status),closed=!!e.payoutSnapshot?.lockedAt,info=poolInfoForEvent(e);
 try{const plan=epcRankPlan_(e),itm=e.payoutSnapshot?.itm||EPCTournament.itm(e),paid=e.players.reduce((s,p)=>s+(p.prizePaidAt?Number(p.prize)||0:0),0),fees=e.players.reduce((s,p)=>s+calcPlayerForEvent(p,e).netAdmin,0)+EPCTournament.adminRemainder(e,info.gross),fund=EPCTournament.funding(e,info.gross,fees),short=plan.total<info.avail;
 el.innerHTML='<h3>一般錦標賽｜'+(locked?'已完成結算・正式獎金表':closed?'發獎結算中・正式獎金表':'報名中・獎金表預覽')+'</h3><p>保底 '+money(e.guaranteedPool)+'｜發獎合計 '+money(plan.total)+'｜'+itm.entries+' 組｜錢圈 '+plan.rows.length+' 人｜保證冠軍 '+money(e.guaranteedChampion||0)+'</p><p>玩家累積獎池 '+money(info.gross)+'｜需補足 '+money(fund.overlay)+'｜行政費補貼 '+money(fund.adminUsed)+'｜公司額外支出 '+money(fund.companyExpense)+'｜剩餘行政費 '+money(fund.adminRemaining)+'</p><p>已發放 '+money(paid)+'｜待發放 '+money(plan.total-paid)+'</p>'+(short?'<p class="neg">舊獎金表尚未分配完整獎池，發獎前必須先完成分配。</p><button id="tourRepair">完成獎金分配並更新獎金表</button>':'')+(!closed&&!locked?'<div class="toolbar"><label>本場保底（元） <input id="tourGuaranteeSetup" type="number" min="0" step="100" value="'+Number(e.guaranteedPool||0)+'"></label><button id="tourGuaranteeSave">儲存保底並重算獎金表</button></div>':'')+'<div class="toolbar"><button id="tourClose" class="primary"></button></div><p class="small">'+(closed?'依錢圈名次搜尋並指定得獎者，不需為其他玩家填寫名次。':'截止買入時鎖定全部名次獎金，先分配完整實發獎池，差額不轉行政費，確認後才開放發獎。')+'</p><div class="tablewrap"><table><thead><tr><th>名次</th><th>獎金</th><th>得獎玩家（可搜尋）</th><th>狀態</th><th>發獎</th></tr></thead><tbody id="tournamentRankRows"></tbody></table></div>';
 if($('tourGuaranteeSave'))$('tourGuaranteeSave').onclick=epcUpdateAwardGuarantee_;
 const button=$('tourClose');button.textContent=closed?'重新開放買入':'截止買入・鎖定並公布獎金表';button.disabled=locked;button.onclick=closed?epcReopenTournamentBuyin_:epcCloseTournamentBuyin_;if($('tourRepair')){$('tourRepair').disabled=locked||paid>0;$('tourRepair').onclick=epcRepairGuarantee_;}
 const box=$('tournamentRankRows');plan.rows.forEach(r=>{const winner=e.players.find(p=>Number(p.finishRank)===r.rank),row=document.createElement('tr');
 const cell=text=>{const td=document.createElement('td');td.textContent=text;row.append(td);return td};cell('第 '+r.rank+' 名');const amountCell=cell(money(r.prize));amountCell.style.cssText='font-weight:800;font-size:20px;white-space:nowrap';const picker=cell(''),search=document.createElement('input'),select=document.createElement('select');search.type='search';search.placeholder='搜尋姓名／綽號／會員編號';search.style.cssText='width:100%;min-width:200px;margin-bottom:6px';search.disabled=select.disabled=locked||!closed||!!winner?.prizePaidAt||short;
 const identity=p=>{const m=db.members.find(m=>String(m.id)===String(p.memberId))||{},number=typeof memberNumber_==='function'?memberNumber_(p.memberId):p.memberId;return {label:[m.nickname||m.name||p.name||p.memberId,'#'+number].join(' '),text:[m.name,m.nickname,p.name,p.memberId,number].join(' ').toLowerCase()}};
 function options(){select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='尚未指定得主';select.append(empty);const q=search.value.trim().toLowerCase();e.players.filter(p=>(!plan.rows.some(other=>other.rank===Number(p.finishRank))||Number(p.finishRank)===r.rank)&&(!q||identity(p).text.includes(q))).forEach(p=>{const option=document.createElement('option');option.value=String(p.memberId);option.textContent=identity(p).label;select.append(option)});select.value=winner?String(winner.memberId):'';}
 search.oninput=options;select.onchange=()=>epcSetRankWinner_(r.rank,select.value);options();picker.append(search,select);cell(winner?.prizePaidAt?'已發放':winner?'待發放':'待產生');const action=cell(''),pay=document.createElement('button');pay.type='button';pay.textContent=winner?.prizePaidAt?'已發放':'確認已發放';pay.disabled=locked||!closed||!winner||!!winner.prizePaidAt||short;pay.onclick=()=>epcMarkTournamentPaid_(e.players.indexOf(winner));action.append(pay);box.append(row)});
 }catch(err){el.textContent='名次獎金設定：'+err.message}
}

// Existing timed events can enable a guarantee directly at settlement.
function epcSettlementModeEditor_(e){
 const el=$('tournamentModeSummary');if(!el||EPCTournament.mode(e)==='tournament')return;
 const locked=e.status==='已結算'||e.status==='settled',mode=EPCTournament.mode(e),info=poolInfoForEvent(e);
 const title=document.createElement('h3');title.textContent='本場獎池設定';
 const form=document.createElement('div');form.className='formgrid';
 const modeLabel=document.createElement('label');modeLabel.textContent='賽事模式';
 const select=document.createElement('select');select.id='settlementTournamentMode';
 for(const [value,label] of [['normal','一般限時錦標賽'],['guaranteed','保底限時']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option)}
 select.value=mode;select.disabled=locked;modeLabel.append(select);
 const guaranteeLabel=document.createElement('label');guaranteeLabel.textContent='保底獎金';
 const input=document.createElement('input');input.id='settlementGuaranteedPool';input.type='number';input.min='1';input.step='100';input.placeholder='例如 18000';input.value=Number(e.guaranteedPool)>0?e.guaranteedPool:'';input.disabled=locked;guaranteeLabel.append(input);
 const toggle=()=>{guaranteeLabel.hidden=select.value!=='guaranteed'};select.onchange=toggle;toggle();
 const button=document.createElement('button');button.type='button';button.className='primary';button.textContent='儲存模式與保底金額';button.disabled=locked;button.onclick=()=>epcSaveSettlementMode_();
 form.append(modeLabel,guaranteeLabel,button);
 const explanation=document.createElement('div');explanation.className='small';explanation.style.marginTop='12px';explanation.textContent=mode==='guaranteed'?'保底 '+money(e.guaranteedPool)+'｜實際可發獎池（扣 JP 後）'+money(info.earned)+'｜店家補足 '+money(info.overlay)+'｜總可發獎金 '+money(info.avail)+'。未超過保底按保底計算，超過按實際可發獎池計算。':'這場目前未啟用保底。有保底請選「保底限時」，輸入金額並儲存，再重新計算玩家獎金。';
 el.replaceChildren(title,form,explanation);
}
async function epcSaveSettlementMode_(){
 const e=currentEvent();if(!e||e.status==='已結算'||e.status==='settled')return alert('請先解鎖賽事');
 const mode=$('settlementTournamentMode').value,guarantee=Number($('settlementGuaranteedPool').value);
 if(mode==='guaranteed'&&(!Number.isFinite(guarantee)||guarantee<=0))return alert('請輸入大於 0 的保底獎金');
 if(mode!=='normal'&&mode!=='guaranteed')return;
 const id=String(e.id);
 e.tournamentMode=mode;e.guaranteedPool=mode==='guaranteed'?guarantee:0;
 touchEvent_(e);persist();
 try{await syncEventToFirestore_(e,true);if(String(currentEvent()?.id)===id)render();actionMsg('模式與保底金額已儲存，請重新計算籌碼比例獎金');}
 catch(err){actionMsg('模式與保底同步失敗：'+String(err?.message||err),true)}
}
