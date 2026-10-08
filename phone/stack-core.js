(function(root){
 const settled=e=>['已結算','settled'].includes(e?.status),valid=n=>Number.isSafeInteger(n)&&n>=0;
 const revisions={stack:'_stackRevision',seat:'_seatRevision',hunterHeads:'_hunterHeadsRevision'};
 function updatePlayerFields(e,memberId,patch,baseline){
  if(settled(e))throw Error('賽事已結算，不能修改');
  const players=(e.players||[]).map(p=>({...p})),matches=players.filter(p=>String(p.memberId)===String(memberId));
  if(matches.length!==1)throw Error('玩家名單已變更，請重新選擇玩家');
  const p=matches[0];
  for(const [field,value] of Object.entries(patch)){
   if(!revisions[field])throw Error('不支援的欄位');
   if(field==='seat'){if(typeof value!=='string'||value.length>20)throw Error('座位最多20個字元')}
   else if(!valid(value))throw Error('請輸入有效的非負整數');
   const current=p[field]??null;if(current!==baseline[field]&&current!==value)throw Error('這位玩家的資料已被更新，請確認最新數值後再儲存');
   p[field]=value;p[revisions[field]]=(Number(p[revisions[field]])||0)+1;
  }
  return {...e,players};
 }
 function updateStack(e,id,stack,baseline){return updatePlayerFields(e,id,{stack},{stack:baseline})}
 function protectStacks(incoming,old){
  const previous=new Map((old.players||[]).map(p=>[String(p.memberId),p]));
  return {...incoming,players:(incoming.players||[]).map(p=>{
   const before=previous.get(String(p.memberId));if(!before)return p;const next={...p};
   for(const [field,rev] of Object.entries(revisions)){
    const a=Number(p[rev])||0,b=Number(before[rev])||0;
    if(a<b){next[field]=before[field]??null;next[rev]=b}
    else if(a===b&&b>0&&p[field]!==before[field])throw Error('玩家資料已有較新修改，請重新讀取後再編輯');
   }
   return next;
  })};
 }
 root.EPCStackCore={updateStack,updatePlayerFields,protectStacks};
 if(typeof module!=='undefined')module.exports=root.EPCStackCore;
})(typeof window!=='undefined'?window:globalThis);
