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
  for(const p of e.players||[]){const rank=Number(p.finishRank||0);if(rank&&(!Number.isInteger(rank)||rank<1||rank>e.players.length||seen.has(rank)))throw Error('名次須為有效整數且不能重複');if(rank)seen.add(rank);
   const expected=plan.rows.find(r=>r.rank===rank)?.prize||0;
   if(Number(p.prize||0)!==expected)throw Error('名次或獎池已變更，請重新計算名次獎金');
  }
  if(plan.rows.length>e.players.length)throw Error('依組數計算的 ITM 超過參賽人數，請調整 ITM %');
  if(plan.rows.some(r=>!seen.has(r.rank)))throw Error('請填妥全部 ITM 名次並計算獎金');
  return {ok:true,total,target:plan.total,diff:0,message:'名次獎金正確；取整餘額轉入行政費 '+money(plan.remainder)};
 }catch(err){return {ok:false,total,target:0,diff:0,message:err.message}}
}
function epcTournamentSave_(e){touchEvent_(e);persist();render();}
function epcCloseTournamentBuyin_(){
 const e=currentEvent();if(!e||e.payoutSnapshot?.lockedAt||['已結算','settled'].includes(e.status))return;
 try{const plan=epcRankPlan_(e),info=poolInfoForEvent(e),itm=EPCTournament.itm(e);
 if(!plan.rows.length)throw Error('本場尚無買入組數');
 if(plan.rows.length>e.players.length)throw Error('錢圈超過參賽人數，請調整 ITM');
 if(plan.rows.some(r=>r.prize<=0))throw Error('獎池不足以分配全部錢圈');
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
 if(!confirm('確認已發放第 '+p.finishRank+' 名獎金 '+money(p.prize)+'？'))return;
 p.prizePaidAt=Date.now();epcTournamentSave_(e);
}
function epcAssignRankPrizes_(){
 const e=currentEvent();if(!e||['已結算','settled'].includes(e.status))return;
 if(!e.payoutSnapshot?.lockedAt)return alert('請先截止買入並鎖定獎金表');
 const plan=epcRankPlan_(e);e.players.forEach(p=>{if(!p.prizePaidAt)p.prize=plan.rows.find(r=>r.rank===Number(p.finishRank))?.prize||0});epcTournamentSave_(e);
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
 try{const plan=epcRankPlan_(e),itm=e.payoutSnapshot?.itm||EPCTournament.itm(e),paid=e.players.reduce((s,p)=>s+(p.prizePaidAt?Number(p.prize)||0:0),0),fees=e.players.reduce((s,p)=>s+calcPlayerForEvent(p,e).netAdmin,0);
 el.innerHTML='<h3>一般錦標賽｜'+(closed?'已截止買入・正式獎金表':'報名中・獎金表預覽')+'</h3><p>總獎池 '+money(closed?plan.total+plan.remainder:info.unroundedAvail??info.avail)+'｜'+itm.entries+' 組｜錢圈 '+plan.rows.length+' 人｜保證冠軍 '+money(e.guaranteedChampion||0)+'</p><p>協會補貼 '+money(e.payoutSnapshot?.overlay??info.overlay)+'｜行政費 '+money(fees)+'｜取整餘額 '+money(plan.remainder)+'｜預估賽事損益 '+money(fees+plan.remainder-(e.payoutSnapshot?.overlay??info.overlay))+'</p><p>已發放 '+money(paid)+'｜待發放 '+money(plan.total-paid)+'</p><div class="toolbar"><button id="tourClose" class="primary"></button></div><table><thead><tr><th>名次</th><th>獎金</th><th>狀態</th></tr></thead><tbody>'+plan.rows.map(r=>{const p=e.players.find(p=>Number(p.finishRank)===r.rank);return '<tr><td>第 '+r.rank+' 名</td><td>'+money(r.prize)+'</td><td>'+(p?.prizePaidAt?'已發放':p?'待發放':'待產生')+'</td></tr>'}).join('')+'</tbody></table><p class="small">'+(closed?'正式獎金表已鎖定並同步計時器。逐一登記淘汰名次即可發獎。':'截止買入時鎖定錢圈與全部名次獎金，再公布給玩家。')+'</p><div id="tournamentRankRows"></div>';
 const button=$('tourClose');button.textContent=closed?'重新開放買入':'截止買入・鎖定並公布獎金表';button.disabled=locked;button.onclick=closed?epcReopenTournamentBuyin_:epcCloseTournamentBuyin_;
 const box=$('tournamentRankRows');e.players.forEach((p,i)=>{const row=document.createElement('div');row.style.cssText='display:flex;gap:12px;align-items:center;margin:10px 0';const name=document.createElement('span'),m=db.members.find(m=>String(m.id)===String(p.memberId));name.textContent=m?.name||p.name||p.memberId;const input=document.createElement('input');input.type='number';input.min=0;input.max=e.players.length;input.value=p.finishRank||'';input.placeholder='淘汰名次';input.style.width='110px';input.disabled=locked||!closed||!!p.prizePaidAt;input.onchange=()=>epcSetFinishRank_(i,input.value);const award=document.createElement('span');award.textContent=money(p.prize||0);const pay=document.createElement('button');pay.textContent=p.prizePaidAt?'已發放':'確認已發放';pay.disabled=locked||!closed||!p.prize||!!p.prizePaidAt;pay.onclick=()=>epcMarkTournamentPaid_(i);row.append(name,input,award,pay);box.append(row)});
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
