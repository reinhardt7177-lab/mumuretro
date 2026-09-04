// 관문 기믹 셋 — 빛 타일 · 레이저 회랑 · 무게 압력판.
//
// 셋이 한 파일에 있는 이유: 전부 같은 계약을 따른다.
//   update(dt, actor) → { fail?, solved?, prompt? }
// 실패하면 **방 처음으로** 돌려보낸다. 사당 처음이 아니다 —
// 레이저에서 몇 번 죽고 사당 입구로 쫓겨나면 아이는 그만둔다.
//
// 그리고 관문에는 문제를 붙이지 않는다. 관문은 몸이고 신전이 머리다(설계도 §4 금지).
// 섞으면 둘 다 죽는다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { SHRINE } from '../data/lighting.js';

const glowMat = (c, o = {}) => {
  const m = new THREE.MeshBasicMaterial({ color: c, ...o });
  m.userData.outlineParameters = { visible: false };
  return m;
};

// ══════════════════════════════════════════════════════════════════════════
// 관문 1 — 빛 타일
//
// 녹색만 안전하다. 나머지를 밟으면 꺼지고 떨어진다.
// 앞 절반은 색이 고정이라 눈으로 길을 읽고, 뒤 절반은 색이 주기적으로 바뀌어 타이밍이 붙는다.
// 학습: 규칙 찾기. 수학 4학년 「규칙과 대응」의 몸으로 하는 전 단계.
// ══════════════════════════════════════════════════════════════════════════
export class TileGate {
  constructor(scene, seg) {
    this.seg = seg;
    this.z0 = seg.z0 + 1.2; this.z1 = seg.z1 - 1.2;   // 양끝은 안전지대로 비운다
    this.COLS = 4; this.ROWS = 8;
    this.TW = (seg.x1 - seg.x0) / this.COLS;
    this.TD = (this.z1 - this.z0) / this.ROWS;
    this.safeMat = glowMat(0x5fd08a);
    this.badMat = glowMat(0x3a4750);
    this.phase = 0;

    // 손으로 짠 패턴. 각 행마다 안전한 열의 집합이다.
    // ★ 무작위로 만들면 막다른 길이 생기거나 반대로 한 줄이 통째로 안전해진다.
    //   행마다 **최소 하나는 안전**하고, 앞뒤 행의 안전 열이 붙어 있어야 건널 수 있다.
    this.rows = [
      { safe: [0, 1], shift: false },
      { safe: [1, 2], shift: false },
      { safe: [2], shift: false },
      { safe: [1, 2, 3], shift: false },
      { safe: [3], shift: true },     // 여기부터 색이 바뀐다
      { safe: [2, 3], shift: true },
      { safe: [0, 2], shift: true },
      { safe: [0, 1], shift: true },
    ];

    this.tiles = [];
    const g = new THREE.Group();
    scene.add(g);
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(this.TW - 0.12, 0.08, this.TD - 0.12), this.badMat);
        m.position.set(seg.x0 + (c + 0.5) * this.TW, 0.05, this.z0 + (r + 0.5) * this.TD);
        m.receiveShadow = true;
        g.add(m);
        this.tiles.push({ r, c, mesh: m });
      }
    }
    this.group = g;
    this._paint();
  }

  // 이 칸이 지금 안전한가. shift 행은 주기적으로 안전 열이 한 칸씩 밀린다.
  _safe(r, c) {
    const row = this.rows[r];
    const off = row.shift ? Math.floor(this.phase) % this.COLS : 0;
    return row.safe.some(s => (s + off) % this.COLS === c);
  }

  _paint() {
    for (const t of this.tiles) t.mesh.material = this._safe(t.r, t.c) ? this.safeMat : this.badMat;
  }

  update(dt, actor) {
    const before = Math.floor(this.phase);
    this.phase += dt * 0.35;                    // 2.9초에 한 칸. 4학년이 보고 판단할 시간
    if (Math.floor(this.phase) !== before) this._paint();

    const p = actor.position;
    if (p.z < this.z0 || p.z > this.z1) return {};   // 안전지대
    const c = Math.floor((p.x - this.seg.x0) / this.TW);
    const r = Math.floor((p.z - this.z0) / this.TD);
    if (c < 0 || c >= this.COLS || r < 0 || r >= this.ROWS) return {};
    if (!this._safe(r, c)) return { fail: '어두운 타일을 밟았어요' };
    return {};
  }

  // 방 끝에 닿으면 통과. 별도 스위치를 두지 않는다 — 건너는 것 자체가 답이다.
  solvedBy(actor) { return actor.position.z < this.z0 - 0.4; }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 2 — 레이저 회랑
