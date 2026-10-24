const ended=new Set(['settled','已結算','deleted','已刪除','cancelled','已取消']);
// An empty/stale local snapshot alone must never remove a published tournament.
export async function retiredEventIds(oldIds,currentIds,getEvent){const retired=[];for(const id of oldIds){if(currentIds.has(id))continue;const event=await getEvent(id);if(!event||ended.has(event.status))retired.push(id)}return retired}
