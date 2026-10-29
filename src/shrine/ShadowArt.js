import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let pending;
function assets(){return pending??=fetch('assets/models/adventure/moon-optics-v01.json').then(async response=>{
  if(!response.ok)return null;const spec=await response.json(),gltf=await new GLTFLoader().loadAsync(spec.model);gltf.scene.updateMatrixWorld(true);
  return{spec,source:gltf.scene};
}).catch(error=>{console.warn('[shadow-art] retained existing devices',error);return null;});}
export function registerShadowArt(room){
  if(room.spec.id!=='shadow')return room;
  const record=room.shadowArt={loaded:false,models:[],ready:null};
  record.ready=assets().then(asset=>{
    if(!asset)return false;const {source,spec}=asset,rects=room.dungeon.rects;
    const parts={};for(const name of Object.keys(spec.parts)){parts[name]=source.getObjectByName(name);if(!parts[name])return false;}
    function add(name,parent,position){const group=parts[name].clone(true);group.name='Moon art '+name;group.userData.shadowArt=name;if(position)group.position.copy(position);parent.add(group);
      group.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=false;o.material.userData.outlineParameters={visible:false};(rects.cameraOccluders??=[]).push(o);});record.models.push(group);return group;}
    const slots=room.gallery.artSlots;
    // Shared pedestal geometry, four material draws for all five foundations.
    for(const child of parts.MirrorPedestal.children){if(!child.isMesh)continue;const mesh=new T.InstancedMesh(child.geometry,child.material,slots.pedestalPositions.length),matrix=new T.Matrix4();
      slots.pedestalPositions.forEach((p,i)=>{matrix.makeTranslation(p.x,0,p.z).multiply(child.matrixWorld);mesh.setMatrixAt(i,matrix);});mesh.name='Moon art instanced pedestals';mesh.userData.shadowArt='MirrorPedestal';room.gallery.group.add(mesh);rects.cameraOccluders.push(mesh);record.models.push(mesh);}
    for(const mesh of slots.oldPedestals)mesh.visible=false;
    for(const slot of slots.mirrors){
      for(const mesh of slot.frameParts)mesh.visible=false;add('MirrorFrame',slot.pivot);
      const holder=new T.Group();holder.position.copy(slot.handle.position);holder.rotation.copy(slot.handle.rotation);slot.control.add(holder);add('MirrorWheel',holder);slot.handle.visible=false;slot.mirror.controlHandle=holder;
    }
    const lamp=room.gates[0].gate.lampBall;for(const child of lamp.children)child.visible=false;add('ShadeLantern',lamp);
    const theatre=room.silhouetteCourt;for(const mesh of theatre.baseParts)mesh.visible=false;add('PanelBase',theatre.carriage);
    rects.cameraSubjectZones=room.gates.map(g=>({...g.gate.seg}));record.loaded=true;record.spec=spec;return true;
  });
  room.ready=Promise.all([room.ready,record.ready]);return room;
}
