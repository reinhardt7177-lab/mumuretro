// 골목 살림 — 건물 사이를 채우는 것들.
// 대부분 작고 수가 많아서, 하나가 커지면 마을 전체가 답답해진다.
//
// 모든 빌더는 THREE.Group을 반환한다. 로컬 원점(0,0)이 발판 중심, y=0이 지면.
// 플레이어 키 기준 1.5 유닛 — 이 척도를 어기면 마을이 통째로 어색해진다.
import * as THREE from 'three';
import { mesh, meshFlat, pick, WIN_OPTS, toon } from './shared.js';
import { SWATCH } from '../../data/palette.js';

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

export function _vendingMachineGroup(rng) {
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

export function _gachaMachine(rng) {
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

export function _crateStack(parent, rng, x, z) {
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
