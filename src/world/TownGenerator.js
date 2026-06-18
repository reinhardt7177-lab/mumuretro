// 행성 구역 제너레이터 — 구면 Voronoi로 7개 바이옴 구역 분할, 구역별 성격으로 빽빽이 채우고
// 시그니처 GLB 앵커 + 힐링 포커스를 배치. (구 themeAt/HEALING_ZONES 통합)
import * as THREE from 'three';
import { makeRNG } from '../util/math.js';
import { toon } from '../rendering/Toon.js';
import { localToSurface, placeProp } from './Districts.js';
import { buildRegionAnchors, regionAt } from '../data/regions.js';

const DEG = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
const noOutMat = (m) => { m.userData.outlineParameters = { visible: false }; return m; };

// 구면 밀착 캡(땅/물/모래). centerDir 극 중심 구면 일부.
function sphericalCap(radius, capAngle, centerDir, mat, seg = 40) {
  const hSeg = Math.max(6, Math.round(seg * capAngle / Math.PI));
  const geo = new THREE.SphereGeometry(radius, seg, hSeg, 0, Math.PI * 2, 0, capAngle);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.quaternion.setFromUnitVectors(Y, centerDir.clone().normalize());
  mesh.receiveShadow = true;
  return mesh;
}

// 물 — 깊이 그라데이션(가장자리 얕은색→중앙 깊은색) 정점색 + 반투명 + 물가 포말 링 + 모래 rim.
// toon이 아닌 MeshBasic(평평한 물 느낌, 조명 밴딩 없음). 물결은 boot animateWater가 정점 변위.
function makeWater(R, capAngle, centerDir, scene, water) {
  const cdir = centerDir.clone().normalize();
  // 1) 모래/진흙 rim (물보다 크고 살짝 낮게)
  scene.add(sphericalCap(R + 0.02, capAngle * 1.16, cdir, noOutMat(toon(0xddc99a)), 36));

  // 2) 물 표면 — 깊이 그라데이션 정점색
  const seg = 48, hSeg = Math.max(10, Math.round(seg * capAngle / Math.PI));
  const geo = new THREE.SphereGeometry(R + 0.05, seg, hSeg, 0, Math.PI * 2, 0, capAngle);
  const pos = geo.attributes.position, n = pos.count;
  const cols = new Float32Array(n * 3);
  const deep = new THREE.Color(0x2c7a99), shallow = new THREE.Color(0x86cfd6), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i) / (R + 0.05);                 // 로컬 +Y극 기준 극각(0=중심, capAngle=가장자리)
    const t = Math.min(1, Math.acos(Math.max(-1, Math.min(1, y))) / capAngle);
    c.copy(deep).lerp(shallow, t * t);                  // 가장자리만 얕은색으로
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mat = noOutMat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false }));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.quaternion.setFromUnitVectors(Y, cdir);
  scene.add(mesh);
  water.push({ mesh, geo, base: pos.array.slice() });

  // 3) 물가 포말 링(가장자리)
  const fGeo = new THREE.SphereGeometry(R + 0.057, seg, 3, 0, Math.PI * 2, capAngle * 0.9, capAngle * 0.16);
  const foam = new THREE.Mesh(fGeo, noOutMat(new THREE.MeshBasicMaterial({ color: 0xeaf6f4, transparent: true, opacity: 0.55, depthWrite: false })));
  foam.quaternion.setFromUnitVectors(Y, cdir);
  scene.add(foam);
}

