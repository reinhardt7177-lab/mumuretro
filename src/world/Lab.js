// 지하 연구실 — 이야기가 시작하는 곳이자, 돌아올 곳.
//
// ★ 왜 별에서 시작하지 않는가. 예전 빌드는 아이를 아무 설명 없이 낯선 행성 위에
//   떨어뜨렸다. 집에서 시작하면 "여긴 어디고 나는 왜 여기 있나"가 저절로 풀리고,
//   무엇보다 **조작 셋(걷기·E·N)을 다치지 않는 곳에서 한 번씩** 써 보게 된다.
//
// ★ 이 장치는 **원래 그의 것**이다. 삼 년째 만들었는데 갈 자리를 몰라 한 번도
//   못 썼다. 소포가 준 것은 기계가 아니라 **목적지**다. 이 전제가 있어야
//   "밤을 샜다"도 "오늘"도 "저 장치"도 한 줄로 꿰인다. 없을 때는 소포를 받고
//   하룻밤 만에 짐벌 기계를 만든 사람이 됐다.
//
// ★ 마법진이 아니라 **장치**다. 이 게임에서 답은 언제나 재고·맞추고·가려서 나온다.
//   시작하는 방이 주문을 외우면 그 뒤의 사당 여섯이 전부 거짓말이 된다.
//
// ★ 포탈은 **양방향**이다. 별에도 같은 자리에 내림판이 남는다.
//
// ── 크기에 대하여 ───────────────────────────────────────────────────────────
// ★ 한 번 크게 갔다가 되돌렸다. 실사용: "오래 머물 공간은 아닙니다, 너무 넓게
//   가지 말아 주세요." 맞는 말이다. 31u짜리를 지어 놓고 베이스캠프라고 부른 건
//   **오래 머무는 공간을 만든 것**이다. 여긴 세 번쯤 지나가는 방이고, 지나가는
//   방은 빽빽해야 한다 — 넓으면 걷는 시간만 늘고 물건 사이가 비어 보인다.
//   23u로 줄이고 폭도 전부 줄였다. 구역 셋은 유지한다(그건 길이가 아니라 결이다).
//
// 방향 규칙은 사당과 같다 — 들어온 곳이 +Z, 걸어 들어가는 곳이 −Z.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { LAB } from '../data/lighting.js';
import { KINDS as FORAGE_KINDS, LEGEND } from '../data/forage.js';

// 좌표는 **한 군데에만** 적는다. 수첩에 3·5·8이라 그려 놓고 다이얼 정답이 다르면
// 그건 아이가 절대 못 푸는 문제가 된다. Notebook이 이걸 읽어 뒷장에 그린다.
export const PORTAL_CODE = [3, 5, 8];
if (PORTAL_CODE[2] !== PORTAL_CODE[0] + PORTAL_CODE[1]) {
  throw new Error('PORTAL_CODE: 셋째 자리는 앞의 두 자리의 합이어야 한다(수첩이 그렇게 적혀 있다)');
}

// ── 구역 셋 ─────────────────────────────────────────────────────────────────
// 낮음 → 넓음 → 높음. 짧게 지나가면서 결이 세 번 바뀐다.
const ZONES = [
  { id: 'live', z0: 2.5, z1: 10.5, hw: 4.8, h: 3.9, stone: false },
  { id: 'work', z0: -3.5, z1: 2.5, hw: 5.6, h: 4.7, stone: false },
  { id: 'send', z0: -12.5, z1: -3.5, hw: 6.2, h: 7.0, stone: true },
];
const T = 0.5;

// 천장에 다는 것이 내려올 수 있는 한계.
//   · RoomActor._inAny가 카메라를 h − 0.35까지만 올려 보낸다
//   · 그와 별개로 카메라는 1.25 + 6.5·sin(최대 pitch 0.7) = 5.45u 위로는 못 간다
// 둘 중 낮은 쪽이 진짜 한계다. 검사 H가 실제로 잰다.
const CAM_CLEAR = 0.35, CAM_MAX_Y = 5.45;
const camTop = (h) => Math.min(h - CAM_CLEAR, CAM_MAX_Y);

