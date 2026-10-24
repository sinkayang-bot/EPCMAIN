import {personalProjection} from '../player-server/model.js';
export function personalRows(events,memberId){
 if(!Array.isArray(events))throw Error('賽事來源不完整，已停止同步');
 const rows=new Map();for(const e of events){const id=String(e.eventId||e.id||'');if(!id||id.startsWith('_'))continue;if(rows.has(id))throw Error('賽事編號重複，已停止同步');
 const players=(e.players||[]).filter(p=>String(p.memberId)===memberId);if(players.length>1)throw Error('同場會員紀錄重複，請先核對後台');
 const row=personalProjection(id,e,memberId);if(row){if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||![row.charge,row.groups,...(row.settled?[row.prize]:[])].every(Number.isFinite))throw Error('賽事日期或金額不完整，已停止同步');rows.set(id,row)}}return rows;
}
export async function readSourceEvents(){
 const [am,fs]=await Promise.all(['firebase-app','firebase-firestore'].map(m=>import(`https://www.gstatic.com/firebasejs/12.4.0/${m}.js`)));
 // Only the staff sync page imports the original project's config. Player pages never do.
 if(!window.EPC_FIREBASE_CONFIG)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('../firebase-config.js',import.meta.url).href;script.onload=resolve;script.onerror=()=>reject(Error('現場資料來源設定載入失敗'));document.head.append(script)});
 const config=window.EPC_FIREBASE_CONFIG;if(config?.projectId!=='epcmain-76988')throw Error('現場資料來源專案不正確');const app=am.getApps().find(a=>a.name==='epc-player-staff-source')||am.initializeApp(config,'epc-player-staff-source');
 const snapshot=await fs.getDocsFromServer(fs.collection(fs.getFirestore(app),'epc_events'));return snapshot.docs.map(d=>({...d.data(),eventId:d.id}));
}
export async function syncMemberHistory(api,memberId,readEvents=readSourceEvents){
 const {fs,db}=api;await api.allowed();memberId=String(memberId||'').trim();if(!memberId)throw Error('請填寫會員編號');
 const binding=fs.doc(db,'epc_player_members',memberId),mapping=await fs.getDocFromServer(binding);if(!mapping.data()?.active||!mapping.data()?.uid)throw Error('此會員尚未綁定玩家帳號');const uid=mapping.data().uid,profile=fs.doc(db,'epc_player_profiles',uid),token=crypto.randomUUID();
 async function check(tx){const [b,p]=await Promise.all([tx.get(binding),tx.get(profile)]);if(!b.data()?.active||b.data().uid!==uid||!p.data()?.active||p.data().memberId!==memberId)throw Error('會員綁定已變更，請重新同步');return p.data()}
 await fs.runTransaction(db,async tx=>{await check(tx);tx.update(profile,{historySyncToken:token})});
 // Fetch must finish successfully before any old history can be replaced or removed.
 const rows=personalRows(await readEvents(),memberId),existing=await fs.getDocsFromServer(fs.collection(profile,'history')),old=new Map(existing.docs.map(d=>[d.id,d.data()])),jobs=[];
 for(const [id,row] of rows)if(!old.has(id)||Object.keys(old.get(id)).length!==Object.keys(row).length||Object.entries(row).some(([key,value])=>old.get(id)[key]!==value))jobs.push({id,row});for(const id of old.keys())if(!rows.has(id))jobs.push({id});
 for(let i=0;i<jobs.length;i+=180){const chunk=jobs.slice(i,i+180);await fs.runTransaction(db,async tx=>{const p=await check(tx);if(p.historySyncToken!==token)throw Error('已有較新的同步作業，請稍後查看');for(const job of chunk){const ref=fs.doc(profile,'history',job.id);if(job.row)tx.set(ref,job.row);else tx.delete(ref)}})}
 await fs.runTransaction(db,async tx=>{const p=await check(tx);if(p.historySyncToken!==token)throw Error('已有較新的同步作業，請稍後查看');tx.update(profile,{historySyncedAt:fs.serverTimestamp(),historyCount:rows.size})});return {count:rows.size,changed:jobs.length};
}
