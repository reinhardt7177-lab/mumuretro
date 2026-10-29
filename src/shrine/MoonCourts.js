import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installStaticRaycastTree } from '../render/StaticRaycastTree.js';

let pending;
const meshes=root=>{const a=[];root.traverse(o=>{if(o.isMesh)a.push(o);});return a;};
function assets(){return pending??=fetch('assets/models/adventure/moon-courts-v03.json').then(async r=>{if(!r.ok)return null;const spec=await r.json(),gltf=await new GLTFLoader().loadAsync(spec.model);return{spec,source:gltf.scene};}).catch(e=>{console.warn('[moon-courts] original courts retained',e);return null;});}

export function registerMoonCourts(room){
  if(room.spec.id!=='shadow')return room;
  const record=room.moonCourts={loaded:false,models:[],cameraMeshes:[],colliders:[],courts:[],ready:null};
  const resume=room.resume.bind(room);room.resume=a=>{const result=resume(a);record.actor=a;record.reconcileActor?.();return result;};
  record.ready=Promise.all([assets(),room.ready]).then(([asset])=>{
    if(!asset){record.reason='optional asset unavailable';return false;}
    const{source,spec}=asset,courts=[room.shadeCourt,room.gallery,room.silhouetteCourt],rects=room.dungeon.rects,parts={};source.updateMatrixWorld(true);
    if(spec.rooms.length!==3){record.reason='room count';return false;}
    for(const item of spec.rooms){
      for(const name of[item.shell,item.floor]){const part=source.getObjectByName(name);if(!part){record.reason='missing part '+name;return false;}parts[name]=part;}
      const s=room.gates[item.index].gate.seg,box=new T.Box3().setFromObject(parts[item.floor],true);
      if(Math.abs(box.min.y+.2)>.001||Math.abs(box.max.y)>.001||Math.abs(s.x1-s.x0-item.width)>.001||Math.abs(s.z1-s.z0-item.length)>.001||!Array.isArray(item.solids)||!item.solids.length||item.solids.some(v=>[...v.position,...v.size].some(n=>!Number.isFinite(n))||v.size.some(n=>n<=0))){record.reason='floor or spatial contract';return false;}
    }
    const old=new Set();
    for(const item of spec.rooms){
      const court=courts[item.index],seg=room.gates[item.index].gate.seg,cz=(seg.z0+seg.z1)/2,slot={item,court,seg,cz,models:[],cameraMeshes:[],colliders:[]};
      for(const name of[item.shell,item.floor]){
        const root=parts[name].clone(true);root.position.set(0,0,cz);root.name='Moon courts '+name;court.group.add(root);record.models.push(root);slot.models.push(root);
        for(const m of meshes(root)){
          m.castShadow=false;m.receiveShadow=false;
          if(name===item.floor&&item.index===0&&m.material.name==='Courts floor')m.material=new T.MeshBasicMaterial({name:'Shade unlit paving',color:m.material.color,map:m.material.map,side:T.DoubleSide});
          else{m.material=m.material.clone();m.material.envMapIntensity=.45;m.material.emissive.copy(m.material.color);m.material.emissiveIntensity=.10;}
          m.material.userData.outlineParameters={visible:false};
          if(name===item.shell){m.updateWorldMatrix(true,false);installStaticRaycastTree(m);slot.cameraMeshes.push(m);record.cameraMeshes.push(m);}
        }
      }
      for(const o of[...court.artSlots.floor,...court.artSlots.structure])old.add(o);
      for(const v of item.solids){
        const[x,y,z]=v.position,[w,h,d]=v.size,o={shape:'box',x,z:z+cz,r:Math.hypot(w,d)/2+.28,x0:x-w/2,x1:x+w/2,z0:cz+z-d/2,z1:cz+z+d/2,minY:y-h/2,maxY:y+h/2,padding:.28,escapeX:Math.abs(x)>item.width/2-1?-Math.sign(x):0,escapeZ:Math.abs(x)<item.width/2-1?-Math.sign(z):0,moonCourts:true};
        slot.colliders.push(o);record.colliders.push(o);room.obstacles.push(o);court.obstacles.push(o);
      }
      record.courts.push(slot);
    }
    // Keep dynamic rails, optical pillars, mirrors, screen, warning patches,
    // witness signs and door veils; replace only tagged old construction.
    for(const o of room.scene.children)if(spec.rooms.some(v=>room.gates[v.index].gate.seg.id===o.userData.slabRim)||Object.keys(room.dungeon.doors).some(id=>id===o.userData.doorFrame))old.add(o);
    record.oldParts=[...old];record.oldParts.forEach(o=>o.visible=false);
    const oldMeshes=new Set(record.oldParts.flatMap(meshes));record.oldMeshes=[...oldMeshes];
    rects.cameraOccluders=(rects.cameraOccluders||[]).filter(m=>!oldMeshes.has(m));rects.cameraOccluders.push(...record.cameraMeshes);
    for(const slot of record.courts){const list=slot.court.cameraOccluders;list.splice(0,list.length,...list.filter(m=>!oldMeshes.has(m)),...slot.cameraMeshes);}
    const ids=new Set(record.courts.map(v=>v.seg.id));
    rects.cameraSubjectZones=[...(rects.cameraSubjectZones||[]).filter(v=>!ids.has(v.id)),...record.courts.map(v=>({...v.seg,halfWidth:.22,pitchAssist:.42,smoothOcclusion:true}))];
    record.reconcileActor=()=>{const a=record.actor;if(a?.rects!==rects)return;const before=a.position.clone();a._pushOut(a.position);if(a.position.distanceTo(before)>1e-6){a.syncMesh();a._camPlaced=false;record.safeShift=a.position.distanceTo(before);}};
    record.loaded=true;record.spec=spec;record.reconcileActor();return true;
  });room.ready=Promise.all([room.ready,record.ready]);return room;
}
