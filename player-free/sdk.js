import {validateConfig} from './config.js?v=5';
let connection;
export function sdk(config){return connection||=(async()=>{const c=validateConfig(config),[am,au,fs]=await Promise.all(['firebase-app','firebase-auth','firebase-firestore'].map(m=>import(`https://www.gstatic.com/firebasejs/12.4.0/${m}.js`))),app=am.getApps().find(a=>a.name==='epc-player-spark')||am.initializeApp(c,'epc-player-spark');return {au,fs,auth:au.getAuth(app),db:fs.getFirestore(app)}})()}
