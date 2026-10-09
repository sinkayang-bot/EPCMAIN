const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),screen=fs.readFileSync('tv/screen.js','utf8');
const extract=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
(async()=>{
 let pref={},writes=[],controls={displayType_TV:{value:'parallel'},displayLimit_TV:{value:'5'},displayParallel_TV_rank:{checked:true},displayParallel_TV_boss:{checked:true}};
 const ctx={$:id=>controls[id],displayDevicesCache:[{deviceId:'TV'}],displayPayload_:type=>({type,title:type,rows:type==='boss'?undefined:Array.from({length:20},(_,i)=>({name:'P'+i,score:i})),pool:7100}),displayFetch_:async r=>writes.push(r),saveDisplayPref_:(_,p)=>pref=p,displayPref_:()=>pref,displayApi_:()=>true,actionMsg:()=>{},loadDisplays_:async()=>{}};
 vm.createContext(ctx);vm.runInContext(extract(html,'async function publishDisplay_','const _renderActivitiesDisplayBase='),ctx);
 await ctx.publishDisplay_('TV');assert.equal(writes[0].payload.panels.length,2);assert.equal(writes[0].payload.panels[0].type,'rank');assert.equal(writes[0].payload.panels[0].rows.length,5);assert.equal(writes[0].payload.panels[1].pool,7100);assert.equal(writes[0].payload.slides,undefined);
 controls={};await ctx.publishAllDisplays_();assert.equal(writes[1].payload.panels.length,2,'automatic refresh uses saved selection, not current form');
 const host={innerHTML:'',className:'',children:[],style:{setProperty(k,v){this[k]=v}},appendChild(c){this.children.push(c)}};let scheduled=0;
 const s={host,esc:String,money:n=>'$'+n,timer:1,clearTimeout:()=>{},setTimeout:()=>scheduled++,document:{createElement:()=>({innerHTML:'',className:''})}};
 vm.createContext(s);vm.runInContext(extract(screen,'function identity','try{\n cloud='),s);
 s.show({paired:true,payload:writes[0].payload});assert.equal(host.className,'parallel-screen');assert.equal(host.children.length,2);assert.match(host.children[0].innerHTML,/P0/);assert.match(host.children[1].innerHTML,/7100/);assert.equal(scheduled,0,'parallel content never starts rotation timer');
 s.show({paired:true,payload:{type:'rank',rows:[]}});assert.equal(host.className,'','switching mode clears grid layout');
 controls={displayType_TV:{value:'parallel'}};await ctx.publishDisplay_('TV');assert.equal(writes.length,2,'empty activity selection cannot overwrite TV');
 console.log('PASS: selected simultaneous activities, limits, saved preferences on refresh, real TV renderer, no rotation timer, and mode switching.');
})();
