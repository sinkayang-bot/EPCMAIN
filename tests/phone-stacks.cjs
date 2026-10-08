const assert=require('assert/strict'),{updateStack,protectStacks}=require('../phone/stack-core.js');
const e={status:'open',name:'第一場',players:[{memberId:'A',buyin:1,rebuy:3,stack:100,prize:400},{memberId:'B',stack:200}]};
const saved=updateStack(e,'A',0,100);assert.equal(saved.players[0].stack,0);assert.equal(saved.players[0]._stackRevision,1);assert.equal(saved.players[0].rebuy,3);assert.equal(saved.players[1].stack,200);assert.equal(e.players[0].stack,100);
assert.throws(()=>updateStack({...e,status:'settled'},'A',2,100),/結算/);assert.throws(()=>updateStack(e,'MISSING',2,null),/名單/);assert.throws(()=>updateStack(e,'A',NaN,100),/整數/);assert.throws(()=>updateStack(e,'A',10,50),/更新/);
const remote={...saved,players:[...saved.players,{memberId:'C',stack:500}]};assert.equal(updateStack(remote,'B',300,200).players.length,3,'saving one player preserves latest roster');
const stale=protectStacks(e,saved);assert.equal(stale.players[0].stack,0,'old computer cannot roll back phone stack');assert.equal(stale.players[0]._stackRevision,1);
const next={...saved,players:saved.players.map(p=>p.memberId==='A'?{...p,stack:600,_stackRevision:2}:p)};assert.equal(protectStacks(next,saved).players[0].stack,600,'explicit newer desktop edit works');
assert.throws(()=>protectStacks({...saved,players:saved.players.map(p=>({...p,stack:999}))},saved),/較新/);
console.log('PASS: zero chips, settlement lock, deleted player, concurrent stack conflict, latest roster, and stale desktop rollback protection.');
