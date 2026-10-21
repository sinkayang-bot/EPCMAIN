import {newTimer,command,validateLevels} from './timer-core.js?v=20261021-2';
const KEY='epc-connected-timer-demo-v1';
export const DEMO_EVENT={eventId:'demo',name:'EPC 計時器連線測試',buyin:3000,fee:400,jpRate:3,jpRound:100,chips:300000,status:'open',players:[{buyin:1,rebuy:2,addon:0},{buyin:1,rebuy:0,addon:0},{buyin:1,rebuy:1,addon:0},{buyin:1,rebuy:0,addon:1},{buyin:1,rebuy:0,addon:0},{buyin:1,rebuy:0,addon:0}]};
export function demoCloud(){
 const listeners=new Set();const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{timer:null,templates:[]}}catch(_){return {timer:null,templates:[]}}};
 function notify(){for(const fn of listeners)fn(read())}
 window.addEventListener('storage',e=>{if(e.key===KEY)notify()});
 function subscribe(fn){listeners.add(fn);fn(read());return()=>listeners.delete(fn)}
 return {subscribeTimer:(id,fn)=>subscribe(s=>fn(s.timer)),subscribeEvent:(id,fn)=>{fn(DEMO_EVENT);return()=>{}},subscribeTemplates:fn=>subscribe(s=>fn(s.templates)),
 async change(id,revision,action,value){const s=read(),old=s.timer||newTimer();if(old.revision!==revision)throw Error('計時器已有更新');s.timer={...command(old,action,value),revision:old.revision+1};localStorage.setItem(KEY,JSON.stringify(s));notify();return s.timer},
 async saveTemplate(name,levels){if(!name.trim())throw Error('請輸入範本名稱');const s=read();s.templates.push({id:crypto.randomUUID(),name,levels:validateLevels(levels)});localStorage.setItem(KEY,JSON.stringify(s));notify()}
 };
}
