const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const modeCode=fs.readFileSync(require.resolve('../terminal-mode.js'),'utf8'),patchCode=fs.readFileSync(require.resolve('../event-patch-core.js'),'utf8');
const bridgeSource=fs.readFileSync(require.resolve('../firebase-events.js'),'utf8');
const objectCode=bridgeSource.slice(bridgeSource.indexOf('  window.EPCFirestore={'),bridgeSource.indexOf('  const paymentModule='));
const clone=x=>JSON.parse(JSON.stringify(x));let calls=0,lock=Promise.resolve();
let server={eventId:'E',status:'open',name:'EPC',players:[{memberId:'1',nickname:'one',buyin:1,rebuy:0,stack:10,_stackRevision:1},{memberId:'2',nickname:'two',buyin:1,stack:20}],_eventUpdatedAt:1};
const sdk={doc:(col,id)=>id,serverTimestamp:()=>0,runTransaction(db,fn){const task=lock.then(async()=>{let next=clone(server),written=false;const tx={get:async()=>{assert(!written);return {exists:()=>true,data:()=>clone(next)}},set:(ref,data)=>{written=true;next={...next,...clone(data)}},update:(ref,data)=>{written=true;next={...next,...clone(data)}}};const out=await fn(tx);server=next;return out});lock=task.catch(()=>{});return task;}};
function terminal(){const dom=new JSDOM('<main><input id="memberSearch"><input id="eName"><button id="save">儲存</button><button id="read">查詢</button><table><tbody id="rows"></tbody></table></main>',{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window;
 w.localStorage.setItem('epcTerminalModeV1','operate');w.fetch=async()=>{calls++;return {ok:true}};w.eval(modeCode);w.eval(patchCode);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 w.__sdk=sdk;w.eval('(function(){const fs=window.__sdk,db={},col="events",accountingCol="accounting",clean=x=>x;'+objectCode+'})()');w.EPC_FIRESTORE_LAST_EVENTS=[clone(server)];return {dom,w};}
(async()=>{
const A=terminal(),B=terminal(),a=A.w,b=B.w;
assert.equal(a.EPCMode.get(),'view');assert.equal(b.EPCMode.get(),'view');assert(a.document.getElementById('eName').disabled);assert(!a.document.getElementById('memberSearch').disabled);
let saves=0,reads=0;a.document.getElementById('save').onclick=()=>saves++;a.document.getElementById('read').onclick=()=>reads++;a.document.getElementById('save').click();a.document.getElementById('read').click();assert.equal(saves,0);assert.equal(reads,1);
await assert.rejects(a.fetch('https://example.test/api',{method:'POST',body:JSON.stringify({action:'member.update'})}),/檢視模式/);assert.equal(calls,0);
await a.fetch('https://example.test/api',{method:'POST',body:JSON.stringify({action:'member.list'})});assert.equal(calls,1);
await assert.rejects(b.EPCFirestore.upsertEvent(clone(server)),/檢視模式/);
a.EPCMode.set('operate');assert(!a.document.getElementById('eName').disabled);
const base=clone(server),afterA=clone(base);afterA.players[0].nickname='A name';a.EPCEventPatch.stage('E',base,afterA);await a.EPCFirestore.upsertEvent(afterA);assert.equal(server.players[0].nickname,'A name');
const tbody=b.document.getElementById('rows'),html=e=>e.players.map(p=>'<tr data-player-id="'+p.memberId+'"><td>'+p.nickname+'</td><td><input value="'+p.stack+'"></td></tr>').join('');
b.EPCMode.patchChildren(tbody,html(base));b.EPCMode.protectControls();const unchanged=tbody.children[1];b.EPCMode.patchChildren(tbody,html(server));assert.equal(tbody.children[0].cells[0].textContent,'A name');assert.strictEqual(tbody.children[1],unchanged);
// B starts from stale data. Its seat edit preserves A's independent name edit.
b.EPCMode.set('operate');const afterB=clone(base);afterB.players[0].seat='2-3';b.EPCEventPatch.stage('E',base,afterB);await b.EPCFirestore.upsertEvent(afterB);assert.equal(server.players[0].nickname,'A name');assert.equal(server.players[0].seat,'2-3');
const aSame=clone(afterA);aSame.players[0].nickname='last A';a.EPCEventPatch.stage('E',afterA,aSame);await a.EPCFirestore.upsertEvent(aSame);
const bSame=clone(afterB);bSame.players[0].nickname='last B';b.EPCEventPatch.stage('E',afterB,bSame);await b.EPCFirestore.upsertEvent(bSame);assert.equal(server.players[0].nickname,'last B');assert.equal(server.players[0].seat,'2-3');
// A stale table cannot roll back newly committed payment quantities.
server.players[0].rebuy=5;server.players[0]._paymentRevision=5;const chipEdit=clone(aSame);chipEdit.players[0].stack=100;a.EPCEventPatch.stage('E',aSame,chipEdit);await a.EPCFirestore.upsertEvent(chipEdit);assert.equal(server.players[0].rebuy,5);assert.equal(server.players[0].stack,100);assert.equal(server.players[0]._stackRevision,2);
let release;const writing=a.EPCMode.runWrite(()=>new Promise(r=>release=r));assert.equal(a.EPCMode.set('view'),false);release();await writing;assert.equal(a.EPCMode.set('view'),true);await assert.rejects(a.EPCFirestore.createEvent({}),/檢視模式/);
A.dom.window.close();B.dom.window.close();console.log('PASS: two independent pages default to viewing; view blocks UI/network/Firestore writes, A updates B without replacing unchanged rows, field rebasing preserves separate edits, last saved same-field wins, payment quantities protected, mode waits for in-flight writes.');
})().catch(err=>{console.error(err);process.exitCode=1});
