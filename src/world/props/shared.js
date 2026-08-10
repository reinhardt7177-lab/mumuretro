// 소품 빌더 공용 헬퍼.
// 프롭 머티리얼은 생성 후 변형하지 않으므로 전부 공유 인스턴스를 쓴다
// (드로우콜·아웃라인 비용 급감).
import * as THREE from 'three';
import { toonShared as toon } from '../../rendering/Toon.js';

/** 메시 생성 + 그림자 설정 */
export const mesh = (geo, color, opts = {}) => {
  const m = new THREE.Mesh(geo, toon(color, opts));
  m.castShadow = true;
  return m;
};

/** 메시 생성 + 그림자(수신 포함) */
export const meshFlat = (geo, color, opts = {}) => {
  const m = new THREE.Mesh(geo, toon(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

/** rng으로 배열에서 하나 선택 */
export const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

/** 창문 재질 옵션 (살짝 발광) */
export const WIN_OPTS = { emissive: 0x35525a, emissiveIntensity: 0.25 };

export { toon };
