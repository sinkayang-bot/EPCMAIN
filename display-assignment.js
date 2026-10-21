// Legacy backends only publish timers on an explicit user action. Accept that
// timer selection, while continuing to reject background activity overwrites.
export function pendingTimerAssignment(data){
 const a=data?.assignment,p=data?.payload;
 return !!(data?.paired&&a?.id&&a.contentType==='timer'&&data.contentType==='timer'&&p?.type==='timer'&&p.eventId&&String(p.eventId)!==String(a.payload?.eventId)&&Number(data.publishedAt||0)>Number(a.publishedAt||0));
}
export async function syncTimerAssignment({fs,db,ref}){
 return fs.runTransaction(db,async tx=>{
  const snap=await tx.get(ref),data=snap.exists()?snap.data():null;
  if(!pendingTimerAssignment(data))return;
  tx.update(ref,{assignment:{id:'timer-'+String(data.publishedAt)+'-'+String(data.payload.eventId),contentType:'timer',rotateSeconds:data.rotateSeconds||15,payload:data.payload,publishedAt:data.publishedAt}});
 });
}
// Explicit assignments survive legacy terminals updating payload/contentType.
export function effectiveDisplay(data){
 const assignment=data?.assignment;if(!assignment?.id||!assignment.payload)return data;
 const type=assignment.contentType;
 const useAssignment=(type==='timer'&&!pendingTimerAssignment(data))||data.contentType!==type||data.payload?.type!==type;
 return {...data,contentType:type,rotateSeconds:assignment.rotateSeconds,payload:useAssignment?assignment.payload:data.payload};
}