//
// 낮은 줄은 점프로 넘고, 높은 줄은 그냥 지나간다. 속도가 서로 달라 틈이 어긋난다.
// 학습 없음. 순수하게 몸이다 — 이 방이 리듬을 만든다.
// ══════════════════════════════════════════════════════════════════════════
export class LaserGate {
  constructor(scene, seg) {
    this.seg = seg;
    const w = seg.x1 - seg.x0;
    this.beams = [];
    const g = new THREE.Group();
    scene.add(g);

    // y: 0.75는 점프로 넘는 높이(플레이어 1.5u의 절반), 2.2는 서서 지나가는 높이
    // speed 부호를 섞어 틈이 규칙적으로 겹치지 않게 한다
    const spec = [
      { z: seg.z1 - 3.0, y: 0.75, speed: 1.5, phase: 0.0 },
      { z: seg.z1 - 6.2, y: 2.20, speed: -1.1, phase: 1.4 },
      { z: seg.z1 - 9.4, y: 0.75, speed: 2.1, phase: 2.6 },
      { z: seg.z1 - 12.6, y: 0.75, speed: -1.8, phase: 0.7 },
    ];
    for (const s of spec) {
      const mat = glowMat(0xe0736b, { transparent: true, opacity: 0.85 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, w * 0.78, 6), mat);
      m.rotation.z = Math.PI / 2;                 // X축을 가로지른다
      m.position.set(0, s.y, s.z);
      g.add(m);
      // 레일 — 레이저가 어디를 오가는지 보여 준다. 없으면 갑자기 튀어나온 것처럼 보인다
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.05), glowMat(0x5a3a3a));
      rail.position.set(0, s.y, s.z);
      g.add(rail);
      this.beams.push({ ...s, mesh: m, t: s.phase, amp: (seg.z1 - seg.z0) * 0.0 });
    }
    this.group = g;
    this.range = w * 0.5 - 0.6;
  }

  update(dt, actor) {
    const p = actor.position;
    for (const b of this.beams) {
      b.t += dt * b.speed;
      // 좌우 왕복. sin이라 끝에서 느려져 넘을 틈이 생긴다.
      b.mesh.position.x = Math.sin(b.t) * this.range * 0.55;
      // 충돌 — 플레이어의 몸통을 원기둥으로 본다. 발끝(y)과 머리(y+1.5) 사이에 걸리면 맞은 것.
      const dz = Math.abs(p.z - b.z);
      const dx = Math.abs(p.x - b.mesh.position.x);
      if (dz < 0.42 && dx < this.range * 0.86) {
        const footY = p.y;                       // 점프하면 올라간다
        if (b.y > footY + 0.15 && b.y < footY + 1.5) return { fail: '레이저에 닿았어요' };
      }
    }
    return {};
  }

  solvedBy(actor) { return actor.position.z < this.seg.z0 + 1.2; }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 3 — 무게 압력판
//
// 여기서 '무게'가 처음 등장한다. 신전의 저울을 미리 알려 주는 자리다 —
// 신전에서 무게를 처음 보면 아이가 규칙부터 배워야 한다.
// 학습: 덧셈. 5 = 2+3, 3 = 1+2 … 답이 여러 개다.
// ══════════════════════════════════════════════════════════════════════════
const PLATE_WEIGHTS = [1, 2, 3, 4];
const pboxSize = (w) => 0.44 + w * 0.06;

