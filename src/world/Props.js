// 레트로 한국 동네 소품 빌더 라이브러리.
// 모든 빌더는 THREE.Group을 반환. 로컬 원점(0,0)이 발판 중심, y=0이 지면.
// 플레이어 키 기준: 1.5 유닛.

import * as THREE from 'three';
import { toon } from '../rendering/Toon.js';
import { SWATCH } from '../data/palette.js';

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

/** 메시 생성 + 그림자 설정 */
const mesh = (geo, color, opts = {}) => {
  const m = new THREE.Mesh(geo, toon(color, opts));
  m.castShadow = true;
  return m;
};

/** 메시 생성 + 그림자(수신 포함) */
const meshFlat = (geo, color, opts = {}) => {
  const m = new THREE.Mesh(geo, toon(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

/** rng으로 배열에서 하나 선택 */
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

// 창문 재질 옵션 (살짝 발광)
const WIN_OPTS = { emissive: 0x35525a, emissiveIntensity: 0.25 };

// ─── 빌더 함수들 ─────────────────────────────────────────────────────────────

// ── buildHouse ───────────────────────────────────────────────────────────────
/** 한국 단독주택: 스투코/벽돌 벽, 옥상(평지붕), 물탱크, 문, 창문 */
export function buildHouse(opts = {}, rng = Math.random) {
  const stories = opts.stories ?? (rng() > 0.5 ? 2 : 1);
  const wallColor = opts.color ?? (rng() > 0.5 ? pick(SWATCH.stucco, rng) : pick(SWATCH.brick, rng));

  const W = 3.2;   // 너비 (X)
  const D = 2.8;   // 깊이 (Z)
  const floorH = 2.6; // 층 높이
  const totalH = floorH * stories;
  const parH = 0.35;  // 파라펫 높이
  const parT = 0.18;  // 파라펫 두께

  const g = new THREE.Group();

  // 본체 벽
  const body = meshFlat(new THREE.BoxGeometry(W, totalH, D), wallColor);
  body.position.y = totalH / 2;
  g.add(body);

  // 옥상 슬라브 (파라펫 아래)
  const roofSlab = meshFlat(new THREE.BoxGeometry(W, 0.12, D), pick(SWATCH.concrete, rng) ?? SWATCH.concrete);
  roofSlab.position.y = totalH + 0.06;
  g.add(roofSlab);

  // 파라펫 (앞·뒤·좌·우)
  const parColor = SWATCH.concrete;
  const parFB = mesh(new THREE.BoxGeometry(W + parT * 2, parH, parT), parColor); // 앞/뒤
  const parLR = mesh(new THREE.BoxGeometry(parT, parH, D), parColor);            // 좌/우

  const parY = totalH + 0.12 + parH / 2;
  [-1, 1].forEach(s => {
    const pf = parFB.clone();
    pf.position.set(0, parY, s * (D / 2 + parT / 2));
    g.add(pf);
    const pl = parLR.clone();
    pl.position.set(s * (W / 2 + parT / 2), parY, 0);
    g.add(pl);
  });

  // 옥상 물탱크 (녹청)
  const tankR = 0.38, tankH = 0.6;
  const tankBody = mesh(new THREE.CylinderGeometry(tankR, tankR, tankH, 8), SWATCH.tank);
  tankBody.position.set(W * 0.25, totalH + 0.12 + parH + tankH / 2 + 0.18, -D * 0.2);
  g.add(tankBody);
  // 물탱크 받침 다리 (4개)
  const legH = 0.2;
  [[0.22, 0.22], [0.22, -0.22], [-0.22, 0.22], [-0.22, -0.22]].forEach(([lx, lz]) => {
    const leg = mesh(new THREE.CylinderGeometry(0.04, 0.04, legH, 4), SWATCH.metal);
    leg.position.set(W * 0.25 + lx, totalH + 0.12 + parH + legH / 2, -D * 0.2 + lz);
    g.add(leg);
  });
  // 물탱크 뚜껑
  const tankLid = mesh(new THREE.CylinderGeometry(tankR + 0.04, tankR + 0.04, 0.06, 8), SWATCH.metal);
  tankLid.position.set(W * 0.25, totalH + 0.12 + parH + tankH + 0.18 + 0.03, -D * 0.2);
  g.add(tankLid);

  // +Z 정면: 문
  const doorW = 0.55, doorH = 1.3;
  const doorColor = rng() > 0.5 ? SWATCH.teal : SWATCH.wood;
  const door = mesh(new THREE.BoxGeometry(doorW, doorH, 0.08), doorColor);
  door.position.set(0, doorH / 2, D / 2 + 0.01);
  g.add(door);

  // 창문 (각 층에 2개씩)
  for (let s = 0; s < stories; s++) {
    const winY = floorH * s + floorH * 0.6;
    [-0.9, 0.9].forEach(wx => {
      const win = mesh(new THREE.BoxGeometry(0.55, 0.65, 0.08), SWATCH.window, WIN_OPTS);
      win.position.set(wx, winY, D / 2 + 0.01);
      g.add(win);
    });
    // 측면 창문
    const sideWin = mesh(new THREE.BoxGeometry(0.08, 0.55, 0.5), SWATCH.window, WIN_OPTS);
    sideWin.position.set(W / 2 + 0.01, winY, 0.3);
    g.add(sideWin);
  }

  return g;
}

// ── buildAlleyWall ───────────────────────────────────────────────────────────
/** 골목 담장: 콘크리트/벽돌 낮은 벽, X축 방향, 선택적 철문 */
export function buildAlleyWall(opts = {}, rng = Math.random) {
  const length = opts.length ?? 4.0;
  const H = 1.6;
  const T = 0.22;

  const g = new THREE.Group();

  const wallColor = rng() > 0.4 ? SWATCH.concrete : pick(SWATCH.brick, rng);
  const wall = meshFlat(new THREE.BoxGeometry(length, H, T), wallColor);
  wall.position.y = H / 2;
  g.add(wall);

  // 꼭대기 캡
  const cap = mesh(new THREE.BoxGeometry(length + 0.04, 0.1, T + 0.08), SWATCH.concrete);
  cap.position.y = H + 0.05;
  g.add(cap);

  // 철문 패널 (담장 중앙)
  if (rng() > 0.4) {
    const gateW = 0.9, gateH = H - 0.1;
    const gate = mesh(new THREE.BoxGeometry(gateW, gateH, T + 0.05), SWATCH.metal);
    gate.position.set(0, gateH / 2 + 0.05, 0);
    g.add(gate);
    // 문 손잡이
    const handle = mesh(new THREE.BoxGeometry(0.08, 0.06, 0.1), SWATCH.metal);
    handle.position.set(gateW * 0.35, gateH * 0.45, T / 2 + 0.08);
    g.add(handle);
  }

  return g;
}

// ── buildPyeongsang ──────────────────────────────────────────────────────────
/** 평상: 낮은 나무 평상, 4개 짧은 다리 */
export function buildPyeongsang(opts = {}, rng = Math.random) {
  const W = 1.4, D = 1.4, topH = 0.08, legH = 0.37, legR = 0.06;
  const totalH = legH + topH; // ≈ 0.45

  const g = new THREE.Group();

  // 상판
  const top = meshFlat(new THREE.BoxGeometry(W, topH, D), SWATCH.wood);
  top.position.y = legH + topH / 2;
  g.add(top);

  // 다리 4개
  [[0.55, 0.55], [0.55, -0.55], [-0.55, 0.55], [-0.55, -0.55]].forEach(([lx, lz]) => {
    const leg = mesh(new THREE.CylinderGeometry(legR, legR, legH, 6), SWATCH.wood);
    leg.position.set(lx, legH / 2, lz);
    g.add(leg);
  });

  // 옆 지지대 (나무 가로대)
  const railH = 0.06;
  [0, Math.PI / 2].forEach(ry => {
    const rail = mesh(new THREE.BoxGeometry(W - 0.15, railH, railH), SWATCH.wood);
    rail.rotation.y = ry;
    rail.position.y = legH * 0.5;
    g.add(rail);
  });

  return g;
}

// ── buildUtilityPole ─────────────────────────────────────────────────────────
/** 전봇대: 나무 기둥, 횡목, 변압기 박스, 절연 핀 */
export function buildUtilityPole(opts = {}, rng = Math.random) {
  const poleH = 6.0, poleR = 0.1;
  const g = new THREE.Group();

  // 주 기둥
  const pole = mesh(new THREE.CylinderGeometry(poleR, poleR * 1.3, poleH, 7), SWATCH.pole);
  pole.position.y = poleH / 2;
  g.add(pole);

  // 횡목 (크로스암)
  const armY = poleH * 0.88;
  const arm = mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), SWATCH.pole);
  arm.position.y = armY;
  g.add(arm);

  // 절연 핀 (insulator nubs) - 6개
  [-0.6, 0, 0.6].forEach(ax => {
    [0, 1].forEach(side => {
      const insR = 0.055, insH = 0.14;
      const ins = mesh(new THREE.CylinderGeometry(insR, insR * 0.7, insH, 6), SWATCH.concrete);
      ins.position.set(ax, armY + (side ? insH / 2 + 0.05 : -(insH / 2 + 0.05)), 0);
      g.add(ins);
    });
  });

  // 변압기 박스
  const tboxW = 0.32, tboxH = 0.42;
  const tbox = mesh(new THREE.BoxGeometry(tboxW, tboxH, tboxW), SWATCH.metal);
  tbox.position.set(0.18, poleH * 0.72, 0);
  g.add(tbox);

  // 기둥 밑동 받침
  const base = mesh(new THREE.CylinderGeometry(poleR * 1.8, poleR * 2.2, 0.15, 6), SWATCH.concrete);
  base.position.y = 0.075;
  g.add(base);

  return g;
}

// ── buildCornerShop ──────────────────────────────────────────────────────────
/** 구멍가게: 차양, 자판기, 나무 상자, 간판 */
export function buildCornerShop(opts = {}, rng = Math.random) {
  const W = 3.0, D = 2.6, H = 2.8;
  const wallColor = opts.color ?? pick(SWATCH.stucco, rng);
  const g = new THREE.Group();

  // 본체
  const body = meshFlat(new THREE.BoxGeometry(W, H, D), wallColor);
  body.position.y = H / 2;
  g.add(body);

  // 지붕 슬라브
  const roofSlab = meshFlat(new THREE.BoxGeometry(W + 0.1, 0.15, D + 0.1), SWATCH.concrete);
  roofSlab.position.y = H + 0.075;
  g.add(roofSlab);

  // 차양 (줄무늬): +Z 정면 위에 얇은 박스 3줄
  const awningW = W + 0.2, awningD = 0.9, stripH = 0.1;
  const awningY = H * 0.72;
  SWATCH.awning.forEach((col, i) => {
    const strip = mesh(new THREE.BoxGeometry(awningW, stripH, awningD), col);
    strip.position.set(0, awningY - i * (stripH + 0.01), D / 2 + awningD / 2);
    strip.rotation.x = -0.18; // 약간 앞으로 기울기
    g.add(strip);
  });

  // 간판 바 (차양 위)
  const sign = mesh(new THREE.BoxGeometry(W + 0.1, 0.4, 0.12), SWATCH.mustard);
  sign.position.set(0, H * 0.88, D / 2 + 0.07);
  g.add(sign);

  // 문
  const door = mesh(new THREE.BoxGeometry(0.6, 1.35, 0.08), SWATCH.teal);
  door.position.set(-W * 0.28, 0.675, D / 2 + 0.01);
  g.add(door);

  // 창문
  const win = mesh(new THREE.BoxGeometry(0.9, 0.85, 0.08), SWATCH.window, WIN_OPTS);
  win.position.set(W * 0.22, H * 0.45, D / 2 + 0.01);
  g.add(win);

  // 자판기 (문 옆)
  const vm = _vendingMachineGroup(rng);
  vm.position.set(W * 0.42, 0, D / 2 + 0.15);
  g.add(vm);

  // 나무 상자 3개 쌓기
  _crateStack(g, rng, -W * 0.38, D / 2 + 0.18);

  return g;
}

// ── buildStationery ──────────────────────────────────────────────────────────
/** 문방구: 가챠 머신, 장난감 통, 청록 간판 */
export function buildStationery(opts = {}, rng = Math.random) {
  const W = 3.0, D = 2.6, H = 2.8;
  const wallColor = opts.color ?? pick(SWATCH.stucco, rng);
  const g = new THREE.Group();

  // 본체
  const body = meshFlat(new THREE.BoxGeometry(W, H, D), wallColor);
  body.position.y = H / 2;
  g.add(body);

  // 지붕 슬라브
  const roofSlab = meshFlat(new THREE.BoxGeometry(W + 0.1, 0.15, D + 0.1), SWATCH.concrete);
  roofSlab.position.y = H + 0.075;
  g.add(roofSlab);

  // 청록 간판
  const sign = mesh(new THREE.BoxGeometry(W, 0.45, 0.14), SWATCH.teal);
  sign.position.set(0, H * 0.9, D / 2 + 0.08);
  g.add(sign);

  // 간판 아래 차양 (단색)
  const awningColor = pick(SWATCH.awning, rng);
  const awning = mesh(new THREE.BoxGeometry(W + 0.15, 0.12, 0.75), awningColor);
  awning.position.set(0, H * 0.72, D / 2 + 0.38);
  awning.rotation.x = -0.2;
  g.add(awning);

  // 문
  const door = mesh(new THREE.BoxGeometry(0.55, 1.35, 0.08), SWATCH.wood);
  door.position.set(0, 0.675, D / 2 + 0.01);
  g.add(door);

  // 창문 좌우
  [-0.95, 0.95].forEach(wx => {
    const win = mesh(new THREE.BoxGeometry(0.65, 0.8, 0.08), SWATCH.window, WIN_OPTS);
    win.position.set(wx, H * 0.42, D / 2 + 0.01);
    g.add(win);
  });

  // 가챠/뽑기 머신 2개 (앞에 나란히)
  [-0.5, 0.5].forEach((gx, i) => {
    const gm = _gachaMachine(rng);
    gm.position.set(gx + W * 0.35 * (i ? 1 : -1), 0, D / 2 + 0.22);
    g.add(gm);
  });

  // 장난감 통 (작은 박스)
  const bin = mesh(new THREE.BoxGeometry(0.55, 0.4, 0.45), SWATCH.mustard);
  bin.position.set(-W * 0.38, 0.2, D / 2 + 0.24);
  g.add(bin);

  return g;
}

// ── buildBathhouse ───────────────────────────────────────────────────────────
/** 목욕탕: 큰 건물 + 랜드마크 굴뚝 (~9u) */
export function buildBathhouse(opts = {}, rng = Math.random) {
  const W = 5.5, D = 4.0, H = 4.2; // 2층 규모
  const g = new THREE.Group();

  // 본체 (스투코)
  const wallColor = pick(SWATCH.stucco, rng);
  const body = meshFlat(new THREE.BoxGeometry(W, H, D), wallColor);
  body.position.y = H / 2;
  g.add(body);

  // 지붕 슬라브
  const roofSlab = meshFlat(new THREE.BoxGeometry(W + 0.1, 0.2, D + 0.1), SWATCH.concrete);
  roofSlab.position.y = H + 0.1;
  g.add(roofSlab);

  // 파라펫
  const parH = 0.4, parT = 0.2;
  [[W + parT, parT, 0, 0], [W + parT, parT, 0, D / 2 + parT / 2], [W + parT, parT, 0, -(D / 2 + parT / 2)], [parT, parT, D, 0]].forEach(() => {});
  // 간단하게 4면 파라펫
  const parY = H + 0.2 + parH / 2;
  [
    [W + parT * 2, parH, parT, 0,            0,  D / 2 + parT / 2],
    [W + parT * 2, parH, parT, 0,            0, -(D / 2 + parT / 2)],
    [parT, parH, D,            W / 2 + parT / 2, 0, 0],
    [parT, parH, D,           -(W / 2 + parT / 2), 0, 0],
  ].forEach(([bw, bh, bd, px, py, pz]) => {
    const par = mesh(new THREE.BoxGeometry(bw, bh, bd), SWATCH.concrete);
    par.position.set(px, parY, pz);
    g.add(par);
  });

  // 간판 (앞면)
  const sign = mesh(new THREE.BoxGeometry(W * 0.6, 0.6, 0.15), SWATCH.teal);
  sign.position.set(0, H * 0.85, D / 2 + 0.08);
  g.add(sign);

  // 문 + 아치형 암시 (위에 작은 반원 박스)
  const doorW = 1.0, doorH = 2.0;
  const door = mesh(new THREE.BoxGeometry(doorW, doorH, 0.1), SWATCH.teal);
  door.position.set(0, doorH / 2, D / 2 + 0.02);
  g.add(door);
  // 문 위 아치 (반구형 암시)
  const arch = mesh(new THREE.CylinderGeometry(doorW / 2, doorW / 2, 0.1, 8, 1, false, 0, Math.PI), pick(SWATCH.stucco, rng));
  arch.rotation.z = Math.PI / 2;
  arch.rotation.x = Math.PI / 2;
  arch.position.set(0, doorH + 0.05, D / 2 + 0.02);
  g.add(arch);

  // 창문들 (1층 2개, 2층 3개)
  [[- W * 0.3, H * 0.3], [W * 0.3, H * 0.3], [-W * 0.35, H * 0.65], [0, H * 0.65], [W * 0.35, H * 0.65]].forEach(([wx, wy]) => {
    const win = mesh(new THREE.BoxGeometry(0.7, 0.8, 0.09), SWATCH.window, WIN_OPTS);
    win.position.set(wx, wy, D / 2 + 0.02);
    g.add(win);
  });

  // ── 굴뚝 (랜드마크, 건물 뒤편에) ───────────────────────────────────────
  const chiH = 9.0, chiR = 0.45;
  const chiX = -W * 0.35, chiZ = -D * 0.3;

  // 굴뚝 본체 (벽돌)
  const chiColor = pick(SWATCH.brick, rng);
  const chi = mesh(new THREE.CylinderGeometry(chiR * 0.85, chiR, chiH, 10), chiColor);
  chi.position.set(chiX, chiH / 2, chiZ);
  g.add(chi);

  // 굴뚝 상단 림 (약간 넓은 링)
  const rimH = 0.28;
  const rim = mesh(new THREE.CylinderGeometry(chiR * 1.25, chiR * 1.1, rimH, 10), SWATCH.concrete);
  rim.position.set(chiX, chiH + rimH / 2, chiZ);
  g.add(rim);

  // 굴뚝 띠 (3개 수평 줄)
  [0.2, 0.48, 0.75].forEach(frac => {
    const band = mesh(new THREE.CylinderGeometry(chiR * 1.05, chiR * 1.05, 0.1, 10), SWATCH.concrete);
    band.position.set(chiX, chiH * frac, chiZ);
    g.add(band);
  });

  return g;
}

// ── buildTree ────────────────────────────────────────────────────────────────
/** 가로수: 나무 기둥 + 잎 덩어리 ~3.5u */
export function buildTree(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const trunkH = 1.8, trunkR = 0.12;

  const trunk = mesh(new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 6), SWATCH.trunk);
  trunk.position.y = trunkH / 2;
  g.add(trunk);

  // 잎 덩어리 1 (주)
  const leafColor1 = pick(SWATCH.leaf, rng);
  const blob1 = mesh(new THREE.IcosahedronGeometry(0.85, 0), leafColor1);
  blob1.position.y = trunkH + 0.65;
  g.add(blob1);

  // 잎 덩어리 2 (작은 보조)
  if (rng() > 0.3) {
    const leafColor2 = pick(SWATCH.leaf, rng);
    const blob2 = mesh(new THREE.IcosahedronGeometry(0.55, 0), leafColor2);
    blob2.position.set((rng() - 0.5) * 0.8, trunkH + 1.2, (rng() - 0.5) * 0.5);
    g.add(blob2);
  }

  // 잎 덩어리 3 (옆)
  if (rng() > 0.55) {
    const blob3 = mesh(new THREE.IcosahedronGeometry(0.45, 0), pick(SWATCH.leaf, rng));
    blob3.position.set((rng() - 0.5) * 1.0, trunkH + 0.3, (rng() - 0.5) * 0.7);
    g.add(blob3);
  }

  return g;
}

