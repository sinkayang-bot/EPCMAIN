// Display documents live in a subcollection, separate from root event records.
export async function displayCloud(){
 const [am,fs]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js')]);
 const app=am.getApps().find(a=>a.name==='epc-display')||am.initializeApp(window.EPC_FIREBASE_CONFIG,'epc-display');
 const db=fs.getFirestore(app),devices=fs.collection(db,'epc_events','_epc_display','devices'),codes=fs.collection(db,'epc_events','_epc_display','codes');
 const device=id=>fs.doc(devices,String(id));
 return {fs,device,
  async request(p){
   if(p.action==='ping'){await fs.getDocs(fs.query(devices,fs.limit(1)));return {ok:true,version:'Firebase 顯示連線'}}
   if(p.action==='devices'){const snap=await fs.getDocs(devices);return {ok:true,devices:snap.docs.map(d=>({...d.data(),deviceId:d.id})).filter(d=>d.paired)}}
   if(p.action==='pair'){
    await fs.runTransaction(db,async tx=>{const ref=fs.doc(codes,p.code),snap=await tx.get(ref);if(!snap.exists()||snap.data().expiresAt<Date.now())throw Error('配對碼已過期，請重新整理電視頁面');const d=snap.data(),target=device(d.deviceId),ds=await tx.get(target);if(!ds.exists()||ds.data().paired)throw Error('此設備已配對或已失效');tx.update(target,{paired:true,name:p.name,lastSeen:Date.now()});tx.delete(ref)});return {ok:true};
   }
   if(p.action==='remove'){await fs.deleteDoc(device(p.deviceId));return {ok:true}}
   if(p.action==='publish'){await fs.updateDoc(device(p.deviceId),{contentType:p.contentType,rotateSeconds:p.rotateSeconds,payload:p.payload,publishedAt:Date.now()});return {ok:true}}
   throw Error('不支援的顯示操作');
  },
  async register(id){
   const current=await fs.getDoc(device(id));if(current.exists()&&current.data().paired)return;
   for(let attempt=0;attempt<10;attempt++){
    const code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);
    try{await fs.runTransaction(db,async tx=>{const ref=fs.doc(codes,code),old=await tx.get(ref);if(old.exists()&&old.data().expiresAt>Date.now())throw Error('CODE_COLLISION');tx.set(ref,{deviceId:id,expiresAt:Date.now()+10*60*1000});tx.set(device(id),{deviceId:id,paired:false,code,lastSeen:Date.now()})});return}catch(e){if(e.message!=='CODE_COLLISION')throw e}
   }throw Error('無法產生配對碼，請重新整理');
  },
  heartbeat:async id=>{await fs.updateDoc(device(id),{lastSeen:Date.now()})},
  subscribe:(id,fn,error)=>fs.onSnapshot(device(id),snap=>fn(snap.exists()?snap.data():null),error)
 };
}
