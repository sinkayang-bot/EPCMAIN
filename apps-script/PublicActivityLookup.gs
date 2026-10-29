/** EPC public activity lookup: never expose member lists, balances or raw activity data. */
function epcPublicLookup_(r){
 const id=String(r.memberId||'').trim().toUpperCase();
 if(!/^[A-Z0-9_-]{3,32}$/.test(id))return{ok:false,error:'會員編號格式不正確'};
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
 return{ok:true,member:{id},summary:{events:entries.length,entries:entries.reduce((n,x)=>n+x.entries,0)},activities:records,history:[],note:'僅提供活動統計；Firebase 活動尚待整合'};
}
const epcPublicLookupBaseHandle_=handle_;
handle_=function(r){
 if(String(r&&r.action||'')==='activity.lookup'){try{return epcPublicLookup_(r)}catch(e){return{ok:false,error:'查詢暫時無法完成'}}}
 return epcPublicLookupBaseHandle_(r);
};
