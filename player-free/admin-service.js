import {anonymousMembers} from './ranking-names.js?v=9';
import {lookupSourceMember} from './member-source.js?v=6';
import {sdk} from './sdk.js?v=5';
export async function sparkAdmin(config,connectSdk=sdk,lookupMemberSource=lookupSourceMember){
 const {au,fs,auth,db}=await connectSdk(config),ref=(c,id)=>fs.doc(db,c,String(id));
 const text=(s,max=100)=>String(s||'').trim().slice(0,max),today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());
 async function allowed(){if(!auth.currentUser)throw Error('請先登入管理員帳號');await fs.getDocFromServer(ref('epc_player_activity_settings','current'));return auth.currentUser.uid}
 async function lookupMember(id){await allowed();return lookupMemberSource(id)}
 async function call(d){const actor=await allowed(),kind=d.kind,memberId=text(d.memberId),op=text(d.operationId,80);if(!/^[a-zA-Z0-9_-]{8,80}$/.test(op))throw Error('缺少操作識別碼');
  if(kind==='activityConfigure'){if(!['rank','hunter','umbrella','extremeTen'].includes(d.activity)||typeof d.enabled!=='boolean'||!Array.isArray(d.rules)||d.enabled&&!d.rules.some(r=>String(r).trim()))throw Error('請先填寫正式活動規則');await fs.setDoc(ref('epc_player_activity_settings','current'),{[d.activity]:{enabled:d.enabled,nameMode:d.nameMode==='anonymous'?'anonymous':'nickname',anonymousMembers:anonymousMembers(d.anonymousMembers),subtitle:text(d.subtitle,120),rules:d.rules.map(r=>text(r,500)).slice(0,20)}},{merge:true});if(!d.enabled)await fs.deleteDoc(ref('epc_player_public_activities',d.activity));return {ok:true,settingsOnly:true}}
  if(kind==='activityRefresh')throw Error('請開啟「免費版同步頁」讀取現場來源後同步。');
  const audit=ref('epc_player_audit',op),oldAudit=await fs.getDocFromServer(audit);if(oldAudit.exists()){if(oldAudit.data().actor!==actor||oldAudit.data().kind!==kind||oldAudit.data().memberId!==memberId)throw Error('操作識別碼重複');return {ok:true,alreadyApplied:true}}
  if(kind==='bind'){
   if(!d.identityConfirmed||!memberId||!/^\d{6}$/.test(String(d.code)))throw Error('請核對本人身分與綁定碼');
   const member=await lookupMember(memberId);if(member.nickname!==text(d.nickname))throw Error('會員綽號已變更，請重新查詢後確認');if(member.memberId!==memberId)throw Error('會員編號已變更，請重新查詢');
   const matches=await fs.getDocsFromServer(fs.query(fs.collection(db,'epc_player_binding_requests'),fs.where('code','==',String(d.code)),fs.limit(3))),valid=matches.docs.filter(x=>!x.data().consumed&&x.data().expiresAt.toMillis()>Date.now());if(matches.size>=3||valid.length!==1)throw Error('綁定碼已失效或重複，請玩家重新產生');const uid=valid[0].id,pref=ref('epc_player_profiles',uid),mref=ref('epc_player_members',memberId);
   await fs.runTransaction(db,async tx=>{const [a,p,m,b]=await Promise.all([tx.get(audit),tx.get(pref),tx.get(mref),tx.get(valid[0].ref)]);if(a.exists())return;if(!b.exists()||b.data().consumed||b.data().expiresAt.toMillis()<=Date.now()||b.data().code!==String(d.code))throw Error('綁定碼已失效');if(p.exists()&&p.data().memberId!==memberId)throw Error('帳號已綁定其他會員');if(m.exists()&&m.data().uid!==uid)throw Error('會員已綁定其他帳號');tx.set(pref,{memberId,nickname:member.nickname,active:true,points:Number(p.data()?.points)||0,leaderboardKey:p.data()?.leaderboardKey||crypto.randomUUID(),boundBy:actor,boundAt:fs.serverTimestamp()},{merge:true});tx.set(mref,{uid,active:true});tx.update(valid[0].ref,{consumed:true});tx.set(audit,{kind,actor,uid,memberId,at:fs.serverTimestamp()})});return {ok:true};
  }
  const m=await fs.getDocFromServer(ref('epc_player_members',memberId));if(!m.exists()||!m.data().active)throw Error('找不到已綁定會員');const uid=m.data().uid,pref=ref('epc_player_profiles',uid);
  await fs.runTransaction(db,async tx=>{const [a,p,b]=await Promise.all([tx.get(audit),tx.get(pref),tx.get(ref('epc_player_members',memberId))]);if(a.exists())return;if(!p.exists()||!p.data().active||!b.data()?.active||b.data().uid!==uid)throw Error('綁定已停用或變更');
   if(kind==='points'){const delta=Number(d.delta),points=Number(p.data().points||0)+delta,label=text(d.label);if(!Number.isSafeInteger(delta)||!delta||Math.abs(delta)>1000000||!label||points<0)throw Error('點數或原因不正確，可用點數不可為負數');tx.update(pref,{points});tx.set(fs.doc(pref,'points',op),{delta,label,date:today(),createdAt:fs.serverTimestamp()})}
   else if(kind==='coupon'){const amount=Number(d.amount),name=text(d.name),expiresOn=text(d.expiresOn);if(!Number.isSafeInteger(amount)||amount<=0||amount>1000000||!name||!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)||expiresOn<today())throw Error('優惠券金額或期限不正確');tx.set(fs.doc(pref,'coupons',op),{name,amount,expiresOn,terms:text(d.terms,1000),status:'active',issuedBy:actor,issuedAt:fs.serverTimestamp()})}
   else if(kind==='redeemCoupon'){const coupon=fs.doc(pref,'coupons',text(d.couponId,80)),s=await tx.get(coupon);if(!s.exists()||s.data().status!=='active'||s.data().expiresOn<today())throw Error('優惠券已使用、到期或不存在');tx.update(coupon,{status:'used',usedBy:actor,usedAt:fs.serverTimestamp()})}
   else throw Error('不支援的操作');tx.set(audit,{kind,actor,uid,memberId,at:fs.serverTimestamp()});
  });return {ok:true};
 }
 async function syncHistory(memberId,readEvents){const {syncMemberHistory}=await import('./history-sync.js?v=7');return syncMemberHistory({fs,db,allowed},memberId,readEvents)}
 return {auth,au,fs,db,allowed,call,lookupMember,syncHistory};
}
