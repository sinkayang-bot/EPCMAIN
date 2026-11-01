(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function config(){ensureActDb_();const a=db.activityManagement;return a.luckyMultiplier||(a.luckyMultiplier={from:'',to:'',claims:{},draws:[],excludedEventIds:[]});}
function writable(){try{window.EPCMode?.assertWrite?.();}catch(e){alert('目前為檢視模式，請切換操作模式');return false;}if(!window.EPC_ACTIVITY_LOADED||typeof window.saveActivityCloudV3!=='function'){alert('活動雲端資料尚未載入，暫停修改');return false;}return true;}
function save(){if(!window.EPC_ACTIVITY_LOADED||typeof window.saveActivityCloudV3!=='function'){alert('活動資料未完成雲端載入，暫停寫入');return;}persist();window.saveActivityCloudV3();renderActivities();}
function period(){const c=config();return {from:c.from,to:c.to};}
function rows(){const c=config();if(!c.from||!c.to)return [];const events=(db.events||[]).filter(e=>!(typeof isIndependentAccountingEvent==='function'&&isIndependentAccountingEvent(e))).map(e=>({...e,businessDate:typeof actBusinessDate_==='function'?actBusinessDate_(e):e.businessDate,players:e.players||[]}));return EPCLuckyMultiplier.score(events,period(),c);}
window.luckySetDate_=(k,v)=>{if(!writable())return;config()[k]=v;save();};
window.luckyHalf_=(half)=>{if(!writable())return;const d=new Date(),p=EPCLuckyMultiplier.periods(d.getFullYear(),d.getMonth()+1)[half];Object.assign(config(),p);save();};
window.luckyClaim_=(member,tier,v)=>{if(!writable())return;const c=config(),key=c.from+'_'+c.to+'_'+member+'_'+tier;c.claims[key]=!!v;save();};
window.actLuckyMultiplier_=function(){
 const c=config(),p=period();let all=[];try{all=rows()}catch(e){console.error('Lucky multiplier',e)}const q=String($('actSearch')?.value||'').trim().toLowerCase(),r=all.filter(x=>!q||[x.memberId,typeof memberNumber_==='function'?memberNumber_(x.memberId):x.memberId,typeof actMember_==='function'?actMember_(x.memberId)?.name:''].some(s=>String(s||'').toLowerCase().includes(q)));
  const checked=(id,tier)=>c.claims[p.from+'_'+p.to+'_'+id+'_'+tier]?'checked':'';
 return '<div class="card"><h3>幸運加乘｜半月積分抽獎</h3><div class="small">僅參加店裡當日第一場賽事，額外 +2 分。各場基本分依當日場序 +1/+2/+3/+4；假日每場 +1。重買不計分。積分可用於自行辦理的抽獎，本系統不執行抽獎。</div>'+
 '<div class="formgrid" style="grid-template-columns:1fr 1fr"><div><label>活動開始</label><input type="date" value="'+esc(p.from)+'" onchange="luckySetDate_(\'from\',this.value)"></div><div><label>活動結束</label><input type="date" value="'+esc(p.to)+'" onchange="luckySetDate_(\'to\',this.value)"></div></div>'+
 '<div class="toolbar"><button onclick="luckyHalf_(0)">本月上半期</button><button onclick="luckyHalf_(1)">本月下半期</button></div>'+
 '<div class="small">本期 '+r.length+' 位會員，累計 '+all.reduce((n,x)=>n+x.points,0)+' 分。40 分：500 折價卡；60 分：1,000 折價卡。領取紀錄獨立保存。</div>'+
 '<div class="tablewrap"><table><thead><tr><th>名次</th><th>會員</th><th>場數</th><th>積分</th><th>40 分獎勵</th><th>60 分獎勵</th></tr></thead><tbody>'+
 r.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+(typeof epcPlayerDisplayHtml_==='function'?epcPlayerDisplayHtml_(x.memberId):esc(x.memberId))+'</td><td>'+x.games+'</td><td><b>'+x.points+'</b></td>'+
 [40,60].map(t=>'<td>'+(x.points>=t?'<label><input type="checkbox" '+checked(x.memberId,t)+' onchange="luckyClaim_(\''+esc(x.memberId)+'\','+t+',this.checked)"> 已領取</label>':'未達標')+'</td>').join('')+'</tr>').join('')+
 '</tbody></table></div></div>';
};
})();