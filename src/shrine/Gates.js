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
// 관문 1 — 색 발판
//
// 레퍼런스: 마리오 파티 「버섯 대소동」(1998) · 「용암 육각형」(MP2).
// 깃발이 색을 알리면 그 색 발판만 남고 나머지는 가라앉는다. 갈수록 빨라진다.
// 30년 가까이 검증된 구조라 규칙을 설명할 필요가 없다 — 한 라운드만 보면 안다.
//
// ★ 첫 판은 이렇지 않았다. 손으로 짠 고정 패턴 위를 건너는 방식이었는데
//   (1) 부활 지점이 타일 밭 **안**이라 들어서자마자 무한 실패였고
//   (2) 입구 정중앙 칸이 안전색이 아니어서 진입 자체가 막혔다(실사용 확인).
//   고정 패턴은 한 번 외우면 끝이라 재미도 짧다. 라운드제로 바꾼다.
//
// 안전 발판 규칙: 입구 발판은 **항상 안전**하다. 대신 거기 서 있으면 시계가 멈춘다 —
// 한 라운드를 안전하게 지켜보고 규칙을 익힐 수 있되, 버티기만 해서는 못 깬다.
const T_START = 3.0;      // 문이 닫히고 전부 검정. 이 동안 시계는 안 간다
const T_READY = 1.0;      // 검정. 다음 라운드 준비
const T_JUDGE = 0.9;      // 빨강이 가라앉고 판정이 난다
const SURVIVE = 20;       // 이만큼 발판 위에서 버티면 열린다
const ROPE_Y = 0.55;      // 줄 높이. 점프 최고점 0.9u라 여유를 두고 넘긴다
const ROPE_FROM = 3;      // 이 라운드부터 줄이 돈다

