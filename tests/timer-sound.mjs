import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const optionsUrl=moduleUrl(readFileSync(new URL('timer-sound-options.js',root),'utf8'));
const recordingsUrl=moduleUrl(readFileSync(new URL('timer-selected-sounds.js',root),'utf8').replace('import.meta.url',JSON.stringify(new URL('timer-selected-sounds.js',root).href)));
const {selectedSoundFiles,preloadSelectedTimerSounds,playSelectedTimerSound}=await import(recordingsUrl);
const source=readFileSync(new URL('timer-sound.js',root),'utf8').replace("'./timer-selected-sounds.js?v=20261024-boxing1'",JSON.stringify(recordingsUrl)).replace("'./timer-sound-options.js?v=20261022-final22'",JSON.stringify(optionsUrl));
const {countdownCue,countdownSound,levelChangeCue,finishedCue,startedCue}=await import(moduleUrl(source));
let fetched=0,failFetch=false;
globalThis.fetch=async url=>{fetched++;if(failFetch)throw Error('network');const bytes=readFileSync(url);return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}};
const contexts=[],elements=[],listeners={};
class AudioContext {
 state='running';currentTime=0;destination={};sampleRate=44100;plays=[];
 constructor(){contexts.push(this)}
 async resume(){if(this.allowResume!==false)this.state='running'}
 async decodeAudioData(bytes){const b=Buffer.from(bytes);assert.equal(b.toString('ascii',0,4),'RIFF');let pos=12,rate,align,frames;while(pos<b.length){const type=b.toString('ascii',pos,pos+4),size=b.readUInt32LE(pos+4);if(type==='fmt '){rate=b.readUInt32LE(pos+12);align=b.readUInt16LE(pos+20)}if(type==='data')frames=size/align;pos+=8+size+(size%2)}return {duration:frames/rate}}
 createBufferSource(){const ctx=this;return {connect(){},disconnect(){},start(at){ctx.plays.push({type:'sample',buffer:this.buffer,at})}}}
 createGain(){return {gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}
 createOscillator(){const ctx=this;return {frequency:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},start(){ctx.plays.push({type:'legacy-level'})},stop(){}}}
}
const saved=new Map();globalThis.window={AudioContext,localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)}};
globalThis.document={createElement:tag=>{const e={tag,style:{},children:[],append(...c){this.children.push(...c)},setAttribute(){}};elements.push(e);return e},body:{append(){}},addEventListener:(name,fn)=>listeners[name]=fn};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
// Recordings preload once, use the same decoded buffer for both warnings, and
// never trigger a fetch or a deferred replay in the time-critical play path.
const ctx=new AudioContext();assert.equal(playSelectedTimerSound(ctx,'ten',.9),null);assert.equal(fetched,0);
await Promise.all([preloadSelectedTimerSounds(ctx),preloadSelectedTimerSounds(ctx)]);assert.equal(fetched,3);
for(const kind of ['start','ten','five','end'])playSelectedTimerSound(ctx,kind,.9);
assert.deepEqual(ctx.plays.map(p=>p.buffer.duration),[1.5,.8,.8,2]);assert.equal(ctx.plays[1].buffer,ctx.plays[2].buffer);assert.equal(fetched,3);
ctx.state='suspended';assert.equal(playSelectedTimerSound(ctx,'start',.9),null);assert.equal(ctx.plays.length,4);
const retry=new AudioContext();failFetch=true;await assert.rejects(preloadSelectedTimerSounds(retry));failFetch=false;await preloadSelectedTimerSounds(retry);
assert.equal(selectedSoundFiles.end.duration,2);
const state=seconds=>({seconds,running:true,key:'E1:0',endsAt:12345});
assert.equal(countdownCue(state(11),state(10)),10);assert.equal(countdownCue(state(6),state(5)),5);
for(const [a,b] of [[null,state(5)],[state(10),state(10)],[state(60),state(5)],[{...state(11),running:false},state(10)],[state(11),{...state(10),running:false}],[state(11),{...state(10),key:'other'}],[state(11),{...state(10),endsAt:999}]])assert.equal(countdownCue(a,b),null);
const before={event:'E1',structure:'same',index:0,running:true,at:1000},after={...before,index:1,at:1250};
assert(levelChangeCue(before,after));assert(!levelChangeCue(before,{...after,event:'E2'}));assert(!levelChangeCue(before,{...after,structure:'changed'}));assert(!levelChangeCue(before,{...after,at:10000}));
const ready={key:'E1:0',running:false,seconds:60,index:0,at:1000},started={...ready,running:true,duration:60,at:1100};
assert(startedCue(ready,started));assert(!startedCue({...ready,seconds:40},started));assert(!startedCue(null,started));
const almost={key:'E1:2',running:true,seconds:1,endsAt:5000,at:4750},done={...almost,running:false,seconds:0,last:true,at:5000};
assert(finishedCue(almost,done));for(const rejected of [{...done,last:false},{...done,at:4000},{...done,at:10000},{...done,key:'other'}])assert(!finishedCue(almost,rejected));
// Drive the actual renderer observer through start, countdown, level and finish.
const offset=elements.length,sound=countdownSound();await settle();const active=contexts.at(-1),button=elements.slice(offset).find(e=>e.tag==='button'),slider=elements.slice(offset).find(e=>e.type==='range');
assert.equal(button.textContent,'提示音：開啟');assert.equal(active.plays.length,0);assert.equal(slider.value,'90');
const timer={index:0,levels:[{min:1},{min:1}],running:true,endsAt:100000};
sound.observe({...timer,running:false},60,'E1');sound.observe(timer,60,'E1');sound.observe(timer,60,'E1');assert.deepEqual(active.plays.map(p=>p.buffer.duration),[1.5]);
sound.observe(timer,11,'E1');sound.observe(timer,10,'E1');sound.observe(timer,10,'E1');sound.observe(timer,6,'E1');sound.observe(timer,5,'E1');assert.deepEqual(active.plays.map(p=>p.buffer.duration),[1.5,.8,.8]);
await button.onclick();sound.observe(timer,11,'E1');sound.observe(timer,10,'E1');assert.equal(active.plays.length,3);listeners.keydown({target:{}});assert.equal(button.textContent,'啟用提示音');await button.onclick();
sound.observe(timer,1,'E1');sound.observe({...timer,index:1,endsAt:160000},60,'E1');assert.equal(active.plays.filter(p=>p.type==='legacy-level').length,3,'Unselected level cue keeps its original three partials');
const realNow=Date.now;Date.now=()=>5000;
sound.observe({...timer,index:1,endsAt:5000},1,'E1');sound.observe({...timer,index:1,running:false,endsAt:0},0,'E1');sound.observe({...timer,index:1,running:false,endsAt:0},0,'E1');Date.now=realNow;
assert.equal(active.plays.at(-1).buffer.duration,2);assert.equal(active.plays.filter(p=>p.type==='sample').length,4,'No duplicate finish cue');
slider.value='75';slider.oninput();assert.equal(saved.get('epcTimerSoundVolumeV2'),'75');
console.log('Passed: exact WAV durations; shared warning buffer; preload/retry; start/10s/5s/finish dispatch; unchanged level cue; mute/volume; no duplicate or stale cues.');
// Fresh browser contexts often block autoplay. The status must remain visible,
// and the explicit test button must both unlock and emit the approved cue.
const WorkingAudio=window.AudioContext;let unlocked=false;
window.AudioContext=class extends WorkingAudio{state='suspended';async resume(){if(unlocked)this.state='running'}};
const begin=elements.length;countdownSound();await settle();
const blocked=elements.slice(begin),enable=blocked.find(e=>e.tag==='button'),test=blocked.find(e=>e.textContent==='測試音效'),panel=blocked.find(e=>e.tag==='aside');
assert.equal(enable.textContent,'按確認啟用提示音');assert.equal(panel.style.opacity,'.95');
unlocked=true;await test.onclick();assert.equal(enable.textContent,'提示音：開啟');assert.equal(contexts.at(-1).plays.at(-1).buffer.duration,.8);
console.log('Passed: blocked autoplay is visible; explicit test unlocks audio and plays the real 0.8s cue.');
