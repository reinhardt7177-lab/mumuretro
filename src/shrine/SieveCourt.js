import * as THREE from 'three';
import { SIEVE_COURT as D } from '../data/sieveCourt.js';
import { SIEVE_PALETTE as C } from '../data/lighting.js';
import { sieveProgress } from './SieveProgress.js';
import { buildSieveMotion } from './SieveMotion.js';

export function buildSieveCourt(scene, seg, rects, g, legacy) {
  const orders = [...g.orders], group = new THREE.Group(); group.name = '체와 두 접시의 작업장';
  g.group.removeFromParent(); g.group = group; scene.add(group);
  const cameraOccluders = [], obstacles = [], batches = new Map(), cube = new THREE.BoxGeometry(1, 1, 1);
  const material = color => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.86, emissive: color, emissiveIntensity: 0.35 });
    m.userData.outlineParameters = { visible: false }; return m; };
  const floor = material(C.floor), alt = material(C.floorAlt), stone = material(C.stone), pale = material(C.pale), wood = material(C.wood), edge = material(C.edge), brass = material(C.brass), wire = material(C.mesh);
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0, solid = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = solid; m.receiveShadow = true; parent.add(m);
    if (solid) cameraOccluders.push(m); return m;
  };
  const box = (w, h, d, x, y, z, mat, solid = true) => {
    const key = mat.uuid + solid; if (!batches.has(key)) batches.set(key, { mat, solid, items: [] });
    batches.get(key).items.push({ w, h, d, x, y, z });
  };
  const cz = (seg.z0 + seg.z1) / 2;
  box(D.width, 0.12, D.length, 0, -0.06, cz, stone, false);
  for (let x = -5; x <= 5; x += 2) for (let z = -5; z <= 5; z += 2) box(1.97, 0.024, 1.97, x, -0.004, cz + z, (x + z) % 4 ? floor : alt, false);
  for (const side of [-1, 1]) {
    box(0.42, 0.62, D.length, side * 6.2, 0.31, cz, stone);
    for (const dz of [-5.8, 0, 5.8]) {
      box(0.6, 3.5, 0.6, side * 6.2, 1.75, cz + dz, pale);
      box(0.83, 0.2, 0.83, side * 6.2, 3.57, cz + dz, stone);
    }
    box(0.48, 0.25, D.length, side * 6.2, 3.82, cz, pale);
  }
  for (const m of scene.children) if (m.userData.doorFrame === 'r1') m.material = pale;
  // 둥근 테두리 안이 빈 작업대. 알갱이를 가리는 불투명 상판은 놓지 않는다.
  const { x: fx, z: fz } = g.frame;
  for (const side of [-1, 1]) {
    box(0.22, D.tableY - 0.05, 0.24, fx + side * 1.42, (D.tableY - 0.05) / 2, fz - 1.32, wood);
    box(0.22, D.tableY - 0.05, 0.24, fx + side * 1.42, (D.tableY - 0.05) / 2, fz + 1.32, wood);
    box(0.27, 0.22, 3.1, fx + side * 1.42, D.tableY - 0.13, fz, wood);
    box(2.9, 0.22, 0.24, fx, D.tableY - 0.13, fz + side * 1.42, wood);
  }
  mesh(new THREE.TorusGeometry(D.radius + 0.05, 0.055, 6, 48), brass, group, fx, D.tableY - 0.03, fz).rotation.x = Math.PI / 2;
  obstacles.push({ x: fx, z: fz, r: D.tableClearance });
  // 받침 접시는 낮고 손이 닿는다. 물리 충돌은 손보다 짧다.
  const { x: tx, z: tz } = g.tray;
  for (const dx of [-0.4, 0, 0.4]) obstacles.push({ x: tx + dx, z: tz, r: 1.08 });
  box(2.45, 0.12, 1.55, tx, 0.06, tz, wood);
  for (const side of [-1, 1]) {
    box(0.09, 0.2, 1.65, tx + side * 1.22, 0.2, tz, edge);
    box(2.45, 0.2, 0.09, tx, 0.2, tz + side * 0.79, edge);
    mesh(new THREE.TorusGeometry(0.18, 0.045, 5, 12), brass, group, tx + side * 1.35, 0.22, tz).rotation.y = Math.PI / 2;
  }
  // 체 아래에서 앞 접시까지 끊기지 않는 경사받이.
  const rise = D.tableY - 0.18 - (D.trayY + 0.04), chuteY = (D.tableY - 0.18 + D.trayY + 0.04) / 2;
  const chuteLength = Math.hypot(2.45, rise);
  const chute = mesh(new THREE.BoxGeometry(2.2, 0.065, chuteLength), edge, group, fx, chuteY, fz + 1.05);
  chute.rotation.x = Math.atan2(rise, 2.45);
  const chuteEdge = new THREE.BoxGeometry(0.055, 0.16, chuteLength);
  for (const side of [-1, 1]) { const m = mesh(chuteEdge, brass, group, fx + side * 1.08, chuteY + 0.04, fz + 1.05); m.rotation.x = chute.rotation.x; }
  // 교환 가능한 체. 살 사이 실제 빈 간격 = 게임 mm 판정 × 공통 축척.
  g.sieves.forEach((s, i) => {
    s.x = D.stockX; s.z = seg.z1 - D.stockOffsets[i]; s.home.set(s.x, D.stockY, s.z);
    s.grp = new THREE.Group(); group.add(s.grp);
    mesh(new THREE.TorusGeometry(D.radius, 0.07, 8, 48), brass, s.grp).rotation.x = Math.PI / 2;
    const hole = s.spec.mm * D.mmScale, pitch = hole + D.bar, parts = [];
    for (let k = -Math.ceil(D.meshRadius / pitch); k <= Math.ceil(D.meshRadius / pitch); k++) {
      const t = (k + 0.5) * pitch; if (Math.abs(t) >= D.meshRadius) continue;
      const length = 2 * Math.sqrt(D.meshRadius ** 2 - t ** 2);
      parts.push([D.bar, 0.035, length, t, 0], [length, 0.035, D.bar, 0, t]);
    }
    const bars = new THREE.InstancedMesh(cube, wire, parts.length), dummy = new THREE.Object3D();
    parts.forEach(([w, h, d, x, z], j) => { dummy.position.set(x, 0, z); dummy.scale.set(w, h, d); dummy.updateMatrix(); bars.setMatrixAt(j, dummy.matrix); });
    bars.castShadow = true; bars.receiveShadow = true; s.grp.add(bars); cameraOccluders.push(bars);
    s.aperture = hole; s.meshBars = bars;
    box(2.7, 0.18, 1.1, s.x, 0.55, s.z, wood);
    for (const side of [-1, 1]) box(0.14, 0.5, 0.85, s.x + side * 1.05, 0.25, s.z, edge);
    obstacles.push({ x: s.x, z: s.z, r: 0.84 });
  });
  g.above = new THREE.Group(); g.above.position.set(fx, D.tableY + 0.04, fz); group.add(g.above);
  g.below = new THREE.Group(); g.below.position.set(tx, D.trayY, tz); group.add(g.below);
  g.grainMesh = [];
  g.grainTypes.forEach(({ mm, color }, gi) => {
    const size = mm * D.mmScale, mat = material(color);
    const geo = new THREE.IcosahedronGeometry(1, 0); geo.computeBoundingBox();
    const scale = size / (geo.boundingBox.max.x - geo.boundingBox.min.x); geo.scale(scale, scale, scale); geo.computeBoundingBox();
    for (let k = 0; k < 9; k++) {
      const m = mesh(geo, mat, g.above, 0, 0, 0, false);
      g.grainMesh.push({ gi, mesh: m, size, k });
    }
  });
  // 알갱이 크기 자체가 주문 표지다. 세 점은 성공한 주문 수만 기록한다.
  box(2.55, 0.8, 0.18, fx, 2.35, fz - 1.6, pale);
  g.orderDots = [0.42, 0.27, 0.12].map((size, i) => mesh(new THREE.BoxGeometry(size, size, 0.08), material(C.edge), group, fx - 0.7 + i * 0.7, 2.45, fz - 1.48, false));
  g.pips = [0, 1, 2].map(i => mesh(new THREE.SphereGeometry(0.065, 8, 6), material(C.edge), group, fx - 0.3 + i * 0.3, 2.10, fz - 1.48, false));
  g.slotMat = material(C.brass); g.trayMat = material(C.brass);
  mesh(new THREE.BoxGeometry(0.8, 0.04, 0.1), g.slotMat, group, fx, D.tableY + 0.02, fz + 1.45, false);
  mesh(new THREE.BoxGeometry(0.75, 0.04, 0.08), g.trayMat, group, tx, 0.32, tz + 0.79, false);
  const api = {
    group, cameraOccluders, obstacles,
    sync() {
      const sv = g.fitted >= 0 ? g.sieves[g.fitted].spec : null, up = g._aboveSet(sv);
      g.sieves.forEach((s, i) => {
        if (g.held === s) { s.grp.rotation.x = 0; return; }
        s.grp.position.copy(i === g.fitted ? new THREE.Vector3(fx, D.tableY, fz) : s.home);
        s.grp.rotation.set(i === g.fitted ? 0 : Math.PI / 3, 0, 0);
      });
      for (const gm of g.grainMesh) {
        const above = up.has(gm.gi), parent = above ? g.above : g.below;
        if (gm.mesh.parent !== parent) parent.add(gm.mesh);
        gm.mesh.visible = g.mix.has(gm.gi);
        gm.mesh.position.set((gm.k % 3 - 1) * 0.57 + gm.gi * 0.08, gm.size / 2 + (above ? gm.gi * 0.055 : 0),
          (Math.floor(gm.k / 3) - 1) * (above ? 0.57 : D.traySpread) + (above ? 0 : D.trayForward));
      }
      g._paintOrder(); g.pips.forEach((p, i) => p.material.color.set(i < g.round ? C.gold : C.edge));
      g.slotMat.color.set(g.solved ? C.gold : C.brass);
      g.trayMat.color.set(sv && g._belowSet().size ? C.gold : C.brass);
    },
  };
  const motion = buildSieveMotion(g, group);
  api.motion = motion;
  api.playSifting = (sieve, mix) => motion.play(sieve, mix);
  api.update = dt => { api.sync(); motion.update(dt); };
  g.workshop = api; api.sync(); g.progressCodec = sieveProgress(g, legacy, orders);
  const dummy = new THREE.Object3D();
  for (const { mat, solid, items } of batches.values()) {
    const m = new THREE.InstancedMesh(cube, mat, items.length);
    items.forEach((v, i) => { dummy.position.set(v.x, v.y, v.z); dummy.scale.set(v.w, v.h, v.d); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.castShadow = solid; m.receiveShadow = true; group.add(m); if (solid) cameraOccluders.push(m);
  }
  rects.cameraOccluders = [...(rects.cameraOccluders || []), ...cameraOccluders];
  rects.cameraLiftZones = [...(rects.cameraLiftZones || []), seg];
  return api;
}
