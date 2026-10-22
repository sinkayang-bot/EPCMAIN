export function installEventPicker({cloud,deviceId,loadTimeoutMs=15000}){
 const button=document.createElement('button');button.id='tvChooseEvent';button.type='button';button.textContent='選擇賽事';button.hidden=true;
 const dialog=document.createElement('div');dialog.id='tvEventPicker';dialog.hidden=true;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','tvPickerHeading');button.setAttribute('aria-controls','tvEventPicker');button.setAttribute('aria-expanded','false');dialog.innerHTML='<div class="pickerHeading"><h2 id="tvPickerHeading">選擇投放賽事</h2><button type="button" id="tvPickerClose">關閉</button></div><p>遙控器：↑↓ 選擇場次，確認鍵直接投放，返回鍵關閉。<br>只會切換這台顯示器，倒數進度會保留。</p><div id="tvPickerEventLabel">投放賽事</div><div id="tvPickerEvent" role="group" aria-labelledby="tvPickerEventLabel"></div><div class="pickerPages"><button type="button" id="tvPickerPrev">上一頁</button><span id="tvPickerPage"></span><button type="button" id="tvPickerNext">下一頁</button></div><p id="tvPickerStatus" role="status"></p><div class="pickerActions"><button type="button" id="tvPickerRefresh">重新讀取</button><button type="button" id="tvPickerApply">投放到這台螢幕</button></div>';
 document.body.append(button,dialog);
 const select=dialog.querySelector('#tvPickerEvent'),status=dialog.querySelector('[role=status]'),apply=dialog.querySelector('#tvPickerApply'),refresh=dialog.querySelector('#tvPickerRefresh');let current='',busy=false,loading=false,loadId=0,rows=[],page=0;const pageSize=4,prev=dialog.querySelector('#tvPickerPrev'),next=dialog.querySelector('#tvPickerNext');
 function controls(){apply.disabled=busy||loading||!select.value;select.querySelectorAll('button').forEach(b=>b.disabled=busy||loading);refresh.disabled=busy;dialog.querySelector('#tvPickerClose').disabled=busy;prev.disabled=busy||loading||page===0;next.disabled=busy||loading||(page+1)*pageSize>=rows.length;}
 function renderRows(){select.replaceChildren();for(const row of rows.slice(page*pageSize,(page+1)*pageSize)){const option=document.createElement('button');option.type='button';option.dataset.eventId=row.eventId;option.setAttribute('aria-pressed','false');option.textContent=(row.date?row.date+' ':'')+row.name;option.onclick=()=>{select.value=row.eventId;markSelection();controls()};option.onfocus=()=>{select.value=row.eventId;markSelection()};select.append(option)}markSelection();const pages=Math.ceil(rows.length/pageSize);dialog.querySelector('.pickerPages').hidden=pages<=1;dialog.querySelector('#tvPickerPage').textContent=(page+1)+' / '+Math.max(1,pages);controls()}
 function focusRow(last=false){const choices=[...select.querySelectorAll('button')];(choices.find(b=>b.dataset.eventId===select.value)||choices[last?choices.length-1:0]||refresh).focus()}
 function changePage(delta){page+=delta;renderRows();const choices=[...select.querySelectorAll('button')];(delta<0?choices[choices.length-1]:choices[0])?.focus()}
 prev.onclick=()=>changePage(-1);next.onclick=()=>changePage(1);
 async function load(){if(busy)return;const request=++loadId;loading=true;status.textContent='正在讀取賽事…';controls();let timeout;try{const result=await Promise.race([cloud.timerEvents(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('連線逾時，請按「重新讀取」再試一次。')),loadTimeoutMs)})]);if(request!==loadId)return;rows=result.filter(r=>!r.settled);select.value=rows.some(r=>r.eventId===current)?current:(rows[0]?.eventId||'');page=Math.max(0,Math.floor(rows.findIndex(r=>r.eventId===select.value)/pageSize));renderRows();status.textContent=rows.length?'↑↓ 選擇，確認鍵直接投放；或點選後按下方投放按鈕。':'目前沒有進行中或尚未開賽的計時器。'}catch(e){if(request===loadId)status.textContent='讀取失敗：'+e.message}finally{clearTimeout(timeout);if(request===loadId){loading=false;controls();if(dialog.open)focusRow()}}}
 function open(){dialog.hidden=false;dialog.open=true;button.setAttribute('aria-expanded','true');dialog.querySelector('#tvPickerClose').focus();load()}
 function markSelection(){select.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eventId===select.value)))}
 button.onclick=open;refresh.onclick=load;
 function hide(){dialog.hidden=true;dialog.open=false;button.setAttribute('aria-expanded','false');button.focus()}
 function close(){++loadId;loading=false;hide();controls()}
 dialog.querySelector('#tvPickerClose').onclick=close;
 const view=document.defaultView;
 function remoteKey(key,prevent){
  if(button.hidden)return;
  if(!dialog.open){if(['Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)){prevent();open()}return}
  if(['Escape','Backspace','BrowserBack','GoBack'].includes(key)){prevent();if(!busy)close();return}
  const focused=document.activeElement,choices=[...select.querySelectorAll('button')];
  if(key==='Enter'&&choices.includes(focused)){prevent();apply.click();return}
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(key)){
   prevent();if(busy)return;
   const delta=['ArrowUp','ArrowLeft'].includes(key)?-1:1;
   const atRow=choices.indexOf(focused);
   if(atRow===choices.length-1&&delta>0&&!next.disabled){changePage(1);return}
   if(atRow===0&&delta<0&&!prev.disabled){changePage(-1);return}
   const buttons=[...dialog.querySelectorAll('button')].filter(b=>!b.disabled&&!b.closest('[hidden]'));
   const at=buttons.indexOf(focused);buttons[(at+delta+buttons.length)%buttons.length]?.focus();
  }
 }
 function keyName(e){return ({4:'BrowserBack',23:'Enter',13:'Enter',38:'ArrowUp',40:'ArrowDown',37:'ArrowLeft',39:'ArrowRight',27:'Escape',10009:'BrowserBack',461:'BrowserBack'})[e.keyCode]||(['OK','Select','Accept'].includes(e.key)?'Enter':e.key)}
 document.addEventListener('keydown',e=>remoteKey(keyName(e),()=>e.preventDefault()),true);
 view?.addEventListener('message',e=>{if(e.origin!==view.location.origin||e.data?.type!=='epc-tv-remote-key'||![...document.querySelectorAll('iframe')].some(f=>f.contentWindow===e.source))return;remoteKey(e.data.key,()=>{})});
 apply.onclick=async()=>{if(busy||loading||!select.value)return;busy=true;controls();status.textContent='正在切換…';try{await cloud.selectTimer(deviceId,select.value);current=select.value;hide()}catch(e){status.textContent='未切換：'+e.message}finally{busy=false;controls()}};
 return {update(data){button.hidden=!data?.paired;current=data?.payload?.type==='timer'?String(data.payload.eventId||''):'';if(!data?.paired&&dialog.open)close()}};
}