// ── buildStreetlamp ──────────────────────────────────────────────────────────
/** 가로등: 얇은 기둥 + 등갓 */
export function buildStreetlamp(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const poleH = 3.5, poleR = 0.055;

  // 기둥
  const pole = mesh(new THREE.CylinderGeometry(poleR, poleR * 1.4, poleH, 6), SWATCH.pole);
  pole.position.y = poleH / 2;
  g.add(pole);

  // 기둥 밑동
  const base = mesh(new THREE.CylinderGeometry(poleR * 2.5, poleR * 3.0, 0.14, 6), SWATCH.concrete);
  base.position.y = 0.07;
  g.add(base);

  // 수평 암
  const arm = mesh(new THREE.BoxGeometry(0.5, 0.055, 0.055), SWATCH.pole);
  arm.position.set(0.22, poleH - 0.12, 0);
  g.add(arm);

  // 등갓 박스
  const headW = 0.35, headH = 0.18, headD = 0.22;
  const head = mesh(new THREE.BoxGeometry(headW, headH, headD), SWATCH.metal);
  head.position.set(0.42, poleH - 0.12, 0);
  g.add(head);

  // 전구 (발광)
  const bulb = mesh(new THREE.BoxGeometry(headW - 0.08, headH * 0.5, headD - 0.06), SWATCH.window, WIN_OPTS);
  bulb.position.set(0.42, poleH - 0.18, 0);
  g.add(bulb);

  return g;
}

