import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let kit=null;
export async function loadAdventureScenery(){
  try{kit=(await new GLTFLoader().loadAsync('assets/models/adventure/granite-kit-v02.glb')).scene;}
  catch(error){console.warn('[adventure] Granite kit unavailable:',error.message);}
}

function convexHull(points){
  const sorted=points.map(p=>[p.x,p.z]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const unique=sorted.filter((p,i)=>!i||Math.hypot(p[0]-sorted[i-1][0],p[1]-sorted[i-1][1])>1e-5);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=list=>{const h=[];for(const p of list){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}return h.slice(0,-1);};
  return [...half(unique),...half(unique.slice().reverse())];
}

// The reference route is a calibration slice, not the whole planet redesign.
// All placements are derived from the existing route and preserve its save coordinates.
export function buildAdventureScenery(scene,planet,plan,carpet,exclude){
  const group=new THREE.Group();group.name='adventure-granite-v02';scene.add(group);
  const sources=[];
  if(kit){kit.updateMatrixWorld(true);for(let i=0;i<3;i++){
    const object=kit.getObjectByName('granite_'+i);if(!object?.isMesh)continue;
    const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const vertices=Array.from({length:geometry.attributes.position.count},(_,j)=>new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,j));
    const material=object.material;material.userData.outlineParameters={visible:false};
    sources.push({geometry,material,vertices,hull:convexHull(vertices),box:geometry.boundingBox.clone(),radius:Math.max(...vertices.map(v=>Math.hypot(v.x,v.z)))});
  }}
  const items=[],meshes=[],bins=sources.map(()=>[]),baseY=new THREE.Vector3(0,1,0);
  let enabled=true;
  const nearestPath=d=>Math.acos(Math.min(1,Math.max(...plan.samples.map(p=>p.dot(d)))))*planet.R;
  const clearanceAt=d=>Math.min(planet.R*d.angleTo(plan.overlook)-5.5,planet.R*d.angleTo(plan.waterway)-16);
  const candidates=plan.routes.flatMap((route,ri)=>route.dirs.slice(1).flatMap((b,si)=>{
    const a=route.dirs[si],length=a.angleTo(b)*planet.R;
    return Array.from({length:Math.max(1,Math.floor(length/2.8))},(_,j)=>({d:a.clone().lerp(b,(j+.55)/Math.max(1,Math.floor(length/2.8))).normalize(),a,b,ri,si,j}));
  }));
  const edges=candidates.flatMap(c=>[-1,1].flatMap(sign=>[0,1,2].map(band=>({...c,sign,band}))));
  for(let n=0;n<edges.length&&sources.length&&items.length<24;n++){
    const c=edges[n],variant=n%3,source=sources[variant];
    const side=c.a.clone().cross(c.b).normalize();
    const d=c.d.clone().addScaledVector(side,c.sign*(source.radius+2.05+c.band*2.2)/planet.R).normalize();
    if(nearestPath(d)-source.radius<1.65||clearanceAt(d)<source.radius||exclude(d,source.radius))continue;
    if(items.some(it=>it.dir.angleTo(d)*planet.R<it.radius+source.radius+1))continue;
    const p=planet.surfaceAt(d).addScaledVector(d,carpet.liftAt(d));
    const radial=d.clone(),east=new THREE.Vector3(0,1,0).cross(d).normalize(),north=d.clone().cross(east).normalize();
    const pe=planet.surfaceAt(d.clone().addScaledVector(east,.25/planet.R).normalize()).sub(planet.surfaceAt(d));
    const pn=planet.surfaceAt(d.clone().addScaledVector(north,.25/planet.R).normalize()).sub(planet.surfaceAt(d));
    const normal=pe.clone().cross(pn).normalize();if(normal.dot(radial)<0)normal.negate();
    const x=east.clone().addScaledVector(normal,-east.dot(normal)).normalize(),z=x.clone().cross(normal).normalize();
    const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,normal,z));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(baseY,n*2.39996));
    // Seat the full authored bottom contour in the actual terrain, not a flat proxy.
    let maxGap=-Infinity,minGap=Infinity;
    for(const v of source.vertices)if(v.y<.025){const w=v.clone().applyQuaternion(q).add(p),up=w.clone().normalize(),ground=planet.surfaceAt(up).length()+carpet.liftAt(up),gap=w.length()-ground;maxGap=Math.max(maxGap,gap);minGap=Math.min(minGap,gap);}
    const sink=(maxGap+.015)/Math.max(.1,normal.dot(radial));p.addScaledVector(normal,-sink);
    const matrix=new THREE.Matrix4().compose(p,q,new THREE.Vector3(1,1,1));
    const item={dir:d,position:p,quaternion:q,inverse:matrix.clone().invert(),matrix,variant,radius:source.radius,height:source.box.max.y,hull:source.hull,pathClearance:nearestPath(d)-source.radius,seating:{maxGap:maxGap-sink*normal.dot(radial),minGap:minGap-sink*normal.dot(radial)}};
    items.push(item);bins[variant].push(item);
  }
  bins.forEach((list,i)=>{if(!list.length)return;const source=sources[i],mesh=new THREE.InstancedMesh(source.geometry,source.material,list.length);mesh.name='adventure-granite-'+i;mesh.castShadow=mesh.receiveShadow=true;list.forEach((it,j)=>mesh.setMatrixAt(j,it.matrix));mesh.computeBoundingSphere();group.add(mesh);meshes.push(mesh);});
  const local=new THREE.Vector3(),world=new THREE.Vector3(),up=new THREE.Vector3();
  function resolve(position,radius=.32,footHeight=0){
    if(!enabled)return 0;let hits=0;
    for(const it of items){if(position.distanceToSquared(it.position)>Math.pow(it.radius+2,2)||footHeight>it.height+.1)continue;
      up.copy(position).normalize();local.copy(position).addScaledVector(up,footHeight).applyMatrix4(it.inverse);
      if(local.y>it.height+.1)continue;
      let inside=true,best=Infinity,nx=0,nz=0,cx=0,cz=0;
      for(let i=0;i<it.hull.length;i++){const a=it.hull[i],b=it.hull[(i+1)%it.hull.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
        const signed=((local.x-a[0])*dz-(local.z-a[1])*dx)/len;if(signed>0)inside=false;
        const t=THREE.MathUtils.clamp(((local.x-a[0])*dx+(local.z-a[1])*dz)/(len*len),0,1),x=a[0]+t*dx,z=a[1]+t*dz,dist=Math.hypot(local.x-x,local.z-z);
        if(dist<best){best=dist;cx=x;cz=z;nx=dz/len;nz=-dx/len;}
      }
      if(!inside&&best>=radius)continue;
      if(!inside&&best>.00001){nx=(local.x-cx)/best;nz=(local.z-cz)/best;}
      local.x=cx+nx*(radius+.005);local.z=cz+nz*(radius+.005);
      world.copy(local).applyMatrix4(it.matrix);position.copy(world);planet.projectToSurface(position);hits++;
    }
    return hits;
  }
  return{group,items,meshes,sources,resolve,collision:{get enabled(){return enabled;},set enabled(value){enabled=!!value;}},get count(){return items.length;}};
}
