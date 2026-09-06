// 열린 사당 — 하늘에 뜬 섬.
//
// ★ 사당 여섯이 전부 **동굴**이었다. 천장 5.5u, 옆벽, 통로 — 색만 다른 같은 굴.
//   젤다(티어스 오브 더 킹덤)의 신전을 옆에 놓으면 차이가 한눈에 온다. 그쪽은
//   하늘에 뜬 섬이고, 목적지가 입구에서부터 보이고, 기믹이 열린 들판에 펼쳐진다.
//
// 그래서 굴을 걷어 낸다. 다만 **관문의 좌표계는 한 줄도 안 바꾼다.**
//   · 구간은 여전히 −Z 한 줄기다. 관문은 seg.x0~x1, z0~z1 안에서 그대로 돈다.
//   · 바닥은 여전히 y=0이다. 걸음(RoomActor)은 모른다.
//   · 문은 여전히 통로 사각형의 on/off다(Dungeon.js). 모양만 아치가 됐다.
//   바뀌는 것은 천장(없음) · 옆벽(낮은 난간) · 통로(다리) · 하늘(진짜 하늘)이다.
//
// ★ seg.h는 그대로 둔다 — 관문이 기둥 높이로 쓴다(그림자 기둥·지진 기둥·낙석 높이).
//   카메라만 camH(=80)로 풀어 준다. 둘을 한 값에 담으면 기둥이 80u가 된다.
//
// ★ 굴 빌더(Dungeon.js)와 **같은 계약**을 돌려준다 — rects · doors · openDoor ·
//   resetDoors · segmentAt · rectOf. Room.js와 boot.js는 어느 쪽인지 모른다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';

const GOLD = 0xffd27a;
const RAIL = 0.9;              // 난간 높이. 카메라 최저(1.0)보다 낮아야 난간 속에 안 들어간다
const SLAB = 1.6;              // 섬 바닥돌 두께 — 얇으면 판자, 두꺼우면 땅

