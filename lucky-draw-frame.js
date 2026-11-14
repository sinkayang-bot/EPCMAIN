export function mountLuckyDrawFrame(target,period){
 const key=String(period||''),old=target.firstElementChild;
 if(target.childElementCount===1&&old?.tagName==='IFRAME'&&old.dataset.luckyDrawPeriod===key)return old;
 const frame=document.createElement('iframe');frame.title='幸運加乘抽選投影';frame.dataset.luckyDrawPeriod=key;frame.src='../lucky-draw.html?v=20261115-draw12&period='+encodeURIComponent(key);frame.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;border:0;background:#080a0f';target.replaceChildren(frame);return frame;
}
