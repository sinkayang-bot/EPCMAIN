/* EPC 幸運加乘 — isolated, deterministic scoring core. No writes to event or accounting data. */
(function(root){
 'use strict';
 const n=v=>Number.isFinite(Number(v))?Number(v):0;
 const date=e=>String(e.businessDate||e.date||'').slice(0,10);
 const id=e=>String(e.eventId||e.id||'');
 const member=p=>String(p.memberId||p.id||p.memberKey||'').trim();
 const weekend=d=>{const x=new Date(d+'T12:00:00Z').getUTCDay();return x===0||x===6};
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'));
 function score(events,period,opts={}){
  const from=period?.from||'',to=period?.to||'';
  if(!validDate(from)||!validDate(to)||from>to)throw Error('INVALID_PERIOD');
  const excluded=new Set((opts.excludedEventIds||[]).map(String));
  const uniqueEvents=new Map();for(const e of (events||[])){if(!e||e.deleted||e.status==='deleted'||date(e)<from||date(e)>to||excluded.has(id(e))||!id(e))continue;if(!uniqueEvents.has(id(e)))uniqueEvents.set(id(e),e);}const all=[...uniqueEvents.values()];
  const byDate=new Map();
  for(const e of all){const d=date(e);if(!byDate.has(d))byDate.set(d,[]);byDate.get(d).push(e)}
  const result=new Map(),seen=new Set();
  for(const [d,dayEvents] of byDate){
   dayEvents.sort((a,b)=>(Number(a.seq||0)&&Number(b.seq||0)?Number(a.seq)-Number(b.seq):0)||String(a.startTime||'').localeCompare(String(b.startTime||''))||id(a).localeCompare(id(b)));
   dayEvents.forEach((e,i)=>{
    const sequence=i+1;
    const players=e.players||[];
    for(const p of players){
     const mid=member(p),key=id(e)+'|'+mid;
     if(!mid||seen.has(key)||p.deleted||p.status==='deleted')continue;
     seen.add(key);
     // Participation is one per member per event. Rebuys/entries never increase points.
     const points=sequence+(sequence===1?2:0)+(weekend(d)?1:0);
     const row=result.get(mid)||{memberId:mid,points:0,games:0,details:[]};
     row.points+=points;row.games++;row.details.push({date:d,eventId:id(e),sequence,points});
     result.set(mid,row);
    }
   });
  }
  return [...result.values()].sort((a,b)=>b.points-a.points||a.memberId.localeCompare(b.memberId));
 }
 function periods(year,month){
  const y=Number(year),m=Number(month);
  if(!Number.isInteger(y)||!Number.isInteger(m)||m<1||m>12)throw Error('INVALID_MONTH');
  const prefix=y+'-'+String(m).padStart(2,'0')+'-';
  const last=new Date(Date.UTC(y,m,0)).getUTCDate();
  return [{from:prefix+'01',to:prefix+'15'},{from:prefix+'16',to:prefix+String(last).padStart(2,'0')}];
 }
 function eligible(row){return {forty:row.points>=40,sixty:row.points>=60};}
 root.EPCLuckyMultiplier={score,periods,eligible};
})(typeof window!=='undefined'?window:globalThis);
