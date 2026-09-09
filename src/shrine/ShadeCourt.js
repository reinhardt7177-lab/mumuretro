import * as THREE from 'three';
import { SHADE_COURT as D } from '../data/shadeCourt.js';
import { SHADE_PALETTE as C } from '../data/lighting.js';
import { projectShade, insideShade, shadeProgress } from './ShadeProjection.js';

export function buildShadeCourt(scene, seg, rects, gate, legacyCodec) {
  const group = new THREE.Group(); group.name = '움직이는 그림자 회랑'; scene.add(group);
  const cz = (seg.z0 + seg.z1) / 2, cameraOccluders = [], obstacles = [];
  const lit = color => {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.24, roughness: 0.85 });
    m.userData.outlineParameters = { visible: false }; return m;
  };
  const flat = (color, opacity = 1) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
    m.userData.outlineParameters = { visible: false }; return m;
  };
  const stone = lit(C.stone), pale = lit(C.stoneLight), recess = lit(C.stoneShade), brass = lit(C.brass), gold = lit(C.brassLight);
  const floor = flat(C.floor), floorAlt = flat(C.floorAlt), shade = flat(C.shade), lampMat = flat(C.lamp);
  const cube = new THREE.BoxGeometry(1, 1, 1), batches = new Map(), dummy = new THREE.Object3D();
  const batch = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, yaw = 0, solid = false) => {
    const key = `${geo.uuid}/${mat.uuid}`;
    if (!batches.has(key)) batches.set(key, { geo, mat, items: [], solid: false });
    const b = batches.get(key); b.items.push({ x, y, z, sx, sy, sz, yaw }); b.solid ||= solid;
  };
  const box = (w, h, d, x, y, z, mat, solid = false, yaw = 0) => batch(cube, mat, x, y, z, w, h, d, yaw, solid);
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0, solid = false) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); if (solid) cameraOccluders.push(m); return m;
  };
  // 바닥은 조명을 받지 않는다. 달빛·장식물의 별도 그림자가 안전한 길처럼 보이지 않게 한다.
  box(D.width, 0.1, D.length, 0, -0.05, cz, floor);
  for (let x = -6; x <= 6; x += 2) for (let dz = -7; dz <= 7; dz += 2) {
    box(1.985, 0.02, 1.985, x, -0.009, cz + dz, (x + dz + 15) % 4 ? floor : floorAlt);
  }
  gate.safeIn = seg.z1 - D.safeDepth; gate.safeOut = seg.z0 + D.safeDepth;
  for (const end of [-1, 1]) {
    box(D.width, 0.018, D.safeDepth, 0, 0.007, cz + end * (D.length - D.safeDepth) / 2, shade);
    // 대기 공간은 바닥 재질로 읽힌다. 진행 방향·정답 경로를 그리지 않는다.
    for (const side of [-1, 1]) box(0.11, 0.016, 1.4, side * 5.8, 0.02, cz + end * 6.85, brass);
  }
  const archShape = new THREE.Shape();
  archShape.absarc(0, 0, 1.82, 0, Math.PI, false); archShape.lineTo(-1.53, 0);
  archShape.absarc(0, 0, 1.53, Math.PI, 0, true); archShape.closePath();
  const arch = new THREE.ExtrudeGeometry(archShape, { depth: 0.55, bevelEnabled: false, curveSegments: 12 });
  arch.translate(0, 3, -0.275);
  for (const side of [-1, 1]) {
    const x = side * 7.27;
    box(0.55, 1.05, 16.4, x, 0.525, cz, stone, true);
    box(0.7, 0.16, 16.6, x, 1.12, cz, pale, true);
    for (const dz of [-5.9, -2, 1.9, 5.8]) {
      batch(arch, pale, x, 0, cz + dz, 1, 1, 1, Math.PI / 2, true);
      for (const offset of [-1.68, 1.68]) {
        box(0.62, 3.0, 0.44, x, 1.5, cz + dz + offset, stone, true);
        box(0.78, 0.22, 0.7, x, 2.94, cz + dz + offset, pale, true);
      }
    }
    for (const end of [-1, 1]) {
      box(0.65, 6.8, 0.65, side * 6.1, 3.4, cz + end * 7.7, stone, true);
      box(0.95, 0.25, 0.95, side * 6.1, 6.65, cz + end * 7.7, gold, true);
    }
  }
  // 방 위 타원 레일과 이동하는 등불. 어느 물체가 그림자를 움직이는지 보이게 한다.
  const track = mesh(new THREE.TorusGeometry(1, 0.022, 6, 64), brass, group, 0, D.trackY, cz, true);
  track.rotation.x = Math.PI / 2; track.scale.set(D.orbitX, D.orbitZ, 1);
  for (const side of [-1, 1]) box(0.18, 0.18, 15.4, side * 6.1, D.trackY, cz, brass, true);

  // 옛 노드들은 저장 검증용으로만 남긴다. 장치 간 난수 소비 순서는 바꾸지 않는다.
  gate.group.removeFromParent(); gate.group = new THREE.Group(); group.add(gate.group);
  const levels = D.pillarBands.length - 1;
  const cylinder = new THREE.CylinderGeometry(D.pillarRadius, D.pillarRadius, D.pillarHeight, D.pillarSides, levels);
  const vertices = cylinder.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const row = Math.round((0.5 - vertices.getY(i) / D.pillarHeight) * levels);
    vertices.setY(i, (D.pillarBands[row] - 0.5) * D.pillarHeight);
  }
  cylinder.clearGroups();
  // 기둥 표면의 재질 띠. 밖으로 튀어나온 장식을 더하지 않아 투영 실루엣은 그대로다.
  const row = D.pillarSides * 6;
  const original = Array.from(cylinder.index.array), horizontal = [];
  for (let y = 0; y < levels; y++) for (let x = 0; x < D.pillarSides; x++) horizontal.push(...original.slice((x * levels + y) * 6, (x * levels + y + 1) * 6));
  cylinder.setIndex([...horizontal, ...original.slice(levels * row)]);
  [1, 0, 1, 0, 2].forEach((mat, i) => cylinder.addGroup(i * row, row, mat));
  cylinder.addGroup(levels * row, D.pillarSides * 6, 1);
  gate.pillars = D.pillars.map(([dx, dz]) => {
    const x = gate.cx + dx, z = cz + dz;
    const body = mesh(cylinder, [pale, brass, recess], gate.group, x, D.pillarHeight / 2, z, true);
    // 다각형 전체를 덮을 만큼만 고정 버퍼를 확보하고 drawRange로 실제 삼각형 수를 지정한다.
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const shadow = mesh(geometry, shade, gate.group); shadow.renderOrder = 2; shadow.frustumCulled = false;
    obstacles.push({ x, z, r: D.obstacleRadius });
    return { x, z, r: D.pillarRadius, height: D.pillarHeight, sides: D.pillarSides, mesh: body, shadow, polygon: [] };
  });
  gate.lampBall = new THREE.Group(); gate.group.add(gate.lampBall);
  const stemLength = D.trackY - D.lampY;
  mesh(new THREE.CylinderGeometry(0.035, 0.035, stemLength, 6), brass, gate.lampBall, 0, stemLength / 2);
  mesh(new THREE.SphereGeometry(0.3, 16, 12), lampMat, gate.lampBall);
  for (const y of [-0.4, 0.4]) mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.14, 12), gold, gate.lampBall, 0, y);
  for (const x of [-0.34, 0.34]) mesh(new THREE.BoxGeometry(0.055, 0.72, 0.055), brass, gate.lampBall, x, 0);
  gate.lamp = new THREE.PointLight(C.lamp, 50, 18, 2); gate.group.add(gate.lamp);
  gate.eyeMat = flat(C.warning, 0); gate.eyeMat.depthWrite = false;
  gate.eye = mesh(new THREE.CircleGeometry(0.42, 24), gate.eyeMat, gate.group, 0, 3.1, seg.z0 + 0.03);
  mesh(new THREE.TorusGeometry(0.56, 0.08, 8, 24), gold, gate.group, 0, 3.1, seg.z0 + 0.03);
  const footMat = flat(C.warning, 0); footMat.depthWrite = false;
  const foot = mesh(new THREE.RingGeometry(0.34, 0.48, 24), footMat, gate.group); foot.rotation.x = -Math.PI / 2; foot.renderOrder = 3;
  const bounds = { x0: seg.x0, x1: seg.x1, z0: gate.safeOut, z1: gate.safeIn };
  let cacheX = NaN, cacheZ = NaN;
  const polygons = L => {
    if (cacheX === L.x && cacheZ === L.z) return;
    cacheX = L.x; cacheZ = L.z;
    gate.pillars.forEach(p => { p.polygon = projectShade(p, L, bounds); });
  };
  const api = {
    group, obstacles, cameraOccluders, bounds, footWarning: foot,
    completed: false,
    setCompleted(value) { this.completed = value; if (value) { footMat.opacity = 0; gate.eyeMat.opacity = 0; } },
    lampAt(a) { return { x: gate.cx + Math.cos(a) * D.orbitX, y: D.lampY, z: cz + Math.sin(a) * D.orbitZ }; },
    inShadow(x, z, L) { polygons(L); return gate.pillars.some(p => insideShade(x, z, p.polygon)); },
    updateVisual(L) {
      polygons(L); gate.lampBall.position.set(L.x, L.y, L.z); gate.lamp.position.copy(gate.lampBall.position);
      gate.pillars.forEach(p => {
        const attr = p.shadow.geometry.attributes.position, v = p.polygon;
        let index = 0;
        for (let j = 1; j < v.length - 1; j++) for (const q of [v[0], v[j], v[j + 1]]) attr.setXYZ(index++, q.x, D.shadowY, q.z);
        attr.needsUpdate = true; p.shadow.geometry.setDrawRange(0, index); p.shadow.geometry.computeBoundingSphere();
      });
    },
    warning(actor, value) { foot.position.set(actor.position.x, Math.max(0, actor.position.y) + 0.03, actor.position.z); footMat.opacity = Math.min(1, value) * 0.85; },
    clearWarning() { footMat.opacity = 0; },
  };
  gate.court = api; api.updateVisual(gate._lampPos()); gate.progressCodec = shadeProgress(gate, legacyCodec);
  gate.group.traverse(m => {
    const materials = Array.isArray(m.material) ? m.material : [m.material];
    if (m.isMesh && materials.some(mat => mat?.isMeshStandardMaterial) && !cameraOccluders.includes(m)) cameraOccluders.push(m);
  });
  for (const { geo, mat, items, solid } of batches.values()) {
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((v, i) => { dummy.position.set(v.x, v.y, v.z); dummy.scale.set(v.sx, v.sy, v.sz); dummy.rotation.set(0, v.yaw, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    group.add(m); if (solid) cameraOccluders.push(m);
  }
  rects.cameraOccluders = [...(rects.cameraOccluders || []), ...cameraOccluders];
  rects.cameraLiftZones = [...(rects.cameraLiftZones || []), seg];
  return api;
}
