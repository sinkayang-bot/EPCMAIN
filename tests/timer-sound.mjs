import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {countdownCue,countdownSound,levelChangeCue}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../timer-sound.js',import.meta.url))).toString('base64'));
const state=seconds=>({seconds,running:true,key:'E1:0',endsAt:12345});
assert.equal(countdownCue(state(11),state(10)),10);
assert.equal(countdownCue(state(6),state(5)),5);
assert.equal(countdownCue(state(10),state(10)),null);
assert.equal(countdownCue(null,state(5)),null);
assert.equal(countdownCue({...state(11),running:false},state(10)),null);
assert.equal(countdownCue(state(11),{...state(10),running:false}),null);
assert.equal(countdownCue(state(11),{...state(10),key:'E1:1'}),null);
assert.equal(countdownCue(state(60),state(5)),null);
assert.equal(countdownCue(state(11),{...state(5),endsAt:999}),null);
assert.equal(countdownCue(state(5),state(11)),null);
const tones=[],elements=[];let panel;
globalThis.document={createElement:tag=>{const el={tag,style:{},children:[],append(...items){this.children.push(...items)},setAttribute(){}};elements.push(el);return el},body:{append(el){panel=el}}};
globalThis.window={AudioContext:class{state='running';currentTime=0;destination={};async resume(){}createOscillator(){return {frequency:{},connect(){},start(t){tones.push(t)},stop(){}}}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}}};
const sound=countdownSound(),button=elements.find(el=>el.textContent==='啟用提示音'),slider=elements.find(el=>el.type==='range'),timer={index:0,levels:[{min:1}],running:true,endsAt:100};
sound.observe(timer,11,'E1');sound.observe(timer,10,'E1');assert.equal(tones.length,0,'Muted until the device user enables audio');
await button.onclick();assert.equal(tones.length,3,'Enable plays a short confirmation tone');
sound.observe(timer,11,'E1');sound.observe(timer,10,'E1');sound.observe(timer,10,'E1');assert.equal(tones.length,6,'10-second cue plays once');
sound.observe(timer,6,'E1');sound.observe(timer,5,'E1');assert.equal(tones.length,12,'5-second cue plays two short tones');
await button.onclick();sound.observe(timer,11,'E1');sound.observe(timer,10,'E1');assert.equal(tones.length,12,'Disable mutes cues');
console.log('Timer sound: thresholds, no duplicates, pause/seek/level protection, enable, mute and tone scheduling passed.');

assert.equal(slider.value,'100');slider.value='50';slider.oninput();assert.equal(elements.find(el=>el.tag==='output').textContent,'50%');assert(!elements.some(el=>el.textContent==='試聽提示音'));await button.onclick();

const before={event:'E1',structure:'same',index:0,running:true,at:1000},after={...before,index:1,at:1250};
assert(levelChangeCue(before,after));assert(!levelChangeCue(null,after));assert(!levelChangeCue(before,{...after,event:'E2'}));assert(!levelChangeCue(before,{...after,structure:'changed'}));assert(!levelChangeCue(before,{...after,at:10000}));assert(!levelChangeCue(before,{...after,running:false}));assert(!levelChangeCue(before,{...after,index:0}));
const structure=[{min:1},{break:true,min:1},{min:1}];
sound.observe({...timer,levels:structure},1,'E1');const beforeBell=tones.length;sound.observe({...timer,levels:structure,index:1,endsAt:160},60,'E1');assert.equal(tones.length,beforeBell+3,'One bell strike uses three decaying partials');sound.observe({...timer,levels:structure,index:1,endsAt:160},60,'E1');assert.equal(tones.length,beforeBell+3,'No duplicate bell on redraw');sound.observe({...timer,levels:structure,index:2,endsAt:220},60,'E1');assert.equal(tones.length,beforeBell+6,'Leaving a break also rings');

console.log('Three bell voices: 10-second single, 5-second double, level transition long bell passed.');
