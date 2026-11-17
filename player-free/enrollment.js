// Passwords and activation codes go only to Firebase Auth, never Firestore or storage.
export function memberLogin(id){
 const value=String(id||'').trim().toUpperCase();
 if(!/^[A-Z0-9_-]{1,60}$/.test(value))throw Error('會員編號只接受英文字母、數字、底線與短橫線');
 return {memberId:value,email:value.toLowerCase()+'@members.epc.invalid'};
}
export function activationCode(){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
 return Array.from(crypto.getRandomValues(new Uint8Array(20)),n=>alphabet[n%alphabet.length]).join('');
}
export function enrollmentClient({au,fs,auth,db}){
 const requestRef=uid=>fs.doc(db,'epc_player_enrollment_requests',uid);
 return {
  async request(memberId){
   const id=memberLogin(memberId).memberId;
   if(auth.currentUser&&!auth.currentUser.isAnonymous)throw Error('請先登出目前帳號再申請');
   const user=auth.currentUser||(await au.signInAnonymously(auth)).user;
   const ref=requestRef(user.uid);
   await fs.runTransaction(db,async tx=>{const old=await tx.get(ref);if(old.exists())throw Error('此裝置已有申請，請查看認證狀態或洽櫃台');tx.set(ref,{memberId:id,status:'pending',createdAt:fs.serverTimestamp()})});
  },
  watch(callback,error){let off=()=>{};const authOff=au.onAuthStateChanged(auth,user=>{off();off=()=>{};callback(null);if(user?.isAnonymous)off=fs.onSnapshot(requestRef(user.uid),s=>callback(s.exists()?s.data():null),error)});return()=>{off();authOff()};},
  async login(memberId,password){await au.signInWithEmailAndPassword(auth,memberLogin(memberId).email,password)},
  async activate(memberId,code,password){
   if(password.length<12||password.length>128)throw Error('密碼請設定 12～128 個字元');
   // Re-authenticate with the staff-issued one-time secret before changing credentials.
   const {user}=await au.signInWithEmailAndPassword(auth,memberLogin(memberId).email,code);
   const ref=fs.doc(db,'epc_player_profiles',user.uid),profile=await fs.getDocFromServer(ref);
   if(!profile.exists()||!profile.data().active||profile.data().passwordChangeRequired!==true||profile.data().activationExpiresAt.toMillis()<=Date.now()){await au.signOut(auth);throw Error('啟用碼已使用或帳號未核准，請洽櫃台');}
   await au.updatePassword(user,password);
   await fs.updateDoc(ref,{passwordChangeRequired:false});
  }
 };
}
export function enrollmentAdmin({au,fs,db,allowed,lookupMember,createAccount,discardAccount}){
 const ref=(c,id)=>fs.doc(db,c,id);
 return {
  async list(){await allowed();const s=await fs.getDocsFromServer(fs.query(fs.collection(db,'epc_player_enrollment_requests'),fs.where('status','==','pending'),fs.limit(100)));return s.docs.map(d=>({id:d.id,...d.data()}));},
  async reject(id){const actor=await allowed(),r=ref('epc_player_enrollment_requests',id);await fs.runTransaction(db,async tx=>{const s=await tx.get(r);if(!s.exists()||s.data().status!=='pending')throw Error('申請已處理');tx.update(r,{status:'rejected',reviewedBy:actor,reviewedAt:fs.serverTimestamp()})});},
  async approve(id,identityConfirmed){
   const actor=await allowed();if(identityConfirmed!==true)throw Error('請先核對會員本人');
   const r=ref('epc_player_enrollment_requests',id),s=await fs.getDocFromServer(r);
   if(!s.exists()||s.data().status!=='pending')throw Error('申請已處理');
   const {memberId,email}=memberLogin(s.data().memberId),member=await lookupMember(memberId),mref=ref('epc_player_members',memberId);
   if((await fs.getDocFromServer(mref)).exists())throw Error('此會員已有帳號，請使用原帳號或洽管理員重設');
   const code=activationCode(),account=await createAccount(email,code),uid=account.uid,op='enrollment-'+id;
   try{
    await fs.runTransaction(db,async tx=>{const [request,mapping]=await Promise.all([tx.get(r),tx.get(mref)]);
     if(!request.exists()||request.data().status!=='pending'||request.data().memberId!==memberId||mapping.exists())throw Error('申請或會員綁定已變更');
     tx.set(ref('epc_player_profiles',uid),{memberId,nickname:member.nickname,active:true,passwordChangeRequired:true,activationExpiresAt:fs.Timestamp.fromMillis(Date.now()+86400000),points:0,leaderboardKey:crypto.randomUUID(),boundBy:actor,boundAt:fs.serverTimestamp()});
     tx.set(mref,{uid,active:true});tx.update(r,{status:'approved',reviewedBy:actor,reviewedAt:fs.serverTimestamp()});tx.set(ref('epc_player_audit',op),{kind:'enrollmentApprove',actor,uid,memberId,at:fs.serverTimestamp()});
    });
   }catch(error){
    // A network error may follow a committed transaction. Never delete a possibly bound account.
    let mapping;try{mapping=await fs.getDocFromServer(mref)}catch{throw Error('核准結果尚待確認；請保留本頁並檢查會員綁定，勿重新建立帳號');}
    if(!mapping.exists()||mapping.data().uid!==uid){await discardAccount(account);throw error;}
   }
   return {memberId,code};
  }
 };
}