// ── buildMailbox ─────────────────────────────────────────────────────────────
/** 우체통: 빨간 원통 몸체 + 슬롯 + 작은 지붕 + 짧은 기둥, 전체 ~1.3u */
export function buildMailbox(opts = {}, rng = Math.random) {
  const g = new THREE.Group();

  const postH = 0.5, postR = 0.055;
  const bodyR = 0.2, bodyH = 0.55;
  const totalH = postH + bodyH; // ≈ 1.05 (뚜껑 포함 ~1.3)

  // 기둥
  const post = mesh(new THREE.CylinderGeometry(postR, postR * 1.3, postH, 6), SWATCH.pole);
  post.position.y = postH / 2;
  g.add(post);

  // 몸체 (원통)
  const body = mesh(new THREE.CylinderGeometry(bodyR, bodyR, bodyH, 10), SWATCH.postbox);
  body.position.y = postH + bodyH / 2;
  g.add(body);

  // 투입구 슬롯 (앞)
  const slot = mesh(new THREE.BoxGeometry(0.18, 0.04, 0.06), SWATCH.metal);
  slot.position.set(0, postH + bodyH * 0.6, bodyR + 0.01);
  g.add(slot);

  // 작은 둥근 지붕
  const roofR = bodyR + 0.04;
  const roofH = 0.18;
  const roofTop = mesh(new THREE.CylinderGeometry(0.04, roofR, roofH, 10), SWATCH.postbox);
  roofTop.position.y = postH + bodyH + roofH / 2;
  g.add(roofTop);

  // 베이스 캡
  const baseCap = mesh(new THREE.CylinderGeometry(bodyR * 1.08, bodyR * 1.08, 0.05, 10), SWATCH.postbox);
  baseCap.position.y = postH + 0.025;
  g.add(baseCap);

  return g;
}

// ── buildBench ───────────────────────────────────────────────────────────────
/** 공원 벤치: ~1.2u 너비 */
export function buildBench(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const W = 1.2, legH = 0.38, legT = 0.07;

  // 다리 2개 (I자형 지지)
  [-W * 0.35, W * 0.35].forEach(lx => {
    const leg = mesh(new THREE.BoxGeometry(legT, legH, 0.35), SWATCH.metal);
    leg.position.set(lx, legH / 2, 0);
    g.add(leg);
    // 발 스프레더
    const foot = mesh(new THREE.BoxGeometry(legT, legT, 0.35), SWATCH.metal);
    foot.position.set(lx, legT / 2, 0);
    g.add(foot);
  });

  // 좌판 (나무 판자 3줄)
  const slat = 0.08, gap = 0.04;
  [-slat - gap, 0, slat + gap].forEach((sz, i) => {
    const plank = meshFlat(new THREE.BoxGeometry(W, 0.06, slat), SWATCH.wood);
    plank.position.set(0, legH + 0.03, sz);
    g.add(plank);
  });

  // 등받이
  const back = mesh(new THREE.BoxGeometry(W, 0.3, 0.06), SWATCH.wood);
  back.position.set(0, legH + 0.18, -0.2);
  back.rotation.x = 0.15;
  g.add(back);

  // 등받이 지지 막대
  [-W * 0.35, W * 0.35].forEach(bx => {
    const bleg = mesh(new THREE.BoxGeometry(0.05, 0.32, 0.06), SWATCH.metal);
    bleg.position.set(bx, legH + 0.18, -0.2);
    g.add(bleg);
  });

  return g;
}

// ── buildVendingMachine ──────────────────────────────────────────────────────
/** 자판기: 독립형 또는 구멍가게에서 재사용 */
export function buildVendingMachine(opts = {}, rng = Math.random) {
  return _vendingMachineGroup(rng);
}

// ─── 내부 서브빌더 ────────────────────────────────────────────────────────────

/** 자판기 그룹 (내부 공통) */
function _vendingMachineGroup(rng) {
  const g = new THREE.Group();
  const vmW = 0.5, vmH = 1.55, vmD = 0.42;

  // 본체
  const body = mesh(new THREE.BoxGeometry(vmW, vmH, vmD), SWATCH.metal);
  body.position.y = vmH / 2;
  g.add(body);

  // 상단 색 밴드 (빨간/청록)
  const topBand = mesh(new THREE.BoxGeometry(vmW + 0.01, 0.25, vmD + 0.01), rng() > 0.5 ? SWATCH.postbox : SWATCH.teal);
  topBand.position.y = vmH - 0.1;
  g.add(topBand);

  // 전면 발광 패널
  const panel = mesh(new THREE.BoxGeometry(vmW * 0.72, vmH * 0.52, 0.06), SWATCH.window, WIN_OPTS);
  panel.position.set(0, vmH * 0.53, vmD / 2 + 0.01);
  g.add(panel);

  // 버튼 열 (작은 박스 3개)
  [0.3, 0.45, 0.6].forEach((fy, i) => {
    const btn = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.05), i === 0 ? SWATCH.postbox : SWATCH.mustard);
    btn.position.set(vmW * 0.25, vmH * fy, vmD / 2 + 0.04);
    g.add(btn);
  });

  // 배출구
  const slot = mesh(new THREE.BoxGeometry(vmW * 0.45, 0.08, 0.06), SWATCH.concrete);
  slot.position.set(0, vmH * 0.18, vmD / 2 + 0.01);
  g.add(slot);

  return g;
}

/** 가챠/뽑기 머신 (문방구 앞) */
function _gachaMachine(rng) {
  const g = new THREE.Group();
  const bodyR = 0.18, bodyH = 0.5;
  const legH = 0.28;

  // 다리 (원통)
  const leg = mesh(new THREE.CylinderGeometry(0.055, 0.07, legH, 6), SWATCH.metal);
  leg.position.y = legH / 2;
  g.add(leg);

  // 몸체 (원통)
  const col = rng() > 0.5 ? SWATCH.postbox : SWATCH.teal;
  const body = mesh(new THREE.CylinderGeometry(bodyR, bodyR, bodyH, 10), col);
  body.position.y = legH + bodyH / 2;
  g.add(body);

  // 돔 위 (구체 반쪽)
  const dome = mesh(new THREE.SphereGeometry(bodyR, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), SWATCH.window, WIN_OPTS);
  dome.position.y = legH + bodyH;
  g.add(dome);

  // 투입구 노브
  const knob = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6), SWATCH.mustard);
  knob.position.set(bodyR, legH + bodyH * 0.45, 0);
  knob.rotation.z = Math.PI / 2;
  g.add(knob);

  return g;
}

