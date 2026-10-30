const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const source=fs.readFileSync('activity-lookup/catalog-core.js','utf8');
 const {buildCatalog}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const A={activityRanges:{weekly:{from:'2026-10-26',to:'2026-11-01'},umbrella:{from:'2026-10-26',to:'2026-11-01'}},publicActivityVisibility:{weekly:true,umbrella:true},umbrella:[{date:'2026-10-30',memberId:'ABC',coupons:3}]};
 const event={id:'E1',date:'2026-10-30',players:[{memberId:'ABC'}]};
 const rows=buildCatalog(A,[event]);
 assert.equal(rows.find(a=>a.id==='weekly').leaderboard[0].games,1);
 assert.equal(rows.find(a=>a.id==='umbrella').leaderboard[0].points,3);
 A.umbrella[0].coupons=8;
 const updated=buildCatalog(A,[event,{...event,id:'E2'}]);
 assert.equal(updated.find(a=>a.id==='weekly').leaderboard[0].games,2);
 assert.equal(updated.find(a=>a.id==='umbrella').leaderboard[0].points,8);
 A.publicActivityVisibility.umbrella=false;
 assert(!buildCatalog(A,[event]).some(a=>a.id==='umbrella'));
 assert.throws(()=>buildCatalog({},[]),/visibility/);
 console.log('PASS: event progress, activity edit, visibility, missing settings guard');
})();
