(()=>{
const DEFAULT_V3_API='https://script.google.com/macros/s/AKfycbwZi5bXuFJdtXiE6oxPmn4NZti-wZyOwEfTKZ8VPo5nXP5GK1mPOYrfkxz714AN4UQx9w/exec';
const CONFIG={apiUrl:localStorage.getItem('epcApiUrl')||DEFAULT_V3_API,businessStart:localStorage.getItem('eightBusinessStart')||'16:00',businessEnd:localStorage.getItem('eightBusinessEnd')||'07:00'};
const legacyDb_=()=>window.epcDb||window.db||null;
let MEMBER_ROWS=[];let MEMBER_PAGE=1;const MEMBER_PAGE_SIZE=100;let MEMBER_SEARCH_TIMER=null;
const pages={dashboard:'總覽',members:'會員資料',events:'賽事管理',settlement:'分帳報表',accounting:'帳務管理',activities:'活動專區',devices:'設備管理',settings:'系統設定'};
const pad=n=>String(n).padStart(2,'0'),money=n=>new Intl.NumberFormat('zh-TW').format(Number(n||0));
function localISO(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function businessDate(now=new Date(),start=CONFIG.businessStart,end=CONFIG.businessEnd){const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number),mins=now.getHours()*60+now.getMinutes(),s=sh*60+sm,e=eh*60+em,d=new Date(now);if(e<s&&mins<e)d.setDate(d.getDate()-1);return localISO(d)}
async function api(action,payload={}){
  if(!CONFIG.apiUrl)throw new Error('尚未設定 API URL');
  const ctrl=new AbortController(),isRead=['ping','bootstrap','bootstrap','event.list','player.list','event.list'].includes(action),timeout=action==='bootstrap'?35000:(isRead?30000:20000),timer=setTimeout(()=>ctrl.abort(),timeout);
  try{
    const res=await fetch(CONFIG.apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload}),signal:ctrl.signal});
    const raw=await res.text();let data;
    try{data=JSON.parse(raw)}catch(_){throw new Error('後端連線失敗（HTTP '+res.status+'）')}
    if(!data.ok)throw new Error(data.error||'API error');return data
  }catch(err){if(err&&err.name==='AbortError')throw new Error('後端逾時，請重試');throw err}
  finally{clearTimeout(timer)}
}
function setSync(t,bad=false){const e=document.querySelector('#syncState');if(!e)return;e.textContent=t;e.style.color=bad?'var(--bad)':''}
function applyDeltaChange(c){
 const p=c.payload||{};
 if(c.entity==='activity'){if(window.db){window.db.activityManagement=p.data||{};window.EPC_ACTIVITY_REVISION=Number(p.revision||c.revision||0);if(typeof window.renderActivities==='function')window.renderActivities()}return;}
 if(c.entity==='member'){
   const current=MEMBER_ROWS.find(x=>x.memberKey===c.entityKey),incomingRev=Number(c.revision||p.revision||0),currentRev=Number(current?.revision||0);
   if(current&&incomingRev&&currentRev>incomingRev)return;
   if(c.op==='delete')MEMBER_ROWS=MEMBER_ROWS.filter(x=>x.memberKey!==c.entityKey);
   else {const i=MEMBER_ROWS.findIndex(x=>x.memberKey===c.entityKey);if(i>=0)MEMBER_ROWS[i]={...MEMBER_ROWS[i],...p};else MEMBER_ROWS.unshift(p)}
   try{localStorage.setItem('eightMemberCache',JSON.stringify(MEMBER_ROWS))}catch(_){}
   renderMembers();const km=document.querySelector('#kMembers');if(km)km.textContent=Number(MEMBER_ROWS.length).toLocaleString();
 }
 if(c.entity==='event'){
   const selectedDate=document.querySelector('#eventDate')?.value||businessDate(),rows=window.EIGHT_EVENTS||[];
   if(c.op==='delete'){
     window.EIGHT_EVENTS=rows.filter(x=>x.eventId!==c.entityKey);
     if(window.db&&Array.isArray(window.db.events))window.db.events=window.db.events.filter(x=>String(x.id)!==String(c.entityKey));
   }else{
     const i=rows.findIndex(x=>x.eventId===c.entityKey);
     if(i>=0)rows[i]={...rows[i],...p};
     else if(!p.businessDate||String(p.businessDate)===String(selectedDate))rows.push(p);
   }
   renderEvents(window.EIGHT_EVENTS||[]);
   try{localStorage.setItem('eightEvents:'+selectedDate,JSON.stringify(window.EIGHT_EVENTS||[]))}catch(_){}
   // Event deltas must also refresh the legacy activity bridge on the receiving device.
   if(typeof window.renderActivities==='function'&&document.querySelector('#activities')?.classList.contains('active'))window.renderActivities();
 }
 if(c.entity==='player'){
   if(window.db){const e=(window.db.events||[]).find(x=>String(x.id)===String(p.eventId));if(e){e.players=e.players||[];if(c.op==='delete')e.players=e.players.filter(x=>String(x.memberKey)!==String(p.memberKey));else{const i=e.players.findIndex(x=>String(x.memberKey)===String(p.memberKey));const q={memberId:p.memberId,memberKey:p.memberKey,name:p.name,buyin:p.buyin,rebuy:p.rebuy,entries:p.entries,chips:p.chips,prize:p.prize,group:p.group,earlyDiscount:p.earlyDiscount,lateDiscount:p.lateDiscount,otherDiscount:p.otherDiscount,revision:p.revision};if(i>=0)e.players[i]={...e.players[i],...q};else e.players.push(q)}if(typeof window.renderActivities==='function'&&document.querySelector('#activities')?.classList.contains('active'))window.renderActivities()}}
   if(ACTIVE_EVENT&&p.eventId===ACTIVE_EVENT){if(c.op==='delete')WORKSPACE_PLAYERS=WORKSPACE_PLAYERS.filter(x=>x.memberKey!==p.memberKey);else {const i=WORKSPACE_PLAYERS.findIndex(x=>x.memberKey===p.memberKey);if(i>=0)WORKSPACE_PLAYERS[i]={...WORKSPACE_PLAYERS[i],...p};else WORKSPACE_PLAYERS.push(p)}renderWorkspace()}
 }
}
function startDeltaSync(){
 if(!window.EPCSync)return;
 EPCSync.setApiUrl(CONFIG.apiUrl);
 EPCSync.on(msg=>{if(msg.type==='change')applyDeltaChange(msg.change);if(msg.type==='sync-error')setSync('資料庫：重連中…',true)});
 EPCSync.state.cursor=Number(localStorage.getItem('epcCursor')||0);
 EPCSync.loop();setSync('資料庫：即時同步');
}
window.setEpcV3ApiUrl=async function(url){const v=String(url||'').trim();if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(v))throw new Error('請輸入 Apps Script 部署後的 /exec 網址');localStorage.setItem('epcApiUrl',v);CONFIG.apiUrl=v;if(window.EPCSync)EPCSync.setApiUrl(v);const r=await api('ping',{});return r};
function refreshBusinessDay(){CONFIG.businessStart=document.querySelector('#businessStart')?.value||CONFIG.businessStart;CONFIG.businessEnd=document.querySelector('#businessEnd')?.value||CONFIG.businessEnd;const d=businessDate();document.querySelector('#businessDayLabel').textContent='營業時間：每日 '+CONFIG.businessStart+'–翌日 '+CONFIG.businessEnd;document.querySelector('#todayDate').textContent=d;document.querySelector('#globalDate').value=d}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function memberSearchText(v){return String(v??'').normalize('NFKC').toLowerCase().replace(/\s+/g,'')}
function renderMembers(rows=MEMBER_ROWS){
 const ldb=legacyDb_();
 if(ldb){
  ldb.members=rows.map(m=>({id:m.memberId,name:m.name,nickname:m.nickname,group:m.group,birth:m.birth,phone:m.phone,address:m.address,memberKey:m.memberKey,revision:m.revision,createdAt:m.createdAt,eventCount:m.eventCount,totalEntries:m.totalEntries,pnl:m.pnl,spendShare:m.spendShare,lastVisit:m.lastVisit}));
  if(typeof window.renderMemberRows==='function'){window.renderMemberRows();return}
 }
 const tb=document.querySelector('#members tbody');if(!tb)return;
 const q=memberSearchText(document.querySelector('#memberSearch')?.value||''),filtered=q?rows.filter(m=>[m.memberId,m.name,m.nickname,m.group,m.phone].some(v=>memberSearchText(v).includes(q))):rows;
 tb.innerHTML=filtered.map(m=>'<tr data-key="'+esc(m.memberKey)+'"><td>'+esc(m.memberId)+'</td><td>'+esc(m.name)+'</td><td>'+esc(m.nickname)+'</td><td>'+esc(m.group)+'</td><td>'+money(m.eventCount)+'</td><td>'+money(m.totalEntries)+'</td><td>'+money(m.pnl)+'</td><td>'+esc(m.spendShare||'—')+'</td><td>'+esc(m.lastVisit||'—')+'</td></tr>').join('')||'<tr><td colspan="10" class="empty">目前沒有符合的會員資料</td></tr>';
}
function nextMemberId(){const used=new Set(MEMBER_ROWS.map(m=>String(m.memberId||'').trim().toUpperCase()));for(let i=0;i<100;i++){const id='A'+String(Math.floor(Math.random()*100000)).padStart(5,'0');if(!used.has(id))return id}return 'A'+String(Date.now()).slice(-5)}
function openMemberModal(member=null){document.querySelector('#memberForm').reset();document.querySelector('#memberKey').value=member?.memberKey||'';document.querySelector('#memberId').value=member?.memberId||nextMemberId();document.querySelector('#memberName').value=member?.name||'';document.querySelector('#memberNickname').value=member?.nickname||'';document.querySelector('#memberGroup').value=member?.group||'';document.querySelector('#memberBirth').value=member?.birth||'';document.querySelector('#memberPhone').value=member?.phone||'';document.querySelector('#memberAddress').value=member?.address||'';document.querySelector('#memberModalTitle').textContent=member?'編輯會員':'新增會員';document.querySelector('#memberFormState').textContent='';document.querySelector('#memberFormState').className='form-state';document.querySelector('#memberModal').hidden=false}
function closeMemberModal(){document.querySelector('#memberModal').hidden=true}
async function saveMember(e){e.preventDefault();const btn=document.querySelector('#memberSaveBtn'),state=document.querySelector('#memberFormState'),memberKey=document.querySelector('#memberKey').value;const data={memberId:document.querySelector('#memberId').value.trim(),name:document.querySelector('#memberName').value.trim(),nickname:document.querySelector('#memberNickname').value.trim(),group:document.querySelector('#memberGroup').value.trim(),birth:document.querySelector('#memberBirth').value.trim(),phone:document.querySelector('#memberPhone').value.trim(),address:document.querySelector('#memberAddress').value.trim()};if(memberKey){const original=MEMBER_ROWS.find(x=>x.memberKey===memberKey);['birth','phone','address'].forEach(k=>{if(original&&original[k]===undefined)delete data[k]})}if(!data.memberId||!data.name){state.textContent='POKER FANS ID 與姓名為必填';state.className='form-state bad';return}btn.disabled=true;state.textContent='儲存中…';try{let r;if(memberKey)r=await api('member.update',{memberKey,patch:data,expectedRevision:MEMBER_ROWS.find(x=>x.memberKey===memberKey)?.revision});else r=await api('member.create',{member:data});if(r.member){const i=MEMBER_ROWS.findIndex(x=>x.memberKey===r.member.memberKey);if(i>=0)MEMBER_ROWS[i]={...MEMBER_ROWS[i],...r.member};else MEMBER_ROWS.unshift(r.member);localStorage.setItem('eightMemberCache',JSON.stringify(MEMBER_ROWS));renderMembers();document.querySelector('#kMembers').textContent=money(MEMBER_ROWS.length)}state.textContent='儲存成功';state.className='form-state good';closeMemberModal()}catch(err){console.error(err);const msg={MEMBER_ID_ALREADY_EXISTS:'POKER FANS ID 已存在',MEMBER_ID_REQUIRED:'POKER FANS ID 為必填',MEMBER_NAME_REQUIRED:'姓名為必填',MEMBER_NOT_FOUND:'找不到此會員'}[err.message]||err.message;state.textContent='儲存失敗：'+msg;state.className='form-state bad'}finally{btn.disabled=false}}
window.eightReloadMembers_=async function(){
 const state=document.querySelector('#eightMemberState'),btn=document.querySelector('#eightMemberRetry');
 if(btn)btn.disabled=true;if(state)state.textContent='正在從 V3 API 讀取會員…';
 try{
  let r;
  try{r=await api('member.list')}catch(e){if(!/UNKNOWN_ACTION|unknow action/i.test(String(e.message||e)))throw e;r=await api('bootstrap')}
  MEMBER_ROWS=r.members||[];
  if(Number.isFinite(Number(r.cursor))){localStorage.setItem('epcCursor',String(Number(r.cursor)));if(window.EPCSync)window.EPCSync.state.cursor=Number(r.cursor)}
  localStorage.setItem('eightMemberCache',JSON.stringify(MEMBER_ROWS));
  const ldb=legacyDb_();
  if(ldb)ldb.members=MEMBER_ROWS.map(m=>({id:m.memberId,name:m.name,nickname:m.nickname,group:m.group,birth:m.birth,phone:m.phone,address:m.address,memberKey:m.memberKey,revision:m.revision}));
  const k=document.querySelector('#kMembers');if(k)k.textContent=money(MEMBER_ROWS.length);
  const ms=document.querySelector('#memberSearch');if(ms)ms.value='';
  const mf=document.querySelector('#memberFilterBy');if(mf)mf.value='all';
  if(typeof window.renderMemberRows==='function')window.renderMemberRows();
  const has84458=MEMBER_ROWS.some(x=>String(x.memberId||'').trim().toUpperCase()==='A84458');
  if(state)state.textContent='會員已載入 '+MEMBER_ROWS.length+' 人｜V3｜A84458:'+(has84458?'API有':'API無');
  setSync('資料庫：已連線');return r
 }catch(e){console.error(e);if(state)state.textContent='會員讀取失敗：'+e.message;setSync('資料庫：連線失敗',true);throw e}
 finally{if(btn)btn.disabled=false}
};
async function boot(force=false){
 const state=document.querySelector('#eightMemberState');
 if(!CONFIG.apiUrl){if(state)state.textContent='尚未設定 V3 API';setSync('資料庫：等待 Apps Script 部署');return}
 let cached=[];try{cached=JSON.parse(localStorage.getItem('eightMemberCache')||'[]')}catch(_){}
 if(cached.length){
  MEMBER_ROWS=cached;
  const k=document.querySelector('#kMembers');if(k)k.textContent=money(cached.length);
  {const ldb=legacyDb_();if(ldb)ldb.members=cached.map(m=>({id:m.memberId,name:m.name,nickname:m.nickname,group:m.group,birth:m.birth,phone:m.phone,address:m.address,memberKey:m.memberKey,revision:m.revision}));}
  if(typeof window.renderMemberRows==='function')window.renderMemberRows();
  if(state)state.textContent='會員已載入 '+cached.length+' 人｜V3 同步中';
  const ss=document.querySelector('#syncState');if(ss)setSync('資料庫：已連線');
 }
 if(cached.length&&!force){
  if(state)state.textContent='會員已載入 '+cached.length+' 人｜V3 即時同步';
  return {ok:true,cached:true};
 }
 try{return await window.eightReloadMembers_()}
 catch(e){if(cached.length){if(state)state.textContent='會員已載入 '+cached.length+' 人｜V3 即時同步';return {ok:false,cached:true,error:e.message}}throw e}
}
function goPage(page){document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===page));document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===page));const t=document.querySelector('#pageTitle');if(t&&pages[page])t.textContent=pages[page]}
document.querySelectorAll('#nav button').forEach(b=>b.addEventListener('click',()=>{goPage(b.dataset.page);if(b.dataset.page==='events')showCachedEvents()}));
document.querySelector('#themeBtn')?.addEventListener('click',()=>{const dark=document.body.dataset.theme==='dark';document.body.dataset.theme=dark?'light':'dark';document.querySelector('#themeBtn').textContent=dark?'☾ 深色模式':'☀ 一般模式';localStorage.setItem('eightTheme',document.body.dataset.theme)});
document.body.dataset.theme=localStorage.getItem('eightTheme')||'dark';
document.querySelector('#businessStart')?.addEventListener('change',refreshBusinessDay);document.querySelector('#businessEnd')?.addEventListener('change',refreshBusinessDay);
document.querySelector('#saveBusinessHours')?.addEventListener('click',async()=>{const state=document.querySelector('#businessSaveState');const start=document.querySelector('#businessStart').value,end=document.querySelector('#businessEnd').value;state.textContent='儲存中…';try{const r=await api('settings.update',{settings:{businessStart:start,businessEnd:end}});CONFIG.businessStart=r.settings.businessStart;CONFIG.businessEnd=r.settings.businessEnd;localStorage.removeItem('eightBusinessStart');localStorage.removeItem('eightBusinessEnd');refreshBusinessDay();state.textContent='已同步到資料庫'}catch(err){state.textContent='儲存失敗：'+err.message}setTimeout(()=>state.textContent='',2200)});
const now=new Date(),first=new Date(now.getFullYear(),now.getMonth(),1);const rf=document.querySelector('#rangeFrom'),rt=document.querySelector('#rangeTo');if(rf)rf.value=localISO(first);if(rt)rt.value=localISO(now);
document.querySelector('#refreshBtn')?.addEventListener('click',async()=>{try{await boot(true);if(typeof loadEvents==='function')await loadEvents(true)}catch(e){console.error('V3 refresh failed',e)}});
(async()=>{try{await boot(false)}catch(e){console.error('V3 boot failed',e)}finally{try{startDeltaSync()}catch(e){console.error('V3 delta sync start failed',e)}}})();
document.querySelector('#addMemberBtn')?.addEventListener('click',()=>openMemberModal());
document.querySelectorAll('[data-close-member]').forEach(x=>x.addEventListener('click',closeMemberModal));
document.querySelector('#memberForm')?.addEventListener('submit',saveMember);
document.querySelector('#memberSearch')?.addEventListener('input',()=>{clearTimeout(MEMBER_SEARCH_TIMER);MEMBER_SEARCH_TIMER=setTimeout(()=>{if(typeof window.renderMemberRows==='function')window.renderMemberRows();else renderMembers()},120)});


