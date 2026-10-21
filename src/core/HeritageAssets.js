import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loaded = new Map(), pending = new Map();
const loader = new GLTFLoader();
export function loadHeritageAsset(id) {
  if (loaded.has(id)) return Promise.resolve(loaded.get(id));
  if (!pending.has(id)) pending.set(id, loader.loadAsync(`assets/models/heritage/${id}.glb`).then(gltf => {
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.userData.outlineParameters = { visible: false };
    });
    loaded.set(id, gltf.scene); return gltf.scene;
  }).catch(error => { pending.delete(id); console.warn(`[heritage] ${id}: ${error.message}`); return null; }));
  return pending.get(id);
}
export async function loadHeritageCore() {
  await Promise.all(['weight-exterior', 'glacier-temple', 'explorer-notebook'].map(loadHeritageAsset));
}
export function heritagePart(id) {
  const source = loaded.get(id);
  if (!source) return null;
  const group = source.clone(true); group.name = `heritage-${id}`;
  group.userData.heritageAsset = id; return group;
}
// Outdoor landmarks retain their old collision/interaction footprint.
// Their underside is exactly local y=0; surface frames supply the planet normal.
export function fitHeritageFootprint(id, radius) {
  const group = heritagePart(id); if (!group) return null;
  // Authored entrances face -Z; the web shrine's entry direction is +Z.
  group.rotation.y = Math.PI;
  const box = new THREE.Box3().setFromObject(group), center = box.getCenter(new THREE.Vector3());
  const r = Math.hypot((box.max.x - box.min.x) / 2, (box.max.z - box.min.z) / 2);
  const scale = radius / Math.max(r, 0.001); group.scale.setScalar(scale);
  group.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  return group;
}
export function fitHeritageHeight(id, height, yaw = Math.PI) {
  const group = heritagePart(id); if (!group) return null;
  const model = new THREE.Group(); model.add(group);
  const box = new THREE.Box3().setFromObject(group), center = box.getCenter(new THREE.Vector3());
  const scale = height / (box.max.y - box.min.y); group.scale.setScalar(scale);
  group.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  model.rotation.y = yaw; model.name = group.name; model.userData.heritageAsset = id; return model;
}