/** 나무 상자 더미 (구멍가게용) */
function _crateStack(parent, rng, x, z) {
  [[0.32, 0, 0.32, 0], [0.28, 0.32, 0.28, 0.08]].forEach(([cw, cy, cd, cx]) => {
    const crate = mesh(new THREE.BoxGeometry(cw, 0.28, cd), SWATCH.wood);
    crate.position.set(x + cx, cy + 0.14, z);
    parent.add(crate);
  });
  // 맨 위에 작은 상자
  const top = mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), SWATCH.wood);
  top.position.set(x + 0.04, 0.32 + 0.28 + 0.1, z);
  parent.add(top);
}

// ── buildHedge ───────────────────────────────────────────────────────────────
/** 산울타리: X축 방향 낮은 잎 울타리, ~0.9u 높이 */
export function buildHedge(opts = {}, rng = Math.random) {
  const length = opts.length ?? 3.0;
  const H = 0.9;
  const D = 0.55;
  const g = new THREE.Group();

  // 기본 박스 (가장 낮은 층)
  const base = mesh(new THREE.BoxGeometry(length, H * 0.55, D), pick(SWATCH.leaf, rng));
  base.position.y = H * 0.55 / 2;
  g.add(base);

  // 울퉁불퉁한 윗부분 — 3개의 오프셋 박스
  const bumpCount = 3;
  for (let i = 0; i < bumpCount; i++) {
    const bumpW = length / bumpCount * (0.85 + rng() * 0.25);
    const bumpH = H * (0.35 + rng() * 0.2);
    const bumpX = -length / 2 + (i + 0.5) * (length / bumpCount) + (rng() - 0.5) * 0.15;
    const bump = mesh(new THREE.BoxGeometry(bumpW, bumpH, D * (0.8 + rng() * 0.2)), pick(SWATCH.leaf, rng));
    bump.position.set(bumpX, H * 0.55 + bumpH / 2 - 0.05, (rng() - 0.5) * 0.08);
    g.add(bump);
  }

  return g;
}

// ── buildFlowerpot ───────────────────────────────────────────────────────────
/** 화분: 테라코타 화분 + 꽃 덩어리, ~0.5u 높이 */
export function buildFlowerpot(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const potR = 0.18, potH = 0.22;

  // 화분 몸체 (원뿔 형태 — 아래가 약간 더 좁음)
  const pot = mesh(new THREE.CylinderGeometry(potR, potR * 0.75, potH, 8), toon(0xb5705a));
  pot.castShadow = true;
  pot.position.y = potH / 2;
  g.add(pot);

  // 화분 림 (위쪽 테두리)
  const rim = mesh(new THREE.CylinderGeometry(potR * 1.1, potR, 0.05, 8), toon(0xb5705a));
  rim.position.y = potH + 0.025;
  g.add(rim);

  // 흙 (상단 덮개)
  const soil = mesh(new THREE.CylinderGeometry(potR * 0.95, potR * 0.95, 0.04, 8), toon(0x5a3e28));
  soil.position.y = potH + 0.02;
  g.add(soil);

  // 꽃 덩어리 (랜덤 색상)
  const flowerColors = [0xe85d8e, 0xf4c542, 0xf47c3b, 0xd45bcc, 0xff6b6b];
  const flowerCol = flowerColors[Math.floor(rng() * flowerColors.length)];
  const flowerR = 0.13 + rng() * 0.05;
  const flower = mesh(new THREE.IcosahedronGeometry(flowerR, 0), toon(flowerCol));
  flower.position.y = potH + 0.04 + flowerR;
  g.add(flower);

  // 작은 잎 블롭
  if (rng() > 0.4) {
    const leafBlob = mesh(new THREE.IcosahedronGeometry(0.07, 0), pick(SWATCH.leaf, rng));
    leafBlob.position.set(potR * 0.7, potH + 0.04 + flowerR * 0.7, 0);
    g.add(leafBlob);
  }

  return g;
}

// ── buildBicycle ─────────────────────────────────────────────────────────────
/** 자전거: 2 바퀴, 프레임, 핸들바, 안장. ~1.0u 높이 */
export function buildBicycle(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const accentColors = [SWATCH.teal, SWATCH.mustard, toon(0xe05050), toon(0x4a90d9)];
  const accent = accentColors[Math.floor(rng() * accentColors.length)];

  // 바퀴 (토러스)
  const wheelR = 0.3, wheelT = 0.06;
  [-0.42, 0.42].forEach(wx => {
    const wheel = mesh(new THREE.TorusGeometry(wheelR, wheelT, 6, 12), SWATCH.metal);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(wx, wheelR, 0);
    g.add(wheel);
    // 허브
    const hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6), SWATCH.metal);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx, wheelR, 0);
    g.add(hub);
  });

  // 프레임 — 아래 가로대
  const chainStay = mesh(new THREE.BoxGeometry(0.84, 0.045, 0.045), SWATCH.metal);
  chainStay.position.set(0, wheelR * 0.4, 0);
  g.add(chainStay);

  // 프레임 — 상단 탑튜브 (살짝 기울어진 느낌)
  const topTube = mesh(new THREE.BoxGeometry(0.68, 0.045, 0.045), SWATCH.metal);
  topTube.position.set(-0.05, wheelR + 0.28, 0);
  topTube.rotation.z = 0.12;
  g.add(topTube);

  // 프레임 — 시트튜브
  const seatTube = mesh(new THREE.BoxGeometry(0.045, 0.38, 0.045), SWATCH.metal);
  seatTube.position.set(-0.38, wheelR + 0.09, 0);
  g.add(seatTube);

  // 프레임 — 다운튜브
  const downTube = mesh(new THREE.BoxGeometry(0.55, 0.045, 0.045), SWATCH.metal);
  downTube.rotation.z = 0.55;
  downTube.position.set(-0.03, wheelR + 0.12, 0);
  g.add(downTube);

  // 핸들바
  const stem = mesh(new THREE.BoxGeometry(0.045, 0.22, 0.045), SWATCH.metal);
  stem.position.set(0.38, wheelR + 0.24, 0);
  g.add(stem);
  const handlebar = mesh(new THREE.BoxGeometry(0.045, 0.06, 0.36), SWATCH.metal);
  handlebar.position.set(0.38, wheelR + 0.46, 0);
  g.add(handlebar);

  // 안장
  const saddle = mesh(new THREE.BoxGeometry(0.22, 0.05, 0.1), accent);
  saddle.position.set(-0.38, wheelR + 0.47, 0);
  g.add(saddle);

  // 페달 (크랭크셋 암시)
  const pedal = mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), SWATCH.metal);
  pedal.position.set(0, wheelR * 0.4 + 0.02, 0);
  g.add(pedal);

  // 전체를 살짝 기울임
  g.rotation.z = 0.08;

  return g;
}

// ── buildFence ───────────────────────────────────────────────────────────────
/** 낮은 울타리: 말뚝 + 수평 레일, X축 방향, ~1.0u 높이 */
export function buildFence(opts = {}, rng = Math.random) {
  const length = opts.length ?? 3.0;
  const H = 1.0;
  const picketW = 0.08, picketD = 0.08;
  const fenceColor = rng() > 0.35 ? SWATCH.wood : SWATCH.metal;
  const g = new THREE.Group();

  // 말뚝 (피켓) 개수
  const spacing = 0.28;
  const count = Math.max(2, Math.round(length / spacing));
  const actualSpacing = length / count;

  for (let i = 0; i <= count; i++) {
    const px = -length / 2 + i * actualSpacing;
    const picket = mesh(new THREE.BoxGeometry(picketW, H, picketD), fenceColor);
    picket.position.set(px, H / 2, 0);
    g.add(picket);
  }

  // 수평 레일 2개
  [H * 0.25, H * 0.72].forEach(ry => {
    const rail = mesh(new THREE.BoxGeometry(length, 0.06, 0.06), fenceColor);
    rail.position.set(0, ry, 0);
    g.add(rail);
  });

  return g;
}

