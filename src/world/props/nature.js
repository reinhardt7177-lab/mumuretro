// 자연 — 숲·언덕·꽃밭을 이루는 것들.
// 지면에 앉는 물건이라 비탈에서 뜨는지가 늘 관건이다.
//
// 모든 빌더는 THREE.Group을 반환한다. 로컬 원점(0,0)이 발판 중심, y=0이 지면.
// 플레이어 키 기준 1.5 유닛 — 이 척도를 어기면 마을이 통째로 어색해진다.
import * as THREE from 'three';
import { mesh, meshFlat, pick, toon } from './shared.js';
import { SWATCH } from '../../data/palette.js';

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
