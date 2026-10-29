import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';

let pending;
function asset(){return pending??=fetch('assets/models/adventure/chronicle-evidence-v01.json').then(async r=>{if(!r.ok)throw Error('Evidence manifest unavailable');const spec=await r.json(),gltf=await new GLTFLoader().loadAsync(spec.model);return{spec,source:gltf.scene};}).catch(error=>{console.warn('[chronicle-evidence] original specimens retained',error);return null;});}

// Keep the original progress nodes and material indices. Static replacement art
// is attached only after the legacy visual codec has captured its node layout.
export function registerChronicleEvidence(room){
  if(room.spec.id!=='strata')return room;
  const g=room.gates[0].gate,record=room.evidenceArt={loaded:false,models:[],colliders:[],cameraMeshes:[],ready:null};
  const resume=room.resume.bind(room);room.resume=a=>{const result=resume(a);record.actor=a;record.reconcileActor?.();return result;};
  record.ready=Promise.all([asset(),room.ready]).then(([data])=>{
    if(!data){record.reason='optional asset unavailable';return false;}
    const{spec,source}=data,parts={};source.updateMatrixWorld(true);
    for(const name of ['Fossil0','Fossil1','Fossil2','Fossil3','CoreStand','WallFrame']){parts[name]=source.getObjectByName(name);if(!parts[name])throw Error('Missing evidence part '+name);}
    for(let i=0;i<4;i++){const box=new T.Box3().setFromObject(parts['Fossil'+i],true);if(Math.abs(box.min.y+1)>.001||Math.abs(box.max.y-1)>.001)throw Error('Fossil datum mismatch');}
    for(const name of ['CoreStand','WallFrame'])if(Math.abs(new T.Box3().setFromObject(parts[name],true).min.y)>.001||!spec.parts[name].solids.length)throw Error('Furniture datum mismatch');
    // Locate the four core witnesses by their actual corresponding band, not
    // colour or scene-child index: this also respects the flipped drill layout.
    const witnesses=g.coreBands.map(b=>g.group.children.find(o=>o.isMesh&&o.geometry.type==='DodecahedronGeometry'&&Math.abs(o.position.x-b.mesh.position.x)<1e-5&&Math.abs(o.position.y-1.32)<1e-5&&Math.abs(o.position.z-(g.core.z+.42))<1e-5));
    const oldStand=g.group.children.filter(o=>o.isMesh&&o.geometry.type==='BoxGeometry'&&Math.abs(o.position.z-g.core.z)<1e-5&&(Math.abs(o.position.y-.35)<1e-5||Math.abs(o.position.y-.78)<1e-5));
    if(witnesses.some(o=>!o)||oldStand.length!==3)throw Error('Original core structure changed');
    record.spec=spec;record.witnesses=[];record.fossils=[];
    const copy=(name,parent)=>{const root=parts[name].clone(true);root.name='Evidence '+name;root.userData.evidencePart=name;root.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.material.envMapIntensity=.7;o.material.userData.outlineParameters={visible:false};o.castShadow=true;o.receiveShadow=true;});parent.add(root);record.models.push(root);return root;};
    for(const f of g.fossils){const root=copy('Fossil'+f.idx,f.mesh);root.scale.setScalar(f.r);f.mesh.geometry.setDrawRange(0,0);record.fossils.push({idx:f.idx,root});}
    for(let i=0;i<4;i++){const idx=g.order[i],f=g.fossils[idx],root=copy('Fossil'+idx,witnesses[i]);root.scale.setScalar(f.r*.8);witnesses[i].geometry.setDrawRange(0,0);record.witnesses.push({level:i,idx,root});}
    for(const old of oldStand)old.geometry.setDrawRange(0,0);
    const stand=copy('CoreStand',room.scene);stand.position.set(g.core.x,0,g.core.z);
    const wall=copy('WallFrame',room.scene);wall.position.set((g.seg.x0+g.seg.x1)/2,0,g.seg.z0+.5);
    record.stand=stand;record.wall=wall;record.oldStand=oldStand;
    for(const[name,root]of [['CoreStand',stand],['WallFrame',wall]]){
      root.updateWorldMatrix(true,true);root.traverse(o=>{if(o.isMesh){installStaticRaycastTree(o);record.cameraMeshes.push(o);}});
      for(const s of spec.parts[name].solids){const[x,y,z]=s.position,[w,h,d]=s.size,px=x+root.position.x,pz=z+root.position.z;record.colliders.push({shape:'box',x0:px-w/2,x1:px+w/2,z0:pz-d/2,z1:pz+d/2,minY:y-h/2,maxY:y+h/2,padding:.28,evidence:true});}
    }
    // The original cylinders are solid too; a jump onto the new table must not
    // put the traveller's torso through the specimens. Cylindrical end surfaces
    // remain the old geometry; these four conservative body boxes cover the core.
    record.coreColliders=g.coreBands.map(({mesh})=>({shape:'box',x0:mesh.position.x-.45,x1:mesh.position.x+.45,z0:g.core.z-.46,z1:g.core.z+.52,minY:.86,maxY:1.78,padding:.28,evidenceCore:true}));
    room.obstacles.push(...record.colliders,...record.coreColliders);(room.dungeon.rects.cameraOccluders??=[]).push(...record.cameraMeshes,...g.coreBands.map(b=>b.mesh),g.coreBit);
    const rects=room.dungeon.rects,previousFloor=rects.floorAt?.bind(rects);rects.floorAt=(x,z,y=0)=>{let h=previousFloor?.(x,z,y)??0;for(const s of record.colliders)if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&y+.26>=s.maxY)h=Math.max(h,s.maxY);return h;};
    const update=g.update.bind(g);record.sync=()=>{for(const f of g.fossils)if(f!==g.held)f.mesh.rotation.set(0,0,0);};
    g.update=(dt,actor)=>{const result=update(dt,actor);record.sync();if(g.held)g.held.mesh.rotation.set(0,Math.atan2(actor.heading.x,actor.heading.z),0);return result;};
    const restore=room.importState.bind(room);room.importState=s=>{const ok=restore(s);if(ok)record.sync();return ok;};
    const restart=g.restart.bind(g);g.restart=()=>{restart();record.sync();};
    record.reconcileActor=()=>{const a=record.actor;if(a?.rects!==rects)return;const before=a.position.clone();a._pushOut(a.position);if(a.position.distanceTo(before)>1e-6){a.syncMesh();a._camPlaced=false;record.safeShift=a.position.distanceTo(before);}};
    record.sync();record.loaded=true;record.reconcileActor();return true;
  }).catch(error=>{record.reason=error.message;console.warn('[chronicle-evidence]',error);return false;});
  room.ready=Promise.all([room.ready,record.ready]);return room;
}
