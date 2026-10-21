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
export function countdownSound(){
 let context,enabled=false,previous,volume=100;
 try{volume=Math.max(20,Math.min(100,Number(window.localStorage.getItem('epcTimerSoundVolumeV1'))||100))}catch(_){}
 const button=document.createElement('button');button.type='button';button.textContent='啟用提示音';button.setAttribute('aria-pressed','false');button.title='剩 10 秒、5 秒時提示，切換到下一級或休息時響鈴';
 const panel=document.createElement('aside');panel.setAttribute('aria-label','提示音設定');panel.style.cssText='position:fixed;right:8px;bottom:3px;z-index:50;max-width:240px;padding:0;display:flex;gap:8px;align-items:center;color:#e9c568;background:transparent;border:0;font:12px system-ui;opacity:.22;transition:opacity .15s';
 button.style.cssText='width:auto;margin:0;padding:3px 5px;font:12px system-ui;line-height:18px;color:#e9c568;background:transparent;border:0;cursor:pointer';
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='音量';summary.style.cssText='cursor:pointer;margin:0;font:12px/24px system-ui';details.style.position='relative';
 const slider=document.createElement('input');slider.type='range';slider.min='20';slider.max='100';slider.step='5';slider.value=String(volume);slider.setAttribute('aria-label','提示音音量');slider.style.cssText='width:180px;padding:6px 0;accent-color:#e9c568';
 const output=document.createElement('output');output.textContent=volume+'%';output.style.marginLeft='6px';
 slider.oninput=()=>{volume=Number(slider.value);output.textContent=volume+'%';try{window.localStorage.setItem('epcTimerSoundVolumeV1',String(volume))}catch(_){}};
 const options=document.createElement('div');options.style.cssText='position:absolute;right:0;bottom:30px;width:225px;padding:10px;background:#08080899;border:1px solid #66502b88;border-radius:7px';options.append(slider,output);details.append(summary,options);panel.append(button,details);document.body.append(panel);
 panel.onmouseenter=panel.onfocusin=()=>{panel.style.opacity='.95'};
 panel.onmouseleave=()=>{if(!details.open)panel.style.opacity='.22'};
 panel.onfocusout=e=>{if(!details.open&&!panel.contains(e.relatedTarget))panel.style.opacity='.22'};
 details.ontoggle=()=>{panel.style.opacity=details.open?'.95':'.22'};
 function bell(kind='level'){
  if(!enabled||context?.state!=='running')return;
  const presets={ten:{base:659.25,duration:.85,strikes:1,gap:0},five:{base:659.25,duration:.65,strikes:2,gap:.38},level:{base:659.25,duration:2.4,strikes:1,gap:0}},preset=presets[kind];
  for(let i=0;i<preset.strikes;i++){
   const start=context.currentTime+i*preset.gap;
   for(const [ratio,amplitude,decay] of [[1,.58,1],[2.01,.23,.7],[3.99,.1,.4]]){
    const osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.value=preset.base*ratio;
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(amplitude*volume/100,start+.008);gain.gain.exponentialRampToValueAtTime(.001,start+preset.duration*decay);
    osc.connect(gain);gain.connect(context.destination);osc.start(start);osc.stop(start+preset.duration*decay+.04);
   }
  }
 }
 button.onclick=async()=>{
  try{if(!enabled){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('unsupported');context||=new Audio();await context.resume();if(context.state!=='running')throw Error('blocked');enabled=true;bell('ten');}else enabled=false;button.textContent=enabled?'提示音：開啟':'啟用提示音';button.setAttribute('aria-pressed',String(enabled));}
  catch(_){enabled=false;button.textContent='無法播放，點擊重試';button.setAttribute('aria-pressed','false');}
 };
 return {observe(timer,seconds,eventId){const event=String(eventId||''),structure=timer?JSON.stringify(timer.levels):'',current=timer?{key:event+':'+timer.index+':'+structure,event,structure,index:timer.index,at:Date.now(),seconds,running:!!timer.running,endsAt:timer.endsAt}:null;const cue=current?countdownCue(previous,current):null,changed=levelChangeCue(previous,current);previous=current;if(changed)bell();else if(cue)bell(cue===5?'five':'ten');}};
}
