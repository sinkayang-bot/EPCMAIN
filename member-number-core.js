/* Editable member numbers never replace immutable record/payment identifiers. */
(function(root){
'use strict';
const clean=x=>String(x??'').trim().toUpperCase();
const key=x=>String(x&&typeof x==='object'?(x.id||x.memberId||''):x??'');
function number(x,map={}){const id=key(x);return clean(map[id]?.number||id)}
function resolve(value,map={},members=[]){const v=clean(value);const match=Object.keys(map).find(id=>number(id,map)===v);return match||String(members.find(m=>clean(key(m))===v)?.id||members.find(m=>clean(key(m))===v)?.memberId||'')}
function assign(map,memberId,value,members=[]){
 const id=String(memberId),v=clean(value);if(!/^[A-Z0-9_-]{1,32}$/.test(v))throw Error('會員編號限 1～32 位英文字母、數字、底線或連字號');
 for(const m of members){if(key(m)!==id&&[clean(key(m)),number(m,map)].includes(v))throw Error('此會員編號已被使用');}
 for(const [other,r] of Object.entries(map||{}))if(other!==id&&[clean(other),clean(r.number)].includes(v))throw Error('此會員編號已被使用或保留');
 return {...map,[id]:{number:v}};
}
root.EPCMemberNumbers={number,resolve,assign};
})(typeof window==='undefined'?globalThis:window);
