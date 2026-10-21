// Preserve the live timer and its audio context when device metadata refreshes.
export function mountTimerFrame(target,eventId){
 const id=String(eventId||''),existing=target.firstElementChild;
 if(target.childElementCount===1&&existing?.tagName==='IFRAME'&&existing.dataset.timerEventId===id)return existing;
 const frame=document.createElement('iframe');frame.title='EPC 賽事計時器';frame.dataset.timerEventId=id;
 frame.src='../timer.html?eventId='+encodeURIComponent(id)+'&v=20261022-auto6';
 frame.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;border:0;background:#000';
 target.replaceChildren(frame);return frame;
}
