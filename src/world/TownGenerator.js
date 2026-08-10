// 행성 구역 제너레이터 — 구면 Voronoi로 7개 바이옴 구역 분할, 구역별 성격으로 빽빽이 채우고
// 시그니처 GLB 앵커 + 힐링 포커스를 배치. (구 themeAt/HEALING_ZONES 통합)
import * as THREE from 'three';
import { makeRNG } from '../util/math.js';
import { toon } from '../rendering/Toon.js';
import { localToSurface, placeProp, resetOccupancy, spotFree, reserveSpot } from './Districts.js';
import { buildRegionAnchors, regionAt } from '../data/regions.js';
import { SCALE } from './Planet.js';
import { buildRoads } from './Roads.js';
import { buildGroundCover } from './GroundCover.js';

const DEG = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
// 프롭을 놓을 수 있는 최대 경사(도). 이보다 가파르면 뜨거나 파묻혀 고장처럼 보인다.
const MAX_PROP_SLOPE = 26;
const _dirTmp = new THREE.Vector3();
const _dirOf = (pos) => _dirTmp.copy(pos).normalize();
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
  // 모래 rim 캡은 없앴다 — 완벽한 원이라 "수영장 테두리"로 보였고,
  // 지금은 지형 정점색(물가 모래)이 그 역할을 훨씬 자연스럽게 한다.
  //
  // 물 메시는 지형이 정하는 해안선보다 넉넉히 크게 깐다. 물 밖에서는 지형이 수면 위로
  // 올라와 물을 가리므로, 눈에 보이는 해안선 = 지형이 수면과 만나는 선(= 울퉁불퉁)이 된다.
  const seg = 48 * SCALE, hSeg = Math.max(10, Math.round(seg * capAngle / Math.PI));
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
  const jit = (s) => (rng() - 0.5) * s;
  const baseRot = rng() * 360;
  const put = (key, u, v, rot, opts) => {
    const pos = localToSurface(center, u, v, planet);
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
    } else if (r < 0.86) {
      // 목욕탕 — 굴뚝이 있어 멀리서 실루엣으로 읽히는 한국 동네의 시그니처.
      // 빌더는 있었지만 여기서 호출되지 않아 실제 게임엔 한 채도 없었다.
      put('bathhouse', jit(1), 2, baseRot);
      if (rng() < 0.5) put('alleyWall', -4, jit(2), baseRot + 90, { length: 5 + rng() * 3 });
      if (rng() < 0.4) put('bench', 2.5, -2, rng() * 360);
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
  } else if (id === 'mist') {
    // 안개 골짜기 — 옛 집배원들이 살던 빈 집들.
    // 서사용 장식이 아니라 **기능 요구사항**이다: 마지막 시련의 답 팻말이 걸릴 집이 없으면
    // 가장 가까운 집이 69u가 되어 시련 이탈 반경(46u)을 넘고, 시련이 시작하자마자 중단된다.
    if (rng() < 0.80) put('house', jit(3), jit(3), baseRot, { stories: 1 });
    if (rng() < 0.55) put('house', 5, -4, baseRot + 150, { stories: 1 });
    if (rng() < 0.40) put('house', -5, 4, baseRot + 40, { stories: 1 });
    if (rng() < 0.40) put('alleyWall', -3, jit(2), baseRot + 90, { length: 4 + rng() * 2 });
    if (rng() < 0.35) put('gravestone', jit(6), jit(6), rng() * 360);
    if (rng() < 0.30) put('lantern', jit(5), jit(5), 0);
    if (rng() < 0.25) put('rock', jit(7), jit(7), rng() * 360);
  } else { // hill
    for (let i = 0; i < 2; i++) put('flowerPatch', jit(9), jit(9), rng() * 360);
    if (rng() < 0.4) put('bench', jit(7), jit(7), rng() * 360);
    if (rng() < 0.35) put('tree', jit(8), jit(8), 0);
    if (rng() < 0.3) put('streetlamp', jit(8), jit(8), 0);
    if (rng() < 0.25) put('rock', jit(7), jit(7), rng() * 360);
  }
}

// ── 원경 랜드마크 ─────────────────────────────────────────────────────────
// 키 큰 시그니처 건물은 주변 국소 최고점으로 스냅한다. 능선 위에 서야 지평선 너머로
// 실루엣이 먼저 보이고, 플레이어가 "저기까지 가보자"는 목표를 잡을 수 있다.
// (수평선 컬링이 프롭 꼭대기 반지름을 쓰므로 높은 곳에 서면 자동으로 더 멀리서 보인다.)
const PEAK_SNAP = { lighthouse: 15, windmill: 16, pagoda: 14, telescope: 16, torii_gate: 10 };

