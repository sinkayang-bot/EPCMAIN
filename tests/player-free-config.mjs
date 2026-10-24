import assert from 'node:assert/strict';
import {validateConfig,readConfig} from '../player-free/config.js';
const valid={projectId:'epc-player-261024-ab12cd',apiKey:'AIzaSy12345678901234567890123456789',authDomain:'epc-player-261024-ab12cd.firebaseapp.com',appId:'1:123456789:web:abcdef123456'};
assert.equal(validateConfig(valid).projectId,valid.projectId);assert.throws(()=>validateConfig({...valid,projectId:'epcmain-76988'}));assert.throws(()=>validateConfig({...valid,authDomain:'evil.example'}));assert.throws(()=>validateConfig({...valid,apiKey:'bad'}));assert.equal(readConfig({getItem:()=>'{broken'}),null);assert.equal(readConfig({getItem(){throw Error('blocked')}}),null);assert.deepEqual(validateConfig({...valid,accessToken:'DO NOT KEEP',privateKey:'NEVER'}),valid);
console.log('PASS: only isolated player projects accepted; original EPC project/foreign auth domains rejected; malformed storage handled; credentials stripped.');
