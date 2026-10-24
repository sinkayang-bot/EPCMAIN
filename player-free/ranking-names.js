// Public names come only from the consent directory; staff can further hide them.
export function resolveActivityNames(activities,names){return activities.map(a=>({...a,entries:(a.entries||[]).map(r=>({...r,displayName:a.nameMode==='anonymous'||r.hideName===true?'匿名玩家':names.get(r.key)||'匿名玩家'}))}))}
export function anonymousMembers(value){return [...new Set(String(value||'').split(/[\s,，、]+/).map(s=>s.trim()).filter(Boolean))].slice(0,300)}
