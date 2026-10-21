// Only a naturally advancing countdown may trigger a cue; opening, seeking,
// pausing or switching levels must not replay an old warning.
export function countdownCue(previous,current){
 if(!previous||!current.running||!previous.running||previous.key!==current.key||previous.endsAt!==current.endsAt)return null;
 if(previous.seconds-current.seconds>2||previous.seconds<=current.seconds)return null;
 return [10,5].find(n=>previous.seconds>n&&current.seconds<=n)??null;
}
export function countdownSound(){
 let context,enabled=false,previous,volume=100;
 try{volume=Math.max(20,Math.min(100,Number(window.localStorage.getItem('epcTimerSoundVolumeV1'))||100))}catch(_){}
 const button=document.createElement('button');button.type='button';button.textContent='啟用提示音';button.setAttribute('aria-pressed','false');button.title='啟用後，倒數剩 10 秒與 5 秒時播放短提示音';
 const panel=document.createElement('aside');panel.setAttribute('aria-label','提示音設定');panel.style.cssText='position:fixed;right:8px;bottom:3px;z-index:50;max-width:240px;padding:0;display:flex;gap:8px;align-items:center;color:#e9c568;background:transparent;border:0;font:12px system-ui;opacity:.22;transition:opacity .15s';
 button.style.cssText='width:auto;margin:0;padding:3px 5px;font:12px system-ui;line-height:18px;color:#e9c568;background:transparent;border:0;cursor:pointer';
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='音量與試聽';summary.style.cssText='cursor:pointer;margin:0;font:12px/24px system-ui';details.style.position='relative';
 const slider=document.createElement('input');slider.type='range';slider.min='20';slider.max='100';slider.step='5';slider.value=String(volume);slider.setAttribute('aria-label','提示音音量');slider.style.cssText='width:180px;padding:6px 0;accent-color:#e9c568';
 const output=document.createElement('output');output.textContent=volume+'%';output.style.marginLeft='6px';
 slider.oninput=()=>{volume=Number(slider.value);output.textContent=volume+'%';try{window.localStorage.setItem('epcTimerSoundVolumeV1',String(volume))}catch(_){}};
 const test=document.createElement('button');test.type='button';test.textContent='試聽提示音';test.disabled=true;test.style.cssText='font:14px system-ui;padding:6px 10px;width:auto';
 const options=document.createElement('div');options.style.cssText='position:absolute;right:0;bottom:30px;width:225px;padding:10px;background:#08080899;border:1px solid #66502b88;border-radius:7px';options.append(slider,output,test);details.append(summary,options);panel.append(button,details);document.body.append(panel);
 panel.onmouseenter=panel.onfocusin=()=>{panel.style.opacity='.95'};
 panel.onmouseleave=()=>{if(!details.open)panel.style.opacity='.22'};
 panel.onfocusout=e=>{if(!details.open&&!panel.contains(e.relatedTarget))panel.style.opacity='.22'};
 details.ontoggle=()=>{panel.style.opacity=details.open?'.95':'.22'};
 function beep(count=1){
  if(!enabled||context?.state!=='running')return;
  for(let i=0;i<count;i++){const start=context.currentTime+i*.5,osc=context.createOscillator(),gain=context.createGain(),peak=.8*volume/100;osc.type='triangle';osc.frequency.value=1046.5;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(peak,start+.02);gain.gain.setValueAtTime(peak,start+.3);gain.gain.exponentialRampToValueAtTime(.001,start+.4);osc.connect(gain);gain.connect(context.destination);osc.start(start);osc.stop(start+.42);}
 }
 button.onclick=async()=>{
  try{if(!enabled){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('unsupported');context||=new Audio();await context.resume();if(context.state!=='running')throw Error('blocked');enabled=true;beep();}else enabled=false;button.textContent=enabled?'提示音：開啟':'啟用提示音';button.setAttribute('aria-pressed',String(enabled));test.disabled=!enabled;}
  catch(_){enabled=false;test.disabled=true;button.textContent='無法播放，點擊重試';button.setAttribute('aria-pressed','false');}
 };
 test.onclick=async()=>{if(enabled){await context.resume();beep(2)}};
 return {observe(timer,seconds,eventId){const current=timer?{key:String(eventId||'')+':'+timer.index+':'+JSON.stringify(timer.levels),seconds,running:!!timer.running,endsAt:timer.endsAt}:null;const cue=current?countdownCue(previous,current):null;previous=current;if(cue)beep(cue===5?2:1);}};
}
