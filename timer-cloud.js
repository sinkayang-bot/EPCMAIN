import {command,newTimer,validateLevels} from './timer-core.js';
let connection;
export function timerCloud(){return connection||=(async()=>{
 const [am,fs]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js')]);
 const app=am.getApps().find(a=>a.name==='epc-timer')||am.initializeApp(window.EPC_FIREBASE_CONFIG,'epc-timer'),db=fs.getFirestore(app);
 const timerRef=id=>fs.doc(db,'epc_events','_epc_timer','timers',String(id));
 const templates=fs.collection(db,'epc_events','_epc_timer','templates');
 function mode(){try{return window.parent!==window?window.parent.EPCMode:window.EPCMode}catch(_){return null}}
 function writable(fn){const guard=mode();if(!guard)throw Error('請從賽事管理開啟計時器後臺。');return guard.runWrite(fn)}
 return {
  subscribeTimer:(id,fn,error)=>fs.onSnapshot(timerRef(id),s=>fn(s.exists()?s.data():null),error),
  subscribeEvent:(id,fn,error)=>fs.onSnapshot(fs.doc(db,'epc_events',String(id)),s=>fn(s.exists()&&s.data().status!=='deleted'?{...s.data(),eventId:s.id}:null),error),
  subscribeTemplates:(fn,error)=>fs.onSnapshot(templates,s=>fn(s.docs.map(d=>({...d.data(),id:d.id}))),error),
  change:(id,revision,action,value)=>writable(()=>fs.runTransaction(db,async tx=>{
   mode().assertWrite();const ref=timerRef(id),[snap,event]=await Promise.all([tx.get(ref),tx.get(fs.doc(db,'epc_events',String(id)))]);
   if(!event.exists()||event.data().status==='deleted')throw Error('找不到賽事，請重新選擇。');
   if(['settled','已結算'].includes(event.data().status))throw Error('此場賽事已結算，計時器僅供檢視。');
   const current=snap.exists()?snap.data():newTimer();
   if(Number(current.revision||0)!==Number(revision||0))throw Error('另一台後臺已更新計時器，請確認最新畫面後再操作。');
   const next=command(current,action,value);next.revision=Number(current.revision||0)+1;next.eventId=String(id);next.updatedAt=fs.serverTimestamp();
   tx.set(ref,next);return next;
  })),
  saveTemplate:(name,levels)=>writable(async()=>{name=String(name||'').trim();if(!name)throw Error('請輸入範本名稱。');await fs.addDoc(templates,{name:name.slice(0,100),levels:validateLevels(levels),updatedAt:fs.serverTimestamp()})})
 };
})();}