document.querySelector('#members tbody')?.addEventListener('click',async e=>{const edit=e.target.closest('.edit-member');if(edit){const m=MEMBER_ROWS.find(x=>x.memberKey===edit.dataset.key);if(m)openMemberModal(m);return}const del=e.target.closest('.delete-member');if(!del)return;const m=MEMBER_ROWS.find(x=>x.memberKey===del.dataset.key);if(!m)return;if(!confirm('確定永久刪除會員「'+m.name+'」（'+m.memberId+'）？\n\n這會刪除會員主表與會員 META 資料。'))return;if(!confirm('再次確認：永久刪除後無法從會員頁復原。確定刪除？'))return;del.disabled=true;try{await api('member.delete',{memberKey:m.memberKey,expectedRevision:m.revision});MEMBER_ROWS=MEMBER_ROWS.filter(x=>x.memberKey!==m.memberKey);renderMembers();document.querySelector('#kMembers').textContent=money(MEMBER_ROWS.filter(x=>x.status!=='inactive').length)}catch(err){const msg={MEMBER_SOURCE_DUPLICATE_ID:'此 POKER FANS ID 有重複資料，為避免刪錯已停止刪除',MEMBER_NOT_FOUND:'找不到此會員'}[err.message]||err.message;alert('刪除失敗：'+msg);del.disabled=false}});

