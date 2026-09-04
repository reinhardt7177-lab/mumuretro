// 사당 내부 — 별도 씬. 아트 바이블 §5 형태 언어 · 사당 설계 계획.
//
// 바깥은 구면이지만 여기는 **평평한 실내**다. 구면 보행 코드를 실내에 억지로 쓰면
// 코드가 꼬인다 — 그건 검증된 채로(극점 통과 편차 2.84e-14) 두는 게 낫다.
//
// 크기는 플레이어(1.5u)에서 유도했다.
//   주 공간 16 × 12u — 입구에 서면 화각 55°에 방 전체가 담긴다(BotW 사당의 제1원칙)
//   천장 6.5u        — 캐릭터의 4.3배. 낮으면 답답하고 높으면 실내가 아니라 광장이 된다
//   통로 3 × 5u      — 좁은 통로에서 넓은 방으로 나오는 낙차가 "들어왔다"를 만든다
//
// 조명은 바깥과 다르다. 밖은 태양 하나지만 여기는 **손으로 놓은 빛**이다.
// 좁고 통제된 공간이라, 이 게임에서 젤다급을 실제로 시도할 수 있는 유일한 곳이다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { SHRINE, LIGHT } from '../data/lighting.js';

// 치수 — 전부 플레이어 1.5u에서 유도한다.
export const ROOM = {
  W: 16, D: 12, H: 6.5,          // 주 공간
  CORR_W: 3, CORR_D: 5, CORR_H: 3.2,   // 입구 통로
  DOOR_W: 3, DOOR_H: 3.5,        // 안쪽 문(출구)
  WALL: 0.6,                     // 벽 두께
};

// 주 공간은 원점 중심. z가 클수록 입구 쪽.
//   방      z ∈ [-D/2, +D/2]  = [-6, 6]
//   통로    z ∈ [D/2, D/2+CORR_D] = [6, 11]
//   입구    z = 11
//   출구 문 z = -D/2 (안쪽 벽 한가운데)
export const ENTRY_Z = ROOM.D / 2 + ROOM.CORR_D - 0.8;   // 10.2
export const EXIT_Z = ROOM.D / 2 + ROOM.CORR_D + 0.4;    // 11.4 — 이보다 뒤로 가면 밖으로 나간다

