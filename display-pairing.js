// Pairing URLs carry only the existing single-use, ten-minute code in the fragment.
export function pairingUrl(code,base){
 if(!/^\d{6}$/.test(String(code)))throw Error('無效配對碼');
 const url=new URL('../',base);url.hash='pair='+code;return url.href;
}
export function pairingCode(hash){const code=new URLSearchParams(String(hash).replace(/^#/, '')).get('pair');return /^\d{6}$/.test(code||'')?code:null}
export function pairingMarkup(code,base){
 const url=pairingUrl(code,base),qr=globalThis.qrcode(0,'M');qr.addData(url);qr.make();
 return `<div class="center pairing-screen"><img class="epc-brand-logo" src="../assets/epc-brand.png?v=20261024-brand46" alt="EPC 原版 LOGO" width="220" height="112"><h1>顯示設備配對</h1><p>手機掃描 QR Code，直接連接這台電視</p><a class="pairing-qr" href="${url}" aria-label="手機掃碼配對這台電視">${qr.createSvgTag({cellSize:6,margin:24,scalable:true})}</a><p>也可在後臺輸入配對碼</p><div class="code">${code}</div><p class="muted">配對碼有效 10 分鐘；到期請重新整理</p></div>`;
}
