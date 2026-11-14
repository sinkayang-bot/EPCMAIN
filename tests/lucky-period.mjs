import assert from 'node:assert/strict';
import {effectiveDisplay} from '../display-assignment.js';
const assigned={type:'luckyDraw',period:'2026-11-02_2026-11-15'};
const device={paired:true,contentType:'luckyDraw',payload:{type:'luckyDraw',period:'undefined_undefined'},assignment:{id:'original',contentType:'luckyDraw',payload:assigned}};
assert.deepEqual(effectiveDisplay(device).payload,assigned);
assert.deepEqual(effectiveDisplay({...device,payload:{type:'luckyDraw',period:'2026-11-16_2026-11-30'}}).payload,assigned);
const next={type:'luckyDraw',period:'2026-11-16_2026-11-30'};
assert.deepEqual(effectiveDisplay({...device,assignment:{...device.assignment,id:'new',payload:next}}).payload,next);
console.log('PASS draw assignment survives missing/changed background date ranges; explicit reassignment switches period');
