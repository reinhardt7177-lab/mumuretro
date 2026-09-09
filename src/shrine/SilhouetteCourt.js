import * as THREE from 'three';
import { SILHOUETTE_COURT as D } from '../data/silhouetteCourt.js';
import { SILHOUETTE_PALETTE as C } from '../data/lighting.js';
import { silhouetteProgress } from './SilhouetteProgress.js';

export function buildSilhouetteCourt(scene, seg, rects, g, legacyCodec) {
  const group = new THREE.Group(); group.name = '등불과 가림판의 회랑'; scene.add(group);
  const cameraOccluders = [], obstacles = [], batches = new Map(), cube = new THREE.BoxGeometry(1, 1, 1);
  // 옛 출구 상인방의 앞면이 투영면과 정확히 겹쳤다. 문틀을 뒤로 물려 깜빡임을 없앤다.
  for (const m of scene.children) if (m.userData.doorFrame === seg.id) m.position.z -= 0.16;
  const lit = color => { const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.22, roughness: 0.8 });
    m.userData.outlineParameters = { visible: false }; return m; };
  const flat = (color, opacity = 1) => { const m = new THREE.MeshBasicMaterial({ color, opacity, transparent: opacity < 1, side: THREE.DoubleSide });
    m.userData.outlineParameters = { visible: false }; return m; };
  const stone = lit(C.stone), pale = lit(C.stoneLight), brass = lit(C.brass), gold = lit(C.brassLight), dark = lit(C.hardware);
  const floor = lit(C.floor), inset = lit(C.floorInset), ink = flat(C.shadow), paper = flat(C.screen), lampMat = flat(C.lamp);
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0, solid = false) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); if (solid) cameraOccluders.push(m); return m;
  };
  const box = (w, h, d, x, y, z, mat, solid = false) => {
    const key = `${mat.uuid}/${solid}`; if (!batches.has(key)) batches.set(key, { mat, solid, items: [] });
    batches.get(key).items.push({ x, y, z, w, h, d });
  };
  const cz = (seg.z0 + seg.z1) / 2;
  box(D.width, 0.1, D.length, 0, -0.05, cz, floor);
  for (let x = -6; x <= 6; x += 2) for (let z = -5; z <= 5; z += 2) box(1.98, 0.025, 1.98, x, -0.008, cz + z, (x + z + 11) % 4 ? floor : inset);
  // 레일 옆에서 조작한다. 눈금 간격은 같고 정답 위치를 색으로 구별하지 않는다.
  for (const side of [-1, 1]) box(0.055, 0.07, 9.05, D.axisX + side * 0.32, 0.035, cz - 0.325, brass);
  for (let dz = 1.5; dz <= 9; dz += 0.5) box(0.24, 0.018, 0.035, D.axisX + 0.7, 0.009, g.lampZ - dz, brass);
  for (const side of [-1, 1]) {
    const x = side * 7.24;
    box(0.48, 0.7, 12.35, x, 0.35, cz, stone, true); box(0.62, 0.15, 12.5, x, 0.78, cz, pale, true);
    for (const dz of [-4.6, 0, 4.6]) {
      const archShape = new THREE.Shape(); archShape.absarc(0, 0, 2.13, 0, Math.PI, false); archShape.lineTo(-1.86, 0);
      archShape.absarc(0, 0, 1.86, Math.PI, 0, true); archShape.closePath();
      const arch = mesh(new THREE.ExtrudeGeometry(archShape, { depth: 0.5, bevelEnabled: false, curveSegments: 12 }), pale, group, x - 0.25, 2.5, cz + dz, true); arch.rotation.y = Math.PI / 2;
      for (const d of [-2, 2]) { box(0.5, 2.5, 0.36, x, 1.25, cz + dz + d, stone, true); box(0.68, 0.18, 0.56, x, 2.47, cz + dz + d, gold, true); }
    }
  }
  // 화면을 왼쪽에 세우고 중앙 출구로 걸어갈 공간을 남긴다.
  const screen = mesh(new THREE.BoxGeometry(4.3, 4.3, 0.18), stone, group, D.axisX, D.beamY, g.wallZ - 0.1, true);
  const screenFace = mesh(new THREE.PlaneGeometry(D.screenSize, D.screenSize), paper, group, D.axisX, D.beamY, g.wallZ);
  for (const side of [-1, 1]) {
    box(0.13, 4.22, 0.16, D.axisX + side * 2.09, D.beamY, g.wallZ + 0.03, gold, true);
    box(4.3, 0.13, 0.16, D.axisX, D.beamY + side * 2.09, g.wallZ + 0.03, gold, true);
    box(0.26, 1.0, 0.42, D.axisX + side * 1.8, 0.5, g.wallZ - 0.1, stone, true);
  }
  // 화면 너비를 따라 충돌 원을 놓아 몸이 파고들지 않게 한다.
  for (let x = D.axisX - 1.9; x <= D.axisX + 1.91; x += 0.38) obstacles.push({ x, z: g.wallZ, r: 0.55 });

  // 이전 저장 검증용 노드는 그대로 남기고 장면에서만 떼어 낸다.
  g.group.removeFromParent(); g.group = new THREE.Group(); group.add(g.group);
  g.objX = D.axisX; g.homeZ = g.lampZ - D.homeDistance; g.objZ = g.homeZ;
  g.held = false; g.solved = false; g.round = 0; g.dragOffset = 0; g.holeW = g._holeAt(g.answers[0]);
  const carriage = new THREE.Group(); carriage.position.set(D.axisX, 0, g.objZ); g.group.add(carriage);
  const stemHeight = D.beamY - D.panelSize / 2 - D.stemBottom;
  // 빛을 가리는 앞면이 objZ다. 판의 두께는 등불에서 먼 쪽으로만 준다.
  g.obj = mesh(new THREE.BoxGeometry(D.panelSize, D.panelSize, D.panelDepth), dark, carriage, 0, D.beamY, -D.panelDepth / 2, true);
  const stem = mesh(new THREE.BoxGeometry(D.stemWidth, stemHeight, D.panelDepth), brass, carriage, 0, D.stemBottom + stemHeight / 2, -D.panelDepth / 2, true);
  mesh(new THREE.BoxGeometry(0.88, 0.25, 0.65), dark, carriage, 0, 0.25, -0.12, true);
  mesh(new THREE.BoxGeometry(D.handleOffset, 0.07, 0.07), brass, carriage, D.handleOffset / 2, 0.72, -0.05, true);
  mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 8), gold, carriage, D.handleOffset, 0.82, -0.05, true);
  for (const side of [-1, 1]) {
    const wheel = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), brass, carriage, side * 0.34, 0.16, -0.12, true); wheel.rotation.z = Math.PI / 2;
    // 황동 테두리를 판 안에 넣어 실제 투영되는 정사각형의 크기를 유지한다.
    mesh(new THREE.BoxGeometry(0.045, 0.9, 0.014), gold, carriage, side * 0.426, D.beamY, -0.007, true);
    mesh(new THREE.BoxGeometry(0.81, 0.045, 0.014), gold, carriage, 0, D.beamY + side * 0.426, -0.007, true);
  }
  const movingObstacle = { x: D.axisX, z: g.objZ, r: D.clearance }; obstacles.push(movingObstacle);
  g.lampBall = mesh(new THREE.SphereGeometry(0.18, 16, 12), lampMat, g.group, D.axisX, D.beamY, g.lampZ);
  mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.35, 12), stone, g.group, D.axisX, 0.175, g.lampZ, true);
  mesh(new THREE.CylinderGeometry(0.11, 0.19, 2.35, 12), brass, g.group, D.axisX, 1.4, g.lampZ, true);
  mesh(new THREE.TorusGeometry(0.39, 0.055, 8, 24), gold, g.group, D.axisX, D.beamY, g.lampZ + 0.12, true);
  const light = new THREE.PointLight(C.lamp, 26, 16, 2); light.position.copy(g.lampBall.position); g.group.add(light);
  obstacles.push({ x: D.axisX, z: g.lampZ, r: 0.96 });
  g.shadow = mesh(new THREE.PlaneGeometry(1, 1), ink, g.group, D.axisX, D.beamY, g.wallZ + 0.006);
  const stemShadow = mesh(new THREE.PlaneGeometry(1, 1), ink, g.group, D.axisX, D.beamY, g.wallZ + 0.006);
  g.holeMat = flat(C.target); g.hole = new THREE.Group(); g.group.add(g.hole); g.hole.position.set(D.axisX, D.beamY, g.wallZ + 0.015);
  const targetEdges = [0, 1, 2, 3].map(() => mesh(cube, g.holeMat, g.hole));
  g.pips = [0, 1, 2].map(i => mesh(new THREE.CircleGeometry(0.09, 16), flat(C.unlit), g.group, D.axisX + (i - 1) * 0.34, D.beamY + 2.42, g.wallZ + 0.04));
  const api = {
    group, cameraOccluders, obstacles, screen, screenFace, carriage, stem, stemShadow, completed: false,
    handle() { return { x: g.objX + D.handleOffset, z: g.objZ }; },
    resize(score = false) {
      carriage.position.z = g.objZ; movingObstacle.z = g.objZ;
      const size = g._size(), clipped = Math.min(D.screenSize, size), factor = size / D.panelSize;
      g.shadow.scale.set(clipped, clipped, 1);
      const top = D.beamY - size / 2, bottom = D.beamY - D.screenSize / 2;
      stemShadow.visible = top > bottom; stemShadow.position.y = (top + bottom) / 2;
      stemShadow.scale.set(D.stemWidth * factor, Math.max(0.001, top - bottom), 1);
      if (score && !g.solved && Math.abs(size - g.holeW) < g.holeW * (g.tol || 0.09)) {
        g.held = false; g.round++; g.solved = g.round === 3; this.completed = g.solved;
        g.holeW = g._holeAt(g.answers[Math.min(g.round, 2)]);
      }
      const w = g.holeW, t = 0.045;
      targetEdges.forEach((m, i) => {
        const horizontal = i < 2, side = i % 2 ? 1 : -1;
        m.position.set(horizontal ? 0 : side * w / 2, horizontal ? side * w / 2 : 0, 0);
        m.scale.set(horizontal ? w + t : t, horizontal ? t : w, 0.008);
      });
      g.holeMat.color.set(this.completed ? C.complete : C.target);
      g.pips.forEach((p, i) => p.material.color.set(i < g.round || this.completed ? C.complete : C.unlit));
    },
    update(actor) {
      if (!g.held || g.solved) return {};
      if (actor.position.z < seg.z0 || actor.position.z > seg.z1
        || Math.abs(actor.position.x - this.handle().x) >= g.REACH) { g.held = false; return {}; }
      const z = Math.max(g.wallZ + 1.2, Math.min(g.lampZ - 1.2, actor.position.z - g.dragOffset));
      const moved = Math.abs(z - g.objZ) > 1e-7; g.objZ = z; this.resize(moved); return {};
    },
    interact(pos) {
      if (g.solved || this.completed) return false;
      if (g.held) { g.held = false; return true; }
      if (!g._near(pos)) return false;
      g.held = true; g.dragOffset = pos.z - g.objZ; return true;
    },
    restart() { this.completed = false; g.dragOffset = 0; this.resize(); },
  };
  g.theatre = api; api.resize(); g.progressCodec = silhouetteProgress(g, legacyCodec);
  const dummy = new THREE.Object3D();
  for (const { mat, solid, items } of batches.values()) {
    const m = new THREE.InstancedMesh(cube, mat, items.length);
    items.forEach((v, i) => { dummy.position.set(v.x, v.y, v.z); dummy.scale.set(v.w, v.h, v.d); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    group.add(m); if (solid) cameraOccluders.push(m);
  }
  rects.cameraOccluders = [...(rects.cameraOccluders || []), ...cameraOccluders];
  rects.cameraLiftZones = [...(rects.cameraLiftZones || []), seg];
  return api;
}
