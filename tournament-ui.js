/* Tournament fields use the existing event persistence and Firestore patch flow. */
function epcTournamentFields_(){
 const m=$('eTournamentMode')?.value||'normal';
 $('guaranteedFields').hidden=m!=='guaranteed';
 document.querySelectorAll('.tournamentFields').forEach(el=>el.hidden=m!=='tournament');
 for(const id of ['eJP','eJPRound','ePayout'])if($(id))$(id).parentElement.hidden=m==='tournament';
}
function epcRankPlan_(e){return EPCTournament.schedule(e,poolInfoForEvent(e).avail)}
function epcRankValidation_(e){
 const total=(e.players||[]).reduce((s,p)=>s+(+p.prize||0),0);
 try{
  const plan=epcRankPlan_(e),seen=new Set();
  for(const p of e.players||[]){const rank=Number(p.finishRank||0);if(rank&&(!Number.isInteger(rank)||rank<1||rank>e.players.length||seen.has(rank)))throw Error('名次須為有效整數且不能重複');if(rank)seen.add(rank);
   const expected=plan.rows.find(r=>r.rank===rank)?.prize||0;
   if(Number(p.prize||0)!==expected)throw Error('名次或獎池已變更，請重新計算名次獎金');
  }
  if(plan.rows.length>e.players.length)throw Error('ITM 人數不能超過參賽人數');
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
  if(plan.rows.length>e.players.length)throw Error('ITM 人數不能超過參賽人數');
  for(const p of e.players){const r=Number(p.finishRank||0);if(r&&(!Number.isInteger(r)||r<1||r>e.players.length||seen.has(r)))throw Error('名次須為有效整數且不能重複');if(r)seen.add(r)}
  if(plan.rows.some(r=>!seen.has(r.rank)))throw Error('請先填妥全部 ITM 名次');
  e.players.forEach(p=>p.prize=plan.rows.find(r=>r.rank===Number(p.finishRank))?.prize||0);
  touchEvent_(e);persist();render();
 }catch(err){alert(err.message)}
}
function epcRenderModeSummary_(e){
 const el=$('tournamentModeSummary');if(!el)return;
 const mode=EPCTournament.mode(e),info=poolInfoForEvent(e);
 if(mode==='normal'){el.textContent='一般限時：依實際剩餘籌碼比例分配可發獎池。';return}
 if(mode==='guaranteed'){
  el.textContent='限時保底｜保證可發 '+money(e.guaranteedPool)+'｜買入累積（扣 JP 後）'+money(info.earned)+'｜店家補足 '+money(info.overlay)+'｜本場可發 '+money(info.avail)+'。按實點籌碼總和分配；保底不增加桌上籌碼。';return;
 }
 const locked=e.status==='已結算'||e.status==='settled';
 try{const plan=epcRankPlan_(e),admin=e.players.reduce((s,p)=>s+calcPlayerForEvent(p,e).netAdmin,0);
  el.innerHTML='<h3>一般錦標賽｜名次獎金</h3><div>總獎池 '+money(info.avail)+'｜實收行政費 '+money(admin)+'｜ITM '+plan.rows.length+' 人｜發放合計 '+money(plan.total)+'｜向下取整餘額 '+money(plan.remainder)+'（獨立列帳，不自動計為行政費）</div><div style="display:flex;gap:16px;flex-wrap:wrap;margin:12px 0">'+plan.rows.map(r=>'<span>第 '+r.rank+' 名：<b>'+money(r.prize)+'</b></span>').join('')+'</div><div class="small">填入玩家最終名次後，按「依名次計算獎金」。淘汰玩家不需要保留籌碼。獎金表會同步至本場計時器，每 8 秒輪播一頁。</div><div id="tournamentRankRows"></div>';
  const box=$('tournamentRankRows');e.players.forEach((p,i)=>{const row=document.createElement('label');row.style.cssText='display:inline-flex;gap:10px;align-items:center;margin:8px';const name=document.createElement('span'),m=db.members.find(m=>String(m.id)===String(p.memberId));name.textContent=m?.name||p.name||p.memberId;const input=document.createElement('input');input.type='number';input.min='0';input.max=e.players.length;input.value=p.finishRank||'';input.placeholder='名次';input.style.width='90px';input.disabled=locked;input.onchange=()=>epcSetFinishRank_(i,input.value);row.append(name,input);box.append(row)})
 }catch(err){el.textContent='名次獎金設定：'+err.message}
}
