// 밀집 타운 제너레이터 — 구 전체를 거의 균일한 그리드로 덮고, 경도 섹터별 테마로 셀을 채운다.
// "작은 행성 통째로 빽빽한 동네 한 블록" (Messenger 레퍼런스) 느낌이 목표: 빈 잔디밭이 없게.
import * as THREE from 'three';
import { makeRNG } from '../util/math.js';
import { toon } from '../rendering/Toon.js';
import { localToSurface, placeProp } from './Districts.js';

const DEG = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
const noOutMat = (m) => { m.userData.outlineParameters = { visible: false }; return m; };

// 힐링 존 — 자연 공간(해변/숲/꽃밭). 일반 밀집 건물 그리드에서 제외하고 별도 자연 구성.
export const HEALING_ZONES = [
  { id: 'beach', name: '햇살 해변', lat: 47, lon: 175, radiusDeg: 24, type: 'beach' },
  { id: 'forest', name: '속삭이는 숲', lat: -42, lon: 60, radiusDeg: 26, type: 'forest' },
  { id: 'meadow', name: '꽃바람 들판', lat: 30, lon: 300, radiusDeg: 20, type: 'meadow' },
];

// 구면에 밀착하는 땅/물 패치(스피어 캡). centerDir 방향 극을 중심으로 한 구면 일부.
function sphericalCap(radius, capAngle, centerDir, mat, seg = 40) {
  const hSeg = Math.max(6, Math.round(seg * capAngle / Math.PI));
  const geo = new THREE.SphereGeometry(radius, seg, hSeg, 0, Math.PI * 2, 0, capAngle);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.quaternion.setFromUnitVectors(Y, centerDir.clone().normalize());
  mesh.receiveShadow = true;
  return mesh;
}

// 잔잔한 물 — 반투명 캡 + 물결(boot가 정점 변위 애니메이션). base=원본 정점 사본.
function makeWater(radius, capAngle, centerDir) {
  const mat = noOutMat(toon(0x4aa3c0, { transparent: true, opacity: 0.74 }));
  const mesh = sphericalCap(radius, capAngle, centerDir, mat, 40);
  mesh.receiveShadow = false;
  return { mesh, geo: mesh.geometry, base: mesh.geometry.attributes.position.array.slice() };
}

// 경도 사분면 + 극지로 테마 결정.
function themeAt(lat, lon) {
  if (Math.abs(lat) > 66) return 'park';
  const q = Math.floor(((lon % 360) + 360) % 360 / 90) % 4;
  return ['housing', 'market', 'schoolyard', 'grove'][q];
}

// 한 셀(중심 center)을 테마에 맞게 메인 + 주변 소품으로 채움. (평균 ~2개/셀 목표)
function fillCell(scene, planet, center, theme, rng, placed) {
  const R = planet.R;
  const jit = (s) => (rng() - 0.5) * s;
  const baseRot = rng() * 360;
  const put = (key, u, v, rot, opts) => {
    const pos = localToSurface(center, u, v, R);
    const g = placeProp(scene, planet, key, pos, rot, opts || {}, rng);
    if (g) placed.push({ group: g, key, theme, pos, dir: pos.clone().normalize() });
    return g;
  };

  if (theme === 'housing') {
    put('house', jit(1.5), jit(1.5), baseRot, { stories: rng() < 0.5 ? 2 : 1 });
    if (rng() < 0.6) put('house', 4.5 + jit(1), -3 + jit(1), baseRot + (rng() < 0.5 ? 0 : 180), { stories: rng() < 0.4 ? 2 : 1 });
    if (rng() < 0.5) put('alleyWall', -3.5, jit(2), baseRot + 90, { length: 4 + rng() * 3 });
    if (rng() < 0.4) put('jangdokdae', 2.5 + jit(1), 2.5, rng() * 360);
    if (rng() < 0.35) put('pyeongsang', -1, -2.5, rng() * 360);
    if (rng() < 0.4) put('tree', -4.5, 3, 0);
    if (rng() < 0.3) put('bicycle', 1.5, -3.5, rng() * 360);
  } else if (theme === 'market') {
    put(rng() < 0.5 ? 'cornerShop' : 'stationery', jit(1), 1 + jit(1), baseRot);
    if (rng() < 0.6) put(rng() < 0.5 ? 'cornerShop' : 'stationery', 4.5, 1, baseRot);
    if (rng() < 0.5) put('vending', -3, 2, baseRot);
    if (rng() < 0.5) put('signboard', 1.5, -2, rng() * 360);
    if (rng() < 0.45) put('bench', -1.5, -2.5, rng() * 360);
    if (rng() < 0.4) put('flowerpot', 2.5, -1.5, 0);
    if (rng() < 0.3) put('house', 6, -4, baseRot + 200, { stories: 2 });
  } else if (theme === 'schoolyard') {
    const r = rng();
    if (r < 0.16) put('schoolFacade', 0, 2.5, baseRot);
    else if (r < 0.38) put('playground', jit(2), jit(2), rng() * 360);
    else {
      if (rng() < 0.55) put('fence', jit(2), 3, baseRot + 90, { length: 4 + rng() * 2 });
      if (rng() < 0.6) put('tree', jit(3), jit(3), 0);
      if (rng() < 0.35) put('bench', jit(2), -2, rng() * 360);
      if (rng() < 0.25) put('house', 5, -4, baseRot + 180, { stories: 1 });
    }
  } else if (theme === 'grove') {
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) put('tree', jit(6), jit(6), 0);
    if (rng() < 0.6) put('bush', jit(5), jit(5), 0);
    if (rng() < 0.35) put('gravestone', jit(4), jit(4), rng() * 360);
    if (rng() < 0.2) put('house', jit(2), jit(2), baseRot, { stories: 1 });
    if (rng() < 0.25) put('hedge', jit(3), -3.5, baseRot, { length: 3 });
  } else { // park (극지)
    if (rng() < 0.7) put('tree', jit(5), jit(5), 0);
    if (rng() < 0.4) put('bench', jit(3), jit(3), rng() * 360);
    if (rng() < 0.35) put('flowerpot', jit(2), jit(2), 0);
  }

  // 거리 라이닝(가로수/전봇대/가로등) — 셀 가장자리에 가끔
  if (rng() < 0.3) put(rng() < 0.45 ? 'utilityPole' : (rng() < 0.5 ? 'streetlamp' : 'tree'),
    5 * (rng() < 0.5 ? 1 : -1), 5 * (rng() < 0.5 ? 1 : -1), rng() * 360);
}

