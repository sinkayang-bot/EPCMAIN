(function(root){
 'use strict';const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x)),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),unsafe=k=>['__proto__','prototype','constructor'].includes(String(k));
 const meta=k=>/^_.*Revision$/.test(k)||['_eventUpdatedAt','updatedAt','revision','_manualDiscountEditedAt','_manualDiscountEditedValue'].includes(k);
 const moneyFields=new Set(['buyin','rebuy','addon','manualDiscount','earlyBird','lateBird','ladies','registrationUnpaid','registrationUnpaidAmount','rebuyUnpaidAmount','rebuyUnpaidEntries']);
 function diff(before,after,path=[],out=[]){
  if(path.length===1&&path[0]==='players'){before=Array.isArray(before)?before:[];after=Array.isArray(after)?after:[];}
  if(equal(before,after))return out;
  const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
  if(path.length===1&&path[0]==='players'&&Array.isArray(before)&&Array.isArray(after)){
   const b=new Map(before.map(x=>[String(x.memberId),x])),a=new Map(after.map(x=>[String(x.memberId),x]));
   for(const id of new Set([...b.keys(),...a.keys()]))diff(b.get(id),a.get(id),['players',id],out);return out;
  }
  if(object(before)&&object(after)){
   for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
    if(unsafe(key)||meta(key)||(path[0]==='players'&&path.length===2&&moneyFields.has(key)))continue;
    diff(before[key],after[key],[...path,key],out);
   }return out;
  }
  out.push({path,value:clone(after),remove:after===undefined});return out;
 }
 function apply(old,ops){
  const out=clone(old||{}),byId=new Map((out.players||[]).map(p=>[String(p.memberId),p])),changed=new Map();
  for(const op of ops||[]){const path=op.path||[];if(!path.length||path.some(unsafe))throw Error('無效的修改欄位');let target=out,index=0;
   if(path[0]==='players'){
    const id=String(path[1]);if(path.length===2){if(op.remove)byId.delete(id);else byId.set(id,clone(op.value));continue;}
    target=byId.get(id);if(!target)continue;index=2;const field=path[2];if(!equal(target[field],op.value)||(op.remove&&field in target)){if(!changed.has(id))changed.set(id,new Set());changed.get(id).add(field);}
   }
   for(let i=index;i<path.length-1;i++){const k=path[i];if(!target[k]||typeof target[k]!=='object')target[k]={};target=target[k];}
   const key=path.at(-1);if(op.remove)delete target[key];else target[key]=clone(op.value);
  }
  if('players' in out||byId.size){out.players=[...byId.values()];for(const [id,fields] of changed){const p=byId.get(id),previous=(old.players||[]).find(x=>String(x.memberId)===id);if(!p)continue;for(const f of ['stack','seat','hunterHeads'])if(fields.has(f))p['_'+f+'Revision']=Number(previous?.['_'+f+'Revision']||0)+1;}}
  return out;
 }
 function mergeRecords(before,local,remote){
  if(equal(before,local))return clone(remote);
  const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
  if(obj(before)&&obj(local)){const out=obj(remote)?clone(remote):{};for(const k of new Set([...Object.keys(before),...Object.keys(local)])){if(unsafe(k)||equal(before[k],local[k]))continue;if(local[k]===undefined)delete out[k];else out[k]=mergeRecords(before[k],local[k],out[k]);}return out;}
  const key=x=>x&&typeof x==='object'?(x.id??x.memberId??x.eventId):undefined;
  if(Array.isArray(before)&&Array.isArray(local)&&[...before,...local].every(x=>key(x)!=null)){
   const b=new Map(before.map(x=>[String(key(x)),x])),a=new Map(local.map(x=>[String(key(x)),x])),r=new Map((Array.isArray(remote)?remote:[]).map(x=>[String(key(x)),clone(x)]));
   for(const id of new Set([...b.keys(),...a.keys()]))if(!equal(b.get(id),a.get(id))){if(!a.has(id))r.delete(id);else r.set(id,mergeRecords(b.get(id),a.get(id),r.get(id)));}return [...r.values()];
  }
  return clone(local);
 }
 const pending=new Map();let sequence=0;
 function stage(id,before,after){const ops=diff(before||{},after||{}),map=pending.get(String(id))||new Map();for(const op of ops)map.set(JSON.stringify(op.path),{...op,sequence:++sequence});if(map.size)pending.set(String(id),map);return ops;}
 function job(id,before,after){id=String(id);if(!pending.has(id))stage(id,before,after);return {id,ops:[...(pending.get(id)?.values()||[])].map(clone)};}
 function ack(job){const map=pending.get(job.id);if(!map)return;for(const op of job.ops){const key=JSON.stringify(op.path);if(map.get(key)?.sequence===op.sequence)map.delete(key);}if(!map.size)pending.delete(job.id);}
 const api={diff,apply,mergeRecords,stage,job,ack,drop:id=>pending.delete(String(id)),hasPending:()=>pending.size>0,preview:e=>apply(e,[...(pending.get(String(e.eventId))?.values()||[])])};root.EPCEventPatch=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
