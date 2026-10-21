import {STANDARD_TEMPLATE,templateData} from './timer-store.js?v=20261021-3';
import {remaining,timeText,timerAt} from './timer-core.js?v=20261022-auto6';
const $=id=>document.getElementById(id),demo=new URLSearchParams(location.search).has('demo'),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Forward the existing terminal guard to a nested control frame.
try{if(parent!==window)Object.defineProperty(window,'EPCMode',{get:()=>parent.EPCMode})}catch(_){}
let service,templates=[],timers=[],events=[],selected='standard',revision=0,draft=structuredClone(STANDARD_TEMPLATE),busy=false;
function canWrite(){try{return demo||!!window.EPCMode&&!EPCMode.isView()}catch(_){return false}}
function status(text){$('message').textContent=text}
function controls(){const allowed=canWrite()&&!busy;$('mode').textContent=demo?'練習模式：不會寫入正式資料':allowed?'操作模式':'檢視模式：請在主後臺切換操作模式';document.querySelectorAll('[data-write]').forEach(el=>{el.disabled=!allowed;if(el.dataset.field&&draft.levels[el.dataset.index]?.break&&el.dataset.field!=='min')el.disabled=true})}
function drawLevels(){$('levelRows').innerHTML=draft.levels.map((l,i)=>`<div class="levelrow"><span>${l.break?'休':i+1}</span>${['sb','bb','ante','min'].map(k=>`<input aria-label="第${i+1}級${k}" type="number" data-index="${i}" data-field="${k}" data-write value="${l[k]??''}" min="${k==='min'?0.1:0}" step="${k==='min'?0.1:1}">`).join('')}<button aria-label="移除第${i+1}級" data-remove="${i}" data-write>×</button></div>`).join('');controls()}
function fillEditor(value){draft=structuredClone(value);revision=Number(value.revision)||0;$('templateName').value=draft.name||'';$('startingStack').value=draft.startingStack??300000;$('announcement').value=draft.announcement||'';$('payoutInput').value=draft.payoutInput||'';$('saveTemplate').textContent=selected!=='standard'&&selected!=='new'?'儲存範本修改':'儲存新範本';drawLevels()}
function options(){const values=[STANDARD_TEMPLATE,...templates],selectedId=$('templatePicker').value;$('templatePicker').innerHTML=values.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}${t.id==='standard'?'（內建）':''}</option>`).join('')+'<option value="new">新增範本</option>';if(values.some(t=>t.id===selectedId)||selectedId==='new')$('templatePicker').value=selectedId;$('demoTemplate').innerHTML=values.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}
function drawTimers(){const byId=new Map(events.map(e=>[String(e.eventId),e]));$('timerRows').innerHTML=timers.filter(t=>byId.has(String(t.eventId))).map(t=>{t=timerAt(t);const e=byId.get(String(t.eventId)),ended=['settled','已結算'].includes(e.status);return `<tr><td>${esc(e.name||t.eventName||'EPC')}</td><td>${esc(t.templateName||'既有計時器')}</td><td>${ended?'已結算':t.levels[t.index]?.break?'休息':t.running&&remaining(t)>0?'計時中':'暫停'}</td><td>${timeText(remaining(t))}</td><td><button data-event="${esc(t.eventId)}">${ended?'查看':'控制'}</button></td></tr>`}).join('')||'<tr><td colspan="5">尚無計時器。請到「賽事管理」選擇計時器範本，建立賽事時會一同產生。</td></tr>'}
function tab(which){$('templatePanel').hidden=which!=='templates';$('timerPanel').hidden=which!=='timers';$('templatesTab').setAttribute('aria-selected',String(which==='templates'));$('timersTab').setAttribute('aria-selected',String(which==='timers'))}
let previewDraft;
$('previewTemplate').onclick=()=>{try{previewDraft=templateData({...draft,name:$('templateName').value||'計時器範本預覽',startingStack:$('startingStack').value,announcement:$('announcement').value,payoutInput:$('payoutInput').value});$('templatePreviewFrame').src='timer.html?templatePreview=1&v=20261022-auto6';$('templatePreviewDialog').showModal()}catch(e){status(e.message)}};
$('closeTemplatePreview').onclick=()=>$('templatePreviewDialog').close();
addEventListener('message',e=>{if(e.origin===location.origin&&e.source===$('templatePreviewFrame').contentWindow&&e.data?.type==='epc-timer-preview-ready'&&previewDraft)e.source.postMessage({type:'epc-template-preview',template:previewDraft},location.origin)});
$('templatesTab').onclick=()=>tab('templates');$('timersTab').onclick=()=>tab('timers');
$('templatePicker').onchange=()=>{selected=$('templatePicker').value;fillEditor(selected==='new'?{...STANDARD_TEMPLATE,name:''}:templates.find(t=>t.id===selected)||STANDARD_TEMPLATE)};
$('newTemplate').onclick=()=>{selected='new';$('templatePicker').value='new';fillEditor({...STANDARD_TEMPLATE,name:''})};
$('levelRows').oninput=e=>{const el=e.target;if(el.dataset.field)draft.levels[el.dataset.index][el.dataset.field]=Number(el.value)};
$('levelRows').onclick=e=>{const el=e.target.closest('[data-remove]');if(!el||!canWrite())return;if(draft.levels.length===1)return status('至少保留一個級別');draft.levels.splice(Number(el.dataset.remove),1);drawLevels()};
$('addLevel').onclick=()=>{draft.levels.push({sb:1000,bb:2000,ante:2000,min:20});drawLevels()};$('addBreak').onclick=()=>{draft.levels.push({break:true,min:5});drawLevels()};
$('saveTemplate').onclick=async()=>{
 if(busy||!canWrite())return;let data;try{data=templateData({...draft,name:$('templateName').value,startingStack:$('startingStack').value,announcement:$('announcement').value,payoutInput:$('payoutInput').value})}catch(e){return status(e.message)}busy=true;controls();
 try{const id=await service.saveTemplate(data.name,data.levels,{...data,id:['standard','new'].includes(selected)?null:selected,revision});selected=id;revision=['standard','new'].includes($('templatePicker').value)?1:revision+1;options();$('templatePicker').value=id;fillEditor({...data,revision});status('範本已儲存，可到賽事管理選擇。已建立的計時器維持原本內容。')}catch(e){status('未儲存：'+e.message)}finally{busy=false;controls()}
};
$('timerRows').onclick=e=>{const button=e.target.closest('[data-event]');if(!button)return;$('controlFrame').src='timer-control.html?'+(demo?'demo=1':'eventId='+encodeURIComponent(button.dataset.event))+'&v=20261022-auto6';$('controlDialog').showModal()};$('closeControl').onclick=()=>$('controlDialog').close();
$('simulateCreate').onclick=async()=>{try{await service.createDemoEvent($('demoTemplate').value);tab('timers');status('練習賽事與計時器已同時產生；不需另外按建立計時器。')}catch(e){status(e.message)}};
try{
 service=demo?(await import('./timer-demo.js?v=20261022-auto6')).demoCloud():await(await import('./timer-cloud.js?v=20261022-auto6')).timerCloud();
 const error=e=>status('連線失敗：'+e.message);
 service.subscribeTemplates(rows=>{templates=rows;options()},error);service.subscribeEvents(rows=>{events=rows;drawTimers()},error);service.subscribeTimers(rows=>{timers=rows;drawTimers()},error);
 $('demoCreate').hidden=!demo;status('先建立共用範本，再於建立賽事時選用。');
}catch(e){status(e.message)}
fillEditor(STANDARD_TEMPLATE);setInterval(()=>{controls();if(!$('timerPanel').hidden)drawTimers()},500);
