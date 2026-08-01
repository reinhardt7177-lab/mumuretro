// 디스트릭트 배치 — 로컬 탄젠트 좌표(u,v)를 표면점으로 변환 후 frameAt으로 표면에 세움.
import * as THREE from 'three';
import { PROP_BUILDERS } from './Props.js';
import { DISTRICTS, SCATTER } from '../data/districts.js';
import { makeRNG } from '../util/math.js';

const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);

// 중심점의 로컬 탄젠트 프레임(동/북). 극 근처면 기준축 교체.
function localFrame(center) {
  const up = center.clone().normalize();
  const ref = Math.abs(up.dot(Y)) > 0.99 ? X : Y;
  const east = new THREE.Vector3().crossVectors(ref, up).normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  return { up, east, north };
}

// 중심에서 로컬 (u=동, v=북) 만큼 떨어진 표면점.
// planet을 주면 지형 높이까지 반영해 투영하고, 숫자(R)를 주면 기준 구면에 투영한다(물 메시용).
export function localToSurface(center, u, v, planet) {
  const { east, north } = localFrame(center);
  const p = center.clone().addScaledVector(east, u).addScaledVector(north, v);
  if (typeof planet === 'number') return p.setLength(planet);
  return planet.projectToSurface(p);
}

const _bb = new THREE.Box3();

// 프롭 크기 보정 — 집이 플레이어(1.5u)의 4.3배라 세계가 압도적으로 크게 느껴졌다.
// 레퍼런스(로우폴리 툰)는 집이 캐릭터의 2.5~3배 정도다. Props.js를 건드리지 않고 여기서 줄인다.
const PROP_SCALE = {
  house: 0.72, schoolFacade: 0.8, utilityPole: 0.78, streetlamp: 0.85,
  cornerShop: 0.85, stationery: 0.85, bathhouse: 0.8, palmTree: 0.85, tree: 0.9,
};

export function placeProp(scene, planet, key, pos, rotDeg = 0, opts = {}, rng = Math.random) {
  const build = PROP_BUILDERS[key];
  if (!build) { console.warn('[district] unknown prop:', key); return null; }
  const group = build(opts, rng);          // 모든 빌더 (opts, rng) 통일됨
  const sc = PROP_SCALE[key];
  if (sc) group.scale.multiplyScalar(sc);  // 바운딩 측정 전에 적용해야 접지·컬링이 맞는다
  // 표면 배치 전 로컬 바운딩으로 높이와 발자국 반경 측정(+Y가 up).
  // 높이는 수평선 컬링이, 발자국은 비탈 접지가 쓴다.
  group.updateMatrixWorld(true);
  _bb.setFromObject(group);
  group.userData.propHeight = Number.isFinite(_bb.max.y) ? Math.max(0, _bb.max.y) : 0;
  const foot = Number.isFinite(_bb.max.x)
    ? Math.max(Math.abs(_bb.max.x), Math.abs(_bb.min.x), Math.abs(_bb.max.z), Math.abs(_bb.min.z))
    : 0;
  group.userData.footprint = foot;
  // 모든 프롭을 발자국 안 최저 높이에 앉힌다. 작은 프롭도 비탈에서는 0.2~0.4u 떠 보이는데,
  // 살짝 묻히는 쪽이 훨씬 자연스럽다(나무 밑동이 흙에 파묻힌 것처럼 보임).
  planet.seatOnSurface(pos, Math.max(foot, 0.45));
  const fr = planet.frameAt(pos, rotDeg);
  group.position.copy(fr.position);
  group.quaternion.copy(fr.quaternion);
  scene.add(group);
  return group;
}

export function buildDistricts(scene, planet, seed = 1) {
  const rng = makeRNG(seed);
  const placed = [];
  const districtMeta = [];

  for (const d of DISTRICTS) {
    const center = planet.projectToSurface(planet.latLonToPos(d.lat, d.lon));
    districtMeta.push({ id: d.id, name: d.name, center });
    for (const p of d.props) {
      const pos = localToSurface(center, p.u, p.v, planet);
      const g = placeProp(scene, planet, p.b, pos, p.rot || 0, p.opts || {}, rng);
      if (g) placed.push({ group: g, key: p.b, district: d.id, pos });
    }
  }

  // 디스트릭트 사이 빈 표면을 산발 프롭으로 채움(디스트릭트 중심에서 너무 가까우면 스킵).
  const minAngle = 0.22; // rad, 디스트릭트 회피 반경
  let tries = 0;
  for (let i = 0; i < SCATTER.count && tries < SCATTER.count * 6; ) {
    tries++;
    // 구면 균일 샘플
    const z = rng() * 2 - 1, th = rng() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const pos = planet.projectToSurface(new THREE.Vector3(r * Math.cos(th), z, r * Math.sin(th)));
    let tooClose = false;
    for (const m of districtMeta) {
      if (pos.angleTo(m.center) < minAngle) { tooClose = true; break; }
    }
    if (tooClose) continue;
    const key = SCATTER.builders[Math.floor(rng() * SCATTER.builders.length)];
    const g = placeProp(scene, planet, key, pos, rng() * 360, {}, rng);
    if (g) placed.push({ group: g, key, district: 'scatter', pos });
    i++;
  }

  console.log(`[districts] ${DISTRICTS.length}개 동네 + 산발 ${SCATTER.count} → 총 ${placed.length}개 프롭 배치`);
  return { placed, districtMeta };
}
