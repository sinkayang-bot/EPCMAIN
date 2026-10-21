// Explicit assignments survive legacy terminals updating payload/contentType.
export function effectiveDisplay(data){
 const assignment=data?.assignment;if(!assignment?.id||!assignment.payload)return data;
 const type=assignment.contentType;
 const useAssignment=type==='timer'||data.contentType!==type||data.payload?.type!==type;
 return {...data,contentType:type,rotateSeconds:assignment.rotateSeconds,payload:useAssignment?assignment.payload:data.payload};
}
