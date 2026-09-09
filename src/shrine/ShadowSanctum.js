import * as THREE from 'three';
import { SHADOW_SANCTUM as D } from '../data/shadowSanctum.js';
import { SANCTUM_PALETTE as C } from '../data/lighting.js';
import { godEyes } from './GodEyes.js';
import { projectStatue, shadowBoundary, sanctumProgress } from './SanctumOptics.js';

export function buildShadowSanctum(scene, seg, rects, g, legacyCodec) {
  const group = new THREE.Group(); group.name = '방향과 높이의 신전'; scene.add(group);
  const cameraOccluders = [], obstacles = [], batches = new Map(), cube = new THREE.BoxGeometry(1, 1, 1);
  const lit = (color, metalness = 0) => { const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, roughness: 0.75, metalness });
    m.userData.outlineParameters = { visible: false }; return m; };
  const flat = color => { const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }); m.userData.outlineParameters = { visible: false }; return m; };
  const stone = lit(C.stone), pale = lit(C.pale), recess = lit(C.recess), brass = lit(C.brass, 0.3), gold = lit(C.gold, 0.3), metal = lit(C.metal, 0.65);
  const floor = flat(C.floor), rim = flat(C.floorRim), ink = flat(C.shadow), lampMat = flat(C.lamp), dark = lit(C.dark);
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0, solid = false) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); if (solid) cameraOccluders.push(m); return m;
  };
  const box = (w, h, d, x, y, z, mat, solid = false) => {
    const key = `${mat.uuid}/${solid}`; if (!batches.has(key)) batches.set(key, { mat, solid, items: [] });
    batches.get(key).items.push({ w, h, d, x, y, z });
  };
  const cz = (seg.z0 + seg.z1) / 2;
  box(D.width, 0.1, D.length, 0, -0.05, cz, rim);
  for (let x = -10; x <= 10; x += 2) for (let z = -7; z <= 7; z += 2) box(1.98, 0.016, 1.98, x, -0.006, cz + z, (x + z + 17) % 4 ? rim : floor);
  mesh(new THREE.CircleGeometry(D.floorRadius, 64), floor, group, 0, 0.006, cz).rotation.x = -Math.PI / 2;
  mesh(new THREE.RingGeometry(D.floorRadius, D.floorRadius + 0.07, 64), brass, group, 0, 0.01, cz).rotation.x = -Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, m = mesh(new THREE.BoxGeometry(0.065, 0.012, 0.38), brass, group, Math.cos(a) * 6.92, 0.009, cz + Math.sin(a) * 6.92);
    m.rotation.y = Math.PI / 2 - a;
  }
  // 열린 옆 회랑과 뒤쪽 아치. 중앙의 그림자 판 위에는 기둥을 세우지 않는다.
  const shape = new THREE.Shape(); shape.absarc(0, 0, 1.95, 0, Math.PI, false); shape.lineTo(-1.68, 0);
  shape.absarc(0, 0, 1.68, Math.PI, 0, true); shape.closePath();
  const archGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false, curveSegments: 16 }); archGeo.translate(0, 0, -0.25);
  for (const side of [-1, 1]) {
    box(0.5, 0.7, 16, side * 11.2, 0.35, cz, stone, true);
    for (const dz of [-5.8, -1.9, 2]) {
      const arch = mesh(archGeo, pale, group, side * 9.5, 3.2, cz + dz, true); arch.rotation.y = Math.PI / 2;
      for (const e of [-1.8, 1.8]) {
        box(0.55, 3.2, 0.42, side * 9.5, 1.6, cz + dz + e, stone, true);
        obstacles.push({ x: side * 9.5, z: cz + dz + e, r: 0.77 });
      }
    }
    box(0.7, D.trackY - 0.6, 0.7, side * 8, (D.trackY - 0.6) / 2, cz - 6.9, stone, true);
    box(0.92, 0.23, 0.92, side * 8, D.trackY - 0.54, cz - 6.9, gold, true);
    obstacles.push({ x: side * 8, z: cz - 6.9, r: 0.94 });
  }
  for (const x of [-5.7, -1.9, 1.9, 5.7]) {
    mesh(archGeo, pale, group, x, 3.2, seg.z0 - 0.22, true);
    for (const e of [-1.8, 1.8]) box(0.42, 3.2, 0.5, x + e, 1.6, seg.z0 - 0.22, stone, true);
  }
  // 앞방에서 보이는 연결부도 같은 돌과 황동으로 잇는다. 문 판정은 그대로다.
  for (const m of scene.children) if (m.userData.doorFrame === 'r3') {
    m.material = m.geometry.parameters.height > 2 ? stone : gold; cameraOccluders.push(m);
  }
  const track = mesh(new THREE.TorusGeometry(D.orbitRadius, 0.035, 6, 64), brass, group, 0, D.trackY, cz, true); track.rotation.x = Math.PI / 2;
  box(16, 0.09, 0.09, 0, D.trackY, cz, brass, true);
  for (const side of [-1, 1]) box(0.09, 0.09, 6.9, side * 8, D.trackY, cz - 3.45, brass, true);

  // 옛 석상은 저장 검증을 위해 보존한다. 새 석상의 정점에서 새 그림자를 만든다.
  g.group.removeFromParent(); g.group = new THREE.Group(); group.add(g.group); g.gx = 0; g.gz = cz;
  const statue = new THREE.Group(); statue.position.z = cz; statue.scale.y = D.statueHeightScale; g.group.add(statue);
  mesh(new THREE.CylinderGeometry(1.3, D.bodyRadius, 0.32, 8), recess, statue, 0, 0.16, 0, true);
  mesh(new THREE.CylinderGeometry(0.88, 0.64, 1.95, 8), stone, statue, 0, 1.315, 0, true);
  mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.12, 8), gold, statue, 0, 2.255, 0, true);
  mesh(new THREE.CylinderGeometry(0.23, 0.3, 0.34, 8), recess, statue, 0, 2.45, 0, true);
  mesh(new THREE.OctahedronGeometry(0.62), pale, statue, 0, 2.9, 0, true);
  for (const side of [-1, 1]) {
    const arm = mesh(new THREE.BoxGeometry(0.3, 0.9, 0.4), pale, statue, side * 0.88, 1.85, 0.25, true); arm.rotation.z = side * 0.4;
    mesh(new THREE.BoxGeometry(0.35, 0.22, 0.54), stone, statue, side * 0.72, 1.56, 0.56, true);
  }
  const shield = mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.12, 24), metal, statue, 0, 1.86, 0.83, true); shield.rotation.x = Math.PI / 2;
  const rimMat = gold.clone(); rimMat.polygonOffset = true; rimMat.polygonOffsetFactor = -1; rimMat.polygonOffsetUnits = -1;
  const shieldRim = mesh(new THREE.RingGeometry(0.58, 0.64, 24), rimMat, statue, 0, 1.86, 0.89);
  // 고리의 그림자는 별도 볼록 외피로 채우지 않는다. 이미 불투명 거울 면 안에 있다.
  shieldRim.userData.surfaceDetail = true;
  g.eyes = godEyes(statue, 0, 2.94, 0.48, 0.22, 0.27, 0.1);
  obstacles.push({ x: 0, z: cz, r: D.bodyClearance }); g.obstacles = [];
  const casterMeshes = []; statue.traverse(m => { if (m.isMesh && !m.userData.surfaceDetail) casterMeshes.push(m); });
  for (const m of casterMeshes) if (!cameraOccluders.includes(m)) cameraOccluders.push(m);
  scene.updateMatrixWorld(true);
  const parts = casterMeshes.map(m => {
    const a = m.geometry.attributes.position, vertices = [];
    for (let i = 0; i < a.count; i++) vertices.push(new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld));
    return vertices;
  });
  const bounds = { x0: seg.x0 + 0.4, x1: seg.x1 - 0.4, z0: seg.z0 + 0.4, z1: seg.z1 - 0.4 };
  const cache = new Map();
  const lampAt = (a, h) => { const d = g._dir(a); return { x: -d.x * D.orbitRadius, y: D.lampHeights[h], z: cz - d.z * D.orbitRadius }; };
  const polygonsAt = (a, h) => { const key = `${a}/${h}`; if (!cache.has(key)) cache.set(key, projectStatue(parts, lampAt(a, h), bounds)); return cache.get(key); };
  g.shadow = mesh(new THREE.BufferGeometry(), ink, g.group); g.shadow.renderOrder = 2; g.shadow.frustumCulled = false;
  g.markMat = flat(C.target); g.mark = mesh(new THREE.BufferGeometry(), g.markMat, g.group); g.mark.renderOrder = 3; g.mark.frustumCulled = false;
  const fill = polygons => {
    const positions = []; for (const p of polygons) for (let i = 1; i < p.length - 1; i++) for (const v of [p[0], p[i], p[i + 1]]) positions.push(v.x, D.shadowY, v.z);
    g.shadow.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.shadow.geometry.computeBoundingSphere();
  };
  const drawMark = () => {
    const positions = [], edgeList = shadowBoundary(polygonsAt(g.answer.a, g.answer.h));
    for (const [a, b] of edgeList) {
      const dx = b.x - a.x, dz = b.z - a.z, k = D.markWidth / (2 * Math.hypot(dx, dz)), x = dz * k, z = -dx * k;
      const corners = [[a.x + x, a.z + z], [a.x - x, a.z - z], [b.x - x, b.z - z], [b.x + x, b.z + z]];
      for (const i of [0, 1, 2, 0, 2, 3]) positions.push(corners[i][0], D.markY, corners[i][1]);
    }
    g.mark.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.mark.geometry.computeBoundingSphere(); return edgeList;
  };
  const lampRig = new THREE.Group(); g.group.add(lampRig);
  g.lampBall = mesh(new THREE.SphereGeometry(0.22, 16, 12), lampMat, lampRig);
  const hanger = mesh(new THREE.CylinderGeometry(0.032, 0.032, 1, 6), brass, lampRig, 0, 1, 0, true);
  for (const y of [-0.32, 0.32]) mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12), gold, lampRig, 0, y, 0, true);
  g.lamp = new THREE.PointLight(C.lamp, 75, 26, 2); g.group.add(g.lamp);
  const control = x => {
    const grp = new THREE.Group(), z = seg.z1 - D.controlEntry; grp.position.set(x, 0, z); group.add(grp);
    mesh(new THREE.CylinderGeometry(0.68, 0.83, 0.24, 12), recess, grp, 0, 0.12, 0, true);
    mesh(new THREE.CylinderGeometry(0.24, 0.36, 0.8, 8), stone, grp, 0, 0.63, 0, true);
    obstacles.push({ x, z, r: 1.13 }); return { x, z, grp };
  };
  g.leverA = control(-D.controlX); g.leverB = control(D.controlX);
  const wheel = new THREE.Group(); wheel.position.y = 1.17; g.leverA.grp.add(wheel);
  mesh(new THREE.TorusGeometry(0.61, 0.08, 8, 32), gold, wheel, 0, 0, 0, true).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, m = mesh(new THREE.BoxGeometry(0.075, 0.06, 0.54), brass, wheel, Math.sin(a) * 0.28, 0, Math.cos(a) * 0.28, true); m.rotation.y = a;
    mesh(new THREE.BoxGeometry(0.08, 0.07, 0.12), pale, g.leverA.grp, Math.sin(a) * 0.77, 1.1, Math.cos(a) * 0.77);
  }
  g.leverA.knob = mesh(new THREE.SphereGeometry(0.12, 10, 8), lampMat, wheel, -0.58, 0.09, 0);
  const heightRail = mesh(new THREE.BoxGeometry(0.14, 1.15, 0.16), brass, g.leverB.grp, 0, 1.37, 0, true);
  for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.52, 0.06, 0.19), pale, g.leverB.grp, 0, 0.98 + i * 0.39, 0, true);
  g.leverB.knob = mesh(new THREE.BoxGeometry(0.68, 0.14, 0.24), gold, g.leverB.grp, 0, 0.98, 0.12, true);
  const reward = mesh(new THREE.RingGeometry(0.7, 0.78, 32), flat(C.brass), group, g.prizePos.x, 0.014, g.prizePos.z); reward.rotation.x = -Math.PI / 2;
  const api = {
    group, statue, casterMeshes, parts, bounds, obstacles, cameraOccluders, lampAt, polygonsAt, wheel, heightRail, legacyCompleted: false,
    targetEdges: drawMark(),
    lengthAt(a, h) { const d = g._dir(a); return Math.max(...polygonsAt(a, h).flat().map(p => p.x * d.x + (p.z - cz) * d.z)); },
    apply() {
      const L = lampAt(g.ai, g.hi); lampRig.position.set(L.x, L.y, L.z); g.lamp.position.copy(lampRig.position);
      const length = D.trackY - L.y; hanger.scale.y = length; hanger.position.y = length / 2;
      fill(polygonsAt(g.ai, g.hi)); wheel.rotation.y = -g.ai * Math.PI / 4; g.leverB.knob.position.y = 0.98 + g.hi * 0.39;
      g.solved = g.ai === g.answer.a && g.hi === g.answer.h;
      g.markMat.color.set(g.solved || this.legacyCompleted ? C.complete : C.target); this.update();
    },
    update() { reward.material.color.set(g.solved || this.legacyCompleted ? C.complete : C.brass); },
    completeLegacy() { this.legacyCompleted = true; g.eyes.restore(1); this.apply(); },
    restart() { this.legacyCompleted = false; },
  };
  g.sanctum = api; api.apply(); g.progressCodec = sanctumProgress(g, legacyCodec);
  const dummy = new THREE.Object3D();
  for (const { mat, solid, items } of batches.values()) {
    const m = new THREE.InstancedMesh(cube, mat, items.length); items.forEach((v, i) => { dummy.position.set(v.x, v.y, v.z); dummy.scale.set(v.w, v.h, v.d); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    group.add(m); if (solid) cameraOccluders.push(m);
  }
  rects.cameraOccluders = [...(rects.cameraOccluders || []), ...cameraOccluders]; rects.cameraLiftZones = [...(rects.cameraLiftZones || []), seg];
  rects.cameraLookHeightZones = [...(rects.cameraLookHeightZones || []), { ...seg, lookHeight: D.lookHeight }];
  return api;
}
