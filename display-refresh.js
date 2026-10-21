import {effectiveDisplay} from './display-assignment.js?v=20261022-switch5';
// Background data refresh is never allowed to change a device's assignment.
export async function refreshDisplay({fs,db,ref,request}){
 return fs.runTransaction(db,async tx=>{
  const snap=await tx.get(ref),current=effectiveDisplay(snap.exists()?snap.data():null);
  if(!current?.paired||current.contentType==='timer'||current.payload?.type==='timer'||current.contentType!==request.contentType||Number(current.publishedAt||0)!==Number(request.expectedPublishedAt||0))return {ok:true,skipped:true};
  tx.update(ref,{payload:request.payload});return {ok:true,skipped:false};
 });
}
