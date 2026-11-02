import {validateConfig} from './config.js?v=5';
let connection;
export function sdk(config){return connection||=(async()=>{const c=validateConfig(config),[am,au,fs]=await Promise.all(['firebase-app','firebase-auth','firebase-firestore'].map(m=>import(`https://www.gstatic.com/firebasejs/12.4.0/${m}.js`))),app=am.getApps().find(a=>a.name==='epc-player-spark')||am.initializeApp(c,'epc-player-spark');return {au,fs,auth:au.getAuth(app),db:fs.getFirestore(app)}})()}

// Separate in-memory Auth instance: creating a player never replaces the staff session.
export async function enrollmentAccountFactory(config){
 const [am,au]=await Promise.all(['firebase-app','firebase-auth'].map(m=>import(`https://www.gstatic.com/firebasejs/12.4.0/${m}.js`)));
 const existing=am.getApps().find(a=>a.name==='epc-player-enrollment'),app=existing||am.initializeApp(validateConfig(config),'epc-player-enrollment');
 const auth=existing?au.getAuth(app):au.initializeAuth(app,{persistence:au.inMemoryPersistence});
 return {async createAccount(email,password){return (await au.createUserWithEmailAndPassword(auth,email,password)).user},async discardAccount(user){await au.deleteUser(user)}};
}
