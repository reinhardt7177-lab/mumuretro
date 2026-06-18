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
];

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
