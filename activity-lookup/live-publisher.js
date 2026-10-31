import '../lucky-multiplier-core.js';
import {buildCatalog} from './catalog-core.js';
const SOURCE='https://script.google.com/macros/s/AKfycbwZi5bXuFJdtXiE6oxPmn4NZti-wZyOwEfTKZ8VPo5nXP5GK1mPOYrfkxz714AN4UQx9w/exec';
export function setupLivePublisher({fs,db,bridge}){
 let timer,running=false,pending=false;
 const ref=fs.doc(db,'epc_public_activity_catalog','current');
 const label=document.createElement('div');label.id='epcPublicPublishStatus';label.className='small';label.setAttribute('role','status');
 const mount=()=>{const parent=document.getElementById('epcAccountingAuthState')?.parentElement;if(parent&&!label.isConnected)parent.append(label)};
 function message(text){mount();label.textContent='公開活動：'+text;window.EPC_PUBLIC_PUBLISH_STATE=text;}
 function schedule(){pending=true;clearTimeout(timer);timer=setTimeout(publish,350)}
 async function publish(){
  if(running||!pending)return;
  if(window.EPCMode?.isView())return;
  if(!bridge.accountingReady){message('請登入 Google 管理員，才能自動發布');return;}
  if(!window.EPC_ACTIVITY_LOADED||localStorage.getItem('epcActivityPendingV1')){message('等待活動雲端儲存完成');return;}
  running=true;pending=false;
  try{
   bridge.requireAccountingAccess();window.EPCMode?.assertWrite();
   message('發布中…');
   // Read the authoritative source, never publish unsaved browser activity data.
   const response=await fetch(SOURCE,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'activity.get'}),signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('活動來源 HTTP '+response.status);
   const input=await response.json();if(!input.ok||!input.data||!Number.isSafeInteger(input.revision))throw Error('活動來源格式錯誤');
   const snap=await fs.getDocsFromServer(fs.collection(db,'epc_events'));
   const activities=buildCatalog(input.data,snap.docs.map(d=>({id:d.id,...d.data()})));
   const fingerprint=JSON.stringify({revision:input.revision,activities});
   await fs.runTransaction(db,async tx=>{
    bridge.requireAccountingAccess();window.EPCMode?.assertWrite();
    const current=await tx.get(ref),old=current.data()||{};
    if(Number(old.sourceRevision||0)>input.revision)throw Error('來源版本較舊，保留目前公開資料');
    if(old.fingerprint===fingerprint)return;
    tx.set(ref,{version:1,sourceRevision:input.revision,generatedAt:fs.serverTimestamp(),activities,fingerprint});
   });
   message('已發布｜版本 '+input.revision+'｜'+new Date().toLocaleTimeString('zh-TW',{hour12:false}));
  }catch(e){message('發布失敗：'+String(e.message||e));console.error('Public activity publish',e);}
  finally{running=false;if(pending)schedule()}
 }
 window.addEventListener('epcActivityCloudSaved',schedule);
 window.addEventListener('epcFirestoreEvents',schedule);
 window.addEventListener('epcFirestoreAccounting',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
 document.addEventListener('change',event=>{if(event.target?.id==='epcTerminalMode')schedule()});
 window.retryPublicActivityPublish=schedule;
 schedule();return {schedule};
}