// ── 구역별 셀 채움(절차 빌더, GLB 없이도 작동) ──
function fillRegionCell(id, scene, planet, center, rng, placed, inWater) {
  const R = planet.R;
  const jit = (s) => (rng() - 0.5) * s;
  const baseRot = rng() * 360;
  const put = (key, u, v, rot, opts) => {
    const pos = localToSurface(center, u, v, R);
    if (inWater(pos)) return null;                 // 물 위엔 안 놓음
    const g = placeProp(scene, planet, key, pos, rot, opts || {}, rng);
    if (g) placed.push({ group: g, key, theme: id, pos, dir: pos.clone().normalize() });
    return g;
  };

  if (id === 'village') {
    const r = rng();
    if (r < 0.42) {
      put('house', jit(1.5), jit(1.5), baseRot, { stories: rng() < 0.5 ? 2 : 1 });
      if (rng() < 0.5) put('house', 4.5, -3, baseRot + 180, { stories: rng() < 0.4 ? 2 : 1 });
      if (rng() < 0.4) put('alleyWall', -3.5, jit(2), baseRot + 90, { length: 4 + rng() * 3 });
      if (rng() < 0.4) put('jangdokdae', 2.5, 2.5, rng() * 360);
      if (rng() < 0.3) put('pyeongsang', -1, -2.5, rng() * 360);
    } else if (r < 0.72) {
      put(rng() < 0.5 ? 'cornerShop' : 'stationery', jit(1), 1, baseRot);
      if (rng() < 0.5) put('vending', -3, 2, baseRot);
      if (rng() < 0.5) put('signboard', 1.5, -2, rng() * 360);
      if (rng() < 0.4) put('bench', -1.5, -2.5, rng() * 360);
    } else {
      if (rng() < 0.3) put('schoolFacade', 0, 2.5, baseRot); else put('playground', jit(2), jit(2), rng() * 360);
    }
    if (rng() < 0.4) put('tree', jit(8), jit(8), 0);
    if (rng() < 0.3) put(rng() < 0.5 ? 'utilityPole' : 'streetlamp', jit(8), jit(8), rng() * 360);
  } else if (id === 'forest') {
    const n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) put('tree', jit(7), jit(7), 0);
    if (rng() < 0.6) put('bush', jit(6), jit(6), 0);
    if (rng() < 0.45) put('mushroom', jit(5), jit(5), rng() * 360);
    if (rng() < 0.3) put('flowerPatch', jit(6), jit(6), rng() * 360);
    if (rng() < 0.25) put('logBench', jit(4), jit(4), rng() * 360);
  } else if (id === 'beach') {
    if (rng() < 0.5) put('palmTree', jit(8), jit(8), rng() * 360);
    if (rng() < 0.4) put('deckChair', jit(7), jit(7), rng() * 360);
    if (rng() < 0.35) put('rock', jit(8), jit(8), rng() * 360);
    if (rng() < 0.3) put('flowerpot', jit(6), jit(6), 0);
    if (rng() < 0.25) put('parasol', jit(6), jit(6), 0);
  } else if (id === 'meadow') {
    for (let i = 0; i < 2; i++) put('flowerPatch', jit(8), jit(8), rng() * 360);
    if (rng() < 0.5) put('tree', jit(7), jit(7), 0);
    if (rng() < 0.4) put('fence', jit(5), 3, baseRot + 90, { length: 4 + rng() * 2 });
    if (rng() < 0.35) put('bench', jit(6), jit(6), rng() * 360);
    if (rng() < 0.3) put('hedge', jit(4), -3.5, baseRot, { length: 3 });
  } else if (id === 'lake') {
    if (rng() < 0.6) put('tree', jit(8), jit(8), 0);
    if (rng() < 0.5) put('flowerPatch', jit(7), jit(7), rng() * 360);
    if (rng() < 0.4) put('bush', jit(6), jit(6), 0);
    if (rng() < 0.3) put('bench', jit(6), jit(6), rng() * 360);
    if (rng() < 0.3) put('lantern', jit(7), jit(7), 0);
  } else if (id === 'temple') {
    if (rng() < 0.55) put('lantern', jit(7), jit(7), 0);
    if (rng() < 0.5) put('tree', jit(8), jit(8), 0);
    if (rng() < 0.4) put('bush', jit(6), jit(6), 0);
    if (rng() < 0.3) put('rock', jit(7), jit(7), rng() * 360);
    if (rng() < 0.25) put('jangdokdae', jit(5), jit(5), rng() * 360);
  } else { // hill
    for (let i = 0; i < 2; i++) put('flowerPatch', jit(9), jit(9), rng() * 360);
    if (rng() < 0.4) put('bench', jit(7), jit(7), rng() * 360);
    if (rng() < 0.35) put('tree', jit(8), jit(8), 0);
    if (rng() < 0.3) put('streetlamp', jit(8), jit(8), 0);
    if (rng() < 0.25) put('rock', jit(7), jit(7), rng() * 360);
  }
}

