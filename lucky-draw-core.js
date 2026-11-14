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
 const result={id:root.crypto?.randomUUID?.()||String(now),prizeId,prizeName:prize.name,memberId:winner.memberId,name:winner.name,memberNumber:winner.memberNumber,points:winner.points,settingsRevision:s.settingsRevision||0,at:now};
 return {...s,revision:(s.revision||0)+1,results:[...s.results,result],active:{resultId:result.id,startedAt:now,endsAt:now+10500,eligibleIds:people.map(p=>p.memberId)}};
}
function settings(s,value){
 if(value.expectedRevision!=null&&value.expectedRevision!==(s.settingsRevision||0))throw Error('設定已被另一台裝置修改，請重新開啟設定');
 const lines=String(value.text||'').trim().split('\n').filter(line=>line.trim());
 const parsed=lines.map(line=>{const parts=line.split('|').map(x=>x.trim()),quantity=Number(parts[1]);if(parts.length!==2||!parts[0]||parts[0].length>100||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000)throw Error('每行請輸入獎項名稱 | 數量（1–1000）');return {name:parts[0],quantity}});
 if(!parsed.length)throw Error('請輸入全部獎項');
 if(new Set(parsed.map(p=>p.name)).size!==parsed.length)throw Error('獎項名稱不可重複');
 // Keep IDs when names are reordered; use the original row ID for a rename.
 const reserved=new Set(parsed.map(p=>s.prizes.find(old=>old.name===p.name)?.id).filter(Boolean)),used=new Set();
 const prizes=parsed.map((p,i)=>{const match=s.prizes.find(old=>old.name===p.name),previous=s.prizes[i];const id=match?.id||(previous&&!reserved.has(previous.id)&&!used.has(previous.id)?previous.id:'new-'+(s.revision+1)+'-'+i);used.add(id);return {id,...p}});
 for(const old of s.prizes){const awarded=s.results.filter(r=>r.prizeId===old.id).length,p=prizes.find(p=>p.id===old.id);if(awarded&&(!p||p.quantity<awarded))throw Error('已中獎獎項不可刪除，數量不可少於已抽出的份數');}
 const people=s.people.map(p=>{const weight=value.weights?.find(w=>w.memberId===p.memberId)?.weight;if(!Number.isFinite(weight)||weight<0||weight>1e9)throw Error('權重須為 0–1,000,000,000');return {...p,weight}});
 if(!people.some(p=>p.weight>0))throw Error('至少一位玩家權重須大於 0');
 const settingsRevision=(s.settingsRevision||0)+1;
 return {...s,people,prizes,revision:(s.revision||0)+1,settingsRevision,settingsHistory:[...(s.settingsHistory||[]),{revision:settingsRevision,at:Date.now(),prizes,weights:people.map(p=>({memberId:p.memberId,weight:p.weight}))}].slice(-50)};
}
function reset(s,expectedRevision,resetId,now=Date.now()){
 if(expectedRevision!==s.revision)throw Error('抽選紀錄已更新，請確認最新結果後再重置');
 if(s.active&&s.active.endsAt>now)throw Error('正在抽選，請等揭曉完成後再重置');
 if(!resetId)throw Error('缺少重置識別碼');
 return {...s,results:[],active:null,revision:(s.revision||0)+1,resetId,resetAt:now};
}
function publicState(s){return {period:s.period,revision:s.revision,prizes:s.prizes,people:s.people.map(({memberId,name,memberNumber,points})=>({memberId,name,memberNumber,points})),results:s.results,active:s.active||null}}
root.EPCLuckyDraw={draw,settings,reset,eligible,wins,publicState};
})(globalThis);