// ── buildSignboard ───────────────────────────────────────────────────────────
/** 입간판: A프레임 또는 기둥 간판, ~1.3u 높이 */
export function buildSignboard(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const boardColor = rng() > 0.5 ? SWATCH.mustard : SWATCH.teal;
  const useAFrame = rng() > 0.4;

  if (useAFrame) {
    // A프레임 — 두 개의 기울어진 패널
    const panelW = 0.9, panelH = 0.7, panelT = 0.06;
    [-1, 1].forEach(side => {
      const panel = mesh(new THREE.BoxGeometry(panelW, panelH, panelT), boardColor);
      panel.position.set(0, 0.5 + panelH / 2, side * 0.18);
      panel.rotation.x = side * 0.38;
      g.add(panel);
    });
    // A프레임 연결 힌지 (상단 바)
    const hinge = mesh(new THREE.BoxGeometry(panelW * 0.8, 0.05, 0.05), SWATCH.metal);
    hinge.position.set(0, 0.5 + 0.7, 0);
    g.add(hinge);
    // 바닥 스프레더
    const spread = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.38), SWATCH.metal);
    spread.position.set(0, 0.1, 0);
    g.add(spread);
  } else {
    // 기둥형 간판
    const postH = 0.9, postR = 0.04;
    [-0.32, 0.32].forEach(px => {
      const post = mesh(new THREE.CylinderGeometry(postR, postR, postH, 6), SWATCH.pole);
      post.position.set(px, postH / 2, 0);
      g.add(post);
    });
    // 보드
    const board = mesh(new THREE.BoxGeometry(0.85, 0.55, 0.07), boardColor);
    board.position.set(0, postH + 0.275, 0);
    g.add(board);
    // 보드 테두리
    const border = mesh(new THREE.BoxGeometry(0.91, 0.61, 0.04), SWATCH.metal);
    border.position.set(0, postH + 0.275, -0.02);
    g.add(border);
  }

  return g;
}

// ── buildSchoolFacade ────────────────────────────────────────────────────────
/** 학교 건물: 넓고 긴 2층 건물 (~9u×4u×4u), 창문 그리드, 정문 기둥 */
export function buildSchoolFacade(opts = {}, rng = Math.random) {
  const W = 9.0, D = 4.0, H = 4.0;
  const g = new THREE.Group();
  const wallColor = opts.color ?? pick(SWATCH.stucco, rng);

  // 본체
  const body = meshFlat(new THREE.BoxGeometry(W, H, D), wallColor);
  body.position.y = H / 2;
  g.add(body);

  // 지붕 슬라브
  const roofSlab = meshFlat(new THREE.BoxGeometry(W + 0.2, 0.2, D + 0.2), SWATCH.concrete);
  roofSlab.position.y = H + 0.1;
  g.add(roofSlab);

  // 파라펫
  const parH = 0.4, parT = 0.18;
  const parY = H + 0.2 + parH / 2;
  [
    [W + parT * 2, parH, parT, 0, parY, D / 2 + parT / 2],
    [W + parT * 2, parH, parT, 0, parY, -(D / 2 + parT / 2)],
    [parT, parH, D, W / 2 + parT / 2, parY, 0],
    [parT, parH, D, -(W / 2 + parT / 2), parY, 0],
  ].forEach(([bw, bh, bd, px, py, pz]) => {
    const par = mesh(new THREE.BoxGeometry(bw, bh, bd), SWATCH.concrete);
    par.position.set(px, py, pz);
    g.add(par);
  });

  // 창문 그리드: +Z 정면 2층 × 각 층 5열
  const winW = 0.75, winH = 0.7, winT = 0.08;
  const winCols = 5;
  const floorH = H / 2;
  for (let floor = 0; floor < 2; floor++) {
    const winY = floorH * floor + floorH * 0.6;
    for (let col = 0; col < winCols; col++) {
      const wx = -W / 2 + (col + 0.5) * (W / winCols);
      // 중앙 열은 문 자리이므로 1층에선 건너뜀
      if (floor === 0 && col === Math.floor(winCols / 2)) continue;
      const win = mesh(new THREE.BoxGeometry(winW, winH, winT), SWATCH.window, WIN_OPTS);
      win.position.set(wx, winY, D / 2 + winT / 2);
      g.add(win);
    }
  }

  // 입구 문 (1층 중앙)
  const doorW = 1.1, doorH = 2.0, doorT = 0.1;
  const door = mesh(new THREE.BoxGeometry(doorW, doorH, doorT), SWATCH.teal);
  door.position.set(0, doorH / 2, D / 2 + doorT / 2);
  g.add(door);

  // 문 위 아치 패널
  const archPanel = mesh(new THREE.BoxGeometry(doorW + 0.2, 0.35, doorT), pick(SWATCH.brick, rng));
  archPanel.position.set(0, doorH + 0.175, D / 2 + doorT / 2);
  g.add(archPanel);

  // 정문 기둥 2개 (건물 앞 돌출)
  const gatePostH = H * 0.75, gatePostR = 0.15;
  [-0.9, 0.9].forEach(px => {
    const gatePost = mesh(new THREE.CylinderGeometry(gatePostR, gatePostR * 1.15, gatePostH, 8), SWATCH.concrete);
    gatePost.position.set(px, gatePostH / 2, D / 2 + 0.55);
    g.add(gatePost);
    // 기둥 캡
    const cap = mesh(new THREE.BoxGeometry(gatePostR * 2.5, 0.12, gatePostR * 2.5), SWATCH.concrete);
    cap.position.set(px, gatePostH + 0.06, D / 2 + 0.55);
    g.add(cap);
  });

  // 계단 (문 앞)
  [0, 1, 2].forEach(step => {
    const stW = 1.8 + step * 0.4, stH = 0.12, stD = 0.3;
    const stair = meshFlat(new THREE.BoxGeometry(stW, stH, stD), SWATCH.concrete);
    stair.position.set(0, step * stH, D / 2 + 0.3 + step * stD);
    g.add(stair);
  });

  // 학교 이름 간판 (지붕 위 현판 암시)
  const nameSign = mesh(new THREE.BoxGeometry(W * 0.45, 0.45, 0.1), SWATCH.mustard);
  nameSign.position.set(0, H + 0.2 + parH + 0.225, D / 2 - 0.05);
  g.add(nameSign);

  return g;
}

// ── buildPlayground ──────────────────────────────────────────────────────────
/** 놀이터: 그네 프레임 + 미끄럼틀 + 모래박스, ~4u 발판 */
export function buildPlayground(opts = {}, rng = Math.random) {
  const g = new THREE.Group();

  // ── 그네 (swing) ─────────────────────────────────────────────────────────
  // A프레임 기둥 좌측
  const swingH = 2.2, swingW = 1.6, legT = 0.08;
  const swingOffX = -1.4, swingOffZ = -0.8;

  // 두 쌍의 A프레임 다리
  [-0.5, 0.5].forEach(side => {
    const legA = mesh(new THREE.BoxGeometry(legT, swingH, legT), SWATCH.metal);
    legA.rotation.z = side * 0.22;
    legA.position.set(swingOffX + side * 0.28, swingH / 2, swingOffZ - 0.55);
    g.add(legA);

    const legB = mesh(new THREE.BoxGeometry(legT, swingH, legT), SWATCH.metal);
    legB.rotation.z = side * 0.22;
    legB.position.set(swingOffX + side * 0.28, swingH / 2, swingOffZ + 0.55);
    g.add(legB);
  });

  // 상단 가로바
  const topBar = mesh(new THREE.BoxGeometry(legT, legT, swingW + 0.4), SWATCH.metal);
  topBar.position.set(swingOffX, swingH - 0.05, swingOffZ);
  g.add(topBar);

  // 그네 줄 + 시트 (2개)
  [-0.25, 0.25].forEach(sz => {
    // 줄 (앞, 뒤)
    const ropeH = 1.4;
    const ropeF = mesh(new THREE.BoxGeometry(0.02, ropeH, 0.02), toon(0x8b6914));
    ropeF.position.set(swingOffX - 0.1, swingH - ropeH / 2 - 0.05, swingOffZ + sz);
    g.add(ropeF);
    const ropeB = mesh(new THREE.BoxGeometry(0.02, ropeH, 0.02), toon(0x8b6914));
    ropeB.position.set(swingOffX + 0.1, swingH - ropeH / 2 - 0.05, swingOffZ + sz);
    g.add(ropeB);

    // 시트
    const seat = mesh(new THREE.BoxGeometry(0.28, 0.06, 0.18), SWATCH.wood);
    seat.position.set(swingOffX, swingH - ropeH - 0.02, swingOffZ + sz);
    g.add(seat);
  });

  // ── 미끄럼틀 (slide) ─────────────────────────────────────────────────────
  const slideOffX = 1.1, slideOffZ = -0.5;
  const platformH = 1.4, platformW = 0.9, platformD = 0.9;

  // 플랫폼 기둥
  [[0.38, 0.38], [0.38, -0.38], [-0.38, 0.38], [-0.38, -0.38]].forEach(([lx, lz]) => {
    const leg = mesh(new THREE.CylinderGeometry(0.06, 0.06, platformH, 6), SWATCH.metal);
    leg.position.set(slideOffX + lx, platformH / 2, slideOffZ + lz);
    g.add(leg);
  });

  // 플랫폼 상판
  const platform = meshFlat(new THREE.BoxGeometry(platformW, 0.1, platformD), SWATCH.wood);
  platform.position.set(slideOffX, platformH + 0.05, slideOffZ);
  g.add(platform);

  // 안전 레일
  const railH = 0.45;
  [[platformW / 2, 0], [-platformW / 2, 0]].forEach(([rx, rz]) => {
    const rail = mesh(new THREE.BoxGeometry(0.05, railH, platformD), SWATCH.metal);
    rail.position.set(slideOffX + rx, platformH + 0.1 + railH / 2, slideOffZ);
    g.add(rail);
  });

  // 슬라이드 경사면 — 플랫폼 앞 모서리(위, y=platformH) → 지면(앞쪽)으로 정확히 연결
  const run = 1.6, drop = platformH;                 // 수평 거리 / 수직 낙차
  const rampL = Math.hypot(run, drop), rampW = 0.6, rampT = 0.08;
  const angle = Math.atan2(drop, run);               // rotation.x = +angle → +Z(앞)쪽이 아래로
  const zTop = slideOffZ + platformD / 2;            // 플랫폼 앞 모서리 z
  const rampCZ = zTop + run / 2;                      // 경사면 중심 z
  const ramp = meshFlat(new THREE.BoxGeometry(rampW, rampT, rampL), toon(0xf4c542));
  ramp.rotation.x = angle;
  ramp.position.set(slideOffX, platformH / 2, rampCZ);
  g.add(ramp);
  // 양옆 낮은 가드레일
  [-1, 1].forEach(s => {
    const guard = mesh(new THREE.BoxGeometry(0.05, 0.16, rampL), SWATCH.metal);
    guard.rotation.x = angle;
    guard.position.set(slideOffX + s * (rampW / 2 + 0.02), platformH / 2 + 0.1, rampCZ);
    g.add(guard);
  });

  // 뒤쪽 사다리(레일 2 + 가로대 3)
  const ladZ = slideOffZ - platformD / 2 - 0.05;
  [-0.3, 0.3].forEach(rx => {
    const rail = mesh(new THREE.BoxGeometry(0.05, platformH, 0.05), SWATCH.metal);
    rail.position.set(slideOffX + rx, platformH / 2, ladZ);
    g.add(rail);
  });
  for (let i = 1; i <= 3; i++) {
    const rung = mesh(new THREE.BoxGeometry(0.66, 0.04, 0.04), SWATCH.metal);
    rung.position.set(slideOffX, (platformH * i) / 4, ladZ);
    g.add(rung);
  }

  // ── 모래박스 (sandbox) ───────────────────────────────────────────────────
  const boxOffX = 0.2, boxOffZ = 1.3;
  const sbW = 1.8, sbD = 1.8, borderH = 0.15, borderT = 0.12;

  // 4면 목재 테두리
  [
    [sbW, borderH, borderT, 0, borderH / 2, sbD / 2 + borderT / 2],
    [sbW, borderH, borderT, 0, borderH / 2, -(sbD / 2 + borderT / 2)],
    [borderT, borderH, sbD, sbW / 2 + borderT / 2, borderH / 2, 0],
    [borderT, borderH, sbD, -(sbW / 2 + borderT / 2), borderH / 2, 0],
  ].forEach(([bw, bh, bd, px, py, pz]) => {
    const border = mesh(new THREE.BoxGeometry(bw, bh, bd), SWATCH.wood);
    border.position.set(boxOffX + px, py, boxOffZ + pz);
    g.add(border);
  });

  // 모래 바닥
  const sand = meshFlat(new THREE.BoxGeometry(sbW, 0.06, sbD), toon(0xd4b483));
  sand.position.set(boxOffX, 0.03, boxOffZ);
  g.add(sand);

  return g;
}

