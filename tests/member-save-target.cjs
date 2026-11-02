const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
require('../member-number-core.js');const Core=global.EPCMemberNumbers;
const src=fs.readFileSync('app.js','utf8');
function setup(){
 const dom=new JSDOM('<input id="mId" value="A123456"><input id="mName" value="玩家"><input id="mNickname" value="暱稱"><input id="mGroup" value="A組"><input id="mNote"><button id="memberSaveBtn"></button>');
 const field=dom.window.document.querySelector('#mId');field.dataset.originalMemberId='OLD123';field.dataset.originalMemberKey='STALE';field.dataset.profileBase=JSON.stringify({name:'玩家',nickname:'暱稱',group:'A組'});
 const state={source:[{memberId:'OLD123',memberKey:'FRESH',revision:5,name:'玩家',nickname:'暱稱',group:'A組'}],settings:{hunter:[{killer:'OLD123',points:8}]},revision:1,calls:[],alerts:[],closed:0,profileFailure:null,reads:0,view:false};
 const db={members:[{id:'OLD123',memberKey:'STALE',name:'玩家',nickname:'暱稱',group:'A組'}],activityManagement:{},events:[{players:[{memberId:'OLD123',memberKey:'STALE',stack:200000}]}]};
 const ctx={document:dom.window.document,editingMemberId:null,db,legacyDb_:()=>db,MEMBER_ROWS:[{memberId:'UNRELATED',memberKey:''},{memberId:'OLD123',memberKey:'STALE'}],console:{error:()=>{}},EPCMemberNumbers:Core,EPC_ACTIVITY_PENDING:null,EPC_ACTIVITY_SAVING:false,EPC_ACTIVITY_SAVE_TIMER:null,EPCMode:{assertWrite:()=>{if(state.view)throw Error('view')}},renderMembers:()=>{},cancelMemberEdit:()=>state.closed++,syncLegacyMemberFromV3_:row=>{state.synced=row},applyActivitySnapshot_:data=>{db.activityManagement=data},alert:m=>state.alerts.push(m),api:async(action,p={})=>{
 state.calls.push({action,p});
 if(action==='member.list'){state.reads++;if(state.onRead)state.onRead();return {members:state.source.map(m=>({...m}))}}
 if(action==='member.update'){if(state.profileFailure){const e=state.profileFailure;state.profileFailure=null;throw Error(e)}assert.equal(p.memberKey,state.source[0].memberKey);return {member:{...state.source[0],...p.patch,revision:6}}}
 if(action==='activity.get')return {data:state.settings,revision:state.revision};
 if(action==='activity.update'){state.settings=p.data;return {revision:++state.revision}}
 throw Error('unexpected '+action);
 }};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('async function saveMemberNumber_'),src.indexOf('window.performDelMember=')),ctx);return {ctx,state,dom,field};
}
(async()=>{
 // Previously this attempted member.update with a stale META key even when only changing the number.
 let t=setup();t.state.profileFailure='MEMBER_NOT_FOUND';const original=JSON.stringify(t.ctx.db.events);await t.ctx.saveMemberEdit();assert.equal(t.state.alerts.length,0);assert.equal(t.state.settings.memberNumbers.OLD123.number,'A123456');assert(!t.state.calls.some(x=>x.action==='member.update'));assert.equal(JSON.stringify(t.ctx.db.events),original);assert.equal(t.state.closed,1);t.dom.window.close();
 // Same-name unrelated row with empty key must never be used; fresh immutable ID selects the member.
 t=setup();t.ctx.document.querySelector('#mNickname').value='新暱稱';await t.ctx.saveMemberEdit();const update=t.state.calls.find(x=>x.action==='member.update');assert.equal(update.p.memberKey,'FRESH');assert.deepEqual(JSON.parse(JSON.stringify(update.p.patch)),{nickname:'新暱稱'});assert.equal(t.state.alerts.length,0);t.dom.window.close();
 // If the key changes between read and write, recover by the same original ID only once.
 t=setup();t.ctx.document.querySelector('#mName').value='新名字';t.state.profileFailure='MEMBER_NOT_FOUND';t.state.onRead=()=>{if(t.state.reads===2)t.state.source[0].memberKey='NEWKEY'};await t.ctx.saveMemberEdit();assert.equal(t.state.alerts.length,0);const updates=t.state.calls.filter(x=>x.action==='member.update');assert.equal(updates.length,2);assert.equal(updates[1].p.memberKey,'NEWKEY');t.dom.window.close();
 for(const source of [[],[{memberId:'OTHER',memberKey:'STALE',name:'玩家'}],[{memberId:'OLD123',memberKey:'K1'},{memberId:'OLD123',memberKey:'K2'}]]){
  t=setup();t.state.source=source;await t.ctx.saveMemberEdit();assert.equal(t.state.alerts.length,1);assert(!t.state.calls.some(x=>['member.update','activity.update','member.create'].includes(x.action)),'missing/ambiguous member cannot be guessed or recreated');assert.equal(t.state.closed,0);assert.equal(t.field.value,'A123456');t.dom.window.close();
 }
 t=setup();t.state.view=true;await t.ctx.saveMemberEdit();assert.equal(t.state.calls.length,0);t.dom.window.close();
 console.log('PASS: MEMBER_NOT_FOUND regression, number-only save, fresh-key recovery, exact original identity, sparse profile patches, ambiguity/missing-source stop and form preservation');
})().catch(e=>{console.error(e);process.exitCode=1});
