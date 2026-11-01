const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const src=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM('<input id="mId"><input id="mName"><main></main>'),w=dom.window;
const ctx={document:w.document,Event:w.Event,Math:Object.create(Math),MEMBER_ROWS:[{memberId:'a000000'}],legacyDb_:()=>({members:[{id:'A000001'}]}),editingMemberId:null,alerts:[],alert:m=>ctx.alerts.push(m)};ctx.window=ctx;ctx.Math.random=()=>0;vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf('function nextMemberId('),src.indexOf('function openMemberModal(')),ctx);
const field=w.document.getElementById('mId');
// Reproduce the view-mode disabled field that used to silently skip the handler.
field.disabled=true;ctx.fillNewMemberId_();assert.equal(field.value,'A000002');
assert.equal(ctx.epcGenerateNewMemberId_(),'A000003');assert.equal(field.value,'A000003');
field.disabled=false;assert.equal(ctx.epcGenerateNewMemberId_(),'A000002');
field.value='CUSTOM';ctx.fillNewMemberId_();assert.equal(field.value,'CUSTOM','auto-fill preserves manual values');
ctx.editingMemberId='CUSTOM';ctx.epcGenerateNewMemberId_();assert.equal(field.value,'CUSTOM');assert.equal(ctx.alerts.length,1);
field.value='';ctx.fillNewMemberId_();assert.equal(field.value,'','never fill an existing member ID during editing');
ctx.editingMemberId=null;ctx.fillNewMemberId_();assert.match(field.value,/^A\d{6}$/);
// The actual HTML button remains a local preview in view mode, while creates stay protected.
const page=new JSDOM(html);const button=page.window.document.querySelector('[onclick="window.epcGenerateNewMemberId_()"]');assert(button.hasAttribute('data-mode-control'));assert(html.includes('app.js?v=20261101-member-numbers1'));
vm.runInContext(fs.readFileSync('terminal-mode.js','utf8'),vm.createContext({window:w,document:w.document,CustomEvent:w.CustomEvent,MutationObserver:w.MutationObserver,console,WeakMap,Set,Promise}));
const realButton=w.document.importNode(button,true);w.document.body.append(realButton);realButton.onclick=ctx.epcGenerateNewMemberId_;field.disabled=true;const before=field.value;realButton.click();assert.notEqual(field.value,before,'actual button changes the preview under the view-mode click guard');
assert(w.EPCMode.isView());assert.throws(()=>w.EPCMode.assertAction('member.create'),/檢視模式/);
console.log('PASS: disabled-field regression, distinct preview IDs, case-insensitive duplicate checks, manual input preservation, editing protection and create permission guard');dom.window.close();page.window.close();
