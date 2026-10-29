import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';

let pending;
function assets(){return pending??=fetch('assets/models/adventure/strata-records-v01.json').then(async r=>{if(!r.ok)throw Error('Record manifest unavailable');const spec=await r.json(),source=(await new GLTFLoader().loadAsync(spec.model)).scene,part=source.getObjectByName(spec.part);if(!part)throw Error('Record model missing');return{spec,part};}).catch(e=>{console.warn('[strata-records] original boards retained',e);return null;});}

export const loadObservationPlaque=assets;

export const registerStrataRecords=room=>registerRecords(room,'strataRecords',room.recordBoards);
export const registerSanctumRecords=room=>registerRecords(room,'sanctumRecords',room.sanctumBoards);
function registerRecords(room,key,boards){
  if(room.spec.id!=='strata'||!boards)return room;
  const r=room[key]={loaded:false,models:[],colliders:[],cameraMeshes:[],ready:null,actor:null};
  r.near=actor=>{if(!r.loaded||room.gates[0].gate.held||room.final.held||actor.position.y>r.spec.read.maxFootHeight)return null;for(const p of r.spec.placements){const dx=actor.position.x-p.position[0],dz=actor.position.z-p.position[2];if(Math.abs(dx)<r.spec.read.halfWidth&&dz>=r.spec.read.near&&dz<=r.spec.read.far){const state=boards[p.id].state;return{id:key==='strataRecords'?p.id:key+':'+p.id,title:state.title,body:state.body,dim:state.dim};}}return null;};
  const resume=room.resume.bind(room);room.resume=actor=>{r.actor=actor;const result=resume(actor);r.reconcile?.();return result;};
  const update=room.updateArchitecture?.bind(room);room.updateArchitecture=(dt,actor)=>{update?.(dt,actor);r.actor=actor;};
  r.ready=Promise.all([room.ready,assets()]).then(([,a])=>{
    if(!a)return false;const{spec:baseSpec,part}=a;const spec=key==='sanctumRecords'?{...baseSpec,placements:[{id:'goal',position:[-7.7,0,room.shrineSeg.z1-1.5]},{id:'hint',position:[7.7,0,room.shrineSeg.z1-1.5]}]}:baseSpec;part.updateWorldMatrix(true,true);const bounds=new T.Box3().setFromObject(part,true);if(Math.abs(bounds.min.y)>.001||bounds.max.y>1.95||spec.scale!==.65||spec.placements.length!==2)throw Error('Record dimensions changed');r.spec=spec;
    for(const p of spec.placements){const board=boards[p.id];board.usePlaque();board.group.position.fromArray(p.position);board.group.rotation.set(0,0,0);board.group.scale.setScalar(spec.scale);for(const m of board.shell)m.visible=false;
      const model=part.clone(true);model.name='Strata record '+p.id;model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.envMapIntensity=.7;o.material.userData.outlineParameters={visible:false};o.castShadow=true;o.receiveShadow=true;installStaticRaycastTree(o);r.cameraMeshes.push(o);}});board.group.add(model);r.models.push(model);r.cameraMeshes.push(board.face);
      for(const s of spec.solids){const[x,y,z]=s.position.map(v=>v*spec.scale),[w,h,d]=s.size.map(v=>v*spec.scale);r.colliders.push({shape:'box',x0:p.position[0]+x-w/2,x1:p.position[0]+x+w/2,z0:p.position[2]+z-d/2,z1:p.position[2]+z+d/2,minY:y-h/2,maxY:y+h/2,padding:.28,escapeZ:1,strataRecord:p.id});}
    }
    room.obstacles.push(...r.colliders);const rects=room.dungeon.rects;(rects.cameraOccluders??=[]).push(...r.cameraMeshes);const previous=rects.floorAt?.bind(rects);rects.floorAt=(x,z,y=0)=>{let h=previous?.(x,z,y)??0;for(const s of r.colliders)if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&y+.26>=s.maxY)h=Math.max(h,s.maxY);return h;};
    r.reconcile=()=>{const actor=r.actor;if(actor?.rects!==rects)return;const old=actor.position.clone();actor._pushOut(actor.position);if(actor.position.distanceTo(old)>1e-6){actor.syncMesh();actor._camPlaced=false;}};
    r.loaded=true;r.reconcile();return true;
  }).catch(e=>{r.reason=e.message;console.warn('[strata-records]',e);return false;});room.ready=Promise.all([room.ready,r.ready]);return room;
}
