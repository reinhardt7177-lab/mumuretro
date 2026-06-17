// 수학 유틸 — 순수 함수 + 시드 RNG. 모든 액터/유령/소포 랜덤은 시드로 재현 가능해야 함(블라인드 검증용).
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp  = (a, b, t) => a + (b - a) * t;

// 프레임레이트 독립 보간 계수. smoothing은 "1초 후 남는 비율"(작을수록 빠름). town.html:295 패턴.
export const smoothK = (smoothing, dt) => 1 - Math.pow(smoothing, dt);

const _cross = new THREE.Vector3();
// normal(단위)을 법선으로 하는 평면에서 a→b의 부호 있는 각도. a,b는 normal에 접하는 단위벡터 가정.
export function signedAngle(a, b, normal) {
  _cross.crossVectors(a, b);
  return Math.atan2(_cross.dot(normal), a.dot(b));
}

// mulberry32 — 결정론적 시드 RNG. 0~1 반환.
export function makeRNG(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
