import {ACTIVITY_KINDS,publicActivity} from '../player-server/activities.js';
export const activityTitles={rank:'週排行榜',hunter:'獵人排行榜',umbrella:'保護傘',extremeTen:'極限 10 秒'};
export function validRange(r){return /^\d{4}-\d{2}-\d{2}$/.test(r?.from||'')&&/^\d{4}-\d{2}-\d{2}$/.test(r?.to||'')&&r.from<=r.to}
export function publicationSettings(saved,ranges,selected){return Object.fromEntries(ACTIVITY_KINDS.map(k=>{const enabled=!!selected[k];if(enabled&&!validRange(ranges?.[k]))throw Error(activityTitles[k]+'尚未設定正確活動區間，請到原後台設定');return [k,{...(saved[k]||{}),enabled,subtitle:saved[k]?.subtitle||'',rules:saved[k]?.rules?.length?saved[k].rules:['活動辦法依 EPC 現場公告；成績採後台登記資料。']}]}))}
export function planActivities(settings,ranges,ranked,identities,today){return ACTIVITY_KINDS.map(kind=>({kind,data:publicActivity(kind,settings[kind],ranges?.[kind],ranked[kind]||[],identities,today)}))}