const SKY_VERT = `
  varying vec3 vLocal;
  void main(){ vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SKY_FRAG = `
  uniform vec3 uTop, uHorizon;
  varying vec3 vLocal;
  void main(){
    float t = clamp(normalize(vLocal).y, -0.15, 1.0);
    t = smoothstep(-0.05, 0.62, t);
    gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.0);
  }`;

export function buildOpenField(scene, rooms, theme) {
  const O = theme.open;
  const stone = toon(theme.stone);
  const dark = toon(theme.stoneDark);
  const lite = toon(theme.stoneLite);
  const ground = toon(O.ground);
  const rim = toon(O.rim);

  const box = (w, h, d, m, x, y, z) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z);
    me.castShadow = true; me.receiveShadow = true;
    scene.add(me);
    return me;
  };
  const glowMat = (c) => {
    const m = new THREE.MeshBasicMaterial({ color: c });
    m.userData.outlineParameters = { visible: false };
    return m;
  };
  const cDim = new THREE.Color(theme.glowDim), cLit = new THREE.Color(theme.glow);
  const progress = (i) => new THREE.Color().copy(cDim)
    .lerp(cLit, rooms.length < 2 ? 1 : i / (rooms.length - 1));

  // ── 하늘 · 해 · 안개 ──────────────────────────────────────────────────────
  scene.background = new THREE.Color(O.horizon);
  // 안개는 지평선색으로 수렴한다(Sky.js 규칙 1). 먼 바위가 하늘에 붙는 이유가 이것이다.
  scene.fog = new THREE.FogExp2(O.horizon, 0.0075);
  const domeMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(O.top) }, uHorizon: { value: new THREE.Color(O.horizon) } },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
  });
  domeMat.userData.outlineParameters = { visible: false };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(420, 28, 18), domeMat);
  dome.renderOrder = -100; dome.frustumCulled = false;
  dome.userData.sky = true;            // 검사 H — 안에 있으라고 만든 것. 파묻힘이 아니다
  scene.add(dome);

  if (O.stars) {
    const n = O.stars, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(1 - Math.random() * 0.92);
      pos[i * 3] = 400 * Math.sin(v) * Math.cos(u);
      pos[i * 3 + 1] = 400 * Math.cos(v);
      pos[i * 3 + 2] = 400 * Math.sin(v) * Math.sin(u);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sm = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false });
    sm.userData.outlineParameters = { visible: false };
    const stars = new THREE.Points(g, sm);
    stars.frustumCulled = false; stars.userData.sky = true;
    scene.add(stars);
  }

  const last = rooms[rooms.length - 1], first = rooms[0];
  const zMid = (first.from + last.to) / 2, zLen = first.from - last.to;

  const el = O.sunEl * Math.PI / 180, az = O.sunAz * Math.PI / 180;
  const sun = new THREE.DirectionalLight(O.sun, O.sunI);
  sun.position.set(Math.sin(az) * Math.cos(el) * 80, Math.sin(el) * 80,
    Math.cos(az) * Math.cos(el) * 80 + zMid);
  sun.target.position.set(0, 0, zMid);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = zLen / 2 + 8; sc.bottom = -zLen / 2 - 8;
  sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0008;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(O.top, O.ground, O.stars ? 0.35 : 0.85);
  scene.add(hemi);

  // ── 섬의 몸통 — 바닥돌 아래로 절벽이 내려간다 ────────────────────────────
  // 판만 띄우면 종이다. 아래로 두꺼운 바위가 내려가야 "섬"으로 읽힌다.
  const wMax = Math.max(...rooms.map((r) => r.w));
  const body = new THREE.Mesh(new THREE.CylinderGeometry(wMax * 0.62, wMax * 0.18, 16, 9, 1), rim);
  body.scale.z = (zLen * 0.5 + 10) / (wMax * 0.62);
  body.position.set(0, -SLAB - 7.6, zMid);
  body.receiveShadow = true;
  scene.add(body);

  const rects = [];
  const doors = {};

  for (let i = 0; i < rooms.length; i++) {
    const s = rooms[i];
    const len = s.from - s.to, cz = (s.from + s.to) / 2, hw = s.w / 2;
    const isEnd = i === rooms.length - 1;
    const gcol = isEnd ? new THREE.Color(GOLD) : progress(i);
    const gm = glowMat(gcol);
    const isBridge = s.kind === 'corridor';

    // 바닥돌 — 방은 넓고 두껍게, 다리는 좁고 얇게
    const slabH = isBridge ? 0.9 : SLAB;
    const floor = box(s.w + (isBridge ? 0 : 1.2), slabH, len + (isBridge ? 0 : 0.6),
      isBridge ? stone : ground, 0, -slabH / 2, cz);
    floor.castShadow = false;
    // 가장자리 띠 — 바닥돌 옆면이 다른 색이어야 두께가 읽힌다
    if (!isBridge) {
      for (const sd of [-1, 1]) box(0.5, slabH + 0.2, len + 0.6, rim, sd * (hw + 0.85), -slabH / 2 + 0.1, cz);
    }

    if (isBridge) {
      // 다리 — 난간 기둥과 발광 손잡이. 아래는 허공이다.
      const posts = Math.max(2, Math.round(len / 1.6));
      for (const sd of [-1, 1]) {
        for (let k = 0; k <= posts; k++) {
          const z = s.from - (len * k) / posts;
          box(0.16, RAIL + 0.1, 0.16, dark, sd * (hw - 0.1), (RAIL + 0.1) / 2, z);
        }
        box(0.10, 0.10, len, gm, sd * (hw - 0.1), RAIL + 0.05, cz);
      }
    } else {
      // 난간 — 낮은 돌담. 위에 발광 줄. 천장이 없으니 이것이 방의 테두리다.
      for (const sd of [-1, 1]) {
        box(0.5, RAIL, len + 0.6, stone, sd * (hw + 0.25), RAIL / 2, cz);
        box(0.12, 0.08, len + 0.2, gm, sd * (hw + 0.25), RAIL + 0.04, cz);
      }
      // 모퉁이 기둥 — 난간 끝이 허공에서 뚝 끊기면 미완성으로 보인다
      for (const sd of [-1, 1]) {
        for (const ez of [s.from + 0.3, s.to - 0.3]) {
          box(0.7, RAIL * 2.1, 0.7, lite, sd * (hw + 0.25), RAIL * 1.05, ez);
          box(0.9, 0.16, 0.9, dark, sd * (hw + 0.25), RAIL * 2.1 + 0.08, ez);
        }
      }
      // 바닥 눈금 — 통짜 판이면 넓이가 안 읽힌다(굴과 같은 이유)
      const marks = Math.max(1, Math.round(len / 2.6));
      for (let k = 1; k < marks; k++) {
        box(s.w - 1.2, 0.04, 0.08, lite, 0, 0.01, s.from - (len * k) / marks);
      }
    }

    // 막다른 끝 — 신전 뒤. 벽 대신 **봉화**. 입구에서부터 보여야 한다.
    if (isEnd) {
      const bz = s.to + 1.6;
      for (let k = 0; k < 3; k++) {
        box(4.2 - k * 0.9, 0.5, 4.2 - k * 0.9, k % 2 ? lite : stone, 0, 0.25 + k * 0.5, bz);
      }
      const bm = new THREE.MeshBasicMaterial({ color: gcol, transparent: true, opacity: 0.32,
        depthWrite: false, side: THREE.DoubleSide });
      bm.userData.outlineParameters = { visible: false };
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.2, 46, 8, 1, true), bm);
      beam.position.set(0, 1.5 + 23, bz);
      scene.add(beam);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), gm);
      core.position.set(0, 2.3, bz);
      scene.add(core);
      // 뒤쪽 병풍 — 봉화 뒤에 무엇이 있어야 앞이 있다
      for (const [x, h, d] of [[-5.2, 6.5, 1.1], [0, 8.5, 1.4], [5.2, 6.5, 1.1]]) {
        box(2.4, h, d, stone, x, h / 2, s.to - 0.6);
        box(2.8, 0.4, d + 0.3, dark, x, h + 0.2, s.to - 0.6);
      }
    }

    rects.push({
      id: s.id, kind: s.kind, x0: -hw, x1: hw,
      z0: s.to, z1: s.from, h: s.h, camH: 80, open: s.open !== false && !s.door,
      glow: gcol.getHex(), name: s.name, gate: s.gate, act: s.act, field: true,
    });

    // 문 — 아치. 두 기둥·상인방·그 사이의 발광 막. 조건이 풀리면 막만 사라진다.
    if (s.door) {
      const oh = Math.min(s.h, 3.4);
      const dm = new THREE.MeshBasicMaterial({ color: gcol, transparent: true, opacity: 0.8 });
      dm.userData.outlineParameters = { visible: false };
      const mesh = box(s.w - 0.1, oh - 0.05, 0.22, dm, 0, oh / 2, s.from - 0.1);
      mesh.userData.veil = true;
      for (const sd of [-1, 1]) {
        box(0.7, oh + 0.9, 0.7, stone, sd * (s.w / 2 + 0.45), (oh + 0.9) / 2, s.from - 0.05);
        box(0.22, oh, 0.2, gm, sd * (s.w / 2 + 0.2), oh / 2, s.from - 0.05);
      }
      box(s.w + 1.6, 0.55, 0.8, dark, 0, oh + 0.9 + 0.27, s.from - 0.05);
      box(s.w + 0.4, 0.16, 0.2, gm, 0, oh + 0.08, s.from - 0.05);
      doors[s.door] = { mesh, rect: rects[rects.length - 1], opened: false, glow: gm, color: gcol.getHex() };
    }
  }

  // ── 먼 것들 — 떠 있는 바위 · 구름. 크기 감각은 멀리 있는 것이 만든다 ──────
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + 0.4, dist = 60 + (k % 5) * 22;
    const x = Math.cos(a) * dist, z = zMid + Math.sin(a) * dist * 1.4;
    const y = -30 + ((k * 37) % 50), sz = 4 + (k * 13) % 9;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(sz, 0), rim);
    r.position.set(x, y, z); r.rotation.set(k, k * 0.7, k * 1.3);
    scene.add(r);
    const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(sz * 0.7, 0), ground);
    cap.position.set(x, y + sz * 0.55, z); cap.scale.y = 0.35;
    scene.add(cap);
  }
  const cm = new THREE.MeshBasicMaterial({ color: O.cloud, transparent: true, opacity: O.stars ? 0.35 : 0.85 });
  cm.userData.outlineParameters = { visible: false };
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + 1.1, dist = 90 + (k % 4) * 40;
    const g = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(5 + (j * 7 + k) % 6, 7, 5), cm);
      puff.position.set((j - 1.5) * 6, (j % 2) * 2.2, 0); puff.scale.y = 0.55;
      g.add(puff);
    }
    g.position.set(Math.cos(a) * dist, 8 + (k * 11) % 24, zMid + Math.sin(a) * dist * 1.3);
    scene.add(g);
  }

  // ── 진행 — 굴과 똑같은 계약 ──────────────────────────────────────────────
  const openDoor = (roomId) => {
    const d = doors[roomId];
    if (!d || d.opened) return false;
    d.opened = true; d.mesh.visible = false; d.rect.open = true;
    d.glow.color.set(GOLD);
    return true;
  };
  const resetDoors = () => {
    for (const id in doors) {
      const d = doors[id];
      d.opened = false; d.mesh.visible = true; d.rect.open = false;
      d.glow.color.set(d.color);
    }
  };
  const segmentAt = (z) => {
    for (const r of rects) if (z <= r.z1 && z >= r.z0) return r;
    return null;
  };
  const rectOf = (id) => rects.find((r) => r.id === id);

  return { rects, doors, openDoor, resetDoors, segmentAt, rectOf, lights: [], rooms, theme, open: true };
}
