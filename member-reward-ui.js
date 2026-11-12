(function(){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function config(){
  ensureActDb_();
  return {...EPCMemberReward.defaults,...db.activityManagement.memberReward};
 }
 function saveConfig(change){
  try{
   window.EPCMode?.assertWrite();
   if(!window.EPC_ACTIVITY_LOADED||typeof window.saveActivityCloudV3!=='function')throw Error('活動雲端資料尚未載入，請稍後再儲存');
   const next={...config(),...change};
   EPCMemberReward.score([],next);
   db.activityManagement.memberReward=next;
   persist();window.saveActivityCloudV3();renderActivities();
  }catch(error){alert(error.message);renderActivities();}
 }
 window.memberRewardSetDate_=function(field,value){if(['from','to'].includes(field))saveConfig({[field]:value});};
 window.memberRewardSetEarly_=function(select){
  const key=select.dataset.key,values={...(config().earlyOverrides||{})};
  if(select.value==='auto')delete values[key];else values[key]=select.value==='yes';
  saveConfig({earlyOverrides:values});
 };
 window.memberRewardStats_=function(){
  const c=config();
  const events=(db.events||[]).map(e=>({...e,businessDate:actBusinessDate_(e),memberRewardIndependent:isIndependentAccountingEvent(e)}));
  return {config:c,rows:EPCMemberReward.score(events,c,c)};
 };
 function identity(id){return typeof epcPlayerDisplayHtml_==='function'?epcPlayerDisplayHtml_(id):esc(id);}
 function detailTable(row,c){
  return '<details><summary>'+row.games+' 場明細'+(row.pending?'・'+row.pending+' 筆首場待確認':'')+'</summary><table><thead><tr><th>營業日／場次</th><th>級別</th><th>基本</th><th>首場</th><th>假日</th><th>合計</th><th>報名時間／首場確認</th></tr></thead><tbody>'+row.details.map(d=>{
   const event=(db.events||[]).find(e=>String(e.eventId||e.id)===d.eventId),title=event?eventDisplayName_(event):d.eventId;
   const override=c.earlyOverrides?.[d.overrideKey],value=typeof override==='boolean'?(override?'yes':'no'):'auto';
   const control=d.isFirst?'<select aria-label="首場時間加成確認" data-key="'+esc(d.overrideKey)+'" onchange="memberRewardSetEarly_(this)">'+[['auto','依報名時間'],['yes','確認符合時間'],['no','確認不符合時間']].map(([v,label])=>'<option value="'+v+'" '+(v===value?'selected':'')+'>'+label+'</option>').join('')+'</select>':'';
   return '<tr><td>'+esc(d.date)+'<div class="small">'+esc(title)+'</div></td><td>'+esc(d.level)+'</td><td>'+d.base+'</td><td>'+d.firstBonus+'</td><td>'+d.holidayBonus+'</td><td><b>'+d.points+'</b></td><td>'+esc(d.registeredTime||'未記錄報名時間')+(d.pending?'<div>待確認，首場加成暫未計入</div>':'')+control+'</td></tr>';
  }).join('')+'</tbody></table></details>';
 }
 window.actMemberReward_=function(){
  let data;try{data=memberRewardStats_();}catch(error){return '<div class="card">'+esc(error.message)+'</div>';}
  const c=data.config,all=data.rows,q=String(document.getElementById('actSearch')?.value||'').trim().toLowerCase();
  const rows=all.filter(row=>{
   const member=(db.members||[]).find(m=>String(m.id)===row.memberId)||{};
   return !q||[row.memberId,memberNumber_(row.memberId),member.name,member.nickname].some(v=>String(v||'').toLowerCase().includes(q));
  });
  const free=all.filter(row=>row.freeEntry).length,paid=all.filter(row=>row.canRegister&&!row.freeEntry).length,pending=all.reduce((n,row)=>n+row.pending,0);
  const status=row=>row.freeEntry?'首次免費參賽':row.canRegister?'可付費報名（1,000 元）':'距報名資格差 '+(21-row.points)+' 點';
  return '<div class="card"><h3>限時會員回饋賽｜累積點數</h3>'+
   '<div class="formgrid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))"><div><label>集點開始日</label><input type="date" value="'+esc(c.from)+'" onchange="memberRewardSetDate_(\'from\',this.value)"></div><div><label>集點結束日</label><input type="date" value="'+esc(c.to)+'" onchange="memberRewardSetDate_(\'to\',this.value)"></div></div>'+
   '<p>1200 每場 1 點，3400 每場 2 點，6600 以上每場 3 點。每位玩家每場計一次，重買與加購不另加點。</p>'+
   '<p>店內當日首場，平日 19:10 前報名 +1 點，假日 17:10 前報名 +2 點。假日每場再 +1 點，首場可疊加。</p>'+
   '<p><b>21 點以上可付費報名，超過 45 點首次免費參賽。</b>起始 20,000，超過 45 點每多 1 點 +500，含加成最高 30,000。點數為資格門檻，不扣點。</p>'+
   '<p class="small">依集點日期及營業日即時計算，含進行中賽事；獨立帳與一般賽事模式不計入。舊紀錄未記錄報名時間時，首場加成待確認，可在明細選擇確認結果。上方查詢日期不影響本活動累計。</p>'+
   '<p>參與 '+all.length+' 人｜可付費 '+paid+' 人｜首次免費 '+free+' 人｜首場待確認 '+pending+' 筆</p>'+
   '<div class="tablewrap"><table><thead><tr><th>名次</th><th>會員</th><th>參賽場數</th><th>累積點數</th><th>參賽資格</th><th>起始籌碼</th><th>逐場明細</th></tr></thead><tbody>'+
   rows.map(row=>'<tr><td>'+(all.indexOf(row)+1)+'</td><td>'+identity(row.memberId)+'</td><td>'+row.games+'</td><td><b>'+row.points+'</b>'+(row.pending?'<div class="small">加成待確認</div>':'')+'</td><td>'+status(row)+'</td><td>'+(row.canRegister?row.chips.toLocaleString('en-US'):'—')+'</td><td>'+detailTable(row,c)+'</td></tr>').join('')+
   (rows.length?'':'<tr><td colspan="7">目前沒有符合條件的參賽紀錄</td></tr>')+'</tbody></table></div></div>';
 };
})();
