import {readConfig} from '../player-free/config.js?v=5';
const requested=typeof location!=='undefined'&&new URLSearchParams(location.search).get('trial')==='1';
const firebase=requested?readConfig(localStorage):null;
// Free trial is explicitly selected per browser and never falls back to the live EPC project.
export const playerConfig={enabled:!!firebase,mode:'spark',firebase,region:'asia-east1',release:'player-free-v5'};
