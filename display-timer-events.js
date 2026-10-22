// Fetch event metadata in batches: deleted events are omitted by the query.
// Individual missing documents must never hold the entire picker open.
export async function displayTimerEvents({fs,db}){
 const timers=await fs.getDocsFromServer(fs.collection(db,'epc_events','_epc_timer','timers'));
 const ids=timers.docs.map(t=>t.id);if(!ids.length)return [];
 const batches=[];for(let i=0;i<ids.length;i+=30)batches.push(ids.slice(i,i+30));
 const snapshots=await Promise.all(batches.map(ids=>fs.getDocsFromServer(fs.query(fs.collection(db,'epc_events'),fs.where(fs.documentId(),'in',ids)))));
 return snapshots.flatMap(s=>s.docs).filter(d=>!['deleted','settled','已結算','ended','finished','completed','closed','已結束'].includes(d.data().status)).map(d=>{const e=d.data();return {eventId:d.id,name:String(e.name||'EPC 賽事'),date:String(e.date||''),settled:['settled','已結算'].includes(e.status)}}).sort((a,b)=>Number(a.settled)-Number(b.settled)||b.date.localeCompare(a.date)||b.name.localeCompare(a.name));
}
