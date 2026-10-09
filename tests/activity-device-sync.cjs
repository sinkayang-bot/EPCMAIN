const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
const code=app.slice(app.indexOf('let EPC_ACTIVITY_SAVE_TIMER='),app.indexOf('/* V3 bridge'));
const clone=x=>JSON.parse(JSON.stringify(x));
let remote={data:{},revision:0},fail=false,block=null,writes=0;
async function api(action,payload){if(action==='activity.get')return clone(remote);if(fail)throw Error('offline');if(block)await block;if(payload.expectedRevision!==remote.revision)throw Error('STALE_WRITE');writes++;remote={data:clone(payload.data),revision:remote.revision+1};return clone(remote)}
function terminal(local,saved={}){
 const values=new Map(Object.entries(saved)),state={textContent:'',style:{}},ctx={window:{epcDb:local,addEventListener(){},confirm:()=>true},legacyDb_:()=>local,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},document:{visibilityState:'visible',getElementById:()=>state},api,setTimeout:()=>1,clearTimeout(){},setInterval(){},console:{warn(){},error(){}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,local,values,state};
}
(async()=>{
 const original={boss:{startPrize:3000,bosses:[{id:'B',name:'白灼',cycleVersion:1,attacks:[{id:'ATTACK',damage:10}]}]},activityRanges:{rank:{from:'2026-10-05',to:'2026-10-11'}},pioneer:{E:{confirmed:true,first4:['M']}},umbrella:[{id:'U',coupons:5}]};
 const A=terminal({activityManagement:clone(original)});assert.equal(A.ctx.window.db,undefined,'real app exposes epcDb only');
 assert.deepEqual(JSON.parse(A.values.get('epcActivityBeforeSyncV1')).data,original,'pre-fix device activity backup is retained');await A.ctx.refreshActivityCloudV3_();await A.ctx.flushActivityCloudV3_();assert.equal(writes,0,'opening source device cannot automatically upload');await A.ctx.window.uploadLocalActivityV3();assert.equal(writes,1);assert.deepEqual(remote.data,original,'original device recovers all settings and records into empty cloud');
 const B=terminal({activityManagement:{boss:{startPrize:0,bosses:[{id:'BOSS1',name:'魔王 1',attacks:[]}]}}});await B.ctx.refreshActivityCloudV3_();assert.deepEqual(clone(B.local.activityManagement),original);assert.equal(writes,1,'viewing device never publishes defaults');
 const empty=terminal({activityManagement:{boss:{startPrize:0,bosses:[{id:'BOSS1',name:'魔王 1',attacks:[]}]}}});assert.equal(empty.ctx.meaningfulActivity_(empty.local.activityManagement),false);await empty.ctx.window.uploadLocalActivityV3();assert.equal(writes,1,'empty viewing device cannot upload defaults');
 let release;block=new Promise(r=>release=r);A.local.activityManagement.boss.startPrize=4000;A.ctx.window.saveActivityCloudV3();const first=A.ctx.flushActivityCloudV3_();A.local.activityManagement.boss.startPrize=5000;A.ctx.window.saveActivityCloudV3();await A.ctx.flushActivityCloudV3_();release();await first;block=null;await A.ctx.flushActivityCloudV3_();assert.equal(remote.data.boss.startPrize,5000);assert.equal(remote.revision,3,'rapid saves serialize and retain latest edit');
 await B.ctx.refreshActivityCloudV3_();assert.equal(B.local.activityManagement.boss.startPrize,5000);
 fail=true;B.local.activityManagement.boss.startPrize=6000;B.ctx.window.saveActivityCloudV3();await B.ctx.flushActivityCloudV3_();assert.match(B.state.textContent,/尚未同步/);assert.ok(B.values.has('epcActivityPendingV1'));assert.equal(B.ctx.applyActivitySnapshot_(remote.data,99),false,'failed save cannot be overwritten by a remote snapshot');
 const reboot=terminal({activityManagement:{}},Object.fromEntries(B.values));assert.equal(reboot.local.activityManagement.boss.startPrize,6000,'failed edits survive reload');fail=false;await reboot.ctx.flushActivityCloudV3_();assert.equal(remote.data.boss.startPrize,6000);
 A.local.activityManagement.boss.startPrize=7000;A.ctx.window.saveActivityCloudV3();await A.ctx.flushActivityCloudV3_();assert.equal(remote.data.boss.startPrize,6000,'stale device cannot roll back another device');assert.match(A.state.textContent,/另一台裝置/);assert.equal(A.local.activityManagement.boss.startPrize,7000,'conflicting local work remains recoverable');
 const extract=html.slice(html.indexOf('function epcAcceptLegacyDb_'),html.indexOf('function mergeFormMembers('));B.ctx.db=B.local;vm.runInContext(extract,B.ctx);const accepted=B.ctx.epcAcceptLegacyDb_({activityManagement:{boss:{startPrize:0}}});assert.equal(accepted.activityManagement.boss.startPrize,6000,'legacy imports cannot overwrite authoritative activities');
 console.log('PASS: epcDb-only runtime, explicit source-device upload, cross-device records/settings, read-only defaults, serialized edits, offline reload recovery, stale conflict protection, legacy rollback guard.');
})();
