const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<html><head></head><body></body></html>',{url:'https://example.test/?tabletTools=1&page=events',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
let calls=0,pages=[],opened=[];const messages=[];const host={postMessage:(m,origin)=>messages.push(m)};Object.defineProperty(w,'parent',{value:host});Object.defineProperty(w.document,'readyState',{get:()=> 'complete'});w.db={events:[{id:'E'}]};w.render=()=>calls++;w.renderEventFast_=()=>calls++;w.renderActivities=()=>calls++;w.showPage=p=>{pages.push(p);w.render()};w.openEvent=id=>opened.push(id);
w.eval(fs.readFileSync('tablet/management.js','utf8'));assert.equal(pages.at(-1),'events');assert(messages.some(m=>m.type==='epc-tablet-admin-ready'));
function message(data,origin='https://example.test'){w.dispatchEvent(new w.MessageEvent('message',{data,origin,source:host}))}
message({type:'epc-tablet-admin-visibility',active:false});const before=calls;w.render();w.renderEventFast_();w.renderActivities();assert.equal(calls,before);
message({type:'epc-tablet-admin-page',page:'accounting',active:true});assert.equal(pages.at(-1),'accounting');assert(calls>before);
for(const page of ['events','dailysettle','playerpayments','members','timers','activities','displays','dashboard']){message({type:'epc-tablet-admin-page',page,active:true});assert.equal(pages.at(-1),page)}
message({type:'epc-tablet-admin-page',page:'event',eventId:'E',active:true});assert.equal(opened.at(-1),'E');const count=pages.length;message({type:'epc-tablet-admin-page',page:'invalid',active:true});assert.equal(pages.length,count);message({type:'epc-tablet-admin-page',page:'members',active:true},'https://other.test');assert.equal(pages.length,count);
console.log('PASS full tablet management routing, selected event handoff, lazy-view background render suspension, valid page/origin guards');dom.window.close();
