// 건물과 시설 — 사람이 드나드는 것들.
// 학습 팻말이 걸리는 후보 집이 여기서 나온다(boot.js의 HOUSE_KEYS).
//
// 모든 빌더는 THREE.Group을 반환한다. 로컬 원점(0,0)이 발판 중심, y=0이 지면.
// 플레이어 키 기준 1.5 유닛 — 이 척도를 어기면 마을이 통째로 어색해진다.
import * as THREE from 'three';
import { mesh, meshFlat, pick, WIN_OPTS, toon } from './shared.js';
import { SWATCH } from '../../data/palette.js';
// 가게 앞에 서는 자판기·뽑기·박스더미는 골목 살림이라 street.js에 산다.
// 가게가 그걸 가져다 쓰는 것이지, 가게의 일부가 아니다(길가에 단독으로도 선다).
import { _vendingMachineGroup, _gachaMachine, _crateStack } from './street.js';

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
