import {newTimer,command} from './timer-core.js?v=20261021-3';
import {STANDARD_TEMPLATE,templateData,buildEventTimer} from './timer-store.js?v=20261021-3';
const KEY='epc-connected-timer-demo-v1';
export const DEMO_EVENT={eventId:'demo',name:'EPC 計時器連線測試',buyin:3000,fee:400,jpRate:3,jpRound:100,chips:300000,status:'open',players:[{buyin:1,rebuy:2,addon:0},{buyin:1,rebuy:0,addon:0},{buyin:1,rebuy:1,addon:0},{buyin:1,rebuy:0,addon:1},{buyin:1,rebuy:0,addon:0},{buyin:1,rebuy:0,addon:0}]};
export function demoCloud(){
 const listeners=new Set(),read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{timer:null,templates:[]}}catch(_){return {timer:null,templates:[]}}};
 function notify(){for(const fn of listeners)fn(read())}function write(s){localStorage.setItem(KEY,JSON.stringify(s));notify()}
 window.addEventListener('storage',e=>{if(e.key===KEY)notify()});
 function subscribe(fn){listeners.add(fn);fn(read());return()=>listeners.delete(fn)}
 return {
 subscribeTimer:(id,fn)=>subscribe(s=>fn(s.timer)),subscribeEvent:(id,fn)=>subscribe(s=>fn(s.event||DEMO_EVENT)),subscribeTemplates:fn=>subscribe(s=>fn(s.templates)),
 subscribeEvents:fn=>subscribe(s=>fn([s.event||DEMO_EVENT])),subscribeTimers:fn=>subscribe(s=>fn(s.timer?[{...s.timer,eventId:'demo',id:'demo'}]:[])),
 async change(id,revision,action,value){const s=read(),old=s.timer||newTimer();if(old.revision!==revision)throw Error('計時器已有更新');s.timer={...command(old,action,value),revision:old.revision+1};write(s);return s.timer},
 async saveTemplate(name,levels,options={}){const data=templateData({name,levels,...options}),s=read(),id=options.id&&options.id!=='standard'?options.id:crypto.randomUUID(),i=s.templates.findIndex(t=>t.id===id);if(i>=0&&Number(s.templates[i].revision||0)!==Number(options.revision||0))throw Error('範本已更新，請重新讀取');const t={...data,id,revision:i>=0?Number(s.templates[i].revision||0)+1:1};if(i>=0)s.templates[i]=t;else s.templates.push(t);write(s);return id},
 async createDemoEvent(templateId){const s=read(),template=templateId==='standard'?STANDARD_TEMPLATE:s.templates.find(t=>t.id===templateId);if(!template)throw Error('請選擇範本');const result=buildEventTimer({...DEMO_EVENT,name:'EPC#1 3400限時錦標賽（流程練習）',players:[]},template,templateId,{creating:true});s.event=result.event;s.timer=result.timer;write(s);return result.event}
 };
}
