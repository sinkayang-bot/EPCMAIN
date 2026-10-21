import {pairingCode} from './display-pairing.js?v=20261022-qr27';
const code=pairingCode(location.hash);
if(code){
 const style=document.createElement('style');style.textContent=`body.phone-display-mode{padding:0!important;margin:0!important}body.phone-display-mode>header,body.phone-display-mode #nav{display:none!important}body.phone-display-mode #app,body.phone-display-mode main{margin:0!important;padding:12px!important;width:100%!important;max-width:none!important}body.phone-display-mode #displays .formgrid{grid-template-columns:1fr!important}body.phone-display-mode #displays input,body.phone-display-mode #displays select,body.phone-display-mode #displays button{font-size:16px;min-height:44px}#phonePairDialog{max-width:440px;width:calc(100% - 24px);background:#111820;color:#fff;border:1px solid #c3a052;border-radius:16px;padding:24px}#phonePairDialog::backdrop{background:#000b}#phonePairDialog button{width:100%;margin-top:14px;min-height:48px}#phonePairStatus{line-height:1.6}body.phone-display-mode .display-device-head{flex-wrap:wrap;overflow-wrap:anywhere}`;
 document.head.append(style);document.body.classList.add('phone-display-mode');
 const dialog=document.createElement('dialog');dialog.id='phonePairDialog';dialog.innerHTML=`<h2>連接這台電視</h2><p>配對碼：<strong>${code}</strong></p><label for="phonePairName">設備名稱</label><input id="phonePairName" data-mode-control placeholder="例如：六桌電視" maxlength="60"><p id="phonePairStatus" role="status">連接後可直接選擇播放活動或賽事計時器。</p><button id="phonePairConnect" data-mode-control>連接並開啟後臺</button>`;document.body.append(dialog);dialog.showModal();
 const status=document.getElementById('phonePairStatus'),button=document.getElementById('phonePairConnect');
 button.onclick=async()=>{
  button.disabled=true;
  try{
   if(!window.EPCMode?.set('operate'))throw Error('目前無法切換操作模式，請稍後重試。');
   status.textContent='正在連接電視…';
   // QR pairing always targets the built-in display service shown on the television.
   const api=await(await import('./display-cloud.js?v=20261022-qr27')).displayCloud();
   const result=await api.request({action:'pair',code,name:document.getElementById('phonePairName').value.trim()||'EPC 顯示器'});
   // Use the same API setting helper as the desktop backend (including its storage key).
   const apiInput=document.getElementById('displayApiUrl');if(apiInput)apiInput.value='firebase';
   await enableBuiltinDisplay_();showPage('displays');await loadDisplays_();
   history.replaceState(null,'',location.pathname+location.search);
   dialog.close();
   const top=document.createElement('div');top.className='card';top.innerHTML='<h3>電視已連接</h3><p>在下方選擇要播放的活動或計時器，再按「套用到螢幕」。</p><button data-mode-control>返回完整後臺</button>';top.querySelector('button').onclick=()=>document.body.classList.remove('phone-display-mode');document.getElementById('displays').prepend(top);
   if(result.deviceId)document.getElementById('displayDevice_'+result.deviceId)?.scrollIntoView({block:'start',behavior:'smooth'});
  }catch(e){status.textContent='連接失敗：'+e.message+'。若已過期，請重新整理電視後再掃碼。';button.disabled=false;}
 };
}
