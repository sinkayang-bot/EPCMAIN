export function installEventPicker({cloud,deviceId}){
 const button=document.createElement('button');button.id='tvChooseEvent';button.type='button';button.textContent='選擇賽事';button.hidden=true;
 const dialog=document.createElement('dialog');dialog.id='tvEventPicker';dialog.innerHTML='<div class="pickerHeading"><h2>選擇投放賽事</h2><button type="button" id="tvPickerClose">關閉</button></div><p>選擇後只會切換這台顯示器，倒數進度會保留。</p><label for="tvPickerEvent">投放賽事</label><select id="tvPickerEvent"></select><p id="tvPickerStatus" role="status"></p><div class="pickerActions"><button type="button" id="tvPickerRefresh">重新讀取</button><button type="button" id="tvPickerApply">投放到這台螢幕</button></div>';
 document.body.append(button,dialog);
 const select=dialog.querySelector('select'),status=dialog.querySelector('[role=status]'),apply=dialog.querySelector('#tvPickerApply'),refresh=dialog.querySelector('#tvPickerRefresh');let current='',busy=false,loadId=0;
 function controls(){apply.disabled=busy||!select.value;select.disabled=busy;refresh.disabled=busy;dialog.querySelector('#tvPickerClose').disabled=busy;}
 async function load(){const request=++loadId;busy=true;status.textContent='正在讀取賽事…';controls();try{const rows=await cloud.timerEvents();if(request!==loadId)return;select.replaceChildren();for(const row of rows){const option=document.createElement('option');option.value=row.eventId;option.textContent=(row.date?row.date+' ':'')+row.name+(row.settled?'（已結束）':'');select.append(option)}if(rows.some(r=>r.eventId===current))select.value=current;status.textContent=rows.length?'請選擇賽事，再按「投放到這台螢幕」。':'目前沒有已建立計時器的賽事，請先在後臺建立。'}catch(e){status.textContent='讀取失敗：'+e.message}finally{if(request===loadId){busy=false;controls()}}}
 button.onclick=()=>{dialog.showModal();load()};refresh.onclick=load;select.onchange=controls;
 dialog.querySelector('#tvPickerClose').onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 apply.onclick=async()=>{if(busy||!select.value)return;busy=true;controls();status.textContent='正在切換…';try{await cloud.selectTimer(deviceId,select.value);current=select.value;dialog.close()}catch(e){status.textContent='未切換：'+e.message}finally{busy=false;controls()}};
 return {update(data){button.hidden=!data?.paired;current=data?.payload?.type==='timer'?String(data.payload.eventId||''):'';if(!data?.paired&&dialog.open)dialog.close()}};
}
