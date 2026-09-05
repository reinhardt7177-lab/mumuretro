// 사당 내부 — 관문 셋을 지나 신전에 닿는 한 줄기 공간.
//
// ★ 방을 씬으로 나누지 않는다. 전부 **한 씬 안에 −Z 방향으로 늘어놓고** 걸어서 통과한다.
//   방마다 씬을 갈아 끼우면 전환 연출·상태 보존·카메라 재배치를 방마다 만들어야 하고,
//   무엇보다 "쭉 이어진 한 공간"이라는 감각이 사라진다. 사당은 한 덩어리여야 한다.
//
// ★ 문은 별도 충돌체가 아니라 **통로 사각형의 on/off**다.
//   닫힌 문 = 그 통로를 걸을 수 없음. 문마다 다른 로직을 만들지 않는다.
//
// 조명색이 곧 진도다(설계도 §4). 청록 → 붉음 → 호박 → 금색.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { SHRINE } from '../data/lighting.js';

const CYAN = 0x6fe3d2, RED = 0xe0736b, AMBER = 0xf0a860, GOLD = 0xffd27a;

// z가 작아질수록 안쪽이다. from > to.
// 치수는 전부 플레이어 1.5u에서 유도했다(설계도 §1).
export const LAYOUT = [
  { id: 'entry', kind: 'corridor', w: 3, from: 11.4, to: 6.0, h: 3.2, glow: CYAN, open: true },
  { id: 'r1', kind: 'room', name: '빛 타일', w: 10, from: 6.0, to: -8.0, h: 5.5, glow: CYAN },
  { id: 'c1', kind: 'corridor', w: 3, from: -8.0, to: -12.0, h: 3.2, glow: CYAN, door: 'r1' },
  { id: 'r2', kind: 'room', name: '레이저 회랑', w: 8, from: -12.0, to: -28.0, h: 5.5, glow: RED },
  { id: 'c2', kind: 'corridor', w: 3, from: -28.0, to: -32.0, h: 3.2, glow: RED, door: 'r2' },
  { id: 'r3', kind: 'room', name: '무게 압력판', w: 12, from: -32.0, to: -42.0, h: 5.5, glow: AMBER },
  { id: 'c3', kind: 'corridor', w: 3, from: -42.0, to: -46.0, h: 3.2, glow: AMBER, door: 'r3' },
  { id: 'shrine', kind: 'room', name: '신전', w: 18, from: -46.0, to: -62.0, h: 9, glow: GOLD },
];

export const ENTRY_Z = 10.2;     // 시작 지점(입구 통로 끝)
export const EXIT_Z = 11.0;      // 이보다 뒤로 가면 밖으로 나간다
const WALL = 0.6;

