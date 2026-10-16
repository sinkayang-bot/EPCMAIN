const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),code=source.slice(source.indexOf('async function api('),source.indexOf('function setSync('));
let record={memberKey:'K',memberId:'1',name:'old',nickname:'old nick',group:'updated by B',revision:2},view=false,writes=0;
const ctx={CONFIG:{apiUrl:'https://example.test/'},MEMBER_ROWS:[{...record,group:'old group',revision:1}],window:{EPCMode:{isView:()=>view,assertAction:action=>{if(view&&action==='member.update')throw Error('viewing')}},epcModeMemberBases:{K:{name:'old',nickname:'old nick',group:'old group'}}},AbortController,setTimeout,clearTimeout};
ctx.fetch=async(url,options)=>{const p=JSON.parse(options.body);let data;
 if(p.action==='member.list')data={ok:true,members:[record]};else if(p.expectedRevision!==record.revision)data={ok:false,error:'STALE_WRITE'};else{record={...record,...p.patch,revision:record.revision+1};writes++;data={ok:true,member:record};}
 return {status:200,text:async()=>JSON.stringify(data)};
};vm.createContext(ctx);vm.runInContext(code,ctx);
(async()=>{await ctx.api('member.update',{memberKey:'K',patch:{name:'old',nickname:'new A',group:'old group'},expectedRevision:1});assert.equal(record.nickname,'new A');assert.equal(record.group,'updated by B');assert.equal(writes,1);view=true;await assert.rejects(ctx.api('member.update',{memberKey:'K',patch:{name:'blocked'}}),/viewing/);assert.equal(writes,1);console.log('PASS: last saved member field retries current revision and preserves unrelated edits; viewing blocks updates.');})().catch(e=>{console.error(e);process.exitCode=1});
