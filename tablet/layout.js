(function(){
 'use strict';if(new URLSearchParams(location.search).get('layout')!=='tablet')return;
 document.documentElement.classList.add('epc-tablet');
 const link=document.createElement('link');link.rel='stylesheet';link.href='tablet/layout.css?v=45';document.head.append(link);
 function labelEventRows(){
  const body=document.getElementById('eventRows');if(!body)return;
  const labels=['營業日','場次','級別','玩家數','早鳥','晚鳥','重買數','總組數','獎池','JP','狀態','操作'];
  for(const tr of body.rows)Array.from(tr.cells).forEach((td,i)=>{if(labels[i])td.dataset.epcLabel=labels[i]});
 }
 function watchEventRows(){
  const body=document.getElementById('eventRows');if(!body)return;
  labelEventRows();
  new MutationObserver(labelEventRows).observe(body,{childList:true,subtree:false});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchEventRows,{once:true});else watchEventRows();
 function mount(){
  if(document.getElementById('tabletModes'))return;
  const nav=document.getElementById('nav'),header=document.querySelector('body>header'),bar=document.getElementById('epcTerminalModeBar');if(!nav||!header||!bar||!window.EPCMode)return;
  document.title='EPC 平板管理';
  const menu=document.createElement('button');menu.id='tabletMenu';menu.type='button';menu.textContent='☰ 功能選單';menu.setAttribute('data-mode-control','');menu.setAttribute('aria-controls','nav');menu.setAttribute('aria-expanded','false');header.prepend(menu);
  const title=document.createElement('span');title.id='tabletSection';title.textContent='總覽';header.append(title);
  const scrim=document.createElement('button');scrim.id='tabletMenuBackdrop';scrim.type='button';scrim.hidden=true;scrim.setAttribute('data-mode-control','');scrim.setAttribute('aria-label','關閉功能選單');document.body.append(scrim);
  function close(){document.documentElement.classList.remove('tablet-menu-open');menu.setAttribute('aria-expanded','false');scrim.hidden=true}
  menu.onclick=()=>{const open=document.documentElement.classList.toggle('tablet-menu-open');menu.setAttribute('aria-expanded',String(open));scrim.hidden=!open};scrim.onclick=close;
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  const modes=document.createElement('div');modes.id='tabletModes';modes.setAttribute('role','group');modes.setAttribute('aria-label','本機模式');
  for(const [value,label] of [['view','檢視'],['operate','操作']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.tabletMode=value;b.setAttribute('data-mode-control','');b.onclick=()=>{window.EPCMode.set(value);updateMode()};modes.append(b)}bar.prepend(modes);
  function updateMode(){const mode=window.EPCMode.get();modes.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tabletMode===mode)));header.dataset.mode=mode}
  window.EPCMode.on(updateMode);updateMode();
  const activePage=()=>{const active=nav.querySelector('button[data-page].active');if(active)title.textContent=active.textContent.trim()};activePage();
  new MutationObserver(changes=>{if(changes.some(c=>c.target.matches?.('button[data-page]'))){activePage();close()}}).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
 }
 if(document.getElementById('epcTerminalModeBar'))mount();else document.addEventListener('DOMContentLoaded',mount,{once:true});
})();
