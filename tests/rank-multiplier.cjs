const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const rules=[{enabled:true,days:[0,6],mode:'firstN',firstN:2,mult:2},{enabled:true,days:[0,1,2,3,4,5,6],mode:'time',from:'23:59',to:'00:00',mult:2}];
const events=[['FOUR','第四場','00:00'],['TWO','第二場','20:00'],['ONE','第一場','18:00'],['THREE','第三場','22:00']].map(([id,name,startTime])=>({id,name,startTime,date:'2026-10-03',seq:1}));
const c={db:{settings:{businessStart:'16:00'},events,activityManagement:{rankRecurringRules:rules}},actBusinessDate_:e=>e.date,hmMinutes:t=>{const [h,m]=t.split(':').map(Number);return h*60+m}};vm.createContext(c);vm.runInContext(slice('function bossEventOrder_','function bossOrderedEvents_'),c);vm.runInContext(slice('function rankDayNum_','function addRankRecurringRule_'),c);
assert.deepEqual(events.map(e=>c.rankEventSeqOfDay_(e)),[4,2,1,3]);assert.deepEqual(events.map(e=>c.rankMultiplier_(e)),[2,2,2,1]);
assert.equal(c.rankTimeMatch_('23:59','23:59','00:00'),true);assert.equal(c.rankTimeMatch_('00:01','23:59','00:00'),false);assert.equal(c.rankTimeMatch_('23:59','00:00','00:00'),false);
events.forEach(e=>e.startTime='');assert.deepEqual(events.map(e=>c.rankEventSeqOfDay_(e)),[4,2,1,3]);assert.equal(c.rankMultiplier_(events[0]),1,'missing time must not be guessed as midnight');
console.log('PASS: business-day ordering across midnight, imported seq=1, time boundaries, highest multiplier and missing times.');
