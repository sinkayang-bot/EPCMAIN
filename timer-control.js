import {DEFAULT_LEVELS,newTimer,remaining,timeText,eventTotals,parseTime,validateLevels,timerAt} from './timer-core.js?v=20261022-auto6';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),demo=params.has('demo'),id=params.get('eventId'),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let event,timer,service,templates=[],busy=false,draft=structuredClone(DEFAULT_LEVELS),textLoaded=false,structureLoaded=false,textDirty=false,structureDirty=false,textRevision=0,structureRevision=0;
function canWrite(){try{return demo||window.parent!==window&&!window.parent.EPCMode.isView()}catch(_){return false}}
function message(s){$('message').textContent=s}
function update(){
 const now=Date.now(),state=timerAt(timer,now);
 const settled=['settled','已結算'].includes(event?.status),allowed=canWrite()&&!busy&&!settled&&!!event;
 $('mode').textContent=demo?'練習模式：不會寫入正式資料':canWrite()?'操作模式':'檢視模式：請在主後臺切換操作模式';
 document.querySelectorAll('[data-write]').forEach(el=>el.disabled=!allowed||(el.hasAttribute('data-command')&&!timer));
 $('timeNow').textContent=timer?timeText(remaining(state,now)):'未建立';
 const l=state?.levels[state.index];$('timeNow').style.color=l?.break?'#ff6464':'#fff';
 $('currentLevel').textContent=timer?(l?.break?'休息':'第 '+state.levels.slice(0,state.index+1).filter(l=>!l.break).length+' 級')+' · '+(state.running&&remaining(state,now)>0?'計時中':remaining(state,now)===0?'全部級別已結束':'已暫停'):'';
 $('toggle').textContent=state?.running&&remaining(state,now)>0?'暫停':'開始';
 if(document.activeElement!==$('remainingTime'))$('remainingTime').value=timer?timeText(remaining(state,now)):'';
 if(event){$('title').textContent=(event.name||'EPC')+' · 計時器';const s=eventTotals(event),n=v=>Number(v||0).toLocaleString();$('stats').textContent=`參賽 ${s.players} 人／重買 ${s.rebuyGroups} 組／總買入 ${s.groups} 組\n總籌碼 ${n(s.chips)}／平均籌碼 ${s.average===null?'—':n(s.average)}\n總獎池 $${n(s.pool)}（原獎池 $${n(s.gross)} − JP $${n(s.jp)}）`;$('stats').style.whiteSpace='pre-line'}
}
function levels(){
 $('levels').innerHTML=draft.map((l,i)=>`<div class="levelrow"><span>${l.break?'休':i+1}</span>${['sb','bb','ante','min'].map(k=>`<input type="number" aria-label="第${i+1}級${k}" data-index="${i}" data-field="${k}" data-write min="${k==='min'?0.1:0}" step="${k==='min'?0.1:1}" value="${l[k]??''}" ${l.break&&k!=='min'?'disabled':''}>`).join('')}<button data-remove="${i}" data-write aria-label="移除第${i+1}級">×</button></div>`).join('');update();
 // Disabled blind fields in breaks remain disabled even in operate mode.
 document.querySelectorAll('#levels [data-field]').forEach(el=>{if(draft[el.dataset.index].break&&el.dataset.field!=='min')el.disabled=true});
}
async function send(action,value,expected){if(!service||busy)return;busy=true;update();try{const t=await service.change(id,expected??(timer?.revision||0),action,value);timer=t;if(action==='settings'){textDirty=false;textRevision=t.revision}if(action==='structure'){structureDirty=false;structureRevision=t.revision}message('已同步到雲端與投影畫面')}catch(e){message('未儲存：'+e.message)}finally{busy=false;update()}}
function structure(){try{validateLevels(draft)}catch(e){return message(e.message)}if(timer&&!confirm('套用結構會重設本場級別與時間，確定套用？'))return;send('structure',draft,structureRevision)}
for(const [key,action,value] of [['toggle','toggle'],['reset','reset'],['previous','level',-1],['next','level',1],['minus','shift',-60],['plus','shift',60]])$(key).onclick=()=>send(action,value);
function setTime(){try{parseTime($('remainingTime').value);send('set',$('remainingTime').value)}catch(e){message(e.message)}}
 $('setTime').onclick=setTime;$('remainingTime').onkeydown=e=>{if(e.key==='Enter')setTime()};
 $('applyStructure').onclick=structure;
 $('saveText').onclick=()=>send('settings',{announcement:$('announcement').value,payoutInput:$('payoutInput').value},textRevision);
 for(const field of ['announcement','payoutInput'])$(field).oninput=()=>{if(!textDirty)textRevision=timer?.revision||0;textDirty=true};
 $('reloadSettings').onclick=()=>location.reload();
 $('previewTimer').onclick=()=>{if(!timer)return message('本場尚未產生計時器');$('timerPreviewFrame').src='timer.html?'+(demo?'demo=1':'eventId='+encodeURIComponent(id))+'&v=20261021-projection4';$('timerPreviewDialog').showModal()};$('closePreview').onclick=()=>$('timerPreviewDialog').close();
 function dirtyStructure(){if(!structureDirty)structureRevision=timer?.revision||0;structureDirty=true}
 $('addLevel').onclick=()=>{dirtyStructure();draft.push({sb:1000,bb:2000,ante:2000,min:20});levels()};$('addBreak').onclick=()=>{dirtyStructure();draft.push({break:true,min:5});levels()};
 $('levels').oninput=e=>{const el=e.target;if(el.dataset.field){dirtyStructure();draft[el.dataset.index][el.dataset.field]=Number(el.value)}};
 $('levels').onclick=e=>{const el=e.target.closest('[data-remove]');if(!el||!canWrite())return;if(draft.length===1)return message('至少保留一個級別');dirtyStructure();draft.splice(Number(el.dataset.remove),1);levels()};
try{
 if(!demo&&!id)throw Error('請從賽事管理選擇一場賽事。');
 service=demo?(await import('./timer-demo.js?v=20261022-auto6')).demoCloud():await(await import('./timer-cloud.js?v=20261022-auto6')).timerCloud();
 const error=e=>message('連線失敗：'+e.message);
 service.subscribeEvent(id,e=>{event=e;message(e?(timer?'已連線':'請回賽事設定選擇計時器範本並儲存，將自動產生本場計時器。'):'找不到賽事');update()},error);
 service.subscribeTimer(id,t=>{timer=t;if(!busy)message(['settled','已結算'].includes(event?.status)?'此場賽事已結算，僅供檢視。':t?'已連線，時間與公告同步中。':'請回賽事設定選擇計時器範本並儲存，將自動產生本場計時器。');if(t&&!textDirty){$('announcement').value=t.announcement||'';$('payoutInput').value=t.payoutInput||'';textRevision=t.revision;textLoaded=true}if(t&&!structureDirty){structureRevision=t.revision;if(!structureLoaded||JSON.stringify(draft)!==JSON.stringify(t.levels)){draft=structuredClone(t.levels);structureLoaded=true;levels()}}update()},error);
}catch(e){message(e.message)}
levels();setInterval(()=>{update();document.querySelectorAll('#levels [data-field]').forEach(el=>{if(draft[el.dataset.index]?.break&&el.dataset.field!=='min')el.disabled=true})},250);
