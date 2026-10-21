// Only a naturally advancing countdown may trigger a cue; opening, seeking,
// pausing or switching levels must not replay an old warning.
export function countdownCue(previous,current){
 if(!previous||!current.running||!previous.running||previous.key!==current.key||previous.endsAt!==current.endsAt)return null;
 if(previous.seconds-current.seconds>2||previous.seconds<=current.seconds)return null;
 return [10,5].find(n=>previous.seconds>n&&current.seconds<=n)??null;
}
export function countdownSound(){
 let context,enabled=false,previous;
 const button=document.createElement('button');button.type='button';button.textContent='啟用提示音';button.setAttribute('aria-pressed','false');button.title='啟用後，倒數剩 10 秒與 5 秒時播放短提示音';
 button.style.cssText='position:fixed;right:12px;bottom:10px;z-index:50;width:auto;padding:8px 12px;font:14px system-ui;color:#e9c568;background:#080808dd;border:1px solid #66502b;border-radius:7px;cursor:pointer';document.body.append(button);
 function beep(count=1){
  if(!enabled||context?.state!=='running')return;
  for(let i=0;i<count;i++){const start=context.currentTime+i*.24,osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.value=880;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.3,start+.015);gain.gain.setValueAtTime(.3,start+.12);gain.gain.exponentialRampToValueAtTime(.001,start+.19);osc.connect(gain);gain.connect(context.destination);osc.start(start);osc.stop(start+.2);}
 }
 button.onclick=async()=>{
  try{if(!enabled){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('unsupported');context||=new Audio();await context.resume();if(context.state!=='running')throw Error('blocked');enabled=true;beep();}else enabled=false;button.textContent=enabled?'提示音：開啟':'啟用提示音';button.setAttribute('aria-pressed',String(enabled));}
  catch(_){enabled=false;button.textContent='無法播放，點擊重試';button.setAttribute('aria-pressed','false');}
 };
 return {observe(timer,seconds,eventId){const current=timer?{key:String(eventId||'')+':'+timer.index+':'+JSON.stringify(timer.levels),seconds,running:!!timer.running,endsAt:timer.endsAt}:null;const cue=current?countdownCue(previous,current):null;previous=current;if(cue)beep(cue===5?2:1);}};
}
