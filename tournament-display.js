export function tournamentPayoutDisplay(event,amount,now=Date.now()){
 const plan=globalThis.EPCTournament.schedule(event,amount),pages=Math.max(1,Math.ceil(plan.rows.length/6)),page=Math.floor(now/8000)%pages;
 return {total:plan.total,text:(event.payoutSnapshot?.lockedAt?'正式獎金表':'報名中・預估獎金')+'｜'+plan.rows.length+' 個錢圈\n'+plan.rows.slice(page*6,(page+1)*6).map(r=>'第 '+r.rank+' 名： $'+Number(r.prize).toLocaleString()).join('\n')+(pages>1?'\n獎金表 '+(page+1)+' / '+pages:'')};
}
