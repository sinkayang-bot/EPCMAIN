import assert from 'node:assert/strict';
import {selectDisplayTimer} from '../display-timer-selection.js';
const records=new Map([['devices/TV',{paired:true,payload:{type:'timer',eventId:'E1'}}],['epc_events/_epc_timer/timers/E2',{running:true,endsAt:900000,index:1}],['epc_events/E2',{name:'EPC#2',status:'open'}]]),original=JSON.stringify(records.get('epc_events/_epc_timer/timers/E2'));let writes=[];
const fs={doc:(_, ...parts)=>parts.join('/'),runTransaction:async(_,fn)=>{const pending=[];const result=await fn({get:async key=>({exists:()=>records.has(key),data:()=>structuredClone(records.get(key))}),update:(key,value)=>pending.push([key,value])});for(const [key,value] of pending){records.set(key,{...records.get(key),...value});writes.push(key)}return result}};
const result=await selectDisplayTimer({fs,db:{},ref:'devices/TV',eventId:'E2'});assert.equal(result.eventId,'E2');assert.equal(records.get('devices/TV').assignment.payload.eventId,'E2');assert.equal(JSON.stringify(records.get('epc_events/_epc_timer/timers/E2')),original);assert.deepEqual(writes,['devices/TV']);
await assert.rejects(selectDisplayTimer({fs,db:{},ref:'devices/TV',eventId:'missing'}),/不存在/);assert.equal(writes.length,1);
records.get('devices/TV').paired=false;await assert.rejects(selectDisplayTimer({fs,db:{},ref:'devices/TV',eventId:'E2'}),/配對/);assert.equal(writes.length,1);
console.log('Display picker: only selected device assignment changes, timer progress preserved, missing events and unpaired devices rejected atomically.');
