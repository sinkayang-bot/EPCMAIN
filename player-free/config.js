export const STORAGE_KEY='epc-player-spark-config-v1';
export function validateConfig(input){
 const p=input?.projectId;
 if(!/^epc-player-[a-z0-9-]{4,19}$/.test(p||'')||p.length>30)throw Error('只接受 epc-player- 開頭的獨立試行專案');
 if(!/^[A-Za-z0-9_-]{20,80}$/.test(input.apiKey||'')||!/^1:\d+:web:[a-f0-9]+$/i.test(input.appId||''))throw Error('Firebase 網頁設定不完整');
 if(input.authDomain!==p+'.firebaseapp.com')throw Error('登入網域必須屬於同一個試行專案');
 return {apiKey:input.apiKey,authDomain:input.authDomain,projectId:p,appId:input.appId};
}
export function readConfig(storage){try{return validateConfig(JSON.parse(storage.getItem(STORAGE_KEY)))}catch{return null}}
