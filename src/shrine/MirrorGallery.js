import * as THREE from 'three';
import { MIRROR_GALLERY as D } from '../data/mirrorGallery.js';
import { MIRROR_PALETTE as C } from '../data/lighting.js';
import { traceMirrors, mirrorProgress } from './MirrorOptics.js';

// 거울방만 바꾸는 시각 층. 기존 장치 생성 뒤에 붙여 다른 관문의 난수 순서를 보존한다.
export function buildMirrorGallery(scene, seg, rects, gate, legacyCodec) {
  const group = new THREE.Group(); group.name = '달빛 거울 회랑'; scene.add(group);
  const cz = (seg.z0 + seg.z1) / 2, obstacles = [], cameraOccluders = [];
  const material = (color, emission = 0.18, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emission,
      roughness: metalness ? 0.38 : 0.85, metalness });
    m.userData.outlineParameters = { visible: false }; return m;
  };
  const basic = (color, opacity = 1) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
    m.userData.outlineParameters = { visible: false }; return m;
  };
  const stone = material(C.stone, 0.28), pale = material(C.stoneLight, 0.27), shade = material(C.stoneShade, 0.19);
  const floor = material(C.floor, 0.22), floorLite = material(C.floorLight, 0.22), grout = material(C.grout, 0.18);
  const brass = material(C.brass, 0.23, 0.6), gold = material(C.brassLight, 0.25, 0.5), dark = material(C.metalDark, 0.14, 0.6);
  const ray = basic(C.ray, 0.12), core = basic(C.rayCore), glass = material(C.mirror, 0.55, 0.35);
  glass.side = THREE.DoubleSide;
  const batches = new Map(), cube = new THREE.BoxGeometry(1, 1, 1), dummy = new THREE.Object3D();
  const batch = (geometry, mat, x, y, z, sx = 1, sy = 1, sz = 1, yaw = 0, solid = false) => {
    const key = `${geometry.uuid}/${mat.uuid}`;
    if (!batches.has(key)) batches.set(key, { geometry, mat, instances: [], solid: false });
    const b = batches.get(key); b.instances.push({ x, y, z, sx, sy, sz, yaw }); b.solid ||= solid;
  };
  const box = (w, h, d, x, y, z, mat, solid = false, yaw = 0) => batch(cube, mat, x, y, z, w, h, d, yaw, solid);
  const mesh = (geometry, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); parent.add(m); return m;
  };
  // 줄눈은 바닥 아래에 묻고, 보행 높이는 정확히 y=0으로 둔다.
  box(D.width, 0.12, D.length, 0, -0.065, cz, grout);
  for (let x = -8; x <= 8; x += 2) for (let z = -6; z <= 6; z += 2) {
    box(1.975, 0.06, 1.975, x, -0.03, cz + z, ((x + z + 14) / 2) % 3 ? floor : floorLite);
  }
  // 입구와 출구의 중앙 5m는 계속 열린다. 측면 창 아래 돌담은 빛의 끝이 된다.
  for (const side of [-1, 1]) {
    box(0.7, 1.75, 14.6, side * 9.25, 0.875, cz, stone, true);
    box(0.85, 0.15, 14.8, side * 9.25, 1.825, cz, pale, true);
    for (const end of [-1, 1]) {
      box(6.4, 1.75, 0.65, side * 5.85, 0.875, cz + end * 7.23, stone, true);
      box(6.6, 0.14, 0.82, side * 5.85, 1.825, cz + end * 7.23, pale, true);
    }
  }
  const shape = new THREE.Shape();
  shape.absarc(0, 0, D.archRadius + 0.3, 0, Math.PI, false);
  shape.lineTo(-D.archRadius, 0); shape.absarc(0, 0, D.archRadius, Math.PI, 0, true); shape.closePath();
  const arch = new THREE.ExtrudeGeometry(shape, { depth: 0.58, bevelEnabled: false, curveSegments: 12 });
  arch.translate(0, D.archSpring, -0.29);
  const arcade = (x, z, yaw = 0) => {
    batch(arch, pale, x, 0, z, 1, 1, 1, yaw, true);
    for (const side of [-1, 1]) {
      const px = x + side * (D.archRadius + 0.16) * Math.cos(yaw), pz = z - side * (D.archRadius + 0.16) * Math.sin(yaw);
      box(0.46, 3.2, 0.64, px, 1.6, pz, stone, true, yaw);
      box(0.7, 0.25, 0.82, px, 0.125, pz, shade, true, yaw);
      box(0.7, 0.22, 0.82, px, 3.06, pz, pale, true, yaw);
    }
    box(3.7, 0.17, 0.75, x, 5.12, z, shade, true, yaw);
  };
  for (const side of [-1, 1]) {
    for (const dz of [-5, -1, 3]) arcade(side * 9.25, cz + dz, Math.PI / 2);
    for (const x of [4.7, 8.2]) arcade(side * x, cz - 7.25);
    arcade(side * 7.8, cz + 7.25);
  }
  // 중앙 출입 아치는 높게 비워 3인칭 카메라가 위쪽 석재 안에 걸리지 않게 한다.
  for (const end of [-1, 1]) {
    const opening = end === 1 ? 5.7 : 2.75;
    for (const side of [-1, 1]) {
      box(0.65, 6.45, 0.85, side * opening, 3.225, cz + end * 7.35, stone, true);
      box(0.9, 0.28, 1.02, side * opening, 5.15, cz + end * 7.35, gold, true);
    }
    box(opening * 2 + 1.15, 0.48, 1.1, 0, 6.4, cz + end * 7.35, pale, true);
    box(5.8, 0.09, 0.12, 0, 6.12, cz + end * 7.92, gold);
  }
  const crown = mesh(new THREE.TorusGeometry(7.6, 0.19, 6, 48, Math.PI * 1.5), pale, group, 0, D.crownHeight, cz);
  crown.rotation.x = Math.PI / 2; crown.scale.y = 0.79; cameraOccluders.push(crown);
  const moon = mesh(new THREE.SphereGeometry(2.8, 24, 16), basic(C.moon), group, -19, 26, cz - 75);
  moon.userData.sky = true;
  for (const x of [-5, 5]) {
    const light = new THREE.PointLight(C.moon, 65, 16, 2); light.position.set(x, 6.1, cz); group.add(light);
  }
  // 90° 회전한 동일 퍼즐. 저장된 각도는 그대로 두고 표시 면과 입사 방향을 함께 회전한다.
  const rotate = p => ({ x: -(p.z - cz), z: cz + p.x });
  gate.group.removeFromParent(); gate.group = new THREE.Group(); gate.group.name = '거울 광학 장치'; group.add(gate.group);
  gate.src = rotate(gate.src); gate.target = rotate(gate.target); gate.angleOffset = D.angleOffset;
  const pedestal = (x, z) => {
    batch(newPedestal, shade, x, 0.12, z, 1, 1, 1, 0, true);
    batch(stem, brass, x, 0.62, z, 1, 1, 1, 0, true);
    batch(cap, gold, x, 1.03, z, 1, 1, 1, 0, true);
    obstacles.push({ x, z, r: D.obstacleRadius });
  };
  const newPedestal = new THREE.CylinderGeometry(0.6, 0.7, 0.24, 12);
  const stem = new THREE.CylinderGeometry(0.21, 0.29, 0.8, 12);
  const cap = new THREE.CylinderGeometry(0.4, 0.4, 0.12, 12);
  const glints = [];
  gate.mirrors.forEach(m => {
    Object.assign(m, rotate(m)); pedestal(m.x, m.z);
    const pivot = new THREE.Group(); pivot.position.set(m.x, 0, m.z); gate.group.add(pivot); m.grp = pivot;
    pivot.rotation.y = -(m.a + gate.angleOffset);
    // 양면 평면의 중심과 광학 평면 z=0이 일치한다. 두꺼운 뒤판에 빛이 박히지 않는다.
    cameraOccluders.push(mesh(new THREE.PlaneGeometry(1.7, 1.08), glass, pivot, 0, D.beamHeight, 0));
    for (const side of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.10, 1.28, 0.15), gold, pivot, side * 0.9, 1.5);
      mesh(new THREE.BoxGeometry(1.9, 0.1, 0.15), brass, pivot, 0, 1.5 + side * 0.6);
    }
    const handle = mesh(new THREE.TorusGeometry(0.26, 0.042, 5, 16), gold, pivot, 0, 0.89, 0.44);
    handle.rotation.x = 0.55;
    const glint = mesh(new THREE.SphereGeometry(0.08, 8, 6), core, gate.group); glint.visible = false; glints.push(glint);
  });
  // 광원 렌즈는 옆을 향한다. 경로의 시작점을 장식용 빛에서 추측할 필요가 없다.
  pedestal(gate.src.x - 0.32, gate.src.z);
  const emitter = mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.64, 12), brass, gate.group, gate.src.x - 0.32, 1.5, gate.src.z);
  emitter.rotation.z = Math.PI / 2;
  const lens = mesh(new THREE.CircleGeometry(0.245, 16), core, gate.group, gate.src.x, 1.5, gate.src.z);
  lens.rotation.y = Math.PI / 2;
  const glow = new THREE.PointLight(C.ray, 6, 3, 2); glow.position.set(gate.src.x + 0.3, 1.7, gate.src.z); gate.group.add(glow);
  pedestal(gate.target.x, gate.target.z);
  const receiver = new THREE.Group(); receiver.position.set(gate.target.x, 1.5, gate.target.z); gate.group.add(receiver);
  receiver.rotation.y = gate.mirrors[2].z > gate.target.z ? 0 : Math.PI;
  mesh(new THREE.TorusGeometry(0.54, 0.095, 8, 24), gold, receiver);
  gate.targetMat = basic(C.receiverIdle);
  mesh(new THREE.CircleGeometry(D.receiverRadius, 24), gate.targetMat, receiver);
  const heart = mesh(new THREE.OctahedronGeometry(0.18), core, receiver, 0, 0, 0.025); heart.visible = false;
  gate.segs = Array.from({ length: 8 }, () => {
    const g = new THREE.Group(); gate.group.add(g); g.visible = false;
    mesh(new THREE.CylinderGeometry(0.028, 0.028, 1, 8), core, g);
    mesh(new THREE.CylinderGeometry(0.105, 0.105, 1, 8), ray, g); return g;
  });
  gate.galleryOptics = {
    direction: { x: 1, z: 0 }, receiverRadius: D.receiverRadius,
    bounds: { x0: seg.x0 + D.wallInset, x1: seg.x1 - D.wallInset, z0: seg.z0 + D.wallInset, z1: seg.z1 - D.wallInset },
    renderTrace() {
      const result = traceMirrors(gate); gate.hit = result.hit; gate.traceSegments = result.segments;
      gate.segs.forEach(m => { m.visible = false; }); glints.forEach(m => { m.visible = false; });
      result.segments.forEach((s, i) => {
        gate._seg(i, s.x0, s.z0, s.x1, s.z1);
        if (s.end === 'mirror') { const m = glints[s.mirror]; m.visible = true; m.position.set(s.x1, 1.5, s.z1); }
      });
      gate.targetMat.color.set(result.hit ? C.rayCore : C.receiverIdle); heart.visible = result.hit;
    },
  };
  gate._trace(); gate.progressCodec = mirrorProgress(gate, legacyCodec);
  gate.group.traverse(m => {
    if (m.isMesh && !m.material.transparent && m.material !== core && !cameraOccluders.includes(m)) cameraOccluders.push(m);
  });
  for (const { geometry, mat, instances, solid } of batches.values()) {
    const m = new THREE.InstancedMesh(geometry, mat, instances.length);
    instances.forEach((v, i) => {
      dummy.position.set(v.x, v.y, v.z); dummy.scale.set(v.sx, v.sy, v.sz); dummy.rotation.set(0, v.yaw, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.receiveShadow = true; group.add(m); if (solid) cameraOccluders.push(m);
  }
  rects.cameraOccluders = [...(rects.cameraOccluders || []), ...cameraOccluders];
  rects.cameraLiftZone = seg;
  return { group, obstacles, cameraOccluders, gate, dimensions: D };
}
