// 절차적 저폴리 **탐사 기록자**.
//
// ★ 원래는 집배원이었다. 그런데 재설계 때 배달 게임플레이가 통째로 사라지고
//   모자와 우편가방만 남았다 — 우체부 옷을 입혀 놓고 배달을 한 번도 안 시키면
//   아이는 시작하자마자 "내 가방 안엔 뭐가 있지?"를 묻고 답을 못 얻는다.
//   기대를 만들어 놓고 배신하는 건 세계관이 없는 것보다 나쁘다.
//
// 이 게임의 동사는 배달하다가 아니라 **알아내다**다. 그래서 재고 적는 사람으로 바꾼다.
// 실루엣의 비대칭 포인트가 우편가방에서 **등에 멘 측량봉**으로 옮겨 간다 —
// 세로로만 서 있던 몸을 가로지르는 긴 사선 하나가, 원경에서
// "이 사람은 무언가를 잰다"를 한 번에 읽히게 한다.
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
// ★ 팔레트를 우편(청·빨강)에서 야외(카키·캔버스·가죽)로 옮겼다.
//   밝은 색은 스카프 하나에만 남긴다 — 옷까지 밝으면 흔들리는 것에 시선이 안 붙는다.
export const JACKET_COLORS = [0x6b7355, 0x8a7a5c, 0x5a6b6a, 0x7a6a52, 0x4f5a4a, 0x8a6a52, 0x9aa088];
// ★ 바지를 청색 계열에서 뺐다. 자켓과 같은 계열이면 원경에서 상하가 한 덩어리로 뭉친다.
export const PANTS_COLORS = [0x6b4f38, 0x7a5b3f, 0x5a4634, 0x4a4a55, 0x8a6b48, 0x3a3a2e];
export const SHOE_COLORS = [0x3a322b, 0xc0392b, 0xe8e2d4, 0x2a5a8a, 0x6a4f3a];
export const CAP_COLORS = [0x6b5b43, 0x7a6a4e, 0x5a5342, 0x8a7550, 0x4a4436];
export const SCARF_COLORS = [0xe4674a, 0xf0a860, 0xe8e2d4, 0x8fc4a8, 0xd9a441];

