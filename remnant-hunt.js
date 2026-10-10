/* EPC 餘獸獵殺：獨立於舊魔王，不修改既有攻擊紀錄。 */
(function(){
'use strict';
const WEEKS=[['2026-10-11','2026-10-17'],['2026-10-18','2026-10-24'],['2026-10-25','2026-10-31']];
const $r=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function state(){if(!db.activityManagement)db.activityManagement={};return db.activityManagement.remnantHunt||(db.activityManagement.remnantHunt={version:1,attacks:[]});}
function dateNow(){return typeof businessDate==='function'?businessDate():new Date().toLocaleDateString('en-CA');}
function week(d){return WEEKS.findIndex(([a,b])=>d>=a&&d<=b);}
function rows(w){return state().attacks.filter(x=>x.week===w).slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));}
function calculate(w){
 const attacks=rows(w),members=new Map(),history=[],awards={3:null,6:null};let hp=100,monster=1;
 for(const a of attacks){
  let m=members.get(a.memberId);if(!m){m={id:a.memberId,name:a.name,points:0,kills:0,attacks:0};members.set(a.memberId,m);}
  let damage=a.instant?hp:a.damage;let killed=a.instant||damage>=hp;
  let score=a.instant?50:a.damage+(killed?10:0);
  m.points+=score;m.attacks++;if(killed){m.kills++;if(m.kills===3&&!awards[3])awards[3]={...m,at:a.date};if(m.kills===6&&!awards[6])awards[6]={...m,at:a.date};}
  history.push({...a,monster,hpBefore:hp,score,killed,hpAfter:killed?0:hp-damage});
  if(killed){monster++;hp=100;}else hp-=damage;
 }
 const rank=[...members.values()].sort((a,b)=>b.points-a.points||b.kills-a.kills||a.id.localeCompare(b.id));
 return {rank,history,awards,hp,monster};
}
function draw(){const buf=new Uint32Array(1);crypto.getRandomValues(buf);const n=buf[0]/4294967296;return n<.40?10:n<.75?20:n<.95?30:'instant';}
function memberList(){return (db.members||[]).map(m=>{const id=String(m.id||m.pokerfansId||'');return {id,name:String(m.nickname||m.name||id)};}).filter(x=>x.id);}
function save(){persist();if(typeof window.saveActivityCloudV3==='function')Promise.resolve(window.saveActivityCloudV3()).catch(e=>alert('雲端同步失敗：'+e.message));}
function add(){
 const id=$r('rhMember').value,date=$r('rhDate').value,hand=$r('rhHand').value,verified=$r('rhVerified').checked;
 const w=week(date),member=memberList().find(x=>x.id===id);
 if(!member||w<0)return alert('請選擇會員及活動期間內的營業日');
 if(!verified)return alert('請先確認兩手不同手牌、翻後贏取 20BB 等攻擊資格');
 if(hand==='TT'&&!$r('rhRiver').checked)return alert('TT 暴擊必須確認河牌贏取 20BB');
 if(!confirm('確定抽取傷害並新增正式攻擊紀錄？'))return;
 const result=draw(),instant=result==='instant',base=instant?0:result,damage=instant?0:Math.floor(base*(hand==='TT'?1.5:1));
 const record={id:'RH'+Date.now()+'-'+Math.random().toString(36).slice(2,8),memberId:id,name:member.name,date,week:w,hand,river:hand==='TT',base,damage,instant,createdAt:new Date().toISOString()};
 state().attacks.push(record);save();renderActivities();
}
function del(id){if(!confirm('刪除後會重新計算該期所有血量、擊殺與排行，確定刪除？'))return;state().attacks=state().attacks.filter(x=>x.id!==id);save();renderActivities();}
function render(){
 const pane=$r('actRemnant');if(!pane)return;
 const today=dateNow(),w0=week(today),sel=$r('rhWeekSelect'),w=sel?Number(sel.value):(w0>=0?w0:0),s=calculate(w),todayWeekend=[0,6].includes(new Date(today+'T12:00:00').getDay());
 const memberOptions=memberList().map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name)+'（'+esc(m.id)+'）</option>').join('');
 pane.innerHTML=`<div class="card"><h2>雙十狩王Ⅱ・餘獸獵殺戰 <span class="small">獨立活動紀錄，不覆寫舊魔王</span></h2>
 <div class="formgrid"><div><label>活動週期</label><select id="rhWeekSelect" onchange="window.remnantHuntRender()">${WEEKS.map((x,i)=>'<option value="'+i+'" '+(i===w?'selected':'')+'>第'+(i+1)+'期 '+x.join('～')+'</option>').join('')}</select></div>
 <div><label>目前小怪</label><strong>第 ${s.monster} 隻</strong></div><div><label>剩餘血量</label><strong>${s.hp} / 100 HP</strong></div><div><label>本週參與獵人</label><strong>${s.rank.length} 人</strong></div></div>
 <div class="small">每週重置：10/11–17、10/18–24、10/25–31｜一擊必殺固定 50 分｜一般擊殺額外 +10 分</div>
 <h3>登記攻擊（由管理員核對資格）</h3>
 <div class="formgrid"><div><label>營業日</label><input id="rhDate" type="date" value="${w===w0?today:WEEKS[w][0]}" min="${WEEKS[w][0]}" max="${WEEKS[w][1]}"></div>
 <div><label>會員</label><select id="rhMember"><option value="">請選擇會員</option>${memberOptions}</select></div>
 <div><label>攻擊形式</label><select id="rhHand" onchange="document.getElementById('rhRiver').disabled=this.value!=='TT'"><option value="10Xo">10Xo（平日）</option><option value="10X">10X（假日）</option><option value="TT">TT 暴擊</option></select></div></div>
 <div style="margin:12px 0"><label><input type="checkbox" id="rhVerified"> 已核對符合手牌資格（10X 為兩手不同、翻後各贏 20BB；TT 另核對河牌）</label>　<label><input type="checkbox" id="rhRiver" disabled> TT 河牌贏取 20BB</label></div>
 <button class="primary" onclick="window.remnantHuntAdd()">抽取傷害並登記</button>
 <p class="small">傷害機率：10＝40%、20＝35%、30＝20%、一擊必殺＝5%。TT 普通傷害 ×1.5 向下取整；一擊必殺不加成。請勿在多台裝置同時登記同一攻擊。</p>
 </div>
 <div class="card"><h3>每週排行榜與獎勵</h3><div class="small">第1名 5,000 元｜第2名 1,000 元折價卡｜第3名 500 元折價卡</div>
 <table><thead><tr><th>名次</th><th>玩家</th><th>分數</th><th>擊殺</th><th>攻擊</th></tr></thead><tbody>${s.rank.map((m,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(m.name)+'</td><td>'+m.points+'</td><td>'+m.kills+'</td><td>'+m.attacks+'</td></tr>').join('')||'<tr><td colspan="5">本期尚無攻擊</td></tr>'}</tbody></table>
 <p>首位擊殺 3 隻（500 元）：${s.awards[3]?esc(s.awards[3].name):'尚未達成'}　｜　首位擊殺 6 隻（1,000 元）：${s.awards[6]?esc(s.awards[6].name):'尚未達成'}</p>
 <p class="small">達標只顯示資格，不會自動發放獎勵；請人工核銷。每期僅各一名，同一玩家可領兩項。</p></div>
 <div class="card"><h3>攻擊與擊殺歷史</h3><table><thead><tr><th>營業日</th><th>玩家</th><th>形式</th><th>傷害</th><th>分數</th><th>怪物</th><th>擊殺</th><th>操作</th></tr></thead><tbody>${s.history.slice().reverse().map(a=>'<tr><td>'+a.date+'</td><td>'+esc(a.name)+'</td><td>'+esc(a.hand)+'</td><td>'+(a.instant?'一擊必殺':a.damage)+'</td><td>'+a.score+'</td><td>#'+a.monster+'</td><td>'+(a.killed?'是':'否')+'</td><td><button onclick="window.remnantHuntDelete(\''+a.id+'\')">刪除</button></td></tr>').join('')||'<tr><td colspan="8">尚無紀錄</td></tr>'}</tbody></table></div>`;
}
window.remnantHuntRender=render;window.remnantHuntAdd=add;window.remnantHuntDelete=del;
const oldRender=window.renderActivities;
if(typeof oldRender==='function')window.renderActivities=function(){oldRender.apply(this,arguments);if(typeof actTab_!=='undefined'&&actTab_==='remnant'){document.querySelectorAll('.act-pane').forEach(p=>p.style.display='none');$r('actRemnant').style.display='block';render();}};
})();
