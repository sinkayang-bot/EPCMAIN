const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window;let writes=0;
 w.alert=()=>{};w.confirm=()=>false;w.scrollTo=()=>{};w.setInterval=()=>0;w.setTimeout=()=>0;w.clearTimeout=()=>{};w.console={log(){},warn(){},error(){}};
 const local={members:[],events:[],activityManagement:{boss:{startPrize:9999}}};
 w.localStorage.setItem('epcV1',JSON.stringify(local));w.localStorage.setItem('epcLocalDirty','1');w.localStorage.setItem('epcTerminalModeV1','operate');w.localStorage.setItem('epcActivityPendingV1',JSON.stringify({data:local.activityManagement,revision:1,sequence:1}));
 w.fetch=async(url,options)=>{const request=JSON.parse(options?.body||'{}');if(!['ping','bootstrap','changes','member.list','event.list','player.list','activity.get','load'].includes(request.action))writes++;
 const data={ok:true,members:[],events:[],players:[],changes:[],data:{boss:{startPrize:3000}},revision:2,cursor:0,settings:{businessStart:'16:00',businessEnd:'07:00'}};return {ok:true,status:200,text:async()=>JSON.stringify(data),json:async()=>data};};
 w.eval(fs.readFileSync(require.resolve('../terminal-mode.js'),'utf8'));w.eval(fs.readFileSync(require.resolve('../event-patch-core.js'),'utf8'));
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){if(!m[1].includes('src=')&&!m[1].includes('module'))w.eval(m[2]);}
 w.eval(fs.readFileSync(require.resolve('../sync-v3.js'),'utf8'));w.eval(fs.readFileSync(require.resolve('../app.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
 assert.equal(w.EPCMode.get(),'view');assert.equal(writes,0);assert.equal(w.localStorage.getItem('epcActivityPendingV1'),null);assert(w.localStorage.getItem('epcActivityPausedInViewV1'));assert(w.document.getElementById('eName').disabled);assert(!w.document.getElementById('memberSearch').disabled);
 dom.window.close();console.log('PASS: full desktop inline/app startup with stale local data defaults to viewing and makes no data writes or pending activity replay.');
})().catch(err=>{console.error(err);process.exitCode=1});
