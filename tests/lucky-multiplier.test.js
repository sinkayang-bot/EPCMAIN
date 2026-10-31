// Run: node tests/lucky-multiplier.test.js
const assert=require('node:assert/strict');
require('../lucky-multiplier-core.js');
const {score,periods}=globalThis.EPCLuckyMultiplier;
const mk=(id,date,seq,players)=>({id,businessDate:date,seq,players:players.map(memberId=>({memberId}))});
const events=[
 mk('a','2026-10-30',1,['A','B']),
 mk('b','2026-10-30',2,['A']),
 mk('c','2026-10-30',3,['A']),
 mk('d','2026-10-30',4,['A']),
 mk('e','2026-10-31',1,['A']),
 mk('f','2026-10-31',2,['A']),
 mk('g','2026-10-31',3,['A']),
 mk('h','2026-10-31',4,['A'])
];
let result=score(events,{from:'2026-10-30',to:'2026-10-31'});
assert.equal(result.find(x=>x.memberId==='A').points,28,'weekday 12 + Saturday 16');
assert.equal(result.find(x=>x.memberId==='B').points,3,'only store first event earns bonus');
result=score([...events,events[0]],{from:'2026-10-30',to:'2026-10-31'});
assert.equal(result.find(x=>x.memberId==='A').points,28,'duplicate event is ignored');
result=score([mk('one','2026-10-30',1,['A','A'])],{from:'2026-10-30',to:'2026-10-30'});
assert.equal(result[0].points,3,'rebuy/duplicate player not counted twice');
assert.deepEqual(periods(2026,10),[{from:'2026-10-01',to:'2026-10-15'},{from:'2026-10-16',to:'2026-10-31'}]);
assert.throws(()=>score([],{from:'2026-10-31',to:'2026-10-01'}),/INVALID_PERIOD/);
console.log('Lucky multiplier core: all tests passed');
