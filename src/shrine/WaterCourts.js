import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installStaticRaycastTree } from '../render/StaticRaycastTree.js';

let pending;
const meshes=root=>{const out=[];root.traverse(o=>{if(o.isMesh)out.push(o);});return out;};
function assets(){return pending??=fetch('assets/models/adventure/water-courts-v02.json').then(async response=>{if(!response.ok)return null;const spec=await response.json(),gltf=await new GLTFLoader().loadAsync(spec.model);return{spec,source:gltf.scene};}).catch(error=>{console.warn('[water-courts] original architecture retained',error);return null;});}

// The authored courts surround the current web apparatus. They never import the
// retired engine's puzzle layout, replace the water state or add save fields.
export function registerWaterCourts(room){
  if(!room.waterAdventure)return room;
  const record=room.waterCourts={loaded:false,models:[],cameraMeshes:[],colliders:[],courts:[],oldParts:[],ready:null};
  const resume=room.resume.bind(room);room.resume=actor=>{const result=resume(actor);record.actor=actor;record.reconcileActor?.();return result;};
  record.ready=Promise.all([assets(),room.ready]).then(([asset])=>{
    if(!asset){record.reason='optional asset unavailable';return false;}
    const {spec,source}=asset,parts={};source.updateMatrixWorld(true);
    if(spec.rooms?.length!==4){record.reason='room count';return false;}
    // Check every part and floor contract before hiding any original geometry.
    for(const item of spec.rooms){
      const seg=room.dungeon.rectOf(item.id);
      for(const name of [item.shell,item.floor,item.glacier]){const part=source.getObjectByName(name);if(!part){record.reason='missing part '+name;return false;}parts[name]=part;}
      const floor=new T.Box3().setFromObject(parts[item.floor],true),floorHeights=item.floorAreas?.map(v=>v.y),wanted=item.id==='r3'?[0,0,-5]:[0];
      if(!seg||Math.abs(seg.x1-seg.x0-item.width)>.001||Math.abs(seg.z1-seg.z0-item.length)>.001||Math.abs(floor.max.y)>.001||Math.abs(floor.min.y-item.foundationBottom)>.001||JSON.stringify(floorHeights)!==JSON.stringify(wanted)||!Array.isArray(item.solids)||!item.solids.length||item.solids.some(v=>[...v.position,...v.size].some(n=>!Number.isFinite(n))||v.size.some(n=>n<=0))){record.reason='floor or spatial contract';return false;}
    }
    const courts=[];
    for(const item of spec.rooms){
      const seg=room.dungeon.rectOf(item.id),cz=(seg.z0+seg.z1)/2,court={item,seg,cz,models:[],cameraMeshes:[],colliders:[]};
      for(const name of [item.shell,item.floor,item.glacier]){
        const root=parts[name].clone(true);root.position.set(0,0,cz);root.name='Water courts '+name;court.models.push(root);
        for(const m of meshes(root)){
          m.material=m.material.clone();m.material.envMapIntensity=.50;m.material.userData.outlineParameters={visible:false};m.receiveShadow=true;m.castShadow=name===item.shell&&!/brass|enamel/i.test(m.material.name);m.userData.waterCourts=true;
          if(name!==item.floor){m.updateWorldMatrix(true,false);installStaticRaycastTree(m);court.cameraMeshes.push(m);}
        }
      }
      for(const source of item.solids){const[x,y,z]=source.position,[w,h,d]=source.size,perimeter=Math.abs(x)>item.width/2-1;court.colliders.push({shape:'box',x,z:z+cz,r:Math.hypot(w,d)/2+.28,x0:x-w/2,x1:x+w/2,z0:z+cz-d/2,z1:z+cz+d/2,minY:y-h/2,maxY:y+h/2,padding:.28,escapeX:perimeter?-Math.sign(x):0,escapeZ:perimeter?0:-Math.sign(z),waterCourts:true,source});}
      courts.push(court);
    }
    record.courts=courts;record.models=courts.flatMap(v=>v.models);record.cameraMeshes=courts.flatMap(v=>v.cameraMeshes);record.colliders=courts.flatMap(v=>v.colliders);record.oldParts=spec.rooms.flatMap(v=>room.dungeon.artSlots[v.id]);
    for(const root of record.models)room.scene.add(root);
    for(const o of record.oldParts)o.visible=false;
    const oldMeshes=new Set(record.oldParts.flatMap(meshes)),occluders=room.dungeon.occluders;
    occluders.splice(0,occluders.length,...occluders.filter(m=>!oldMeshes.has(m)),...record.cameraMeshes);
    room.obstacles.push(...record.colliders);
    const rects=room.dungeon.rects;rects.cameraSubjectZones=[...(rects.cameraSubjectZones||[]),...courts.map(v=>({...v.seg,halfWidth:.22,pitchAssist:.32,minRetreat:2.2,yawAssist:.8,smoothOcclusion:true}))];
    record.reconcileActor=()=>{const actor=record.actor;if(actor?.rects!==rects)return;const before=actor.position.clone();actor._pushOut(actor.position);if(actor.position.distanceTo(before)>1e-6){actor.syncMesh();actor._camPlaced=false;record.safeShift=actor.position.distanceTo(before);}};
    record.spec=spec;record.loaded=true;record.reconcileActor();return true;
  }).catch(error=>{record.reason=error.message;console.warn('[water-courts] original architecture retained',error);return false;});
  room.ready=Promise.all([room.ready,record.ready]);return room;
}
