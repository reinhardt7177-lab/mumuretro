// 지하 연구실 — 이야기가 시작하는 곳이자, 돌아올 곳.
//
// ★ 왜 별에서 시작하지 않는가. 예전 빌드는 아이를 아무 설명 없이 낯선 행성 위에
//   떨어뜨렸다. 그러면 "여긴 어디고 나는 왜 여기 있나"를 아무도 말해 주지 않는다.
//   집에서 시작하면 그 셋이 저절로 풀린다 — 소포가 오고, 수첩을 펴고, 자리를 맞춘다.
//   그리고 **조작 셋(걷기·E·N)을 다치지 않는 곳에서 한 번씩 써 보게 된다.**
//
// ★ 마법진이 아니라 **장치**다. 분필 원에는 눈금이 새겨져 있고 놋쇠 다이얼이 셋 붙어 있다.
//   이 게임에서 답은 언제나 재고·맞추고·가려서 나온다. 시작하는 방이 주문을 외우면
//   그 뒤의 사당 여섯이 전부 거짓말이 된다.
//
// ★ 포탈은 **양방향**이다. 한 번 열면 계속 서 있고, 별에도 같은 자리에 내림판이 남는다.
//   그래야 이 방이 오프닝이 아니라 **베이스캠프**가 된다(모닥불·표본은 여기로 온다).
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

const HALF_W = 7, Z_FAR = -11, Z_NEAR = 11, CEIL = 3.6;
const T = 0.5;                                     // 벽 두께

