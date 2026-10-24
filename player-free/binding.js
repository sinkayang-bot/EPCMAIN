// A QR code carries only a short-lived binding code; staff must still approve the member.
export function bindingLink(code,project,base=location.href){
 if(!/^\d{6}$/.test(String(code))||!/^epc-player-[a-z0-9-]{4,19}$/.test(project))throw Error('綁定資料不正確');
 const url=new URL('../player-admin/?trial=1',base);url.hash=new URLSearchParams({bind:String(code),project}).toString();return url.href;
}
export function parseBinding(value,project,base=location.href){
 const url=new URL(String(value),base),expected=new URL('../player-admin/',base);
 if(url.origin!==expected.origin||url.pathname!==expected.pathname||url.username||url.password)throw Error('這不是 EPC 玩家綁定 QR Code');
 const hash=new URLSearchParams(url.hash.slice(1)),code=hash.get('bind');
 if(hash.getAll('bind').length!==1||hash.getAll('project').length!==1||!/^\d{6}$/.test(code||''))throw Error('綁定碼格式不正確');
 if(hash.get('project')!==project)throw Error('QR Code 屬於其他專案，請確認玩家與櫃台使用相同設定');
 return code;
}
export function memberFromRows(rows,input){
 const id=String(input||'').trim().toUpperCase();if(!id||id.length>100)throw Error('請輸入會員編號');
 const found=rows.filter(m=>String(m.memberId||'').trim().toUpperCase()===id);
 if(found.length!==1)throw Error(found.length?'會員編號重複，請先在原後台確認':'找不到此會員編號，請確認原系統的會員資料');
 const m=found[0];if(m.status==='inactive'||m.deleted||m.deletedAt)throw Error('此會員已停用');
 const nickname=String(m.nickname||m.name||'').trim();if(!nickname)throw Error('此會員沒有可顯示的姓名或綽號');
 return {memberId:String(m.memberId).trim(),nickname:nickname.slice(0,100)};
}
