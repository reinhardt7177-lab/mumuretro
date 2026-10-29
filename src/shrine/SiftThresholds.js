import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';
let pending;
function assets(){return pending??=fetch('assets/models/adventure/sift-thresholds-v01.json').then(async r=>{if(!r.ok)throw Error('Missing sift threshold manifest');const spec=await r.json(),source=(await new GLTFLoader().loadAsync(spec.model)).scene,parts=Object.fromEntries(spec.parts.map(name=>[name,source.getObjectByName(name)]));if(Object.values(parts).some(p=>!p))throw Error('Missing sift threshold part');return{spec,parts};}).catch(error=>{console.warn('[sift-thresholds] original doors retained',error);return null;});}
export function registerSiftThresholds(room){
 if(room.spec.id!=='sift')return room;
 const r=room.siftThresholds={loaded:false,doors:[],cameraMeshes:[],colliders:[],batches:[],dynamicBatches:[],actor:null};
 const resume=room.resume.bind(room);room.resume=actor=>{r.actor=actor;const value=resume(actor);r.reconcile?.();return value;};
 const arch=room.updateArchitecture?.bind(room);room.updateArchitecture=(dt,actor)=>{arch?.(dt,actor);r.actor=actor;};
 r.ready=Promise.all([room.ready,assets()]).then(([,asset])=>{
  if(!asset||!room.architectureArt?.loaded)return false;const{spec,parts}=asset,dungeon=room.dungeon,rects=dungeon.rects,D=spec.leaf;
  if(Object.keys(dungeon.doors).length!==3||D.width!==2.4||D.height!==3.3||spec.housing.walkHalfWidth!==5.12)throw Error('Sift doorway contract changed');r.spec=spec;
  const camera=root=>root.traverse(m=>{if(m.isMesh){m.material.userData.outlineParameters={visible:false};m.castShadow=m.receiveShadow=true;installStaticRaycastTree(m);r.cameraMeshes.push(m);}});
  for(const[id,door]of Object.entries(dungeon.doors)){
   const z=door.rect.z1+room.architectureArt.spec.portal.zOffset,group=new T.Group();group.name='Sift stone gate '+id;group.position.z=z;room.scene.add(group);
   const slot={id,door,root:group,z,amount:door.opened?1:0,leaves:[],bodies:[]};
   for(const name of['SiftDoorHousing','SiftDoorVent']){const model=parts[name].clone(true);group.add(model);camera(model);}
   for(const sign of[-1,1]){const leaf=parts.SiftDoorLeaf.clone(true);leaf.position.set(sign*D.closedCentre,0,-D.behindArch);leaf.name='Sift moving door '+id+' '+sign;group.add(leaf);camera(leaf);slot.leaves.push(leaf);const body={shape:'box',x0:0,x1:0,z0:z-D.behindArch-.23,z1:z-D.behindArch+.23,minY:0,maxY:D.height,padding:.28,escapeZ:1,siftDoor:id,sign};slot.bodies.push(body);r.colliders.push(body);}
   for(const sign of[-1,1])r.colliders.push({shape:'box',x0:sign<0?-5.12:2.34,x1:sign<0?-2.34:5.12,z0:z-1.15,z1:z-.01,minY:0,maxY:3.61,padding:.28,escapeZ:1,siftHousing:id});
   const approach={id:'sift-gate-approach-'+id,kind:'corridor',x0:-spec.housing.walkHalfWidth,x1:spec.housing.walkHalfWidth,z0:z-D.behindArch-.06,z1:door.rect.z1+.01,h:4.2,camH:80,open:true,field:true,siftDoorApproach:true};rects.push(approach);slot.approach=approach;
   door.mesh.visible=false;r.doors.push(slot);
  }
  // Repeated fixed stone and six moving leaves share geometry/material batches.
  // Original transforms remain the authoritative hinge/slide and body anchors.
  const originals=r.cameraMeshes.splice(0),moving=new Set();for(const slot of r.doors)for(const leaf of slot.leaves)leaf.traverse(m=>{if(m.isMesh)moving.add(m);});
  const buckets=new Map(),batchRoot=new T.Group();batchRoot.name='Sift repeated stone gates';room.scene.add(batchRoot);
  for(const m of originals){m.updateWorldMatrix(true,false);const key=(moving.has(m)?'moving:':'fixed:')+m.geometry.uuid+':'+m.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(m);}
  for(const sources of buckets.values()){
   const first=sources[0],dynamic=moving.has(first),mesh=new T.InstancedMesh(first.geometry,first.material,sources.length);mesh.name='Sift threshold '+(dynamic?'moving ':'fixed ')+first.material.name;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.userData.siftThresholdStatic=!dynamic;
   const batch={mesh,originals:sources,dynamic};r.batches.push(batch);if(dynamic){r.dynamicBatches.push(batch);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);}
   sources.forEach((source,i)=>mesh.setMatrixAt(i,source.matrixWorld));mesh.computeBoundingBox();mesh.computeBoundingSphere();installStaticRaycastTree(mesh);batchRoot.add(mesh);r.cameraMeshes.push(mesh);for(const source of sources)source.visible=false;
  }
  r.syncBatches=()=>{for(const batch of r.dynamicBatches){batch.originals.forEach((source,i)=>{source.updateWorldMatrix(true,false);batch.mesh.setMatrixAt(i,source.matrixWorld);});batch.mesh.instanceMatrix.needsUpdate=true;batch.mesh.computeBoundingBox();batch.mesh.computeBoundingSphere();}};
  // These existing progress lights sit in front of the second gateway. Their
  // opaque spheres must participate in the same body-visibility query as stone.
  for(const[index,m]of(room.gates[1]?.gate.pips||[]).entries()){m.name||=`Sift classification progress ${index+1}`;installStaticRaycastTree(m);r.cameraMeshes.push(m);}
  room.obstacles.push(...r.colliders);rects.cameraOccluders.push(...r.cameraMeshes);
  const pose=slot=>{const changed=slot.previousAmount!==slot.amount;if(changed){slot.leaves.forEach((leaf,i)=>{const sign=i?1:-1;leaf.position.x=sign*(D.closedCentre+D.travel*slot.amount);const b=slot.bodies[i];b.x0=leaf.position.x-D.width/2;b.x1=leaf.position.x+D.width/2;});slot.previousAmount=slot.amount;}slot.door.mesh.visible=false;slot.door.rect.open=slot.door.opened&&slot.amount>=1;return changed;};
  for(const slot of r.doors)pose(slot);r.syncBatches();
  const open=dungeon.openDoor.bind(dungeon);dungeon.openDoor=id=>{const ok=open(id),slot=r.doors.find(v=>v.id===id);if(slot&&pose(slot))r.syncBatches();return ok;};
  const update=dungeon.update?.bind(dungeon);dungeon.update=dt=>{update?.(dt);let changed=false;for(const slot of r.doors){slot.amount=slot.door.opened?Math.min(1,slot.amount+Math.max(0,dt)/D.duration):0;if(slot.amount>1-1e-7)slot.amount=1;changed=pose(slot)||changed;}if(changed)r.syncBatches();};
  const reset=dungeon.resetDoors.bind(dungeon);dungeon.resetDoors=()=>{reset();for(const slot of r.doors){slot.amount=0;pose(slot);}r.syncBatches();};
  for(const name of['importState','finishLegacy']){const original=room[name]?.bind(room);if(original)room[name]=(...args)=>{const result=original(...args);if(name!=='importState'||result){dungeon.update(D.duration);r.reconcile?.();}return result;};}
  const capture=room.captureCheckpoint.bind(room);room.captureCheckpoint=actor=>{const result=capture(actor),cp=room.checkpoint;if(actor?.rects===rects&&cp)for(const entry of room.gates)if(!entry.solved&&cp.z<entry.gate.seg.z0+.5){cp.z=entry.gate.seg.z0+.6;cp.y=0;}return result;};
  rects.cameraSubjectZones??=[];for(const slot of r.doors)rects.cameraSubjectZones.push({...slot.door.rect},{...slot.approach});
  for(const zone of rects.cameraSubjectZones)Object.assign(zone,{smoothOcclusion:true,halfWidth:.22,pitchAssist:.24,minRetreat:3.5,yawAssist:.75});
  r.reconcile=()=>{const a=r.actor;if(a?.rects!==rects)return;const old=a.position.clone();a._pushOut(a.position);if(old.distanceTo(a.position)>1e-6){a.syncMesh();a._camPlaced=false;}};
  r.loaded=true;r.reconcile();return true;
 }).catch(error=>{r.reason=error.message;console.warn('[sift-thresholds]',error);return false;});room.ready=Promise.all([room.ready,r.ready]);return room;
}