export const LAB_ENTRY_Z = 7.0;
const PARCEL = { x: 0.4, z: 0.0 };
const CONSOLE_Z = -5.8;
const DAIS_Z = -9.4;
const DIAL_X = [-1.5, 0, 1.5];
export const STAIR_X = 3.4, STAIR_Z = 6.8;
const SHELF_X = 5.25, SHELF_Z = -0.2, SHELF_L = 2.8;

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
    box(W, T, len, fl, 0, -T / 2, cz);
    box(W, T, len, fl, 0, s.h + T / 2, cz);
    for (const sd of [-1, 1]) box(T, s.h, len, wl, sd * (s.hw + T / 2), s.h / 2, cz);

    // 마루 널 — **길이 방향**으로. 가로로 깔면 줄이 방을 토막 낸다.
    if (!s.stone) {
      const n = Math.round(W / 1.05);
      for (let k = 1; k < n; k++) box(0.05, 0.03, len - 0.25, wood, -s.hw + (W * k) / n, 0.006, cz);
    } else {
      for (let k = 1; k < 6; k++) box(W - 0.4, 0.03, 0.07, stoneL, 0, 0.006, s.z0 + (len * k) / 6);
      for (let k = 1; k < 4; k++) box(0.07, 0.03, len - 0.4, stoneL, -s.hw + (W * k) / 4, 0.006, cz);
    }

    // 이음매 — 폭·높이 차이만큼 벽을 세우고 가운데를 비운다. 낙차가 생긴다.
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
        // 아치 — 이음매를 문틀로. 판이 아니라 **지나가는 것**으로 읽혀야 한다.
        const am = big.stone ? stoneL : woodL;
        box(ow * 2 + 0.7, 0.3, 0.68, am, 0, oh + 0.15, s.z0);
        for (const sd of [-1, 1]) box(0.38, oh, 0.68, am, sd * (ow + 0.17), oh / 2, s.z0);
      }
    } else {
      box(W, s.h, T, wl, 0, s.h / 2, s.z0 - T / 2);
    }
    if (i === 0) box(W, s.h, T, wl, 0, s.h / 2, s.z1 + T / 2);
  }

  // 천장 들보 — 나무 구역에만
  for (const s of ZONES) {
    if (s.stone) continue;
    const cnt = Math.max(2, Math.round((s.z1 - s.z0) / 2.9));
    for (let k = 1; k < cnt; k++) {
      box(s.hw * 2, 0.22, 0.26, woodD, 0, s.h - 0.12, s.z0 + ((s.z1 - s.z0) * k) / cnt);
    }
  }
  // 전송실은 들보가 아니라 필라스터와 갈비다
  for (let k = 1; k < 4; k++) {
    const z = -12.5 + (9 * k) / 4;
    for (const sd of [-1, 1]) box(0.3, 7.0, 0.3, stoneL, sd * 5.95, 3.5, z);
    box(12.4, 0.28, 0.3, stoneL, 0, 6.86, z);
  }

  // ── 생활 구역 ────────────────────────────────────────────────────────────
  // 침상 — 긴 면이 벽에 붙는다. 벽 가구는 전부 그렇다.
  box(1.8, 0.42, 2.8, wood, -3.3, 0.21, 8.4);
  box(1.6, 0.24, 2.6, basic(0x5d6b74), -3.3, 0.54, 8.4);
  box(1.4, 0.17, 0.58, paper, -3.3, 0.66, 9.5);                // 베개
  box(1.6, 0.06, 1.4, toon(0x7a5b4a), -3.3, 0.67, 7.7);        // 걷어찬 이불
  box(0.1, 1.0, 0.1, woodD, -4.15, 0.5, 9.75);
  box(0.1, 1.0, 0.1, woodD, -2.45, 0.5, 9.75);
  box(1.8, 0.11, 0.1, woodD, -3.3, 0.95, 9.75);                // 머리판
  box(2.6, 0.02, 1.9, toon(0x6a4b46), -1.4, 0.03, 6.4);        // 러그
  box(1.9, 0.02, 1.3, toon(0x87604f), -1.4, 0.04, 6.4);
  // 벽시계 — "또 밤을 새웠네"를 말이 아니라 물건으로 말한다
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 12), woodD);
  clock.rotation.x = Math.PI / 2; clock.position.set(-4.7, 2.5, 6.0); scene.add(clock);
  const cf = new THREE.Mesh(new THREE.CircleGeometry(0.27, 12), basic(0xe8dcc0));
  cf.rotation.y = Math.PI / 2; cf.position.set(-4.63, 2.5, 6.0); scene.add(cf);
  box(0.02, 0.2, 0.03, basic(0x33383c), -4.6, 2.57, 6.0);      // 짧은바늘 — 네 시 반쯤
  box(0.02, 0.03, 0.24, basic(0x33383c), -4.6, 2.5, 5.88);

  // ── 위로 난 계단 ─────────────────────────────────────────────────────────
  // 이 방이 **지하실**이라는 전제를 말 없이 보여 준다. 문틈으로 새는 낮빛은
  // 이 집에서 유일한 차가운 흰빛이다. 올라갈 수는 없다 — 갈 곳은 위가 아니다.
  const RISE = 0.22, RUN = 0.32, N_STEP = 12, SW = 2.0;
  for (let k = 0; k < N_STEP; k++) {
    box(SW, RISE, RUN + 0.02, wood, STAIR_X, RISE / 2 + k * RISE, 4.6 + k * RUN);
    box(SW, k * RISE + RISE, 0.06, woodD, STAIR_X, (k * RISE + RISE) / 2, 4.6 + k * RUN - RUN / 2);
  }
  const LAND_Y = N_STEP * RISE;
  box(SW, 0.2, 2.0, wood, STAIR_X, LAND_Y - 0.1, 9.3);
  for (let k = 0; k <= N_STEP; k += 4) {
    box(0.1, 0.9, 0.1, woodD, STAIR_X - SW / 2 + 0.07, k * RISE + 0.45, 4.6 + k * RUN);
  }
  const rail = box(0.09, 0.09, N_STEP * RUN + 0.9, woodD, STAIR_X - SW / 2 + 0.07,
    LAND_Y * 0.5 + 0.9, 4.6 + (N_STEP * RUN) / 2);
  rail.rotation.x = -Math.atan2(LAND_Y, N_STEP * RUN);
  box(1.4, 2.1, 0.14, woodD, STAIR_X, LAND_Y + 1.05, 10.36);   // 위층 문 — 닫혀 있다
  box(1.24, 0.05, 0.06, basic(0xfff4dc, 0.9), STAIR_X, LAND_Y + 0.03, 10.28);
  const day = new THREE.PointLight(0xfff0d6, 3.2 * LAB.lamp, 7, 2.0);
  day.position.set(STAIR_X, LAND_Y + 0.4, 9.9); scene.add(day);

  // ── 작업 구역 ────────────────────────────────────────────────────────────
  // 책상 — 왼쪽 벽. **긴 면이 벽에 붙는다**(Z 방향으로 길다).
  const desk = new THREE.Group(); desk.position.set(-5.0, 0, -0.4); scene.add(desk);
  box(1.0, 0.15, 2.6, wood, 0, 1.0, 0, desk);
  for (const dd of [[-0.35, -1.1], [0.35, -1.1], [-0.35, 1.1], [0.35, 1.1]])
    box(0.12, 1.0, 0.12, woodD, dd[0], 0.5, dd[1], desk);
  for (let k = 0; k < 5; k++)
    box(0.46, 0.02, 0.62, paper, -0.08 + (k % 2) * 0.26, 1.09 + k * 0.02, -0.95 + k * 0.48, desk);
  box(0.13, 0.44, 0.13, iron, 0.28, 1.29, -1.0, desk);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.26, 8), brass);
  shade.position.set(0.28, 1.58, -1.0); shade.rotation.x = Math.PI; desk.add(shade);
  // 마시다 만 컵 — 밤을 샌 사람의 책상
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.16, 8), basic(0xdcd3c0));
  cup.position.set(-0.2, 1.15, 0.95); desk.add(cup);
  const deskLamp = new THREE.PointLight(0xffd9a0, 6.5 * LAB.lamp, 8, 1.8);
  deskLamp.position.set(-4.4, 1.56, -0.6); scene.add(deskLamp);
  // 구겨 버린 종이 — 삼 년치 실패. 말보다 이게 빠르다.
  for (const [cx, cz] of [[-3.9, 0.9], [-4.3, -1.5], [-3.4, -1.9]]) {
    const w = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), paper);
    w.position.set(cx, 0.14, cz); w.rotation.set(0.6, 1.1, 0.3); scene.add(w);
  }
  // 벽에 붙인 장치 도면 — 저 기계가 그의 것이라는 증거
  for (const pz of [-1.6, 0.9]) {
    box(0.04, 0.98, 1.4, woodD, -5.56, 2.4, pz);
    box(0.03, 0.86, 1.28, paper, -5.53, 2.4, pz);
    box(0.02, 0.5, 0.5, basic(0x2f5490), -5.51, 2.4, pz);      // 도면의 파란 잉크
  }

  // 표본 선반 — 오른쪽 벽. 긴 면(2.8u)이 **벽을 따라** 놓이고 깊이는 0.6u뿐이다.
  // ★ 빈 병은 **비워 둔 자리**다. 들에서 하나 가져올 때마다 아래 칸이 하나씩 찬다 —
  //   수첩에 한 줄이 늘고 선반에 색이 하나 는다. 모은 것이 눈에 보여야 모으고 싶어진다.
  const jars = {};
  for (let s = 0; s < 2; s++) {
    const y = 1.4 + s * 0.88;
    box(0.6, 0.1, SHELF_L, wood, SHELF_X, y, SHELF_Z);
    for (const dz of [-1.1, 0, 1.1]) box(0.5, 0.15, 0.1, woodD, SHELF_X + 0.02, y - 0.12, SHELF_Z + dz);
    for (let k = 0; k < 5; k++) {
      const z2 = SHELF_Z - 1.12 + k * 0.56;
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 7),
        basic(0x8fb8bd, 0.55));
      jar.position.set(SHELF_X, y + 0.21, z2);
      scene.add(jar);
      box(0.02, 0.11, 0.15, paper, SHELF_X - 0.15, y + 0.2, z2);
      if (s === 0 || k < 3) {                              // 아래 칸 다섯 + 위 칸 셋(전설)
        const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 7),
          basic(0xffffff, 0.85));
        fill.position.set(SHELF_X, y + 0.15, z2);
        fill.visible = false; scene.add(fill);
        jars[s === 0 ? k : 'L' + k] = fill;
      }
    }
  }

  // 소포 작업대
  const table = new THREE.Group(); table.position.set(PARCEL.x, 0, PARCEL.z); scene.add(table);
  box(2.2, 0.14, 1.4, wood, 0, 0.84, 0, table);
  for (const dd of [[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.5], [0.9, 0.5]])
    box(0.13, 0.84, 0.13, woodD, dd[0], 0.42, dd[1], table);
  box(2.0, 0.06, 1.1, woodD, 0, 0.4, 0, table);
  const parcelG = new THREE.Group(); parcelG.position.set(0, 0.92, 0); table.add(parcelG);
  const boxMat = toon(0x9a7a54);
  const lid = box(1.1, 0.1, 0.8, boxMat, 0, 0.4, 0, parcelG);
  box(1.1, 0.36, 0.8, boxMat, 0, 0.18, 0, parcelG);
  for (const sd of [-1, 1]) box(0.06, 0.4, 0.82, basic(0x6d5a3c), sd * 0.29, 0.19, 0, parcelG);
  // 운송장 — 보낸 사람 칸이 비어 있다. 그게 이 상자의 전부다.
  const slip = box(0.56, 0.012, 0.38, paper, 0.2, 0.375, 0.42, parcelG);
  slip.rotation.x = -0.12;
  box(0.4, 0.014, 0.05, basic(0x8d99a0), 0.2, 0.383, 0.32, parcelG);   // 받는 사람 — 채워져 있다
  box(0.4, 0.014, 0.05, basic(0xc9c3b4), 0.2, 0.383, 0.5, parcelG);    // 보낸 사람 — 비었다
  const noteG = new THREE.Group(); noteG.position.set(0, 0.94, 0.05); noteG.visible = false;
  table.add(noteG);
  box(0.6, 0.1, 0.8, toon(0x7a6a4a), 0, 0.05, 0, noteG);
  box(0.56, 0.02, 0.76, paper, 0, 0.105, 0, noteG);
  box(0.1, 0.12, 0.82, basic(0x2f5490), -0.29, 0.05, 0, noteG);   // 파란 등 — 앞사람 색

  // ── 전송 장치 ────────────────────────────────────────────────────────────
  // ★ 예전엔 바닥에 분필로 그린 원 하나였다. "마법진이 아니라 장치"라고 머리말에
  //   적어 놓고 정작 생긴 건 마법진이었다. 적어 둔 것은 보여야 적어 둔 것이다.
  const chalk = basic(LAB.chalk, 0.8), chalkDim = basic(LAB.chalk, 0.42);
  for (let k = -2; k <= 2; k++) {                              // 좌표 격자 — 측량자다
    box(0.045, 0.012, 6.6, k === 0 ? chalk : chalkDim, k * 1.5, 0.02, DAIS_Z);
    box(6.6, 0.012, 0.045, k === 0 ? chalk : chalkDim, 0, 0.02, DAIS_Z + k * 1.5);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.05, 3.16, 40), chalk);
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.021, DAIS_Z); scene.add(ring);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const major = k % 6 === 0;
    const tk = box(0.05, 0.012, major ? 0.6 : 0.26, major ? chalk : chalkDim,
      Math.sin(a) * 2.85, 0.021, DAIS_Z + Math.cos(a) * 2.85);
    tk.rotation.y = a;
  }
  const oct = (r, h, m, y) => {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.06, h, 8), m);
    me.position.set(0, y, DAIS_Z); me.rotation.y = Math.PI / 8;
    me.castShadow = true; me.receiveShadow = true; scene.add(me);
  };
  oct(2.5, 0.22, stone, 0.11);
  oct(1.9, 0.22, stoneL, 0.33);

  // 짐벌 — 축이 서로 다른 놋쇠 링 셋. 전원이 들어오면 각자 돈다.
  const gimbal = new THREE.Group(); gimbal.position.set(0, 1.95, DAIS_Z); scene.add(gimbal);
  const mkRing = (R, tube, rx, rz) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R, tube, 6, 24), brass));
    g.rotation.set(rx, 0, rz); gimbal.add(g);
    return g;
  };
  const g1 = mkRing(1.38, 0.07, Math.PI / 2, 0);
  const g2 = mkRing(1.09, 0.06, 0, 0);
  const g3 = mkRing(0.8, 0.05, 0, Math.PI / 2);
  const coreMat = basic(LAB.glowDim);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 0), coreMat);
  gimbal.add(core);
  box(0.24, 1.5, 0.24, brassD, 0, 1.2, DAIS_Z);                // 기둥
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = box(0.13, 1.05, 0.13, brassD,
      Math.sin(a) * 1.25, 0.95, DAIS_Z + Math.cos(a) * 1.25);
    leg.rotation.z = -Math.sin(a) * 0.3; leg.rotation.x = Math.cos(a) * 0.3;
  }
  // 도관 — 전기가 어디서 오는지 눈에 보인다
  const condLen = Math.abs(CONSOLE_Z - DAIS_Z) - 1.8;
  for (const sd of [-1, 1]) {
    box(0.24, 0.18, condLen, brassD, sd * 1.0, 0.09, (CONSOLE_Z + DAIS_Z) / 2);
    for (let k = 0; k < 2; k++) box(0.38, 0.14, 0.16, brass, sd * 1.0, 0.11, CONSOLE_Z - 1.1 - k * 1.1);
  }

  // 콘솔 — 다이얼 셋 + 바늘 계기 둘 + 레버
  const con = new THREE.Group(); con.position.set(0, 0, CONSOLE_Z); scene.add(con);
  box(4.2, 0.9, 0.95, iron, 0, 0.45, 0, con);
  box(4.4, 0.15, 1.15, brass, 0, 0.97, 0, con);
  box(4.2, 0.68, 0.2, iron, 0, 1.38, -0.4, con);
  for (const sd of [-1, 1]) {
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 12), brass);
    gauge.rotation.x = Math.PI / 2; gauge.position.set(sd * 1.75, 1.38, -0.28); con.add(gauge);
    const gf = new THREE.Mesh(new THREE.CircleGeometry(0.21, 12), basic(0xe8dcc0));
    gf.position.set(sd * 1.75, 1.38, -0.21); con.add(gf);
    const nd = box(0.03, 0.18, 0.02, basic(0xa33b2c), sd * 1.75, 1.45, -0.2, con);
    nd.rotation.z = sd * 0.6;
  }
  box(0.1, 0.46, 0.1, iron, 1.95, 1.25, 0.28, con).rotation.x = -0.5;
  box(0.15, 0.15, 0.15, basic(0xa33b2c), 1.95, 1.46, 0.11, con);

  const digits = [];
  for (let n = 0; n <= 9; n++) digits.push(digitTex(n));
  const dials = DIAL_X.map((dx, i) => {
    const g = new THREE.Group(); g.position.set(dx, 1.24, 0.28); con.add(g);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.32, 12), brass);
    body.rotation.x = Math.PI / 2; g.add(body);
    const faceMat = new THREE.MeshBasicMaterial({ map: digits[0] });
    faceMat.userData.outlineParameters = { visible: false };
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.48), faceMat);
    face.position.z = 0.17; g.add(face);
    const knob = box(0.09, 0.6, 0.09, iron, 0, 0, 0.2, g);
    return { i, x: dx, z: CONSOLE_Z + 0.48, g, faceMat, knob, value: 0 };
  });
  const paintDial = (d) => {
    d.faceMat.map = digits[d.value];
    d.faceMat.needsUpdate = true;
    d.knob.rotation.z = -(d.value / 10) * Math.PI * 2;
  };
  dials.forEach(paintDial);

  // 집광 깔때기 — 빛기둥이 천장으로 빨려 올라간다. 전송실 높이를 쓰는 것.
  const funMat = stoneL.clone(); funMat.side = THREE.DoubleSide;
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 2.2, 1.3, 10, 1, true), funMat);
  funnel.position.set(0, 6.3, DAIS_Z); scene.add(funnel);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const rb = box(0.11, 1.4, 0.11, brassD,
      Math.sin(a) * 1.45, 6.3, DAIS_Z + Math.cos(a) * 1.45);
    rb.rotation.z = -Math.sin(a) * 0.6; rb.rotation.x = Math.cos(a) * 0.6;
  }

  const beamMat = basic(LAB.glow, 0.0);
  beamMat.side = THREE.DoubleSide; beamMat.depthWrite = false;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 5.2, 14, 1, true), beamMat);
  beam.position.set(0, 3.1, DAIS_Z); beam.visible = false; scene.add(beam);
  const discMat = basic(LAB.glow, 0.0); discMat.depthWrite = false;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.8, 20), discMat);
  disc.rotation.x = -Math.PI / 2; disc.position.set(0, 0.47, DAIS_Z);
  disc.visible = false; scene.add(disc);
  const portalLight = new THREE.PointLight(LAB.glow, 0, 15, 1.6);
  portalLight.position.set(0, 2.0, DAIS_Z); scene.add(portalLight);

  // ── 조명 ─────────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(LAB.amb[0], LAB.amb[1], LAB.amb[2]));
  // ★ 갓의 **아래 끝**이 camTop보다 위여야 한다. 처음엔 여백을 0.05u만 뒀는데
  //   카메라가 정확히 camTop에 서므로(천장이 각도를 그만큼만 허락한다) 전구갓이
  //   0.02u 파묻혔다. 검사 H가 `send@0.75[0.4x0.1x0.4]`로 잡아냈다 —
  //   전송실에 선 카메라가 뒤로 물러나다 **작업실 갓등 안**에 들어간 것이다.
  //   경계에 딱 맞추면 언젠가 반드시 넘는다. 0.12u를 띄운다.
  const GAP = 0.12;
  const hang = (z, power, h) => {
    const top = camTop(h);
    const drop = Math.min(0.5, Math.max(0.14, h - top - GAP));
    const lip = h - drop;                       // 갓의 아래 끝
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.52, drop, 10), toon(0x2f3438));
    hood.position.set(0, lip + drop / 2, z); hood.rotation.x = Math.PI; scene.add(hood);
    const rod = lip - top - GAP;
    if (rod > 0.25) box(0.05, rod, 0.05, iron, 0, lip - rod / 2, z);
    box(0.4, 0.05, 0.4, basic(0xffe9c4), 0, lip + 0.04, z);
    const bulb = new THREE.PointLight(0xffe3b4, power * LAB.lamp, 15, 1.5);
    bulb.position.set(0, lip - 0.05, z); scene.add(bulb);
  };
  hang(7.6, 9, 3.9);
  hang(PARCEL.z, 14, 4.7);              // 소포 위가 가장 밝다 — 다음 할 일은 늘 가장 밝은 곳
  hang(CONSOLE_Z + 0.5, 12, 7.0);
  for (const sd of [-1, 1]) {
    for (const z of [-6.2, -10.6]) {
      box(0.3, 0.48, 0.3, brassD, sd * 5.6, 2.9, z);
      const wl2 = new THREE.PointLight(0xffd9a8, 4.6 * LAB.lamp, 10, 1.6);
      wl2.position.set(sd * 5.2, 3.1, z); scene.add(wl2);
    }
  }
  scene.fog = new THREE.FogExp2(LAB.bg, 0.018);

  // ── 걸을 수 있는 곳 · 부딪히는 것 ────────────────────────────────────────
  const rects = ZONES.map((s) => ({ id: s.id, kind: 'room',
    x0: -s.hw, x1: s.hw, z0: s.z0, z1: s.z1, h: s.h, open: true }));
  const obstacles = [
    { x: -3.3, z: 8.4, r: 1.8 },                     // 침상
    // 원 하나로 직사각형 계단은 못 막는다 — 아래쪽 옆구리가 비어 발이 파묻혔었다
    { x: STAIR_X, z: 5.2, r: 1.25 },
    { x: STAIR_X, z: 6.8, r: 1.25 },
    { x: STAIR_X, z: 8.4, r: 1.25 },
    { x: STAIR_X, z: 9.5, r: 1.3 },                  // 계단참
    { x: -5.0, z: -0.4, r: 1.6 },                    // 책상
    { x: SHELF_X, z: SHELF_Z, r: 1.5 },              // 표본 선반
    { x: PARCEL.x, z: PARCEL.z, r: 1.5 },            // 작업대
    // ★ 가로로 긴 콘솔(4.2u)을 원 하나로 막으면 밀려나는 거리가 **손 닿는 거리보다
    //   멀어져서** 다이얼을 영영 못 만진다(한 번 그렇게 만들어 놨었다). 셋으로 나눈다.
    { x: -1.5, z: CONSOLE_Z, r: 0.9 },
    { x: 0, z: CONSOLE_Z, r: 0.9 },
    { x: 1.5, z: CONSOLE_Z, r: 0.9 },
    { x: 0, z: DAIS_Z, r: 2.8 },                     // 팔각 단 — 위에는 못 올라간다
  ];

  // ── 상태 ─────────────────────────────────────────────────────────────────
  // sleep → note(수첩 얻음) → read(펴 봄) → ready(포탈 섬)
  const st = { stage: 'sleep', hasNote: false, read: false, open: false };
  let t = 0;

  const near = (pos, x, z, r) => Math.hypot(pos.x - x, pos.z - z) < r;
  // ★ 처음엔 find였다. 다이얼 간격이 1.5u인데 손 닿는 거리가 1.6u라 **겹치고**,
  //   겹치면 배열 앞엣것이 이긴다 — 2번 앞에 서서 E를 누르면 1번이 돌았다.
  //   닿기 검사(I)는 "닿았다"만 재므로 이걸 절대 못 잡는다. 가장 **가까운** 것을
  //   고르면 경계가 두 다이얼의 한가운데가 되어 눈으로 보이는 것과 일치한다.
  const nearDial = (pos) => {
    let best = null, bd = 1.6;
    for (const d of dials) {
      const l = Math.hypot(pos.x - d.x, pos.z - d.z);
      if (l < bd) { bd = l; best = d; }
    }
    return best;
  };
  const atParcel = (pos) => near(pos, PARCEL.x, PARCEL.z, 2.2);
  const atPortal = (pos) => near(pos, 0, DAIS_Z, 3.4);

  return {
    scene, rects, obstacles, dials, state: st, ENTRY_Z: LAB_ENTRY_Z,
    CIRCLE: { x: 0, z: DAIS_Z + 3.0 },
    // 걸어서 닿아야 하는 것 전부 — 검사 I가 이 목록을 걸어서 확인한다.
    // 하나라도 빠뜨리면 그건 검사받지 않는 상호작용이 된다.
    reachables: [
      { name: '소포', x: PARCEL.x, z: PARCEL.z, r: 2.2 },
      { name: '다이얼1', x: DIAL_X[0], z: CONSOLE_Z + 0.48, r: 1.6 },
      { name: '다이얼2', x: DIAL_X[1], z: CONSOLE_Z + 0.48, r: 1.6 },
      { name: '다이얼3', x: DIAL_X[2], z: CONSOLE_Z + 0.48, r: 1.6 },
      { name: '포탈', x: 0, z: DAIS_Z, r: 3.4 },
    ],

    update(dt) {
      t += dt;
      // 짐벌은 꺼져 있어도 아주 느리게 돈다. **살아 있는 기계**여야 만지고 싶어진다.
      const sp = st.open ? 1 : 0.12;
      g1.rotation.z += dt * 0.30 * sp;
      g2.rotation.y += dt * 0.44 * sp;
      g3.rotation.x -= dt * 0.37 * sp;
      if (st.open) {
        const p = 0.55 + Math.sin(t * 2.2) * 0.14;
        beamMat.opacity = p * 0.34; discMat.opacity = p * 0.5;
        portalLight.intensity = (8 + Math.sin(t * 2.2) * 3) * LAB.lamp;
        core.scale.setScalar(1 + Math.sin(t * 3.1) * 0.09);
      } else if (st.hasNote) {
        core.scale.setScalar(1 + Math.sin(t * 1.6) * 0.06);
      }
    },

    prompt(pos) {
      // ★ 계단처럼 생긴 것 앞에서 아무 말도 안 하면 그건 못 올라가는 게 아니라
      //   **고장 난 것**으로 읽힌다. 못 가게 하는 것 자체는 의도다. 의도라면 말해야 한다.
      if (near(pos, STAIR_X, STAIR_Z, 2.8)) return '🚪 위층으로 나가는 문 — 잠겨 있다';
      if (!st.hasNote) {
        if (atParcel(pos)) return 'E — 소포 열어 보기';
        // 콘솔에 먼저 가 본 아이에게 아무 말도 안 하면, 다이얼 셋 달린 커다란
        // 장치가 **아무 반응 없는 벽**이 된다. 그게 바로 "불친절"이다.
        if (nearDial(pos) || near(pos, 0, CONSOLE_Z, 3.4))
          return '삼 년째 붙들고 있는 장치. …아직 갈 자리를 모른다';
        return null;
      }
      if (st.open && atPortal(pos)) return 'E — 저 별로 내려가기';
      const d = nearDial(pos);
      // ★ 자리를 맞춘 뒤에는 다이얼을 잠근다. 안 잠그면 아이가 아무 숫자로
      //   돌려 놔도 포탈이 그대로 서 있어서, **저 세 숫자가 자리라는 말이
      //   거짓말이 된다.** 대신 어디로 가면 되는지 말해 준다.
      if (d) {
        if (st.open) return '자리는 맞췄다 — 단 앞으로 가면 된다';
        // ★ 수첩을 안 읽었으면 다이얼은 안 돈다(interact가 막는다). 그런데
        //   프롬프트는 "돌리기"라고 하고 있었다 — **누르면 아무 일도 안 일어나는
        //   약속**이다. 프롬프트가 거짓말을 하면 그 뒤로는 아무것도 안 믿는다.
        if (!st.read) return '📓 수첩부터 펴 보자';
        return `E — ${d.i + 1}번째 다이얼 돌리기 (지금 ${d.value})`;
      }
      // ★ 여기 "📓 N — 수첩을 펴 보자"를 **맨 위에** 걸어 놨었다. 그러면 방의
      //   95%(310칸 중 295칸)에서 같은 문구가 뜬다. 늘 떠 있는 안내는 안내가
      //   아니라 벽지이고, 아트 바이블 「상시 표시는 다섯뿐」과도 정면으로 부딪힌다.
      //   말해야 할 곳은 두 군데뿐이다 — 방금 연 소포 앞과, 맞춰야 할 콘솔 앞.
      if (!st.open && near(pos, 0, CONSOLE_Z, 3.4))
        return st.read ? '수첩 뒷장의 자리 세 개를 다이얼에 맞춘다'
          : '📓 수첩부터 펴 보자';
      if (!st.read && atParcel(pos)) return '📓 수첩을 펴 보자';
      return null;
    },

    nearStairs(pos) { return near(pos, STAIR_X, STAIR_Z, 2.8); },

    // 들에서 처음 가져온 것 — 선반 병 하나가 그 색으로 찬다.
    fillJar(kindId) {
      const i = FORAGE_KINDS.findIndex((k) => k.id === kindId);
      if (i >= 0 && jars[i]) {
        jars[i].visible = true;
        jars[i].material.color.set(FORAGE_KINDS[i].tint);
        return true;
      }
      // 전설 셋은 **위 칸**에 담긴다. 아래 칸이 다 차야 위 칸이 차기 시작하는 게
      // 눈에 보이는 순서고, 그게 곧 "여기까지 왔다"는 표시다.
      const j = LEGEND.findIndex((k) => k.id === kindId);
      if (j >= 0 && jars['L' + j]) {
        jars['L' + j].visible = true;
        jars['L' + j].material.color.set(LEGEND[j].tint);
        return true;
      }
      return false;
    },

    // E가 **무엇을** 잡는가. 상태는 보지 않고 자리만 본다(순서는 interact와 같다).
    // 검사 I가 "닿았다"가 아니라 **"그것에 닿았다"**를 재기 위한 것이다 —
    // 겹쳐서 엉뚱한 게 잡히는 건 닿기 검사로는 절대 안 걸린다.
    pickAt(pos) {
      if (atParcel(pos)) return '소포';
      if (atPortal(pos)) return '포탈';
      const d = nearDial(pos);
      return d ? `다이얼${d.i + 1}` : null;
    },
    markRead() { st.read = true; st.stage = 'read'; },

    // 무엇을 했는지 문자열로 돌려준다. boot이 그걸 보고 대사를 고른다 —
    // 대사를 여기서 부르면 이 파일이 대본까지 알아야 한다.
    interact(pos) {
      if (!st.hasNote && atParcel(pos)) {
        st.hasNote = true; st.stage = 'note';
        lid.position.set(0.7, 0.06, 0.34); lid.rotation.z = 0.5;
        noteG.visible = true;
        return 'parcel';
      }
      if (st.open && atPortal(pos)) return 'go';
      const d = nearDial(pos);
      if (d && st.read && !st.open) {
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
