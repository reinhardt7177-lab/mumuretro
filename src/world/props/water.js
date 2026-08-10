// 물가와 해변 — 수면 위에 뜨거나 모래에 박히는 것들.
// onWater 프롭은 흘수(draft)만큼 잠긴다(boot.js loadHealingEnv).
//
// 모든 빌더는 THREE.Group을 반환한다. 로컬 원점(0,0)이 발판 중심, y=0이 지면.
// 플레이어 키 기준 1.5 유닛 — 이 척도를 어기면 마을이 통째로 어색해진다.
import * as THREE from 'three';
import { mesh, meshFlat, pick, toon } from './shared.js';
import { SWATCH } from '../../data/palette.js';

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
