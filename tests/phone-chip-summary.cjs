const assert=require('node:assert/strict'),{chipSummary}=require('../phone/stack-core.js');
const e={chips:100000,players:[{memberId:'A',buyin:1,rebuy:2,addon:1,stack:350000},{memberId:'B',buyin:1,stack:100000},{memberId:'C',buyin:1,stack:null}]};
let s=chipSummary(e);assert.equal(s.groups,6);assert.equal(s.expected,600000);assert.equal(s.saved,450000);assert.equal(s.difference,-150000);assert.equal(s.missing,1);
s=chipSummary(e,{A:{stack:'500000'}});assert.equal(s.previewDifference,0);assert.equal(s.difference,-150000);assert.equal(s.pending,1);assert.equal(e.players[0].stack,350000,'preview never writes actual chips');
s=chipSummary(e,{A:{stack:'600000'},C:{stack:'0'}});assert.equal(s.previewDifference,100000);assert.equal(s.invalid,0);assert.equal(s.pending,2);
for(const raw of ['', '-1','2x','1.5','9007199254740992']){s=chipSummary(e,{A:{stack:raw}});assert.equal(s.invalid,1);assert.equal(s.preview,450000);}
s=chipSummary(e,{A:{seat:'2',hunterHeads:'4'}});assert.equal(s.pending,0);assert.equal(s.saved,450000);
e.players[0].stack=500000;e.players[2].stack=0;assert.equal(chipSummary(e).difference,0);assert.equal(chipSummary(e).missing,0);
e.players[0].rebuy=3;assert.equal(chipSummary(e).difference,-100000,'live rebuy changes expected chips');
console.log('PASS: shared desktop group formula, missing/zero stacks, deficit/excess, unsaved preview, invalid input, and live rebuy totals.');
