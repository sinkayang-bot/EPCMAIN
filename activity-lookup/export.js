(function(){
'use strict';
function exportPublicActivity(){
 const db=window.epcDb;
 if(!db||!Array.isArray(db.events)||!Array.isArray(db.members)){alert('會員或賽事資料尚未載入，請先確認同步完成');return}
 const members={};
 for(const m of db.members){const id=String(m.id||m.memberId||'').trim().toUpperCase();if(id)members[id]={events:0,entries:0,days:new Set(),activities:{}}}
 for(const e of db.events){
  if(!e||!Array.isArray(e.players))continue;
  const date=String(e.businessDate||e.date||'').slice(0,10),seen=new Set();
  for(const p of e.players){const id=String(p.memberId||p.id||'').trim().toUpperCase();if(!id)continue;
   if(!members[id])members[id]={events:0,entries:0,days:new Set(),activities:{}};
   const item=members[id];if(!seen.has(id)){item.events++;seen.add(id)}
   item.entries+=Math.max(0,Number(p.buyin||1)+Number(p.rebuy||0)+Number(p.addon||0));if(date)item.days.add(date);
  }
 }
 const A=db.activityManagement||{};
 for(const key of ['hunter','umbrella','extremeTen']){
  const rows=Array.isArray(A[key])?A[key]:[];
  for(const x of rows){
   const id=String(x.memberId||x.member||x.killer||x.playerId||'').trim().toUpperCase();
   if(!id||!members[id])continue;
   const o=members[id].activities[key]||(members[id].activities[key]={count:0,points:0});
   o.count++;o.points+=Number(x.points||x.coupons||0)||0;
  }
 }
 const data={version:1,generatedAt:new Date().toISOString(),members:{}};
 for(const [id,v] of Object.entries(members))data.members[id]={events:v.events,entries:v.entries,days:v.days.size,activities:v.activities};
 const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='public-activity.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 alert('已下載公開活動統計。請將 public-activity.json 上傳覆蓋 GitHub EPCMAIN/activity-lookup/public-activity.json，會員網頁才會更新。');
}
function mount(){if(document.getElementById('epcExportPublicActivity'))return;
 const section=document.getElementById('events');if(!section)return;
 const btn=document.createElement('button');btn.id='epcExportPublicActivity';btn.type='button';btn.textContent='匯出會員活動查詢資料';btn.style.margin='8px 0 14px';btn.onclick=exportPublicActivity;
 const heading=section.querySelector('h2');heading?.after(btn);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();