import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';
import {suppressInteriorDoorWitness} from '../render/InteriorDirection.js';

let pending;
function assets(){return pending??=Promise.all([
  fetch('assets/models/adventure/shaft-entry-v01.json').then(async r=>{if(!r.ok)throw Error('Exit manifest missing');const spec=await r.json();return{spec,source:(await new GLTFLoader().loadAsync(spec.model)).scene};}),
  fetch('assets/models/adventure/strata-records-v01.json').then(async r=>{if(!r.ok)throw Error('Record manifest missing');const spec=await r.json();return{spec,source:(await new GLTFLoader().loadAsync(spec.model)).scene};}),
]).catch(e=>{console.warn('[shaft-entry] original boards and door retained',e);return null;});}

export const registerShaftEntry=room=>registerEntry(room,'r2','shaftEntry',room.shaftBoards);
export const registerArchiveEntry=room=>registerEntry(room,'r3','archiveEntry',room.archiveBoards);
function registerEntry(room,id,key,boards){
  if(room.spec.id!=='strata'||!boards)return room;
  const art=room[key]={loaded:false,models:[],colliders:[],cameraMeshes:[],hidden:[],progress:0,leaves:[],actor:null};
  art.near=actor=>{if(!art.loaded||actor.position.y>.25||room.gates[0].gate.held||room.final.held)return null;for(let i=0;i<2;i++){const p=art.spec.recordPositions[i],dx=actor.position.x-p[0],dz=actor.position.z-p[2];if(Math.abs(dx)<1.05&&dz>=.35&&dz<=1.8)return{id:id+(i?'Hint':'Goal'),...boards[i?'hint':'goal'].state};}return null;};
  art.ready=Promise.all([room.ready,assets()]).then(([,data])=>{
    if(!data)return false;
    const [{spec:baseSpec,source},record]=data,door=room.dungeon.doors[id],spec=id==='r2'?baseSpec:{...baseSpec,doorZ:door.mesh.position.z,recordPositions:[[-4.7,0,-41.5],[4.7,0,-41.5]]},frame=source.getObjectByName('ShaftExitFrame'),leaf=source.getObjectByName('ShaftExitLeaf'),foundation=source.getObjectByName('ShaftExitFoundation'),plaque=record.source.getObjectByName(record.spec.part);
    if(!frame||!leaf||!foundation||!plaque||spec.recordPositions.length!==2)throw Error('Entry asset parts missing');
    for(const part of [frame,leaf,foundation,plaque]){part.updateWorldMatrix(true,true);if(Math.abs(new T.Box3().setFromObject(part,true).min.y)>.001)throw Error('Entry asset not grounded');}
    const leafBounds=new T.Box3().setFromObject(leaf,true);
    const rects=room.dungeon.rects;
    if(Math.abs(door.mesh.position.z-spec.doorZ)>.01||door.rect.x1!==2.1||spec.height!==3.5)throw Error('Exit spatial contract changed');
    art.spec=spec;art.door=door;const materials=new Map();
    function add(part,parent,position,scale=1){const root=part.clone(true);root.position.fromArray(position);root.scale.setScalar(scale);parent.add(root);art.models.push(root);root.traverse(m=>{if(m.isMesh){if(!materials.has(m.material)){const mat=m.material.clone();mat.envMapIntensity=.65;mat.userData.outlineParameters={visible:false};materials.set(m.material,mat);}m.material=materials.get(m.material);m.castShadow=m.receiveShadow=true;installStaticRaycastTree(m);art.cameraMeshes.push(m);}});return root;}
    function body(s,pos,scale=1){const[x,y,z]=s.position.map(v=>v*scale),[w,h,d]=s.size.map(v=>v*scale);const b={shape:'box',x0:pos[0]+x-w/2,x1:pos[0]+x+w/2,z0:pos[2]+z-d/2,z1:pos[2]+z+d/2,minY:pos[1]+y-h/2,maxY:pos[1]+y+h/2,padding:.28,escapeZ:1,shaftEntry:true};art.colliders.push(b);return b;}
    art.frame=add(frame,room.scene,[0,0,spec.doorZ]);for(const s of spec.parts.ShaftExitFrame.solids)body(s,[0,0,spec.doorZ]);
    art.foundation=add(foundation,room.scene,[0,-.75,spec.doorZ]);for(const s of spec.parts.ShaftExitFoundation.solids)body(s,[0,-.75,spec.doorZ]);
    for(const side of[-1,1]){const root=add(leaf,room.scene,[side*spec.leafCenter,0,spec.doorZ]),b=body(spec.parts.ShaftExitLeaf.solids[0],[side*spec.leafCenter,0,spec.doorZ]);b.z0=spec.doorZ+leafBounds.min.z;b.z1=spec.doorZ+leafBounds.max.z;b.sliding=true;art.leaves.push({root,body:b,side});}
    for(let i=0;i<2;i++){const board=boards[i?'hint':'goal'],position=spec.recordPositions[i];board.usePlaque();board.group.position.fromArray(position);board.group.rotation.set(0,0,0);board.group.scale.setScalar(.65);board.shell.forEach(m=>m.visible=false);add(plaque,board.group,[0,0,0]);art.cameraMeshes.push(board.face);for(const s of record.spec.solids)body(s,position,.65);}
    for(const m of room.scene.children)if(m.userData.doorFrame===id){m.geometry=m.geometry.clone();m.geometry.setDrawRange(0,0);art.hidden.push(m);}
    door.mesh.geometry=door.mesh.geometry.clone();door.mesh.geometry.setDrawRange(0,0);art.hidden.push(door.mesh);art.suppressedWitnesses=suppressInteriorDoorWitness(room,id);
    room.obstacles.push(...art.colliders);(rects.cameraOccluders??=[]).push(...art.cameraMeshes);
    const floor=rects.floorAt?.bind(rects);rects.floorAt=(x,z,y=0)=>{let h=floor?.(x,z,y)??0;for(const b of art.colliders)if(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1&&y+.26>=b.maxY)h=Math.max(h,b.maxY);return h;};
    art.sync=()=>{const ease=art.progress*art.progress*(3-2*art.progress);art.offset=ease*spec.travel;for(const {root,body:b,side} of art.leaves){const x=side*(spec.leafCenter+art.offset);root.position.x=x;b.x0=x-spec.halfWidth;b.x1=x+spec.halfWidth;root.updateWorldMatrix(true,true);}door.rect.open=door.opened&&art.offset>=.36;for(const m of art.hidden)m.geometry.setDrawRange(0,0);};
    art.reconcile=()=>{const a=art.actor;if(a?.rects===rects){a._pushOut(a.position);a.syncMesh();a._camPlaced=false;}};
    art.snap=()=>{art.progress=door.opened?1:0;art.sync();art.reconcile();};
    const advance=room.updateArchitecture?.bind(room);room.updateArchitecture=(dt,actor)=>{advance?.(dt,actor);art.actor=actor;if(door.opened)art.progress=Math.min(1,art.progress+Math.max(0,dt)/spec.duration);art.sync();};
    const open=room.dungeon.openDoor.bind(room.dungeon);room.dungeon.openDoor=target=>{const changed=open(target);if(target===id)art.sync();return changed;};
    const reset=room.dungeon.resetDoors.bind(room.dungeon);room.dungeon.resetDoors=()=>{const result=reset();art.progress=0;art.sync();art.reconcile();return result;};
    for(const name of ['importState','restart','finishLegacy']){const fn=room[name]?.bind(room);if(fn)room[name]=(...args)=>{const result=fn(...args);if(name!=='importState'||result)art.snap();return result;};}
    const resume=room.resume.bind(room);room.resume=a=>{art.actor=a;const result=resume(a);art.snap();return result;};
    art.loaded=true;art.snap();return true;
  }).catch(e=>{art.reason=e.message;console.warn('[shaft-entry]',e);return false;});
  room.ready=Promise.all([room.ready,art.ready]);return room;
}
