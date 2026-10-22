// Change only this device's projection assignment; timer progress is never reset.
export async function selectDisplayTimer({fs,db,ref,eventId}){
 const id=String(eventId||'');if(!id)throw Error('請選擇要投放的賽事');
 return fs.runTransaction(db,async tx=>{
  const [device,timer,event]=await Promise.all([tx.get(ref),tx.get(fs.doc(db,'epc_events','_epc_timer','timers',id)),tx.get(fs.doc(db,'epc_events',id))]);
  if(!device.exists()||!device.data().paired)throw Error('此顯示器尚未配對，請先完成配對');
  if(!timer.exists()||!event.exists()||event.data().status==='deleted')throw Error('此賽事的計時器已不存在，請重新選擇');
  const payload={type:'timer',eventId:id,title:String(event.data().name||timer.data().eventName||'EPC 賽事'),ui:{kind:'timer',eventId:id},refreshToken:crypto.randomUUID()},publishedAt=Date.now();
  const assignment={id:crypto.randomUUID(),contentType:'timer',rotateSeconds:15,payload,publishedAt};
  tx.update(ref,{contentType:'timer',rotateSeconds:15,payload,publishedAt,assignment});return {ok:true,eventId:id,title:payload.title};
 });
}
