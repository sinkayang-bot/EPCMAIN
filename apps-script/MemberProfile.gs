/** Original form fields are restricted to the existing accounting administrators. */
function requireMemberProfileAdmin_(idToken){
 const token=String(idToken||'');
 if(!token||token.length>8192)throw Error('請先使用 Google 管理員登入');
 const response=UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/epcmain-76988/databases/(default)/documents/epc_daily_accounting?pageSize=1',{
  method:'get',headers:{Authorization:'Bearer '+token},muteHttpExceptions:true
 });
 if(response.getResponseCode()!==200)throw Error('此帳號沒有讀取完整會員資料的管理員權限');
}
function memberFormProfile_(memberKey,idToken){
 requireMemberProfileAdmin_(idToken);
 const found=mf_(memberKey);
 if(String(found.r[5])==='deleted')throw Error('MEMBER_NOT_FOUND');
 const source=source_(),row=source.v[srcRow_(source,found.r[1])-1],tz='Asia/Taipei';
 const fields=[];
 source.h.forEach((label,index)=>{
  const title=String(label||'').trim();
  if(!title||/^POKERFANSID$/i.test(title.replace(/\s+/g,'')))return;
  let value=row[index];
  if(value instanceof Date&&!isNaN(value))value=Utilities.formatDate(value,tz,/Timestamp|時間戳記/i.test(title)?'yyyy-MM-dd HH:mm:ss':'yyyy-MM-dd');
  else value=value===null||value===undefined?'':String(value);
  fields.push({label:title,value});
 });
 return {ok:true,fields};
}

const memberFormBaseHandle_=handle_;
handle_=function(request){
 if(String(request&&request.action||'')==='member.profile'){
  try{return memberFormProfile_(request.memberKey,request.idToken);}
  catch(error){return {ok:false,error:String(error.message||error)};}
 }
 return memberFormBaseHandle_(request);
};
