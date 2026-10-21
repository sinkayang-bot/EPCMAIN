import {remaining,timeText,eventTotals,newTimer} from './timer-core.js?v=20261021-3';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),demo=params.has('demo'),id=params.get('eventId');
let event,timer,service;
const num=n=>Number(n||0).toLocaleString('en-US');
function message(s){$('connection').textContent=s;$('connection').hidden=!s}
function fit(){const scale=Math.min(innerWidth/1920,innerHeight/1080);$('broadcastScreen').style.transform=`translate(${(innerWidth-1920*scale)/2}px,${(innerHeight-1080*scale)/2}px) scale(${scale})`}
function payout(text){const el=$('payoutDisplay');if(el.dataset.text===text)return;el.dataset.text=text;el.replaceChildren();for(const line of text.split('\n')){const row=document.createElement('div'),m=line.match(/^\s*((?:第\s*)?[0-9一二三四五六七八九十百]+\s*名|[0-9]+[.、．]?|冠軍|亞軍|季軍|殿軍)(?:[\s,，:：]+)(.*)$/);row.className=m?'payoutEntry':'payoutNote';if(m){for(const v of [m[1],m[2]]){const c=document.createElement('span');c.textContent=v;row.append(c)}}else row.textContent=line;el.append(row)}}
function render(){
 if(!event||!timer){$('broadcastScreen').hidden=true;return}
 $('broadcastScreen').hidden=false;
 const levels=timer.levels,l=levels[timer.index],next=levels[timer.index+1];if(!l)return message('計時器結構不完整，請在後臺重新套用範本。');
 const seconds=remaining(timer),level=levels.slice(0,timer.index+1).filter(l=>!l.break).length,totals=eventTotals(event);
 $('screenDate').textContent=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Taipei'}).slice(0,16);
 $('screenEvent').textContent=event.name||'EPC 限時錦標賽';$('screenLevel').textContent='LEVEL '+level+' / '+levels.filter(l=>!l.break).length;
 $('levelTitle').textContent=l.break?'BREAK':'LEVEL '+level;$('clock').textContent=timeText(seconds);$('progressRing').classList.toggle('isBreak',!!l.break);
 for(const [p,row] of [['cur',l],['next',next]])for(const [suffix,key] of [['SB','sb'],['BB','bb'],['Ante','ante']])$(p+suffix).textContent=!row?'—':row.break?(p==='next'&&suffix==='SB'?'休息':'—'):num(row[key]);
 for(const [field,key] of [['sPlayers','players'],['sRebuys','rebuyPlayers'],['sGroups','groups'],['chipsInPlay','chips'],['avgStack','average']])$(field).textContent=totals[key]===null?'—':num(totals[key]);
 $('extraContent').textContent='$'+num(totals.pool);payout(timer.payoutInput||'');
 const ann=$('announcementDisplay');if(ann.textContent!==(timer.announcement||'')){ann.textContent=timer.announcement||'';let size=40;ann.style.fontSize=size+'px';while(size>18&&ann.scrollHeight>$('announcementBody').clientHeight-50){size-=2;ann.style.fontSize=size+'px'}}
 const lit=Math.ceil(Math.min(1,seconds/(l.min*60))*72);[...$('ringTicks').children].forEach((t,i)=>t.classList.toggle('lit',i<lit));
 let until=seconds;for(let i=timer.index+1;i<levels.length&&!levels[i].break;i++)until+=levels[i].min*60;
 const hasBreak=levels.slice(timer.index).some(l=>l.break),value=l.break?seconds:until;
 $('breakCaption').textContent=l.break?'BREAK REMAINING':'NEXT BREAK IN';$('breakCountdown').textContent=hasBreak?String(Math.floor(value/3600)).padStart(2,'0')+':'+timeText(value%3600):'—';
}
for(let i=0;i<72;i++){const tick=document.createElement('i');tick.style.transform='rotate('+(i*5)+'deg) translateY(-249px)';$('ringTicks').append(tick)}
fit();addEventListener('resize',fit);setInterval(render,250);
addEventListener('offline',()=>message('連線中斷，正在顯示最後同步資料'));addEventListener('online',()=>message('正在重新連線…'));
if(params.has('templatePreview')){
 message('正在載入範本預覽…');
 addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='epc-template-preview')return;try{const t=e.data.template;timer={...newTimer(t.levels),announcement:String(t.announcement||''),payoutInput:String(t.payoutInput||'')};event={name:'範本預覽｜'+String(t.name||'EPC'),players:[],chips:Number(t.startingStack)||0,buyin:0,jpRate:0,jpRound:100};message('');render()}catch(err){message('範本預覽失敗：'+err.message)}});
 parent.postMessage({type:'epc-timer-preview-ready'},location.origin);
}else try{
 if(!demo&&!id)throw Error('請從顯示設備選擇要投影的賽事。');
 service=demo?(await import('./timer-demo.js?v=20261021-3')).demoCloud():await(await import('./timer-cloud.js?v=20261021-3')).timerCloud();
 const error=e=>message('計時器連線失敗：'+e.message);
 service.subscribeEvent(id,e=>{event=e;message(!e?'找不到賽事，請從後臺重新選擇。':!timer?'此場尚未選用計時器範本，請回賽事設定儲存。':'');render()},error);
 service.subscribeTimer(id,t=>{timer=t;message(!event?'正在讀取賽事…':!t?'此場尚未選用計時器範本，請回賽事設定儲存。':'');render()},error);
}catch(e){message(e.message)}