// ── 구역 특징: 물 + GLB 앵커/필러 + 힐링 포커스 등록 ──
function buildRegionFeatures(region, scene, planet, rng, ctx) {
  const { placed, water, heroSpots, healingPoints, waterAreas } = ctx;
  const R = planet.R;
  const center = planet.latLonToPos(region.lat, region.lon).setLength(R);
  const wa = waterAreas[region.id];
  const inWater = (pos) => wa && pos.angleTo(wa.center) < wa.ang * 0.96;

  const hero = (asset, u, v, rot, onWater) => {
    const pos = localToSurface(center, u, v, R);
    if (!onWater && inWater(pos)) return;
    heroSpots.push({ asset, pos, dir: pos.clone().normalize(), rot: rot || 0, zone: region.id });
  };
  const putG = (key, u, v, rot, opts) => {
    const pos = localToSurface(center, u, v, R);
    if (inWater(pos)) return;
    const g = placeProp(scene, planet, key, pos, rot, opts || {}, rng);
    if (g) placed.push({ group: g, key, theme: region.id, pos, dir: pos.clone().normalize() });
  };

  // 힐링 포컬 위치(구역 중심 근처, 물 밖)
  let focal = center.clone();
  if (wa && center.angleTo(wa.center) < wa.ang) focal = localToSurface(center, 0, wa.ang * R + 5, R);
  healingPoints.push({ region: region.id, name: region.name, label: region.healing, pos: focal.clone(), dir: focal.clone().normalize() });

  if (region.id === 'village') {
    hero('post_office', 0, 6, 180);
  } else if (region.id === 'forest') {
    hero('cabin', 0, 0, rng() * 360);
    putG('campfire', 3, -3, 0); putG('logBench', 5, -3, rng() * 360); putG('logBench', 1, -5, rng() * 360);
    for (let i = 0; i < 3; i++) hero('deer', (rng() - 0.5) * 18, (rng() - 0.5) * 18, rng() * 360);
    for (let i = 0; i < 2; i++) hero('willow_tree', (rng() - 0.5) * 16, (rng() - 0.5) * 16, rng() * 360);
  } else if (region.id === 'beach') {
    hero('lighthouse', -3, 6, 0);
    hero('wooden_dock', 0, wa ? -wa.ang * R * 0.5 : -8, 0, true);   // 물가/물 위
    hero('rowboat', 2, wa ? -wa.ang * R * 0.7 : -10, rng() * 50, true); // 물 위
    putG('bench', -3, 4, 200);
  } else if (region.id === 'meadow') {
    hero('windmill', 0, 2, rng() * 360);
    hero('barn', 7, -2, rng() * 360);
    for (let i = 0; i < 4; i++) hero('sheep', (rng() - 0.5) * 20, (rng() - 0.5) * 20, rng() * 360);
    for (let i = 0; i < 2; i++) hero('haystack', (rng() - 0.5) * 14, (rng() - 0.5) * 14, rng() * 360);
    putG('bench', -2, 4, 0);
  } else if (region.id === 'lake') {
    hero('gazebo', 0, wa ? wa.ang * R + 4 : 7, 180);
    hero('wooden_bridge', 0, 0, 90, true);
    for (let i = 0; i < 5; i++) hero('lotus', (rng() - 0.5) * 8, (rng() - 0.5) * 8, rng() * 360, true);
    for (let i = 0; i < 3; i++) hero('duck', (rng() - 0.5) * 7, (rng() - 0.5) * 7, rng() * 360, true);
    for (let i = 0; i < 2; i++) hero('koi', (rng() - 0.5) * 6, (rng() - 0.5) * 6, rng() * 360, true);
  } else if (region.id === 'temple') {
    hero('pagoda', 0, 0, rng() * 360);
    hero('torii_gate', 0, 9, 0);
    hero('stone_well', 6, -4, rng() * 360);
    for (let i = 0; i < 4; i++) putG('lantern', (rng() - 0.5) * 14, (rng() - 0.5) * 14, 0);
  } else if (region.id === 'hill') {
    hero('telescope', 0, 1, rng() * 360);
    hero('tent', 5, -3, rng() * 360); hero('tent', -5, -2, rng() * 360);
    hero('hammock', 3, 4, rng() * 360);
    hero('flower_arch', -3, 5, 0);
    putG('bench', 0, -4, 0);
  }
}

