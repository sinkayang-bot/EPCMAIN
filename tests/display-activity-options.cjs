const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('index.html','utf8');
// Parse every inline script so edits to the monolithic page cannot break startup.
for(const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/src=|type="module"/.test(m[1]))new vm.Script(m[2]);
const dom=new JSDOM(source),doc=dom.window.document;
let writes=[];
const ctx={document:doc,console,crypto:require('node:crypto').webcrypto,window:{EPCMode:{isView:()=>false}},
 db:{activityManagement:{luckyMultiplier:{from:'2026-10-30',to:'2026-10-30'}},events:[{id:'E1',date:'2026-10-30',seq:1,players:[{memberId:'ABC'}]},{id:'E2',date:'2026-10-30',seq:2,players:[{memberId:'ABC',rebuy:20}]}]},
 $:id=>doc.getElementById(id),ensureActDb_:()=>{},actActivityRange_:()=>({}),actBusinessDate_:e=>e.date,isIndependentAccountingEvent:e=>!!e.independentAccounting,
 epcPlayerDisplayName_:id=>'玩家'+id,displayDevicesCache:[],saveDisplayPref_:()=>{},loadDisplays_:async()=>{},actionMsg:msg=>{throw Error(msg)},displayFetch_:async r=>writes.push(r)};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('lucky-multiplier-core.js','utf8'),ctx);
ctx.EPCLuckyMultiplier=ctx.window.EPCLuckyMultiplier;
const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
vm.runInContext(extract('function actActivityNames_(){','function actPublicVisibilityPanel_'),ctx);
vm.runInContext(extract('function displayActivityOptions_(){','async function pairDisplay_'),ctx);
vm.runInContext(extract('function displaySpecificControls_(','function refreshDisplayControls_'),ctx);
vm.runInContext(extract('function displayPayload_(type){','async function publishAllDisplays_'),ctx);
const ids=ctx.displayActivityIds_();assert.equal(ids.length,7);assert(ids.includes('luckyMultiplier'));assert(!ids.includes('boss'));
function controls(type){return ctx.displaySpecificControls_('TEST',type,15,{parallelItems:['luckyMultiplier'],rotateItems:['luckyMultiplier'],showMemberId:true,showName:false})}
for(const type of ['parallel','rotate','rotateParallel'])assert(controls(type).includes('幸運加乘'));
const tab=doc.querySelector('[onclick="setActTab_(\'luckyMultiplier\')"]');tab.textContent='7. 幸運加乘新名稱';assert(ctx.displayContentOptions_('luckyMultiplier').includes('幸運加乘新名稱'));
const fake=doc.createElement('button');fake.setAttribute('onclick',"setActTab_('future')");fake.textContent='8. 新活動';tab.after(fake);assert(ctx.displayContentOptions_('').includes('新活動'));fake.remove();
const payload=ctx.displayPayload_('luckyMultiplier');assert.equal(payload.rows[0].score,5);assert.equal(payload.rows[0].games,2);assert.equal(payload.title,'幸運加乘新名稱');assert.equal(payload.activityFrom,'2026-10-30');
(async()=>{
 for(const type of ['luckyMultiplier','parallel','rotate','rotateParallel']){
  const box=doc.createElement('div');box.innerHTML='<select id="displayType_TEST"><option selected>'+type+'</option></select>'+controls(type);doc.body.append(box);
  await ctx.publishDisplay_('TEST',true);const r=writes.at(-1);assert.equal(r.contentType,type);
  const p=r.payload;
  const row=type==='parallel'?p.panels[0]:type==='rotate'?p.slides[0]:type==='rotateParallel'?p.slides[0].panels[0]:p;
  assert.equal(row.type,'luckyMultiplier');assert.equal(row.rows[0].score,5);assert.equal(p.ui.showMemberId,true);assert.equal(p.ui.showName,false);box.remove();
 }
 const tv=fs.readFileSync('tv/screen.js','utf8');vm.runInContext(tv.slice(tv.indexOf('function parallelLayout('),tv.indexOf('function fitBossPanel')),ctx);
 for(const n of [1,4,6,7,8,9]){const l=ctx.parallelLayout(Array.from({length:n},(_,i)=>({type:'test'+i})));assert.equal(l.items.length,n);assert(l.items.every(x=>Number.isInteger(x.span)));}
 assert(!tv.includes('(p.panels||[]).slice(0,6)'));
 const host=doc.createElement('main');const screen={document:doc,host,timer:null,esc:v=>String(v??''),money:v=>String(v),clearTimeout:()=>{},setTimeout:()=>{},getComputedStyle:()=>({paddingTop:0,paddingBottom:0})};
 vm.createContext(screen);vm.runInContext(tv.slice(tv.indexOf('function identity'),tv.indexOf('\ntry{\n cloud=')),screen);
 screen.show({paired:true,payload:{type:'parallel',panels:Array.from({length:7},()=>({...payload,ui:{showMemberId:true}}))}});
 assert.equal(host.querySelectorAll('.activity-panel').length,7);assert(host.textContent.includes('玩家ABC'));assert(host.textContent.includes('重買不計分'));

 console.log('PASS: management tabs, dynamic additions/renames, all selection/publish modes, lucky scores, identity settings, layouts above six activities and page syntax');dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1});
