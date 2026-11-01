import {installEventPicker} from './event-picker.js?v=20261023-tablet-rgb41';
import {pairingMarkup} from '../display-pairing.js?v=20261024-brand46';
import {effectiveDisplay} from '../display-assignment.js?v=20261022-switch5';
import {mountTimerFrame} from './timer-frame.js?v=20261028-rank-small9';
import {displayCloud} from '../display-cloud.js?v=20261023-tablet-rgb41';
const host=document.getElementById('screen'),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>'$'+Number(n||0).toLocaleString();
let id=localStorage.getItem('epcTvDeviceId');if(!id){id=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem('epcTvDeviceId',id)}
let timer,cloud,lastSignature='',renewing=false;
function identity(r,ui){return [ui.showName!==false?esc(r.name||r.member||''):null,ui.showMemberId?esc(r.memberNumber||r.memberId||r.id||''):null].filter(Boolean).join(' · ')}
function render(p,target=host){
 if(p.type==='timer'){
  const ids=Array.isArray(p.eventIds)?[...new Set(p.eventIds.map(String).filter(Boolean))].slice(0,4):[String(p.eventId||'')].filter(Boolean);
  if(ids.length<=1){mountTimerFrame(target,ids[0],p.refreshToken);return}
  const frame=document.createElement('iframe');frame.title='EPC 多場計時器';frame.allow='autoplay';frame.src='./multi-timer.html?ids='+encodeURIComponent(ids.join(','))+'&v=20261028-multi1';frame.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;border:0;background:#000';target.replaceChildren(frame);return;
 }
 const ui=p.ui||{},header=`<header><div class="epc-tv-brand"><img class="epc-brand-logo" src="../assets/epc-brand.png?v=20261024-brand46" alt="EPC 原版 LOGO" width="128" height="58"><h1>${esc(p.title||'EPC')}</h1></div><span>${esc(p.activityFrom||'')} ～ ${esc(p.activityTo||'')}</span></header>`;
 if(p.type==='extremeTen'||ui.kind==='extremeTen'||String(p.title||'').replace(/\s/g,'')==='極限10秒'){
  const distance=r=>Number.isFinite(Number(r.seconds))?Math.abs(Math.round(Number(r.seconds)*100)-1000):Number.isFinite(Number(r.difference))?Math.round(Number(r.difference)*100):Infinity;
  const unique=new Map();
  (p.rows||[]).slice().sort((a,b)=>distance(a)-distance(b)).forEach((r,i)=>{const key=String(r.memberId??r.name??r.id??i);if(!unique.has(key))unique.set(key,r);});
  const ranked=[...unique.values()];let lastDistance=null,place=0;
  const rows=ranked.map((r,i)=>{const d=distance(r);if(d!==lastDistance)place=i+1;lastDistance=d;return {...r,rank:place};}).slice(0,ui.limit||10);
  const cols=3+(ui.showMemberId?1:0);
  target.innerHTML=header+`<div class="ten-content"><div class="ten-summary"><span>目標 <b>10.00 秒</b></span><span>獎勵 <b>${money(Number(p.rewardCash||0)+Number(p.rewardCoupon||0))}</b><small>現金 ${money(p.rewardCash)}＋折價卡 ${money(p.rewardCoupon)}</small></span><span>剩餘 <b>${Number(p.remaining??8)}／${Number(p.rewardLimit||8)} 份</b></span></div>
  <table class="leaderboard ten-ranking"><colgroup><col class="ten-rank-col"><col>${ui.showMemberId?'<col class="ten-id-col">':''}<col class="ten-seconds-col"></colgroup><thead><tr><th>排名</th><th>${ui.showName!==false?'玩家':'會員'}</th>${ui.showMemberId?'<th>會員編號</th>':''}<th>挑戰秒數</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td class="ten-rank">${Number(r.rank||i+1)}</td><td class="player-identity">${esc(ui.showName!==false?(r.name||r.memberId||''):(ui.showMemberId?'—':r.memberId||''))}${r.awardType||r.success?`<small class="ten-result">${esc(r.awardType||(r.success?'挑戰成功':''))}</small>`:''}</td>${ui.showMemberId?`<td class="member-number">${esc(r.memberNumber||r.memberId||'')}</td>`:''}<td class="ten-seconds${r.success?' ten-success':''}"><b>${esc(r.seconds??'—')} 秒</b><small>距離 10.00 秒：${esc(r.difference??'—')} 秒</small></td></tr>`).join('')||`<tr><td colspan="${cols}">尚無挑戰紀錄</td></tr>`}</tbody></table><footer>每人只列最佳秒數，每人限領一次；月底未送完依排名補發。</footer></div>`;
  return;
 }
 if(p.type==='umbrella'&&Array.isArray(p.monthRows)){
  const showName=ui.showName!==false,showId=!!ui.showMemberId,showRank=ui.showRank!==false,showScore=ui.showScore!==false;
  const cols=Math.max(1,Number(showRank)+Number(showName)+Number(showId)+Number(showScore));
  const board=(title,from,to,rows)=>`<section class="umbrella-board"><h2>${title}</h2><p class="muted">${esc(from||'不限開始日')} ～ ${esc(to||'不限結束日')}</p><table class="leaderboard"><thead><tr>${showRank?'<th>排名</th>':''}${showName?'<th>玩家</th>':''}${showId?'<th>會員編號</th>':''}${showScore?'<th>券數</th>':''}</tr></thead><tbody>${rows.slice(0,ui.limit||10).map((r,i)=>`<tr>${showRank?`<td>${i+1}</td>`:''}${showName?`<td class="player-identity">${esc(r.name||r.member||'')}</td>`:''}${showId?`<td class="member-number">${esc(r.memberNumber||r.memberId||r.id||'')}</td>`:''}${showScore?`<td>${Number(r.score||0)}</td>`:''}</tr>`).join('')||`<tr><td colspan="${cols}">目前尚無資料</td></tr>`}</tbody></table></section>`;
  target.innerHTML=header+`<div class="umbrella-boards${ui.compact?' compact':''}" style="--umbrella-scale:${(Number(ui.rankFontScale)||100)/100}">${board('整月排行榜',p.monthFrom,p.monthTo,p.monthRows)}${board('活動期間排行榜',p.activityFrom,p.activityTo,p.rows||[])}</div>`;
  return;
 }
 if(p.type==='boss'){
  const b=p.boss||{},pct=Math.max(0,Math.min(100,100*Number(b.hp||0)/Math.max(1,Number(b.initialHp||250))));
  const initial=p.startPrize??Math.max(0,Number(p.pool||0)-Number(p.participantAmount||0)-Number(p.groupAmount||0));
  const personStep=Math.max(1,Number(p.personStep||1)),personAmount=Number(p.personAmount||100),normalAmount=Number(p.normalParticipantAmount??p.participantAmount??0);
  const counted=personStep===1&&personAmount>0&&Number.isInteger(normalAmount/personAmount)?`其中 ${normalAmount/personAmount} 人次列入加給`:'';
  const personRule=`一般階段每 ${personStep} 人次 ＋${money(personAmount)}${p.huntPersonEnabled?'':'；狩王階段不加人數獎金'}`;
  const groupStep=Math.max(1,Number(p.groupStep||8)),groupIgnore=Math.max(0,Number(p.groupIgnore||0));
  const groupRule=`一般：每場滿 ${groupIgnore+groupStep} 組起，每 ${groupStep} 組 ＋${money(p.groupBonus||200)}。狩王：每場滿 ${Number(p.huntGroupIgnore||0)+Number(p.huntGroupStep||8)} 組起，每 ${Number(p.huntGroupStep||8)} 組 ＋${money(p.huntGroupBonus||200)}。`;
  target.innerHTML=header+`<h2>${esc(b.name||'魔王')} <span class="badge">${b.killed?'已擊殺':p.attackActive?'攻擊已啟用':'獎池累積中'}</span></h2><div class="grid boss-metrics"><div class="card"><div class="metric-label">獎池累計</div><div class="value">${money(p.pool)}</div><div class="metric-note">初始獎金 ${money(initial)}</div><div class="metric-note">上限 ${money(p.cap)}</div></div><div class="card"><div class="metric-label">剩餘血量</div><div class="value">${Number(b.hp||0)} <span class="hp-total">/ ${Number(b.initialHp||0)}</span></div><div class="hp"><div style="width:${pct}%"></div></div></div><div class="card"><div class="metric-label">人數加給</div><div class="value">${money(p.participantAmount)}</div><div class="metric-note">總參賽 ${Number(p.participants||0).toLocaleString()} 人次</div>${counted?`<div class="metric-note">${esc(counted)}</div>`:''}</div><div class="card"><div class="metric-label">組數加給</div><div class="value">${money(p.groupAmount)}</div><div class="metric-note">累計 ${Number(p.groups||0).toLocaleString()} 組</div><div class="metric-note">${Number(p.groupQualifyingEvents||0)} 場符合加碼</div></div></div><h2>攻擊紀錄</h2><table><thead><tr><th>玩家</th><th>手牌／方式</th><th>傷害</th><th>結果</th></tr></thead><tbody>${(p.attacks||[]).slice(0,ui.compact?3:6).map(r=>`<tr><td>${identity(r,ui)}</td><td>${esc(r.method)}</td><td>${Number(r.damage||0)}</td><td>${r.success?'擊殺':'攻擊'}</td></tr>`).join('')||'<tr><td colspan="4">尚無攻擊紀錄</td></tr>'}</tbody></table><footer><div>${esc(personRule)}</div><div>${esc(groupRule)} 進行中賽事即時計入；每場獨立計算，不合併組數。</div></footer>`;
 }else{
  const weekly=p.type==='weekly',showName=ui.showName!==false,showId=!!ui.showMemberId;
  const columns=(ui.showRank!==false?1:0)+(showName?1:0)+(showId?1:0)+(weekly?2:ui.showScore!==false?1:0);
  target.innerHTML=header+`<table class="leaderboard" style="font-size:clamp(20px,${2*(Number(ui.rankFontScale)||100)/100}vw,55px)"><colgroup>${ui.showRank!==false?'<col class="col-rank">':''}${showName?'<col class="col-player">':''}${showId?'<col class="col-member">':''}${weekly?'<col class="col-count"><col class="col-count">':ui.showScore!==false?'<col class="col-score">':''}</colgroup><thead><tr>${ui.showRank!==false?'<th>排名</th>':''}${showName?'<th>玩家</th>':''}${showId?'<th>會員編號</th>':''}${weekly?'<th>場次</th><th>出席天數</th>':ui.showScore!==false?'<th>積分</th>':''}</tr></thead><tbody>${(p.rows||[]).slice(0,ui.limit||10).map((r,i)=>`<tr>${ui.showRank!==false?`<td>${i+1}</td>`:''}${showName?`<td class="player-identity">${esc(r.name||r.member||'')}</td>`:''}${showId?`<td class="member-number">${esc(r.memberNumber||r.memberId||r.id||'')}</td>`:''}${weekly?`<td>${Number(r.games||0)}</td><td>${Number(r.days||0)}</td>`:ui.showScore!==false?`<td>${Number(r.score||0)}</td>`:''}</tr>`).join('')||`<tr><td colspan="${Math.max(1,columns)}">目前尚無資料</td></tr>`}</tbody></table>`;

 }
 if(p.type==='luckyMultiplier'&&p.rules){const foot=document.createElement('footer');foot.textContent=p.rules;target.appendChild(foot);}
}
function parallelLayout(panels){
 const boss=panels.find(p=>p.type==='boss'),ordered=boss?[...panels.filter(p=>p!==boss),boss]:panels;
 const n=ordered.length;
 if(boss){
  const columns=n===1?1:n===2?3:Math.ceil((n+1)/2);
  return {columns,rows:n<=2?1:2,items:ordered.map(p=>({panel:p,span:p===boss?(n<=2?columns-(n-1):2*columns-n+1):1}))};
 }
 const top=Math.ceil(n/2),bottom=n-top;
 const gcd=(a,b)=>b?gcd(b,a%b):a,columns=n<=2?Math.max(1,n):top*bottom/gcd(top,bottom);
 return {columns,rows:n<=2?1:2,items:ordered.map((p,i)=>({panel:p,span:n<=2?1:columns/(i<top?top:bottom)}))};
}
function fitBossPanel(section){
 const content=section.querySelector('.boss-panel-content');if(!content)return;
 content.style.transform='';
 const available=section.clientHeight-parseFloat(getComputedStyle(section).paddingTop)-parseFloat(getComputedStyle(section).paddingBottom);
 const scale=Math.min(1,available/Math.max(1,content.scrollHeight));
 content.style.transform=`scale(${scale})`;
}
const panelObserver=typeof ResizeObserver==='function'?new ResizeObserver(entries=>entries.forEach(e=>fitBossPanel(e.target))):null;
function show(data){
 clearTimeout(timer);panelObserver?.disconnect();host.className='';
 if(!data?.paired){host.innerHTML=/^\d{6}$/.test(data?.code||'')?pairingMarkup(data.code,location.href):'<div class="center"><h1>正在產生配對碼…</h1></div>';return}
 const p=data.payload;if(!p){host.innerHTML='<div class="center"><h1>配對完成</h1><p>請在後台選擇活動，再按「套用到螢幕」。</p></div>';return}
 const renderParallel=(p)=>{
  const panels=(p.panels||[]);
  if(!panels.length){host.innerHTML='<div class="center"><h1>請在後台勾選並排活動</h1></div>';return}
  const layout=parallelLayout(panels);
  host.className='parallel-screen';host.innerHTML='';
  host.style.setProperty('--panel-columns',layout.columns);
  host.style.setProperty('--panel-rows',layout.rows);
  layout.items.forEach(({panel,span})=>{
   const section=document.createElement('section');section.className='activity-panel'+(panel.type==='boss'?' boss-panel':'');section.style.gridColumn='span '+span;host.appendChild(section);
   if(panel.type==='boss'){
    const content=document.createElement('div');content.className='boss-panel-content';section.appendChild(content);render(panel,content);fitBossPanel(section);panelObserver?.observe(section);
   }else render(panel,section);
  });
 };
 if(p.type==='parallel'){renderParallel(p);return}
 const slides=(p.type==='rotate'||p.type==='rotateParallel')?(p.slides||[]):[p];if(!slides.length){host.innerHTML='<div class="center"><h1>請在後台勾選輪播活動</h1></div>';return}
 let i=0;const next=()=>{const slide=slides[i++%slides.length];if(slide.type==='parallel')renderParallel(slide);else {host.className='';host.style.removeProperty?.('--panel-columns');host.style.removeProperty?.('--panel-rows');render(slide)};if(slides.length>1)timer=setTimeout(next,Math.max(5,slide.duration||data.rotateSeconds||15)*1000)};next();
}
try{
 cloud=await displayCloud();const picker=installEventPicker({cloud,deviceId:id});await cloud.register(id);cloud.subscribe(id,async data=>{
  if(!data&&!renewing){renewing=true;lastSignature='';try{await cloud.register(id)}finally{renewing=false}return}
  data=effectiveDisplay(data);picker.update(data);
  const sig=JSON.stringify([data?.paired,data?.code,data?.payload,data?.rotateSeconds]);if(sig!==lastSignature){lastSignature=sig;show(data)}
 },e=>{host.innerHTML=`<div class="center error"><h1>顯示連線失敗</h1><p>${esc(e.message)}</p><p>請重新整理後再試</p></div>`});
 setInterval(()=>cloud.heartbeat(id).catch(()=>{}),30000);
}catch(e){host.innerHTML=`<div class="center error"><h1>無法連線</h1><p>${esc(e.message)}</p><p>請重新整理後再試</p></div>`}


