// 사당 내부 — 관문 셋을 지나 신전에 닿는 한 줄기 공간.
//
// ★ 방을 씬으로 나누지 않는다. 전부 **한 씬 안에 −Z 방향으로 늘어놓고** 걸어서 통과한다.
//   방마다 씬을 갈아 끼우면 전환 연출·상태 보존·카메라 재배치를 방마다 만들어야 하고,
//   무엇보다 "쭉 이어진 한 공간"이라는 감각이 사라진다. 사당은 한 덩어리여야 한다.
//   (사당 **여섯**은 서로 다른 씬을 갖는다. 그건 다른 이야기다 — Room.js를 보라.)
//
// ★ 문은 별도 충돌체가 아니라 **통로 사각형의 on/off**다.
//   닫힌 문 = 그 통로를 걸을 수 없음. 문마다 다른 로직을 만들지 않는다.
//
// ★ 배치와 색은 인자로 받는다. 예전엔 LAYOUT이 이 파일의 상수여서
//   사당이 여섯인데 내부가 하나였다(layouts.js 머리말).
import * as THREE from 'three';
import { toon } from '../render/Toon.js';

const GOLD = 0xffd27a;           // 지나온 문·신전. 사당 테마와 무관한 "끝" 색이다.
const WALL = 0.6;

export function buildDungeon(scene, rooms, theme) {
  const stone = toon(theme.stone);
  const dark = toon(theme.stoneDark);
  const lite = toon(theme.stoneLite);

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

  // 안쪽으로 갈수록 발광이 밝아진다 — 색이 곧 진도다(설계도 §4).
  // 사당마다 색이 다르므로 "청록→붉음→호박"처럼 고정할 수 없다. 대신 같은 색의
  // 어두운 쪽에서 밝은 쪽으로 걸어 들어가게 하고, 신전만 금색으로 끊는다.
  const cDim = new THREE.Color(theme.glowDim), cLit = new THREE.Color(theme.glow);
  const progress = (i) => new THREE.Color().copy(cDim)
    .lerp(cLit, rooms.length < 2 ? 1 : i / (rooms.length - 1));

  const rects = [];      // 걸을 수 있는 영역. 문이 닫히면 open=false가 된다
  const doors = {};      // roomId → { mesh, rect, opened }
  const lights = [];

  for (let i = 0; i < rooms.length; i++) {
    const s = rooms[i];
    const len = s.from - s.to, cz = (s.from + s.to) / 2, hw = s.w / 2;
    const isEnd = i === rooms.length - 1;
    const gcol = isEnd ? new THREE.Color(GOLD) : progress(i);
    const gm = glowMat(gcol);

    // 바닥 · 천장
    box(s.w, WALL, len, dark, 0, -WALL / 2, cz);
    box(s.w, WALL, len, dark, 0, s.h + WALL / 2, cz);
    // 좌우 벽
    box(WALL, s.h, len, stone, -hw - WALL / 2, s.h / 2, cz);
    box(WALL, s.h, len, stone, hw + WALL / 2, s.h / 2, cz);

    // 이음매 벽 — 다음 구간과 폭이 다르면 그 차이만큼 벽을 세우고 가운데를 비운다.
    // 이게 있어야 좁은 통로에서 넓은 방으로 "나오는" 낙차가 생긴다.
    const nxt = rooms[i + 1];
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

    // 벽 발광 띠
    for (const sd of [-1, 1]) box(0.12, 0.12, len - 1.0, gm, sd * (hw - 0.06), 0.9, cz);

    // 조명 — 실내는 손으로 놓는다. 방마다 은은한 포인트 하나.
    // lamp 배율이 곧 사당의 밝기다. 그림자 사당은 0.3이라 이 불이 거의 안 보인다.
    const pl = new THREE.PointLight(gcol, (s.kind === 'room' ? 7 : 3) * theme.lamp,
      Math.max(10, len * 0.9), 1.7);
    pl.position.set(0, s.h - 1.0, cz);
    scene.add(pl);
    lights.push(pl);

    rects.push({
      id: s.id, kind: s.kind, x0: -hw, x1: hw,
      z0: s.to, z1: s.from, h: s.h,
      open: s.open !== false && !s.door,
      glow: gcol.getHex(), name: s.name, gate: s.gate,
    });

    // 문 — 통로 입구를 막는 발광 판. 조건이 풀리면 사라지고 통로가 열린다.
    if (s.door) {
      const oh = Math.min(s.h, 3.4);
      const dm = new THREE.MeshBasicMaterial({ color: gcol, transparent: true, opacity: 0.8 });
      dm.userData.outlineParameters = { visible: false };
      const mesh = box(s.w - 0.1, oh - 0.05, 0.22, dm, 0, oh / 2, s.from - 0.1);
      // 문틀 — 발광 띠. 어디가 다음 문인지 멀리서도 보인다.
      box(s.w + 0.4, 0.16, 0.2, gm, 0, oh + 0.08, s.from - 0.05);
      for (const sd of [-1, 1]) box(0.16, oh, 0.2, gm, sd * (s.w / 2 + 0.2), oh / 2, s.from - 0.05);
      doors[s.door] = { mesh, rect: rects[rects.length - 1], opened: false, glow: gm, color: gcol.getHex() };
    }
  }

  // 신전 — 문 위에서 내려오는 스포트. 방에서 가장 밝은 곳은 항상 다음 목표다(설계도 §4).
  const last = rooms[rooms.length - 1];
  const far = Math.max(28, last.h * 3);
  const key = new THREE.SpotLight(0xfff0cf, 30 * theme.lamp, far, Math.PI / 5, 0.45, 1.4);
  key.position.set(0, last.h - 0.6, last.to + 4.5);
  key.target.position.set(0, 0, last.to + 1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5; key.shadow.camera.far = far;
  scene.add(key); scene.add(key.target);

  const amb = new THREE.HemisphereLight(theme.amb[0], theme.amb[1], theme.amb[2]);
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

  // 사당을 다시 도전할 때 문을 도로 닫는다.
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
  const rectOf = (id) => rects.find((r) => r.id === id);

  return { rects, doors, openDoor, resetDoors, segmentAt, rectOf, lights, rooms, theme };
}