export function buildDungeon(scene) {
  const stone = toon(SHRINE.stone);
  const dark = toon(SHRINE.stoneDark);
  const lite = toon(SHRINE.stoneLite);

  const box = (w, h, d, m, x, y, z, parent = scene) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z);
    me.castShadow = true; me.receiveShadow = true;
    parent.add(me);
    return me;
  };
  const glowMat = (c) => {
    const m = new THREE.MeshBasicMaterial({ color: c });
    m.userData.outlineParameters = { visible: false };
    return m;
  };

  const rects = [];      // 걸을 수 있는 영역. 문이 닫히면 open=false가 된다
  const doors = {};      // roomId → { mesh, rect, opened }
  const lights = [];

  for (let i = 0; i < LAYOUT.length; i++) {
    const s = LAYOUT[i];
    const len = s.from - s.to, cz = (s.from + s.to) / 2, hw = s.w / 2;
    const gm = glowMat(s.glow);

    // 바닥 · 천장
    box(s.w, WALL, len, dark, 0, -WALL / 2, cz);
    box(s.w, WALL, len, dark, 0, s.h + WALL / 2, cz);
    // 좌우 벽
    box(WALL, s.h, len, stone, -hw - WALL / 2, s.h / 2, cz);
    box(WALL, s.h, len, stone, hw + WALL / 2, s.h / 2, cz);

    // 이음매 벽 — 다음 구간과 폭이 다르면 그 차이만큼 벽을 세우고 가운데를 비운다.
    // 이게 있어야 좁은 통로에서 넓은 방으로 "나오는" 낙차가 생긴다.
    const nxt = LAYOUT[i + 1];
    if (nxt) {
      const ow = Math.min(s.w, nxt.w), oh = Math.min(s.h, nxt.h);
      const side = (s.w - ow) / 2;
      if (side > 0.01) {
        box(side, s.h, WALL, stone, -(ow / 2 + side / 2), s.h / 2, s.to - WALL / 2);
        box(side, s.h, WALL, stone, (ow / 2 + side / 2), s.h / 2, s.to - WALL / 2);
      }
      if (s.h - oh > 0.01) box(ow, s.h - oh, WALL, stone, 0, oh + (s.h - oh) / 2, s.to - WALL / 2);
    } else {
      box(s.w, s.h, WALL, stone, 0, s.h / 2, s.to - WALL / 2);   // 막다른 끝
    }

    // 바닥 눈금 — 통짜 판이면 넓이가 안 읽힌다
    const marks = Math.max(1, Math.round(len / 2.6));
    for (let k = 1; k < marks; k++) {
      box(s.w - 1.2, 0.04, 0.08, lite, 0, 0.01, s.from - (len * k) / marks);
    }

    // 벽 발광 띠 — 방마다 색이 다르다. 색이 곧 진도다.
    for (const sd of [-1, 1]) box(0.12, 0.12, len - 1.0, gm, sd * (hw - 0.06), 0.9, cz);

    // 조명 — 실내는 손으로 놓는다. 방마다 은은한 포인트 하나.
    const pl = new THREE.PointLight(s.glow, s.kind === 'room' ? 7 : 3, Math.max(10, len * 0.9), 1.7);
    pl.position.set(0, s.h - 1.0, cz);
    scene.add(pl);
    lights.push(pl);

    rects.push({
      id: s.id, kind: s.kind, x0: -hw, x1: hw,
      z0: s.to, z1: s.from, h: s.h,
      open: s.open !== false && !s.door,
      glow: s.glow, name: s.name,
    });

    // 문 — 통로 입구를 막는 발광 판. 조건이 풀리면 사라지고 통로가 열린다.
    if (s.door) {
      const oh = Math.min(s.h, 3.4);
      const dm = new THREE.MeshBasicMaterial({ color: s.glow, transparent: true, opacity: 0.8 });
      dm.userData.outlineParameters = { visible: false };
      const mesh = box(s.w - 0.1, oh - 0.05, 0.22, dm, 0, oh / 2, s.from - 0.1);
      // 문틀 — 발광 띠. 어디가 다음 문인지 멀리서도 보인다.
      box(s.w + 0.4, 0.16, 0.2, gm, 0, oh + 0.08, s.from - 0.05);
      for (const sd of [-1, 1]) box(0.16, oh, 0.2, gm, sd * (s.w / 2 + 0.2), oh / 2, s.from - 0.05);
      doors[s.door] = { mesh, rect: rects[rects.length - 1], opened: false, glow: gm, color: s.glow };
    }
  }

  // 신전 — 문 위에서 내려오는 스포트. 방에서 가장 밝은 곳은 항상 다음 목표다(설계도 §4).
  const last = LAYOUT[LAYOUT.length - 1];
  const key = new THREE.SpotLight(0xfff0cf, 30, 26, Math.PI / 5, 0.45, 1.4);
  key.position.set(0, last.h - 0.6, last.to + 4.5);
  key.target.position.set(0, 0, last.to + 1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 28;
  scene.add(key); scene.add(key.target);

  const amb = new THREE.HemisphereLight(0x5d7a86, 0x2a2620, 0.5);
  scene.add(amb);

  // ── 진행 ────────────────────────────────────────────────────────────────
  const openDoor = (roomId) => {
    const d = doors[roomId];
    if (!d || d.opened) return false;
    d.opened = true;
    d.mesh.visible = false;
    d.rect.open = true;
    d.glow.color.set(GOLD);        // 열린 문은 금색. 지나온 곳이 표시된다
    return true;
  };

  // 사당 여섯 곳이 이 내부 하나를 함께 쓴다. 다음 사당에 들어갈 때 문을 도로 닫지
  // 않으면 첫 사당을 깬 뒤로는 모든 사당이 열린 채로 시작한다 — 보상이 무의미해진다.
  const resetDoors = () => {
    for (const id in doors) {
      const d = doors[id];
      d.opened = false;
      d.mesh.visible = true;
      d.rect.open = false;
      d.glow.color.set(d.color);
    }
  };

  // 이 z가 어느 구간인가. 부활 지점과 프롬프트에 쓴다.
  const segmentAt = (z) => {
    for (const r of rects) if (z <= r.z1 && z >= r.z0) return r;
    return null;
  };

  return { rects, doors, openDoor, resetDoors, segmentAt, lights, LAYOUT };
}