// ── buildGravestone ──────────────────────────────────────────────────────────
/** 돌탑/묘비: 둥근 비석 + 작은 받침, ~0.8u 높이 */
export function buildGravestone(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const stoneColor = rng() > 0.4 ? SWATCH.concrete : toon(0x8a8a9a);

  // 받침 (낮은 기단)
  const baseW = 0.55, baseH = 0.1, baseD = 0.2;
  const base = mesh(new THREE.BoxGeometry(baseW, baseH, baseD), stoneColor);
  base.position.y = baseH / 2;
  g.add(base);

  if (rng() > 0.4) {
    // 둥근 헤드스톤 형태 (박스 + 위 반구)
    const stoneW = 0.38, stoneH = 0.55, stoneT = 0.14;
    const stoneBody = mesh(new THREE.BoxGeometry(stoneW, stoneH, stoneT), stoneColor);
    stoneBody.position.y = baseH + stoneH / 2;
    g.add(stoneBody);
    // 둥근 윗부분
    const topR = stoneW / 2;
    const top = mesh(new THREE.CylinderGeometry(topR * 0.7, topR, topR, 8, 1, false, 0, Math.PI), stoneColor);
    top.rotation.z = Math.PI / 2;
    top.rotation.y = Math.PI / 2;
    top.position.set(0, baseH + stoneH + topR * 0.35, 0);
    g.add(top);
  } else {
    // 돌탑 형태 — 점점 작아지는 박스 스택
    let y = baseH;
    const levels = 3 + Math.floor(rng() * 2);
    for (let i = 0; i < levels; i++) {
      const scale = 1 - i * 0.18;
      const lH = 0.13 + rng() * 0.05;
      const stone = mesh(new THREE.BoxGeometry(0.38 * scale, lH, 0.2 * scale), stoneColor);
      stone.position.set((rng() - 0.5) * 0.04, y + lH / 2, (rng() - 0.5) * 0.03);
      g.add(stone);
      y += lH + 0.01;
    }
  }

  return g;
}

// ── buildJangdokdae ──────────────────────────────────────────────────────────
/** 장독대: 낮은 석조 단 위에 옹기 항아리 3-5개 클러스터, ~1.0u 높이 */
export function buildJangdokdae(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const jarColor = toon(0x4a3528);
  const lidColor = toon(0x3a2a1e);

  // 장독대 받침 (낮은 돌 플랫폼)
  const platW = 1.8, platD = 1.2, platH = 0.18;
  const plat = meshFlat(new THREE.BoxGeometry(platW, platH, platD), SWATCH.concrete);
  plat.position.y = platH / 2;
  g.add(plat);

  // 항아리 배치 (3–5개)
  const jarCount = 3 + Math.floor(rng() * 3);
  const positions = [
    [-0.55, -0.32], [0, -0.28], [0.55, -0.32],
    [-0.28, 0.28], [0.28, 0.28],
  ];

  for (let i = 0; i < jarCount; i++) {
    const [jx, jz] = positions[i];
    const scale = 0.75 + rng() * 0.35;
    const jarR = 0.2 * scale;
    const jarH = 0.55 * scale;
    const jarY = platH;

    // 항아리 몸체 (중간이 볼록한 구체에 가까운 실린더)
    const jarBody = mesh(new THREE.SphereGeometry(jarR * 1.1, 8, 6), jarColor);
    jarBody.scale.y = jarH / (jarR * 1.1 * 2);
    jarBody.position.set(jx, jarY + jarH / 2, jz);
    g.add(jarBody);

    // 항아리 목 (좁아지는 윗부분)
    const neck = mesh(new THREE.CylinderGeometry(jarR * 0.45, jarR * 0.75, jarH * 0.28, 8), jarColor);
    neck.position.set(jx, jarY + jarH + jarH * 0.1, jz);
    g.add(neck);

    // 뚜껑
    const lidR = jarR * 0.6;
    const lid = mesh(new THREE.CylinderGeometry(lidR * 0.3, lidR, 0.07, 8), lidColor);
    lid.position.set(jx, jarY + jarH + jarH * 0.28 + 0.035, jz);
    g.add(lid);

    // 뚜껑 손잡이 (작은 볼록 노브)
    const knob = mesh(new THREE.SphereGeometry(0.04, 6, 4), lidColor);
    knob.position.set(jx, jarY + jarH + jarH * 0.28 + 0.08, jz);
    g.add(knob);
  }

  return g;
}

// ── buildBush ────────────────────────────────────────────────────────────────
/** 덤불: 1-2개 낮은 잎 덩어리, 줄기 없음, ~0.8u 높이 */
export function buildBush(opts = {}, rng = Math.random) {
  const g = new THREE.Group();

  // 메인 덩어리
  const mainR = 0.38 + rng() * 0.12;
  const main = mesh(new THREE.IcosahedronGeometry(mainR, 0), pick(SWATCH.leaf, rng));
  main.position.y = mainR * 0.65;
  g.add(main);

  // 두 번째 작은 덩어리
  if (rng() > 0.35) {
    const side = mesh(new THREE.IcosahedronGeometry(mainR * 0.65, 0), pick(SWATCH.leaf, rng));
    side.position.set((rng() - 0.5) * mainR * 1.2, mainR * 0.45, (rng() - 0.5) * mainR * 0.8);
    g.add(side);
  }

  // 세 번째 더 작은 덩어리 (가끔)
  if (rng() > 0.65) {
    const tiny = mesh(new THREE.IcosahedronGeometry(mainR * 0.4, 0), pick(SWATCH.leaf, rng));
    tiny.position.set((rng() - 0.5) * mainR * 0.9, mainR * 0.3, (rng() - 0.5) * mainR * 0.9);
    g.add(tiny);
  }

  return g;
}