const EVENT_PRESETS={3400:[3400,400,3400,400],6600:[6600,600,6600,600],11000:[11000,1000,11000,1000],21500:[21500,1500,21500,1500],32000:[32000,2000,32000,2000]};
function openEventModal(){document.querySelector('#eventForm').reset();const d=document.querySelector('#eventDate').value||businessDate();document.querySelector('#eventBusinessDate').value=d;document.querySelector('#eventLevel').value='3400';const p=EVENT_PRESETS['3400'];document.querySelector('#eventBuyinTotal').value=p[0];document.querySelector('#eventBuyinAdmin').value=p[1];document.querySelector('#eventRebuyTotal').value=p[2];document.querySelector('#eventRebuyAdmin').value=p[3];document.querySelector('#eventFreeAdminFrom').value=11;document.querySelector('#eventJP').value=3;document.querySelector('#eventICMRate').value=3;document.querySelector('#eventICMRound').value=100;const count=(window.EIGHT_EVENTS||[]).length+1;document.querySelector('#eventName').value='EPC#'+count+' 3400 限時錦標賽';document.querySelector('#eventFormState').textContent='';document.querySelector('#eventModal').hidden=false}
function closeEventModal(){document.querySelector('#eventModal').hidden=true}
{const ed=document.querySelector('#eventDate');if(ed)ed.value=businessDate();}
document.querySelector('#eventTodayBtn')?.addEventListener('click',()=>document.querySelector('#eventDate').value=businessDate());
document.querySelector('#createEventBtn')?.addEventListener('click',openEventModal);
document.querySelectorAll('[data-close-event]').forEach(x=>x.addEventListener('click',closeEventModal));
document.querySelector('#eventLevel')?.addEventListener('change',e=>{const p=EVENT_PRESETS[e.target.value];if(p){document.querySelector('#eventBuyinTotal').value=p[0];document.querySelector('#eventBuyinAdmin').value=p[1];document.querySelector('#eventRebuyTotal').value=p[2];document.querySelector('#eventRebuyAdmin').value=p[3]}const n=document.querySelector('#eventName'),count=(window.EIGHT_EVENTS||[]).length+1;if(/^EPC#\d+\s/.test(n.value)||!n.value.trim())n.value='EPC#'+count+' '+(e.target.value==='custom'?'自訂':e.target.value)+' 限時錦標賽'});
function bridgeV3Activities_(events,playersByEvent){if(!window.db)return;window.db.events=window.db.events||[];(events||[]).forEach(v=>{let e=window.db.events.find(x=>String(x.id)===String(v.eventId));if(!e){e={id:v.eventId,players:[]};window.db.events.push(e)}Object.assign(e,{id:v.eventId,date:v.businessDate,businessDate:v.businessDate,name:v.name,startTime:v.startTime,level:v.level,status:v.status,buyin:v.buyin,fee:v.fee,buyinTotal:v.buyinTotal,buyinAdmin:v.buyinAdmin,rebuyTotal:v.rebuyTotal,rebuyAdmin:v.rebuyAdmin,freeAdminFrom:v.freeAdminFrom,jpRate:v.jpRate,icmRate:v.icmRate,icmRound:v.icmRound,revision:v.revision});if(playersByEvent&&playersByEvent[v.eventId])e.players=playersByEvent[v.eventId].map(p=>({memberId:p.memberId,memberKey:p.memberKey,name:p.name,buyin:p.buyin,rebuy:p.rebuy,entries:p.entries,chips:p.chips,prize:p.prize,group:p.group,earlyDiscount:p.earlyDiscount,lateDiscount:p.lateDiscount,otherDiscount:p.otherDiscount,revision:p.revision}))})}
function renderEvents(rows=[]){window.EIGHT_EVENTS=rows;bridgeV3Activities_(rows);const el=document.querySelector('#eventList');if(!rows.length){el.className='empty';el.innerHTML='目前營業日尚無賽事';return}el.className='event-list';const stat=(k,v,moneyFmt=false)=>'<div class="event-stat"><small>'+k+'</small><b>'+(moneyFmt?money(v):esc(v??0))+'</b></div>';el.innerHTML=rows.map(x=>{const z=x.summary||{};return '<div class="event-row event-row-rich" data-event-id="'+esc(x.eventId)+'"><div class="event-main"><div><b>'+esc(x.name||'未命名賽事')+'</b><small>'+esc(x.businessDate||'')+' · '+esc(x.startTime||'')+' · '+esc(x.level||'自訂')+' · '+(x.status==='settled'?'已結算':'進行中')+'</small></div><div class="event-actions"><button class="secondary enter-event" data-id="'+esc(x.eventId)+'">進入</button>'+(x.status==='settled'?'<button class="secondary unlock-event" data-id="'+esc(x.eventId)+'">解鎖編輯</button>':'')+'<button class="danger delete-event" data-id="'+esc(x.eventId)+'">刪除</button></div></div><div class="event-stats">'+stat('參賽人數',z.participants||0)+stat('重買人數',z.rebuyPeople||0)+stat('總組數',z.totalEntries||0)+stat('總買入',z.totalGross||0,true)+stat('早鳥',z.earlyDiscount||0,true)+stat('晚鳥',z.lateDiscount||0,true)+stat('重買優惠',z.rebuyDiscount||0,true)+stat('組數優惠',z.entryDiscount||0,true)+stat('其他優惠',z.otherDiscount||0,true)+stat('總獎金',z.prizePool||0,true)+stat('實收行政費',z.adminNet||0,true)+stat('JP',z.jp||0,true)+'</div></div>'}).join('')}
let EVENTS_CACHE_DATE='',EVENTS_LAST_SYNC=0;
function showCachedEvents(){
 const date=document.querySelector('#eventDate').value||businessDate(),cacheKey='eightEvents:'+date;
 if(EVENTS_CACHE_DATE===date&&(window.EIGHT_EVENTS||[]).length){renderEvents(window.EIGHT_EVENTS);return true}
 let cached=[];try{cached=JSON.parse(localStorage.getItem(cacheKey)||'[]')}catch(_){}
 EVENTS_CACHE_DATE=date;renderEvents(cached);return cached.length>0
}
async function loadEvents(force=false){
 const date=document.querySelector('#eventDate').value||businessDate(),cacheKey='eightEvents:'+date,hadCache=showCachedEvents();
 if(!force&&hadCache)return;
 try{const r=await api('event.list',{businessDate:date}),rows=r.events||[];if(EVENTS_CACHE_DATE!==date)return;renderEvents(rows);EVENTS_LAST_SYNC=Date.now();try{localStorage.setItem(cacheKey,JSON.stringify(rows))}catch(_){}}
 catch(err){if(err.message!=='UNKNOWN_ACTION')console.error(err)}
}
document.querySelector('#eventDate')?.addEventListener('change',()=>loadEvents(false));
document.querySelector('#eventForm')?.addEventListener('submit',async e=>{e.preventDefault();const state=document.querySelector('#eventFormState');const level=document.querySelector('#eventLevel').value,count=(window.EIGHT_EVENTS||[]).length+1;let eventName=document.querySelector('#eventName').value.trim();if(!eventName)eventName='EPC#'+count+' '+(level==='custom'?'自訂':level)+' 限時錦標賽';const buyinTotal=Number(document.querySelector('#eventBuyinTotal').value||0),buyinAdmin=Number(document.querySelector('#eventBuyinAdmin').value||0),rebuyTotal=Number(document.querySelector('#eventRebuyTotal').value||0),rebuyAdmin=Number(document.querySelector('#eventRebuyAdmin').value||0);const event={name:eventName,businessDate:document.querySelector('#eventBusinessDate').value,startTime:document.querySelector('#eventStartTime').value,regClose:document.querySelector('#eventRegClose').value,level,buyin:Math.max(0,buyinTotal-buyinAdmin),fee:buyinAdmin,buyinTotal,buyinAdmin,rebuyTotal,rebuyAdmin,freeAdminFrom:Number(document.querySelector('#eventFreeAdminFrom').value||11),jpRate:Number(document.querySelector('#eventJP').value||0),icmRate:Number(document.querySelector('#eventICMRate').value||0),icmRound:Number(document.querySelector('#eventICMRound').value||100)};state.textContent='建立中…';try{const created=await api('event.create',{event});state.textContent='建立成功';state.className='form-state good';document.querySelector('#eventDate').value=event.businessDate;closeEventModal();if(created.event){window.EIGHT_EVENTS=[...(window.EIGHT_EVENTS||[]),created.event];renderEvents(window.EIGHT_EVENTS);try{localStorage.setItem('eightEvents:'+event.businessDate,JSON.stringify(window.EIGHT_EVENTS))}catch(_){}}}catch(err){state.textContent='建立失敗：'+err.message;state.className='form-state bad'}});
let ACTIVE_EVENT=null,EVENT_PLAYERS=[];
function openPlayersModal(eventId){ACTIVE_EVENT=eventId;const ev=(window.EIGHT_EVENTS||[]).find(x=>x.eventId===eventId);document.querySelector('#eventPlayersTitle').textContent=ev?.name||'賽事玩家';document.querySelector('#eventPlayersMeta').textContent=(ev?.businessDate||'')+' '+(ev?.startTime||'');document.querySelector('#eventMemberSearch').value='';document.querySelector('#eventMemberMatches').innerHTML='';document.querySelector('#eventPlayersModal').hidden=false;loadEventPlayers()}
function closePlayersModal(){document.querySelector('#eventPlayersModal').hidden=true;ACTIVE_EVENT=null}
async function loadEventPlayers(){if(!ACTIVE_EVENT)return;try{const r=await api('player.list',{eventId:ACTIVE_EVENT});EVENT_PLAYERS=r.players||[];const ev=(window.EIGHT_EVENTS||[]).find(x=>x.eventId===ACTIVE_EVENT);if(ev)bridgeV3Activities_([ev],{[ACTIVE_EVENT]:EVENT_PLAYERS});renderEventPlayers()}catch(err){EVENT_PLAYERS=[];renderEventPlayers()}}
function renderEventPlayers(){const el=document.querySelector('#eventPlayerList');document.querySelector('#eventPlayerCount').textContent=EVENT_PLAYERS.length+' 人';if(!EVENT_PLAYERS.length){el.className='empty';el.innerHTML='尚未加入玩家';return}el.className='player-list';el.innerHTML=EVENT_PLAYERS.map(p=>'<div class="player-row player-row-wide"><div><b>'+esc(p.name||'')+'</b><small>'+esc(p.memberId||'')+'</small></div><div class="player-fields"><label>組數<input class="entry-count" data-key="'+esc(p.memberKey)+'" type="number" min="1" value="'+esc(p.entries||1)+'"></label><label>早鳥<input class="early-discount" data-key="'+esc(p.memberKey)+'" type="number" min="0" value="'+esc(p.earlyDiscount||0)+'"></label><label>晚鳥<input class="late-discount" data-key="'+esc(p.memberKey)+'" type="number" min="0" value="'+esc(p.lateDiscount||0)+'"></label><label>重買優惠<input class="rebuy-discount" data-key="'+esc(p.memberKey)+'" type="number" min="0" value="'+esc(p.rebuyDiscount||0)+'"></label><label>組數優惠<input class="entry-discount" data-key="'+esc(p.memberKey)+'" type="number" min="0" value="'+esc(p.entryDiscount||0)+'"></label><label>其他優惠<input class="other-discount" data-key="'+esc(p.memberKey)+'" type="number" min="0" value="'+esc(p.otherDiscount||0)+'"></label><label>分帳群組<input class="settlement-group" data-key="'+esc(p.memberKey)+'" value="'+esc(p.group||'')+'"></label><label>籌碼<input class="chip-count" data-key="'+esc(p.memberKey)+'" type="number" min="0" value="'+esc(p.chips||0)+'"></label><button class="danger remove-player" data-key="'+esc(p.memberKey)+'">移除</button></div></div>').join('')}
document.querySelectorAll('[data-close-players]').forEach(x=>x.addEventListener('click',closePlayersModal));

let WORKSPACE_EVENT=null,WORKSPACE_PLAYERS=[],WS_SAVE_TIMERS=new Map(),WS_PENDING_PATCH=new Map(),WS_PLAYER_SYNC=new Map();
function eventCalcPlayer(p,e){
 const buyin=Math.max(0,Number(p.buyin??1)),rebuy=Math.max(0,Number(p.rebuy??0)),groups=buyin+rebuy,early=Math.max(0,Number(p.earlyDiscount||0)),late=Math.max(0,Number(p.lateDiscount||0)),other=Math.max(0,Number(p.otherDiscount||0)),manual=early+late+other;
 const custom=Number(e.buyinTotal||0)>0;
 if(custom){
  const buyinTotal=Number(e.buyinTotal||0),buyinAdmin=Number(e.buyinAdmin||0),rebuyTotal=Number(e.rebuyTotal||0),rebuyAdmin=Number(e.rebuyAdmin||0),threshold=Math.max(1,Math.floor(Number(e.freeAdminFrom||11)-1));
  const normalRebuyGroups=Math.max(0,Math.min(groups,threshold)-1),overbuyGroups=Math.max(0,groups-threshold),rd=Math.max(0,buyinTotal-rebuyTotal)*normalRebuyGroups;
  let overbuyPer=Math.max(0,buyinAdmin-rebuyAdmin);if(overbuyPer===0||overbuyPer>rebuyAdmin)overbuyPer=rebuyAdmin;
  const overbuy=overbuyPer*overbuyGroups,accountingOverbuy=buyinAdmin*overbuyGroups,gross=groups*buyinTotal,discount=rd+accountingOverbuy+manual;
  return{buyin,rebuy,groups,gross,early,late,rd,overbuy,accountingOverbuy,other,discount,paid:Math.max(0,gross-discount)};
 }
 const poolUnit=Math.max(0,Number(e.buyin||0)),admin=Math.max(0,Number(e.fee||0)),gross=groups*(poolUnit+admin),half=Math.max(0,Math.min(groups,10)-1),free=Math.max(0,groups-10),rd=half*admin*.5,overbuy=free*admin,discount=rd+overbuy+manual;
 return{buyin,rebuy,groups,gross,early,late,rd,overbuy,accountingOverbuy:overbuy,other,discount,paid:Math.max(0,gross-discount)};
}
window.applyPhoneStacksToV3=async function(eventId,stacks){const rows=(WORKSPACE_PLAYERS||[]);const byId=new Map(rows.map(p=>[String(p.memberId),p]));const updates=[];(stacks||[]).forEach(x=>{const p=byId.get(String(x.memberId));const chips=Number(x.stack);if(p&&Number.isFinite(chips)&&chips>=0&&Number(p.chips||0)!==chips)updates.push({memberKey:p.memberKey,chips,expectedRevision:p.revision})});if(!updates.length)return{ok:true,updated:0};const r=await api('player.stackBatch',{eventId,stacks:updates});(r.players||[]).forEach(p=>{const i=WORKSPACE_PLAYERS.findIndex(x=>x.memberKey===p.memberKey);if(i>=0)WORKSPACE_PLAYERS[i]={...WORKSPACE_PLAYERS[i],...p}});bridgeV3Activities_([WORKSPACE_EVENT],{[eventId]:WORKSPACE_PLAYERS});renderWorkspace();return{ok:true,updated:(r.players||[]).length}}
function showOnlyPage(id){goPage(id)}
async function openEventWorkspace(id){
 WORKSPACE_EVENT=(window.EIGHT_EVENTS||[]).find(x=>x.eventId===id);if(!WORKSPACE_EVENT)return;
 ACTIVE_EVENT=id;try{WORKSPACE_PLAYERS=JSON.parse(localStorage.getItem('eightEventPlayers:'+id)||'[]')}catch(_){WORKSPACE_PLAYERS=[]}
 showOnlyPage('eventWorkspace');document.querySelector('#workspaceTitle').textContent=WORKSPACE_EVENT.name;
 document.querySelector('#workspaceMeta').textContent=(WORKSPACE_EVENT.businessDate||'')+' · '+(WORKSPACE_EVENT.startTime||'')+' · '+(WORKSPACE_EVENT.level||'');
 document.querySelector('#workspaceMemberSearch').value='';document.querySelector('#workspaceGroup').value='';filterWorkspaceMembers('');renderWorkspace();
 if(!WORKSPACE_PLAYERS.length)loadWorkspacePlayers(true);
}
async function loadWorkspacePlayers(force=false){if(!ACTIVE_EVENT)return;const id=ACTIVE_EVENT;if(!force&&WORKSPACE_PLAYERS.length)return;try{const r=await api('player.list',{eventId:id});if(ACTIVE_EVENT!==id)return;WORKSPACE_PLAYERS=r.players||[];bridgeV3Activities_([WORKSPACE_EVENT],{[id]:WORKSPACE_PLAYERS});WS_PLAYER_SYNC.set(id,Date.now());try{localStorage.setItem('eightEventPlayers:'+id,JSON.stringify(WORKSPACE_PLAYERS))}catch(_){}renderWorkspace();filterWorkspaceMembers(document.querySelector('#workspaceMemberSearch').value)}catch(err){if(ACTIVE_EVENT===id&&!WORKSPACE_PLAYERS.length)alert('載入玩家失敗：'+err.message)}}
function filterWorkspaceMembers(q){
 q=memberSearchText(q);const joined=new Set(WORKSPACE_PLAYERS.map(x=>x.memberKey));
 const list=MEMBER_ROWS.filter(m=>!joined.has(m.memberKey)&&(!q||[m.memberId,m.name,m.nickname,m.group].some(v=>memberSearchText(v).includes(q)))).slice(0,30);
 const sel=document.querySelector('#workspaceMemberSelect');sel.innerHTML=list.length?list.map(m=>'<option value="'+esc(m.memberKey)+'">'+esc(m.name)+' ('+esc(m.memberId)+')'+(m.nickname?' · '+esc(m.nickname):'')+'</option>').join(''):'<option value="">找不到會員</option>';
 if(list.length===1)sel.value=list[0].memberKey;
}
function renderWorkspace(){
 const e=WORKSPACE_EVENT;if(!e)return;const body=document.querySelector('#workspacePlayerRows');document.querySelector('#workspacePlayerCount').textContent=WORKSPACE_PLAYERS.length+' 人';
 let totals={buyin:0,rebuy:0,groups:0,gross:0,early:0,late:0,rd:0,overbuy:0,accountingOverbuy:0,other:0,paid:0};
 body.innerHTML=WORKSPACE_PLAYERS.map(p=>{const c=eventCalcPlayer(p,e);Object.keys(totals).forEach(k=>totals[k]+=Number(c[k]||0));
 return '<tr data-key="'+esc(p.memberKey)+'"><td class="name">'+esc(p.name||'')+'</td><td>'+esc(p.memberId||'')+'</td>'+
 '<td><input class="ws-buyin" type="number" min="0" value="'+c.buyin+'"></td><td><input class="ws-rebuy" type="number" min="0" value="'+c.rebuy+'"></td><td class="ws-groups">'+c.groups+'</td>'+
 '<td><input class="ws-early" type="number" min="0" value="'+c.early+'"></td><td><input class="ws-late" type="number" min="0" value="'+c.late+'"></td><td class="ws-auto">'+money(c.rd)+'</td>'+
 '<td class="ws-auto">'+money(c.overbuy)+'</td><td><input class="ws-other" type="number" min="0" value="'+c.other+'"></td><td class="ws-paid">'+money(c.paid)+'</td>'+
 '<td><input class="ws-chips" type="number" min="0" value="'+Number(p.chips||0)+'"></td><td><button class="danger ws-remove">移除</button></td><td><input class="ws-group" value="'+esc(p.group||'')+'"></td></tr>'}).join('');
 document.querySelector('#workspacePlayerTotals').innerHTML='<tr><td colspan="2">合計</td><td>'+totals.buyin+'</td><td>'+totals.rebuy+'</td><td>'+totals.groups+'</td><td>'+money(totals.early)+'</td><td>'+money(totals.late)+'</td><td>'+money(totals.rd)+'</td><td>'+money(totals.overbuy)+'</td><td>'+money(totals.other)+'</td><td>'+money(totals.paid)+'</td><td colspan="3"></td></tr>';
 const adminGross=totals.buyin*Number(e.buyinAdmin||0)+totals.rebuy*Number(e.rebuyAdmin||0),discounts=totals.early+totals.late+totals.rd+totals.accountingOverbuy+totals.other;
 const prizeBase=totals.buyin*Math.max(0,Number(e.buyinTotal||0)-Number(e.buyinAdmin||0))+totals.rebuy*Math.max(0,Number(e.rebuyTotal||0)-Number(e.rebuyAdmin||0));
 const jp=prizeBase>0?Math.ceil((prizeBase*Number(e.jpRate||0)/100)/100)*100:0,unit=Math.max(1,Number(e.icmRound||100)),prize=Math.floor(Math.max(0,prizeBase-jp)/unit)*unit;
 const k=[['參賽人數',WORKSPACE_PLAYERS.length],['重買人數',WORKSPACE_PLAYERS.filter(p=>Number(p.rebuy||0)>0).length],['總組數',totals.groups],['總買入',money(totals.gross)],['總優惠',money(discounts)],['總獎金',money(prize)],['實收行政費',money(Math.max(0,adminGross-discounts))],['JP',money(jp)]];
 document.querySelector('#workspaceKpis').innerHTML=k.map(x=>'<div class="card event-kpi"><small>'+x[0]+'</small><b>'+x[1]+'</b></div>').join('');
}
function syncWorkspaceEventSummaryLocal(){
 if(!WORKSPACE_EVENT)return;
 let totals={buyin:0,rebuy:0,groups:0,gross:0,early:0,late:0,rd:0,overbuy:0,accountingOverbuy:0,other:0};
 WORKSPACE_PLAYERS.forEach(p=>{const c=eventCalcPlayer(p,WORKSPACE_EVENT);for(const k of Object.keys(totals))totals[k]+=Number(c[k]||0)});
 const e=WORKSPACE_EVENT,adminGross=totals.buyin*Number(e.buyinAdmin||0)+totals.rebuy*Number(e.rebuyAdmin||0);
 const prizeBase=totals.buyin*Math.max(0,Number(e.buyinTotal||0)-Number(e.buyinAdmin||0))+totals.rebuy*Math.max(0,Number(e.rebuyTotal||0)-Number(e.rebuyAdmin||0));
 const discounts=totals.early+totals.late+totals.rd+totals.accountingOverbuy+totals.other,unit=Math.max(1,Number(e.icmRound||100));
 e.summary={participants:WORKSPACE_PLAYERS.length,rebuyPeople:WORKSPACE_PLAYERS.filter(p=>Number(p.rebuy||0)>0).length,totalEntries:totals.groups,totalGross:totals.gross,earlyDiscount:totals.early,lateDiscount:totals.late,rebuyDiscount:totals.rd,entryDiscount:totals.overbuy,otherDiscount:totals.other,prizePool:Math.floor(Math.max(0,prizeBase-(prizeBase>0?Math.ceil((prizeBase*Number(e.jpRate||0)/100)/100)*100:0))/unit)*unit,adminNet:Math.max(0,adminGross-discounts),jp:(prizeBase>0?Math.ceil((prizeBase*Number(e.jpRate||0)/100)/100)*100:0)};
 const date=e.businessDate||document.querySelector('#eventDate').value||businessDate();
 try{localStorage.setItem('eightEvents:'+date,JSON.stringify(window.EIGHT_EVENTS||[]))}catch(_){}
}
async function addWorkspacePlayer(){
 const key=document.querySelector('#workspaceMemberSelect').value;if(!key)return;
 const btn=document.querySelector('#workspaceAddPlayer'),m=MEMBER_ROWS.find(x=>x.memberKey===key),group=document.querySelector('#workspaceGroup').value.trim()||m?.group||'';
 if(!m||WORKSPACE_PLAYERS.some(x=>x.memberKey===key))return;
 const optimistic={memberKey:key,memberId:m.memberId,name:m.name,buyin:1,rebuy:0,group,chips:0};
 WORKSPACE_PLAYERS.push(optimistic);renderWorkspace();syncWorkspaceEventSummaryLocal();filterWorkspaceMembers('');try{localStorage.setItem('eightEventPlayers:'+ACTIVE_EVENT,JSON.stringify(WORKSPACE_PLAYERS))}catch(_){}
 document.querySelector('#workspaceMemberSearch').value='';document.querySelector('#workspaceGroup').value='';btn.disabled=true;
 try{
   const eventId=ACTIVE_EVENT,r=await api('player.add',{eventId:ACTIVE_EVENT,memberKey:key});
   const p=WORKSPACE_PLAYERS.find(x=>x.memberKey===key);if(p&&r.player&&r.player.revision)p.revision=r.player.revision;
   if(group)queueWorkspacePlayerSave(key,{group});
   WS_PLAYER_SYNC.set(eventId,Date.now());btn.disabled=false;
   try{localStorage.setItem('eightEventPlayers:'+eventId,JSON.stringify(WORKSPACE_PLAYERS))}catch(_){};
 }catch(err){
   btn.disabled=false;
   WORKSPACE_PLAYERS=WORKSPACE_PLAYERS.filter(x=>x.memberKey!==key);renderWorkspace();syncWorkspaceEventSummaryLocal();filterWorkspaceMembers('');
   try{localStorage.setItem('eightEventPlayers:'+ACTIVE_EVENT,JSON.stringify(WORKSPACE_PLAYERS))}catch(_){}
   alert('加入失敗：'+err.message);
 }
}
document.querySelector('#eventList')?.addEventListener('click',e=>{
 const del=e.target.closest('.delete-event');if(del)return;
 const enter=e.target.closest('.enter-event'),row=e.target.closest('.event-row[data-event-id]'),id=enter?.dataset.id||row?.dataset.eventId;
 if(id)openEventWorkspace(id)
});
function returnToEventList(){
 const eventId=ACTIVE_EVENT,keys=[...WS_PENDING_PATCH.keys()],events=document.querySelector('#events'),workspace=document.querySelector('#eventWorkspace');
 document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));if(events)events.classList.add('active');if(workspace)workspace.classList.remove('active');
 document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.page==='events'));const t=document.querySelector('#pageTitle');if(t)t.textContent=pages.events;
 syncWorkspaceEventSummaryLocal();renderEvents(window.EIGHT_EVENTS||[]);
 ACTIVE_EVENT=null;WORKSPACE_EVENT=null;
 if(eventId&&keys.length)Promise.allSettled(keys.map(key=>flushWorkspacePlayerForEvent(eventId,key))).catch(console.error)
}
(()=>{const __el=document.querySelector('#backToEvents');if(__el)__el.onclick=returnToEventList})();
document.querySelector('#workspaceRefresh')?.addEventListener('click',()=>loadWorkspacePlayers(true));
document.querySelector('#workspaceMemberSearch')?.addEventListener('input',e=>filterWorkspaceMembers(e.target.value));
document.querySelector('#workspaceMemberSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addWorkspacePlayer()}});
document.querySelector('#workspaceAddPlayer')?.addEventListener('click',addWorkspacePlayer);
async function flushWorkspacePlayerForEvent(eventId,key){
 const patch=WS_PENDING_PATCH.get(key);if(!patch||!eventId)return;WS_PENDING_PATCH.delete(key);WS_SAVE_TIMERS.delete(key);
 try{const p=WORKSPACE_PLAYERS.find(x=>x.memberKey===key);const expectedRevision=p?.revision;const r=await api('player.update',{eventId:eventId,memberKey:key,patch:patch,expectedRevision});if(p&&r.player&&r.player.revision)p.revision=r.player.revision}
 catch(err){if(ACTIVE_EVENT===eventId){if(err.message==='STALE_WRITE')alert('資料已被其他裝置更新，已重新載入最新資料');else alert('更新失敗：'+err.message);await loadWorkspacePlayers()}else console.error('背景儲存失敗',err)}
}
async function flushWorkspacePlayer(key){return flushWorkspacePlayerForEvent(ACTIVE_EVENT,key)}
function queueWorkspacePlayerSave(key,patch){
 WS_PENDING_PATCH.set(key,Object.assign({},WS_PENDING_PATCH.get(key)||{},patch));
 if(WS_SAVE_TIMERS.has(key))clearTimeout(WS_SAVE_TIMERS.get(key));
 WS_SAVE_TIMERS.set(key,setTimeout(()=>flushWorkspacePlayer(key),250));
}
document.querySelector('#workspacePlayerRows')?.addEventListener('change',e=>{
 const tr=e.target.closest('tr[data-key]');if(!tr)return;const key=tr.dataset.key,p=WORKSPACE_PLAYERS.find(x=>x.memberKey===key);if(!p)return;let patch={};
 if(e.target.classList.contains('ws-buyin')){p.buyin=Math.max(0,Number(e.target.value||0));patch.buyin=p.buyin;patch.entries=p.buyin+Number(p.rebuy||0)}
 else if(e.target.classList.contains('ws-rebuy')){p.rebuy=Math.max(0,Number(e.target.value||0));patch.rebuy=p.rebuy;patch.entries=Number(p.buyin??1)+p.rebuy}
 else if(e.target.classList.contains('ws-early')){p.earlyDiscount=Number(e.target.value||0);patch.earlyDiscount=p.earlyDiscount}
 else if(e.target.classList.contains('ws-late')){p.lateDiscount=Number(e.target.value||0);patch.lateDiscount=p.lateDiscount}
 else if(e.target.classList.contains('ws-other')){p.otherDiscount=Number(e.target.value||0);patch.otherDiscount=p.otherDiscount}
 else if(e.target.classList.contains('ws-group')){p.group=e.target.value.trim();patch.group=p.group}
 else if(e.target.classList.contains('ws-chips')){p.chips=Number(e.target.value||0);patch.chips=p.chips}else return;
 renderWorkspace();syncWorkspaceEventSummaryLocal();try{localStorage.setItem('eightEventPlayers:'+ACTIVE_EVENT,JSON.stringify(WORKSPACE_PLAYERS))}catch(_){}queueWorkspacePlayerSave(key,patch)
});
document.querySelector('#workspacePlayerRows')?.addEventListener('click',async e=>{const b=e.target.closest('.ws-remove');if(!b)return;const tr=b.closest('tr[data-key]');if(!confirm('確定移除此玩家？'))return;const key=tr.dataset.key,old=[...WORKSPACE_PLAYERS];if(WS_SAVE_TIMERS.has(key))clearTimeout(WS_SAVE_TIMERS.get(key));WS_SAVE_TIMERS.delete(key);WS_PENDING_PATCH.delete(key);WORKSPACE_PLAYERS=WORKSPACE_PLAYERS.filter(x=>x.memberKey!==key);renderWorkspace();syncWorkspaceEventSummaryLocal();filterWorkspaceMembers(document.querySelector('#workspaceMemberSearch').value);api('player.delete',{eventId:ACTIVE_EVENT,memberKey:key,expectedRevision:old.find(x=>x.memberKey===key)?.revision}).then(()=>{}).catch(err=>{WORKSPACE_PLAYERS=old;renderWorkspace();syncWorkspaceEventSummaryLocal();alert('移除失敗：'+err.message)})});
document.querySelector('#workspaceSettle')?.addEventListener('click',async()=>{
 const btn=document.querySelector('#workspaceSettle');btn.disabled=true;
 try{
   for(const key of [...WS_PENDING_PATCH.keys()])await flushWorkspacePlayer(key);
   const current=(window.EIGHT_EVENTS||[]).find(x=>x.eventId===ACTIVE_EVENT);
   const legacyEvent=(window.db&&Array.isArray(window.db.events))?window.db.events.find(e=>String(e.id)===String(ACTIVE_EVENT)):null;
   const legacyPlayers=legacyEvent&&Array.isArray(legacyEvent.players)?legacyEvent.players:[];
   const prizes=(WORKSPACE_PLAYERS||[]).map(p=>{
     const lp=legacyPlayers.find(x=>String(x.memberKey||'')===String(p.memberKey||'')||String(x.memberId||'')===String(p.memberId||''));
     return{memberKey:p.memberKey,prize:Number(lp?.prize??p.prize??0)};
   });
   const r=await api('event.settle',{eventId:ACTIVE_EVENT,expectedRevision:current?.revision,prizes});
   window.EIGHT_SETTLEMENT_SNAPSHOT=r.snapshot;WORKSPACE_PLAYERS=(r.snapshot?.players||WORKSPACE_PLAYERS).map(p=>({...p,prize:Number(prizes.find(x=>x.memberKey===p.memberKey)?.prize??p.prize??0)}));
   if(current){current.status='settled';if(r.snapshot?.event?.revision)current.revision=r.snapshot.event.revision;if(r.accounting)current.summary={participants:r.accounting.participants,rebuyPeople:r.accounting.rebuyPeople,totalEntries:r.accounting.totalEntries,totalGross:r.accounting.totalGross,earlyDiscount:r.accounting.earlyDiscount,lateDiscount:r.accounting.lateDiscount,rebuyDiscount:r.accounting.rebuyDiscount,entryDiscount:r.accounting.entryDiscount,otherDiscount:r.accounting.otherDiscount,prizePool:r.accounting.prizePool,adminNet:r.accounting.adminNet,jp:r.accounting.jp};renderEvents(window.EIGHT_EVENTS)}
   alert('賽事已完成結算，帳務與 JP 已寫入。');
 }catch(err){alert('結算前同步失敗：'+err.message)}
 finally{btn.disabled=false}
});

document.querySelector('#eventList')?.addEventListener('click',async e=>{const b=e.target.closest('.unlock-event');if(!b)return;const id=b.dataset.id,ev=(window.EIGHT_EVENTS||[]).find(x=>x.eventId===id);if(!ev||!confirm('確定解鎖這場已結算賽事？\n解鎖後原帳務與 JP 會暫停計入，重新正式結算後覆蓋原紀錄。'))return;b.disabled=true;try{const r=await api('event.unlock',{eventId:id,expectedRevision:ev.revision});Object.assign(ev,r.event||{status:'open'});renderEvents(window.EIGHT_EVENTS);await renderDashboardSummaryV3();alert('已解鎖，可修改後重新正式結算。')}catch(err){alert('解鎖失敗：'+err.message)}finally{b.disabled=false}});
document.querySelector('#eventList')?.addEventListener('click',e=>{const b=e.target.closest('.delete-event');if(!b)return;if(!confirm('確定刪除此賽事？'))return;const id=b.dataset.id,old=[...(window.EIGHT_EVENTS||[])];window.EIGHT_EVENTS=old.filter(x=>x.eventId!==id);renderEvents(window.EIGHT_EVENTS);api('event.delete',{eventId:id,expectedRevision:old.find(x=>x.eventId===id)?.revision}).catch(err=>{window.EIGHT_EVENTS=old;renderEvents(old);alert('刪除失敗：'+err.message)})});

window.addEventListener('offline',()=>{const el=document.querySelector('#dbStatus');if(el){el.textContent='資料庫：網路離線';el.className='bad'}});
window.addEventListener('online',()=>{boot(false)});

async function renderDashboardSummaryV3(){
 const now=new Date(),ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0'),last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
 const from=document.querySelector('#dashboardDateFrom')?.value||ym+'-01',to=document.querySelector('#dashboardDateTo')?.value||ym+'-'+String(last).padStart(2,'0');
 const [a,all,jpRange,jpAll]=await Promise.all([api('dashboard.summary',{startDate:from,endDate:to}),api('dashboard.summary',{startDate:'',endDate:''}),api('jp.summary',{startDate:from,endDate:to}),api('jp.summary',{startDate:'',endDate:''})]),z=a.summary||{};
 const az=all.summary||{};const set=(id,v)=>{const e=document.querySelector(id);if(e)e.textContent=v};const newMembers=MEMBER_ROWS.filter(m=>m.createdAt&&m.createdAt>=from&&m.createdAt<=to).length;
 set('#kMembers',Number(MEMBER_ROWS.length).toLocaleString());set('#kNewMembers',Number(newMembers).toLocaleString());set('#kProfit',money(az.netIncome||0));set('#kMonthProfit',money(z.netIncome||0));set('#kJP',money(jpAll.total||0));set('#kRangeJP',money(jpRange.total||0));set('#kMonthExpense',money((z.totalDiscount||0)+(z.otherExpense||0)));set('#kMonthEvents',(z.eventCount||0)+' 場');
 const levels=Object.entries(z.levels||{}).map(([k,v])=>k+'：'+v+' 場').join('　｜　')||'尚無已結算賽事';set('#kLevelBreakdown',levels);
}
async function renderDashboardDailyReportV3(){
 const d=document.querySelector('#dashboardDailyDate')?.value||businessDate(),r=await api('dashboard.summary',{startDate:d,endDate:d}),z=r.summary||{};const set=(id,v)=>{const e=document.querySelector(id);if(e)e.textContent=v};
 set('#drEvents',(z.eventCount||0)+' 場');set('#drAdmin',money(z.adminGross||0));set('#drMembership',money(z.membershipIncome||0));set('#drDiscount',money(z.totalDiscount||0));set('#drOtherIncome',money(z.otherIncome||0));set('#drOtherExpense',money(z.otherExpense||0));set('#drNet',money(z.netIncome||0));set('#drJP',money(z.jp||0));
 const body=document.querySelector('#dashboardDailyItemRows');if(body)body.innerHTML=(r.rows||[]).map(x=>'<tr><td><span class="pos">收入</span></td><td>賽事</td><td>'+esc(x.eventName)+'</td><td>'+money(x.adminNet)+'</td><td>'+esc(x.level)+'</td></tr>').join('')||'<tr><td colspan="5" class="small">本日尚無已結算賽事</td></tr>';
}
window.renderDashboardSummary=renderDashboardSummaryV3;
window.renderDashboardDailyReport=renderDashboardDailyReportV3;

async function renderSettlementManagerV3(){
 const from=document.querySelector('#settlementDateFrom')?.value||'',to=document.querySelector('#settlementDateTo')?.value||'',r=await api('settlement.report',{startDate:from,endDate:to}),z=r.report||{};
 const body=document.querySelector('#settlementDayRows');if(!body)return;const by={};(z.events||[]).forEach(e=>{if(!by[e.businessDate])by[e.businessDate]={date:e.businessDate,events:0};by[e.businessDate].events++});
 body.innerHTML=Object.values(by).sort((a,b)=>b.date.localeCompare(a.date)).map(x=>'<tr><td>'+x.date+'</td><td>'+x.events+'</td><td>—</td><td>—</td><td>—</td><td>—</td><td><button type="button" onclick="openSettlementDayV3(\''+x.date+'\')">查看</button></td></tr>').join('')||'<tr><td colspan="7" class="small">此區間尚無已結算賽事</td></tr>';
}
async function openSettlementDayV3(date){
 const r=await api('settlement.report',{businessDate:date}),z=r.report||{};document.querySelector('#settlementListView').style.display='none';document.querySelector('#settlementDetailView').style.display='block';document.querySelector('#settlementDetailDate').textContent=date;document.querySelector('#dailyDate').value=date;
 const set=(id,v)=>{const e=document.querySelector(id);if(e)e.textContent=v};set('#dEvents',z.eventCount||0);set('#dMembers',z.memberCount||0);set('#dPaid',money(z.totalPaid||0));set('#dPrize',money(z.totalPrize||0));
 const host=document.querySelector('#dailyGroupDetail');if(host)host.innerHTML=(z.groups||[]).map(g=>'<div class="card tablewrap"><h3>'+esc(g.group)+'</h3><div class="grid"><div class="kpi"><div class="l">群組實付</div><div class="v">'+money(g.totalPaid)+'</div></div><div class="kpi"><div class="l">群組領回</div><div class="v">'+money(g.totalPrize)+'</div></div><div class="kpi"><div class="l">群組輸贏</div><div class="v">'+money(g.net)+'</div></div></div><table><thead><tr><th>會員</th><th>實付</th><th>領回</th><th>輸贏</th></tr></thead><tbody>'+g.members.map(m=>'<tr><td>'+esc(m.name)+' <span class="small">'+esc(m.memberId)+'</span></td><td>'+money(m.paid)+'</td><td>'+money(m.prize)+'</td><td>'+money(m.net)+'</td></tr>').join('')+'</tbody></table></div>').join('')||'<div class="card small">本日尚無分帳資料</div>';
}
window.renderSettlementManager=renderSettlementManagerV3;
window.openSettlementDayV3=openSettlementDayV3;

async function addAccountingItemV3(){
 const date=document.querySelector('#dailyDate')?.value||document.querySelector('#accountingCreateDate')?.value||businessDate(),name=(document.querySelector('#accountingItemName')?.value||'').trim(),amount=Number(document.querySelector('#accountingItemAmount')?.value||0);let type=document.querySelector('#accountingItemType')?.value||'income';const preset=document.querySelector('#accountingItemPreset')?.value||'';if(!preset){if(/入會費/.test(name))type='membership';else if(/薪資|工資|餐費|水電|耗材|維修|租金|支出|費用/.test(name))type='expense'}if(!name||amount<=0)return alert('請輸入項目名稱與大於 0 的金額');await api('accounting.item.create',{item:{businessDate:date,type,name,amount}});document.querySelector('#accountingItemName').value='';document.querySelector('#accountingItemAmount').value='';await renderDailyAccountingDetailV3(date);await renderDashboardSummaryV3();
}
async function deleteAccountingItemV3(id,rev){if(!confirm('確定要刪除這筆收支嗎？'))return;await api('accounting.item.delete',{itemId:id,expectedRevision:rev});await renderDailyAccountingDetailV3(document.querySelector('#dailyDate')?.value||businessDate());await renderDashboardSummaryV3()}
async function renderDailyAccountingDetailV3(date){
 date=date||document.querySelector('#dailyDate')?.value||businessDate();const r=await api('dashboard.summary',{startDate:date,endDate:date}),z=r.summary||{},items=r.items||[];const set=(id,v)=>{const e=document.querySelector(id);if(e)e.textContent=v};set('#aAdminGross',money(z.adminGross||0));set('#aMembershipIncome',money(z.membershipIncome||0));set('#aDiscountExpense',money(z.totalDiscount||0));set('#aAdminNet',money(z.adminNet||0));set('#aOtherIncomeTotal',money(z.otherIncome||0));set('#aOtherExpenseTotal',money(z.otherExpense||0));set('#aRevenue',money((z.adminNet||0)+(z.membershipIncome||0)+(z.otherIncome||0)));set('#aExpense',money(z.otherExpense||0));set('#aNet',money(z.netIncome||0));set('#aJP',money(z.jp||0));
 const body=document.querySelector('#accountingItemRows');if(body)body.innerHTML=items.map(x=>'<tr><td><span class="'+(x.type==='expense'?'neg':'pos')+'">'+(x.type==='membership'?'入會費收入':x.type==='expense'?'其他支出':'其他收入')+'</span></td><td>'+esc(x.name)+'</td><td>'+money(x.amount)+'</td><td><button class="danger" onclick="deleteAccountingItemV3(\''+x.itemId+'\','+x.revision+')">刪除</button></td></tr>').join('')||'<tr><td colspan="4" class="small">尚未新增入會費／其他收支</td></tr>';
}
window.addAccountingItem=addAccountingItemV3;window.deleteAccountingItemV3=deleteAccountingItemV3;

let EPC_ACTIVITY_SAVE_TIMER=null;
window.saveActivityCloudV3=function(){clearTimeout(EPC_ACTIVITY_SAVE_TIMER);EPC_ACTIVITY_SAVE_TIMER=setTimeout(async function(){if(!window.db||!window.db.activityManagement)return;try{const r=await api('activity.update',{data:window.db.activityManagement,expectedRevision:Number(window.EPC_ACTIVITY_REVISION||0)});window.EPC_ACTIVITY_REVISION=Number(r.revision||0)}catch(e){console.error('activity cloud save',e);try{const g=await api('activity.get',{});window.db.activityManagement=g.data||{};window.EPC_ACTIVITY_REVISION=Number(g.revision||0);if(typeof window.renderActivities==='function')window.renderActivities()}catch(_){}}},250)};


/* V3 bridge for the legacy member form in index.html.
   The visible member UI uses #mName/#mId/#mGroup/#mNote and inline addMember(),
   so route those legacy handlers to EPC MAIN V3 instead of the disabled legacy cloud API. */
function syncLegacyMemberFromV3_(m,note){
 if(!m)return;
 const legacy={id:m.memberId,name:m.name,nickname:m.nickname||'',group:m.group||'',note:note||'',memberKey:m.memberKey,revision:m.revision,createdDate:m.createdAt||'',source:'V3',history:[]};
 if(window.db&&Array.isArray(window.db.members)){
  const idx=window.db.members.findIndex(x=>String(x.memberKey||'')===String(m.memberKey||'')||String(x.id||'')===String(m.memberId||''));
  if(idx>=0)window.db.members[idx]={...window.db.members[idx],...legacy};
  else window.db.members.unshift(legacy);
 }
 const mi=MEMBER_ROWS.findIndex(x=>x.memberKey===m.memberKey);
 if(mi>=0)MEMBER_ROWS[mi]={...MEMBER_ROWS[mi],...m};
 else MEMBER_ROWS.unshift(m);
 try{localStorage.setItem('eightMemberCache',JSON.stringify(MEMBER_ROWS))}catch(_){}
 const k=document.querySelector('#kMembers');if(k)k.textContent=money(MEMBER_ROWS.length);
 if(typeof window.renderMemberRows==='function')window.renderMemberRows();else renderMembers();
}
window.addMember=async function(){
 if(window.editingMemberId)return window.saveMemberEdit();
 const name=document.querySelector('#mName')?.value.trim()||'';
 if(!name)return alert('請輸入會員名稱');
 const id=String(document.querySelector('#mId')?.value.trim()||nextMemberId()).toUpperCase();
 const group=document.querySelector('#mGroup')?.value.trim()||'';
 const note=document.querySelector('#mNote')?.value.trim()||'';
 const btn=document.querySelector('#memberSaveBtn');
 if(btn){btn.disabled=true;btn.textContent='新增中…'}
 try{
  const r=await api('member.create',{member:{memberId:id,name,group}});
  syncLegacyMemberFromV3_(r.member,note);
  ['mName','mId','mGroup','mNote'].forEach(x=>{const el=document.querySelector('#'+x);if(el)el.value=''});
  const s=document.querySelector('#memberSearch');if(s)s.value='';
  if(typeof window.actionMsg==='function')window.actionMsg('會員「'+name+'」已寫入 V3 與 Google Sheet');
  if(typeof window.setCloudState==='function')window.setCloudState('● V3 會員資料已同步');
 }catch(err){
  console.error('V3 add member failed',err);
  const msg={MEMBER_ID_ALREADY_EXISTS:'此會員 ID 已存在',MEMBER_REQUIRED:'會員 ID 與姓名為必填'}[err.message]||err.message;
  alert('新增會員失敗：'+msg);
 }finally{if(btn){btn.disabled=false;btn.textContent='新增會員'}}
};
window.epcV3SaveMemberEdit=async function(memberId){
 const id=String(memberId||document.querySelector('#mId')?.value||'').trim().toUpperCase();
 const legacy=window.db&&Array.isArray(window.db.members)?window.db.members.find(x=>String(x.id||'').trim().toUpperCase()===id):null;
 const row=MEMBER_ROWS.find(x=>String(x.memberKey||'')===String(legacy?.memberKey||'')||String(x.memberId||'').trim().toUpperCase()===id);
 if(!row)return alert('找不到此會員的 V3 資料，請先重新讀取會員');
 const name=document.querySelector('#mName')?.value.trim()||'';
 if(!name)return alert('請輸入會員名稱');
 const group=document.querySelector('#mGroup')?.value.trim()||'';
 const note=document.querySelector('#mNote')?.value.trim()||'';
 const btn=document.querySelector('#memberSaveBtn');
 if(btn){btn.disabled=true;btn.textContent='儲存中…'}
 try{
  const r=await api('member.update',{memberKey:row.memberKey,patch:{name,group},expectedRevision:row.revision});
  syncLegacyMemberFromV3_(r.member,note);
  if(typeof window.cancelMemberEdit==='function')window.cancelMemberEdit();
  if(typeof window.actionMsg==='function')window.actionMsg('會員「'+name+'」修改已同步至 V3');
 }catch(err){
  console.error('V3 member update failed',err);
  alert('修改會員失敗：'+err.message);
 }finally{if(btn)btn.disabled=false}
};
window.saveMemberEdit=function(){return window.epcV3SaveMemberEdit(document.querySelector('#mId')?.value||'')};


window.performDelMember=async function(id){
 const sid=String(id||'').trim();
 const legacy=window.db&&Array.isArray(window.db.members)?window.db.members.find(x=>String(x.id||'').trim()===sid):null;
 const row=MEMBER_ROWS.find(x=>String(x.memberKey||'')===String(legacy?.memberKey||'')||String(x.memberId||'').trim()===sid);
 if(!row)return alert('找不到此會員的 V3 資料，請先按重新讀取會員');
 const used=(window.db?.events||[]).some(e=>(e.players||[]).some(p=>String(p.memberId||'').trim()===sid));
 if(used)return alert('此會員已有賽事紀錄，不能直接刪除，以免破壞歷史帳務。');
 try{
  await api('member.delete',{memberKey:row.memberKey,expectedRevision:row.revision});
  MEMBER_ROWS=MEMBER_ROWS.filter(x=>x.memberKey!==row.memberKey);
  if(window.db&&Array.isArray(window.db.members))window.db.members=window.db.members.filter(x=>String(x.id||'').trim()!==sid);
  try{localStorage.setItem('eightMemberCache',JSON.stringify(MEMBER_ROWS))}catch(_){}
  if(typeof window.renderMemberRows==='function')window.renderMemberRows();else renderMembers();
  const k=document.querySelector('#kMembers');if(k)k.textContent=money(MEMBER_ROWS.length);
  if(typeof window.actionMsg==='function')window.actionMsg('會員已從 V3 刪除並同步');
 }catch(err){
  console.error('V3 member delete failed',err);
  alert('刪除會員失敗：'+err.message);
 }
};

})();
