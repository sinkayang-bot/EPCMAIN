// Exact user-approved recordings. Both countdown warnings use the same buffer.
export const selectedSoundFiles={
 start:{path:'assets/timer-sounds/start-v1.wav',duration:1.5},
 countdown:{path:'assets/timer-sounds/countdown-v1.wav',duration:.8},
 end:{path:'assets/timer-sounds/finish-v1.wav',duration:2}
};
const prepared=new WeakMap();
export function preloadSelectedTimerSounds(context){
 let state=prepared.get(context);
 if(state)return state.ready;
 state={buffers:{}};prepared.set(context,state);
 state.ready=Promise.all(Object.entries(selectedSoundFiles).map(async([kind,file])=>{
  const response=await fetch(new URL(file.path,import.meta.url));
  if(!response.ok)throw Error('Cannot load timer sound: '+kind);
  const buffer=await context.decodeAudioData(await response.arrayBuffer());
  state.buffers[kind]=buffer;
 })).catch(error=>{prepared.delete(context);throw error});
 return state.ready;
}
export function playSelectedTimerSound(context,kind,volume,delay=0,clipDuration=0){
 const name=kind==='ten'||kind==='five'?'countdown':kind==='level'?'start':kind;
 const buffer=prepared.get(context)?.buffers[name];
 // Never download or replay a late cue during the countdown itself.
 if(!buffer||context.state!=='running')return null;
 const source=context.createBufferSource(),gain=context.createGain();
 source.buffer=buffer;gain.gain.value=volume;
 source.connect(gain);gain.connect(context.destination);
 source.onended=()=>{source.disconnect();gain.disconnect()};
 const at=context.currentTime+.025+Math.max(0,delay);
 if(clipDuration>0){gain.gain.setValueAtTime(volume,at);gain.gain.setValueAtTime(volume,at+Math.max(.01,clipDuration-.045));gain.gain.linearRampToValueAtTime(0,at+clipDuration);source.start(at,0,Math.min(clipDuration,buffer.duration));}
 else source.start(at);
 return source;
}
