import * as THREE from 'three';
import { EVAPORATION_COURT as D } from '../data/evaporationCourt.js';
import { SIEVE_PALETTE as C, EVAPORATION_PALETTE as P } from '../data/lighting.js';
import { evaporationProgress } from './EvaporationProgress.js';

export function buildEvaporationCourt(scene, seg, rects, g, legacy) {
  g.group.removeFromParent(); const group = new THREE.Group(); group.name = '거름과 증발 작업장'; scene.add(group); g.group = group;
  const obstacles = [], cameraOccluders = [], batches = new Map(), cube = new THREE.BoxGeometry(1, 1, 1);
  const mat = color => { const m = new THREE.MeshStandardMaterial({ color, roughness: .86, emissive: color, emissiveIntensity: .35, side: THREE.DoubleSide });
    m.userData.outlineParameters = { visible: false }; return m; };
  const stone = mat(C.stone), pale = mat(C.pale), floor = mat(C.floor), alt = mat(C.floorAlt), wood = mat(C.wood), edge = mat(C.edge), brass = mat(C.brass);
  const iron = mat(P.iron), sand = mat(P.sand), salt = mat(P.salt), paper = mat(P.paper), clay = mat(P.clay);
  function box(w, h, d, x, y, z, material, solid = true) {
    const key = material.uuid + solid; if (!batches.has(key)) batches.set(key, { material, solid, parts: [] });
    batches.get(key).parts.push({ w, h, d, x, y, z });
  }
  function mesh(geometry, material, parent, x = 0, y = 0, z = 0, solid = false) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); parent.add(m); m.castShadow = solid; m.receiveShadow = true;
    if (solid) cameraOccluders.push(m); return m;
  }
  function ring(radius, thick, parent, x, y, z, material = brass) {
    const m = mesh(new THREE.TorusGeometry(radius, thick, 6, 32), material, parent, x, y, z); m.rotation.x = Math.PI / 2; return m;
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
  for (const m of scene.children) if (m.userData.doorFrame === 'r3') {
    m.material = pale; if (m.geometry.parameters.height === .16) m.position.y += .82; cameraOccluders.push(m);
  }
  function label(text, x, y, z) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 192; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + C.pale.toString(16); ctx.fillRect(0, 0, 768, 192); ctx.strokeStyle = '#' + C.brass.toString(16); ctx.lineWidth = 9; ctx.strokeRect(8, 8, 752, 176);
    ctx.fillStyle = '#' + C.edge.toString(16); ctx.font = 'bold 43px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 96, 720);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }); material.userData.outlineParameters = { visible: false };
    mesh(new THREE.PlaneGeometry(2.35, .59), material, group, x, y, z);
    box(.12, y, .12, x, y / 2, z - .08, wood);
  }
  for (const name of ['magnet', 'filter', 'burner']) {
    const s = g[name]; box(2.05, .15, 1.85, s.x, .72, s.z, wood);
    for (const dx of [-.82, .82]) for (const dz of [-.7, .7]) box(.16, .65, .16, s.x + dx, .325, s.z + dz, edge);
    obstacles.push({ x: s.x, z: s.z, r: D.stationRadius });
    s.mat = new THREE.MeshBasicMaterial({ color: C.brass }); mesh(new THREE.BoxGeometry(.8, .04, .07), s.mat, group, s.x, .82, s.z + .96);
  }
  const mx = g.magnet.x, mz = g.magnet.z;
  box(.18, 1.45, .18, mx, 1.5, mz - .46, wood); box(.75, .16, .22, mx + .3, 2.15, mz - .46, brass);
  const magnet = mesh(new THREE.TorusGeometry(.42, .12, 8, 16, Math.PI), mat(P.magnet), group, mx, 1.7, mz);
  for (const side of [-1, 1]) mesh(new THREE.BoxGeometry(.2, .28, .23), mat(P.pole), group, mx + side * .42, 1.55, mz);
  label('자석 · 쇠가루', mx, 2.75, mz - .8);
  const extractedIron = new THREE.Group(); group.add(extractedIron);
  for (let k = 0; k < 14; k++) mesh(new THREE.IcosahedronGeometry(.055, 0), iron, extractedIron, mx + (k % 2 ? .42 : -.42) + Math.sin(k * 7) * .07, 1.38 + (k % 3) * .055, mz + Math.cos(k * 5) * .06);
  const fx = g.filter.x, fz = g.filter.z;
  // 옆면과 종이 바닥은 깔때기 모양이고 위가 열려 있다. 모래는 종이 안에 남는다.
  const funnel = mesh(new THREE.CylinderGeometry(D.filterRadius, .12, .82, 28, 1, true), paper, group, fx, D.filterY, fz, true);
  ring(D.filterRadius, .035, group, fx, D.filterY + .41, fz);
  for (const side of [-1, 1]) box(.07, 1.3, .07, fx + side * .9, 1.4, fz, brass);
  const residue = new THREE.Group(); group.add(residue);
  mesh(new THREE.CylinderGeometry(.59, .09, .62, 24), sand, residue, fx, 1.60, fz);
  for (let k = 0; k < 19; k++) { const a = k * 2.4, r = .11 * Math.sqrt(k);
    mesh(new THREE.IcosahedronGeometry(.065, 0), sand, residue, fx + Math.cos(a) * r, D.sandY + (k % 3) * .025, fz + Math.sin(a) * r); }
  const glass = new THREE.MeshBasicMaterial({ color: P.glass, transparent: true, opacity: .15, depthWrite: false, side: THREE.DoubleSide }); glass.userData.outlineParameters = { visible: false };
  mesh(new THREE.CylinderGeometry(.43, .43, .46, 20, 1, true), glass, group, fx, 1.03, fz);
  ring(.43, .025, group, fx, 1.26, fz, pale);
  label('거름종이 · 모래', fx, 2.75, fz - .8);
  const bx = g.burner.x, bz = g.burner.z;
  mesh(new THREE.CylinderGeometry(.8, .9, .23, 12), stone, group, bx, .9, bz, true);
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; box(.13, .26, .13, bx + Math.cos(a) * .6, 1.06, bz + Math.sin(a) * .6, edge); }
  const flame = mesh(new THREE.ConeGeometry(.22, .32, 8), mat(P.fire), group, bx, 1.09, bz); flame.visible = false;
  label('화로 · 물 날리기', bx, 2.75, bz - .8);
  // 물통은 열린 몸체다. 용해된 소금은 알갱이로 미리 보여 주지 않는다.
  g.pot = new THREE.Group(); group.add(g.pot);
  mesh(new THREE.CylinderGeometry(D.potRadius, .35, .54, 20, 1, true), clay, g.pot, 0, .27, 0, true);
  mesh(new THREE.CylinderGeometry(.35, .35, .07, 20), clay, g.pot, 0, .035, 0);
  ring(D.potRadius, .045, g.pot, 0, .54, 0, brass);
  const handle = mesh(new THREE.TorusGeometry(.21, .045, 6, 16), brass, g.pot, .52, .32, 0); handle.rotation.y = Math.PI / 2;
  g.fluidMat = mat(P.water); g.fluid = mesh(new THREE.CylinderGeometry(.405, .405, .035, 24), g.fluidMat, g.pot, 0, D.fluidY, 0);
  const grains = { iron: new THREE.Group(), sand: new THREE.Group(), salt: new THREE.Group(), lump: new THREE.Group() };
  for (const [name, material] of [['iron', iron], ['sand', sand], ['salt', salt], ['lump', mat(P.charcoal)]]) {
    g.pot.add(grains[name]); for (let k = 0; k < 13; k++) { const a = k * 2.4, r = .075 * Math.sqrt(k);
      const geo = name === 'salt' ? new THREE.BoxGeometry(.09, .08, .09) : new THREE.IcosahedronGeometry(name === 'lump' ? .115 : .04, 0);
      mesh(geo, material, grains[name], Math.cos(a) * r, .5 + (k % 3) * .025, Math.sin(a) * r); }
  }
  g.potHome.y = D.potY; const hx = g.potHome.x, hz = g.potHome.z;
  box(1.45, .13, 1.35, hx, .71, hz, wood); for (const side of [-1, 1]) box(.17, .65, 1.0, hx + side * .52, .325, hz, edge);
  obstacles.push({ x: hx, z: hz, r: D.homeRadius });
  const tx = g.tap.x, tz = g.tap.z;
  mesh(new THREE.CylinderGeometry(.66, .58, .82, 14), wood, group, tx, .41, tz, true); ring(.66, .035, group, tx, .73, tz); ring(.61, .035, group, tx, .12, tz);
  box(.12, .52, .12, tx + .5, 1, tz, brass); box(.5, .12, .12, tx + .3, 1.24, tz, brass);
  label('물 · 다시 시작', tx, 2, tz - .7); obstacles.push({ x: tx, z: tz, r: 1.0 });
  const api = { group, obstacles, cameraOccluders, residue, extractedIron, grains, funnel, flame,
    sync() {
      extractedIron.visible = ['demag', 'filtered', 'salt'].includes(g.state);
      residue.visible = ['filtered', 'salt'].includes(g.state);
      grains.iron.visible = g.state === 'mixed'; grains.sand.visible = ['mixed', 'demag'].includes(g.state);
      grains.salt.visible = g.state === 'salt'; grains.lump.visible = g.state === 'lump';
      g.fluid.visible = !['salt', 'lump'].includes(g.state); g.fluidMat.color.set(P.water);
      flame.visible = g.state === 'salt';
      if (!g.held) g.pot.position.copy(g.state === 'salt' ? new THREE.Vector3(bx, D.burnerY, bz) : g.potHome);
    },
  };
  g.workshop = api; g._paint(); api.sync(); g.progressCodec = evaporationProgress(g, legacy);
  const dummy = new THREE.Object3D();
  for (const { material, solid, parts } of batches.values()) {
    const m = new THREE.InstancedMesh(cube, material, parts.length); parts.forEach((v, i) => { dummy.position.set(v.x, v.y, v.z); dummy.scale.set(v.w, v.h, v.d); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    group.add(m); m.castShadow = solid; m.receiveShadow = true; if (solid) cameraOccluders.push(m);
  }
  rects.cameraOccluders = [...(rects.cameraOccluders || []), ...cameraOccluders]; rects.cameraLiftZones = [...(rects.cameraLiftZones || []), seg];
  return api;
}
