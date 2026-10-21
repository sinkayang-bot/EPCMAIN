import {newTimer,DEFAULT_LEVELS,validateLevels} from './timer-core.js?v=20261021-3';
export const STANDARD_TEMPLATE={id:'standard',name:'20 分鐘標準賽',startingStack:300000,levels:DEFAULT_LEVELS,announcement:'歡迎參加 EPC 限時錦標賽',payoutInput:'依籌碼比例分配',revision:0};
export function templateData(value){
 const name=String(value.name||'').trim(),startingStack=Number(value.startingStack??300000);
 if(!name)throw Error('請輸入範本名稱。');if(!Number.isSafeInteger(startingStack)||startingStack<1)throw Error('起始籌碼須為正整數。');
 return {name:name.slice(0,100),startingStack,levels:validateLevels(value.levels),announcement:String(value.announcement||'').slice(0,6000),payoutInput:String(value.payoutInput||'').slice(0,6000)};
}
export function buildEventTimer(event,template,templateId,{creating=false}={}){
 const data=templateData(template),eventId=String(event.eventId);
 const timer={...newTimer(data.levels),eventId,templateId,templateName:data.name,eventName:event.name||'EPC',announcement:data.announcement,payoutInput:data.payoutInput,revision:1};
 const patch={timerId:eventId,timerTemplateId:templateId,timerTemplateName:data.name};
 if(creating)patch.chips=data.startingStack;
 return {event:{...event,...patch},timer,patch};
}
// Read and stage both records inside the caller's transaction. No write occurs until all reads succeed.
export async function stageEventTimer({tx,fs,db,event,templateId,creating=false}){
 const id=String(event.eventId),ref=fs.doc(db,'epc_events','_epc_timer','timers',id),existing=await tx.get(ref);
 if(existing.exists()){
  const timer=existing.data();if(timer.templateId&&timer.templateId!==templateId)throw Error('本場已有計時器；請到獨立「計時器」管理，不會覆蓋本場進度。');
  return {event:{...event,timerId:id,timerTemplateId:timer.templateId||templateId,timerTemplateName:timer.templateName||''},timer:null,ref};
 }
 let template=STANDARD_TEMPLATE;
 if(templateId!=='standard'){const snap=await tx.get(fs.doc(db,'epc_events','_epc_timer','templates',String(templateId)));if(!snap.exists())throw Error('計時器範本已不存在，請重新選擇。');template=snap.data();}
 const built=buildEventTimer(event,template,templateId,{creating});return {...built,ref};
}
export async function createEventWithTimer({fs,db,event,templateId,assertWrite=()=>{}}){
 return fs.runTransaction(db,async tx=>{
  assertWrite();const ref=fs.doc(db,'epc_events',String(event.eventId)),old=await tx.get(ref);
  if(old.exists())throw Error('這場賽事已存在，請重新讀取，避免重複建立。');
  const result=await stageEventTimer({tx,fs,db,event,templateId,creating:true});
  tx.set(ref,{...result.event,updatedAt:fs.serverTimestamp()});tx.set(result.ref,{...result.timer,updatedAt:fs.serverTimestamp()});
  return result.event;
 });
}
