import {memberFromRows} from './binding.js?v=6';
// Staff-only caller: the existing member.list action is read-only. Never persist or publish its roster.
const SOURCE='https://script.google.com/macros/s/AKfycbwZi5bXuFJdtXiE6oxPmn4NZti-wZyOwEfTKZ8VPo5nXP5GK1mPOYrfkxz714AN4UQx9w/exec';
export async function lookupSourceMember(memberId,request=fetch){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{const response=await request(SOURCE,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'member.list'}),signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('會員來源連線失敗，請重試');const result=await response.json();if(!result.ok||!Array.isArray(result.members))throw Error('會員來源尚未就緒，請重試');return memberFromRows(result.members,memberId)}
 catch(e){if(e.name==='AbortError')throw Error('會員查詢逾時，請重試');throw e}finally{clearTimeout(timer)}
}
