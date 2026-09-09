import * as THREE from 'three';
import { SIFT_SANCTUM as D } from '../data/siftSanctum.js';
import { SIEVE_PALETTE as C, EVAPORATION_PALETTE as P } from '../data/lighting.js';
import { godEyes } from './GodEyes.js';
import { siftSanctumProgress } from './SiftSanctumProgress.js';

export function buildSiftSanctum(scene, seg, rects, g, legacy) {
  g.group.removeFromParent(); const group = new THREE.Group(); group.name = '네 혼합물의 분리 신전'; scene.add(group); g.group = group;
  const cameraOccluders = [], obstacles = [], batches = new Map(), cube = new THREE.BoxGeometry(1, 1, 1);
  const mat = color => { const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .35, roughness: .86, side: THREE.DoubleSide });
    m.userData.outlineParameters = { visible: false }; return m; };
  const pale = mat(C.pale), stone = mat(C.stone), floor = mat(C.floor), alt = mat(C.floorAlt), wood = mat(C.wood), edge = mat(C.edge), brass = mat(C.brass);
  const paper = mat(P.paper), clay = mat(P.clay), iron = mat(P.iron), sand = mat(P.sand), salt = mat(P.salt), water = mat(P.water);
  function mesh(geo, material, parent, x = 0, y = 0, z = 0, solid = false) {
    const m = new THREE.Mesh(geo, material); parent.add(m); m.position.set(x, y, z); m.castShadow = solid; m.receiveShadow = true;
    if (solid) cameraOccluders.push(m); return m;
  }
  function box(w, h, d, x, y, z, material, solid = true) {
    const key = material.uuid + solid; if (!batches.has(key)) batches.set(key, { material, solid, parts: [] });
    batches.get(key).parts.push({ w, h, d, x, y, z });
  }
  function ring(parent, radius, material, x = 0, y = 0, z = 0) {
    const m = mesh(new THREE.TorusGeometry(radius, .045, 6, 32), material, parent, x, y, z); m.rotation.x = Math.PI / 2; return m;
  }
  function sieve(parent, radius) {
    ring(parent, radius, brass); const parts = [];
    for (let i = -3; i <= 3; i++) { const t = i * radius / 4, len = 2 * Math.sqrt(radius * radius - t * t);
      parts.push([.025, .025, len, t, 0], [len, .025, .025, 0, t]); }
    for (const [w, h, d, x, z] of parts) mesh(new THREE.BoxGeometry(w, h, d), brass, parent, x, 0, z);
  }
  function label(text, x, y, z) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 192; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + C.pale.toString(16); ctx.fillRect(0, 0, 768, 192); ctx.strokeStyle = '#' + C.brass.toString(16); ctx.lineWidth = 8; ctx.strokeRect(8, 8, 752, 176);
    ctx.fillStyle = '#' + C.edge.toString(16); ctx.font = 'bold 43px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 96, 720);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }); material.userData.outlineParameters = { visible: false };
    mesh(new THREE.PlaneGeometry(2.35, .59), material, group, x, y, z);
    box(.10, y, .10, x, y / 2, z - .09, wood);
  }
  const cz = (seg.z0 + seg.z1) / 2;
  box(D.width, .12, D.length, 0, -.06, cz, stone, false);
  for (let x = -7; x <= 7; x += 2) for (let z = -7; z <= 7; z += 2) box(1.97, .024, 1.97, x, -.004, cz + z, (x + z) % 4 ? floor : alt, false);
  for (const side of [-1, 1]) {
    box(.45, .65, 16, side * 8.2, .325, cz, stone);
    for (const dz of [-7.8, 0, 7.8]) { box(.7, 4.5, .7, side * 8.2, 2.25, cz + dz, pale); box(.9, .22, .9, side * 8.2, 4.61, cz + dz, stone); }
    box(.5, .26, 16, side * 8.2, 4.85, cz, pale);
  }
  // 넓은 어깨와 얼굴, 품에 든 체로 지킴이를 읽을 수 있게 한다.
  const gz = g.gz - D.guardianBack;
  box(3.5, .45, 2.7, 0, .225, gz, stone);
  box(2.3, 2.55, 1.7, 0, 2.1, gz, pale);
  for (const side of [-1, 1]) {
    box(.9, .72, 1.4, side * .96, .8, gz + .24, stone);
    box(.85, 1.7, 1.05, side * 1.43, 2.27, gz + .1, stone);
  }
  box(1.85, 1.48, 1.65, 0, 4.3, gz, pale); box(2.02, .22, 1.8, 0, 5.12, gz, stone);
  g.eyes = godEyes(group, 0, D.eyeY, gz + D.faceDepth, .43, .31, .18);
  const chest = new THREE.Group(); chest.position.set(0, 2.9, gz + 1.1); chest.rotation.x = Math.PI / 2; group.add(chest); sieve(chest, 1.05);
  g.obstacles = [{ x: 0, z: gz, r: D.guardianRadius }];
  // 체험한 도구 그대로의 실루엣. 선반 순서와 혼합물 순서는 기존 씨드로 섞인다.
  g.tools.forEach(t => {
    t.mesh = new THREE.Group(); group.add(t.mesh); t.home.set(t.x, D.toolY, t.z);
    if (t.id === 'sieve') sieve(t.mesh, .5);
    if (t.id === 'magnet') {
      mesh(new THREE.TorusGeometry(.3, .1, 8, 16, Math.PI), mat(P.magnet), t.mesh, 0, .12, 0);
      for (const side of [-1, 1]) mesh(new THREE.BoxGeometry(.16, .2, .18), mat(P.pole), t.mesh, side * .3, -.03, 0);
    }
    if (t.id === 'filter') {
      mesh(new THREE.CylinderGeometry(.46, .06, .5, 20, 1, true), paper, t.mesh, 0, .08, 0); ring(t.mesh, .46, brass, 0, .33, 0);
    }
    if (t.id === 'burner') {
      mesh(new THREE.CylinderGeometry(.45, .5, .2, 12), clay, t.mesh);
      mesh(new THREE.ConeGeometry(.18, .35, 8), mat(P.fire), t.mesh, 0, .27, 0);
    }
    box(1.45, .14, 1.2, t.x, .7, t.z, wood);
    for (const side of [-1, 1]) box(.15, .63, .9, t.x + side * .52, .315, t.z, edge);
    label(t.id === 'filter' ? '거름종이' : t.name, t.x, .32, t.z + .68);
    obstacles.push({ x: t.x, z: t.z, r: D.toolRadius });
  });
  const visuals = [];
  g.mixes.forEach(m => {
    box(1.75, .95, 1.45, m.x, .475, m.z, stone); box(1.85, .12, 1.55, m.x, 1.01, m.z, pale);
    mesh(new THREE.CylinderGeometry(.67, .53, .24, 24, 1, true), clay, group, m.x, D.bowlY + .1, m.z);
    mesh(new THREE.CylinderGeometry(.53, .53, .05, 24), clay, group, m.x, D.bowlY, m.z); ring(group, .67, brass, m.x, D.bowlY + .22, m.z);
    m.mat = new THREE.MeshBasicMaterial({ color: C.brass }); mesh(new THREE.BoxGeometry(1.3, .05, .07), m.mat, group, m.x, 1.12, m.z + .83);
    m.pips = m.need.map((_, k) => mesh(new THREE.SphereGeometry(.07, 10, 6), mat(C.edge), group, m.x + (k - (m.need.length - 1) / 2) * .3, .55, m.z + .76));
    label(m.mix, m.x, 2.5, m.z - .84); obstacles.push({ x: m.x, z: m.z, r: D.mixRadius });
    const liquid = mesh(new THREE.CylinderGeometry(.59, .59, .025, 24), water, group, m.x, 1.3, m.z);
    const solids = [];
    const kinds = m.need.includes('sieve') ? ['bean', 'millet'] : m.need.includes('magnet') ? ['iron', 'sand'] : m.order ? ['sand', 'salt'] : ['salt'];
    for (const kind of kinds) for (let k = 0; k < 12; k++) {
      const size = kind === 'bean' ? .105 : kind === 'iron' ? .08 : kind === 'salt' ? .055 : .04;
      const material = kind === 'iron' ? iron : kind === 'salt' ? salt : kind === 'bean' ? mat(C.coarse) : sand;
      const geo = kind === 'salt' ? new THREE.BoxGeometry(size * 1.6, size * 1.2, size * 1.6) : new THREE.IcosahedronGeometry(size, 0);
      const item = mesh(geo, material, group); solids.push({ kind, k, mesh: item });
    }
    // 분리 후 두 재료가 섞여 보이지 않도록 양쪽 얕은 받침을 쓴다.
    for (const side of [-1, 1]) box(.62, .04, .55, m.x + side * .5, 1.27, m.z + .35, paper, false);
    visuals.push({ mix: m, liquid, solids });
  });
  const api = { group, obstacles, cameraOccluders, visuals,
    sync() {
      for (const t of g.tools) if (t !== g.held) {
        t.mesh.position.copy(t.used ? new THREE.Vector3(t.used.x, 1.9, t.used.z) : t.home); t.mesh.rotation.set(0, 0, 0);
      }
      for (const v of visuals) {
        const m = v.mix, done = g._mixDone(m), filtered = m.done.includes('filter');
        v.liquid.visible = m.need.includes('burner') && !done;
        for (const s of v.solids) {
          const dry = done || !m.need.includes('burner'), separate = done || (filtered && s.kind === 'sand');
          s.mesh.visible = s.kind !== 'salt' || dry;
          const a = s.k * 2.4, r = .095 * Math.sqrt(s.k);
          const side = s.kind === v.solids[0].kind ? -1 : 1;
          s.mesh.position.set(m.x + (separate ? side * .48 : 0) + Math.cos(a) * r * (separate ? .65 : 1),
            1.34 + (s.k % 3) * .025, m.z + (separate ? .35 : 0) + Math.sin(a) * r * (separate ? .65 : 1));
        }
      }
    },
  };
  g.workshop = api; api.sync(); g.progressCodec = siftSanctumProgress(g, legacy);
  const dummy = new THREE.Object3D();
  for (const { material, solid, parts } of batches.values()) {
    const m = new THREE.InstancedMesh(cube, material, parts.length); parts.forEach((v, i) => { dummy.position.set(v.x, v.y, v.z); dummy.scale.set(v.w, v.h, v.d); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    group.add(m); m.castShadow = solid; m.receiveShadow = true; if (solid) cameraOccluders.push(m);
  }
  rects.cameraOccluders = [...(rects.cameraOccluders || []), ...cameraOccluders]; rects.cameraLiftZones = [...(rects.cameraLiftZones || []), seg];
  return api;
}
