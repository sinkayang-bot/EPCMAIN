const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),nodes=new Map();
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:''});return nodes.get(id)};
const c=vm.createContext({db:{settings:{businessEnd:'07:00'},events:[]},$:node,Date,Map,Set,Number,String,Object,Array,dashboardDefaultRange:()=>({first:'2026-10-01',end:'2026-10-02'}),isSettledAccountingEvent_:e=>['已結算','settled'].includes(e.status),epcDisplayEscape_:s=>String(s).replaceAll('<','&lt;')});
vm.runInContext(html.slice(html.indexOf('function hmMinutes('),html.indexOf('function saveAccountingBusinessHours(')),c);
vm.runInContext(html.slice(html.indexOf('function participationStats_('),html.indexOf('function renderDashboardSummary(')),c);
const p=(memberId,rebuy=0,flags={})=>({memberId,buyin:1,rebuy,...flags});
const first={id:'A',date:'2026-10-01',status:'已結算',players:[p('1',2,{earlyBird:true}),p('2',0,{ladies:true}),p('3'),p('4')]};
let r=c.participationStats_([first],'2026-10-01','2026-10-01');
assert.equal(r.total.entries,4);assert.equal(r.total.rebuys,2);assert.equal(r.total.groups,6,'4 initial registrations + 2 rebuy groups = 6');
const events=[first,{id:'B',date:'2026-10-02',status:'進行中',accountingGroup:'獨立帳',players:[p('1',1,{lateBird:true}),p('5',0,{buyin:'2',addon:'1',earlyBird:true,ladies:true})]},
 {id:'C',date:'2026-09-30',status:'settled',players:[p('old',50)]},
 {id:'D',date:'2026-10-03',status:'settled',players:[p('future',50)]},
 {id:'DEL',date:'2026-10-02',status:'deleted',players:[p('deleted',50)]},
 {id:'CANCEL',date:'2026-10-02',status:'已取消',players:[p('cancelled',50)]}];
const before=JSON.stringify(events);r=c.participationStats_(events,'2026-10-01','2026-10-02');
assert.deepEqual(JSON.parse(JSON.stringify(r.total)),{events:2,entries:6,buyins:7,rebuys:3,addons:1,groups:11,early:2,late:1,ladies:2});
assert.equal(r.members,5,'same member in two tournaments counts once in unique members');
assert.equal(r.days.length,2);assert.equal(r.days.reduce((n,d)=>n+d.groups,0),r.total.groups);
assert.equal(c.participationStats_(events,'2026-10-01','2026-10-02','settled').total.groups,6);
assert.equal(c.participationStats_(events,'2026-10-01','2026-10-02','open').total.groups,5);
assert.equal(c.participationStats_(events,'2026-10-02','2026-10-01').invalid,true);
assert.equal(c.participationStats_(events,'2027-01-01','2027-01-31').total.groups,0);
const legacy=[{createdAt:'2026-10-02T02:00:00',players:[p('',0),{buyin:0,rebuy:0,ladies:true},null,{memberId:'invalid',buyin:'NaN',rebuy:-5}]}];
r=c.participationStats_(legacy,'2026-10-01','2026-10-01');assert.equal(r.total.entries,1,'overnight timestamps belong to previous business day; empty/invalid registrations do not count');assert.equal(r.members,0);assert.equal(r.unknownMembers,1);
assert.equal(JSON.stringify(events),before,'report never mutates tournament or payment data');
c.db.events=events;c.renderParticipationStats_();
assert.equal(node('prEntries').textContent,'6');assert.equal(node('prRebuys').textContent,'3');assert.equal(node('prGroups').textContent,'11');assert.equal(node('prLadies').textContent,'2');assert.match(node('participationDailyRows').innerHTML,/2026-10-02/);
node('participationStatus').value='settled';c.renderParticipationStats_();assert.equal(node('prGroups').textContent,'6');
c.db.events[0].players[0].rebuy=3;c.renderParticipationStats_();assert.equal(node('prGroups').textContent,'7','remote data refresh uses latest groups');assert.equal(node('prEarly').textContent,'1','rebuy never multiplies registration discounts');
node('participationDateFrom').value='2026-10-02';node('participationDateTo').value='2026-10-01';c.renderParticipationStats_();assert.equal(node('prEntries').textContent,'0');assert.match(node('participationDailyRows').innerHTML,/修正/);
assert.match(html,/dashboardDateFrom[^>]+renderDashboardSummary/);assert.match(html,/renderParticipationStats_\(\);/);
node('participationDateFrom').value='2026-10-01';node('participationDateTo').value='2026-10-01';node('dashboardDateFrom').value='2027-01-01';node('dashboardDateTo').value='2027-01-31';c.renderParticipationStats_();assert.equal(node('prEntries').textContent,'4','independent report dates ignore dashboard date range');
console.log('PASS: inclusive business dates, overnight fallback, 4+2=6, additive groups, unique members, per-event discount counts, statuses, independent events, deleted events, empty/invalid data, daily totals, live rerender and no writes.');
