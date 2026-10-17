const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
let saves=0,notices=[];
const c={db:{activityManagement:{extremeTen:[]}},Map,Set,Date,Math,Number,String,confirm:()=>true,prompt:()=>null,actRecordEligible_:x=>x.eventId!=='independent',actActivityRange_:()=>({from:'2026-10-15',to:'2026-10-31'}),actionMsg:(m)=>notices.push(m),persist:()=>saves++,renderActivities:()=>{},stampActivityRecord_:x=>x,businessDateForEvent:()=> '2026-10-31',window:{},epcPlayerDisplayName_:id=>'player'+id,epcPlayerDisplayHtml_:id=>'player'+id,epcDisplayEscape_:x=>String(x||''),actRange_:()=>({from:'',to:'',q:''}),actMemberSearchOptions_:()=>'',actEvents_:()=>[]};
vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function extremeTenCents_('),html.indexOf('\nfunction renderActivities()',html.indexOf('function extremeTenCents_('))),c);
const row=(id,memberId,cents,createdAt,extra={})=>({id,memberId,cents,createdAt,date:'2026-10-17',awardType:'',claimed:false,...extra});
c.db.activityManagement.extremeTen=[row('a-old','1',980,1),row('a-best','1',999,2),row('a-later-tie','1',1001,3),row('b','2',1002,4),row('c','3',998,5),row('ignored','4',1000,0,{eventId:'independent'}),row('deleted','5',1000,0,{deleted:true}),row('outside','6',1000,0,{date:'2026-11-01'})];
let s=c.extremeTenStats_();assert.equal(s.rows.length,5);assert.equal(s.leaderboard.length,3);assert.equal(s.leaderboard[0].id,'a-best');assert.equal(s.candidates.length,3);assert.equal(new Set(s.candidates.map(x=>x.memberId)).size,3);
let view=c.actExtremeTen_();assert(view.includes('每人最佳成績排行榜'));assert(view.includes('全部挑戰紀錄'));assert(view.includes('9.80 秒'));assert(view.includes('僅紀錄'));
c.extremeTenAward_('a-old','補發');assert.equal(saves,0);assert(notices.at(-1).includes('最佳成績'));
c.extremeTenAward_('a-best','補發');assert.equal(saves,1);s=c.extremeTenStats_();assert.equal(s.candidates.some(x=>x.memberId==='1'),false);assert.equal(s.remaining,7);
c.extremeTenAward_('a-later-tie','補發');assert.equal(saves,1);assert(notices.at(-1).includes('限領一次'));
c.db.activityManagement.extremeTen.push(row('a-success','1',1000,6));s=c.extremeTenStats_();assert.equal(s.leaderboard.find(x=>x.memberId==='1').id,'a-success');assert.equal(s.leaderboard.find(x=>x.memberId==='1').awardRecordId,'a-best');assert.equal(s.successful.length,0);c.extremeTenAward_('a-success','成功');assert.equal(saves,1);
c.extremeTenClaim_('a-best',true);assert.equal(saves,2);assert(c.db.activityManagement.extremeTen.find(x=>x.id==='a-best').claimed);
// Existing historical duplicates remain intact for review and do not free prize slots.
c.db.activityManagement.extremeTen.push(row('legacy-duplicate','1',1001,7,{awardType:'補發'}));s=c.extremeTenStats_();assert.equal(s.leaderboard.filter(x=>x.memberId==='1').length,1);assert.equal(s.remaining,6);assert.equal(s.leaderboard.find(x=>x.memberId==='1').awardCount,2);c.extremeTenClaim_('legacy-duplicate',true);assert.equal(saves,2);assert(notices.at(-1).includes('不能重複領取'));
// Deleting/editing best attempts automatically promotes the next best record.
c.db.activityManagement.extremeTen=c.db.activityManagement.extremeTen.filter(x=>x.memberId!=='1');c.db.activityManagement.extremeTen.push(row('d1','7',990,8),row('d2','7',995,9));s=c.extremeTenStats_();assert.equal(s.leaderboard.find(x=>x.memberId==='7').id,'d2');c.extremeTenDelete_('d2');s=c.extremeTenStats_();assert.equal(s.leaderboard.find(x=>x.memberId==='7').id,'d1');
// Projection consumes the same unique leaderboard and preserves same-distance ties.
vm.runInContext(html.slice(html.indexOf('function displayPayload_('),html.indexOf('async function publishDisplay_(')),c);c.ensureActDb_=()=>{};
let p=c.displayPayload_('extremeTen');assert.equal(new Set(p.rows.map(x=>x.memberId)).size,p.rows.length);assert.equal(p.rows[0].rank,1);assert.equal(p.rows[1].rank,1);assert(!p.rows.some(x=>x.memberId==='4'));assert.equal(c.db.activityManagement.extremeTen.filter(x=>x.memberId==='7').length,2);
console.log('PASS: unique best-per-player ranking, all attempts retained, ties, award/claim dedupe, existing payout quota preserved, next-best promotion and unique projection.');
