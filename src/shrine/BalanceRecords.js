import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';

let pending;
function assets(){return pending??=fetch('assets/models/adventure/strata-records-v01.json').then(async response=>{
  if(!response.ok)throw Error('Record manifest unavailable');const spec=await response.json(),scene=(await new GLTFLoader().loadAsync(spec.model)).scene,part=scene.getObjectByName(spec.part);
  if(!part)throw Error('Record model missing');return{spec,part};
}).catch(error=>{console.warn('[balance-records] original boards retained',error);return null;});}

export function registerBalanceRecords(room){
  if(room.spec.id!=='balance'||!room.balanceBoards)return room;
  const r=room.balanceRecords={loaded:false,models:[],batches:[],colliders:[],cameraMeshes:[],actor:null};
  r.near=actor=>{
    // CarryTrial uses an integer index: index0 must also keep its normal drop action.
    const carrying=[...room.gates.map(g=>g.gate),room.final].some(g=>g.held!==null&&g.held!==undefined);
    if(!r.loaded||carrying||actor.position.y>r.spec.read.maxFootHeight)return null;
    for(const p of r.spec.placements){const dx=actor.position.x-p.position[0],dz=actor.position.z-p.position[2];if(Math.abs(dx)<r.spec.read.halfWidth&&dz>=r.spec.read.near&&dz<=r.spec.read.far){const state=room.balanceBoards[p.roomId][p.kind].state;return{id:'balance:'+p.roomId+':'+p.kind,title:state.title,body:state.body,dim:state.dim};}}
    return null;
  };
  const resume=room.resume.bind(room);room.resume=actor=>{r.actor=actor;const result=resume(actor);r.reconcile?.();return result;};
  const update=room.updateArchitecture?.bind(room);room.updateArchitecture=(dt,actor)=>{update?.(dt,actor);r.actor=actor;};
  r.ready=Promise.all([room.ready,assets()]).then(([,a])=>{
    if(!a)return false;const{spec:base,part}=a;part.updateWorldMatrix(true,true);const bounds=new T.Box3().setFromObject(part,true);
    if(Math.abs(bounds.min.y)>.001||bounds.max.y>1.95||base.scale!==.65||base.solids.length!==4)throw Error('Record dimensions changed');
    const placements=[];for(const seg of room.spec.rooms.filter(s=>s.goal))for(const[kind,side]of [['goal',-1],['hint',1]])placements.push({id:seg.id+':'+kind,roomId:seg.id,kind,position:[side*(seg.w/2-2.1),0,seg.from-1.3]});
    if(placements.length!==6||placements.some(p=>!room.balanceBoards[p.roomId]?.[p.kind]))throw Error('Balance board contract changed');
    r.spec={...base,placements,read:{...base.read,near:.42,far:1.6}};
    const materials=new Map();
    for(const p of placements){
      const board=room.balanceBoards[p.roomId][p.kind];board.usePlaque();board.group.position.fromArray(p.position);board.group.rotation.set(0,0,0);board.group.scale.setScalar(base.scale);for(const shell of board.shell)shell.visible=false;
      const model=part.clone(true);model.name='Balance record '+p.id;model.traverse(o=>{if(o.isMesh){if(!materials.has(o.material)){const mat=o.material.clone();mat.envMapIntensity=.7;mat.userData.outlineParameters={visible:false};materials.set(o.material,mat);}o.material=materials.get(o.material);o.castShadow=o.receiveShadow=true;}});board.group.add(model);r.models.push(model);r.cameraMeshes.push(board.face);
      for(const s of base.solids){const[x,y,z]=s.position.map(v=>v*base.scale),[w,h,d]=s.size.map(v=>v*base.scale);r.colliders.push({shape:'box',x0:p.position[0]+x-w/2,x1:p.position[0]+x+w/2,z0:p.position[2]+z-d/2,z1:p.position[2]+z+d/2,minY:y-h/2,maxY:y+h/2,padding:.28,escapeZ:1,balanceRecord:p.id});}
    }
    // Six stationary stands use the exact original world surfaces in shared batches.
    // Text faces stay in their board groups so current goals/hints remain mutable.
    const buckets=new Map();r.batchGroup=new T.Group();r.batchGroup.name='Balance repeated records';
    for(const root of r.models){root.updateWorldMatrix(true,true);root.traverse(m=>{if(m.isMesh){const key=m.geometry.uuid+':'+m.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(m);}});}
    for(const originals of buckets.values()){
      const first=originals[0],mesh=new T.InstancedMesh(first.geometry,first.material,originals.length);mesh.name='Balance record batch '+first.material.name;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;
      originals.forEach((m,i)=>mesh.setMatrixAt(i,m.matrixWorld));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();installStaticRaycastTree(mesh);
      r.batchGroup.add(mesh);r.batches.push({mesh,originals});r.cameraMeshes.push(mesh);
    }
    room.scene.add(r.batchGroup);for(const root of r.models)root.visible=false;
    room.obstacles.push(...r.colliders);const rects=room.dungeon.rects;(rects.cameraOccluders??=[]).push(...r.cameraMeshes);const previous=rects.floorAt?.bind(rects);
    rects.floorAt=(x,z,y=0)=>{let h=previous?.(x,z,y)??0;for(const s of r.colliders)if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&y+.26>=s.maxY)h=Math.max(h,s.maxY);return h;};
    r.reconcile=()=>{const actor=r.actor;if(actor?.rects!==rects)return;const old=actor.position.clone();actor._pushOut(actor.position);if(actor.position.distanceTo(old)>1e-6){actor.syncMesh();actor._camPlaced=false;}};
    r.loaded=true;r.reconcile();return true;
  }).catch(error=>{r.reason=error.message;console.warn('[balance-records]',error);return false;});
  room.ready=Promise.all([room.ready,r.ready]);return room;
}
