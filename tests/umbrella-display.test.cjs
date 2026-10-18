const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<main id="screen"></main>'),host=dom.window.document.getElementById('screen');let next;
const c={timer:undefined,document:dom.window.document,host,esc:x=>String(x??''),money:x=>String(x),clearTimeout:()=>{},setTimeout:fn=>{next=fn},getComputedStyle:()=>({paddingTop:0,paddingBottom:0})};vm.createContext(c);
const src=fs.readFileSync(require.resolve('../tv/screen.js'),'utf8');vm.runInContext(src.slice(src.indexOf('function identity'),src.indexOf('\ntry{\n cloud=')),c);
const p={type:'umbrella',title:'保護傘',activityFrom:'2026-10-15',activityTo:'2026-10-31',monthFrom:'2026-10-01',monthTo:'2026-10-31',monthRows:[{memberId:'A',name:'月榜第一',score:13}],rows:[{memberId:'B',name:'期間第一',score:4}]};
function check(payload){c.show({paired:true,payload});assert(host.textContent.includes('整月排行榜'));assert(host.textContent.includes('活動期間排行榜'));assert(host.textContent.includes('2026-10-01'));assert(host.textContent.includes('2026-10-15'));assert(host.textContent.includes('券數'));assert(!host.textContent.includes('積分'));}
check(p);assert.equal(host.querySelectorAll('.umbrella-board').length,2);assert(host.textContent.includes('月榜第一'));assert(host.textContent.includes('期間第一'));
check({type:'parallel',panels:[{...p,ui:{compact:true,showMemberId:true}}]});assert(host.querySelector('.umbrella-boards.compact'));assert(host.textContent.includes('會員編號'));
check({type:'rotate',slides:[p,p]});next();assert(host.textContent.includes('整月排行榜'));
check({...p,ui:{showName:false,showMemberId:true,showRank:false,showScore:true}});assert(!host.textContent.includes('月榜第一'));assert(host.textContent.includes('A'));
check({...p,rows:[],monthRows:[]});assert.equal(host.querySelectorAll('tbody').length,2);assert(host.textContent.includes('目前尚無資料'));
c.show({paired:true,payload:{...p,monthRows:undefined}});assert(host.textContent.includes('期間第一'));
dom.window.close();console.log('PASS: dual umbrella projection, distinct dates/results, coupons columns, single/parallel/rotation, identity controls, empty and legacy payloads.');
