// GLB 로더 — HEAD 프로브 폴백 + DRACO/Meshopt + 툰 변환/정규화. town.html:206-209 패턴 이식.
// 파일이 없으면 null 반환 → 호출부가 절차적 폴백 사용(에셋 0개로도 실행).
import * as THREE from 'three';
import { toonify } from '../rendering/Toon.js';

export async function loadGLB(path) {
  try { const h = await fetch(path, { method: 'HEAD' }); if (!h.ok) return null; } catch (e) { return null; }
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  try {
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
    const d = new DRACOLoader(); d.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
    loader.setDRACOLoader(d);
    const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
    loader.setMeshoptDecoder(MeshoptDecoder);
  } catch (e) { /* 디코더 선택적 */ }
  return new Promise(r => loader.load(path, g => r(g), undefined, () => r(null)));
}

// gltf.scene을 목표 높이로 정규화 + 발끝 y=0 정렬 + (옵션)툰 변환. 반환: 발판 중심·base y=0인 THREE.Group.
export function prepModel(scene, targetH, { toon = true, yaw = 0 } = {}) {
  const model = scene;
  let b = new THREE.Box3().setFromObject(model);
  const s = new THREE.Vector3(); b.getSize(s);
  model.scale.setScalar(targetH / (s.y || 1));
  b = new THREE.Box3().setFromObject(model);
  // XZ 중심을 원점으로, 발끝을 0으로
  const c = new THREE.Vector3(); b.getCenter(c);
  model.position.x -= c.x; model.position.z -= c.z; model.position.y -= b.min.y;
  model.rotation.y += yaw;
  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      if (toon) o.material = Array.isArray(o.material) ? o.material.map(toonify) : toonify(o.material);
    }
  });
  const g = new THREE.Group(); g.add(model);
  return g;
}
