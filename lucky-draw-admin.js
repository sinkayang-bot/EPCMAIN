(function(){
'use strict';let service,busy=false;
async function cloud(){if(!service)service=await (await import('./lucky-draw-cloud.js?v=20261115-draw3')).luckyDrawCloud();return service}
function check(){window.EPCMode?.assertWrite();if(!window.EPC_ACTIVITY_LOADED)throw Error('請等待活動資料載入');}
function period(){const c=db.activityManagement.luckyMultiplier||{};if(!c.from||!c.to)throw Error('請先設定本期活動日期');return c.from+'_'+c.to}
window.luckyDrawAction_=async function(kind,value,id){check();if(busy)throw Error('上一筆抽選仍在儲存中');if(id!==period())throw Error('活動期間已變更，請重新開啟抽選');busy=true;try{const c=await cloud();if(kind==='settingsRead'){const s=await c.read(id);return {prizes:s.prizes,weights:s.people.map(p=>({memberId:p.memberId,weight:p.weight})),revision:s.settingsRevision||0}}const resetId=kind==='reset'?crypto.randomUUID():null;const u=crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
 return await c.update(id,old=>{if(!old)throw Error('請先準備抽選名單');if(kind==='draw')return EPCLuckyDraw.draw(old,value,u);
 if(kind==='reset')return EPCLuckyDraw.reset(old,value.expectedRevision,resetId);
 if(kind==='settings')return EPCLuckyDraw.settings(old,value);
 throw Error('不支援的操作')});}finally{busy=false}};
window.luckyOpenDraw_=async function(){try{check();const id=period(),c=await cloud();await c.update(id,old=>{if(old?.results.length)return old;const entries=luckyDrawRows_();if(!entries.length)throw Error('本期尚無參加名單');const people=entries.map(p=>({memberId:p.memberId,name:epcPlayerDisplayName_(p.memberId),memberNumber:String(memberNumber_(p.memberId)),points:p.points,weight:old?.people.find(x=>x.memberId===p.memberId)?.weight??p.points}));return {...old,period:id,revision:(old?.revision||0)+1,people,prizes:old?.prizes||[],results:[],active:null}});
 let page=document.getElementById('luckyDraw');if(!page){page=document.createElement('section');page.id='luckyDraw';page.className='page';page.innerHTML='<button onclick="showPage(\'activities\')">← 返回活動</button><iframe id="luckyDrawFrame" title="幸運加乘抽選操作" style="width:100%;height:90vh;border:0"></iframe>';document.querySelector('main').append(page)}document.getElementById('luckyDrawFrame').src='lucky-draw.html?v=20261115-draw6&operator=1&period='+encodeURIComponent(id);showPage('luckyDraw');
 }catch(e){alert(e.message)}};
})();
