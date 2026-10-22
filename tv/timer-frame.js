// Preview and paired screens share one timer page release.
export const TIMER_VIEW_VERSION='20261023-right-panel31';
export function timerProjectionUrl(eventId,base='../',revision=''){
 return base+'timer.html?eventId='+encodeURIComponent(String(eventId||''))+'&v='+TIMER_VIEW_VERSION+(revision?'&refresh='+encodeURIComponent(String(revision)):'');
}
// Preserve the live timer and its audio context when device metadata refreshes.
export function mountTimerFrame(target,eventId,revision=''){
 const id=String(eventId||''),refresh=String(revision||''),existing=target.firstElementChild;
 if(target.childElementCount===1&&existing?.tagName==='IFRAME'&&existing.dataset.timerEventId===id&&existing.dataset.timerRevision===refresh)return existing;
 const frame=document.createElement('iframe');frame.title='EPC 賽事計時器';frame.dataset.timerEventId=id;frame.dataset.timerRevision=refresh;
 frame.src=timerProjectionUrl(id,'../',refresh);
 frame.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;border:0;background:#000';
 target.replaceChildren(frame);return frame;
}