export function buildTown(scene, planet, seed = 7) {
  const rng = makeRNG(seed);
  const placed = [], water = [], heroSpots = [], healingPoints = [];
  const R = planet.R;
  const latStep = 17;
  const baseLon = 16;

  const anchors = buildRegionAnchors(planet);
  planet.applyBiomeColors(anchors);

  // 1) 구역별 물(해변=바다 / 호수정원=호수) 먼저 만들고 영역 기록
  const waterAreas = {};
  for (const region of anchors) {
    if (!region.water) continue;
    const c = planet.latLonToPos(region.lat, region.lon).setLength(R);
    if (region.water === 'sea') {
      const wc = localToSurface(c, 0, -10, R), ang = 0.2;
      makeWater(R, ang, wc, scene, water); waterAreas[region.id] = { center: wc, ang };
    } else { // lake
      const wc = localToSurface(c, 0, 0, R), ang = 0.085;
      makeWater(R, ang, wc, scene, water); waterAreas[region.id] = { center: wc, ang };
    }
  }
  const inAnyWater = (pos) => {
    for (const id in waterAreas) { const w = waterAreas[id]; if (pos.angleTo(w.center) < w.ang * 0.96) return true; }
    return false;
  };

  // 2) 그리드 셀 채움(거의 균일 간격)
  for (let lat = -78; lat <= 78; lat += latStep) {
    const ring = Math.max(4, Math.round(baseLon * Math.cos(lat * DEG)));
    for (let i = 0; i < ring; i++) {
      const lon = (i / ring) * 360 + (rng() - 0.5) * (360 / ring) * 0.5;
      const la = lat + (rng() - 0.5) * latStep * 0.5;
      const center = planet.latLonToPos(la, lon).setLength(R);
      const region = regionAt(center, anchors);
      fillRegionCell(region.id, scene, planet, center, rng, placed, inAnyWater);
    }
  }

  // 3) 구역 특징(앵커/필러/힐링 포컬)
  const ctx = { placed, water, heroSpots, healingPoints, waterAreas };
  for (const region of anchors) buildRegionFeatures(region, scene, planet, rng, ctx);

  // 우체통 허브(마을 시작점) — 배달 시작
  const hubPos = planet.latLonToPos(15, -4).setLength(R);
  const hub = placeProp(scene, planet, 'mailbox', hubPos, 180, {}, rng);
  if (hub) placed.push({ group: hub, key: 'mailbox', theme: 'hub', pos: hubPos, dir: hubPos.clone().normalize() });

  console.log(`[town] 7구역 — 프롭 ${placed.length} · 물 ${water.length} · 히어로 ${heroSpots.length} · 힐링포인트 ${healingPoints.length}`);
  return { placed, water, heroSpots, healingPoints, anchors, hubPos };
}
