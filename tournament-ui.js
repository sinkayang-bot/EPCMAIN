/* Tournament fields use the existing event persistence and Firestore patch flow. */
function epcTournamentFields_(){
 const m=$('eTournamentMode')?.value||'normal',tour=m==='tournament';
 $('guaranteedFields').hidden=m==='normal';
 document.querySelectorAll('.tournamentFields').forEach(el=>el.hidden=!tour);
 for(const id of ['ePricingMode','eLevel','eJP','eJPRound','ePayout'])if($(id))$(id).parentElement.hidden=tour;
 document.querySelectorAll('.standardPricing,.customPricing').forEach(el=>el.hidden=tour);
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
 $('newTimedPool').value=3000;$('newTimedAdmin').value=400;$('newTournamentMode').value='normal';$('newGuaranteedPool').value=18000;$('newItmPercent').value=15;
 for(const [id,value] of [['newTourBuyPool',1000],['newTourBuyFee',200],['newTourRePool',1000],['newTourReFee',200]])$(id).value=value;
 epcNewModeFields_();
}
function epcNewModeSettings_(){
 const mode=$('newTournamentMode').value,guaranteedPool=Number($('newGuaranteedPool').value);
 if(mode!=='normal'&&(!Number.isFinite(guaranteedPool)||guaranteedPool<0||(mode==='guaranteed'&&guaranteedPool===0)))throw Error('保底獎金須為非負數');
 const result={tournamentMode:mode,guaranteedPool:mode==='normal'?0:guaranteedPool};
 if(mode==='tournament'){
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
  return {ok:true,total,target:plan.total,diff:0,message:'名次獎金正確；百位取整餘額 '+money(plan.remainder)};
 }catch(err){return {ok:false,total,target:0,diff:0,message:err.message}}
}
function epcSetFinishRank_(index,value){
 const e=currentEvent();if(!e||e.status==='已結算'||e.status==='settled')return;
 e.players[index].finishRank=Math.max(0,Math.floor(Number(value)||0));e.players.forEach(p=>p.prize=0);
 touchEvent_(e);persist();render();
}
function epcAssignRankPrizes_(){
 const e=currentEvent();if(!e||e.status==='已結算'||e.status==='settled')return;
 try{
  const plan=epcRankPlan_(e),seen=new Set();
  if(!plan.rows.length)throw Error('本場尚無買入組數');
  if(plan.rows.length>e.players.length)throw Error('依組數計算的 ITM 超過參賽人數，請調整 ITM %');
  for(const p of e.players){const r=Number(p.finishRank||0);if(r&&(!Number.isInteger(r)||r<1||r>e.players.length||seen.has(r)))throw Error('名次須為有效整數且不能重複');if(r)seen.add(r)}
  if(plan.rows.some(r=>!seen.has(r.rank)))throw Error('請先填妥全部 ITM 名次');
  e.players.forEach(p=>p.prize=plan.rows.find(r=>r.rank===Number(p.finishRank))?.prize||0);
  touchEvent_(e);persist();render();
 }catch(err){alert(err.message)}
}
function epcRenderModeSummary_(e){
 const el=$('tournamentModeSummary');if(!el)return;
 const mode=EPCTournament.mode(e),info=poolInfoForEvent(e);
 if(mode==='normal'){epcSettlementModeEditor_(e);return}
 if(mode==='guaranteed'){epcSettlementModeEditor_(e);return}
 const locked=e.status==='已結算'||e.status==='settled';
 try{const plan=epcRankPlan_(e),itm=EPCTournament.itm(e),admin=e.players.reduce((s,p)=>s+calcPlayerForEvent(p,e).netAdmin,0);
  el.innerHTML='<h3>一般錦標賽｜名次獎金</h3><div>實際累積獎池 '+money(info.unroundedAvail??info.avail)+'｜總可發獎金（百位整數）'+money(info.avail)+'｜實收行政費 '+money(admin)+'｜ITM '+plan.rows.length+' 人（'+itm.entries+' 組 × '+(itm.percent??'舊制固定人數')+'% 無條件進位）｜保底 '+money(e.guaranteedPool)+'｜店家補足 '+money(info.overlay)+'｜發放合計 '+money(plan.total)+'｜向下取整餘額 '+money(plan.remainder)+'（獨立列帳，不自動計為行政費）</div><div style="display:flex;gap:16px;flex-wrap:wrap;margin:12px 0">'+plan.rows.map(r=>'<span>第 '+r.rank+' 名：<b>'+money(r.prize)+'</b></span>').join('')+'</div><div class="small">填入玩家最終名次後，按「依名次計算獎金」。淘汰玩家不需要保留籌碼。獎金表會同步至本場計時器，每 8 秒輪播一頁。</div><div id="tournamentRankRows"></div>';
  const box=$('tournamentRankRows');e.players.forEach((p,i)=>{const row=document.createElement('label');row.style.cssText='display:inline-flex;gap:10px;align-items:center;margin:8px';const name=document.createElement('span'),m=db.members.find(m=>String(m.id)===String(p.memberId));name.textContent=m?.name||p.name||p.memberId;const input=document.createElement('input');input.type='number';input.min='0';input.max=e.players.length;input.value=p.finishRank||'';input.placeholder='名次';input.style.width='90px';input.disabled=locked;input.onchange=()=>epcSetFinishRank_(i,input.value);row.append(name,input);box.append(row)})
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
