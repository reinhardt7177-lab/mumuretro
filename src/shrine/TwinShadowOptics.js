// Own point-source geometry. Brightness is a teaching approximation, not radiometry.
import { hull,clip } from './ShadeProjection.js';
export const LAMP_SPREADS=Object.freeze([.35,.75,1.15]);
export function twinProfile(answers,lampZ){
  if(!Array.isArray(answers)||answers.length!==3)return null;
  const bands=[[8,9.2],[5.6,7],[2.8,3.8]].map(([lo,hi])=>answers.filter(z=>lampZ-z>=lo-1e-7&&lampZ-z<=hi+1e-7));
  if(bands.some(v=>v.length!==1))return null;
  return{positions:[bands[0][0],bands[1][0]],span:Math.round((lampZ-bands[2][0])*1000)%3};
}
export function twinTarget(answers,lampZ,wallZ,round,size=.9){
  const profile=twinProfile(answers,lampZ);if(!profile)return null;
  const scale=(lampZ-wallZ)/(lampZ-profile.positions[Math.min(round,1)]);
  return{size:size*scale,offset:round>0?LAMP_SPREADS[profile.span]*(scale-1):0,position:profile.positions[Math.min(round,1)],span:profile.span};
}
export function projectPanel(sourceX,lampZ,panelX,panelZ,panelY,screenZ,size=.9){
  const scale=(lampZ-screenZ)/(lampZ-panelZ);
  return{scale,x:sourceX+(panelX-sourceX)*scale,y:panelY,size:size*scale};
}
export function clipRectangle(x0,x1,y0,y1,bounds){
  x0=Math.max(bounds.x0,x0);x1=Math.min(bounds.x1,x1);y0=Math.max(bounds.y0,y0);y1=Math.min(bounds.y1,y1);
  return{x:(x0+x1)/2,y:(y0+y1)/2,width:Math.max(0,x1-x0),height:Math.max(0,y1-y0),visible:x1>x0&&y1>y0};
}
export function projectOpaqueBox(box,source,screenZ,bounds){
  const points=[];for(const x of[box.x0,box.x1])for(const y of[box.y0,box.y1])for(const z of[box.z0,box.z1]){
    const scale=(source.z-screenZ)/(source.z-z);points.push({x:source.x+(x-source.x)*scale,z:source.y+(y-source.y)*scale});
  }
  let polygon=hull(points);for(const[axis,edge,sign]of[['x',bounds.x0,1],['x',bounds.x1,-1],['z',bounds.y0,1],['z',bounds.y1,-1]])polygon=clip(polygon,axis,edge,sign);return polygon;
}
function halfPlane(points,a,b,inside){
  if(!points.length)return[];const dx=b.x-a.x,dz=b.z-a.z,value=p=>dx*(p.z-a.z)-dz*(p.x-a.x),out=[];
  for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length],vp=value(p),vq=value(q),inP=inside?vp>=0:vp<=0,inQ=inside?vq>=0:vq<=0;
    if(inP)out.push(p);if(inP!==inQ){const t=vp/(vp-vq);out.push({x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t});}
  }return out;
}
// Partition the stem outside the panel. One source must darken an overlap once.
export function subtractConvex(subject,mask){
  if(mask.length<3)return subject.length>=3?[subject]:[];const out=[];let remaining=subject;
  for(let i=0;i<mask.length&&remaining.length>=3;i++){const a=mask[i],b=mask[(i+1)%mask.length],outside=halfPlane(remaining,a,b,false);if(outside.length>=3)out.push(outside);remaining=halfPlane(remaining,a,b,true);}
  return out;
}
