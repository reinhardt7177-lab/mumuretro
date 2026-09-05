// 지하 연구실 — 이야기가 시작하는 곳이자, 돌아올 곳.
//
// ★ 왜 별에서 시작하지 않는가. 예전 빌드는 아이를 아무 설명 없이 낯선 행성 위에
//   떨어뜨렸다. 그러면 "여긴 어디고 나는 왜 여기 있나"를 아무도 말해 주지 않는다.
//   집에서 시작하면 그 셋이 저절로 풀린다 — 소포가 오고, 수첩을 펴고, 자리를 맞춘다.
//   그리고 **조작 셋(걷기·E·N)을 다치지 않는 곳에서 한 번씩** 써 보게 된다.
//
// ★ 마법진이 아니라 **장치**다. 이 게임에서 답은 언제나 재고·맞추고·가려서 나온다.
//   시작하는 방이 주문을 외우면 그 뒤의 사당 여섯이 전부 거짓말이 된다.
//
// ★ 포탈은 **양방향**이다. 한 번 열면 계속 서 있고, 별에도 같은 자리에 내림판이 남는다.
//   그래야 이 방이 오프닝이 아니라 **베이스캠프**가 된다(모닥불·표본은 여기로 온다).
//
// ── 다시 지은 이유 ──────────────────────────────────────────────────────────
// 실사용에서 들은 말 셋. 전부 맞았다.
//   "집의 구조가 흠"      15×26 신발상자 하나였다. 가구가 전부 가운데 선 위에
//                         놓여서 걸어도 장면이 안 바뀌고, 복도에 물건을 늘어놓은
//                         꼴이었다. → **구역 셋**으로 나눈다. 낮고 아늑한 생활,
//                         넓고 밝은 작업, 아치를 지나 천장이 두 배로 열리는 전송실.
//                         사당이 이미 쓰는 방식이고, 카메라도 낮은 천장에서 각도를
//                         낮추게 고쳐 놨으니 이제 높이를 굴릴 수 있다.
//   "컵의 긴 면이 벽으로"  선반을 긴 면이 벽에서 **튀어나오게** 달아 놨었다.
//                         벽 가구는 긴 면이 벽에 붙는다. 책상도 같이 돌렸다.
//   "전송진이 성의 없다"   바닥에 그린 원 하나였다. 마법진이 아니라 장치라면서
//                         정작 생긴 건 마법진이었다. → 팔각 석재 단, 축이 서로
//                         다른 **놋쇠 짐벌 링 셋**, 그 한가운데 별의 자리, 단에서
//                         콘솔로 이어지는 도관, 천장의 집광 깔때기.
//
// 방향 규칙은 사당과 같다 — 들어온 곳이 +Z, 걸어 들어가는 곳이 −Z.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { LAB } from '../data/lighting.js';

// 좌표는 **한 군데에만** 적는다. 수첩에 3·5·8이라 그려 놓고 다이얼 정답이 다르면
// 그건 아이가 절대 못 푸는 문제가 된다. Notebook이 이걸 읽어 뒷장에 그린다.
export const PORTAL_CODE = [3, 5, 8];
// 수첩은 셋째 자리를 번진 것으로 그리고 "앞의 두 자리를 더한 수"라고만 적는다.
// 숫자를 바꾸다 이 관계가 깨지면 **아이가 절대 못 푸는 문제**가 된다. 여기서 막는다.
if (PORTAL_CODE[2] !== PORTAL_CODE[0] + PORTAL_CODE[1]) {
  throw new Error('PORTAL_CODE: 셋째 자리는 앞의 두 자리의 합이어야 한다(수첩이 그렇게 적혀 있다)');
}

// ── 구역 셋 ─────────────────────────────────────────────────────────────────
// 낮음 → 넓음 → 높음. 걸어 들어가면서 공간이 열린다.
const ZONES = [
  { id: 'live', z0: 5, z1: 16, hw: 6.5, h: 4.2, stone: false },   // 생활 — 침상·계단
  { id: 'work', z0: -3, z1: 5, hw: 7.5, h: 5.2, stone: false },   // 작업 — 책상·표본·소포
  { id: 'send', z0: -15, z1: -3, hw: 8.0, h: 8.0, stone: true },  // 전송실 — 아치 너머
];
const T = 0.5;                                     // 벽 두께