// ── buildPalmTree ─────────────────────────────────────────────────────────────
/** 야자수: 굽은 기둥 + 잎사귀 방사형 + 코코넛, ~4.5u 높이 */
export function buildPalmTree(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const segCount = 5;
  const segH = 0.82;
  let curX = 0, curY = 0;
  // 기둥: 쌓인 실린더를 조금씩 X로 오프셋
  for (let i = 0; i < segCount; i++) {
    const r = 0.11 - i * 0.012;
    const nudgeX = (rng() - 0.5) * 0.12;
    const seg = mesh(new THREE.CylinderGeometry(Math.max(r - 0.01, 0.05), r, segH, 7), SWATCH.trunk);
    seg.position.set(curX + nudgeX * 0.5, curY + segH / 2, 0);
    g.add(seg);
    curX += nudgeX;
    curY += segH;
  }
  const topY = curY;
  const topX = curX;
  // 잎사귀 (6-8개)
  const frondCount = 6 + Math.floor(rng() * 3);
  const leafColor = pick(SWATCH.leaf, rng);
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2;
    const frondL = 1.1 + rng() * 0.35;
    const frond = mesh(new THREE.BoxGeometry(0.12, 0.06, frondL), leafColor);
    frond.position.set(
      topX + Math.sin(angle) * frondL * 0.48,
      topY + 0.12 - Math.abs(Math.sin(angle * 0.5)) * 0.25,
      Math.cos(angle) * frondL * 0.48
    );
    frond.rotation.y = -angle;
    frond.rotation.z = 0.45 + rng() * 0.2; // droop
    g.add(frond);
  }
  // 코코넛 1-2개
  const cocoCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < cocoCount; i++) {
    const ca = rng() * Math.PI * 2;
    const coco = mesh(new THREE.SphereGeometry(0.14, 6, 5), toon(0x4a3010));
    coco.position.set(topX + Math.sin(ca) * 0.22, topY - 0.1, Math.cos(ca) * 0.22);
    g.add(coco);
  }
  return g;
}

// ── buildParasol ──────────────────────────────────────────────────────────────
/** 비치 파라솔: 기둥 + 줄무늬 캐노피, ~2.6u 높이 */
export function buildParasol(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const poleH = 2.4;
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.045, poleH, 7), SWATCH.wood);
  pole.position.y = poleH / 2;
  g.add(pole);
  // 캐노피: 메인 콘 + 컬러 스트라이프 링
  const canopyR = 1.3, canopyH = 0.45;
  const canopyY = poleH - 0.1;
  const mainColor = pick(SWATCH.awning, rng);
  const main = mesh(new THREE.ConeGeometry(canopyR, canopyH, 14), mainColor);
  main.position.y = canopyY + canopyH / 2;
  g.add(main);
  // 두 번째 색의 얇은 링들 (stripes)
  const stripe1 = SWATCH.awning[(SWATCH.awning.indexOf(mainColor) + 1) % SWATCH.awning.length];
  const stripe2 = SWATCH.awning[(SWATCH.awning.indexOf(mainColor) + 2) % SWATCH.awning.length];
  [0.35, 0.65].forEach((frac, idx) => {
    const r = canopyR * frac;
    const ring = mesh(new THREE.CylinderGeometry(r + 0.04, r, 0.07, 14), idx === 0 ? stripe1 : stripe2);
    ring.position.y = canopyY + canopyH * (1 - frac) + 0.035;
    g.add(ring);
  });
  // 기둥 베이스
  const base = mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.07, 7), SWATCH.wood);
  base.position.y = 0.035;
  g.add(base);
  return g;
}

// ── buildDeckChair ────────────────────────────────────────────────────────────
/** 비치 선베드: 기울어진 등받이 + 좌판 + 짧은 다리, ~0.7u 높이 ~1.3u 길이 */
export function buildDeckChair(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const fabricColors = [toon(0xe8d6a8), toon(0x4aadcf), toon(0xe05050), toon(0xf4c542)];
  const fabric = fabricColors[Math.floor(rng() * fabricColors.length)];
  const legH = 0.18, legT = 0.06;
  // 4개 다리
  [[-0.5, 0.22], [-0.5, -0.22], [0.28, 0.22], [0.28, -0.22]].forEach(([lx, lz]) => {
    const leg = mesh(new THREE.BoxGeometry(legT, legH, legT), SWATCH.wood);
    leg.position.set(lx, legH / 2, lz);
    g.add(leg);
  });
  // 좌판
  const seat = meshFlat(new THREE.BoxGeometry(0.9, 0.06, 0.52), fabric);
  seat.position.set(-0.12, legH + 0.03, 0);
  g.add(seat);
  // 기울어진 등받이
  const backL = 0.55;
  const back = mesh(new THREE.BoxGeometry(backL, 0.06, 0.52), fabric);
  back.rotation.x = -0.62; // 약 35도 기울기
  back.position.set(-0.12 + 0.9 * 0.5 - backL * Math.cos(-0.62) * 0.5 + 0.02, legH + 0.03 + backL * Math.sin(0.62) * 0.5, 0);
  g.add(back);
  // 프레임 세로대 (양 옆)
  [-0.22, 0.22].forEach(fz => {
    const frame = mesh(new THREE.BoxGeometry(0.88, 0.05, legT), SWATCH.wood);
    frame.position.set(-0.12, legH + 0.065, fz);
    g.add(frame);
  });
  return g;
}

// ── buildRock ─────────────────────────────────────────────────────────────────
/** 바위: 1-3개 클러스터된 불규칙 이코사헤드론, ~0.8-1.4u */
export function buildRock(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const grayColors = [toon(0x8a8f92), toon(0x6f7478), toon(0x9a9fa2)];
  const count = 1 + Math.floor(rng() * 3);
  const mainR = 0.45 + rng() * 0.3;
  // 메인 바위
  const main = mesh(new THREE.IcosahedronGeometry(mainR, 0), pick(grayColors, rng));
  main.scale.set(1.0 + rng() * 0.3, 0.65 + rng() * 0.3, 0.85 + rng() * 0.3);
  main.position.y = mainR * 0.55;
  g.add(main);
  // 추가 바위 (0-2개)
  for (let i = 1; i < count; i++) {
    const r = mainR * (0.4 + rng() * 0.45);
    const rock = mesh(new THREE.IcosahedronGeometry(r, 0), pick(grayColors, rng));
    rock.scale.set(0.9 + rng() * 0.35, 0.6 + rng() * 0.3, 0.8 + rng() * 0.4);
    rock.position.set(
      (rng() - 0.5) * mainR * 1.3,
      r * 0.5,
      (rng() - 0.5) * mainR * 1.1
    );
    g.add(rock);
  }
  return g;
}

// ── buildLogBench ─────────────────────────────────────────────────────────────
/** 통나무 벤치: X축 방향 원통 로그 + 2개 짧은 받침, ~0.5u 높이 */
export function buildLogBench(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const logR = 0.14, logL = 1.6;
  const supportH = 0.32;
  // 받침대 2개
  [-0.55, 0.55].forEach(sx => {
    const support = mesh(new THREE.CylinderGeometry(logR * 0.85, logR * 0.9, supportH, 6), SWATCH.trunk);
    support.position.set(sx, supportH / 2, 0);
    g.add(support);
  });
  // 누운 로그
  const log = mesh(new THREE.CylinderGeometry(logR, logR * 1.05, logL, 8), SWATCH.trunk);
  log.rotation.z = Math.PI / 2; // X축으로 눕힘
  log.position.y = supportH + logR;
  g.add(log);
  // 로그 앤드 캡 (양쪽 절단면 암시)
  [-logL / 2, logL / 2].forEach(ex => {
    const cap = mesh(new THREE.CylinderGeometry(logR * 0.98, logR * 0.98, 0.04, 8), toon(0x8b5e3c));
    cap.rotation.z = Math.PI / 2;
    cap.position.set(ex, supportH + logR, 0);
    g.add(cap);
  });
  return g;
}

// ── buildCampfire ─────────────────────────────────────────────────────────────
/** 모닥불: 돌 링 + 교차 통나무 + 불꽃 콘, ~0.7u 높이 */
export function buildCampfire(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  // 돌 링 (6-7개)
  const stoneCount = 6 + Math.floor(rng() * 2);
  for (let i = 0; i < stoneCount; i++) {
    const angle = (i / stoneCount) * Math.PI * 2;
    const sr = 0.22 + (rng() - 0.5) * 0.04;
    const stone = mesh(new THREE.IcosahedronGeometry(0.075 + rng() * 0.03, 0), toon(0x7a8080));
    stone.scale.set(1.1, 0.75, 0.9);
    stone.position.set(Math.sin(angle) * sr, 0.055, Math.cos(angle) * sr);
    g.add(stone);
  }
  // 교차 통나무 (3-4개)
  const logCount = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < logCount; i++) {
    const angle = (i / logCount) * Math.PI;
    const logL = 0.55 + rng() * 0.12;
    const log = mesh(new THREE.CylinderGeometry(0.045, 0.055, logL, 6), SWATCH.trunk);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = angle;
    log.position.y = 0.045 + i * 0.025;
    g.add(log);
  }
  // 불꽃 콘 (2-3개)
  const flameCount = 2 + Math.floor(rng() * 2);
  const flameColors = [toon(0xff8a3a, { emissive: 0xff8a3a, emissiveIntensity: 0.55 }), toon(0xffcf4a, { emissive: 0xffcf4a, emissiveIntensity: 0.55 })];
  for (let i = 0; i < flameCount; i++) {
    const fh = 0.22 + rng() * 0.18;
    const fr = 0.07 + rng() * 0.04;
    const flameGeo = new THREE.ConeGeometry(fr, fh, 6);
    const flameMat = i % 2 === 0 ? flameColors[0] : flameColors[1];
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.castShadow = true;
    flame.position.set((rng() - 0.5) * 0.1, 0.12 + fh / 2 + i * 0.04, (rng() - 0.5) * 0.08);
    g.add(flame);
  }
  return g;
}