export class TileGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    this.entryRect = opts.entryRect || null;
    this.COLS = 5; this.ROWS = 5;
    // 격자는 방 전체가 아니다. 앞뒤로 안전 발판을 남긴다.
    this.z1 = seg.z1 - 2.5;              // 입구 쪽(큰 z)
    this.z0 = seg.z0 + 2.5;              // 출구 쪽
    this.TW = (seg.x1 - seg.x0) / this.COLS;
    this.TD = (this.z1 - this.z0) / this.ROWS;

    this.matSafe = glowMat(0x5fd08a);
    this.matBad = glowMat(0xe0736b);
    // 쉬는 색이 한 가지면 통짜 바닥으로 보인다. 두 톤을 번갈아 두면 그 자체로 바둑판이 되고,
    // 색이 꺼져 있는 동안에도 "칸이 있다"가 읽힌다.
    this.matIdle = [glowMat(0x39434f), glowMat(0x232a33)];

    this.phase = 'ready'; this.t = T_READY; this.round = 0;
    this.left = SURVIVE; this.cleared = false; this.locked = false;
    this.safe = new Set();

    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    this.tiles = [];
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(this.TW - 0.14, 0.22, this.TD - 0.14), this.matIdle[(r + c) % 2]);
        m.position.set(seg.x0 + (c + 0.5) * this.TW, 0.11, this.z0 + (r + 0.5) * this.TD);
        m.receiveShadow = true;
        g.add(m);
        this.tiles.push({ r, c, mesh: m, baseY: 0.11, idle: this.matIdle[(r + c) % 2] });
      }
    }

    // 입구를 막는 문 — "들어오면 닫힌다". 이게 긴장을 만든다.
    // 벌은 없지만 되돌아 나갈 수는 없다. 20초만 버티면 되니 갇혀도 무섭지 않다.
    const bm = new THREE.MeshBasicMaterial({ color: 0x5fd08a, transparent: true, opacity: 0.75 });
    bm.userData.outlineParameters = { visible: false };
    this.barrier = new THREE.Mesh(new THREE.BoxGeometry(seg.x1 - seg.x0, 3.4, 0.22), bm);
    this.barrier.position.set(0, 1.7, seg.z1 - 0.15);
    this.barrier.visible = false;
    scene.add(this.barrier);

    // 색 표지 — 지금 어느 색이 안전한지 알리는 판. 마리오 파티의 깃발 역할.
    const sm = glowMat(0x2f3841);
    this.flag = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.2), sm);
    this.flag.position.set(0, 2.6, seg.z0 - 0.2);
    scene.add(this.flag);
    this.flagMat = sm;

    // ── 불줄넘기 ──────────────────────────────────────────────────────────
    // 레퍼런스: 마리오 파티 「불줄넘기(Hot Rope Jump)」 — 가운데 기둥에 매인 줄이
    // 바닥을 쓸며 돌고, 올 때마다 뛰어넘는다. 갈수록 빨라진다.
    // 색 기억(머리)만 있으면 방이 조용하다. 줄이 몸을 얹어 리듬을 만든다.
    // 3라운드부터 나온다 — 규칙 둘을 동시에 배우게 하지 않는다.
    // 벽을 뚫지 않는 최대 길이. 모서리까지는 안 닿지만 그래도 된다 —
    // 어차피 색 규칙이 아이를 가운데로 계속 불러낸다.
    this.ropeR = Math.min(seg.x1 - seg.x0, this.z1 - this.z0) * 0.5 - 0.1;
    this.ropeCX = (seg.x0 + seg.x1) / 2;
    this.ropeCZ = (this.z0 + this.z1) / 2;
    this.ropeA = 0;
    const rope = new THREE.Group();
    rope.position.set(this.ropeCX, 0, this.ropeCZ);
    const rm = glowMat(0xf0a860, { transparent: true, opacity: 0.9 });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, this.ropeR * 2, 6), rm);
    bar.rotation.z = Math.PI / 2;                 // 눕혀서 지름이 되게
    bar.position.y = ROPE_Y;
    rope.add(bar);
    // 기둥 — 줄이 어디에 매여 도는지 안 보이면 그냥 튀어나온 막대로 읽힌다
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 6), toon(SHRINE.stoneLite));
    post.position.y = 1.2;
    rope.add(post);
    rope.visible = false;
    scene.add(rope);
    this.rope = rope;
  }

  // 줄이 도는 중인가. 라운드가 오를수록 빨라진다.
  _ropeSpeed() { return Math.min(2.3, 1.05 + (this.round - ROPE_FROM) * 0.13); }
  _ropeOn() { return this.round >= ROPE_FROM && !this.cleared; }

  // 줄에 걸렸는가. 줄은 중심을 지나는 **선분**이라 중심에서의 수직거리로 본다.
  _ropeHit(p) {
    if (!this._ropeOn()) return false;
    if (p.y > ROPE_Y + 0.12) return false;        // 뛰어서 넘고 있다
    const dx = p.x - this.ropeCX, dz = p.z - this.ropeCZ;
    if (dx * dx + dz * dz > this.ropeR * this.ropeR) return false;
    // |rel × 줄방향| = 줄에서 떨어진 거리
    return Math.abs(dx * Math.sin(this.ropeA) - dz * Math.cos(this.ropeA)) < 0.34;
  }

  _cell(p) {
    if (p.z < this.z0 || p.z > this.z1) return null;
    const c = Math.floor((p.x - this.seg.x0) / this.TW);
    const r = Math.floor((p.z - this.z0) / this.TD);
    if (c < 0 || c >= this.COLS || r < 0 || r >= this.ROWS) return null;
    return r * this.COLS + c;
  }

  // 안전 칸을 새로 뽑는다. 라운드가 갈수록 줄지만 최소 6칸은 남긴다 —
  // 너무 적으면 운이 되고, 운으로 지면 아이는 배우지 못한다.
  _roll() {
    this.round++;
    const frac = Math.max(0.30, 0.60 - this.round * 0.045);
    const n = Math.max(6, Math.round(this.COLS * this.ROWS * frac));
    const idx = [...Array(this.COLS * this.ROWS).keys()];
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    this.safe = new Set(idx.slice(0, n));
  }

  _paint(mode) {
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      t.mesh.material = mode === 'idle' ? t.idle
        : (this.safe.has(i) ? this.matSafe : this.matBad);
      // 판정 중에는 위험 칸이 가라앉는다. 색만 바꾸면 "왜 죽었는지"가 안 보인다.
      const sink = (mode === 'judge' && !this.safe.has(i)) ? -0.55 : 0;
      t.mesh.position.y = t.baseY + sink;
    }
    this.flagMat.color.set(mode === 'idle' ? 0x2f3841 : 0x5fd08a);
  }

  update(dt, actor) {
    if (this.cleared) return {};
    const p = actor.position;
    const onGrid = this._cell(p) !== null;

    // 방에 발을 들이면 잠긴다
    if (!this.locked && p.z < this.seg.z1 - 0.6) {
      this.locked = true;
      this.barrier.visible = true;
      if (this.entryRect) this.entryRect.open = false;
      // 문이 닫히면 검정 3초. 규칙을 읽을 틈을 주고 그다음 시작한다.
      this.phase = 'ready'; this.t = T_START;
      this._paint('idle');
    }
    if (!this.locked) return {};

    // 줄넘기 — 색 판정과 별개로 매 프레임 돈다.
    this.rope.visible = this._ropeOn();
    if (this._ropeOn()) {
      this.ropeA += dt * this._ropeSpeed();
      this.rope.rotation.y = -this.ropeA;
      if (onGrid && this._ropeHit(p)) {
        this.reset();
        return { fail: '줄에 걸렸어요 — 올 때 뛰어넘어요' };
      }
    }

    // 시계는 **발판 위에 있을 때만** 간다. 입구 발판에서 지켜보는 건 공짜지만 진도는 안 나간다.
    // 첫 라운드가 뜨기 전(round 0)에는 안 간다 — 카운트다운은 생존 시간이 아니다.
    if (onGrid && this.round > 0) this.left = Math.max(0, this.left - dt);

    this.t -= dt;
    if (this.t <= 0) {
      if (this.phase === 'ready') {
        this._roll();
        this.phase = 'show';
        // 보여 주는 시간이 곧 난이도다. 2.6초에서 1.2초까지 줄어든다.
        this.t = Math.max(1.2, 2.6 - this.round * 0.16);
        this._paint('show');
      } else if (this.phase === 'show') {
        this.phase = 'judge'; this.t = T_JUDGE;
        this._paint('judge');
        const cell = this._cell(p);
        if (cell !== null && !this.safe.has(cell)) {
          this.reset();
          return { fail: '빨간 발판이 가라앉았어요' };
        }
      } else {
        this.phase = 'ready'; this.t = T_READY;
        this._paint('idle');
      }
    }

    if (this.left <= 0 && !this.cleared) {
      this.cleared = true;
      this.rope.visible = false;
      this.barrier.visible = false;
      if (this.entryRect) this.entryRect.open = true;
      this._paint('idle');
    }
    return {};
  }

  prompt() {
    if (this.cleared) return null;
    if (!this.locked) return '들어가면 문이 닫혀요 — 20초 버티기';
    if (this.round === 0) return `⬛ ${Math.max(1, Math.ceil(this.t))}… 곧 시작해요`;
    const rope = this._ropeOn() ? ' · 줄은 뛰어넘기' : '';
    if (this.phase === 'show') return `🟩 초록 발판으로!${rope} · ${Math.ceil(this.left)}초`;
    if (this.phase === 'judge') return `🟥 가라앉는 중${rope} · ${Math.ceil(this.left)}초`;
    return `준비… · ${Math.ceil(this.left)}초`;
  }

  // 실패해도 방에서 쫓아내지 않는다. 시계만 되돌린다.
  reset() {
    this.left = SURVIVE; this.round = 0;
    this.phase = 'ready'; this.t = T_READY;
    this.ropeA = 0; this.rope.visible = false;
    this._paint('idle');
  }

  solvedBy() { return this.cleared; }
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
