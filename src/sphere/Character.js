// 절차적 저폴리 집배원.
//
// ★ 재설계: 이전 버전은 파츠 33개가 **전부 직육면체**였다. 튜닉·망토·뾰족귀를 붙여 놨는데도
//   전부 상자라 실루엣이 마인크래프트에서 벗어나지 못했다(실사용 확인).
//
// 아트 바이블의 "로우폴리로 가되 디테일은 놓치지 않는다"를 캐릭터에 적용한 것이 이 파일이다.
// 디테일은 폴리곤 수가 아니라 네 곳에서 온다:
//   실루엣 다양성 — 상자 대신 **테이퍼 진 6~8각 기둥**. 면 수는 거의 같은데 형태가 깎인다
//   비율          — 4.5헤드 → 3.8헤드. 원경에서 머리가 읽혀야 캐릭터로 보인다
//   색 분리       — 자켓·모자·바지가 전부 청색이면 실루엣 안이 한 덩어리가 된다
//   흐르는 요소   — 스카프. 각진 몸에서 유일하게 흔들리는 것이라 시선이 여기 붙는다
//
// 정면 +Z. 발끝은 SurfaceActor가 Box3로 보정한다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';

export const KID_H = 1.5;

export const HAIR_STYLES = [
  { id: 'bowl', name: '바가지' },
  { id: 'short', name: '짧은머리' },
  { id: 'bob', name: '단발' },
  { id: 'long', name: '긴머리' },
];
export const SKIN_COLORS = [0xf0c9a4, 0xdda876, 0xf6d8b8, 0xc68642, 0x8d5524];
export const HAIR_COLORS = [0x3a3230, 0x1a1410, 0x5a3a22, 0x7a5230, 0x9a9a9a, 0xc0392b];
export const JACKET_COLORS = [0x3f77b0, 0xc0584e, 0x4f8a86, 0xd9a441, 0x6a5a8a, 0x3a3a44, 0xe8e2d4];
// ★ 바지를 청색 계열에서 뺐다. 자켓과 같은 계열이면 원경에서 상하가 한 덩어리로 뭉친다.
export const PANTS_COLORS = [0x6b4f38, 0x7a5b3f, 0x5a4634, 0x4a4a55, 0x8a6b48, 0x3a3a2e];
export const SHOE_COLORS = [0x3a322b, 0xc0392b, 0xe8e2d4, 0x2a5a8a, 0x6a4f3a];
export const CAP_COLORS = [0x2f5fa0, 0xc0584e, 0x3a3a44, 0xd9a441, 0x4f8a86];
export const SCARF_COLORS = [0xe4674a, 0xf0a860, 0xe8e2d4, 0x8fc4a8, 0xd9a441];

export const DEFAULT_LOADOUT = {
  skin: 0xf0c9a4, hairId: 'bowl', hairColor: 0x3a3230,
  jacket: 0x3f77b0, pants: 0x6b4f38, shoe: 0x3a322b,
  cap: 0x2f5fa0, hasCap: true, scarf: 0xe4674a,
};

// ── 형태 헬퍼 ───────────────────────────────────────────────────────────────
// 테이퍼 진 기둥. 이게 이 파일의 핵심이다 — 상자를 이걸로 바꾸는 것만으로 실루엣이 깎인다.
// 면 수: 6각 기둥 20삼각형 vs 상자 12삼각형. 파츠 여덟 개에 써도 64삼각형 차이다.
const prism = (rTop, rBot, h, mat, sides = 6) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, sides), mat);
  m.castShadow = true;
  return m;
};
const box = (w, h, d, mat) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
};

// 머리카락 — 모자 아래로 보이는 림/뒷머리. 스타일별 실루엣.
function buildHair(id, color, k, headY) {
  const mat = toon(color);
  const at = (mesh, x, y, z) => { mesh.position.set(x, y, z); k.add(mesh); return mesh; };
  if (id === 'short') {
    at(prism(0.25, 0.27, 0.10, mat, 8), 0, headY + 0.16, 0);
  } else if (id === 'bob') {
    at(prism(0.25, 0.28, 0.12, mat, 8), 0, headY + 0.15, 0);
    at(box(0.40, 0.26, 0.14, mat), 0, headY - 0.06, -0.18);
  } else if (id === 'long') {
    at(prism(0.25, 0.28, 0.12, mat, 8), 0, headY + 0.15, 0);
    // 긴 뒷머리 — 아래로 갈수록 좁아진다. 상자로 두면 판자가 된다.
    at(prism(0.19, 0.14, 0.46, mat, 6), 0, headY - 0.24, -0.17);
  } else { // bowl — 넓은 림
    at(prism(0.26, 0.30, 0.14, mat, 8), 0, headY + 0.14, 0);
  }
}

