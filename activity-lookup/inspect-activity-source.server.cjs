'use strict';
// Read-only diagnostic of the authoritative EPCMAIN V3 activity API.
// Only schema names and record counts are logged; no member data is printed.
const url=process.env.EPC_V3_API_URL;
if(!url)throw Error('EPC_V3_API_URL required');
(async()=>{
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'activity.get'}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('V3 API HTTP '+response.status);
 const body=await response.json();
 if(!body.ok)throw Error('V3 activity.get failed: '+String(body.error||'unknown'));
 const activity=body.data||{};
 const fields=Object.fromEntries(Object.entries(activity).map(([key,val])=>[key,Array.isArray(val)?{type:'array',count:val.length}:val&&typeof val==='object'?{type:'object',keys:Object.keys(val).slice(0,25)}:{type:typeof val}]));
 console.log(JSON.stringify({source:'EPCMAIN V3 activity.get',revision:body.revision||0,fields},null,2));
})().catch(err=>{console.error(err.message);process.exitCode=1});
