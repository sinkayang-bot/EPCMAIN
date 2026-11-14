(function(root){
'use strict';
root.installLuckyPrizePicker=function(select,onSelect){
 const button=document.createElement('button'),panel=document.createElement('div'),title=document.createElement('h2'),list=document.createElement('div'),close=document.createElement('button');
 button.id='prizeChoose';button.type='button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
 panel.id='prizePicker';panel.hidden=true;panel.className='prize-picker';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');title.textContent='選擇要抽的獎項';close.textContent='返回';close.type='button';panel.append(title,list,close);document.body.append(panel);select.after(button);select.hidden=true;
 let choices=[];
 function hide(){panel.hidden=true;button.setAttribute('aria-expanded','false');button.focus()}
 function refresh(){button.disabled=select.disabled||!select.options.length;button.textContent=(select.selectedOptions[0]?.textContent||'選擇獎項')+' ▾';if(!panel.hidden&&button.disabled)hide()}
 function open(){if(button.disabled)return;list.replaceChildren();choices=[...select.options].map(o=>{const b=document.createElement('button');b.type='button';b.textContent=o.textContent;b.setAttribute('aria-pressed',String(o.value===select.value));b.onclick=()=>{select.value=o.value;onSelect();refresh();hide()};list.append(b);return b});panel.hidden=false;button.setAttribute('aria-expanded','true');(choices[select.selectedIndex]||choices[0]||close).focus()}
 button.onclick=open;close.onclick=hide;
 function key(key,prevent){if(!panel.hidden){if(['Escape','Backspace','BrowserBack','GoBack'].includes(key)){prevent();hide();return}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(key)){prevent();const all=[...choices,close],i=all.indexOf(document.activeElement),d=['ArrowUp','ArrowLeft'].includes(key)?-1:1;all[(i+d+all.length)%all.length].focus();return}if(key==='Enter'){prevent();document.activeElement?.click();return}}
 else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(key)){if(document.activeElement?.closest?.('input,textarea,select')&&!select.hidden)return;const draw=document.getElementById('draw');const active=document.activeElement;if(active!==button&&active!==draw&&active?.tagName==='BUTTON')return;prevent();if(key==='Enter'){if(active===draw)draw.click();else open()}else{(active===button&&!draw.disabled?draw:button).focus()}}}
 const normalize=e=>({4:'BrowserBack',23:'Enter',13:'Enter',38:'ArrowUp',40:'ArrowDown',37:'ArrowLeft',39:'ArrowRight',27:'Escape',10009:'BrowserBack',461:'BrowserBack'})[e.keyCode]||(['OK','Select','Accept'].includes(e.key)?'Enter':e.key);
 document.addEventListener('keydown',e=>key(normalize(e),()=>{e.preventDefault();e.stopPropagation()}),true);
 root.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='epc-lucky-remote-key')key(e.data.key,()=>{})});refresh();return {refresh};
};
})(window);