export const DEFAULT_LOADOUT = {
  skin: 0xf0c9a4, hairId: 'bowl', hairColor: 0x3a3230,
  jacket: 0x6b7355, pants: 0x6b4f38, shoe: 0x3a322b,
  cap: 0x6b5b43, hasCap: true, scarf: 0xe4674a,
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
  // 소매는 자켓보다 한 단 어둡게. 같은 색이면 팔이 몸통에 묻혀 실루엣이 한 덩어리가 된다.
  const sleeve = toon(new THREE.Color(L.jacket).multiplyScalar(0.78).getHex());

  const put = (mesh, x, y, z) => { mesh.position.set(x, y, z); k.add(mesh); return mesh; };

  // ── 몸통 ────────────────────────────────────────────────────────────────
  // 어깨 넓고 허리 좁게. 이 테이퍼 하나가 상자 인간과 캐릭터를 가른다.
  // ★ 0.30 → 0.255로 좁혔다. 키 1.78에 어깨 0.30이면 폭과 높이가 비슷해져 쭈그려 보인다.
  put(prism(0.255, 0.195, 0.44, jacket, 8), 0, 1.06, 0);
  // 코트 — 허리에서 벌어지는 사다리꼴. 실루엣의 주 형태다.
  // ★ 밑단이 0.55까지 내려와 다리를 거의 다 덮었던 적이 있다(실사용 확인).
  //   다리가 보여야 서 있는 자세가 읽힌다.
  put(prism(0.195, 0.30, 0.22, jacket, 8), 0, 0.77, 0);

  // ── 코트 자락 세 장 ─────────────────────────────────────────────────
  // ★ 한 겹짜리 사다리꼴은 아무리 벌려도 납작하다. 자락을 **따로 매달아** 흔들리게 한다.
  //   각진 몸에서 움직이는 것이 스카프 하나뿐이었는데, 이걸로 둘이 된다 —
  //   체감 품질이 가장 크게 오르는 건 폴리곤이 아니라 움직이는 옷이다.
  const skirt = [];
  const hem = toon(new THREE.Color(L.jacket).multiplyScalar(0.86).getHex());
  for (const f of [
    { w: 0.34, h: 0.30, x: 0, z: -0.15, rx: 0.06 },     // 뒤 — 가장 길다
    { w: 0.20, h: 0.24, x: 0.17, z: 0.09, rx: -0.05 },  // 앞 좌
    { w: 0.20, h: 0.24, x: -0.17, z: 0.09, rx: -0.05 }, // 앞 우
  ]) {
    const g = new THREE.Group();
    g.position.set(f.x, 0.70, f.z);
    const m = box(f.w, f.h, 0.05, hem);
    m.position.y = -f.h / 2;
    g.add(m);
    g.rotation.x = f.rx;
    k.add(g);
    skirt.push({ g, base: f.rx });
  }
  put(prism(0.208, 0.208, 0.065, belt, 8), 0, 0.875, 0);
  put(box(0.085, 0.085, 0.05, toon(0xe0c060)), 0, 0.875, 0.185);

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
  for (const s of [-1, 1]) put(prism(0.095, 0.115, 0.14, jacket, 6), s * 0.215, 1.21, 0);

  // ── 등에 멘 측량봉 ──────────────────────────────────────────────────
  // 이 캐릭터에서 가장 센 실루엣 요소. 세로로만 선 몸을 **가로지르는 사선 하나**다.
  // 우편가방(등 뒤 상자)은 실루엣 밖으로 안 나가서 원경에서 안 읽혔다.
  const wood = toon(0x8a6a44), brass = toon(0xc9a24a);
  const rodG = new THREE.Group();
  rodG.position.set(0, 1.02, -0.20);
  rodG.rotation.z = 0.62; rodG.rotation.x = 0.12;
  const rod = prism(0.026, 0.032, 1.16, wood, 6);
  rodG.add(rod);
  for (const e of [-1, 1]) {
    const cap2 = prism(0.040, 0.040, 0.09, brass, 6);
    cap2.position.y = e * 0.58; rodG.add(cap2);
  }
  // 눈금 — 자라는 걸 보여 주는 흰 띠 셋
  for (const t of [-0.28, 0, 0.28]) {
    const b = box(0.058, 0.026, 0.058, toon(0xe8e2d4));
    b.position.y = t; rodG.add(b);
  }
  k.add(rodG);

  // ── 옆구리 수첩 가방 ────────────────────────────────────────────────
  // 납작하게, 등이 아니라 **옆구리**에. 측량봉과 사선이 겹치면 둘 다 안 보인다.
  const leather = toon(0x7a5836);
  put(box(0.22, 0.24, 0.11, leather), 0.26, 0.80, -0.02);
  put(box(0.24, 0.06, 0.13, toon(0x5e432a)), 0.26, 0.90, -0.02);   // 덮개
  // 말린 탐사 수첩이 삐져나온다 — 이 인물의 직업을 정하는 한 점
  const roll = put(prism(0.035, 0.035, 0.20, toon(0xe8e2d4), 6), 0.26, 0.97, -0.02);
  roll.rotation.z = 0.22;
  // 가슴을 가로지르는 멜빵 — 측량봉과 **반대 방향** 사선이라 X자가 된다
  const strap = put(box(0.055, 0.50, 0.05, belt), -0.10, 1.06, 0.06);
  strap.rotation.z = -0.34; strap.rotation.x = -0.06;

  // ── 허리에 매단 추 ──────────────────────────────────────────────────
  // 걸을 때 흔들린다. 스카프에 이어 세 번째로 흐르는 요소이고,
  // 첫 사당(무게)과 손이 닿는다 — 들고 다니는 물건이 배울 것을 미리 말해 준다.
  const bobG = new THREE.Group();
  bobG.position.set(-0.20, 0.86, 0.10);
  const cord = box(0.018, 0.16, 0.018, dark);
  cord.position.y = -0.08; bobG.add(cord);
  const weight = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 6), brass);
  weight.position.y = -0.21; weight.rotation.x = Math.PI; bobG.add(weight);
  k.add(bobG);

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
    put(box(0.058, 0.095, 0.03, dark), s * 0.085, HEAD_Y + 0.01, 0.203);
    put(box(0.075, 0.026, 0.02, toon(L.hairColor)), s * 0.088, HEAD_Y + 0.115, 0.198);   // 눈썹
  }
  put(prism(0.02, 0.028, 0.05, skin, 5), 0, HEAD_Y - 0.06, 0.21);   // 코

  buildHair(L.hairId, L.hairColor, k, HEAD_Y);

  if (L.hasCap) {
    const capMat = toon(L.cap);
    // ★ 크라운 0.13 → 0.20으로 높이고 폭을 줄였다. 낮고 넓으면 버섯 갓이 된다(실사용 확인).
    put(prism(0.175, 0.222, 0.20, capMat, 8), 0, HEAD_Y + 0.28, 0);
    // 크림 밴드 — 크라운 밑동(0.222)보다 확실히 튀어나와야 보인다. 이전엔 0.005 차이라 없는 것과 같았다.
    put(prism(0.245, 0.248, 0.05, toon(0xe8e2d4), 8), 0, HEAD_Y + 0.175, 0);
    // ★ 챙을 사방으로 넓혔다. 예전엔 앞쪽만 붙였는데(원반이 될까 봐), 챙 넓은 모자는
    //   모험가를 만드는 가장 센 신호 하나다. 원반이 되는 걸 막는 건 폭이 아니라
    //   **기울기와 테이퍼**다 — 위가 좁고 아래가 넓은 얇은 8각뿔대면 갓이 아니라 챙이 된다.
    // ★ 반지름 0.40으로 만들었더니 폭이 어깨의 1.57배가 됐다 — 탐사 모자가 아니라
    //   솜브레로다(실측). 챙은 어깨보다 조금 넓기만 하면 된다: 0.31이면 1.2배다.
    const brim = put(prism(0.24, 0.31, 0.042, capMat, 8), 0, HEAD_Y + 0.165, 0.012);
    brim.rotation.x = -0.10;
    // 앞챙만 조금 더 내민다. 완전한 대칭이면 얼굴에 그늘이 안 진다.
    const front = put(box(0.26, 0.034, 0.12, capMat), 0, HEAD_Y + 0.152, 0.27);
    front.rotation.x = -0.24;
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
  const armL = limb( 0.235, 1.21, 0.066, 0.055, 0.32, sleeve, 0.050, 0.045, 0.26, skin, null);
  const armR = limb(-0.235, 1.21, 0.066, 0.055, 0.32, sleeve, 0.050, 0.045, 0.26, skin, null);
  const legL = limb( 0.105, 0.74, 0.085, 0.073, 0.36, pants,  0.068, 0.060, 0.32, pants, shoe);
  const legR = limb(-0.105, 0.74, 0.085, 0.073, 0.36, pants,  0.068, 0.060, 0.32, pants, shoe);

  k.traverse(o => { if (o.isMesh) o.castShadow = true; });
  k.scale.setScalar(KID_H / 1.86);      // 모자 꼭대기 1.86 → 키 1.5로 정규화
  k.userData = { armL, armR, legL, legR, head, scarfTail: tail, skirt, plumb: bobG,
    walkPhase: 0, anim: 0, bob: 0 };
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

  // 코트 자락 — 달릴수록 뒤로 들린다. 앞자락과 뒷자락이 반대로 움직여야
  // 옷이 몸을 따라오는 것처럼 보인다. 한 방향으로 같이 흔들면 치마가 된다.
  if (u.skirt) {
    const lift = A * (running ? 0.34 : 0.18);
    for (let i = 0; i < u.skirt.length; i++) {
      const s = u.skirt[i];
      const dir = i === 0 ? 1 : -1;                    // 뒤자락은 뒤로, 앞자락은 앞으로
      s.g.rotation.x = s.base + dir * lift
        + Math.sin(u.walkPhase * 0.9 + i * 1.3) * 0.07 * (0.3 + A);
    }
  }
  // 허리 추 — 걸음에 맞춰 흔들린다. 작지만 이게 있으면 발이 땅을 딛는 느낌이 는다.
  if (u.plumb) {
    u.plumb.rotation.x = -sw * 0.42 * A;
    u.plumb.rotation.z = Math.sin(u.walkPhase * 0.6) * 0.12 * (0.25 + A);
  }

  // 스카프 — 달릴수록 크게 날린다.
  if (u.scarfTail) {
    const f = 0.35 + A * (running ? 0.55 : 0.30);
    for (let i = 0; i < u.scarfTail.length; i++) {
      const base = [-0.35, -0.75, -1.05][i];
      u.scarfTail[i].rotation.x = base - f * 0.35 + Math.sin(u.walkPhase * 0.8 + i * 0.7) * 0.10 * (0.4 + A);
    }
  }
}
