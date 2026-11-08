import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const samples=await import(url(readFileSync(new URL('timer-selected-sounds.js',root),'utf8').replace('import.meta.url',JSON.stringify(new URL('timer-selected-sounds.js',root).href))));
const source=readFileSync(new URL('timer-command-sound.js',root),'utf8').replace(/^import .*;$/m,'');
const ctxs=[],storage=new Map();let allow=true,decodeGate=null;
class AudioContext{
 state='suspended';currentTime=0;destination={};plays=[];
 constructor(){ctxs.push(this)}
 async resume(){if(allow)this.state='running'}
 async close(){this.state='closed'}
 async decodeAudioData(bytes){if(decodeGate)await decodeGate;return {bytes:Buffer.from(bytes),duration:1.5}}
 createGain(){return {gain:{value:1},connect(){},disconnect(){}}}
 createBufferSource(){const ctx=this;return {connect(){},disconnect(){},start(at){ctx.plays.push({buffer:this.buffer,at})}}}
}
globalThis.window={AudioContext,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
globalThis.fetch=async u=>{const b=readFileSync(u);return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}};
const context=vm.createContext({window,Date,Number,Math,Promise,...samples});vm.runInContext(source.replace('export function commandSound','function commandSound')+';globalThis.make=commandSound;',context);
const audio=context.make(),paused={index:0,running:false,revision:0},started={...paused,running:true,revision:1};
let release;decodeGate=new Promise(r=>release=r);const ready=audio.prepare(),play=audio.after('toggle',paused,started,'E',ready);await new Promise(r=>setImmediate(r));assert.equal(ctxs[0].state,'running','audio is unlocked before the command awaits');assert.equal(ctxs[0].plays.length,0,'wait for sample decode');release();assert.equal(await play,true);decodeGate=null;assert.equal(ctxs[0].plays.length,1);
const first=ctxs[0].plays[0].buffer;assert.equal(first.bytes.toString('ascii',0,4),'RIFF');
const next={...started,index:1,revision:2};await audio.after('level',started,next,'E',audio.prepare());assert.equal(ctxs[0].plays.length,2);assert.equal(ctxs[0].plays[1].buffer,first,'Start and Next use the exact same decoded recording');
await audio.after('toggle',started,{...started,running:false,revision:3},'E',audio.prepare());assert.equal(ctxs[0].plays.length,2,'Pause never emits the start sample');
await audio.after('level',started,{...started,revision:4},'E',audio.prepare());assert.equal(ctxs[0].plays.length,2,'out-of-bounds next does not ring');
const display=new AudioContext();await display.resume();await samples.preloadSelectedTimerSounds(display);assert.equal(samples.playSelectedTimerSound(display,'start',.9,0,0,samples.timerTransitionCueKey(next,'E')),null,'projection cannot double the local command cue');
const resumed={index:1,running:true,revision:5};await audio.after('toggle',{...resumed,running:false},resumed,'E',audio.prepare());assert.equal(ctxs[0].plays.length,3,'Resume rings');await audio.after('toggle',{...resumed,running:false},resumed,'E',audio.prepare());assert.equal(ctxs[0].plays.length,3,'duplicate result is suppressed');
allow=false;const blocked=context.make();assert.equal(await blocked.after('toggle',paused,{...started,revision:6},'E',blocked.prepare()),false);assert.equal(ctxs.at(-1).plays.length,0);allow=true;
const closing=context.make(),closingReady=closing.prepare();closing.dispose();assert.equal(await closing.after('toggle',paused,{...started,revision:7},'E',closingReady),false,'disposed views cannot replay a cue');
// Exercise the actual controller handler, including transaction rejection.
const controller=readFileSync(new URL('timer-control.js',root),'utf8'),send=controller.slice(controller.indexOf('async function send('),controller.indexOf('\nfunction structure'));
const order=[],messages=[];let fail=false;
const runtime=vm.createContext({Date,console,timer:paused,id:'E',event:{eventId:'E'},demo:false,busy:false,update(){},timerAt:t=>t,message:m=>messages.push(m),commandAudio:{prepare(){order.push('prepare');return Promise.resolve(true)},after(action,before,after,eventId,ready){order.push('after');assert.equal(action,'toggle');assert.equal(before.running,false);assert.equal(after.running,true);return Promise.resolve(true)}},service:{async change(){order.push('write');if(fail)throw Error('offline');return started}}});
vm.runInContext(send+';globalThis.send=send;',runtime);await runtime.send('toggle');assert.deepEqual(order,['prepare','write','after']);order.length=0;runtime.timer=paused;fail=true;await runtime.send('toggle');assert.deepEqual(order,['prepare','write']);assert.match(messages.at(-1),/offline/);
console.log('PASS: first-click audio unlock, delayed decode, identical Start/Next WAV, resume, blocked-autoplay safety, no duplicate projection cue, disposal and failed-write silence.');