export const LAB_ENTRY_Z = 8.6;                    // 침상 앞. 여기서 눈을 뜬다
const PARCEL = { x: 0, z: -1.4 };
const CONSOLE_Z = -6.6;                            // 다이얼 콘솔
const CIRCLE_Z = -9.0;                             // 분필 원 · 포탈
const DIAL_X = [-1.7, 0, 1.7];

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

  const wood = toon(LAB.wood), woodD = toon(LAB.woodDark);
  const plaster = toon(LAB.plaster), iron = toon(LAB.iron), brass = toon(LAB.brass);
  const paper = toon(LAB.paper);
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
  const len = Z_NEAR - Z_FAR, cz = (Z_NEAR + Z_FAR) / 2, W = HALF_W * 2;
  box(W, T, len, woodD, 0, -T / 2, cz);                       // 바닥(널)
  box(W, T, len, woodD, 0, CEIL + T / 2, cz);                 // 천장
  for (const sd of [-1, 1]) box(T, CEIL, len, plaster, sd * (HALF_W + T / 2), CEIL / 2, cz);
  box(W, CEIL, T, plaster, 0, CEIL / 2, Z_FAR - T / 2);
  box(W, CEIL, T, plaster, 0, CEIL / 2, Z_NEAR + T / 2);
  // 마루 널 — 통짜 판이면 넓이가 안 읽힌다(던전 바닥 눈금과 같은 이유)
  for (let k = 1; k < 11; k++) box(W - 0.4, 0.03, 0.06, wood, 0, 0.005, Z_FAR + (len * k) / 11);
  // 천장 들보 — 여기가 **지하**라는 걸 말하는 건 낮은 천장과 이 들보다
  for (let k = 0; k < 5; k++) box(W, 0.22, 0.26, woodD, 0, CEIL - 0.12, Z_FAR + 2.4 + k * 4.2);

  // ── 침상 — 여기서 눈을 뜬다 ──────────────────────────────────────────────
  box(2.0, 0.42, 3.0, wood, -4.6, 0.21, 8.8);
  box(1.8, 0.22, 2.8, basic(0x5d6b74), -4.6, 0.52, 8.8);
  box(1.5, 0.16, 0.6, paper, -4.6, 0.62, 7.7);                // 베개

  // ── 책상 — 밤을 샌 흔적 ──────────────────────────────────────────────────
  const desk = new THREE.Group(); desk.position.set(-4.4, 0, 2.6); scene.add(desk);
  box(3.2, 0.16, 1.6, wood, 0, 1.02, 0, desk);
  for (const dd of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]])
    box(0.14, 1.02, 0.14, woodD, dd[0], 0.51, dd[1], desk);
  for (let k = 0; k < 4; k++)                                  // 널린 종이
    box(0.7, 0.02, 0.5, paper, -0.9 + k * 0.55, 1.11 + k * 0.02, -0.2 + (k % 2) * 0.4, desk);
  box(0.16, 0.5, 0.16, iron, 1.2, 1.35, 0.4, desk);            // 스탠드 기둥
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 8), brass);
  shade.position.set(1.2, 1.68, 0.4); shade.rotation.x = Math.PI; desk.add(shade);
  const deskLamp = new THREE.PointLight(0xffd9a0, 7 * LAB.lamp, 9, 1.8);
  deskLamp.position.set(-3.2, 1.7, 2.6); scene.add(deskLamp);

  // ── 선반 — 빈 표본 병들. 아직 아무것도 안 담겨 있다(채집이 올 자리) ──────
  for (let s = 0; s < 2; s++) {
    box(2.6, 0.12, 0.7, wood, 5.4, 1.5 + s * 0.95, 2.6);
    for (let k = 0; k < 4; k++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.34, 7),
        basic(0x8fb8bd, 0.55));
      jar.position.set(4.4 + k * 0.62, 1.73 + s * 0.95, 2.6);
      scene.add(jar);
    }
  }

  // ── 소포 — 이야기가 들어온 문 ────────────────────────────────────────────
  const table = new THREE.Group(); table.position.set(PARCEL.x, 0, PARCEL.z); scene.add(table);
  box(2.2, 0.14, 1.4, wood, 0, 0.86, 0, table);
  for (const dd of [[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.5], [0.9, 0.5]])
    box(0.13, 0.86, 0.13, woodD, dd[0], 0.43, dd[1], table);
  const parcelG = new THREE.Group(); parcelG.position.set(0, 0.93, 0); table.add(parcelG);
  const boxMat = toon(0x9a7a54);
  const lid = box(1.15, 0.1, 0.85, boxMat, 0, 0.42, 0, parcelG);
  box(1.15, 0.38, 0.85, boxMat, 0, 0.19, 0, parcelG);
  for (const sd of [-1, 1]) box(0.06, 0.42, 0.87, basic(0x6d5a3c), sd * 0.3, 0.2, 0, parcelG);
  // 보낸 사람 칸 — 비어 있다. 그게 이 상자의 전부다
  box(0.5, 0.01, 0.34, paper, 0.22, 0.395, 0.44, parcelG).rotation.x = -0.15;
  // 수첩 — 상자를 열면 여기 놓인다
  const noteG = new THREE.Group(); noteG.position.set(0, 0.95, 0.05); noteG.visible = false;
  table.add(noteG);
  box(0.62, 0.11, 0.84, toon(0x7a6a4a), 0, 0.055, 0, noteG);
  box(0.58, 0.02, 0.8, paper, 0, 0.115, 0, noteG);
  box(0.1, 0.13, 0.86, basic(0x2f5490), -0.3, 0.055, 0, noteG);   // 파란 등 — 앞사람 색

  // ── 좌표 장치 ────────────────────────────────────────────────────────────
  // 분필 원 — **눈금이 있다.** 주문이 아니라 자다.
  const chalk = basic(0xd8d2c0, 0.85);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.5, 2.62, 40), chalk);
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, CIRCLE_Z); scene.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(1.9, 1.96, 40), basic(0xd8d2c0, 0.5));
  ring2.rotation.x = -Math.PI / 2; ring2.position.set(0, 0.02, CIRCLE_Z); scene.add(ring2);
  for (let k = 0; k < 24; k++) {                               // 눈금
    const a = (k / 24) * Math.PI * 2;
    const tk = box(0.05, 0.01, k % 6 === 0 ? 0.5 : 0.26, chalk,
      Math.sin(a) * 2.3, 0.021, CIRCLE_Z + Math.cos(a) * 2.3);
    tk.rotation.y = a;
  }

  // 콘솔 — 놋쇠 다이얼 셋
  const con = new THREE.Group(); con.position.set(0, 0, CONSOLE_Z); scene.add(con);
  box(4.4, 0.9, 0.8, iron, 0, 0.45, 0, con);
  box(4.6, 0.14, 1.0, brass, 0, 0.97, 0, con);
  const digits = [];
  for (let n = 0; n <= 9; n++) digits.push(digitTex(n));
  const dials = DIAL_X.map((dx, i) => {
    const g = new THREE.Group(); g.position.set(dx, 1.28, 0.12); con.add(g);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), brass);
    body.rotation.x = Math.PI / 2; g.add(body);
    const faceMat = new THREE.MeshBasicMaterial({ map: digits[0] });
    faceMat.userData.outlineParameters = { visible: false };
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), faceMat);
    face.position.z = 0.16; g.add(face);
    // 손잡이 — 돌리는 물건으로 읽혀야 한다
    const knob = box(0.1, 0.62, 0.1, iron, 0, 0, 0.2, g);
    return { i, x: dx, z: CONSOLE_Z + 0.9, g, faceMat, knob, value: 0 };
  });
  const paintDial = (d) => {
    d.faceMat.map = digits[d.value];
    d.faceMat.needsUpdate = true;
    d.knob.rotation.z = -(d.value / 10) * Math.PI * 2;
  };
  dials.forEach(paintDial);

  // 포탈 — 처음엔 없다
  const portalG = new THREE.Group(); portalG.position.set(0, 0, CIRCLE_Z);
  portalG.visible = false; scene.add(portalG);
  const pMat = basic(LAB.glow, 0.7);
  pMat.side = THREE.DoubleSide;
  const discMat = basic(LAB.glow, 0.4);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.85, 32), discMat);
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; portalG.add(disc);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, CEIL, 24, 1, true), pMat);
  col.position.y = CEIL / 2; portalG.add(col);
  const portalLight = new THREE.PointLight(LAB.glow, 0, 14, 1.6);
  portalLight.position.set(0, 1.6, CIRCLE_Z); scene.add(portalLight);

  // ── 조명 ─────────────────────────────────────────────────────────────────
  // ★ 처음엔 전구 하나(z=2)로 방 전체를 밝히려 했다. 감쇠가 1.7이라 침상(z=8.6)에
  //   닿을 때쯤엔 세기가 1/25로 줄어 **주인공이 까만 실루엣**이었다. 지하실이
  //   어두운 건 분위기지만, 자기 캐릭터가 안 보이는 건 그냥 안 보이는 것이다.
  //   갓등을 셋으로 나눠 건다 — 22u짜리 방에 등 하나는 애초에 말이 안 됐다.
  scene.add(new THREE.HemisphereLight(LAB.amb[0], LAB.amb[1], LAB.amb[2]));
  const hang = (z, power) => {
    box(0.05, 0.62, 0.05, iron, 0, CEIL - 0.31, z);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.38, 10), toon(0x2f3438));
    hood.position.set(0, CEIL - 0.66, z); hood.rotation.x = Math.PI; scene.add(hood);
    const bulb = new THREE.PointLight(0xffe3b4, power * LAB.lamp, 16, 1.5);
    bulb.position.set(0, CEIL - 0.82, z); scene.add(bulb);
    return bulb;
  };
  hang(7.4, 11);                       // 침상 쪽 — 눈을 뜨는 자리
  // 소포 위 등이 가장 밝다. 방에서 가장 밝은 곳이 곧 다음 할 일이다(설계도 §4).
  hang(PARCEL.z, 17);
  hang(CONSOLE_Z + 0.6, 12);           // 콘솔 — 소포를 연 뒤의 다음 자리
  scene.fog = new THREE.FogExp2(LAB.bg, 0.018);

  // ── 걸을 수 있는 곳 · 부딪히는 것 ────────────────────────────────────────
  const rects = [{ id: 'lab', kind: 'room', x0: -HALF_W, x1: HALF_W,
    z0: Z_FAR, z1: Z_NEAR, h: CEIL, open: true }];
  const obstacles = [
    { x: -4.6, z: 8.8, r: 1.9 },                     // 침상
    { x: -4.4, z: 2.6, r: 2.0 },                     // 책상
    { x: 5.4, z: 2.6, r: 1.7 },                      // 선반
    { x: PARCEL.x, z: PARCEL.z, r: 1.5 },            // 작업대
    { x: 0, z: CONSOLE_Z, r: 2.3 },                  // 콘솔
  ];

  // ── 상태 ─────────────────────────────────────────────────────────────────
  // sleep → note(수첩 얻음) → ready(포탈 섬)
  const st = { stage: 'sleep', hasNote: false, open: false };
  let t = 0;

  const near = (pos, x, z, r) => Math.hypot(pos.x - x, pos.z - z) < r;
  const nearDial = (pos) => dials.find((d) => near(pos, d.x, d.z, 1.15));
  const atParcel = (pos) => near(pos, PARCEL.x, PARCEL.z, 2.3);
  const atPortal = (pos) => near(pos, 0, CIRCLE_Z, 2.6);

  return {
    scene, rects, obstacles, dials, state: st, ENTRY_Z: LAB_ENTRY_Z,
    CIRCLE: { x: 0, z: CIRCLE_Z },

    update(dt) {
      t += dt;
      if (st.open) {
        portalG.rotation.y += dt * 0.5;
        const p = 0.55 + Math.sin(t * 2.2) * 0.14;
        pMat.opacity = p; discMat.opacity = p * 0.6;
        portalLight.intensity = (7 + Math.sin(t * 2.2) * 2) * LAB.lamp;
      } else if (st.hasNote) {
        // 아직 못 맞췄으면 안쪽 원이 조용히 숨 쉰다 — 방에서 다음 할 일은 늘 가장 밝은 곳
        ring2.material.opacity = 0.36 + Math.sin(t * 1.6) * 0.16;
      }
    },

    prompt(pos) {
      if (!st.hasNote) {
        if (atParcel(pos)) return 'E — 소포 열어 보기';
        // ★ 콘솔에 먼저 가 본 아이에게 아무 말도 안 하면, 놋쇠 다이얼 셋이 달린
        //   커다란 장치가 **아무 반응 없는 벽**이 된다. 그게 바로 "불친절"이다.
        //   답은 안 주고 "아직 모른다"는 것만 말한다 — 그러면 소포로 돌아간다.
        if (nearDial(pos) || near(pos, 0, CONSOLE_Z, 3.6))
          return '놋쇠 다이얼이 셋. …맞출 자리를 아직 모른다';
        return null;
      }
      if (st.open && atPortal(pos)) return 'E — 저 별로 내려가기';
      const d = nearDial(pos);
      if (d) return `E — ${d.i + 1}번째 다이얼 돌리기 (지금 ${d.value})`;
      if (!st.open && near(pos, 0, CONSOLE_Z, 3.6))
        return '자리 세 개를 맞춰야 한다 — N으로 수첩을 펴 보자';
      return null;
    },

    // 무엇을 했는지 문자열로 돌려준다. boot이 그걸 보고 대사를 고른다 —
    // 대사를 여기서 부르면 이 파일이 대본까지 알아야 한다.
    interact(pos) {
      if (!st.hasNote && atParcel(pos)) {
        st.hasNote = true; st.stage = 'note';
        lid.position.set(0.72, 0.06, 0.34); lid.rotation.z = 0.5;   // 뚜껑을 열어 둔다
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
          portalG.visible = true;
          ring2.material.opacity = 0.5;
          return 'solved';
        }
        return 'dial';
      }
      return null;
    },
  };
}
