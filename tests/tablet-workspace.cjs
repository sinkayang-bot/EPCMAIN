const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
require('../player-payments-core.js');
(async()=>{
 const {setupPlayerPayments}=await import('../player-payments-cloud.js');
 const pricing=await import('../player-pricing.js');
 const html=fs.readFileSync(require.resolve('../tablet/index.html'),'utf8'),dom=new JSDOM(html,{url:'https://example.test/tablet/',runScripts:'outside-only'}),w=dom.window;
 global.window=w;const clone=x=>JSON.parse(JSON.stringify(x));
 const records=new Map([['events/E',{eventId:'E',name:'EPC#1',date:'2026-10-16',businessDate:'2026-10-16',status:'open',buyin:3000,fee:400,level:3400,buyinTotal:3400,buyinAdmin:400,rebuyTotal:3400,rebuyAdmin:400,earlyBirdDiscount:100,lateBirdDiscount:200,ladiesDiscount:200,chips:300000,players:[]}]]);
 let eventCallback,bridge,lock=Promise.resolve();
 const api={query:(col,condition)=>{assert.deepEqual(condition,['status','==','open']);return col},where:(...args)=>args,doc:(col,id)=>col+'/'+id,collection:(db,name)=>name==='epc_events'?'events':'accounting',serverTimestamp:()=>0,
 runTransaction(db,callback){const task=lock.then(async()=>{const data=new Map([...records].map(([k,v])=>[k,clone(v)]));let writes=false;
  const tx={get:async key=>{assert(!writes);const x=data.get(key);return {exists:()=>!!x,data:()=>clone(x)}},set:(key,x)=>{writes=true;data.set(key,clone(x))},update:(key,x)=>{writes=true;data.set(key,{...data.get(key),...clone(x)})}};
  const out=await callback(tx);records.clear();data.forEach((v,k)=>records.set(k,v));return out;});lock=task.catch(()=>{});return task;}};
 Object.assign(w,api,{fs:api,authMod:{},initializeApp:()=>({}),getFirestore:()=>({}),onSnapshot:(col,cb)=>{eventCallback=cb;return ()=>{}},setupPlayerPayments:options=>{bridge=options.bridge;setupPlayerPayments(options)},setupAccountingAuth:options=>{options.bridge.accountingReady=true;options.bridge.requireAccountingAccess=()=>{}},...pricing});
 w.scrollTo=()=>{};Object.defineProperty(w.document,'readyState',{configurable:true,get:()=> 'interactive'});w.eval(fs.readFileSync(require.resolve('../tablet/workspace.js'),'utf8'));
 w.ResizeObserver=class{observe(){}};w.confirm=()=>true;
 w.fetch=async()=>({ok:true,json:async()=>({ok:true,members:[{memberId:'42',name:'甲'},{memberId:'43',name:'乙'}]})});
 w.eval(fs.readFileSync(require.resolve('../member-number-core.js'),'utf8'));
 w.eval(fs.readFileSync(require.resolve('../phone/stack-core.js'),'utf8'));
 const source=fs.readFileSync(require.resolve('../phone/phone.js'),'utf8').replace(/^import .*;\n/gm,'');w.eval(source);
 const $=id=>w.document.getElementById(id),tick=()=>new Promise(r=>setImmediate(r));await tick();await tick();
 function snapshot(){eventCallback({docs:[{id:'E',data:()=>clone(records.get('events/E'))}],metadata:{fromCache:false}});}

 records.get('events/E').players=[{memberId:'42',name:'甲',buyin:1,rebuy:0,stack:100,seat:'1-1'},{memberId:'43',name:'乙',buyin:1,rebuy:0,stack:200,seat:'1-2'}];
 snapshot();assert($('tabletRail'));assert.equal($('tabletRoster').querySelectorAll('[data-player]').length,2);assert.equal($('players').querySelectorAll('.card').length,1);
 $('tabletRoster').querySelector('[data-player="43"]').click();let field=$('players').querySelector('[data-field="stack"]');assert.equal(field.dataset.member,'43');field.value='1234';field.dispatchEvent(new w.Event('input',{bubbles:true}));
 $('tabletRoster').querySelector('[data-player="42"]').click();$('tabletRoster').querySelector('[data-player="43"]').click();assert.equal($('players').querySelector('[data-field="stack"]').value,'1234');snapshot();assert.equal($('players').querySelector('[data-field="stack"]').value,'1234');
 $('players').querySelector('[data-save]').click();await tick();await lock;await tick();assert.equal(records.get('events/E').players[1].stack,1234);assert.equal(records.get('events/E').players[0].stack,100);
 w.epcTabletGo('overviewPanel');assert($('playerPanel').hidden);assert(!$('overviewPanel').hidden);assert($('overviewPlayers').textContent.includes('甲'));
 w.epcTabletGo('registration');assert(!$('registration').hidden);$('memberSearch').value='42';$('memberSearch').dispatchEvent(new w.Event('input'));w.document.querySelector('[data-memberkey="42"]').click();assert.equal($('amountPaid').value,'3400');
 w.epcTabletGo('rebuyPanel');assert(!$('rebuyPanel').hidden);$('rebuyPlayer').value='43';$('rebuyPlayer').dispatchEvent(new w.Event('change'));$('rebuySaveBtn').click();await tick();await lock;await tick();assert.equal(records.get('events/E').players[1].rebuy,1);assert.equal(records.get('events/E').players[1].stack,1234);
 w.epcTabletGo('seatingPanel');assert(!$('seatingPanel').hidden);assert($('seatTables').children.length>0);
 console.log('PASS tablet shared cloud engine: active-event query, navigation, one editor for two players, retained draft across selection/live snapshots, targeted chip save, registration price, rebuy and seating');dom.window.close();
})().catch(err=>{console.error(err);process.exitCode=1});
