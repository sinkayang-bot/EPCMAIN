export async function luckyDrawCloud(){
 const [am,fs]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js')]);
 const app=am.getApps().find(a=>a.name==='epc-lucky-draw')||am.initializeApp(window.EPC_FIREBASE_CONFIG,'epc-lucky-draw'),db=fs.getFirestore(app);
 const ref=(period,publicView=false)=>fs.doc(db,'epc_events','_epc_lucky_draw',publicView?'public':'sessions',period);
 return {read:async period=>{const s=await fs.getDoc(ref(period));return s.exists()?s.data():null},subscribe:(period,fn,error,publicView=true)=>fs.onSnapshot(ref(period,publicView),s=>fn(s.exists()?s.data():null),error),
 async update(period,fn){window.EPCMode?.assertWrite();return fs.runTransaction(db,async tx=>{window.EPCMode?.assertWrite();const r=ref(period),snap=await tx.get(r),old=snap.exists()?snap.data():null,next=fn(old);if(old&&next.resetId&&next.resetId!==old.resetId){tx.set(fs.doc(db,'epc_events','_epc_lucky_draw','archives',period+'_'+next.resetId),{...old,archivedAt:next.resetAt,reason:'operator-reset'});}tx.set(r,next);tx.set(ref(period,true),EPCLuckyDraw.publicState(next));return next})}};
}
