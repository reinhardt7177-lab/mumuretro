import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MARKS} from '../data/marks.js';
let source;
function load(){return source??=(new GLTFLoader()).loadAsync('assets/models/chronicle-temple/guardian-v01.glb').catch(e=>{source=null;throw e;});}

// Keep the puzzle's original live materials, so in-flight awakening/restores
// cannot disagree with asynchronously arriving artwork.
export async function attachChronicleArt(scene,device,legacy,centre){
 const gltf=await load(),root=gltf.scene.clone(true);root.name='Chronicle Guardian · Blender';root.position.set(centre,0,device.gz);const occluders=[];
 root.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;o.userData.partitionedSolid=true;o.material=o.material.clone();o.material.userData.outlineParameters={visible:false};occluders.push(o);}});
 for(let i=0;i<2;i++){const eye=root.getObjectByName('ChronicleEye'+i);if(!eye?.isMesh)throw Error('Chronicle eye binding missing');eye.material=device.eyeMats[i];}
 const seals=[];
 for(let i=0;i<5;i++){
  const seal=root.getObjectByName('ChronicleSeal'+i),glyph=root.getObjectByName('ChronicleGlyph'+i);
  if(!seal?.isMesh||!glyph?.isMesh)throw Error('Chronicle seal binding missing');
  seal.material=new THREE.MeshBasicMaterial({color:0x2a2430});seal.material.userData.outlineParameters={visible:false};
  glyph.material=new THREE.MeshBasicMaterial({color:0x21191e});glyph.material.userData.outlineParameters={visible:false};
  seals.push({id:MARKS[i].id,mesh:seal,material:seal.material,glyph});
 }
 device.syncArt=()=>{legacy.forEach(o=>o.visible=false);for(const s of seals){const a=device.altars.find(a=>a.id===s.id);s.material.color.set(a?.got?a.color:0x2a2430);}};
 scene.add(root);device.art=root;device.memorySeals=seals;device.cameraOccluders=occluders;device.artReady=true;device.syncArt();
 return root;
}
