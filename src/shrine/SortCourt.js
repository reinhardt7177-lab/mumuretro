import * as THREE from 'three';
import { SORT_COURT as D } from '../data/sortCourt.js';
import { SIEVE_PALETTE as C, SORT_PALETTE as P } from '../data/lighting.js';
import { sortProgress } from './SortProgress.js';

export function buildSortCourt(scene, seg, rects, g, legacy) {
  const crits = [...g.crits], oldMagnet = g.magnet;
  g.group.removeFromParent(); const group = new THREE.Group(); group.name = '자석과 관찰 수조의 작업장';
  g.group = group; scene.add(group); group.add(oldMagnet);
  const cameraOccluders = [], obstacles = [], batches = new Map(), cube = new THREE.BoxGeometry(1, 1, 1);
  const mat = color => { const m = new THREE.MeshStandardMaterial({ color, roughness: .86, emissive: color, emissiveIntensity: .35 });
    m.userData.outlineParameters = { visible: false }; return m; };
  const stone = mat(C.stone), floor = mat(C.floor), alt = mat(C.floorAlt), pale = mat(C.pale), wood = mat(C.wood), edge = mat(C.edge), brass = mat(C.brass);
  function box(w, h, d, x, y, z, material, solid = true) {
    const key = material.uuid + solid;
    if (!batches.has(key)) batches.set(key, { material, solid, parts: [] });
    batches.get(key).parts.push({ w, h, d, x, y, z });
  }
  function mesh(geometry, material, x, y, z, solid = false) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = solid; m.receiveShadow = solid;
    group.add(m); if (solid) cameraOccluders.push(m); return m;
  }
  const cz = (seg.z0 + seg.z1) / 2;
  box(D.width, .12, D.length, 0, -.06, cz, stone, false);
  for (let x = -5; x <= 5; x += 2) for (let z = -5; z <= 5; z += 2)
    box(1.97, .024, 1.97, x, -.004, cz + z, (x + z) % 4 ? floor : alt, false);
  for (const side of [-1, 1]) {
    box(.42, .62, 12, side * 6.2, .31, cz, stone);
    for (const dz of [-5.8, 0, 5.8]) {
      box(.6, 3.5, .6, side * 6.2, 1.75, cz + dz, pale);
      box(.83, .2, .83, side * 6.2, 3.57, cz + dz, stone);
    }
    box(.48, .25, 12, side * 6.2, 3.82, cz, pale);
  }
  for (const m of scene.children) if (['r1', 'r2'].includes(m.userData.doorFrame)) {
    if (m.userData.doorFrame === 'r2') m.material = pale;
    // 낮은 장식 가로대가 입구 시야의 중앙을 가렸다. 상인방 바로 아래에 붙인다.
    if (m.geometry.parameters.height === .16) m.position.y += .82;
    cameraOccluders.push(m);
  }
  // 같은 받침과 시료를 쓴다. 자리에 재질의 정답을 표시하지 않는다.
  const sampleMat = mat(P.sample), sampleGeo = new THREE.BoxGeometry(D.sampleSize, D.sampleSize, D.sampleSize);
  g.items.forEach((it, i) => {
    it.x = D.stockX; it.z = seg.z1 - D.stockOffsets[i]; it.home.set(it.x, D.stockY, it.z);
    it.mesh = mesh(sampleGeo, sampleMat, it.x, D.stockY, it.z, true);
    box(1.2, .12, 1.15, it.x, .68, it.z, wood);
    for (const side of [-1, 1]) box(.12, .62, .95, it.x + side * .45, .31, it.z, edge);
    box(.9, .035, .85, it.x, .755, it.z, brass);
    obstacles.push({ x: it.x, z: it.z, r: D.stockRadius });
  });
  // 바닥과 낮은 테두리만 있는 상자. 담은 시료가 계속 보인다.
  const labels = [];
  function label(x, y, z, width, height) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 192;
    const ctx = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    material.userData.outlineParameters = { visible: false };
    mesh(new THREE.PlaneGeometry(width, height), material, x, y, z);
    let previous;
    return text => { if (text === previous) return; previous = text;
      ctx.fillStyle = '#' + P.paper.toString(16); ctx.fillRect(0, 0, 768, 192);
      ctx.strokeStyle = '#' + C.brass.toString(16); ctx.lineWidth = 9; ctx.strokeRect(8, 8, 752, 176);
      ctx.fillStyle = '#' + P.ink.toString(16); ctx.font = 'bold 42px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 384, 96, 725); texture.needsUpdate = true;
    };
  }
  g.bins.forEach((b, i) => {
    b.x = (i ? 1 : -1) * D.binX; b.z = seg.z0 + D.binOffset;
    box(2.2, .18, 1.55, b.x, .09, b.z, wood);
    for (const side of [-1, 1]) {
      box(.12, .58, 1.65, b.x + side * 1.1, .43, b.z, edge);
      box(2.2, .38, .12, b.x, .33, b.z + side * .78, wood);
      box(2.25, .08, .08, b.x, .56, b.z + side * .8, brass);
    }
    b.ringMat = new THREE.MeshBasicMaterial({ color: i ? P.no : P.yes });
    mesh(new THREE.BoxGeometry(1.7, .055, .07), b.ringMat, b.x, .58, b.z + .87);
    box(.12, 1.8, .12, b.x, .9, b.z - 1, wood);
    labels.push(label(b.x, 1.9, b.z - .94, 2.7, .68));
    obstacles.push({ x: b.x, z: b.z, r: D.binRadius });
  });
  g.basin.x = D.basinX; g.basin.z = seg.z1 - D.basinOffset;
  const { x: bx, z: bz } = g.basin;
  box(2.05, .2, 1.95, bx, .18, bz, pale);
  const glass = new THREE.MeshBasicMaterial({ color: P.glass, transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide });
  glass.userData.outlineParameters = { visible: false };
  for (const side of [-1, 1]) {
    mesh(new THREE.BoxGeometry(.025, 1.45, 1.8), glass, bx + side * .93, .995, bz);
    mesh(new THREE.BoxGeometry(1.86, 1.45, .025), glass, bx, .995, bz + side * .9);
    for (const dz of [-.9, .9]) box(.055, 1.48, .055, bx + side * .94, 1.02, bz + dz, brass);
    box(1.95, .05, .06, bx, 1.76, bz + side * .92, brass);
    box(.06, .05, 1.85, bx + side * .94, 1.76, bz, brass);
    // 수면 기준선은 옆에서도 읽을 수 있다.
    box(1.85, .026, .025, bx, D.waterY, bz + side * .91, brass, false);
  }
  const waterMat = new THREE.MeshBasicMaterial({ color: P.water, transparent: true, opacity: .24, depthWrite: false, side: THREE.DoubleSide });
  waterMat.userData.outlineParameters = { visible: false };
  const water = mesh(new THREE.PlaneGeometry(1.8, 1.75), waterMat, bx, D.waterY, bz); water.rotation.x = -Math.PI / 2;
  g.testMesh = mesh(sampleGeo, sampleMat, bx, D.floatY, bz); g.testMesh.visible = false;
  obstacles.push({ x: bx, z: bz, r: D.basinRadius });
  label(bx, 2.23, bz - 1, 2.35, .59)('물로 검사');
  box(.12, 2.12, .12, bx, 1.06, bz - 1.07, wood);
  g.pips = [0, 1, 2].map(i => mesh(new THREE.SphereGeometry(.08, 10, 6), mat(P.idle), -.32 + i * .32, 2.8, seg.z0 + .4));
  let paintRound = -1;
  const api = { group, cameraOccluders, obstacles, water,
    sync(reset = false) {
      g.magnet.visible = !g.solved;
      for (const it of g.items) {
        it.mesh.visible = it !== g.testItem;
        if (it.bin) { const b = it.bin, k = b.got.indexOf(it);
          it.mesh.position.set(b.x + (k % 3 - 1) * .66, .5 + Math.floor(k / 3) * .64, b.z);
          it.mesh.rotation.set(0, 0, 0);
        } else if (reset && it !== g.held) { it.mesh.position.copy(it.home); it.mesh.rotation.set(0, 0, 0); }
      }
      g.testMesh.visible = !!g.testItem;
      if (g.testItem) g.testMesh.position.set(bx, g.testItem.floats
        ? D.floatY + Math.sin(g.testT * 6) * .05 : D.floatY - g.testT * (D.floatY - D.sunkY), bz);
      if (paintRound !== g.crit.yes) { paintRound = g.crit.yes;
        labels[0](g.crit.yes); labels[1](g.crit.no);
      }
      g.pips.forEach((p, i) => p.material.color.set(i < g.round ? P.gold : P.idle));
    },
  };
  g.workshop = api; api.sync(true); g.progressCodec = sortProgress(g, legacy, crits);
  const dummy = new THREE.Object3D();
  for (const { material, solid, parts } of batches.values()) {
    const m = new THREE.InstancedMesh(cube, material, parts.length);
    parts.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.scale.set(p.w, p.h, p.d); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.castShadow = solid; m.receiveShadow = true; group.add(m); if (solid) cameraOccluders.push(m);
  }
  rects.cameraOccluders = [...(rects.cameraOccluders || []), ...cameraOccluders];
  rects.cameraLiftZones = [...(rects.cameraLiftZones || []), seg];
  return api;
}

