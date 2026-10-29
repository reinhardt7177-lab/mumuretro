import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';
import {suppressInteriorDoorWitness} from '../render/InteriorDirection.js';

let pending;
function assets(){return pending??=fetch('assets/models/adventure/strata-inlays-v01.json').then(async r=>{if(!r.ok)throw Error('Inlay manifest unavailable');const spec=await r.json();return{spec,source:(await new GLTFLoader().loadAsync(spec.model)).scene};}).catch(e=>{console.warn('[strata-inlays] preceding working art retained',e);return null;});}
const near=(a,b)=>Math.abs(a-b)<1e-5;

// This visual replacement is registered after the existing progress codec.
// The old nodes stay in place for saves; no legacy fields/indices are removed.
export function registerStrataInlays(room){
  if(room.spec.id!=='strata')return room;
  const g=room.gates[0].gate,portal=room.strataPortal,record=room.strataInlays={loaded:false,roots:[],cameraMeshes:[],markers:[],sockets:[],badges:[],hidden:[],ready:null};
  record.ready=Promise.all([room.ready,assets()]).then(([,asset])=>{
    if(!asset||!portal.loaded){record.reason=asset?'preceding portal unavailable':'optional inlay asset unavailable';return false;}
    const {source,spec}=asset;source.updateMatrixWorld(true);record.spec=spec;
    const names=['LayerWall','WallSocket','ForecourtFloor',...g.marks.map((_,i)=>'FloorMarker'+(i+1)),...g.slots.map((_,i)=>'WallBadge'+(i+1))],parts={};
    for(const name of names){const p=source.getObjectByName(name);if(!p)throw Error('Missing '+name);parts[name]=p;const box=new T.Box3().setFromObject(p,true);if(name==='LayerWall'&&(Math.abs(box.min.y)>.001||Math.abs(box.max.y-4.96)>.001||Math.abs(box.max.x-4.4)>.001))throw Error('Wall dimensions changed');if(name.startsWith('FloorMarker')&&Math.abs(box.min.y)>.001)throw Error('Floating marker');}
    const obsolete=[...portal.holes,...portal.links];
    for(const m of g.marks)for(const o of g.group.children){if(!o.isMesh)continue;const p=o.geometry.parameters||{};
      if(o.geometry.type==='CylinderGeometry'&&near(p.height,.16)&&near(o.position.x,m.x)&&near(o.position.z,m.z))obsolete.push(o);
      if(o.geometry.type==='TorusGeometry'&&near(p.radius,1)&&near(o.position.x,m.x)&&near(o.position.z,m.z))obsolete.push(o);
      if(o.geometry.type==='BoxGeometry'&&near(p.width,.13)&&near(p.height,.05)&&near(o.position.z,m.z+.62)&&Math.abs(o.position.x-m.x)<.4)obsolete.push(o);
    }
    // Three.js TorusGeometry exposes radius; the explicit node count also
    // guards against leaving one old giant ring behind after source changes.
    if(new Set(obsolete).size!==26)throw Error('Old inlay node contract changed: '+new Set(obsolete).size);
    const add=(name,parent,pos,camera=false)=>{const root=parts[name].clone(true);root.name='Strata inlay '+name;root.userData.inlayPart=name;root.position.set(...pos);root.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.material.envMapIntensity=.65;o.material.userData.outlineParameters={visible:false};o.castShadow=name!=='ForecourtFloor';o.receiveShadow=true;if(camera){installStaticRaycastTree(o);record.cameraMeshes.push(o);}});parent.add(root);record.roots.push(root);return root;};
    const oldWall=portal.wall,oldCamera=new Set();oldWall.traverse(o=>{if(o.isMesh)oldCamera.add(o);});
    const wall=add('LayerWall',room.scene,[0,portal.lift,g.seg.z0+.5],true);record.wall=wall;
    for(let i=0;i<4;i++){
      const m=g.marks[i],slot=g.slots[i];record.markers.push(add('FloorMarker'+(i+1),room.scene,[m.x,0,m.z]));record.sockets.push(add('WallSocket',wall,[0,slot.y,.245],true));record.badges.push(add('WallBadge'+(i+1),wall,[.88,slot.y,.20],true));
    }
    record.floor=add('ForecourtFloor',room.scene,[0,0,(g.seg.z0+g.seg.z1)/2],true);
    // Remove exactly the old pad/ring/dots/air links and slot rings, retaining
    // their stable nodes and shared materials for the v1 visual save codec.
    for(const o of [...new Set(obsolete),...oldCamera]){o.geometry=o.geometry.clone();o.geometry.setDrawRange(0,0);record.hidden.push(o);}
    portal.wall=wall;portal.models.splice(portal.models.indexOf(oldWall),1,wall);
    const wallCamera=record.cameraMeshes.filter(o=>o!==record.floor&&!record.floor.children.includes(o));
    portal.cameraMeshes=portal.cameraMeshes.filter(o=>!oldCamera.has(o)).concat(wallCamera);
    const rects=room.dungeon.rects;rects.cameraOccluders=(rects.cameraOccluders||[]).filter(o=>!oldCamera.has(o));rects.cameraOccluders.push(...record.cameraMeshes);
    const originalFloor=room.scene.children.find(o=>o.userData.openFieldFloor==='r1');if(originalFloor){
      originalFloor.position.y-=.13;originalFloor.material=new T.MeshStandardMaterial({color:0x3c4140,roughness:.96});originalFloor.material.userData.outlineParameters={visible:false};record.originalFloor=originalFloor;
    }
    for(const o of room.scene.children){
      if(o.userData.openFieldFloorMark==='r1'){o.geometry=o.geometry.clone();o.geometry.setDrawRange(0,0);record.hidden.push(o);}
      const p=o.geometry?.parameters;
      if(o.isMesh&&p&&near(p.width,.12)&&near(p.height,.08)&&near(o.position.z,(g.seg.z0+g.seg.z1)/2)&&Math.abs(o.position.x)>5&&Math.abs(o.position.x)<5.5){o.material=new T.MeshStandardMaterial({color:0x8c7a56,roughness:.66,metalness:.4});o.material.userData.outlineParameters={visible:false};}
    }
    // Give all hoist stone the same isotropic texture instead of directional
    // grain. The editable preceding asset itself is preserved unchanged.
    let limestone;wall.traverse(o=>{if(o.isMesh&&o.material.name==='Inlay stone1')limestone=o.material;});
    for(const root of [portal.frame,...portal.weights])root.traverse(o=>{if(o.isMesh&&o.material.map&&limestone){o.material.map=limestone.map;o.material.normalMap=limestone.normalMap;o.material.normalScale.set(.18,.18);o.material.roughness=.88;o.material.needsUpdate=true;}});
    record.suppressedWitnesses=suppressInteriorDoorWitness(room,'r1');
    const previousFloor=rects.floorAt?.bind(rects);rects.floorAt=(x,z,y=0)=>{let h=previousFloor?.(x,z,y)??0;for(const m of g.marks)if(Math.hypot(x-m.x,z-m.z)<=spec.markerRadius)h=Math.max(h,spec.markerFloor);return h;};
    record.sync=()=>{
      for(const o of record.hidden)o.geometry.setDrawRange(0,0);
      for(let i=0;i<4;i++){const slot=g.slots[i],m=g.marks[i],occupied=!!slot.got,correct=occupied&&slot.got.level===slot.level,color=occupied?(correct?0x9d875a:0x9a5347):0x827151;
        const focused=!!g.held&&portal.actor&&Math.hypot(portal.actor.position.x-m.x,portal.actor.position.z-m.z)<1.05;
        record.markers[i].traverse(o=>{if(o.isMesh&&o.material.name==='Inlay signal'){o.material.color.set(color);o.material.emissive.set(focused?0x615039:0x000000);o.material.emissiveIntensity=focused ? .22 : 0;}});
      }
    };
    const apply=portal.applyPose;portal.applyPose=()=>{apply();record.sync();};
    record.loaded=true;portal.applyPose();return true;
  }).catch(e=>{record.reason=e.message;console.warn('[strata-inlays]',e);return false;});
  room.ready=Promise.all([room.ready,record.ready]);return room;
}