// 힐링 존 하나 구성 — 땅 캡 + 물(해변=바다 / 숲·들판=연못) + 절차 자연 산포 + 히어로 GLB 예약 스폿.
function buildHealingZone(scene, planet, z, rng, placed, water, heroSpots) {
  const R = planet.R;
  const center = planet.latLonToPos(z.lat, z.lon).setLength(R);
  const capAngle = z.radiusDeg * DEG;
  const radU = R * capAngle;                  // 물리 반경(월드 단위)
  const jit = (s) => (rng() - 0.5) * s;

  const put = (key, u, v, rot, opts) => {
    const pos = localToSurface(center, u, v, R);
    const g = placeProp(scene, planet, key, pos, rot, opts || {}, rng);
    if (g) placed.push({ group: g, key, theme: z.id, pos, dir: pos.clone().normalize() });
    return g;
  };
  const hero = (asset, u, v, rot) => {
    const pos = localToSurface(center, u, v, R);
    heroSpots.push({ asset, pos, dir: pos.clone().normalize(), rot: rot || 0, zone: z.id });
  };

  // 땅 패치
  const groundCol = z.type === 'beach' ? 0xe8d6a8 : z.type === 'forest' ? 0x4f6b3e : 0x8fbf6a;
  scene.add(sphericalCap(R + 0.05, capAngle, center, noOutMat(toon(groundCol))));

  // 물
  let waterCenter = null, waterAng = 0;
  if (z.type === 'beach') {
    waterCenter = localToSurface(center, 0, -radU * 0.45, R);
    waterAng = capAngle * 0.62;
    const w = makeWater(R + 0.18, waterAng, waterCenter); scene.add(w.mesh); water.push(w);
  } else {
    waterCenter = localToSurface(center, jit(4), -radU * 0.35, R);
    waterAng = 6 * DEG;
    const w = makeWater(R + 0.12, waterAng, waterCenter); scene.add(w.mesh); water.push(w);
  }
  const inWater = (pos) => pos.angleTo(waterCenter) < waterAng * 0.95;

  if (z.type === 'beach') {
    hero('palm_tree', -4, 5, rng() * 360);
    hero('palm_tree', 5, 6, rng() * 360);
    hero('beach_parasol', 2, 2.5, 0);
    hero('beach_rock', -6, 1, rng() * 360);
    hero('stone_lantern', 6, -1, 0);
    hero('wooden_dock', 0, -radU * 0.30, 0);     // 부두(물가)
    hero('rowboat', 1.5, -radU * 0.5, rng() * 50); // 배(물 위)
    for (let i = 0; i < 6; i++) { const u = jit(radU * 0.8), v = 2 + rng() * radU * 0.5; if (!inWater(localToSurface(center, u, v, R))) put('palmTree', u, v, rng() * 360); }
    for (let i = 0; i < 4; i++) put('deckChair', jit(radU * 0.7), 2 + rng() * radU * 0.4, rng() * 360);
    if (rng() < 0.8) put('parasol', jit(5), 3, 0);
    for (let i = 0; i < 3; i++) put('rock', jit(radU), jit(radU * 0.5) + 3, rng() * 360);
    for (let i = 0; i < 3; i++) put('flowerpot', jit(6), 4 + rng() * 4, 0);
  } else if (z.type === 'forest') {
    hero('big_tree', 0, 0, 0);
    hero('big_tree', -6, 4, 0);
    hero('mushroom_cluster', 3, -3, rng() * 360);
    hero('stone_lantern', -3, -5, 0);
    hero('picnic_table', 5, 4, rng() * 360);
    for (let i = 0; i < 16; i++) { const u = jit(radU * 1.4), v = jit(radU * 1.4); if (!inWater(localToSurface(center, u, v, R))) put('tree', u, v, 0); }
    for (let i = 0; i < 7; i++) put('bush', jit(radU), jit(radU), 0);
    for (let i = 0; i < 5; i++) put('mushroom', jit(radU * 0.7), jit(radU * 0.7), rng() * 360);
    if (rng() < 0.9) put('campfire', jit(3), -2, 0);
    for (let i = 0; i < 2; i++) put('logBench', jit(4), -2 + jit(2), rng() * 360);
    for (let i = 0; i < 3; i++) put('flowerPatch', jit(radU * 0.8), jit(radU * 0.8), rng() * 360);
    for (let i = 0; i < 2; i++) put('lantern', jit(radU * 0.7), jit(radU * 0.7), 0);
  } else { // meadow
    hero('big_tree', 0, 3, 0);
    hero('flower_bush', -4, -2, rng() * 360);
    hero('flower_bush', 4, 1, rng() * 360);
    hero('stone_lantern', 0, -4, 0);
    for (let i = 0; i < 10; i++) put('flowerPatch', jit(radU * 1.3), jit(radU * 1.3), rng() * 360);
    for (let i = 0; i < 3; i++) put('bench', jit(radU * 0.8), jit(radU * 0.8), rng() * 360);
    for (let i = 0; i < 3; i++) put('lantern', jit(radU * 0.8), jit(radU * 0.8), 0);
    for (let i = 0; i < 3; i++) put('tree', jit(radU * 0.8), jit(radU * 0.8), 0);
    for (let i = 0; i < 3; i++) put('mushroom', jit(radU * 0.6), jit(radU * 0.6), rng() * 360);
  }
}

