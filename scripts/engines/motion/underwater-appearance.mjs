export function underwaterPose(depth, opacity=.35){
 const p=Math.min(1,Math.max(0,Number(depth)||0)),raw=Number(opacity);
 const alpha=Number.isFinite(raw)?Math.min(1,Math.max(.1,raw)):.35;
 return {alpha:1-p*p*(1-alpha),scale:1};
}
// Multiply a water-blue tint into the native tint. Never accumulate it, and
// restore only our own last write so another module's new tint is preserved.
export function underwaterTint(mesh,depth,record=null){
 if(!mesh||mesh.destroyed)return null;
 const current=Number(mesh.tint??0xffffff),base=record&&current===record.set?record.base:current;
 const p=Math.min(1,Math.max(0,Number(depth)||0));
 if(!p){if(record&&current===record.set)mesh.tint=record.base;return null;}
 const r=Math.round(((base>>16)&255)*(1-.42*p)),g=Math.round(((base>>8)&255)*(1-.2*p)),b=base&255;
 const set=(r<<16)|(g<<8)|b;mesh.tint=set;return {base,set};
}
