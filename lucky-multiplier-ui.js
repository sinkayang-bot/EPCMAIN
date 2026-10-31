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
window.luckyDraw_=()=>{if(!writable())return;const c=config();let r;try{r=rows()}catch(e){return alert('請先設定有效的活動日期')}if(!r.length)return alert('本期尚無參賽積分');if(!confirm('確認依積分權重抽出一位？每 1 分為 1 次抽獎機會。'))return;
const used=new Map();for(const d of c.draws)if(d.from===c.from&&d.to===c.to)used.set(d.memberId,(used.get(d.memberId)||0)+1);
const pool=r.filter(x=>(used.get(x.memberId)||0)<2),total=pool.reduce((n,x)=>n+x.points,0);if(!total)return alert('本期已無可抽選會員');
let ticket=Math.random()*total,winner=pool[pool.length-1];for(const x of pool){ticket-=x.points;if(ticket<0){winner=x;break;}}
c.draws.push({id:Date.now().toString(36),from:c.from,to:c.to,memberId:winner.memberId,points:winner.points,createdAt:new Date().toISOString(),prize:'待指定',claimed:false});save();};
window.luckyPrize_=(id,value)=>{if(!writable())return;const d=config().draws.find(x=>x.id===id);if(d){d.prize=value;save();}};
window.luckyDrawClaim_=(id,v)=>{if(!writable())return;const d=config().draws.find(x=>x.id===id);if(d){d.claimed=v;save();}};
window.actLuckyMultiplier_=function(){
 const c=config(),p=period();let all=[];try{all=rows()}catch(e){console.error('Lucky multiplier',e)}const q=String($('actSearch')?.value||'').trim().toLowerCase(),r=all.filter(x=>!q||[x.memberId,typeof actMember_==='function'?actMember_(x.memberId)?.name:''].some(s=>String(s||'').toLowerCase().includes(q)));
 const drawn=c.draws.filter(x=>x.from===p.from&&x.to===p.to);
 const checked=(id,tier)=>c.claims[p.from+'_'+p.to+'_'+id+'_'+tier]?'checked':'';
 return '<div class="card"><h3>幸運加乘｜半月積分抽獎</h3><div class="small">僅參加店裡當日第一場賽事，額外 +2 分。各場基本分依當日場序 +1/+2/+3/+4；假日每場 +1。重買不計分。每 1 分等於 1 次抽獎機會，每人每期最多中獎 2 次。</div>'+
 '<div class="formgrid" style="grid-template-columns:1fr 1fr"><div><label>活動開始</label><input type="date" value="'+esc(p.from)+'" onchange="luckySetDate_(\'from\',this.value)"></div><div><label>活動結束</label><input type="date" value="'+esc(p.to)+'" onchange="luckySetDate_(\'to\',this.value)"></div></div>'+
 '<div class="toolbar"><button onclick="luckyHalf_(0)">本月上半期</button><button onclick="luckyHalf_(1)">本月下半期</button><button class="primary" onclick="luckyDraw_()">按積分權重抽獎</button></div>'+
 '<div class="small">本期 '+r.length+' 位會員，累計 '+all.reduce((n,x)=>n+x.points,0)+' 分。40 分：500 折價卡；60 分：1,000 折價卡。領取紀錄獨立保存。</div>'+
 '<div class="tablewrap"><table><thead><tr><th>名次</th><th>會員</th><th>場數</th><th>積分</th><th>40 分獎勵</th><th>60 分獎勵</th></tr></thead><tbody>'+
 r.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+(typeof epcPlayerDisplayHtml_==='function'?epcPlayerDisplayHtml_(x.memberId):esc(x.memberId))+'</td><td>'+x.games+'</td><td><b>'+x.points+'</b></td>'+
 [40,60].map(t=>'<td>'+(x.points>=t?'<label><input type="checkbox" '+checked(x.memberId,t)+' onchange="luckyClaim_(\''+esc(x.memberId)+'\','+t+',this.checked)"> 已領取</label>':'未達標')+'</td>').join('')+'</tr>').join('')+
 '</tbody></table></div><h3>本期抽獎紀錄</h3><div class="tablewrap"><table><thead><tr><th>時間</th><th>會員</th><th>積分</th><th>獎項</th><th>領取</th></tr></thead><tbody>'+
 drawn.map(x=>'<tr><td>'+esc(x.createdAt.slice(0,16))+'</td><td>'+esc(x.memberId)+'</td><td>'+x.points+'</td><td><select onchange="luckyPrize_(\''+x.id+'\',this.value)">'+['待指定','6000 現金','3000 現金','1000 現金','500 現金','1000 折價卡','500 折價卡'].map(v=>'<option '+(x.prize===v?'selected':'')+'>'+v+'</option>').join('')+'</select></td><td><input type="checkbox" '+(x.claimed?'checked':'')+' onchange="luckyDrawClaim_(\''+x.id+'\',this.checked)"></td></tr>').join('')+
 '</tbody></table></div></div>';
};
})();