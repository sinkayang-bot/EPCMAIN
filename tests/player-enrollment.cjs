const assert=require('node:assert/strict');
(async()=>{
 const {memberLogin,activationCode,enrollmentAdmin,enrollmentClient}=await import('../player-free/enrollment.js');
 assert.deepEqual(memberLogin(' epc-001 '),{memberId:'EPC-001',email:'epc-001@members.epc.invalid'});
 for(const id of ['','A/B','a@b','中'])assert.throws(()=>memberLogin(id));
 const codes=new Set(Array.from({length:100},activationCode));assert.equal(codes.size,100);for(const code of codes)assert.match(code,/^[A-Za-z2-9]{20}$/);
 const records=new Map(),ref=(c,id)=>({path:c+'/'+id}),snap=r=>({exists:()=>records.has(r.path),data:()=>structuredClone(records.get(r.path))}),fs={doc:(_,c,id)=>ref(c,id),serverTimestamp:()=>1,Timestamp:{fromMillis:n=>({toMillis:()=>n})},getDocFromServer:async r=>snap(r),runTransaction:async(_,fn)=>{const writes=[];const value=await fn({get:async r=>snap(r),set:(r,v)=>writes.push(()=>records.set(r.path,v)),update:(r,v)=>writes.push(()=>records.set(r.path,{...records.get(r.path),...v}))});writes.forEach(f=>f());return value;}};
 fs.updateDoc=async(r,v)=>records.set(r.path,{...records.get(r.path),...v});
 let auth={currentUser:null},created=[],discarded=[],calls=[];
 const au={signInAnonymously:async()=>({user:auth.currentUser={uid:'R1',isAnonymous:true}}),signInWithEmailAndPassword:async(_,email,password)=>{calls.push([email,password]);return {user:auth.currentUser={uid:'P1'}}},updatePassword:async(_,password)=>calls.push(['new',password]),signOut:async()=>{auth.currentUser=null}};
 const client=enrollmentClient({au,fs,auth,db:{}});await client.request('1');assert.equal(records.get('epc_player_enrollment_requests/R1').status,'pending');await assert.rejects(()=>client.request('2'),/已有申請/);assert.equal(records.get('epc_player_enrollment_requests/R1').memberId,'1');
 let permitted=true;const admin=enrollmentAdmin({fs,db:{},allowed:async()=>{if(!permitted)throw Error('NO ADMIN');return 'ADMIN'},lookupMember:async memberId=>({memberId,nickname:'會員本人'}),createAccount:async(email,code)=>{created.push([email,code]);return {uid:'P1'}},discardAccount:async u=>discarded.push(u.uid)});
 permitted=false;await assert.rejects(()=>admin.approve('R1',true),/NO ADMIN/);assert.equal(created.length,0);permitted=true;
 await assert.rejects(()=>admin.approve('R1',false),/核對/);const result=await admin.approve('R1',true);assert.equal(result.memberId,'1');assert.equal(result.code,created[0][1]);assert.equal(records.get('epc_player_members/1').uid,'P1');assert.equal(records.get('epc_player_profiles/P1').passwordChangeRequired,true);assert(!JSON.stringify([...records.values()]).includes(result.code),'secret is never persisted');
 await assert.rejects(()=>admin.approve('R1',true),/已處理/);assert.equal(created.length,1);await assert.rejects(()=>client.activate('1',result.code,'short'),/12/);assert.equal(calls.length,0);
 // Map snapshots have timestamp methods in the production SDK.
 const prior=fs.getDocFromServer;fs.getDocFromServer=async r=>r.path==='epc_player_profiles/P1'?{exists:()=>true,data:()=>records.get(r.path)}:prior(r);
 await client.activate('1',result.code,'long-new-password');assert.equal(records.get('epc_player_profiles/P1').passwordChangeRequired,false);assert.deepEqual(calls[1],['new','long-new-password']);await assert.rejects(()=>client.activate('1',result.code,'another-password'),/已使用/);
 records.set('epc_player_enrollment_requests/R2',{status:'pending',memberId:'2'});await admin.reject('R2');assert.equal(records.get('epc_player_enrollment_requests/R2').status,'rejected');await assert.rejects(()=>admin.approve('R2',true),/已處理/);
 console.log('PASS: normalization, unguessable activation secrets, duplicate request protection, admin identity confirmation, one-time approval, no stored passwords/codes, activation and rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});