export function buildKid(loadout = DEFAULT_LOADOUT) {
  const L = { ...DEFAULT_LOADOUT, ...loadout };
  if (loadout.hair != null && loadout.hairColor == null) L.hairColor = loadout.hair;  // 구 스키마 호환
  const k = new THREE.Group();
  const skin = toon(L.skin), jacket = toon(L.jacket), pants = toon(L.pants), shoe = toon(L.shoe);
  const belt = toon(0x4a3a2a), scarf = toon(L.scarf), dark = toon(0x2a2622);

  const put = (mesh, x, y, z) => { mesh.position.set(x, y, z); k.add(mesh); return mesh; };

  // ── 몸통 ────────────────────────────────────────────────────────────────
  // 어깨 넓고 허리 좁게. 이 테이퍼 하나가 상자 인간과 캐릭터를 가른다.
  put(prism(0.30, 0.23, 0.44, jacket, 8), 0, 1.06, 0);
  // 튜닉 자락 — 허리에서 밑단으로 벌어지는 사다리꼴. 실루엣의 주 형태다.
  put(prism(0.23, 0.34, 0.30, jacket, 8), 0, 0.70, 0);
  put(prism(0.245, 0.245, 0.07, belt, 8), 0, 0.855, 0);
  put(box(0.09, 0.09, 0.05, toon(0xe0c060)), 0, 0.855, 0.21);

  // ── 스카프 ──────────────────────────────────────────────────────────────
  // 각진 몸에서 유일하게 흐르는 요소. 3단으로 나눠 뒤로 날린다 —
  // 한 판때기로 두면 그냥 등에 붙은 널빤지가 된다.
  put(prism(0.19, 0.21, 0.10, scarf, 8), 0, 1.30, 0);
  const tail = [];
  for (const t of [
    { w: 0.17, h: 0.20, y: 1.20, z: -0.20, rx: -0.35 },
    { w: 0.15, h: 0.20, y: 1.03, z: -0.30, rx: -0.75 },
    { w: 0.12, h: 0.18, y: 0.88, z: -0.36, rx: -1.05 },
  ]) {
    const m = put(box(t.w, t.h, 0.05, scarf), 0, t.y, t.z);
    m.rotation.x = t.rx;
    tail.push(m);
  }

  // 어깨 — 팔 뿌리를 덮는다
  for (const s of [-1, 1]) put(prism(0.10, 0.12, 0.14, jacket, 6), s * 0.245, 1.20, 0);

  // 우편가방 — 실루엣의 비대칭 포인트. 한쪽으로 메야 캐릭터에 방향이 생긴다.
  const pack = put(box(0.30, 0.30, 0.16, toon(0xd06a32)), 0.02, 0.92, -0.24);
  pack.rotation.x = 0.10;
  put(box(0.34, 0.05, 0.04, toon(0xa84f22)), 0.02, 0.99, -0.16);
  const strap = put(box(0.06, 0.46, 0.05, belt), 0.16, 1.06, 0.02);
  strap.rotation.z = 0.30; strap.rotation.x = -0.05;

  // ── 머리 ────────────────────────────────────────────────────────────────
  // 0.36 → 0.44. 4.5헤드에서 3.8헤드로. 원경에서 머리가 읽혀야 사람으로 보인다.
  const HEAD_Y = 1.50;
  put(prism(0.12, 0.14, 0.10, skin, 6), 0, 1.34, 0);              // 목
  const head = put(prism(0.215, 0.225, 0.42, skin, 8), 0, HEAD_Y, 0);
  put(prism(0.19, 0.16, 0.06, skin, 8), 0, HEAD_Y - 0.22, 0);     // 턱 — 아래로 좁아진다

  // 뾰족 귀 — 실루엣 포인트
  for (const s of [-1, 1]) {
    const ear = put(new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.19, 4), skin), s * 0.20, HEAD_Y + 0.04, -0.02);
    ear.rotation.z = s * -0.95; ear.rotation.y = s * 0.35; ear.castShadow = true;
  }
  // 얼굴 — 없으면 인형이다. 눈 두 개면 충분하다.
  for (const s of [-1, 1]) {
    put(box(0.045, 0.075, 0.03, dark), s * 0.082, HEAD_Y + 0.01, 0.205);
    put(box(0.065, 0.022, 0.02, toon(L.hairColor)), s * 0.085, HEAD_Y + 0.10, 0.20);   // 눈썹
  }
  put(prism(0.02, 0.028, 0.05, skin, 5), 0, HEAD_Y - 0.06, 0.21);   // 코

  buildHair(L.hairId, L.hairColor, k, HEAD_Y);

  if (L.hasCap) {
    const capMat = toon(L.cap);
    put(prism(0.20, 0.245, 0.13, capMat, 8), 0, HEAD_Y + 0.23, 0);
    // 크림 밴드 — 모자와 자켓이 같은 청색이라 이게 없으면 머리와 몸이 한 덩어리로 뭉친다.
    put(prism(0.248, 0.252, 0.045, toon(0xe8e2d4), 8), 0, HEAD_Y + 0.165, 0);
    const brim = put(box(0.30, 0.045, 0.20, capMat), 0, HEAD_Y + 0.165, 0.20);
    brim.rotation.x = -0.12;
  }

  // ── 팔다리 ──────────────────────────────────────────────────────────────
  // 위팔 → 아래팔로 가늘어진다. 같은 굵기 상자 두 개면 로봇이 된다.
  function limb(s, hy, rU0, rU1, hU, cU, rL0, rL1, hL, cL, foot) {
    const p = new THREE.Group(); p.position.set(s, hy, 0);
    const u = prism(rU0, rU1, hU, cU, 6); u.position.y = -hU / 2; p.add(u);
    const lo = prism(rL0, rL1, hL, cL, 6); lo.position.y = -hU - hL / 2 + 0.02; p.add(lo);
    if (foot) {
      const ff = box(0.15, 0.10, 0.26, foot);
      ff.position.set(0, -hU - hL - 0.01, 0.05); p.add(ff);
      const cuff = prism(0.095, 0.085, 0.12, foot, 6);
      cuff.position.set(0, -hU - hL + 0.09, 0); p.add(cuff);
    } else {
      const hand = prism(0.058, 0.052, 0.11, cL, 6);
      hand.position.y = -hU - hL - 0.04; p.add(hand);
    }
    k.add(p); return p;
  }
  const armL = limb( 0.265, 1.20, 0.068, 0.058, 0.34, jacket, 0.052, 0.046, 0.24, skin, null);
  const armR = limb(-0.265, 1.20, 0.068, 0.058, 0.34, jacket, 0.052, 0.046, 0.24, skin, null);
  const legL = limb( 0.115, 0.72, 0.088, 0.076, 0.34, pants,  0.070, 0.062, 0.30, pants, shoe);
  const legR = limb(-0.115, 0.72, 0.088, 0.076, 0.34, pants,  0.070, 0.062, 0.30, pants, shoe);

  k.traverse(o => { if (o.isMesh) o.castShadow = true; });
  k.scale.setScalar(KID_H / 1.78);      // 모자 꼭대기 1.78 → 키 1.5로 정규화
  k.userData = { armL, armR, legL, legR, head, scarfTail: tail, walkPhase: 0, anim: 0, bob: 0 };
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

  // 스카프 — 달릴수록 크게 날린다. 각진 몸에서 유일하게 움직이는 실루엣이다.
  if (u.scarfTail) {
    const f = 0.35 + A * (running ? 0.55 : 0.30);
    for (let i = 0; i < u.scarfTail.length; i++) {
      const base = [-0.35, -0.75, -1.05][i];
      u.scarfTail[i].rotation.x = base - f * 0.35 + Math.sin(u.walkPhase * 0.8 + i * 0.7) * 0.10 * (0.4 + A);
    }
  }
}