// 급경사에 걸린 랜드마크를 주변에서 가장 평평한 자리로 옮긴다(뺄 수는 없으므로).
function findFlatSpot(planet, pos, radius) {
  let best = null, bestSlope = Infinity;
  const N = 20;
  for (let i = 0; i < N; i++) {
    const a = i * 2.399963;
    const r = radius * Math.sqrt((i + 1) / N);
    const p = localToSurface(pos, Math.cos(a) * r, Math.sin(a) * r, planet);
    const s = planet.slopeDegAt(_dirOf(p));
    if (s < bestSlope) { bestSlope = s; best = p; }
  }
  return bestSlope <= MAX_PROP_SLOPE ? best : null;
}

function findLocalPeak(planet, pos, radius) {
  const best = pos.clone();
  let bestH = pos.length() - planet.R;
  const N = 28;
  for (let i = 0; i < N; i++) {
    const a = i * 2.399963;                       // 황금각 나선 — 원판을 고르게 덮음
    const r = radius * Math.sqrt((i + 1) / N);
    const p = localToSurface(pos, Math.cos(a) * r, Math.sin(a) * r, planet);
    const h = p.length() - planet.R;
    if (h > bestH) { bestH = h; best.copy(p); }
  }
  return best;
}

// ── 구역 특징: 물 + GLB 앵커/필러 + 힐링 포커스 등록 ──
function buildRegionFeatures(region, scene, planet, rng, ctx) {
  const { placed, water, heroSpots, healingPoints, waterAreas, roads } = ctx;
  const R = planet.R;
  const center = planet.projectToSurface(planet.latLonToPos(region.lat, region.lon));
  const wa = waterAreas[region.id];
  const inWater = (pos) => wa && pos.angleTo(wa.center) < wa.ang * 0.96;

  // 물 위 히어로(배·연잎·오리)는 지형이 아니라 해수면 기준으로 놓아야 물에 뜬다.
  const hero = (asset, u, v, rot, onWater) => {
    let pos = localToSurface(center, u, v, onWater ? R : planet);
    if (!onWater && inWater(pos)) return;
    const snap = PEAK_SNAP[asset];
    if (snap && !onWater) pos = findLocalPeak(planet, pos, snap);   // 능선 위로 올림
    // 급경사면 평평한 자리를 찾아 옮긴다. 랜드마크는 빼버릴 수 없으니 이동시킨다.
    if (!onWater && planet.slopeDegAt(_dirOf(pos)) > MAX_PROP_SLOPE) {
      const flat = findFlatSpot(planet, pos, 14);
      if (flat) pos = flat;
    }
    heroSpots.push({ asset, pos, dir: pos.clone().normalize(), rot: rot || 0, zone: region.id });
  };
  // 잡동사니(벤치·등롱·모닥불)는 길과 급경사를 피한다.
  const putG = (key, u, v, rot, opts) => {
    const pos = localToSurface(center, u, v, planet);
    if (inWater(pos) || (roads && roads.onRoad(pos))) return;
    if (planet.slopeDegAt(_dirOf(pos)) > MAX_PROP_SLOPE) return;
    const g = placeProp(scene, planet, key, pos, rot, opts || {}, rng);
    if (g) placed.push({ group: g, key, theme: region.id, pos, dir: pos.clone().normalize() });
  };

  // 힐링 포컬 위치(구역 중심 근처, 물 밖)
  let focal = center.clone();
  if (wa && center.angleTo(wa.center) < wa.ang) focal = localToSurface(center, 0, wa.ang * R + 5, planet);
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
    // 물 위 장식은 호수 크기에 맞춰 퍼뜨린다. 고정 오프셋(±8u)으로 두면 호수를 키웠을 때
    // 넓은 수면 한가운데에 오리와 연잎이 옹기종기 모여 있는 그림이 된다.
    const lakeR = wa ? wa.ang * R : 6;
    const spread = (f) => (rng() - 0.5) * 2 * lakeR * f;
    hero('wooden_bridge', spread(0.5), lakeR * 0.45, 90, true);   // 한가운데보다 물가 쪽이 자연스럽다
    for (let i = 0; i < 5; i++) hero('lotus', spread(0.75), spread(0.75), rng() * 360, true);
    for (let i = 0; i < 3; i++) hero('duck', spread(0.65), spread(0.65), rng() * 360, true);
    for (let i = 0; i < 2; i++) hero('koi', spread(0.6), spread(0.6), rng() * 360, true);
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
  // 셀 간격은 각도 기반이라 행성이 커지면 월드 단위 간격도 같이 벌어진다.
  // 밀도(=단위 면적당 프롭)를 유지하려면 격자를 SCALE 배로 촘촘하게 해야 한다.
  const latStep = 17 / SCALE;
  const baseLon = 16 * SCALE;

  const anchors = buildRegionAnchors(planet);
  planet.applyBiomeColors(anchors);
  resetOccupancy();   // 프롭 겹침 방지용 점유 목록 초기화

  // 1) 구역별 물(해변=바다 / 호수정원=호수). 위치는 planet.waterZones에서 가져온다 —
  //    지형이 같은 값으로 바닥을 파므로, 여기서 따로 계산하면 물과 지형이 어긋난다.
  //    물 메시는 지형이 아닌 기준 반지름 R(해수면)에 놓인다.
  const waterAreas = {};
  for (const z of planet.waterZones) {
    const wc = z.center.clone().multiplyScalar(R);
    // 지형의 해안선이 흔들리므로(heightAt의 shoreWobble) 물 메시는 그보다 넉넉하게.
    makeWater(R, z.ang * 1.42, wc, scene, water);
    waterAreas[z.id] = { center: wc, ang: z.ang };
  }
  const inAnyWater = (pos) => {
    for (const id in waterAreas) { const w = waterAreas[id]; if (pos.angleTo(w.center) < w.ang * 0.96) return true; }
    return false;
  };

  // 2) 길 네트워크 — 프롭보다 먼저 깔아야 길 위를 비워둘 수 있다.
  const roads = buildRoads(scene, planet, anchors);

  // 3) 그리드 셀 채움(거의 균일 간격). 물 위·길 위·급경사는 제외.
  // 급경사 제외가 핵심: 프롭은 수평으로 놓이는데 땅이 기울면 뜨거나 파묻힌다.
  // 절벽에 텐트가 떠 있는 것보다 아무것도 없는 편이 훨씬 낫다.
  const blocked = (pos) => inAnyWater(pos) || roads.onRoad(pos) || planet.slopeDegAt(_dirOf(pos)) > MAX_PROP_SLOPE;
  for (let lat = -78; lat <= 78; lat += latStep) {
    const ring = Math.max(4, Math.round(baseLon * Math.cos(lat * DEG)));
    for (let i = 0; i < ring; i++) {
      const lon = (i / ring) * 360 + (rng() - 0.5) * (360 / ring) * 0.5;
      const la = lat + (rng() - 0.5) * latStep * 0.5;
      const center = planet.projectToSurface(planet.latLonToPos(la, lon));
      const region = regionAt(center, anchors);
      fillRegionCell(region.id, scene, planet, center, rng, placed, blocked);
    }
  }

  // 3.5) 지면 디테일(풀·꽃) — 인스턴싱 2 드로우콜. 빈 땅이 레퍼런스와의 큰 차이였다.
  // 표본 수다(심긴 수가 아니다). 밀도 컷을 통과한 것만 실제로 심긴다 —
  // 이제 대부분의 구역이 0에 가까우므로, 목장·호수·숲을 진짜 잔디밭으로 만들려면
  // 표본을 넉넉히 뿌려야 그 구역 몫이 충분히 떨어진다.
  const cover = buildGroundCover(scene, planet, anchors, { count: 55000, seed: 31 });

  // 4) 구역 특징(앵커/필러/힐링 포컬)
  const ctx = { placed, water, heroSpots, healingPoints, waterAreas, roads };
  for (const region of anchors) buildRegionFeatures(region, scene, planet, rng, ctx);

  // 우체통 허브(마을 시작점) — 배달 시작
  const hubPos = planet.projectToSurface(planet.latLonToPos(15, -4));
  const hub = placeProp(scene, planet, 'mailbox', hubPos, 180, {}, rng);
  if (hub) placed.push({ group: hub, key: 'mailbox', theme: 'hub', pos: hubPos, dir: hubPos.clone().normalize() });

  console.log(`[town] 7구역 — 프롭 ${placed.length} · 물 ${water.length} · 히어로 ${heroSpots.length} · 힐링포인트 ${healingPoints.length} · 길 간선 ${roads.edges.length}`);
  return { placed, water, heroSpots, healingPoints, anchors, hubPos, roads, cover };
}