export function buildTown(scene, planet, seed = 7) {
  const rng = makeRNG(seed);
  const placed = [];
  const water = [];
  const heroSpots = [];
  const R = planet.R;
  const latStep = 18;     // 위도 밴드 간격(도)
  const baseLon = 15;     // 적도 밴드 셀 수(고위도는 cos로 감소 → 거의 균일 간격)

  // 힐링 존 영역(건물 그리드에서 제외)
  const zones = HEALING_ZONES.map(z => ({ ...z, center: planet.latLonToPos(z.lat, z.lon).setLength(R), ang: z.radiusDeg * DEG }));
  const inAnyZone = (p) => zones.some(z => p.angleTo(z.center) < z.ang * 1.05);

  for (let lat = -78; lat <= 78; lat += latStep) {
    const ring = Math.max(4, Math.round(baseLon * Math.cos(lat * DEG)));
    for (let i = 0; i < ring; i++) {
      const lon = (i / ring) * 360 + (rng() - 0.5) * (360 / ring) * 0.5;
      const la = lat + (rng() - 0.5) * latStep * 0.5;
      const center = planet.latLonToPos(la, lon).setLength(R);
      if (inAnyZone(center)) continue;     // 자연/힐링 구역엔 건물 안 지음
      fillCell(scene, planet, center, themeAt(la, lon), rng, placed);
    }
  }

  // 힐링 존 구성
  for (const z of zones) buildHealingZone(scene, planet, z, rng, placed, water, heroSpots);

  // 랜드마크/허브 — 시작 지점(주택가) 근처 우체통, 목욕탕 굴뚝(숲 섹터 경계)
  const hubPos = planet.latLonToPos(15, -4).setLength(R);
  const hub = placeProp(scene, planet, 'mailbox', hubPos, 180, {}, rng);
  if (hub) placed.push({ group: hub, key: 'mailbox', theme: 'hub', pos: hubPos, dir: hubPos.clone().normalize() });
  const bathPos = planet.latLonToPos(-8, 250).setLength(R);
  const bath = placeProp(scene, planet, 'bathhouse', bathPos, 180, {}, rng);
  if (bath) placed.push({ group: bath, key: 'bathhouse', theme: 'landmark', pos: bathPos, dir: bathPos.clone().normalize() });

  console.log(`[town] 밀집 타운 — ${placed.length}개 프롭 · 힐링존 ${zones.length}(물 ${water.length}, 히어로 ${heroSpots.length})`);
  return { placed, hub, hubPos, water, heroSpots };
}
