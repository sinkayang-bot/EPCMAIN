import {preloadSelectedTimerSounds,playSelectedTimerSound} from './timer-selected-sounds.js?v=20261024-start-level3';
// Only a naturally advancing countdown may trigger a cue; opening, seeking,
// pausing or switching levels must not replay an old warning.
export function countdownCue(previous,current){
 if(!previous||!current.running||!previous.running||previous.key!==current.key||previous.endsAt!==current.endsAt)return null;
 if(previous.seconds-current.seconds>2||previous.seconds<=current.seconds)return null;
 return [10,5].find(n=>previous.seconds>n&&current.seconds<=n)??null;
}
export function levelChangeCue(previous,current){
 return !!(previous?.running&&current?.running&&previous.event===current.event&&previous.structure===current.structure&&current.index===previous.index+1&&current.at-previous.at<=2000);
}
export function startedCue(previous,current){
 return !!(previous&&!previous.running&&current?.running&&previous.key===current.key
  &&previous.seconds>0&&current.seconds>0&&current.seconds<=previous.seconds
  &&previous.seconds-current.seconds<=3&&current.at-previous.at<=2000);
}
export function finishedCue(previous,current){
 return !!(previous?.running&&current&&!current.running&&previous.key===current.key&&current.last
  &&previous.seconds>0&&previous.seconds<=2&&current.seconds===0
  &&current.at-previous.at<=2000&&current.at>=previous.endsAt&&current.at-previous.endsAt<=2000);
}
export function countdownSound(){
 let context,enabled=true,previous,volume=90,samplesReady=false,loadFailed=false;
 try{volume=Math.max(20,Math.min(100,Number(window.localStorage.getItem('epcTimerSoundVolumeV2'))||90))}catch(_){}
 const button=document.createElement('button');button.type='button';button.textContent='啟用提示音';button.setAttribute('aria-pressed','false');button.title='開始 1.5 秒；10 秒及 5 秒相同單音各 0.8 秒；結束三連鈴 2 秒；換級別同開始音 1.5 秒';
 const panel=document.createElement('aside');panel.setAttribute('aria-label','提示音設定');panel.style.cssText='position:fixed;right:8px;bottom:3px;z-index:50;max-width:240px;padding:0;display:flex;gap:8px;align-items:center;color:#e9c568;background:transparent;border:0;font:12px system-ui;opacity:.22;transition:opacity .15s';
 button.style.cssText='width:auto;margin:0;padding:3px 5px;font:12px system-ui;line-height:18px;color:#e9c568;background:transparent;border:0;cursor:pointer';
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='音量';summary.style.cssText='cursor:pointer;margin:0;font:12px/24px system-ui';details.style.position='relative';
 const slider=document.createElement('input');slider.type='range';slider.min='20';slider.max='100';slider.step='5';slider.value=String(volume);slider.setAttribute('aria-label','提示音音量');slider.style.cssText='width:180px;padding:6px 0;accent-color:#e9c568';
 const output=document.createElement('output');output.textContent=volume+'%';output.style.marginLeft='6px';
 slider.oninput=()=>{volume=Number(slider.value);output.textContent=volume+'%';try{window.localStorage.setItem('epcTimerSoundVolumeV2',String(volume))}catch(_){}};
 const options=document.createElement('div');options.style.cssText='position:absolute;right:0;bottom:30px;width:225px;padding:10px;background:#08080899;border:1px solid #66502b88;border-radius:7px';options.append(slider,output);details.append(summary,options);
 const testButton=document.createElement('button');testButton.type='button';testButton.textContent='測試音效';testButton.title='播放 0.8 秒倒數單音，確認這台設備的聲音';testButton.style.cssText=button.style.cssText;
 panel.append(button,testButton,details);document.body.append(panel);
 panel.onmouseenter=panel.onfocusin=()=>{panel.style.opacity='.95'};
 const panelOpacity=()=>enabled&&(!samplesReady||context?.state!=='running')?'.95':'.22';
 panel.onmouseleave=()=>{if(!details.open)panel.style.opacity=panelOpacity()};
 panel.onfocusout=e=>{if(!details.open&&!panel.contains(e.relatedTarget))panel.style.opacity=panelOpacity()};
 details.ontoggle=()=>{panel.style.opacity=details.open?'.95':panelOpacity()};
 function bell(kind='level'){
  if(!enabled||context?.state!=='running')return;
  if(samplesReady)playSelectedTimerSound(context,kind,volume/100);
 }
 function updateButton(){
  const ready=enabled&&context?.state==='running'&&samplesReady;
  button.textContent=!enabled?'啟用提示音':loadFailed?'音效載入失敗，點此重試':ready?'提示音：開啟':context?.state==='running'?'提示音載入中…':'按確認啟用提示音';
  button.setAttribute('aria-pressed',String(ready));
  if(!details.open)panel.style.opacity=ready||!enabled?'.22':'.95';
 }
 async function activate(){
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(!Audio)throw Error('unsupported');
   context||=new Audio();context.onstatechange=updateButton;
   loadFailed=false;updateButton();
   await Promise.all([context.resume(),preloadSelectedTimerSounds(context)]);
   samplesReady=true;updateButton();
  }catch(_){loadFailed=true;updateButton();}
 }
 button.onclick=async()=>{
  if(enabled&&context?.state==='running'&&samplesReady){enabled=false;updateButton();return;}
  enabled=true;await activate();
 };
 // Autoplay policies may suspend audio until the first real remote/touch gesture.
 // Keep the preference enabled and retry without replaying any earlier cues.
 const unlock=e=>{if(e.target===button)return;if(enabled&&context?.state!=='running')void activate();};
 document.addEventListener?.('pointerdown',unlock,{capture:true});
 document.addEventListener?.('keydown',unlock,{capture:true});
 testButton.onclick=async()=>{enabled=true;await activate();if(context?.state==='running'&&samplesReady)bell('ten');};
 updateButton();void activate();
 return {test:async(kind='ten')=>{enabled=true;await activate();if(context?.state!=='running'||!samplesReady)return false;bell(kind);return true},observe(timer,seconds,eventId){const event=String(eventId||''),structure=timer?JSON.stringify(timer.levels):'',current=timer?{key:event+':'+timer.index+':'+structure,event,structure,index:timer.index,last:timer.index===timer.levels.length-1,at:Date.now(),duration:Number(timer.levels[timer.index]?.min||0)*60,seconds,running:!!timer.running,endsAt:timer.endsAt}:null;const cue=current?countdownCue(previous,current):null,changed=levelChangeCue(previous,current),finished=finishedCue(previous,current),started=startedCue(previous,current);previous=current;if(finished)bell('end');else if(started)bell('start');else if(changed)bell();else if(cue)bell(cue===5?'five':'ten');}};
}
