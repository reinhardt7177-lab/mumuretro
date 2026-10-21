import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let source = null;
export async function loadNatureAssets() {
  try { source = (await new GLTFLoader().loadAsync('assets/models/planet-nature-v01.glb')).scene; }
  catch (error) { console.warn('[nature] Using procedural scenery:', error.message); }
}
// Bake the root transform and material plane colours into shared geometry.
// Scatter keeps its existing instance tints, placements, and cell culling.
export function natureGeometry(name) {
  const root = source?.getObjectByName(name);
  if (!root) return null;
  source.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const positions=[], normals=[], colours=[];
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    const p=g.attributes.position,n=g.attributes.normal;
    const color=o.material.color;
    for(let i=0;i<p.count;i++) {
      positions.push(p.getX(i),p.getY(i),p.getZ(i));
      normals.push(n.getX(i),n.getY(i),n.getZ(i));
      colours.push(color.r,color.g,color.b);
    }
    g.dispose();
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
  return g;
}
export function naturePart(name) {
  const found=source?.getObjectByName(name);
  if(!found)return null;
  const part=found.clone(true);
  part.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;o.material.userData.outlineParameters={visible:false};}});
  return part;
}