// 천장에 다는 것이 내려올 수 있는 한계.
//   · RoomActor._inAny가 카메라를 h − 0.35까지만 올려 보낸다
//   · 그와 별개로 카메라는 시선표적(1.25) + 6.5·sin(최대 pitch 0.7) = 5.45u 위로는
//     애초에 못 올라간다
// 둘 중 낮은 쪽이 진짜 한계다. 천장이 높은 방에서는 **진짜로 매달 수 있다**는 뜻이고,
// 낮은 방에서는 천장에 붙여야 한다는 뜻이다. 검사 H가 이걸 실제로 잰다.
const CAM_CLEAR = 0.35, CAM_MAX_Y = 5.45;
const camTop = (h) => Math.min(h - CAM_CLEAR, CAM_MAX_Y);

export const LAB_ENTRY_Z = 9.5;                    // 침상 앞. 여기서 눈을 뜬다
const PARCEL = { x: 0, z: 1.6 };                   // 작업 구역 한가운데 — 첫 목표
const CONSOLE_Z = -6.0;                            // 전송실 앞쪽, 단을 마주 본다
const DAIS_Z = -10.6;                              // 팔각 단 · 짐벌
const DIAL_X = [-1.7, 0, 1.7];
export const STAIR_X = 5.4, STAIR_Z = 9.6;         // 위층 계단(올라갈 수는 없다)
const SHELF_X = 7.15, SHELF_Z = 0.9, SHELF_L = 3.4;

