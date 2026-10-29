/** EPC public activity lookup: never expose member lists, balances or raw activity data. */
function epcLookupHash_(id,pin){const b=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(id).toUpperCase()+':'+String(pin));return Utilities.base64EncodeWebSafe(b)}
/** Run manually by an authorized script editor to issue/change a member's private lookup PIN. */
function epcSetLookupPin_(memberId,pin){
 const id=String(memberId||'').trim().toUpperCase();
 if(!/^[A-Z0-9_-]{3,32}$/.test(id)||!/^[0-9]{6,10}$/.test(String(pin)))throw Error('會員編號或驗證碼格式不正確');
 const m=members_().find(x=>String(x.memberId).toUpperCase()===id);
 if(!m)throw Error('MEMBER_NOT_FOUND');
 PropertiesService.getScriptProperties().setProperty('EPC_LOOKUP_'+id,epcLookupHash_(id,pin));
 return {ok:true,memberId:id};
}
function epcPublicLookup_(r){
 const id=String(r.memberId||'').trim().toUpperCase(),pin=String(r.pin||'');
 if(!/^[A-Z0-9_-]{3,32}$/.test(id)||!/^[0-9]{6,10}$/.test(pin))return{ok:false,error:'會員編號或驗證碼錯誤'};
 const expected=PropertiesService.getScriptProperties().getProperty('EPC_LOOKUP_'+id);
 if(!expected||expected!==epcLookupHash_(id,pin))return{ok:false,error:'會員編號或驗證碼錯誤'};
 const m=members_().find(x=>String(x.memberId).toUpperCase()===id);
 if(!m)return{ok:false,error:'會員不存在'};
 const sh=db_().getSheetByName(PL),ev=db_().getSheetByName(EV),entries=[];
 const events={};
 if(ev&&ev.getLastRow()>1)ev.getRange(2,1,ev.getLastRow()-1,10).getValues().forEach(x=>{if(x[0]&&String(x[9])!=='deleted')events[String(x[0])]={date:eventDateStr_(x[1]),name:String(x[2]||'賽事')}});
 if(sh&&sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,20).getValues().forEach(x=>{
  if(String(x[8])==='deleted'||(String(x[2]).trim().toUpperCase()!==id&&String(x[1])!==String(m.memberKey)))return;
  const event=events[String(x[0])];if(event)entries.push({date:event.date,event:event.name,entries:Number(x[4])||1});
 });
 entries.sort((a,b)=>b.date.localeCompare(a.date));
 const act=activityGet_().data||{},A=act.activityManagement||act;
 const records=[];
 for(const key of ['hunter','umbrella','pioneer','extremeTen']){
  const rows=Array.isArray(A[key])?A[key]:[];
  const mine=rows.filter(x=>[x.memberId,x.memberKey,x.member,x.playerId,x.killer,x.id].some(v=>String(v||'').toUpperCase()===id||String(v||'')===String(m.memberKey)));
  records.push({key,label:{hunter:'TOP HUNTER',umbrella:'保護傘',pioneer:'開桌先鋒',extremeTen:'極限10秒'}[key],count:mine.length,points:mine.reduce((n,x)=>n+(Number(x.points)||Number(x.coupons)||0),0)});
 }
 return{ok:true,member:{id,name:String(m.name||'')},summary:{events:entries.length,entries:entries.reduce((n,x)=>n+x.entries,0)},activities:records,history:entries.slice(0,30),note:'僅顯示 Google Sheet 已同步資料；其他 Firebase 活動待整合'};
}
const epcPublicLookupBaseHandle_=handle_;
handle_=function(r){
 if(String(r&&r.action||'')==='activity.lookup'){try{return epcPublicLookup_(r)}catch(e){return{ok:false,error:'查詢暫時無法完成'}}}
 return epcPublicLookupBaseHandle_(r);
};
