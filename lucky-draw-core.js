(function(root){
'use strict';
const wins=(s,id)=>(s.results||[]).filter(r=>r.memberId===id).length;
function eligible(s){return s.people.filter(p=>p.weight>0&&wins(s,p.memberId)<2)}
function draw(s,prizeId,u,now=Date.now()){
 if(!Number.isFinite(u)||u<0||u>=1)throw Error('無效亂數');
 if(s.active&&s.active.endsAt>now)throw Error('正在抽選，請稍候');
 const prize=s.prizes.find(p=>p.id===prizeId);if(!prize)throw Error('請選擇獎項');
 if(s.results.filter(r=>r.prizeId===prizeId).length>=prize.quantity)throw Error('這個獎項已抽完');
 const people=eligible(s),total=people.reduce((n,p)=>n+p.weight,0);if(!total||!Number.isFinite(total))throw Error('沒有符合資格的抽選名單');
 let x=u*total,winner=people.at(-1);for(const p of people){x-=p.weight;if(x<0){winner=p;break}}
 const result={id:root.crypto?.randomUUID?.()||String(now),prizeId,prizeName:prize.name,memberId:winner.memberId,name:winner.name,memberNumber:winner.memberNumber,points:winner.points,at:now};
 return {...s,revision:(s.revision||0)+1,results:[...s.results,result],active:{resultId:result.id,startedAt:now,endsAt:now+10500,eligibleIds:people.map(p=>p.memberId)}};
}
function publicState(s){return {period:s.period,revision:s.revision,prizes:s.prizes,people:s.people.map(({memberId,name,memberNumber,points})=>({memberId,name,memberNumber,points})),results:s.results,active:s.active||null}}
root.EPCLuckyDraw={draw,eligible,wins,publicState};
})(globalThis);
