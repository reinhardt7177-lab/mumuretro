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

// 중심에서 로컬 (u=동, v=북) 만큼 떨어진 표면점(반지름 R로 투영).
export function localToSurface(center, u, v, R) {
  const { east, north } = localFrame(center);
  return center.clone().addScaledVector(east, u).addScaledVector(north, v).setLength(R);
}

export function placeProp(scene, planet, key, pos, rotDeg = 0, opts = {}, rng = Math.random) {
  const build = PROP_BUILDERS[key];
  if (!build) { console.warn('[district] unknown prop:', key); return null; }
  const group = build(opts, rng);          // 모든 빌더 (opts, rng) 통일됨
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
    const center = planet.latLonToPos(d.lat, d.lon).setLength(planet.R);
    districtMeta.push({ id: d.id, name: d.name, center });
    for (const p of d.props) {
      const pos = localToSurface(center, p.u, p.v, planet.R);
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
    const pos = new THREE.Vector3(r * Math.cos(th), z, r * Math.sin(th)).setLength(planet.R);
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
