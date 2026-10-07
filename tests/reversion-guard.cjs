const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),app=fs.readFileSync('app.js','utf8'),bridge=fs.readFileSync('firebase-events.js','utf8');
const extract=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
(async()=>{
 let old={status:'settled',players:[{nickname:'先鋒',prize:5700}],_eventUpdatedAt:20},written;
 const ctx={fs:{doc:()=>({}),runTransaction:async(_,fn)=>fn({get:async()=>({exists:()=>true,data:()=>old}),set:(_,row)=>{written=row}}),serverTimestamp:()=>0,deleteField:()=>null},db:{},col:{},clean:x=>x};
 vm.createContext(ctx);vm.runInContext('const api={'+extract(bridge,'async upsertEvent(','async createEvent(')+'};globalThis.save=api.upsertEvent;',ctx);
 await assert.rejects(ctx.save({eventId:'E',status:'open'}),/已結算/);assert.equal(written,undefined);
 await ctx.save({eventId:'E',status:'settled',players:[]});assert.equal(written,undefined);
 await ctx.save({eventId:'E',status:'open',_eventUpdatedAt:21},{unlock:true});assert.equal(written.status,'open');assert.equal(written.finalAccounting,null);
 old={status:'open',_eventUpdatedAt:30};await assert.rejects(ctx.save({eventId:'E',status:'open',_eventUpdatedAt:25}),/較新/);
 const events=[{id:'E',status:'已結算'}],members=[{memberId:'M',nickname:'先鋒',revision:3}];
 const c={window:{EPCFirestore:{ready:true},EPC_FIRESTORE_LAST_EVENTS:[],epcAuthoritativeMembers_:()=>members},db:{events}};vm.createContext(c);vm.runInContext(extract(html,'function epcAcceptLegacyDb_','function mergeFormMembers('),c);
 const accepted=c.epcAcceptLegacyDb_({events:[{id:'E',status:'進行中'}],members:[{id:'M',nickname:''}]});assert.equal(accepted.events,events);assert.equal(accepted.members[0].nickname,'先鋒');
 vm.runInContext('let MEMBER_ROWS=[{memberKey:"M",nickname:"先鋒",revision:3}];'+extract(app,'function mergeMemberSnapshot_','const memberNicknameQueues='),c);
 assert.equal(c.mergeMemberSnapshot_([{memberKey:'M',nickname:'',revision:2}])[0].nickname,'先鋒');assert.equal(c.mergeMemberSnapshot_([{memberKey:'M',nickname:'新名',revision:4}])[0].nickname,'新名');
 console.log('PASS: legacy rollback blocked, settled writes locked, explicit unlock allowed, stale event/member snapshots rejected.');
})();
