(function(root){
 const settled=e=>['已結算','settled'].includes(e?.status);
 const valid=n=>Number.isSafeInteger(n)&&n>=0;
 function updateStack(e,memberId,stack,baseline){
  if(settled(e))throw Error('賽事已結算，不能修改籌碼');
  if(!valid(stack))throw Error('請輸入有效的非負整數籌碼');
  const players=(e.players||[]).map(p=>({...p})),matches=players.filter(p=>String(p.memberId)===String(memberId));
  if(matches.length!==1)throw Error('玩家名單已變更，請重新選擇玩家');
  const p=matches[0],current=p.stack??null;
  if(current!==baseline&&current!==stack)throw Error('這位玩家的籌碼已被更新，請確認最新數值後再儲存');
  p.stack=stack;p._stackRevision=(Number(p._stackRevision)||0)+1;
  return {...e,players};
 }
 function protectStacks(incoming,old){
  const previous=new Map((old.players||[]).map(p=>[String(p.memberId),p]));
  return {...incoming,players:(incoming.players||[]).map(p=>{
   const before=previous.get(String(p.memberId));if(!before)return p;
   const a=Number(p._stackRevision)||0,b=Number(before._stackRevision)||0;
   if(a<b)return {...p,stack:before.stack??null,_stackRevision:b};
   if(a===b&&b>0&&p.stack!==before.stack)throw Error('籌碼已有較新修改，請重新讀取後再編輯');
   return p;
  })};
 }
 root.EPCStackCore={updateStack,protectStacks};
 if(typeof module!=='undefined')module.exports=root.EPCStackCore;
})(typeof window!=='undefined'?window:globalThis);
