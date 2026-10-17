const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<main id="screen"></main>'),host=dom.window.document.getElementById('screen');
let next;const ctx={timer:undefined,document:dom.window.document,host,esc:v=>String(v??''),money:v=>'$'+Number(v||0),clearTimeout:()=>{},setTimeout:fn=>{next=fn},getComputedStyle:()=>({paddingTop:'0',paddingBottom:'0'})};
vm.createContext(ctx);
const source=fs.readFileSync(require.resolve('../tv/screen.js'),'utf8');
vm.runInContext(source.slice(source.indexOf('function identity'),source.indexOf('\ntry{\n cloud=')),ctx);
const data={type:'extremeTen',title:'極限 10 秒',rewardCash:1000,rewardCoupon:1000,rows:[{rank:1,name:'甲',seconds:'9.98',difference:'0.02'}]};
function check(payload){ctx.data={paired:true,payload};vm.runInContext('show(data)',ctx);assert(host.textContent.includes('挑戰秒數'));assert(host.textContent.includes('9.98 秒'));assert(host.textContent.includes('0.02 秒'));assert(!host.textContent.includes('積分'));}
check({...data,ui:{showRank:false}});assert(host.querySelector('.ten-rank'));assert(!host.querySelector('.grid'));assert.equal(host.querySelectorAll('th').length,3);
check(data);check({type:'parallel',panels:[data]});check({type:'rotate',slides:[data]});check({type:'rotateParallel',slides:[{type:'parallel',panels:[data]},data]});next();assert(host.textContent.includes('9.98 秒'));
check({...data,type:'legacy',ui:{kind:'extremeTen'}});
check({...data,type:'legacy'});
check({...data,rows:[{memberId:'42',name:'甲',seconds:'9.80',difference:'0.20',rank:3},{memberId:'42',name:'甲',seconds:'9.98',difference:'0.02',rank:1},{memberId:'43',name:'乙',seconds:'10.02',difference:'0.02',rank:1}]});assert.equal(host.querySelectorAll('tbody tr').length,2);assert(!host.textContent.includes('9.80 秒'));assert(host.textContent.includes('每人限領一次'));

const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
ctx.ensureActDb_=()=>{};ctx.db={activityManagement:{}};ctx.actActivityRange_=()=>({from:'2026-10-15',to:'2026-10-31'});ctx.extremeTenStats_=()=>({awarded:[],remaining:8,leaderboard:[{id:'1',memberId:'42',cents:998,difference:2},{id:'2',memberId:'43',cents:1002,difference:2}]});ctx.epcPlayerDisplayName_=id=>id;
vm.runInContext(html.slice(html.indexOf('function displayPayload_('),html.indexOf('async function publishDisplay_(')),ctx);
const p=vm.runInContext("displayPayload_('extremeTen')",ctx);assert.equal(p.metric,'seconds');assert.equal(p.rows[0].seconds,'9.98');assert.equal(p.rows[1].seconds,'10.02');assert.equal(p.rows[1].rank,1);assert(!('score' in p.rows[0]));
dom.window.close();console.log('PASS: Extreme10 seconds-only payload, tie ranks, single/parallel/rotation rendering and legacy identity fallback.');