const digitTex = (n) => {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#241a10'; c.fillRect(0, 0, 128, 128);
  c.strokeStyle = '#c79a4e'; c.lineWidth = 6; c.strokeRect(8, 8, 112, 112);
  c.fillStyle = '#f0d79a';
  c.font = '700 84px Consolas, monospace';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(String(n), 64, 70);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

export function buildLab() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LAB.bg);

  const wood = toon(LAB.wood), woodD = toon(LAB.woodDark), woodL = toon(LAB.woodLite);
  const plaster = toon(LAB.plaster), iron = toon(LAB.iron);
  const brass = toon(LAB.brass), brassD = toon(LAB.brassDim);
  const paper = toon(LAB.paper);
  const stone = toon(LAB.stone), stoneD = toon(LAB.stoneDark), stoneL = toon(LAB.stoneLite);
  const basic = (c, o = 1) => {
    const m = new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o });
    m.userData.outlineParameters = { visible: false };
    return m;
  };
  const box = (w, h, d, m, x, y, z, parent = scene) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z);
    me.castShadow = true; me.receiveShadow = true;
    parent.add(me);
    return me;
  };

  // ── 껍데기 ───────────────────────────────────────────────────────────────
  for (let i = 0; i < ZONES.length; i++) {
    const s = ZONES[i];
    const len = s.z1 - s.z0, cz = (s.z0 + s.z1) / 2, W = s.hw * 2;
    const wl = s.stone ? stone : plaster;
    const fl = s.stone ? stoneD : woodD;
    box(W, T, len, fl, 0, -T / 2, cz);                          // 바닥
    box(W, T, len, fl, 0, s.h + T / 2, cz);                     // 천장
    for (const sd of [-1, 1]) box(T, s.h, len, wl, sd * (s.hw + T / 2), s.h / 2, cz);

    // 마루 널 — **길이 방향**으로 깐다. 가로로 깔면 줄이 방을 토막 낸다.
    if (!s.stone) {
      const n = Math.round(W / 1.15);
      for (let k = 1; k < n; k++) {
        box(0.055, 0.03, len - 0.3, wood, -s.hw + (W * k) / n, 0.006, cz);
      }
    } else {
      // 전송실은 판석이다 — 격자로 금이 간다
      for (let k = 1; k < 7; k++) box(W - 0.4, 0.03, 0.07, stoneL, 0, 0.006, s.z0 + (len * k) / 7);
      for (let k = 1; k < 5; k++) box(0.07, 0.03, len - 0.4, stoneL, -s.hw + (W * k) / 5, 0.006, cz);
    }

    // 이음매 — 폭·높이 차이만큼 벽을 세우고 가운데를 비운다. 이게 있어야
    // 좁고 낮은 데서 넓고 높은 데로 "나오는" 낙차가 생긴다.
    const nxt = ZONES[i + 1];
    if (nxt) {
      const ow = Math.min(s.hw, nxt.hw), oh = Math.min(s.h, nxt.h);
      const big = s.h > nxt.h ? s : nxt;
      const bw = Math.max(s.hw, nxt.hw);
      const bm = big.stone ? stone : plaster;
      for (const sd of [-1, 1]) {
        if (bw - ow > 0.01) box(bw - ow, big.h, T, bm, sd * (ow + (bw - ow) / 2), big.h / 2, s.z0);
      }
      if (big.h - oh > 0.01) {
        box(ow * 2, big.h - oh, T, bm, 0, oh + (big.h - oh) / 2, s.z0);
        // 아치 — 이음매를 문틀로 만든다. 판이 아니라 **지나가는 것**으로 읽혀야 한다
        const am = big.stone ? stoneL : woodL;
        box(ow * 2 + 0.8, 0.34, 0.72, am, 0, oh + 0.17, s.z0);
        for (const sd of [-1, 1]) box(0.42, oh, 0.72, am, sd * (ow + 0.19), oh / 2, s.z0);
      }
    } else {
      box(W, s.h, T, wl, 0, s.h / 2, s.z0 - T / 2);             // 막다른 끝
    }
    if (i === 0) box(W, s.h, T, wl, 0, s.h / 2, s.z1 + T / 2);  // 들어온 쪽 끝
  }

  // 천장 들보 — 나무 구역에만. 천장이 어디인지 알려 주는 유일한 것.
  for (const s of ZONES) {
    if (s.stone) continue;
    const cnt = Math.max(2, Math.round((s.z1 - s.z0) / 3.4));
    for (let k = 1; k < cnt; k++) {
      box(s.hw * 2, 0.24, 0.28, woodD, 0, s.h - 0.13, s.z0 + ((s.z1 - s.z0) * k) / cnt);
    }
  }
  // 전송실은 들보가 아니라 **필라스터와 갈비**다. 석조라는 것과 높다는 것을 같이 말한다.
  for (let k = 1; k < 5; k++) {
    const z = -15 + (12 * k) / 5;
    for (const sd of [-1, 1]) box(0.34, 8.0, 0.34, stoneL, sd * 7.7, 4.0, z);
    box(16, 0.3, 0.34, stoneL, 0, 7.84, z);
  }

  // ── 생활 구역 ────────────────────────────────────────────────────────────
  // 침상 — 긴 면이 벽에 붙는다. 벽에 붙는 가구는 전부 그렇다.
  box(1.9, 0.44, 3.2, wood, -5.3, 0.22, 12.4);
  box(1.7, 0.24, 3.0, basic(0x5d6b74), -5.3, 0.56, 12.4);
  box(1.5, 0.18, 0.62, paper, -5.3, 0.68, 13.6);               // 베개
  box(1.7, 0.06, 1.6, toon(0x7a5b4a), -5.3, 0.69, 11.6);       // 걷어찬 이불
  box(0.1, 1.1, 0.1, woodD, -6.2, 0.55, 13.9);
  box(0.1, 1.1, 0.1, woodD, -4.4, 0.55, 13.9);
  box(1.9, 0.12, 0.1, woodD, -5.3, 1.04, 13.9);                // 머리판
  // 러그 — 바닥에 구역을 그린다. 가구보다 싸게 "여긴 다른 데"를 만든다
  box(3.4, 0.02, 2.6, toon(0x6a4b46), -2.6, 0.03, 10.2);
  box(2.6, 0.02, 1.9, toon(0x87604f), -2.6, 0.04, 10.2);
  // 트렁크 — 짐 싸는 사람의 방
  box(1.5, 0.8, 0.9, woodD, -5.6, 0.4, 8.6);
  box(1.55, 0.16, 0.95, brassD, -5.6, 0.86, 8.6);

  // ── 위로 난 계단 ─────────────────────────────────────────────────────────
  // 이 방이 **지하실**이라는 전제를 말로 하지 않고 보여 준다. 문틈으로 새는 낮빛은
  // 이 집에서 유일한 차가운 흰빛이고, "또 밤을 새웠네"와 붙는다.
  // 올라갈 수는 없다 — 이 이야기가 가는 방향은 위가 아니라 저 별이다.
  const RISE = 0.22, RUN = 0.36, N_STEP = 12, SW = 2.4;
  for (let k = 0; k < N_STEP; k++) {
    box(SW, RISE, RUN + 0.02, wood, STAIR_X, RISE / 2 + k * RISE, 7.6 + k * RUN);
    box(SW, k * RISE + RISE, 0.06, woodD, STAIR_X, (k * RISE + RISE) / 2, 7.6 + k * RUN - RUN / 2);
  }
  const LAND_Y = N_STEP * RISE;                                 // 2.64
  box(SW, 0.2, 2.6, wood, STAIR_X, LAND_Y - 0.1, 13.2);
  for (let k = 0; k <= N_STEP; k += 4) {
    box(0.1, 0.95, 0.1, woodD, STAIR_X - SW / 2 + 0.08, k * RISE + 0.48, 7.6 + k * RUN);
  }
  const rail = box(0.1, 0.1, N_STEP * RUN + 1.0, woodD, STAIR_X - SW / 2 + 0.08,
    LAND_Y * 0.5 + 0.95, 7.6 + (N_STEP * RUN) / 2);
  rail.rotation.x = -Math.atan2(LAND_Y, N_STEP * RUN);
  box(1.5, 2.2, 0.14, woodD, STAIR_X, LAND_Y + 1.1, 15.86);     // 위층 문 — 닫혀 있다
  box(1.34, 0.05, 0.06, basic(0xfff4dc, 0.9), STAIR_X, LAND_Y + 0.03, 15.78);
  const day = new THREE.PointLight(0xfff0d6, 3.4 * LAB.lamp, 8, 2.0);
  day.position.set(STAIR_X, LAND_Y + 0.4, 15.3); scene.add(day);

  // ── 작업 구역 ────────────────────────────────────────────────────────────
  // 책상 — 왼쪽 벽. **긴 면이 벽에 붙는다**(Z 방향으로 길다).
  const desk = new THREE.Group(); desk.position.set(-6.8, 0, 1.4); scene.add(desk);
  box(1.1, 0.16, 3.0, wood, 0, 1.02, 0, desk);
  for (const dd of [[-0.4, -1.3], [0.4, -1.3], [-0.4, 1.3], [0.4, 1.3]])
    box(0.13, 1.02, 0.13, woodD, dd[0], 0.51, dd[1], desk);
  for (let k = 0; k < 5; k++)
    box(0.5, 0.02, 0.68, paper, -0.1 + (k % 2) * 0.3, 1.11 + k * 0.02, -1.1 + k * 0.55, desk);
  box(0.14, 0.46, 0.14, iron, 0.3, 1.33, -1.15, desk);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.28, 8), brass);
  shade.position.set(0.3, 1.64, -1.15); shade.rotation.x = Math.PI; desk.add(shade);
  const deskLamp = new THREE.PointLight(0xffd9a0, 7 * LAB.lamp, 9, 1.8);
  deskLamp.position.set(-6.0, 1.62, 0.25); scene.add(deskLamp);
  // 벽에 붙인 도면 — 아무것도 안 걸린 회벽은 벽이 아니라 배경이다
  for (const pz of [-0.8, 1.6]) {
    box(0.04, 1.05, 1.55, woodD, -7.46, 2.55, pz);
    box(0.03, 0.92, 1.42, paper, -7.43, 2.55, pz);
  }

  // 표본 선반 — 오른쪽 벽. ★ 여기가 지적받은 곳이다.
  //   긴 면(3.4u)이 **벽을 따라** 놓이고, 벽에서 나오는 깊이는 0.6u뿐이다.
  //   전에는 이게 반대라 선반이 벽에서 팔처럼 튀어나와 있었다.
  for (let s = 0; s < 2; s++) {
    const y = 1.45 + s * 0.92;
    box(0.6, 0.11, SHELF_L, wood, SHELF_X, y, SHELF_Z);
    for (const dz of [-1.4, 0, 1.4]) box(0.5, 0.16, 0.1, woodD, SHELF_X + 0.02, y - 0.13, SHELF_Z + dz);
    for (let k = 0; k < 5; k++) {                               // 표본 병 — 벽을 따라 한 줄
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.34, 7),
        basic(0x8fb8bd, 0.55));
      jar.position.set(SHELF_X, y + 0.23, SHELF_Z - 1.32 + k * 0.66);
      scene.add(jar);
      box(0.02, 0.12, 0.16, paper, SHELF_X - 0.15, y + 0.22, SHELF_Z - 1.32 + k * 0.66);
    }
  }

  // 소포 작업대 — 방 한가운데. 첫 목표는 찾기 쉬워야 한다.
  const table = new THREE.Group(); table.position.set(PARCEL.x, 0, PARCEL.z); scene.add(table);
  box(2.4, 0.15, 1.5, wood, 0, 0.86, 0, table);
  for (const dd of [[-1.0, -0.55], [1.0, -0.55], [-1.0, 0.55], [1.0, 0.55]])
    box(0.14, 0.86, 0.14, woodD, dd[0], 0.43, dd[1], table);
  box(2.2, 0.06, 1.2, woodD, 0, 0.42, 0, table);                // 아래 선반
  const parcelG = new THREE.Group(); parcelG.position.set(0, 0.94, 0); table.add(parcelG);
  const boxMat = toon(0x9a7a54);
  const lid = box(1.15, 0.1, 0.85, boxMat, 0, 0.42, 0, parcelG);
  box(1.15, 0.38, 0.85, boxMat, 0, 0.19, 0, parcelG);
  for (const sd of [-1, 1]) box(0.06, 0.42, 0.87, basic(0x6d5a3c), sd * 0.3, 0.2, 0, parcelG);
  box(0.5, 0.01, 0.34, paper, 0.22, 0.395, 0.44, parcelG).rotation.x = -0.15;
  const noteG = new THREE.Group(); noteG.position.set(0, 0.96, 0.05); noteG.visible = false;
  table.add(noteG);
  box(0.62, 0.11, 0.84, toon(0x7a6a4a), 0, 0.055, 0, noteG);
  box(0.58, 0.02, 0.8, paper, 0, 0.115, 0, noteG);
  box(0.1, 0.13, 0.86, basic(0x2f5490), -0.3, 0.055, 0, noteG);   // 파란 등 — 앞사람 색

  // ── 전송 장치 ────────────────────────────────────────────────────────────
  // ★ 예전엔 바닥에 분필로 그린 원 하나였다. "마법진이 아니라 장치"라고 머리말에
  //   적어 놓고 정작 생긴 건 마법진이었다. 적어 둔 것은 보여야 적어 둔 것이다.
  const chalk = basic(LAB.chalk, 0.8), chalkDim = basic(LAB.chalk, 0.42);

  // 좌표 격자 — 주문이 아니라 **측량자**다. 직선 격자 위에 원과 눈금이 얹힌다.
  for (let k = -3; k <= 3; k++) {
    box(0.045, 0.012, 9.6, k === 0 ? chalk : chalkDim, k * 1.6, 0.02, DAIS_Z);
    box(9.6, 0.012, 0.045, k === 0 ? chalk : chalkDim, 0, 0.02, DAIS_Z + k * 1.6);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.5, 4.62, 48), chalk);
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.021, DAIS_Z); scene.add(ring);
  for (let k = 0; k < 36; k++) {                                // 눈금 — 10도마다
    const a = (k / 36) * Math.PI * 2;
    const major = k % 9 === 0;
    const tk = box(0.05, 0.012, major ? 0.72 : 0.3, major ? chalk : chalkDim,
      Math.sin(a) * 4.2, 0.021, DAIS_Z + Math.cos(a) * 4.2);
    tk.rotation.y = a;
  }

  // 팔각 석재 단 2층
  const oct = (r, h, m, y) => {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.06, h, 8), m);
    me.position.set(0, y, DAIS_Z); me.rotation.y = Math.PI / 8;
    me.castShadow = true; me.receiveShadow = true; scene.add(me);
    return me;
  };
  oct(3.1, 0.24, stone, 0.12);
  oct(2.35, 0.24, stoneL, 0.36);

  // 짐벌 — 축이 서로 다른 놋쇠 링 셋. 혼천의처럼 생겼고, 전원이 들어오면 각자 돈다.
  const gimbal = new THREE.Group(); gimbal.position.set(0, 2.15, DAIS_Z); scene.add(gimbal);
  const mkRing = (R, tube, rx, rz) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R, tube, 6, 26), brass));
    g.rotation.set(rx, 0, rz); gimbal.add(g);
    return g;
  };
  const g1 = mkRing(1.62, 0.075, Math.PI / 2, 0);          // 수평
  const g2 = mkRing(1.28, 0.065, 0, 0);                    // 수직
  const g3 = mkRing(0.95, 0.055, 0, Math.PI / 2);          // 수직(직교)
  // 별의 자리 — 링 한가운데. 아직 꺼져 있다.
  const coreMat = basic(LAB.glowDim);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), coreMat);
  gimbal.add(core);
  // 기둥과 다리 — 링이 공중에 떠 있으면 장치가 아니라 마법이다
  box(0.26, 1.6, 0.26, brassD, 0, 1.35, DAIS_Z);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = box(0.14, 1.2, 0.14, brassD,
      Math.sin(a) * 1.5, 1.05, DAIS_Z + Math.cos(a) * 1.5);
    leg.rotation.z = -Math.sin(a) * 0.3; leg.rotation.x = Math.cos(a) * 0.3;
  }

  // 도관 — 콘솔에서 단까지. 전기가 어디서 오는지 눈으로 보인다.
  const condLen = Math.abs(CONSOLE_Z - DAIS_Z) - 2.0;
  for (const sd of [-1, 1]) {
    box(0.26, 0.2, condLen, brassD, sd * 1.15, 0.1, (CONSOLE_Z + DAIS_Z) / 2);
    for (let k = 0; k < 3; k++) box(0.42, 0.15, 0.17, brass, sd * 1.15, 0.12, CONSOLE_Z - 1.3 - k * 1.1);
  }

  // 콘솔 — 다이얼 셋 + 바늘 계기 둘 + 레버. 자리를 맞추는 곳이다.
  const con = new THREE.Group(); con.position.set(0, 0, CONSOLE_Z); scene.add(con);
  box(4.8, 0.95, 1.0, iron, 0, 0.48, 0, con);
  box(5.0, 0.16, 1.2, brass, 0, 1.02, 0, con);
  box(4.8, 0.72, 0.22, iron, 0, 1.46, -0.42, con);              // 계기판 등판
  for (const sd of [-1, 1]) {
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), brass);
    gauge.rotation.x = Math.PI / 2; gauge.position.set(sd * 2.0, 1.46, -0.3); con.add(gauge);
    const face2 = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), basic(0xe8dcc0));
    face2.position.set(sd * 2.0, 1.46, -0.23); con.add(face2);
    const needle = box(0.03, 0.2, 0.02, basic(0xa33b2c), sd * 2.0, 1.54, -0.22, con);
    needle.rotation.z = sd * 0.6;
  }
  box(0.1, 0.5, 0.1, iron, 2.3, 1.32, 0.3, con).rotation.x = -0.5;   // 레버
  box(0.16, 0.16, 0.16, basic(0xa33b2c), 2.3, 1.55, 0.12, con);

  const digits = [];
  for (let n = 0; n <= 9; n++) digits.push(digitTex(n));
  const dials = DIAL_X.map((dx, i) => {
    const g = new THREE.Group(); g.position.set(dx, 1.3, 0.3); con.add(g);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.34, 12), brass);
    body.rotation.x = Math.PI / 2; g.add(body);
    const faceMat = new THREE.MeshBasicMaterial({ map: digits[0] });
    faceMat.userData.outlineParameters = { visible: false };
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), faceMat);
    face.position.z = 0.18; g.add(face);
    const knob = box(0.1, 0.66, 0.1, iron, 0, 0, 0.22, g);
    return { i, x: dx, z: CONSOLE_Z + 0.5, g, faceMat, knob, value: 0 };
  });
  const paintDial = (d) => {
    d.faceMat.map = digits[d.value];
    d.faceMat.needsUpdate = true;
    d.knob.rotation.z = -(d.value / 10) * Math.PI * 2;
  };
  dials.forEach(paintDial);

  // 집광 깔때기 — 빛기둥이 천장으로 빨려 올라간다. 전송실 높이를 쓰는 것.
  const funMat = stoneL.clone();
  funMat.side = THREE.DoubleSide;
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 2.7, 1.5, 10, 1, true), funMat);
  funnel.position.set(0, 7.2, DAIS_Z); scene.add(funnel);
  for (let k = 0; k < 8; k++) {                                 // 깔때기 갈비
    const a = (k / 8) * Math.PI * 2;
    const rb = box(0.12, 1.62, 0.12, brassD,
      Math.sin(a) * 1.78, 7.2, DAIS_Z + Math.cos(a) * 1.78);
    rb.rotation.z = -Math.sin(a) * 0.62; rb.rotation.x = Math.cos(a) * 0.62;
  }

  // 빛기둥 — 켜지면 단에서 깔때기까지 선다
  const beamMat = basic(LAB.glow, 0.0);
  beamMat.side = THREE.DoubleSide; beamMat.depthWrite = false;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.95, 6.3, 16, 1, true), beamMat);
  beam.position.set(0, 3.65, DAIS_Z); beam.visible = false; scene.add(beam);
  const discMat = basic(LAB.glow, 0.0);
  discMat.depthWrite = false;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), discMat);
  disc.rotation.x = -Math.PI / 2; disc.position.set(0, 0.5, DAIS_Z);
  disc.visible = false; scene.add(disc);
  const portalLight = new THREE.PointLight(LAB.glow, 0, 18, 1.6);
  portalLight.position.set(0, 2.2, DAIS_Z); scene.add(portalLight);

  // ── 조명 ─────────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(LAB.amb[0], LAB.amb[1], LAB.amb[2]));
  // 갓등 — camTop 위에만 있으면 카메라와 안 만난다(검사 H). 천장이 높은 전송실에서는
  // 진짜로 매달리고, 낮은 생활 구역에서는 천장에 붙는다.
  const hang = (z, power, h) => {
    const top = camTop(h);
    const drop = Math.max(0.3, Math.min(0.6, h - top - 0.05));
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.58, drop, 10), toon(0x2f3438));
    hood.position.set(0, h - drop / 2 - 0.03, z); hood.rotation.x = Math.PI;
    scene.add(hood);
    const rod = h - drop - top;
    if (rod > 0.25) box(0.05, rod, 0.05, iron, 0, h - drop - rod / 2 - 0.03, z);
    box(0.44, 0.05, 0.44, basic(0xffe9c4), 0, h - drop - 0.06, z);
    const bulb = new THREE.PointLight(0xffe3b4, power * LAB.lamp, 17, 1.5);
    bulb.position.set(0, h - drop - 0.12, z); scene.add(bulb);
  };
  hang(12.0, 10, 4.2);                  // 침상 쪽 — 눈을 뜨는 자리
  hang(PARCEL.z, 16, 5.2);              // 소포 위가 가장 밝다. 다음 할 일은 늘 가장 밝은 곳
  hang(CONSOLE_Z + 0.6, 14, 8.0);       // 콘솔 — 여긴 천장이 높아 진짜로 매달린다
  // 전송실 벽등 — 볼트가 어두우면 높이가 안 읽힌다
  for (const sd of [-1, 1]) {
    for (const z of [-6.4, -11.6]) {
      box(0.32, 0.52, 0.32, brassD, sd * 7.2, 3.1, z);
      const wl2 = new THREE.PointLight(0xffd9a8, 5.5 * LAB.lamp, 12, 1.6);
      wl2.position.set(sd * 6.7, 3.3, z); scene.add(wl2);
    }
  }
  scene.fog = new THREE.FogExp2(LAB.bg, 0.016);

  // ── 걸을 수 있는 곳 · 부딪히는 것 ────────────────────────────────────────
  const rects = ZONES.map((s) => ({ id: s.id, kind: 'room',
    x0: -s.hw, x1: s.hw, z0: s.z0, z1: s.z1, h: s.h, open: true }));
  const obstacles = [
    { x: -5.3, z: 12.4, r: 2.0 },                    // 침상
    { x: -5.6, z: 8.6, r: 1.1 },                     // 트렁크
    // 원 하나로 직사각형 계단은 못 막는다. 전엔 아래쪽 옆구리가 비어서 첫 계단에
    // 발이 파묻혔다(실사용 스크린샷에서 확인).
    { x: STAIR_X, z: 8.2, r: 1.5 },
    { x: STAIR_X, z: 10.0, r: 1.5 },
    { x: STAIR_X, z: 11.8, r: 1.5 },
    { x: STAIR_X, z: 13.4, r: 1.6 },                 // 계단참
    { x: -6.8, z: 1.4, r: 1.8 },                     // 책상
    { x: SHELF_X, z: SHELF_Z, r: 1.9 },              // 표본 선반
    { x: PARCEL.x, z: PARCEL.z, r: 1.6 },            // 작업대
    // ★ 콘솔을 원 하나(r 2.7)로 막았더니 밀려나는 거리가 **손 닿는 거리보다
    //   멀어져서 다이얼을 영영 못 만졌다.** 오프닝이 통째로 못 깨는 상태였는데,
    //   검사가 다이얼 좌표로 순간이동해서 만지는 바람에 안 걸렸다 —
    //   걸어서 닿는지 재지 않으면 이런 건 절대 안 잡힌다(아래 검사 I).
    //   4.8u짜리 가로 물건은 원 하나로 못 막는다. 셋으로 나눈다.
    { x: -1.7, z: CONSOLE_Z, r: 0.95 },              // 콘솔 왼쪽
    { x: 0, z: CONSOLE_Z, r: 0.95 },                 // 콘솔 가운데
    { x: 1.7, z: CONSOLE_Z, r: 0.95 },               // 콘솔 오른쪽
    { x: 0, z: DAIS_Z, r: 3.4 },                     // 팔각 단 — 위에는 못 올라간다
  ];

  // ── 상태 ─────────────────────────────────────────────────────────────────
  const st = { stage: 'sleep', hasNote: false, open: false };
  let t = 0;

  const near = (pos, x, z, r) => Math.hypot(pos.x - x, pos.z - z) < r;
  const nearDial = (pos) => dials.find((d) => near(pos, d.x, d.z, 1.7));
  const atParcel = (pos) => near(pos, PARCEL.x, PARCEL.z, 2.4);
  const atPortal = (pos) => near(pos, 0, DAIS_Z, 4.4);

  return {
    scene, rects, obstacles, dials, state: st, ENTRY_Z: LAB_ENTRY_Z,
    // 걸어서 닿아야 하는 것 전부 — 검사 I가 이 목록을 걸어서 확인한다.
    // 하나라도 빠뜨리면 그건 검사받지 않는 상호작용이 된다.
    reachables: [
      { name: '소포', x: PARCEL.x, z: PARCEL.z, r: 2.4 },
      { name: '다이얼1', x: DIAL_X[0], z: CONSOLE_Z + 0.5, r: 1.7 },
      { name: '다이얼2', x: DIAL_X[1], z: CONSOLE_Z + 0.5, r: 1.7 },
      { name: '다이얼3', x: DIAL_X[2], z: CONSOLE_Z + 0.5, r: 1.7 },
      { name: '포탈', x: 0, z: DAIS_Z, r: 4.4 },
    ],
    // 단 위에는 못 올라가므로 **단 앞**이 포탈 자리다.
    CIRCLE: { x: 0, z: DAIS_Z + 3.9 },

    update(dt) {
      t += dt;
      // 짐벌은 늘 조금씩 돈다. 꺼져 있어도 **살아 있는 기계**여야 만지고 싶어진다.
      const sp = st.open ? 1 : 0.12;
      g1.rotation.z += dt * 0.30 * sp;
      g2.rotation.y += dt * 0.44 * sp;
      g3.rotation.x -= dt * 0.37 * sp;
      if (st.open) {
        const p = 0.55 + Math.sin(t * 2.2) * 0.14;
        beamMat.opacity = p * 0.34; discMat.opacity = p * 0.5;
        portalLight.intensity = (9 + Math.sin(t * 2.2) * 3) * LAB.lamp;
        core.scale.setScalar(1 + Math.sin(t * 3.1) * 0.09);
      } else if (st.hasNote) {
        // 아직 못 맞췄으면 핵이 희미하게 숨 쉰다 — 다음 할 일은 늘 가장 밝은 곳
        core.scale.setScalar(1 + Math.sin(t * 1.6) * 0.06);
      }
    },

    prompt(pos) {
      // ★ 계단처럼 생긴 것 앞에서 아무 말도 안 하면, 그건 못 올라가는 게 아니라
      //   **고장 난 것**으로 읽힌다. 실사용에서 바로 물어보셨다: "일부러 그런건가요?"
      //   못 가게 하는 것 자체는 의도다. 의도라면 의도라고 말해야 한다.
      if (near(pos, STAIR_X, STAIR_Z, 3.2)) return '🚪 위층으로 나가는 문 — 잠겨 있다';
      if (!st.hasNote) {
        if (atParcel(pos)) return 'E — 소포 열어 보기';
        // 콘솔에 먼저 가 본 아이에게 아무 말도 안 하면, 놋쇠 다이얼 셋이 달린
        // 커다란 장치가 **아무 반응 없는 벽**이 된다. 그게 바로 "불친절"이다.
        if (nearDial(pos) || near(pos, 0, CONSOLE_Z, 3.9))
          return '놋쇠 다이얼이 셋. …맞출 자리를 아직 모른다';
        return null;
      }
      if (st.open && atPortal(pos)) return 'E — 저 별로 내려가기';
      const d = nearDial(pos);
      if (d) return `E — ${d.i + 1}번째 다이얼 돌리기 (지금 ${d.value})`;
      if (!st.open && near(pos, 0, CONSOLE_Z, 3.9))
        return '자리 세 개를 맞춰야 한다 — N으로 수첩을 펴 보자';
      return null;
    },

    // 계단에 다가섰나 — boot이 이걸 보고 혼잣말을 한 번 붙인다.
    nearStairs(pos) { return near(pos, STAIR_X, STAIR_Z, 3.2); },

    // 무엇을 했는지 문자열로 돌려준다. boot이 그걸 보고 대사를 고른다 —
    // 대사를 여기서 부르면 이 파일이 대본까지 알아야 한다.
    interact(pos) {
      if (!st.hasNote && atParcel(pos)) {
        st.hasNote = true; st.stage = 'note';
        lid.position.set(0.74, 0.06, 0.36); lid.rotation.z = 0.52;
        noteG.visible = true;
        return 'parcel';
      }
      if (st.open && atPortal(pos)) return 'go';
      const d = nearDial(pos);
      if (d && st.hasNote) {
        d.value = (d.value + 1) % 10;
        paintDial(d);
        if (!st.open && dials.every((x, i) => x.value === PORTAL_CODE[i])) {
          st.open = true; st.stage = 'ready';
          beam.visible = true; disc.visible = true;
          coreMat.color.setHex(LAB.glow);
          return 'solved';
        }
        return 'dial';
      }
      return null;
    },
  };
}