export class PlateGate {
  constructor(scene, seg) {
    this.seg = seg;
    this.held = null;
    this.REACH = 1.6;
    this.glow = glowMat(SHRINE.glow);
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    const cz = (seg.z0 + seg.z1) / 2;
    const dark = toon(SHRINE.stoneDark), lite = toon(SHRINE.stoneLite);

    // 압력판 둘. 필요 무게를 점으로 새긴다 — 숫자는 3D에서 각도에 따라 안 읽힌다.
    this.plates = [];
    for (const [i, spec] of [[0, { need: 5, x: -3.2 }], [1, { need: 3, x: 3.2 }]]) {
      const pg = new THREE.Group();
      pg.position.set(spec.x, 0, cz - 1.6);
      g.add(pg);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 1.9), dark);
      pad.position.y = 0.07; pad.receiveShadow = true;
      pg.add(pad);
      // 테두리 발광 — 채워지면 색이 바뀐다
      const ringMat = glowMat(SHRINE.glow);
      for (const [dx, dz, w, d] of [[0, 1.0, 2.1, 0.11], [0, -1.0, 2.1, 0.11], [1.0, 0, 0.11, 2.1], [-1.0, 0, 0.11, 2.1]]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, d), ringMat);
        e.position.set(dx, 0.13, dz);
        pg.add(e);
      }
      // 필요 무게 점
      for (let k = 0; k < spec.need; k++) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.13), ringMat);
        d.position.set((k % 3 - 1) * 0.28, 0.16, Math.floor(k / 3) * 0.28 - 0.14);
        pg.add(d);
      }
      this.plates.push({ need: spec.need, x: spec.x, z: cz - 1.6, boxes: [], ringMat, group: pg });
    }

    // 상자 — 바닥에 흩어 둔다. 선반을 또 만들지 않는다(신전에 이미 있다).
    this.stock = [];
    PLATE_WEIGHTS.forEach((w, i) => {
      const m = this._box(w);
      const x = -3.6 + i * 2.4, z = cz + 2.6;
      m.position.set(x, pboxSize(w) / 2, z);
      g.add(m);
      this.stock.push({ w, mesh: m, home: m.position.clone(), taken: false });
    });
    this.scene = scene;
  }

  _box(w) {
    const g = new THREE.Group();
    const s = pboxSize(w);
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), toon(0x9a7a52));
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    for (let i = 0; i < w; i++) {
      const c = i % 3, r = Math.floor(i / 3);
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.03), this.glow);
      d.position.set((c - (Math.min(3, w) - 1) / 2) * 0.15, (Math.ceil(w / 3) - 1) / 2 * 0.15 - r * 0.15, s / 2 + 0.01);
      g.add(d);
    }
    return g;
  }

  _sum(p) { return p.boxes.reduce((a, b) => a + b.w, 0); }

  _nearest(pos) {
    let best = null, bd = this.REACH;
    for (const p of this.plates) {
      const d = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (d < bd) { bd = d; best = { kind: 'plate', plate: p }; }
    }
    for (const it of this.stock) {
      if (it.taken) continue;
      const d = Math.hypot(pos.x - it.home.x, pos.z - it.home.z);
      if (d < bd) { bd = d; best = { kind: 'stock', item: it }; }
    }
    return best;
  }

  prompt(pos) {
    const n = this._nearest(pos);
    if (!n) return null;
    if (n.kind === 'stock') return this.held ? null : `E — ${n.item.w}kg 상자 들기`;
    const p = n.plate, s = this._sum(p);
    if (this.held) return `E — 판에 올리기 (${s} / ${p.need})`;
    if (p.boxes.length) return `E — 되가져오기 (${s} / ${p.need})`;
    return null;
  }

  interact(pos) {
    const n = this._nearest(pos);
    if (!n) return false;
    if (n.kind === 'stock') {
      if (this.held) return false;
      n.item.taken = true;
      this.held = n.item;
      return true;
    }
    const p = n.plate;
    if (this.held) {
      p.boxes.push(this.held);
      const k = p.boxes.length - 1;
      this.held.mesh.position.set(
        p.x + (k % 2 - 0.5) * 0.55, pboxSize(this.held.w) / 2 + Math.floor(k / 2) * 0.6, p.z + (k % 2 - 0.5) * 0.5);
      this.held = null;
      this._refresh();
      return true;
    }
    if (p.boxes.length) {
      const it = p.boxes.pop();
      this.held = it;
      this._refresh();
      return true;
    }
    return false;
  }

  // 채워지면 판 테두리가 금색이 된다. 글자 없이 "됐다"를 말한다.
  _refresh() {
    for (const p of this.plates) {
      p.ringMat.color.set(this._sum(p) === p.need ? 0xffd27a : SHRINE.glow);
    }
  }

  update(dt, actor) {
    if (this.held) {
      const h = this.held.mesh;
      h.position.copy(actor.position).addScaledVector(actor.heading, 0.55);
      h.position.y = 0.95;
    }
    return {};
  }

  solvedBy() { return this.plates.every(p => this._sum(p) === p.need); }

  reset() {
    for (const p of this.plates) { p.boxes.length = 0; }
    for (const it of this.stock) {
      it.taken = false;
      it.mesh.position.copy(it.home);
    }
    this.held = null;
    this._refresh();
  }
}