export class ShrineRoom {
  constructor() {
    const scene = new THREE.Scene();
    // 실내는 하늘이 없다. 안개도 없다 — 방이 16u라 안개가 낄 거리가 아니다.
    scene.background = new THREE.Color(0x0d1519);
    this.scene = scene;

    const stone = toon(SHRINE.stone);
    const dark = toon(SHRINE.stoneDark);
    const lite = toon(SHRINE.stoneLite);
    const glow = new THREE.MeshBasicMaterial({ color: SHRINE.glow });
    glow.userData.outlineParameters = { visible: false };
    this.glowMat = glow;

    const box = (w, h, d, m, x, y, z) => {
      const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      me.position.set(x, y, z);
      me.castShadow = true; me.receiveShadow = true;
      scene.add(me);
      return me;
    };

    const { W, D, H, CORR_W, CORR_D, CORR_H, DOOR_W, DOOR_H, WALL } = ROOM;
    const hw = W / 2, hd = D / 2, chw = CORR_W / 2;

    // ── 바닥 ────────────────────────────────────────────────────────────
    box(W, WALL, D, dark, 0, -WALL / 2, 0);
    box(CORR_W, WALL, CORR_D + 0.2, dark, 0, -WALL / 2, hd + CORR_D / 2);
    // 바닥 무늬 — 통짜 판이면 넓이가 안 읽힌다. 격자 선 몇 줄이 크기를 알려 준다.
    for (let i = -2; i <= 2; i++) {
      box(W - 1.2, 0.04, 0.08, lite, 0, 0.01, i * 2.4);
    }

    // ── 벽 ──────────────────────────────────────────────────────────────
    box(WALL, H, D, stone, -hw - WALL / 2, H / 2, 0);          // 왼쪽
    box(WALL, H, D, stone, hw + WALL / 2, H / 2, 0);           // 오른쪽
    // 입구 쪽 벽 — 통로 폭만큼 비워 두고 양옆만 세운다
    const sideW = hw - chw;
    box(sideW, H, WALL, stone, -(chw + sideW / 2), H / 2, hd + WALL / 2);
    box(sideW, H, WALL, stone, (chw + sideW / 2), H / 2, hd + WALL / 2);
    box(CORR_W, H - CORR_H, WALL, stone, 0, CORR_H + (H - CORR_H) / 2, hd + WALL / 2);  // 통로 위 인방

    // 안쪽 벽 — 문 구멍만 비운다
    const dsw = hw - DOOR_W / 2;
    box(dsw, H, WALL, stone, -(DOOR_W / 2 + dsw / 2), H / 2, -hd - WALL / 2);
    box(dsw, H, WALL, stone, (DOOR_W / 2 + dsw / 2), H / 2, -hd - WALL / 2);
    box(DOOR_W, H - DOOR_H, WALL, stone, 0, DOOR_H + (H - DOOR_H) / 2, -hd - WALL / 2);

    // ── 천장 ────────────────────────────────────────────────────────────
    box(W, WALL, D, dark, 0, H + WALL / 2, 0);
    box(CORR_W, WALL, CORR_D + 0.2, dark, 0, CORR_H + WALL / 2, hd + CORR_D / 2);
    // 통로 벽
    box(WALL, CORR_H, CORR_D, stone, -chw - WALL / 2, CORR_H / 2, hd + CORR_D / 2);
    box(WALL, CORR_H, CORR_D, stone, chw + WALL / 2, CORR_H / 2, hd + CORR_D / 2);

    // ── 문(출구) ────────────────────────────────────────────────────────
    // 잠긴 상태 = 청록 발광 판이 구멍을 막고 있다. 저울이 수평이 되면 열린다.
    this.door = box(DOOR_W - 0.1, DOOR_H - 0.1, 0.25, glow, 0, DOOR_H / 2, -hd);
    this.door.material = new THREE.MeshBasicMaterial({
      color: SHRINE.glowDim, transparent: true, opacity: 0.75,
    });
    this.door.material.userData.outlineParameters = { visible: false };
    // 문틀 — 발광 띠
    box(DOOR_W + 0.4, 0.16, 0.2, glow, 0, DOOR_H + 0.08, -hd + 0.12);
    for (const s of [-1, 1]) box(0.16, DOOR_H + 0.16, 0.2, glow, s * (DOOR_W / 2 + 0.2), DOOR_H / 2, -hd + 0.12);

    // ── 벽 발광 띠 ──────────────────────────────────────────────────────
    // 낮게 두른다. 방의 윤곽만 알려 주고 시선을 뺏지 않는다.
    for (const s of [-1, 1]) box(0.12, 0.12, D - 1.5, glow, s * (hw - 0.08), 0.9, 0);
    box(W - 1.5, 0.12, 0.12, glow, 0, 0.9, hd - 0.08);

    // ── 조명 ────────────────────────────────────────────────────────────
    // 밖보다 어둡다. 들어온 순간 눈이 적응하는 그 느낌이 있어야 실내가 된다.
    const amb = new THREE.HemisphereLight(0x5d7a86, 0x2a2620, 0.55);
    scene.add(amb);

    // 문 위에서 내려오는 한 줄기 — 방에서 가장 밝은 곳. 목표를 밝힌다.
    const key = new THREE.SpotLight(0xfff0cf, 26, 22, Math.PI / 5.2, 0.45, 1.4);
    key.position.set(0, H - 0.4, -hd + 3.2);
    key.target.position.set(0, 0, -hd + 1.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 24;
    scene.add(key); scene.add(key.target);
    this.key = key;

    // 방 가운데 위 — 저울이 놓일 자리를 은은하게. 수단을 밝힌다.
    const fill = new THREE.PointLight(SHRINE.glow, 9, 16, 1.6);
    fill.position.set(0, 3.4, 1.0);
    scene.add(fill);
    this.fillLight = fill;

    // 입구 통로 — 어둡게 둔다. 통로가 어두워야 방이 밝아 보인다.
    const corr = new THREE.PointLight(0x9fd0dd, 3.5, 9, 1.8);
    corr.position.set(0, CORR_H - 0.5, hd + CORR_D * 0.6);
    scene.add(corr);

    this.opened = false;
  }

  // 문 열기 — 저울이 수평이 되면 부른다(③④에서 쓴다).
  open() {
    if (this.opened) return;
    this.opened = true;
    this.door.visible = false;
    this.glowMat.color.set(0xffd27a);        // 청록 → 금색. 색 하나가 "해냈다"를 말한다
    this.fillLight.color.set(0xffd27a);
  }

  dispose() {
    this.scene.traverse(o => {
      if (o.isMesh) { o.geometry.dispose(); if (o.material.dispose) o.material.dispose(); }
    });
  }
}