// ── buildFlowerPatch ──────────────────────────────────────────────────────────
/** 꽃밭: 낮은 풀 마운드 + 6-10개 꽃, ~0.5u 높이 발판 ~1.6u */
export function buildFlowerPatch(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  // 풀 마운드
  const moundR = 0.78;
  const mound = meshFlat(new THREE.IcosahedronGeometry(moundR, 0), pick(SWATCH.leaf, rng));
  mound.scale.set(1.0, 0.28, 0.9);
  mound.position.y = moundR * 0.28 * 0.5;
  g.add(mound);
  const flowerColorList = [toon(0xe88aa8), toon(0xd9534f), toon(0xf2c14e), toon(0xf5f5f5), toon(0x9a7ad9)];
  const flowerCount = 6 + Math.floor(rng() * 5);
  for (let i = 0; i < flowerCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * moundR * 0.75;
    const fx = Math.sin(angle) * dist;
    const fz = Math.cos(angle) * dist;
    const stemH = 0.16 + rng() * 0.1;
    // 초록 줄기
    const stem = mesh(new THREE.CylinderGeometry(0.018, 0.02, stemH, 4), pick(SWATCH.leaf, rng));
    stem.position.set(fx, moundR * 0.28 * 0.5 + stemH / 2, fz);
    g.add(stem);
    // 꽃 머리 (작은 이코사헤드론)
    const col = pick(flowerColorList, rng);
    const headR = 0.055 + rng() * 0.03;
    const head = mesh(new THREE.IcosahedronGeometry(headR, 0), col);
    head.position.set(fx, moundR * 0.28 * 0.5 + stemH + headR, fz);
    g.add(head);
  }
  return g;
}

// ── buildLantern ──────────────────────────────────────────────────────────────
/** 석등: 돌 기단+기둥 + 발광 등 박스 + 피라미드 캡, ~1.4u 높이 */
export function buildLantern(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const stoneColor = SWATCH.concrete;
  // 기단 (넓은 베이스)
  const base = mesh(new THREE.BoxGeometry(0.55, 0.14, 0.55), stoneColor);
  base.position.y = 0.07;
  g.add(base);
  // 중간 포스트
  const postH = 0.55;
  const post = mesh(new THREE.CylinderGeometry(0.09, 0.12, postH, 6), stoneColor);
  post.position.y = 0.14 + postH / 2;
  g.add(post);
  // 등 받침 (넓힌 슬라브)
  const shelf = mesh(new THREE.BoxGeometry(0.48, 0.08, 0.48), stoneColor);
  shelf.position.y = 0.14 + postH + 0.04;
  g.add(shelf);
  // 발광 등 박스
  const LANTERN_Y = 0.14 + postH + 0.08;
  const lightBox = mesh(
    new THREE.BoxGeometry(0.38, 0.32, 0.38),
    toon(0xffe9b0, { emissive: 0xffe9b0, emissiveIntensity: 0.55 })
  );
  lightBox.position.y = LANTERN_Y + 0.16;
  g.add(lightBox);
  // 피라미드 캡
  const cap = mesh(new THREE.ConeGeometry(0.28, 0.22, 4), stoneColor);
  cap.position.y = LANTERN_Y + 0.32 + 0.11;
  g.add(cap);
  return g;
}

// ── buildMushroom ─────────────────────────────────────────────────────────────
/** 버섯: 1-3개 클러스터, 흰 줄기 + 돔 갓 + 흰 반점, ~0.4-0.7u 높이 */
export function buildMushroom(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const capColors = [toon(0xd9534f), toon(0x9a6a4a), toon(0xf5e6d0)];
  const count = 1 + Math.floor(rng() * 3);
  const positions = [[0, 0], [(rng() - 0.5) * 0.35, (rng() - 0.5) * 0.35], [(rng() - 0.5) * 0.3, (rng() - 0.5) * 0.3]];
  for (let i = 0; i < count; i++) {
    const [mx, mz] = positions[i];
    const scale = 0.55 + rng() * 0.55;
    const stemH = 0.22 * scale, stemR = 0.065 * scale;
    // 줄기
    const stem = mesh(new THREE.CylinderGeometry(stemR * 0.8, stemR, stemH, 7), toon(0xf5f5f5));
    stem.position.set(mx, stemH / 2, mz);
    g.add(stem);
    // 갓 (콘으로 돔 암시)
    const capR = 0.16 * scale, capH = 0.18 * scale;
    const capColor = capColors[Math.floor(rng() * capColors.length)];
    const cap = mesh(new THREE.ConeGeometry(capR, capH, 9), capColor);
    cap.position.set(mx, stemH + capH * 0.38, mz);
    g.add(cap);
    // 흰 반점 (빨간 갓에만)
    if (capColor === capColors[0]) {
      const spotCount = 2 + Math.floor(rng() * 3);
      for (let s = 0; s < spotCount; s++) {
        const sa = rng() * Math.PI * 2;
        const sd = capR * (0.3 + rng() * 0.35);
        const spot = mesh(new THREE.BoxGeometry(0.04 * scale, 0.025, 0.04 * scale), toon(0xf5f5f5));
        spot.position.set(mx + Math.sin(sa) * sd, stemH + capH * 0.55, mz + Math.cos(sa) * sd);
        g.add(spot);
      }
    }
  }
  return g;
}

// ── buildRowboat ──────────────────────────────────────────────────────────────
/** 나무 배: 타원형 선체 (~2.6u 길이), 낮은 측면, 2개 좌석, 선택적 노, y=0 안착 */
export function buildRowboat(opts = {}, rng = Math.random) {
  const g = new THREE.Group();
  const hullColor = SWATCH.wood;
  const accentColor = rng() > 0.5 ? SWATCH.teal : toon(0xd9534f);
  const hullL = 2.6, hullW = 0.9, hullH = 0.42, wallT = 0.1;
  const floorY = 0.05;
  // 선체 바닥
  const floor = meshFlat(new THREE.BoxGeometry(hullL * 0.78, 0.07, hullW * 0.7), hullColor);
  floor.position.y = floorY + 0.035;
  g.add(floor);
  // 측면 좌우
  [-1, 1].forEach(side => {
    const sideW = hullL * 0.88;
    const sideBoard = mesh(new THREE.BoxGeometry(sideW, hullH, wallT), hullColor);
    sideBoard.position.set(0, floorY + hullH / 2 + 0.03, side * (hullW / 2 - wallT / 2));
    g.add(sideBoard);
  });
  // 선미/선수 (앞뒤 막음판 - 테이퍼 암시)
  [-1, 1].forEach(side => {
    const bow = mesh(new THREE.BoxGeometry(wallT, hullH, hullW * 0.55), hullColor);
    bow.position.set(side * (hullL * 0.44 - wallT / 2), floorY + hullH / 2 + 0.03, 0);
    // 선수는 약간 기울임
    bow.rotation.z = side * 0.22;
    g.add(bow);
  });
  // 안쪽 페인트 스트라이프
  const stripe = mesh(new THREE.BoxGeometry(hullL * 0.9, 0.06, hullW - wallT * 2), accentColor);
  stripe.position.y = floorY + hullH + 0.04;
  g.add(stripe);
  // 가로 좌석 2개
  [-0.55, 0.55].forEach(sx => {
    const seat = mesh(new THREE.BoxGeometry(0.08, 0.07, hullW * 0.75), hullColor);
    seat.position.set(sx, floorY + hullH * 0.72, 0);
    g.add(seat);
  });
  // 선택적 노 (50% 확률)
  if (rng() > 0.5) {
    [-1, 1].forEach(side => {
      const oarShaft = mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.4, 5), hullColor);
      oarShaft.rotation.z = Math.PI / 2;
      oarShaft.position.set(0, floorY + hullH + 0.1, side * (hullW * 0.5 + 0.1));
      g.add(oarShaft);
      const blade = mesh(new THREE.BoxGeometry(0.52, 0.05, 0.16), hullColor);
      blade.position.set(side > 0 ? 0.68 : -0.68, floorY + hullH + 0.1, side * (hullW * 0.5 + 0.1));
      g.add(blade);
    });
  }
  return g;
}

// ─── 레지스트리 ───────────────────────────────────────────────────────────────

export const PROP_BUILDERS = {
  house:        buildHouse,
  alleyWall:    buildAlleyWall,
  pyeongsang:   buildPyeongsang,
  utilityPole:  buildUtilityPole,
  cornerShop:   buildCornerShop,
  stationery:   buildStationery,
  bathhouse:    buildBathhouse,
  tree:         buildTree,
  streetlamp:   buildStreetlamp,
  mailbox:      buildMailbox,
  bench:        buildBench,
  vending:      buildVendingMachine,
  hedge:        buildHedge,
  flowerpot:    buildFlowerpot,
  bicycle:      buildBicycle,
  fence:        buildFence,
  signboard:    buildSignboard,
  schoolFacade: buildSchoolFacade,
  playground:   buildPlayground,
  gravestone:   buildGravestone,
  jangdokdae:   buildJangdokdae,
  bush:         buildBush,
  palmTree:     buildPalmTree,
  parasol:      buildParasol,
  deckChair:    buildDeckChair,
  rock:         buildRock,
  logBench:     buildLogBench,
  campfire:     buildCampfire,
  flowerPatch:  buildFlowerPatch,
  lantern:      buildLantern,
  mushroom:     buildMushroom,
  rowboat:      buildRowboat,
};
