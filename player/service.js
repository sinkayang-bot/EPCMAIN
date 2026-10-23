import {playerConfig} from './config.js';
export async function connect(onAuth,onLive,onError){
 if(!playerConfig.enabled)throw Error('玩家資料服務尚未啟用；目前可先查看功能示範。');
 const [am,authMod,fs,fn]=await Promise.all(['firebase-app','firebase-auth','firebase-firestore','firebase-functions'].map(m=>import(`https://www.gstatic.com/firebasejs/12.4.0/${m}.js`)));
 const app=am.getApps().find(a=>a.name==='epc-player')||am.initializeApp(window.EPC_FIREBASE_CONFIG,'epc-player'),auth=authMod.getAuth(app),db=fs.getFirestore(app),functions=fn.getFunctions(app,playerConfig.region);
 const call=async(name,data={})=>(await fn.httpsCallable(functions,name)(data)).data;
 let generation=0,privateOff=[];
 async function subscribe(user){const current=++generation;privateOff.forEach(off=>off());privateOff=[];let state={user,profile:null,history:[],coupons:[],points:[]};onAuth(state);if(!user)return;
  try{const result=await call('epcPlayerMe');if(current!==generation)return;state={user,...result};onAuth(state);if(!result.profile)return;
   const fail=error=>{if(current!==generation)return;generation++;privateOff.forEach(off=>off());privateOff=[];onAuth({user,profile:null,history:[],coupons:[],points:[]});onError(error)};
   privateOff.push(fs.onSnapshot(fs.doc(db,'epc_player_profiles',user.uid),s=>{if(current!==generation)return;if(!s.exists()||s.data().active!==true){fail(Error('會員綁定已停用，請洽櫃台。'));return}const p=s.data();state={...state,profile:{memberId:p.memberId,nickname:p.nickname,points:Number(p.points)||0}};onAuth(state)},fail));
   for(const name of ['history','coupons','points'])privateOff.push(fs.onSnapshot(fs.collection(db,'epc_player_profiles',user.uid,name),s=>{if(current!==generation)return;state={...state,[name]:s.docs.map(d=>({id:d.id,...d.data()}))};onAuth(state)},fail));
  }catch(e){if(current===generation)onError(e)}
 }
 const offAuth=authMod.onAuthStateChanged(auth,subscribe);
 // Only server-produced public projections are read; raw rosters/accounting are never fetched.
 const offLive=fs.onSnapshot(fs.query(fs.collection(db,'epc_player_public_events'),fs.where('active','==',true)),s=>onLive(s.docs.map(d=>({id:d.id,...d.data()}))),onError);
 return {login:()=>authMod.signInWithPopup(auth,new authMod.GoogleAuthProvider()),logout:()=>authMod.signOut(auth),binding:()=>call('epcPlayerBindingCode'),refresh:()=>subscribe(auth.currentUser),dispose(){generation++;offAuth();offLive();privateOff.forEach(off=>off())}};
}
