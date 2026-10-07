// Authentication controls accounting access; authorization is enforced by Firestore rules.
export function setupAccountingAuth({app, fs, accountingCol, bridge, authMod}) {
 const auth=authMod.getAuth(app);
 auth.languageCode='zh-TW';
 const el=id=>document.getElementById(id);
 let unsubscribe=null,generation=0;
 const message=(state,text)=>{
  bridge.accountingReady=state==='connected';
  bridge.accountingState=state;
  if(el('epcAccountingAuthState'))el('epcAccountingAuthState').textContent=text;
 };
 const stop=()=>{generation++;if(unsubscribe)unsubscribe();unsubscribe=null;bridge.accountingReady=false;};
 function subscribe(user) {
  stop();
  if(el('epcAccountingLogin'))el('epcAccountingLogin').hidden=!!user;
  if(el('epcAccountingLogout'))el('epcAccountingLogout').hidden=!user;
  if(el('epcAccountingRetry'))el('epcAccountingRetry').hidden=!user;
  if(el('epcAccountingUid'))el('epcAccountingUid').textContent=user?.uid||'';
  if(el('epcAccountingSetup'))el('epcAccountingSetup').hidden=true;
  if(!user){message('signed-out','帳務：請先使用 Google 管理員登入');return;}
  if(!user.emailVerified){message('denied','帳務：登入帳號尚未完成驗證');return;}
  const current=generation;
  message('connecting','帳務：正在確認管理員權限…');
  unsubscribe=fs.onSnapshot(accountingCol,{includeMetadataChanges:true},snap=>{
   if(current!==generation)return;
   // A cached snapshot does not prove that the server allows this user to read/write.
   if(snap.metadata?.fromCache){message('connecting','帳務：正在連線，尚未確認伺服器權限');return;}
   const rows=[];snap.forEach(d=>{const x=d.data()||{};rows.push({...x,date:x.date||d.id});});
   window.EPC_FIRESTORE_LAST_ACCOUNTING=rows;
   message('connected','帳務：管理員已連線｜'+(user.displayName||user.email||'已登入'));
   window.dispatchEvent(new CustomEvent('epcFirestoreAccounting',{detail:{rows}}));
  },err=>{
   if(current!==generation)return;
   const denied=err?.code==='permission-denied';
   message(denied?'denied':'error',denied?'帳務：此帳號尚未取得管理員權限':'帳務連線失敗：'+String(err?.message||err));
   if(el('epcAccountingSetup'))el('epcAccountingSetup').hidden=!denied;
  });
 }
 bridge.requireAccountingAccess=()=>{
  if(!auth.currentUser)throw Error('請先按「Google 管理員登入」再新增收支');
  if(!bridge.accountingReady)throw Error(bridge.accountingState==='denied'?'此帳號尚未取得帳務管理員權限':'帳務尚未完成伺服器連線，請稍後或按「重試帳務連線」');
 };
 async function login() {
  const button=el('epcAccountingLogin');if(button)button.disabled=true;
  try{
   const provider=new authMod.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
   await authMod.signInWithPopup(auth,provider);
  }catch(err){
   const messages={'auth/operation-not-allowed':'請在 Firebase Authentication 啟用 Google 登入','auth/unauthorized-domain':'請在 Firebase Authentication 授權 sinkayang-bot.github.io 網域','auth/popup-blocked':'瀏覽器封鎖登入視窗，請允許彈出視窗後再試','auth/popup-closed-by-user':'登入視窗已關閉，請重新登入'};
   if(auth.currentUser)subscribe(auth.currentUser);
   else message('error','帳務登入失敗：'+(messages[err?.code]||String(err?.message||err)));
  }finally{if(button)button.disabled=false;}
 }
 if(el('epcAccountingLogin')){el('epcAccountingLogin').disabled=false;el('epcAccountingLogin').addEventListener('click',login);}
 el('epcAccountingRetry')?.addEventListener('click',()=>subscribe(auth.currentUser));
 el('epcAccountingLogout')?.addEventListener('click',async()=>{
  try{await authMod.signOut(auth);}catch(err){message('error','登出失敗：'+String(err?.message||err));}
 });
 return authMod.onAuthStateChanged(auth,subscribe);
}
