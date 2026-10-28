import {applyAppearance} from './timer-appearance-view.js?v=20261023-tablet-rgb41';
import {countdownSound} from './timer-sound.js?v=20261024-start-level3';
import {remaining,timeText,eventTotals,newTimer,timerAt,tournamentRemaining,durationText} from './timer-core.js?v=20261023-tablet-rgb41';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),demo=params.has('demo'),id=params.get('eventId');
let event,timer,service;
const sound=countdownSound();
const num=n=>Number(n||0).toLocaleString('en-US');
function text(el,value){const next=String(value);if(el.textContent!==next)el.textContent=next}
function flag(el,name,value){if(el.classList.contains(name)!==value)el.classList.toggle(name,value)}
function message(s){$('connection').textContent=s;$('connection').hidden=!s}
function fit(){const scale=Math.min(innerWidth/1920,innerHeight/1080);$('broadcastScreen').style.transform=`translate(${(innerWidth-1920*scale)/2}px,${(innerHeight-1080*scale)/2}px) scale(${scale})`}
function payout(text){const el=$('payoutDisplay');if(el.dataset.text===text)return;el.dataset.text=text;el.replaceChildren();for(const line of text.split('\n')){const row=document.createElement('div'),m=line.match(/^\s*((?:第\s*)?[0-9一二三四五六七八九十百]+\s*名|[0-9]+[.、．]?|冠軍|亞軍|季軍|殿軍)(?:[\s,，:：]+)(.*)$/);row.className=m?'payoutEntry':'payoutNote';if(m){for(const v of [m[1],m[2]]){const c=document.createElement('span');c.textContent=v;row.append(c)}}else row.textContent=line;el.append(row)}}
function render(){
 if(!event||!timer){sound.observe(null);$('broadcastScreen').hidden=true;return}
 const now=Date.now(),state=timerAt(timer,now);
 $('broadcastScreen').hidden=false;
 applyAppearance($('broadcastScreen'),state.appearance);
 const background=['black-gold','light','emerald','velvet'].includes(state.background)?state.background:'classic';
 if($('broadcastScreen').dataset.background!==background)$('broadcastScreen').dataset.background=background;
 const levels=state.levels,l=levels[state.index],next=levels[state.index+1];if(!l)return message('計時器結構不完整，請在後臺重新套用範本。');
 const seconds=remaining(state,now),level=levels.slice(0,state.index+1).filter(l=>!l.break).length,totals=eventTotals(event);
 sound.observe(state,seconds,event.eventId||id);
 text($('screenDate'),new Date().toLocaleString('sv-SE',{timeZone:'Asia/Taipei'}).slice(0,16));
 text($('screenEvent'),event.name||'EPC 限時錦標賽');text($('screenLevel'),'LEVEL '+level+' / '+levels.filter(l=>!l.break).length);
 text($('tournamentCountdown'),durationText(tournamentRemaining(state,now)));
 const finished=state.index===levels.length-1&&seconds===0;
 text($('levelTitle'),l.break?'BREAK':'LEVEL '+level);text($('clock'),finished?'Finish':timeText(seconds));const digits=String($('clock').textContent.length);if($('clock').dataset.digits!==digits)$('clock').dataset.digits=digits;flag($('progressRing'),'isBreak',!!l.break);flag($('progressRing'),'isFinished',finished);
 for(const [p,row] of [['cur',l],['next',next]])for(const [suffix,key] of [['SB','sb'],['BB','bb'],['Ante','ante']])text($(p+suffix),!row?'—':row.break?(p==='next'&&suffix==='SB'?'休息':'—'):num(row[key]));
 for(const [field,key] of [['sPlayers','players'],['sRebuys','rebuyGroups'],['sGroups','groups'],['chipsInPlay','chips'],['avgStack','average']])text($(field),totals[key]===null?'—':num(totals[key]));
 const hand=state.featuredHand||{};
 $('featuredHand').hidden=hand.enabled!==true;
 if(hand.enabled===true){
  text($('handTitle'),hand.title||'指定手牌');
  for(const [side,key] of [['Left','left'],['Right','right']]){
   const card=hand[key]||{},el=$('hand'+side);
   const suit=['♠','♥','♦','♣'].includes(card.suit)?card.suit:'♠';
   el.className='handSuit '+(['♥','♦'].includes(suit)?'red':'black');
   if(el.dataset.suit!==suit){el.dataset.suit=suit;const shapes={'♠':'M50 7 C42 24 12 36 12 56 C12 77 39 80 49 63 C48 77 42 87 31 89 L69 89 C58 87 52 77 51 63 C61 80 88 77 88 56 C88 36 58 24 50 7Z','♥':'M50 92 C39 79 7 58 7 34 C7 7 40 3 50 26 C60 3 93 7 93 34 C93 58 61 79 50 92Z','♦':'M50 3 L91 50 L50 97 L9 50 Z','♣':'M50 7 C31 7 27 30 39 39 C18 25 3 42 9 59 C15 77 37 73 46 62 C46 78 40 87 31 90 L69 90 C60 87 54 78 54 62 C63 73 85 77 91 59 C97 42 82 25 61 39 C73 30 69 7 50 7Z'};el.querySelector('path').setAttribute('d',shapes[suit]);el.querySelector('text').setAttribute('y',suit==='♥'?'47':'54')}
   text(el.querySelector('text'),card.rank||'A');
  }
 }
 text($('extraContent'),'$'+num(totals.pool));payout(state.payoutInput||'');
 const ann=$('announcementDisplay');if(ann.textContent!==(state.announcement||'')){ann.textContent=state.announcement||'';let size=40;ann.style.fontSize=size+'px';while(size>18&&ann.scrollHeight>$('announcementBody').clientHeight-50){size-=2;ann.style.fontSize=size+'px'}}
 const lit=Math.ceil(Math.min(1,seconds/(l.min*60))*72);[...$('ringTicks').children].forEach((t,i)=>flag(t,'lit',i<lit));
 let until=seconds;for(let i=state.index+1;i<levels.length&&!levels[i].break;i++)until+=levels[i].min*60;
 const hasBreak=levels.slice(state.index).some(l=>l.break),value=l.break?seconds:until;
 text($('breakCaption'),finished?'TOURNAMENT FINISHED':l.break?'BREAK REMAINING':'NEXT BREAK IN');text($('breakCountdown'),!finished&&hasBreak?String(Math.floor(value/3600)).padStart(2,'0')+':'+timeText(value%3600):'—');
}
for(let i=0;i<72;i++){const tick=document.createElement('i');tick.style.transform='rotate('+(i*5)+'deg) translateY(-285px)';$('ringTicks').append(tick)}
fit();addEventListener('resize',fit);setInterval(render,250);
addEventListener('offline',()=>message('連線中斷，正在顯示最後同步資料'));addEventListener('online',()=>message('正在重新連線…'));
if(params.has('templatePreview')){
 message('正在載入範本預覽…');
 addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='epc-template-preview')return;try{const t=e.data.template;timer={...newTimer(t.levels),background:t.background,appearance:t.appearance,announcement:String(t.announcement||''),payoutInput:String(t.payoutInput||'')};event={name:'範本預覽｜'+String(t.name||'EPC'),players:[],chips:Number(t.startingStack)||0,buyin:0,jpRate:0,jpRound:100};message('');render()}catch(err){message('範本預覽失敗：'+err.message)}});
 parent.postMessage({type:'epc-timer-preview-ready'},location.origin);
}else try{
 if(!demo&&!id)throw Error('請從顯示設備選擇要投影的賽事。');
 service=demo?(await import('./timer-demo.js?v=20261023-tablet-rgb41')).demoCloud():await(await import('./timer-cloud.js?v=20261023-tablet-rgb41')).timerCloud();
 const error=e=>message('計時器連線失敗：'+e.message);
 service.subscribeEvent(id,e=>{event=e;message(!e?'找不到賽事，請從後臺重新選擇。':!timer?'此場尚未選用計時器範本，請回賽事設定儲存。':'');render()},error);
 service.subscribeTimer(id,t=>{timer=t;message(!event?'正在讀取賽事…':!t?'此場尚未選用計時器範本，請回賽事設定儲存。':'');render()},error);
}catch(e){message(e.message)}
