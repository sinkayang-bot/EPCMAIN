import {preloadSelectedTimerSounds,playSelectedTimerSound,timerTransitionCueKey} from './timer-selected-sounds.js?v=20261108-start-cue1';
// Prepare inside the real button gesture, before the cloud transaction awaits.
// Do not infer a successful Start from a later display snapshot.
export function commandSound(){
 let context,disposed=false;
 function prepare(){
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio||disposed)return Promise.resolve(false);context||=new Audio();return Promise.all([context.resume(),preloadSelectedTimerSounds(context)]).then(()=>!disposed&&context.state==='running',()=>false)}catch(_){return Promise.resolve(false)}
 }
 async function after(action,before,after,eventId,ready){
  const kind=action==='toggle'&&!before?.running&&after?.running?'start':action==='level'&&before?.index!==after?.index?'level':null;
  if(!kind)return false;const committedAt=Date.now();
  if(!await ready||disposed||context?.state!=='running'||Date.now()-committedAt>5000)return false;
  let volume=90;try{volume=Math.max(20,Math.min(100,Number(window.localStorage.getItem('epcTimerSoundVolumeV2'))||90))}catch(_){}
  try{playSelectedTimerSound(context,kind,volume/100,0,0,timerTransitionCueKey(after,eventId));return true}catch(_){return false}
 }
 return {prepare,after,dispose(){disposed=true;void context?.close?.()}};
}
