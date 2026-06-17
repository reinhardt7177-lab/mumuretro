// 절차적 저폴리 집배원. loadout(머리스타일·색·자켓·바지·신발·모자)으로 커스터마이즈.
// 정면 +Z, 발끝은 SurfaceActor가 Box3로 보정. 파츠 교체는 buildKid로 통째 재생성(드물어 저렴).
import * as THREE from 'three';
import { toon } from '../rendering/Toon.js';

export const KID_H = 1.5;

// 커스터마이즈 선택지(커스터마이저 UI가 사용)
export const HAIR_STYLES = [
  { id: 'bowl', name: '바가지' },
  { id: 'short', name: '짧은머리' },
  { id: 'bob', name: '단발' },
  { id: 'long', name: '긴머리' },
];
export const SKIN_COLORS = [0xeab78f, 0xd9a06f, 0xf0c39a, 0xc68642, 0x8d5524];
export const HAIR_COLORS = [0x352f2b, 0x1a1410, 0x5a3a22, 0x7a5230, 0x9a9a9a, 0xc0392b];
export const JACKET_COLORS = [0x3a6ea5, 0xc0584e, 0x4f8a86, 0xd9a441, 0x6a5a8a, 0x3a3a44, 0xe8e2d4];
export const PANTS_COLORS = [0x33414f, 0x4a4a55, 0x5a4a3a, 0x2a3a2a, 0x6a3a3a, 0x8a8a8a];
export const SHOE_COLORS = [0x33302d, 0xc0392b, 0xffffff, 0x2a5a8a, 0x6a4f3a];
export const CAP_COLORS = [0x2f5fa0, 0xc0584e, 0x3a3a44, 0xd9a441, 0x4f8a86];

export const DEFAULT_LOADOUT = {
  skin: 0xeab78f, hairId: 'bowl', hairColor: 0x352f2b,
  jacket: 0x3a6ea5, pants: 0x33414f, shoe: 0x33302d, cap: 0x2f5fa0, hasCap: true,
};

// 머리카락 — 모자 아래로 보이는 림/뒷머리. 스타일별 실루엣.
function buildHair(id, color, k) {
  const mat = toon(color);
  const add = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; k.add(m); };
  if (id === 'short') {
    add(0.40, 0.16, 0.40, 0, 1.59, 0);
  } else if (id === 'bob') {
    add(0.42, 0.20, 0.42, 0, 1.58, 0);
    add(0.44, 0.30, 0.16, 0, 1.40, -0.16);          // 뒷머리
    add(0.10, 0.26, 0.40, 0.21, 1.40, 0); add(0.10, 0.26, 0.40, -0.21, 1.40, 0); // 옆머리
  } else if (id === 'long') {
    add(0.42, 0.20, 0.42, 0, 1.58, 0);
    add(0.44, 0.60, 0.16, 0, 1.18, -0.18);          // 긴 뒷머리(어깨까지)
    add(0.10, 0.36, 0.42, 0.21, 1.34, 0); add(0.10, 0.36, 0.42, -0.21, 1.34, 0);
  } else { // bowl(바가지) — 넓은 림
    add(0.44, 0.22, 0.44, 0, 1.57, 0);
    add(0.44, 0.10, 0.44, 0, 1.46, 0);              // 림 한 단 더(바가지 느낌)
  }
}

export function buildKid(loadout = DEFAULT_LOADOUT) {
  const L = { ...DEFAULT_LOADOUT, ...loadout };
  if (loadout.hair != null && loadout.hairColor == null) L.hairColor = loadout.hair;  // 구 스키마(NPC) 호환
  const k = new THREE.Group();
  const skin = toon(L.skin), jacket = toon(L.jacket), pants = toon(L.pants), shoe = toon(L.shoe);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.3), jacket);
  torso.position.y = 0.95; k.add(torso);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.24), toon(0xd06a32));
  pack.position.set(0, 0.98, -0.24); k.add(pack);                // 우편가방
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.45; k.add(head);

  buildHair(L.hairId, L.hairColor, k);

  if (L.hasCap) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.42), toon(L.cap));
    cap.position.y = 1.64; cap.castShadow = true; k.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.24), toon(L.cap));
    brim.position.set(0, 1.60, 0.32); brim.castShadow = true; k.add(brim);
  }

  function limb(s, hy, gU, cU, gL, cL, foot) {
    const p = new THREE.Group(); p.position.set(s, hy, 0);
    const u = new THREE.Mesh(gU, cU); u.position.y = -gU.parameters.height / 2; p.add(u);
    const lo = new THREE.Mesh(gL, cL);
    lo.position.y = -gU.parameters.height - gL.parameters.height / 2 + 0.02; p.add(lo);
    if (foot) {
      const ff = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.27), foot);
      ff.position.set(0, -gU.parameters.height - gL.parameters.height - 0.02, 0.06); p.add(ff);
    }
    k.add(p); return p;
  }
  const armL = limb(0.33, 1.18, new THREE.BoxGeometry(0.13, 0.46, 0.13), jacket, new THREE.BoxGeometry(0.12, 0.16, 0.12), skin, null);
  const armR = limb(-0.33, 1.18, new THREE.BoxGeometry(0.13, 0.46, 0.13), jacket, new THREE.BoxGeometry(0.12, 0.16, 0.12), skin, null);
  const legL = limb(0.14, 0.68, new THREE.BoxGeometry(0.18, 0.40, 0.18), pants, new THREE.BoxGeometry(0.15, 0.34, 0.15), skin, shoe);
  const legR = limb(-0.14, 0.68, new THREE.BoxGeometry(0.18, 0.40, 0.18), pants, new THREE.BoxGeometry(0.15, 0.34, 0.15), skin, shoe);

  k.traverse(o => { if (o.isMesh) o.castShadow = true; });
  k.scale.setScalar(KID_H / 1.64);
  k.userData = { armL, armR, legL, legR, head, walkPhase: 0, anim: 0, bob: 0 };
  return k;
}

// 사인파 팔다리 애니메이션. 로컬 회전이라 구면 정렬과 무관. bob은 up 방향 → SurfaceActor가 적용.
export function animateLimbs(k, dt, moving, running) {
  const u = k.userData;
  u.anim = THREE.MathUtils.lerp(u.anim, moving ? 1 : 0, Math.min(1, dt * 8));
  u.walkPhase += dt * (running ? 16 : 11) * (moving ? 1 : 0);
  const A = u.anim, sw = Math.sin(u.walkPhase);
  u.legL.rotation.x = sw * 0.7 * A; u.legR.rotation.x = -sw * 0.7 * A;
  u.armL.rotation.x = -sw * 0.55 * A; u.armR.rotation.x = sw * 0.55 * A;
  u.bob = Math.abs(sw) * 0.06 * A;
}
