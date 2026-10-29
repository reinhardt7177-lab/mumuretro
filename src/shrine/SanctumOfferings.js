import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MARKS } from '../data/marks.js';
import { installStaticRaycastTree } from '../render/StaticRaycastTree.js';

const glyphNames=['MarkBar','MarkCircle','MarkDisc','MarkDiamond','MarkTriangle'];
const meshes=root=>{const result=[];root.traverse(o=>{if(o.isMesh)result.push(o);});return result;};
export function registerSanctumOfferings(room){
  if(room.spec.id!=='strata')return room;
  room.ready=Promise.resolve(room.ready).then(()=>installSanctumOfferings(room));
  return room;
}
export async function installSanctumOfferings(room,url='assets/models/adventure/sanctum-offerings-v01.json'){
  if(room.sanctumOfferings?.loaded)return true;
  const art=room.sanctumOfferings={loaded:false,models:[],colliders:[],cameraMeshes:[],legacy:[],orbs:[],altars:[]};
  try{
    const response=await fetch(url);if(!response.ok)throw Error('Offering manifest unavailable');const spec=await response.json(),loader=new GLTFLoader();
    const [asset,marks]=await Promise.all([loader.loadAsync(spec.model),loader.loadAsync('assets/models/adventure/archive-hall-v01.glb')]);
    const parts=Object.fromEntries(['OrbCradle','OfferingCrown','MemoryOrb'].map(name=>[name,asset.scene.getObjectByName(name)]));
    if(Object.values(parts).some(p=>!p)||glyphNames.some(n=>!marks.scene.getObjectByName(n)))throw Error('Offering parts missing');
    if(!room.chronicleCourt?.loaded)throw Error('Grounded court required');
    asset.scene.updateMatrixWorld(true);const base=new T.Box3().setFromObject(parts.OrbCradle,true),orbBox=new T.Box3().setFromObject(parts.MemoryOrb,true);
    if(Math.abs(base.min.y)>.001||Math.abs(base.max.y-.64)>.001||orbBox.getSize(new T.Vector3()).y>.73)throw Error('Offering contact dimensions changed');
    const f=room.final;
    const legacy=f.altars.flatMap(a=>f.group.children.filter(o=>o.isMesh&&Math.abs(o.position.x-a.x)<.001&&((Math.abs(o.position.z-a.z+.5)<.001&&[2,2.95].some(y=>Math.abs(y-o.position.y)<.001))||(Math.abs(o.position.z-a.z)<.001&&o.geometry.type==='TorusGeometry'))));
    if(legacy.length!==15)throw Error('Legacy altar bindings changed');
    art.spec=spec;
    function clone(part,parent,position,camera=true){
      const root=part.clone(true);root.position.copy(position);parent.add(root);art.models.push(root);
      for(const m of meshes(root)){m.material=m.material.clone();m.material.envMapIntensity=.8;m.material.userData.outlineParameters={visible:false};m.castShadow=m.receiveShadow=true;if(camera){installStaticRaycastTree(m);art.cameraMeshes.push(m);}}
      return root;
    }
    function bodies(part,x,z){for(const s of spec.parts[part].solids){const [cx,y,cz]=s.position,[w,h,d]=s.size;art.colliders.push({shape:'box',x0:x+cx-w/2,x1:x+cx+w/2,z0:z+cz-d/2,z1:z+cz+d/2,minY:y-h/2,maxY:y+h/2,padding:.28,escapeZ:1,sanctumOffering:part});}}
    for(const o of f.orbs){
      const support=clone(parts.OrbCradle,room.scene,new T.Vector3(o.x,0,o.z));bodies('OrbCradle',o.x,o.z);
      const model=clone(parts.MemoryOrb,o.mesh,new T.Vector3(),false);
      for(const m of meshes(model))if(m.material.name==='Offering gem'){m.material.color.set(o.c);m.material.emissive.set(o.c);m.material.emissiveIntensity=.10;}
      o.mesh.geometry=o.mesh.geometry.clone();o.mesh.geometry.setDrawRange(0,0);art.orbs.push({orb:o,support,model});
    }
    for(const a of f.altars){
      const root=clone(parts.OfferingCrown,room.scene,new T.Vector3(a.x,0,a.z));bodies('OfferingCrown',a.x,a.z);
      const index=MARKS.findIndex(m=>m.id===a.id),part=marks.scene.getObjectByName(glyphNames[index]);part.updateWorldMatrix(true,true);
      const bounds=new T.Box3().setFromObject(part,true),size=bounds.getSize(new T.Vector3()),scale=Math.min(.80/size.x,.48/size.y);
      const glyph=clone(part,room.scene,new T.Vector3(a.x,2.28-size.y*scale/2,a.z-.32));glyph.scale.setScalar(scale);
      const jewel=meshes(root).find(m=>m.material.name==='Offering gem');art.altars.push({altar:a,root,glyph,jewel});
    }
    // Fixed supports share geometry/materials; keep moving orbs and live jewels independent.
    room.scene.updateMatrixWorld(true);const batches=new Map();
    for(const root of [...art.orbs.map(o=>o.support),...art.altars.map(a=>a.root)])for(const m of meshes(root)){
      if(m.material.name==='Offering gem')continue;
      const key=m.geometry.uuid+':'+m.material.name;
      if(!batches.has(key))batches.set(key,[]);batches.get(key).push(m);
    }
    art.batches=[];
    for(const originals of batches.values()){
      const first=originals[0],mesh=new T.InstancedMesh(first.geometry,first.material,originals.length);
      mesh.name='Offering static '+first.material.name;mesh.castShadow=mesh.receiveShadow=true;
      originals.forEach((m,i)=>{mesh.setMatrixAt(i,m.matrixWorld);m.visible=false;});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();installStaticRaycastTree(mesh);
      room.scene.add(mesh);art.models.push(mesh);art.cameraMeshes=art.cameraMeshes.filter(m=>!originals.includes(m));art.cameraMeshes.push(mesh);art.batches.push({mesh,originals});
    }
    for(const m of legacy){m.geometry=m.geometry.clone();m.geometry.setDrawRange(0,0);}art.legacy=legacy;
    room.obstacles.push(...art.colliders);const rects=room.dungeon.rects;(rects.cameraOccluders??=[]).push(...art.cameraMeshes);
    const floor=rects.floorAt?.bind(rects);rects.floorAt=(x,z,y=0)=>{let h=floor?.(x,z,y)??0;for(const s of art.colliders)if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&y+.26>=s.maxY)h=Math.max(h,s.maxY);return h;};
    art.sync=()=>{for(const m of art.legacy)m.geometry.setDrawRange(0,0);for(const {orb}of art.orbs)orb.mesh.geometry.setDrawRange(0,0);for(const {altar,jewel}of art.altars){jewel.material.color.set(altar.got?altar.color:0x314345);jewel.material.emissive.set(altar.got?altar.color:0);jewel.material.emissiveIntensity=altar.got ? .35 : 0;}};
    const sync=f.syncArt;f.syncArt=()=>{sync?.();art.sync();};
    const resume=room.resume.bind(room);room.resume=actor=>{const result=resume(actor);actor._pushOut(actor.position);actor.syncMesh();actor._camPlaced=false;return result;};
    const all=art.models.flatMap(meshes).filter(m=>m.visible),geometry=new Set(all.map(m=>m.geometry));art.metrics={roots:art.models.length,meshes:all.length,geometries:geometry.size,materials:new Set(all.map(m=>m.material)).size,triangles:all.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.count||1),0),instanceBytes:art.batches.reduce((n,b)=>n+b.mesh.instanceMatrix.array.byteLength,0),colliders:art.colliders.length,cameraMeshes:art.cameraMeshes.length,hidden:art.legacy.length+art.orbs.length};
    art.loaded=true;art.sync();return true;
  }catch(e){art.reason=e.message;console.warn('[sanctum-offerings] original devices retained',e);return false;}
}
