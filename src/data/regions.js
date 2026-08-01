// 행성 구역(biome) 정의 — 7개 앵커점으로 구면 Voronoi 분할(전 표면 덮음).
// 각 구역 = 지면 틴트 + 시그니처 성격 + 명명된 힐링 포인트. 마을만 한국 레트로.
import * as THREE from 'three';

export const REGIONS = [
  { id: 'village', name: '무무 마을',   emoji: '🏘️', lat: 15,  lon: -4,  ground: 0x8fa876, korean: true, healing: '우체통 광장' },
  { id: 'temple',  name: '돌탑 사원',   emoji: '⛩️', lat: 6,   lon: 108, ground: 0x8c937c,             healing: '명상 정원' },
  { id: 'beach',   name: '윤슬 해변',   emoji: '🏖️', lat: 46,  lon: 172, ground: 0xe6d6a8, water: 'sea',  healing: '등대 노을' },
  { id: 'lake',    name: '연꽃 호수정원', emoji: '🪷', lat: -16, lon: 232, ground: 0x7fae84, water: 'lake', healing: '정자 명상' },
  { id: 'meadow',  name: '바람언덕 목장', emoji: '🌾', lat: 32,  lon: 298, ground: 0x9ec46a,             healing: '풍차 전망' },
  { id: 'forest',  name: '속삭이는 숲',  emoji: '🌲', lat: -42, lon: 55,  ground: 0x4f6b3e,             healing: '모닥불 쉼터' },
  { id: 'hill',    name: '별빛 언덕',    emoji: '⛰️', lat: 64,  lon: 28,  ground: 0xa9a2cc,             healing: '별 보는 벤치' },
  // 8번째 구역 — 절벽으로 둘러싸인 분지. 능력이 없으면 들어갈 수 없다.
  // 멀리서 보이지만 못 가는 곳이 하나 있어야 "저기는 아직"이 생긴다.
  { id: 'mist',    name: '안개 골짜기',  emoji: '🌫️', lat: -58, lon: 150, ground: 0x6b6a7e, mystic: true, healing: '잊혀진 우체국' },
];

// 안개 골짜기 — 지형에 새길 분지 사양. Planet.heightAt이 참조한다.
export const MIST_ZONE = {
  id: 'mist',
  lat: -58, lon: 150,
  inner: 0.10,      // 분지 바닥 반경(rad)
  rim: 0.155,       // 절벽 능선 반경(rad)
  outer: 0.215,     // 바깥 지형으로 복귀하는 반경(rad)
  depth: 3.2,       // 바닥 깊이(기준 R 대비)
  wallH: 13.0,      // 절벽 능선 높이 — 벽 오르기 없이는 못 넘는다
};

// ── 순수 기하 헬퍼(Planet 인스턴스 없이도 쓸 수 있어야 함) ──────────────────
// Planet.heightAt이 물 영역을 파내려면 Planet 생성 이전에 물 위치를 알아야 하므로
// 여기서 R만 받아 계산한다. Districts.js를 import하면 Props.js까지 끌려와 순환이 된다.

const _Y = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(1, 0, 0);

// 위경도(도) → 단위 방향벡터. Planet.latLonToPos와 같은 규약.
export function latLonDir(latDeg, lonDeg) {
  const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180;
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon)
  );
}

// centerDir에서 로컬 접선(u=동, v=북) 방향으로 월드 거리만큼 이동한 단위 방향.
export function offsetDir(centerDir, u, v, R) {
  const up = centerDir.clone().normalize();
  const ref = Math.abs(up.dot(_Y)) > 0.99 ? _X : _Y;
  const east = new THREE.Vector3().crossVectors(ref, up).normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  return up.clone().addScaledVector(east, u / R).addScaledVector(north, v / R).normalize();
}

// 바다/호수 영역 — {id, center(단위방향), ang(반경 라디안)}.
// 지형(함몰)과 물 메시가 같은 값을 써야 호수가 언덕 위에 뜨지 않는다.
export function waterZones(R) {
  const out = [];
  for (const r of REGIONS) {
    if (!r.water) continue;
    const c = latLonDir(r.lat, r.lon);
    const z = r.water === 'sea'
      ? { id: r.id, center: offsetDir(c, 0, -10, R), ang: 0.2 }
      : { id: r.id, center: c.clone(), ang: 0.085 };
    // heightAt이 acos 없이 영향권을 빠르게 걸러내기 위한 내적 임계값.
    // 물가 성형이 u=2.2까지 이어지므로 그보다 넉넉해야 경계에서 지형이 끊기지 않는다.
    z.cosOuter = Math.cos(Math.min(Math.PI, z.ang * 2.3));
    out.push(z);
  }
  return out;
}

// 행성 기준 각 구역 앵커 방향벡터 + 색 미리 계산.
export function buildRegionAnchors(planet) {
  return REGIONS.map(r => ({
    ...r,
    dir: planet.latLonToPos(r.lat, r.lon).normalize(),
    color: new THREE.Color(r.ground),
  }));
}

const _n = new THREE.Vector3();

// pos(표면점)가 속한 구역 = 각거리 최소 앵커.
export function regionAt(pos, anchors) {
  _n.copy(pos).normalize();
  let best = anchors[0], bd = Infinity;
  for (const a of anchors) { const d = _n.angleTo(a.dir); if (d < bd) { bd = d; best = a; } }
  return best;
}

// 가장 가까운 두 구역(경계 블렌딩/바이옴 채색용).
export function region2(pos, anchors) {
  _n.copy(pos).normalize();
  let a1 = anchors[0], a2 = anchors[0], d1 = Infinity, d2 = Infinity;
  for (const a of anchors) {
    const d = _n.angleTo(a.dir);
    if (d < d1) { a2 = a1; d2 = d1; a1 = a; d1 = d; }
    else if (d < d2) { a2 = a; d2 = d; }
  }
  return { a1, d1, a2, d2 };
}
