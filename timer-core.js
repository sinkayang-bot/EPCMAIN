import {calcPlayerForEvent,fromRawEvent} from './player-pricing.js';

export const DEFAULT_LEVELS=[
 {sb:100,bb:200,ante:200,min:20},{sb:200,bb:400,ante:400,min:20},
 {sb:300,bb:600,ante:600,min:20},{sb:500,bb:1000,ante:1000,min:20},
 {break:true,min:5},{sb:1000,bb:2000,ante:2000,min:20},
 {sb:1500,bb:3000,ante:3000,min:20},{sb:2000,bb:4000,ante:4000,min:20}
];
export function parseTime(value){
 const m=String(value).trim().replace('：',':').match(/^(\d+):([0-5]\d)$/);
 const n=m?Number(m[1])*60+Number(m[2]):NaN;
 if(!Number.isSafeInteger(n)||n<0||n>359999)throw Error('請輸入分：秒，例如 12:35；秒數為 00–59，最長 5999:59。');
 return n;
}
export function timeText(seconds){const n=Math.max(0,Math.ceil(Number(seconds)||0));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
export function remaining(timer,now=Date.now()){return timer?.running?Math.max(0,Math.ceil((Number(timer.endsAt)-now)/1000)):Math.max(0,Number(timer?.remaining)||0)}
export function validateLevels(levels){
 if(!Array.isArray(levels)||!levels.length||levels.length>100)throw Error('盲注結構須為 1–100 級。');
 return levels.map(l=>{const min=Number(l.min);if(!Number.isFinite(min)||min<=0||min>600)throw Error('每級時間須大於 0 且不超過 600 分鐘。');if(l.break)return {break:true,min};const row={min};for(const k of ['sb','bb','ante']){row[k]=Number(l[k]);if(!Number.isSafeInteger(row[k])||row[k]<0)throw Error('盲注須為非負整數。')}return row});
}
export function newTimer(levels=DEFAULT_LEVELS){const structure=validateLevels(levels);return {levels:structure,index:0,remaining:structure[0].min*60,running:false,endsAt:0,announcement:'歡迎參加 EPC 限時錦標賽',payoutInput:'依籌碼比例分配',revision:0}}
export function command(timer,action,value,now=Date.now()){
 let t=structuredClone(timer||newTimer());const seconds=remaining(t,now);if(t.running&&seconds===0){t.running=false;t.remaining=0;t.endsAt=0;}
 if(action==='settings'){t.announcement=String(value.announcement||'').slice(0,6000);t.payoutInput=String(value.payoutInput||'').slice(0,6000);return t}
 if(action==='structure'){t.levels=validateLevels(value);t.index=0;t.remaining=t.levels[0].min*60;t.running=false;t.endsAt=0;return t}
 if(action==='toggle'){t.remaining=seconds;t.running=!t.running&&seconds>0}
 else if(action==='set'){t.remaining=parseTime(value);if(t.remaining===0)t.running=false}
 else if(action==='shift'){t.remaining=Math.max(0,seconds+Number(value));if(t.remaining===0)t.running=false}
 else if(action==='level'){t.index=Math.max(0,Math.min(t.levels.length-1,t.index+Number(value)));t.remaining=t.levels[t.index].min*60}
 else if(action==='reset'){t.remaining=t.levels[t.index].min*60}
 else throw Error('不支援的計時器操作');
 t.endsAt=t.running?now+t.remaining*1000:0;return t;
}
// Read the same pricing function and JP rounding rule as 賽事管理/ICM.
export function eventTotals(raw){
 const e=fromRawEvent(raw||{}),players=Array.isArray(e.players)?e.players:[];
 const rows=players.map(p=>calcPlayerForEvent(p,e));
 const groups=rows.reduce((n,r)=>n+r.groups,0),chips=groups*Math.max(0,Number(e.chips)||0);
 const gross=rows.reduce((n,r)=>n+r.pool,0),rate=Math.max(0,Number(e.jp)||0),unit=Math.max(1,Number(e.jpRound)||1);
 const jp=raw?.finalJP!=null?Number(raw.finalJP)||0:gross*rate>0?Math.ceil(gross*rate/100/unit)*unit:0;
 return {players:players.length,rebuyGroups:players.reduce((n,p)=>n+Math.max(0,Number(p.rebuy)||0),0),rebuyPlayers:players.filter(p=>Number(p.rebuy)>0||Number(p.addon)>0).length,groups,chips,average:players.length?Math.floor(chips/players.length):null,pool:Math.max(0,gross-jp),gross,jp};
}
