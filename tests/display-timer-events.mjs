import assert from 'node:assert/strict';
import {displayTimerEvents} from '../display-timer-events.js';
const doc=(id,data)=>({id,data:()=>data});let calls=[];
const fs={collection:(_, ...p)=>p.join('/'),documentId:()=> '__name__',where:(field,op,ids)=>({field,op,ids}),query:(path,filter)=>({path,filter}),getDocsFromServer:async q=>{calls.push(q);if(typeof q==='string')return {docs:Array.from({length:32},(_,i)=>doc('E'+i,{}))};assert.equal(q.filter.op,'in');assert(q.filter.ids.length<=30);return {docs:q.filter.ids.filter(id=>id!=='E1').map(id=>doc(id,{name:id,date:'2026-10-23',status:id==='E2'?'deleted':id==='E0'?'settled':'open'}))}}};
const rows=await displayTimerEvents({fs,db:{}});assert.equal(calls.length,3);assert.equal(rows.length,29);assert(!rows.some(r=>['E0','E1','E2'].includes(r.eventId)));console.log('Timer event listing: bounded batch queries, missing/deleted events excluded, active events first.');
