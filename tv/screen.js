import {displayCloud} from '../display-cloud.js';
const host=document.getElementById('screen'),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>'$'+Number(n||0).toLocaleString();
let id=localStorage.getItem('epcTvDeviceId');if(!id){id=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem('epcTvDeviceId',id)}
let timer,cloud,lastSignature='',renewing=false;
function identity(r,ui){return [ui.showName!==false?esc(r.name||r.member||''):null,ui.showMemberId?esc(r.memberId||r.id||''):null].filter(Boolean).join(' · ')}
function render(p){
 const ui=p.ui||{},header=`<header><h1>${esc(p.title||'EPC')}</h1><span>${esc(p.activityFrom||'')} ～ ${esc(p.activityTo||'')}</span></header>`;
 if(p.type==='boss'){
  const b=p.boss||{},pct=Math.max(0,Math.min(100,100*Number(b.hp||0)/Math.max(1,Number(b.initialHp||250))));
  const initial=p.startPrize??Math.max(0,Number(p.pool||0)-Number(p.participantAmount||0)-Number(p.groupAmount||0));
  const personStep=Math.max(1,Number(p.personStep||1)),personAmount=Number(p.personAmount||100),normalAmount=Number(p.normalParticipantAmount??p.participantAmount??0);
  const counted=personStep===1&&personAmount>0&&Number.isInteger(normalAmount/personAmount)?`其中 ${normalAmount/personAmount} 人次列入加給`:'';
  const personRule=`一般階段已結算每 ${personStep} 人次 ＋${money(personAmount)}${p.huntPersonEnabled?'':'；狩王階段不加人數獎金'}`;
  const groupStep=Math.max(1,Number(p.groupStep||8)),groupIgnore=Math.max(0,Number(p.groupIgnore||0));
  const groupRule=`一般：每場滿 ${groupIgnore+groupStep} 組起，每 ${groupStep} 組 ＋${money(p.groupBonus||200)}。狩王：每場滿 ${Number(p.huntGroupIgnore||0)+Number(p.huntGroupStep||8)} 組 ＋${money(p.huntGroupBonus||200)}，每場一次。`;
  host.innerHTML=header+`<h2>${esc(b.name||'魔王')} <span class="badge">${b.killed?'已擊殺':p.attackActive?'攻擊已啟用':'獎池累積中'}</span></h2><div class="grid boss-metrics"><div class="card"><div class="metric-label">獎池累計</div><div class="value">${money(p.pool)}</div><div class="metric-note">初始獎金 ${money(initial)}</div><div class="metric-note">上限 ${money(p.cap)}</div></div><div class="card"><div class="metric-label">剩餘血量</div><div class="value">${Number(b.hp||0)} <span class="hp-total">/ ${Number(b.initialHp||0)}</span></div><div class="hp"><div style="width:${pct}%"></div></div></div><div class="card"><div class="metric-label">人數加給</div><div class="value">${money(p.participantAmount)}</div><div class="metric-note">總參賽 ${Number(p.participants||0).toLocaleString()} 人次</div>${counted?`<div class="metric-note">${esc(counted)}</div>`:''}</div><div class="card"><div class="metric-label">組數加給</div><div class="value">${money(p.groupAmount)}</div><div class="metric-note">累計 ${Number(p.groups||0).toLocaleString()} 組</div><div class="metric-note">${Number(p.groupQualifyingEvents||0)} 場符合加碼</div></div></div><h2>攻擊紀錄</h2><table><thead><tr><th>玩家</th><th>手牌／方式</th><th>傷害</th><th>結果</th></tr></thead><tbody>${(p.attacks||[]).slice(0,6).map(r=>`<tr><td>${identity(r,ui)}</td><td>${esc(r.method)}</td><td>${Number(r.damage||0)}</td><td>${r.success?'擊殺':'攻擊'}</td></tr>`).join('')||'<tr><td colspan="4">尚無攻擊紀錄</td></tr>'}</tbody></table><footer><div>${esc(personRule)}</div><div>${esc(groupRule)} 未結算達標也計入；每場獨立計算，不合併組數。</div></footer>`;
 }else{
  const weekly=p.type==='weekly';host.innerHTML=header+`<table style="font-size:clamp(20px,${2*(Number(ui.rankFontScale)||100)/100}vw,55px)"><thead><tr>${ui.showRank!==false?'<th>排名</th>':''}<th>玩家</th>${weekly?'<th>場次</th><th>出席天數</th>':ui.showScore!==false?'<th>積分</th>':''}</tr></thead><tbody>${(p.rows||[]).slice(0,ui.limit||10).map((r,i)=>`<tr>${ui.showRank!==false?`<td>${i+1}</td>`:''}<td>${identity(r,ui)}</td>${weekly?`<td>${Number(r.games||0)}</td><td>${Number(r.days||0)}</td>`:ui.showScore!==false?`<td>${Number(r.score||0)}</td>`:''}</tr>`).join('')||'<tr><td>目前尚無資料</td></tr>'}</tbody></table>`;
 }
}
function show(data){
 clearTimeout(timer);
 if(!data?.paired){host.innerHTML=`<div class="center"><h1>EPC 顯示設備配對</h1><p>在 EPCMAIN「顯示設備」輸入此配對碼</p><div class="code">${esc(data?.code||'…')}</div><p class="muted">配對碼有效 10 分鐘；到期請重新整理</p></div>`;return}
 const p=data.payload;if(!p){host.innerHTML='<div class="center"><h1>配對完成</h1><p>請在後台選擇活動，再按「套用到螢幕」。</p></div>';return}
 const slides=p.type==='rotate'?(p.slides||[]):[p];if(!slides.length){host.innerHTML='<div class="center"><h1>請在後台勾選輪播活動</h1></div>';return}
 let i=0;const next=()=>{const slide=slides[i++%slides.length];render(slide);if(slides.length>1)timer=setTimeout(next,Math.max(5,slide.duration||data.rotateSeconds||15)*1000)};next();
}
try{
 cloud=await displayCloud();await cloud.register(id);cloud.subscribe(id,async data=>{
  if(!data&&!renewing){renewing=true;lastSignature='';try{await cloud.register(id)}finally{renewing=false}return}
  const sig=JSON.stringify([data?.paired,data?.code,data?.payload,data?.rotateSeconds]);if(sig!==lastSignature){lastSignature=sig;show(data)}
 },e=>{host.innerHTML=`<div class="center error"><h1>顯示連線失敗</h1><p>${esc(e.message)}</p><p>請重新整理後再試</p></div>`});
 setInterval(()=>cloud.heartbeat(id).catch(()=>{}),30000);
}catch(e){host.innerHTML=`<div class="center error"><h1>無法連線</h1><p>${esc(e.message)}</p><p>請重新整理後再試</p></div>`}
