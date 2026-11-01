const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
require('../member-number-core.js');const C=global.EPCMemberNumbers;
const members=[{memberId:'OLD123',memberKey:'K1',name:'會員甲'},{memberId:'OTHER',memberKey:'K2'}];
const map=C.assign({},'OLD123',' NEW999 ',members);assert.equal(C.number('OLD123',map),'NEW999');assert.equal(C.resolve('new999',map,members),'OLD123');
assert.throws(()=>C.assign(map,'OTHER','new999',members),/使用/);assert.throws(()=>C.assign(map,'OTHER','old123',members),/使用/);assert.throws(()=>C.assign(map,'OLD123','',members),/1～32/);assert.equal(C.number('OLD123',C.assign(map,'OLD123','BACK123',members)),'BACK123');
const original={events:[{id:'E1',date:'2026-11-01',players:[{memberId:'OLD123',memberKey:'K1',name:'會員甲',stack:123,buyin:2}]}],ledger:{memberId:'OLD123',wallet:300,accounts:{E1:{paid:2400}}},activityManagement:{hunter:[{killer:'OLD123',points:3}],weeklyClaims:{OLD123:true}}};
const dom=new JSDOM('<input id="mId" value="NEW999"><input id="mName" value="會員甲"><input id="mNickname"><input id="mGroup"><input id="mNote"><button id="memberSaveBtn"></button><button id="memberCancelBtn"></button>');
let revision=1,settings=structuredClone(original.activityManagement),calls=[],fail=false,conflict=true,view=false,canceled=false;
const ctx={console:{error:()=>{}},document:dom.window.document,editingMemberId:'OLD123',MEMBER_ROWS:members,legacyDb_:()=>ctx.db,db:{members:members.map(m=>({...m,id:m.memberId})),...structuredClone(original)},EPC_ACTIVITY_PENDING:null,EPC_ACTIVITY_SAVING:false,EPC_ACTIVITY_SAVE_TIMER:null,EPCMode:{assertWrite:()=>{if(view)throw Error('view')}},EPCMemberNumbers:C,alert:m=>{ctx.lastError=m},renderMembers:()=>{},cancelMemberEdit:()=>{canceled=true},syncLegacyMemberFromV3_:()=>{},applyActivitySnapshot_:(data,rev)=>{ctx.db.activityManagement=data},api:async(action,p={})=>{
 calls.push({action,p});if(action==='member.list')return {members};if(action==='member.update')return {member:members[0]};if(action==='activity.get')return {data:settings,revision};if(action==='activity.update'){
 if(fail)throw Error('offline');if(conflict){conflict=false;settings={...settings,concurrentNote:'preserved'};revision++;throw Error('STALE_WRITE')}
 assert.equal(p.expectedRevision,revision);settings=p.data;revision++;return {revision};}
 throw Error(action);
}};ctx.$=id=>ctx.document.getElementById(id);ctx.cloneCloud_=structuredClone;ctx.scrollTo=()=>{};ctx.memberNumber_=v=>C.number(v,ctx.db.activityManagement.memberNumbers||{});ctx.window=ctx;vm.createContext(ctx);const app=fs.readFileSync('app.js','utf8');vm.runInContext(app.slice(app.indexOf('async function saveMemberNumber_'),app.indexOf('window.performDelMember=')),ctx);
(async()=>{
 await ctx.saveMemberEdit();assert.equal(ctx.lastError,undefined);assert(canceled);assert.equal(settings.memberNumbers.OLD123.number,'NEW999');assert.equal(settings.concurrentNote,'preserved');
 const html=fs.readFileSync('index.html','utf8');vm.runInContext(html.slice(html.indexOf('function editMember(id){'),html.indexOf('async function saveMemberEdit(){')),ctx);ctx.editMember('OLD123');assert.equal(ctx.document.querySelector('#mId').value,'NEW999');assert.equal(ctx.document.querySelector('#mId').disabled,false,'existing member number is editable in the actual form');
 assert.deepEqual(ctx.db.events,original.events);assert.deepEqual(ctx.db.ledger,original.ledger);assert.deepEqual(settings.hunter,original.activityManagement.hunter);assert.deepEqual(settings.weeklyClaims,original.activityManagement.weeklyClaims);
 assert(!('memberId' in calls.find(x=>x.action==='member.update').p.patch),'profile ID and all historical keys remain stable');
 ctx.document.querySelector('#mId').value='OTHER';calls=[];ctx.lastError='';await ctx.saveMemberEdit();assert.match(ctx.lastError,/使用/);assert.equal(calls.length,0,'duplicate blocked before profile writes');
 ctx.document.querySelector('#mId').value='NEXT999';fail=true;canceled=false;await ctx.saveMemberEdit();assert.match(ctx.lastError,/offline/);assert(!canceled);assert.equal(settings.memberNumbers.OLD123.number,'NEW999','failed cloud write leaves old mapping authoritative');
 fail=false;const prior=JSON.stringify(settings);await assert.rejects(ctx.saveMemberNumber_('OLD123','OLD123',true),/已存在/);assert.equal(JSON.stringify(settings),prior,'failed duplicate signup cannot reset an existing custom number');
 view=true;calls=[];await ctx.saveMemberEdit();assert.equal(calls.length,0,'view mode blocks every write');
 // Same-source aliases are emitted after ranking/claim calculation, with stable lookup identifiers.
 require('../lucky-multiplier-core.js');const source=fs.readFileSync('activity-lookup/catalog-core.js','utf8');const {buildCatalog}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const catalog=buildCatalog({memberNumbers:map,publicActivityVisibility:{weekly:true},weeklyClaims:{},activityRanges:{}},original.events);
 assert.equal(catalog[0].leaderboard[0].memberId,'NEW999');assert.equal(catalog[0].leaderboard[0].recordId,'OLD123');assert.equal(catalog[0].leaderboard[0].games,1);
 dom.window.close();console.log('PASS: editable numbers, duplicate/reserved IDs, concurrency retry, unrelated settings preservation, unchanged event/ledger/claims keys, cloud failure and view guard, public lookup continuity');
})().catch(e=>{console.error(e);process.exitCode=1});
