import * as T from 'three';
import {loadObservationPlaque} from './StrataRecords.js';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';
let pending;
function assets(){return pending??=Promise.all([fetch('assets/models/adventure/sift-thresholds-v01.json').then(r=>{if(!r.ok)throw Error('Missing sift records manifest');return r.json();}),loadObservationPlaque()]).then(([spec,shared])=>{if(!shared||spec.records.model!==shared.spec.model||spec.records.part!==shared.spec.part)throw Error('Missing original record model');return{spec,base:shared.spec,part:shared.part};}).catch(error=>{console.warn('[sift-records] original boards retained',error);return null;});}
export function registerSiftRecords(room){
 if(room.spec.id!=='sift'||!room.siftBoards)return room;
 const r=room.siftRecords={loaded:false,models:[],batches:[],colliders:[],cameraMeshes:[],actor:null};
 r.near=actor=>{
  const carrying=[...room.gates.map(g=>g.gate),room.final].some(g=>!!g.held||g.held===0);
  if(!r.loaded||carrying||actor.position.y>r.spec.read.maxFootHeight)return null;
  for(const p of r.spec.placements){const dx=actor.position.x-p.position[0],dz=actor.position.z-p.position[2],c=Math.cos(p.yaw),s=Math.sin(p.yaw),x=c*dx-s*dz,z=s*dx+c*dz;
   if(Math.abs(x)<r.spec.read.halfWidth&&z>=r.spec.read.near&&z<=r.spec.read.far){const state=room.siftBoards[p.room][p.kind].state;return{id:'sift:'+p.room+':'+p.kind,title:state.title,body:state.body,dim:state.dim};}
  }return null;
 };
 const resume=room.resume.bind(room);room.resume=actor=>{r.actor=actor;const value=resume(actor);r.reconcile?.();return value;};
 const update=room.updateArchitecture?.bind(room);room.updateArchitecture=(dt,actor)=>{update?.(dt,actor);r.actor=actor;};
 r.ready=Promise.all([room.ready,assets()]).then(([,asset])=>{
  if(!asset)return false;const{spec,base,part}=asset,scale=spec.records.scale,placements=spec.records.placements;
  if(scale!==.65||placements.length!==8||base.solids.length!==4||placements.some(p=>!room.siftBoards[p.room]?.[p.kind]))throw Error('Sift record spatial contract changed');
  r.spec={...spec.records,read:{...base.read,near:.42,far:1.6}};
  const materials=new Map();
  for(const p of placements){
   const board=room.siftBoards[p.room][p.kind];board.usePlaque({bodyWeight:700});board.group.position.fromArray(p.position);board.group.rotation.set(0,p.yaw,0);board.group.scale.setScalar(scale);for(const shell of board.shell)shell.visible=false;
   const model=part.clone(true);model.name='Sift record '+p.room+':'+p.kind;model.traverse(m=>{if(m.isMesh){if(!materials.has(m.material)){const value=m.material.clone();value.envMapIntensity=.7;value.userData.outlineParameters={visible:false};materials.set(m.material,value);}m.material=materials.get(m.material);m.castShadow=m.receiveShadow=true;}});board.group.add(model);r.models.push(model);installStaticRaycastTree(board.face);r.cameraMeshes.push(board.face);
   const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
   for(const b of base.solids){const[x,y,z]=b.position.map(v=>v*scale),[w,h,d]=b.size.map(v=>v*scale),cx=p.position[0]+c*x+s*z,cz=p.position[2]-s*x+c*z,ww=Math.abs(c)*w+Math.abs(s)*d,dd=Math.abs(s)*w+Math.abs(c)*d;r.colliders.push({shape:'box',x0:cx-ww/2,x1:cx+ww/2,z0:cz-dd/2,z1:cz+dd/2,minY:y-h/2,maxY:y+h/2,padding:.28,escapeX:Math.abs(s)>.5?Math.sign(s):0,escapeZ:Math.abs(c)>.5?Math.sign(c):0,siftRecord:p.room+':'+p.kind});}
  }
  const buckets=new Map(),root=new T.Group();root.name='Sift repeated records';r.batchGroup=root;
  for(const model of r.models){model.updateWorldMatrix(true,true);model.traverse(m=>{if(m.isMesh){const key=m.geometry.uuid+':'+m.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(m);}});}
  for(const originals of buckets.values()){const first=originals[0],m=new T.InstancedMesh(first.geometry,first.material,originals.length);m.name='Sift record batch '+first.material.name;m.castShadow=first.castShadow;m.receiveShadow=first.receiveShadow;originals.forEach((v,i)=>m.setMatrixAt(i,v.matrixWorld));m.instanceMatrix.needsUpdate=true;m.computeBoundingBox();m.computeBoundingSphere();installStaticRaycastTree(m);root.add(m);r.batches.push({mesh:m,originals});r.cameraMeshes.push(m);}
  room.scene.add(root);for(const model of r.models)model.visible=false;
  room.obstacles.push(...r.colliders);const rects=room.dungeon.rects;(rects.cameraOccluders??=[]).push(...r.cameraMeshes);const floor=rects.floorAt?.bind(rects);rects.floorAt=(x,z,y=0)=>{let h=floor?.(x,z,y)??0;for(const b of r.colliders)if(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1&&y+.26>=b.maxY)h=Math.max(h,b.maxY);return h;};
  r.reconcile=()=>{const a=r.actor;if(a?.rects!==rects)return;const old=a.position.clone();a._pushOut(a.position);if(old.distanceTo(a.position)>1e-6){a.syncMesh();a._camPlaced=false;}};
  r.loaded=true;r.reconcile();return true;
 }).catch(error=>{r.reason=error.message;console.warn('[sift-records]',error);return false;});room.ready=Promise.all([room.ready,r.ready]);return room;
}
