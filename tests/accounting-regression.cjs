const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(process.env.EPC_APP_SOURCE || path.join(root, 'app.js'), 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert(a >= 0 && b > a, `Missing source section: ${start}`);
  return html.slice(a, b);
}
function setup() {
  const nodes = new Map(), requests = [], saves = [], alerts = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {value:'', textContent:'', innerHTML:'', style:{}, dataset:{}, classList:{contains:()=>false}, addEventListener(){}});
    return nodes.get(id);
  };
  const storage = new Map([['eightMemberCache', '[{"memberId":"TEST"}]']]);
  const context = vm.createContext({
    console, Intl, Date, Math, Map, Set, AbortController,
    setTimeout:()=>0, clearTimeout(){}, setInterval:()=>0,
    document: {getElementById:node, querySelector:s=>node(s.replace(/^#/,'')), querySelectorAll:()=>[], addEventListener(){}, body:{dataset:{}}},
    localStorage:{getItem:k=>storage.get(k)||null, setItem:(k,v)=>storage.set(k,v), removeItem:k=>storage.delete(k)},
    addEventListener(){}, alert:m=>alerts.push(m), confirm:()=>true,
    askDeleteConfirm:(_message, cb)=>cb(),
    businessDateForEvent:e=>e.date,
    renderDashboardSummary(){}, renderDashboardDailyReport(){},
    db:{members:[],events:[{id:'TEST-EVENT',date:'2026-10-06',seq:1,status:'已結算',level:3400,admin:400,poolUnit:3000,finalJP:200,players:[{buyin:1},{buyin:1}]}], dailyAccounting:[{date:'2026-10-06',items:[]}],currentAccountingDate:'2026-10-06'},
    EPCFirestore:{ready:true,async upsertDailyAccounting(row){saves.push(JSON.parse(JSON.stringify(row)));}},
    async fetch(_url, options){const req=JSON.parse(options.body);requests.push(req);return {status:200,text:async()=>JSON.stringify({ok:true,item:{itemId:'SHEET-ITEM'},items:[],summary:{},total:0})};},
  });
  context.window = context;
  vm.runInContext('const $=id=>document.getElementById(id);const money=n=>"$"+Number(n||0).toLocaleString("zh-TW");const uid=()=>"TEST-ITEM";', context);
  vm.runInContext(section('function epcPnlClass_(', 'function epcPlayerDisplayName_'), context);
  vm.runInContext(section('function ensureDailyAccountingStore()', 'function printDailyAccounting()'), context);
  vm.runInContext(section('function calcPlayerForEvent(p,e)', 'function memberHistoryInRange('), context);
  node('dailyDate').value='2026-10-01'; // Hidden settlement date must not select the ledger day.
  node('accountingCreateDate').value='2026-10-07';
  node('accountingDetailView').style.display='block';
  node('accountingItemName').value='TEST 飲料';
  node('accountingItemAmount').value='100';
  node('accountingItemType').value='income';
  context.renderDailyAccountingDetail();
  const handlers = {add:context.addAccountingItem, summary:context.renderDashboardSummary, daily:context.renderDashboardDailyReport};
  vm.runInContext(app, context);
  return {context,node,requests,saves,alerts,handlers};
}
(async()=>{
  const t=setup();
  assert.equal(t.node('aAdminGross').textContent,'$800');
  const settled=t.context.db.events[0];
  t.context.db.events.push({...settled,id:'OPEN-EVENT',status:'進行中',players:[{buyin:10}]});
  assert.equal(t.context.dailyAccountingInfo('2026-10-06').events.length,1);
  assert.equal(t.context.dailyAccountingInfo('2026-10-06').gross,800,'open event must not affect ledger');
  t.context.db.events[1].status='settled';
  assert.equal(t.context.dailyAccountingInfo('2026-10-06').events.length,2,'English settled status is included');
  assert.equal(t.context.dailyAccountingInfo('2026-10-06').gross,4800);
  t.context.db.events[1].status='進行中';
  assert.equal(t.context.dailyAccountingInfo('2026-10-06').gross,800,'unlock removes event from totals');
  t.context.db.events.pop();

  if(process.env.REPRODUCE_OLD_BUG==='1') {
    await t.context.addAccountingItem();
    assert.equal(t.node('aAdminGross').textContent,'0');
    assert.equal(t.context.dailyAccountingInfo('2026-10-06').gross,800);
    assert.equal(t.context.db.dailyAccounting[0].items.length,0);
    assert.equal(t.requests.find(r=>r.action==='accounting.item.create').item.businessDate,'2026-10-01');
    console.log('REPRODUCED: app.js replaces ledger handler; display becomes 0, print source remains 800, item is missing, hidden date is used.');
    return;
  }
  assert.equal(t.context.addAccountingItem,t.handlers.add,'app.js must not replace the actual daily ledger handler');
  assert.equal(t.context.renderDashboardSummary,t.handlers.summary);
  assert.equal(t.context.renderDashboardDailyReport,t.handlers.daily);
  await t.context.addAccountingItem();
  assert.equal(t.node('aAdminGross').textContent,'$800');
  assert.equal(t.node('aOtherIncomeTotal').textContent,'$100');
  assert.equal(t.node('aNet').textContent,'$900');
  assert.equal(t.context.dailyAccountingInfo('2026-10-06').net,900);
  assert.match(t.node('accountingItemRows').innerHTML,/TEST 飲料/);
  assert.equal(t.saves[0].date,'2026-10-06');
  assert.equal(t.requests.length,0,'ledger must not call the separate Sheet summary/item API');
  // A stale listener must not remove an acknowledged local item before it arrives remotely.
  t.context.applyFirestoreDailyAccounting_([{date:'2026-10-06',items:[]}]);
  assert.equal(t.node('aNet').textContent,'$900');
  t.context.applyFirestoreDailyAccounting_(t.saves);
  assert.equal(t.node('aNet').textContent,'$900');
  await t.context.deleteAccountingItem('TEST-ITEM');
  assert.equal(t.node('aAdminGross').textContent,'$800');
  assert.equal(t.node('aNet').textContent,'$800');
  t.context.applyFirestoreDailyAccounting_([t.saves[0]]);
  assert.equal(t.node('aNet').textContent,'$800');
  t.context.applyFirestoreDailyAccounting_([t.saves[1]]);
  assert.equal(t.node('aNet').textContent,'$800');
  const denied=setup();
  denied.context.EPCFirestore.upsertDailyAccounting=async()=>{throw Error('Missing or insufficient permissions.');};
  await denied.context.addAccountingItem();
  assert.equal(denied.node('aAdminGross').textContent,'$800');
  assert.equal(denied.context.db.dailyAccounting[0].items.length,0);
  assert.match(denied.alerts[0],/新增收支儲存失敗.*permissions/);
  assert.equal(denied.node('accountingItemName').value,'TEST 飲料');
  console.log('PASS: runtime handler ownership, correct day, screen/print totals, add/delete, stale snapshots and denied-write rollback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
