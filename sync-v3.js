window.EPCSync=(function(){
 const state={apiUrl:'',cursor:Number(localStorage.getItem('epcCursor')||0),pollMs:1200,running:false};const listeners=new Set();
 async function request(action,payload={}){if(!state.apiUrl)throw new Error('API_URL_NOT_SET');const r=await fetch(state.apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload})});const j=await r.json();if(!j.ok)throw new Error(j.error||'API_ERROR');return j}
 function setApiUrl(u){state.apiUrl=String(u||'').trim();localStorage.setItem('epcApiUrl',state.apiUrl)}
 function on(fn){listeners.add(fn);return()=>listeners.delete(fn)} function emit(x){listeners.forEach(fn=>{try{fn(x)}catch(e){console.error(e)}})}
 async function pollOnce(){const j=await request('changes',{since:state.cursor,limit:300});for(const c of j.changes||[])emit({type:'change',change:c});if(Number(j.cursor||0)>state.cursor){state.cursor=Number(j.cursor);localStorage.setItem('epcCursor',String(state.cursor))}if(j.hasMore)return pollOnce()}
 async function loop(){if(state.running)return;state.running=true;while(state.running){try{await pollOnce()}catch(e){emit({type:'sync-error',error:e})}await new Promise(r=>setTimeout(r,state.pollMs))}}
 return {state,setApiUrl,on,pollOnce,loop,stop(){state.running=false},request};
})();