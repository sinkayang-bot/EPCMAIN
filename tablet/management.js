(function(){
'use strict';const params=new URLSearchParams(location.search);if(params.get('tabletTools')!=='1'||parent===window)return;
 document.documentElement.classList.add('epc-tablet-tools');const css=document.createElement('link');css.rel='stylesheet';css.href='tablet/management.css?v=20261115-tablet2';document.head.append(css);
 const allowed=new Set(['dashboard','members','events','event','settle','eventreport','accounting','dailysettle','playerpayments','timers','activities','displays']);let active=true,pending=false;
 function tell(type,extra={}){parent.postMessage({type,...extra},location.origin)}
 function refresh(){if(active&&!document.hidden&&pending){pending=false;window.render?.()}}
 function navigate(message){if(!allowed.has(message.page))return;active=message.active!==false;if(!active)return;try{if(['event','settle'].includes(message.page)&&message.eventId){const event=typeof db!=='undefined'&&db.events?.find(e=>String(e.id)===String(message.eventId));if(event)window.openEvent(message.eventId);else{window.showPage('events');tell('epc-tablet-admin-error',{message:'請先選取本場賽事，再開啟設定或結算。'});return}}window.showPage(message.page);pending=false}catch(e){tell('epc-tablet-admin-error',{message:'管理功能載入失敗：'+e.message})}}
 function mount(){
 for(const key of ['render','renderEventFast_','renderActivities']){const original=window[key];if(typeof original!=='function')continue;window[key]=function(...args){if(!active||document.hidden){pending=true;return}return original.apply(this,args)}}
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='epc-tablet-admin-page')navigate(e.data);if(e.data?.type==='epc-tablet-admin-visibility'){active=e.data.active===true;refresh()}});
 document.addEventListener('visibilitychange',refresh);
 navigate({page:params.get('page')||'events',active:true});tell('epc-tablet-admin-ready');
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
