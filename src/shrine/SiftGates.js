// 사당 03 「체의 사당」 — 과학 4-1 「혼합물의 분리」
//
// 여섯 중 유일하게 **작업장**처럼 생긴 사당이다. 모래와 황토, 공중에 먼지.
// 신전에 가까워질수록 바닥이 깨끗해진다 — 섞인 데서 갈라진 데로 가는 것이
// 이 사당의 진행이고, 그게 눈에 보여야 한다.
//
// ★ 세 관문이 전부 "들고 옮겨서 놓는다"라는 같은 동작을 쓴다. 압력판에서 이미
//   손에 익은 동작이라 새로 배울 게 없고, 아이의 머리는 **무엇을 어디에** 놓을지에만
//   쓰인다. 방마다 조작을 새로 가르치면 배울 내용이 조작에 먹힌다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';

const glowMat = (c, o = {}) => {
  const m = new THREE.MeshBasicMaterial({ color: c, ...o });
  m.userData.outlineParameters = { visible: false };
  return m;
};
const REACH = 2.6;                 // 압력판·저울과 같은 인심
const ITEM_REACH = 1.3;            // 물건은 촘촘하다. 이것만 좁게 잡는다
const PULL_R = 1.8;                // 자석이 닿는 거리. 옆 물건까지 떨리면 뭐가 쇠인지 흐려진다

// ══════════════════════════════════════════════════════════════════════════
// 관문 1 — 체 고르기
//
// 굵은 알갱이·중간·모래가 섞인 더미. 구멍이 다른 체 셋 중 하나를 틀에 끼운다.
//   구멍 큰 체  → 다 빠져 버린다
//   구멍 작은 체 → 하나도 안 빠진다
//   중간 체      → 굵은 것만 남는다  ← 정답
// 틀에 끼우면 **바로 결과가 보인다.** 설명 없이 세 번 해 보면 규칙을 안다.
// ══════════════════════════════════════════════════════════════════════════
const SIEVES = [
  { hole: 'big', label: '구멍 큰 체', mm: 8 },
  { hole: 'mid', label: '구멍 중간 체', mm: 4 },
  { hole: 'small', label: '구멍 작은 체', mm: 1 },
];
const GRAINS = [
  { size: 0.30, mm: 6, color: 0xc9a06a, name: '굵은 알갱이' },
  { size: 0.19, mm: 3, color: 0xa8823f, name: '중간 알갱이' },
  { size: 0.11, mm: 0.6, color: 0x8a6b34, name: '고운 모래' },
];
const ANSWER_SIEVE = 1;            // 굵은 것만 남기려면 중간 체

export class SieveGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.held = null;
    this.fitted = -1;
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    const dark = toon(th.stoneDark), lite = toon(th.stoneLite);

    // 틀 — 여기에 체를 끼운다. 위 접시(남은 것)와 아래 접시(빠진 것)가 함께 있다.
    this.frame = { x: cx, z: seg.z0 + 3.6 };
    const stand = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 3.2), dark);
    stand.position.set(this.frame.x, 1.5, this.frame.z);
    g.add(stand);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), dark);
      leg.position.set(this.frame.x + sx * 1.4, 0.75, this.frame.z + sz * 1.4);
      g.add(leg);
    }
    this.slotMat = glowMat(th.glowDim);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.1), this.slotMat);
    slot.position.set(this.frame.x, 1.72, this.frame.z - 1.5);
    g.add(slot);

    // 위 접시 · 아래 접시 — 알갱이가 이 둘로 갈린다. 갈리는 게 보여야 한다.
    this.above = new THREE.Group(); this.above.position.set(this.frame.x, 1.75, this.frame.z);
    this.below = new THREE.Group(); this.below.position.set(this.frame.x, 0.08, this.frame.z);
    g.add(this.above); g.add(this.below);
    this.grainMesh = [];
    for (const [gi, gr] of GRAINS.entries()) {
      for (let k = 0; k < 9; k++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(gr.size, gr.size, gr.size), toon(gr.color));
        const a = (k / 9) * Math.PI * 2 + gi;
        const r = 0.35 + (k % 3) * 0.32 + gi * 0.12;
        m.position.set(Math.cos(a) * r, gr.size / 2, Math.sin(a) * r);
        this.above.add(m);
        this.grainMesh.push({ gi, mesh: m });
      }
    }

    // 체 셋 — 선반에 나란히. 구멍 크기가 눈에 보이게 살을 다르게 뚫는다.
    this.sieves = [];
    SIEVES.forEach((sv, i) => {
      const x = cx - 3.4 + i * 3.4, z = seg.z1 - 3.0;
      const grp = new THREE.Group();
      grp.position.set(x, 1.0, z);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.11, 6, 12), lite);
      rim.rotation.x = Math.PI / 2;
      grp.add(rim);
      const bars = Math.max(2, Math.round(9 - sv.mm));       // 구멍이 작을수록 살이 촘촘
      for (let k = 0; k < bars; k++) {
        const t = (k + 0.5) / bars * 1.5 - 0.75;
        for (const rot of [0, Math.PI / 2]) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.05), lite);
          b.position.set(rot ? t : 0, 0, rot ? 0 : t);
          b.rotation.y = rot;
          grp.add(b);
        }
      }
      g.add(grp);
      this.sieves.push({ i, x, z, home: new THREE.Vector3(x, 1.0, z), grp, spec: sv });
    });

    this._apply();
  }

  // 지금 끼운 체로 무엇이 남고 무엇이 빠지는가. 알갱이가 체 구멍보다 크면 남는다.
  _apply() {
    const sv = this.fitted >= 0 ? SIEVES[this.fitted] : null;
    for (const gm of this.grainMesh) {
      const gr = GRAINS[gm.gi];
      const stays = !sv || gr.mm > sv.mm;
      const parent = stays ? this.above : this.below;
      if (gm.mesh.parent !== parent) parent.add(gm.mesh);
    }
    // 정답 = 위 접시에 굵은 것만 남았다
    const up = new Set(this.grainMesh.filter((m) => m.mesh.parent === this.above).map((m) => m.gi));
    this.solved = up.size === 1 && up.has(0);
    this.slotMat.color.set(this.solved ? 0xffd27a : 0x9c6f2c);
  }

  _nearSieve(pos) {
    let best = null, bd = REACH;
    for (const s of this.sieves) {
      if (this.held === s) continue;
      const d = Math.hypot(pos.x - s.x, pos.z - s.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  _atFrame(pos) { return Math.hypot(pos.x - this.frame.x, pos.z - this.frame.z) < REACH + 0.4; }

  update(dt, actor) {
    if (this.held) {
      this.held.grp.position.set(
        actor.position.x + actor.heading.x * 0.7, 1.15, actor.position.z + actor.heading.z * 0.7);
      this.held.grp.rotation.y = Math.atan2(actor.heading.x, actor.heading.z);
    }
    return {};
  }

  prompt(pos) {
    if (this.solved) return null;
    if (this.held) {
      return this._atFrame(pos)
        ? `E — ${this.held.spec.label} 끼우기` : `${this.held.spec.label}를 들었어요 — 틀로`;
    }
    if (this._atFrame(pos) && this.fitted >= 0) return 'E — 체 빼기 (다른 체로 해 봐요)';
    const s = this._nearSieve(pos);
    if (s) return `E — ${s.spec.label} 들기`;
    return '🧺 굵은 알갱이만 남기는 체를 골라요';
  }

  interact(pos) {
    if (this.held) {
      if (!this._atFrame(pos)) return false;
      if (this.fitted >= 0) return false;                    // 먼저 빼야 한다
      this.fitted = this.held.i;
      this.held.grp.position.set(this.frame.x, 1.75, this.frame.z);
      this.held.grp.rotation.y = 0;
      this.held = null;
      this._apply();
      return true;
    }
    if (this._atFrame(pos) && this.fitted >= 0) {
      const s = this.sieves[this.fitted];
      this.fitted = -1;
      this.held = s;
      this._apply();
      return true;
    }
    const s = this._nearSieve(pos);
    if (!s) return false;
    this.held = s;
    return true;
  }

  solvedBy() { return this.solved; }
  restart() {
    this.held = null; this.fitted = -1;
    for (const s of this.sieves) { s.grp.position.copy(s.home); s.grp.rotation.y = 0; }
    this._apply();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 2 — 자석에 붙는 것
//
// ★ 물건 여섯이 **똑같이 생겼다.** 그래서 눈으로는 못 고르고 반드시 자석을 대 봐야 한다.
//   겉모습으로 알 수 있으면 그건 분류가 아니라 기억이다. 예측 → 검사 → 분류,
//   이 세 걸음이 이 방의 전부다.
// 붙는 것 셋과 안 붙는 것 셋을 각자의 통에 넣으면 문이 열린다.
// ══════════════════════════════════════════════════════════════════════════
const ITEMS = [
  { iron: true, name: '못' }, { iron: false, name: '나무 조각' },
  { iron: true, name: '쇠구슬' }, { iron: false, name: '유리 구슬' },
  { iron: true, name: '클립' }, { iron: false, name: '고무 마개' },
];

export class MagnetGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.held = null;
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    const dark = toon(th.stoneDark), lite = toon(th.stoneLite);

    // 통 둘 — 붙는 것 / 안 붙는 것. 색으로 가른다.
    const bin = (x, z, c, iron) => {
      const grp = new THREE.Group();
      grp.position.set(x, 0, z);
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 2.4), dark);
      b.position.y = 0.55; grp.add(b);
      const ringMat = glowMat(c);
      for (const [dx, dz, w, d] of [[0, 1.25, 2.6, 0.12], [0, -1.25, 2.6, 0.12],
        [1.25, 0, 0.12, 2.6], [-1.25, 0, 0.12, 2.6]]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), ringMat);
        e.position.set(dx, 1.15, dz); grp.add(e);
      }
      g.add(grp);
      return { x, z, iron, ringMat, got: [] };
    };
    this.bins = [
      bin(cx - 3.6, seg.z0 + 3.0, th.glow, true),      // 붙는 것
      bin(cx + 3.6, seg.z0 + 3.0, 0x8a8b90, false),    // 안 붙는 것
    ];

    // 물건 여섯 — 전부 같은 회색 덩어리다. 겉으로는 구별이 안 된다.
    const same = toon(0x9a938a);
    this.items = [];
    // ★ 처음엔 3×2로 놓았는데 줄 간격(2.6)이 집는 거리(2.6)와 같아서
    //   앞줄 물건 앞에 서면 **뒷줄이 먼저 잡혔다.** 자석을 댄 물건과 집히는 물건이
    //   다르니 "쇠인데 반응이 없다"로 보인다. 한 줄로 편다.
    ITEMS.forEach((it, i) => {
      const x = cx - 5.5 + i * 2.2, z = seg.z1 - 3.0;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), same);
      m.position.set(x, 0.31, z);
      m.castShadow = true;
      g.add(m);
      this.items.push({ ...it, mesh: m, home: m.position.clone(), x, z, bin: null, jig: 0 });
    });

    // 자석 — 늘 손에 들고 있다. 물건에 가까이 가면 붙는 것만 흔들린다.
    const mag = new THREE.Group();
    const u = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 6, 10, Math.PI), glowMat(0xe0736b));
    mag.add(u);
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.22), glowMat(0xdfe3e6));
    p1.position.set(-0.3, -0.15, 0); mag.add(p1);
    const p2 = p1.clone(); p2.position.x = 0.3; mag.add(p2);
    g.add(mag);
    this.magnet = mag;
    this.solved = false;
  }

  _near(pos) {
    let best = null, bd = REACH;
    // 물건은 촘촘히 놓여 있으므로 집는 거리를 따로 좁게 잡는다.
    // 통은 멀리 떨어져 있어 넉넉해도 헷갈리지 않는다.
    let ib = ITEM_REACH;
    for (const it of this.items) {
      if (it.bin || it === this.held) continue;
      const d = Math.hypot(pos.x - it.x, pos.z - it.z);
      if (d < ib) { ib = d; bd = d; best = { kind: 'item', item: it }; }
    }
    for (const b of this.bins) {
      const d = Math.hypot(pos.x - b.x, pos.z - b.z);
      if (d < bd) { bd = d; best = { kind: 'bin', bin: b }; }
    }
    return best;
  }

  _check() {
    this.solved = this.items.every((it) => it.bin && it.bin.iron === it.iron);
    for (const b of this.bins) {
      const wrong = b.got.some((it) => it.iron !== b.iron);
      b.ringMat.color.set(wrong ? 0xe0736b : (b.iron ? 0x6fe3d2 : 0x8a8b90));
    }
  }

  update(dt, actor) {
    const p = actor.position;
    this.magnet.position.set(p.x + actor.heading.x * 0.6, 1.0, p.z + actor.heading.z * 0.6);
    this.magnet.rotation.y = Math.atan2(actor.heading.x, actor.heading.z);

    // 자석에 붙는 물건만 떨린다 — 이게 이 방의 유일한 정보다.
    for (const it of this.items) {
      if (it.bin || it === this.held) continue;
      const d = Math.hypot(p.x - it.x, p.z - it.z);
      const pull = it.iron && d < PULL_R ? (1 - d / PULL_R) : 0;
      it.jig += dt * 22;
      it.mesh.position.x = it.x + Math.sin(it.jig) * 0.06 * pull;
      it.mesh.position.y = 0.31 + Math.abs(Math.sin(it.jig * 0.7)) * 0.14 * pull;
      it.mesh.rotation.z = Math.sin(it.jig * 0.5) * 0.2 * pull;
    }
    if (this.held) {
      this.held.mesh.position.set(p.x + actor.heading.x * 0.75, 0.95, p.z + actor.heading.z * 0.75);
    }
    return {};
  }

  prompt(pos) {
    if (this.solved) return null;
    const n = this._near(pos);
    if (this.held) {
      if (n && n.kind === 'bin') return `E — ${n.bin.iron ? '붙는 것' : '안 붙는 것'} 통에 넣기`;
      return '들고 있어요 — 통에 넣어요';
    }
    if (n && n.kind === 'item') {
      const felt = n.item.iron ? '자석이 당겨요!' : '자석이 반응 안 해요';
      return `E — 들기 · ${felt}`;
    }
    if (n && n.kind === 'bin' && n.bin.got.length) return 'E — 통에서 되꺼내기';
    return '🧲 자석을 대 보고 두 통에 나눠 담아요';
  }

  interact(pos) {
    const n = this._near(pos);
    if (this.held) {
      if (!n || n.kind !== 'bin') return false;
      const b = n.bin;
      this.held.bin = b;
      b.got.push(this.held);
      const k = b.got.length - 1;
      this.held.mesh.position.set(b.x + (k % 2 - 0.5) * 0.7, 1.35 + Math.floor(k / 2) * 0.7,
        b.z + (k % 2 - 0.5) * 0.6);
      this.held = null;
      this._check();
      return true;
    }
    if (!n) return false;
    if (n.kind === 'item') { this.held = n.item; return true; }
    if (n.bin.got.length) {                                  // 되꺼내기 — 막다른 길을 만들지 않는다
      const it = n.bin.got.pop();
      it.bin = null;
      this.held = it;
      this._check();
      return true;
    }
    return false;
  }

  solvedBy() { return this.solved; }
  restart() {
    this.held = null;
    for (const b of this.bins) b.got.length = 0;
    for (const it of this.items) { it.bin = null; it.mesh.position.copy(it.home); it.mesh.rotation.set(0, 0, 0); }
    this._check();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 3 — 거름과 증발
//
// 소금·모래·물이 섞인 물통 하나. **순서**가 있다.
//   거름망 먼저 → 모래가 걸러진다 → 화로 → 물이 날아가고 소금이 남는다  ← 정답
//   화로 먼저   → 모래와 소금이 함께 굳는다 → 물을 다시 부어 처음부터
// 순서를 틀려도 벌은 없다. 물을 다시 부으면 된다 — 실험은 다시 하는 것이다.
// ══════════════════════════════════════════════════════════════════════════
export class EvaporateGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.state = 'mixed';           // mixed → filtered → salt | lump
    this.held = false;
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    const dark = toon(th.stoneDark), lite = toon(th.stoneLite);

    // 물통 — 들고 다니는 물건. 안의 색이 상태를 말한다.
    const pot = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.38, 0.62, 8), lite);
    body.position.y = 0.31; pot.add(body);
    this.fluidMat = toon(0x8a7a52);
    this.fluid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.12, 8), this.fluidMat);
    this.fluid.position.y = 0.56; pot.add(this.fluid);
    g.add(pot);
    this.pot = pot;
    this.potHome = new THREE.Vector3(cx, 0, seg.z1 - 2.6);
    pot.position.copy(this.potHome);

    // 거름망 · 화로 · 물꼭지
    const station = (x, z, c, h) => {
      const grp = new THREE.Group();
      grp.position.set(x, 0, z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, h, 8), dark);
      base.position.y = h / 2; grp.add(base);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 8), glowMat(c));
      top.position.y = h + 0.06; grp.add(top);
      g.add(grp);
      return { x, z, mat: top.material };
    };
    this.filter = station(cx - 3.6, seg.z0 + 3.4, 0x79c0e8, 1.1);
    this.burner = station(cx + 3.6, seg.z0 + 3.4, 0xe8664a, 1.0);
    this.tap = station(cx, seg.z1 - 2.6, 0x9ab4c2, 0.8);

    this._paint();
  }

  _paint() {
    const c = { mixed: 0x8a7a52, filtered: 0x9fb6c4, salt: 0xf0ece0, lump: 0x5d5347 }[this.state];
    this.fluidMat.color.set(c);
    this.fluid.scale.y = this.state === 'salt' || this.state === 'lump' ? 0.5 : 1;
  }

  _near(pos) {
    const d = (s) => Math.hypot(pos.x - s.x, pos.z - s.z);
    if (d(this.filter) < REACH) return 'filter';
    if (d(this.burner) < REACH) return 'burner';
    if (d(this.tap) < REACH) return 'tap';
    return null;
  }
  _atPot(pos) {
    return Math.hypot(pos.x - this.pot.position.x, pos.z - this.pot.position.z) < REACH;
  }

  update(dt, actor) {
    if (this.held) {
      this.pot.position.set(actor.position.x + actor.heading.x * 0.7, 0.85,
        actor.position.z + actor.heading.z * 0.7);
    }
    return {};
  }

  prompt(pos) {
    if (this.state === 'salt') return null;
    if (!this.held) {
      if (this.state === 'lump' && this._near(pos) === 'tap') return 'E — 물 붓고 처음부터';
      return this._atPot(pos) ? 'E — 물통 들기' : '🫙 물통을 들고 거름망·화로로';
    }
    const n = this._near(pos);
    if (n === 'filter') return 'E — 거름망에 붓기';
    if (n === 'burner') return 'E — 화로에 올리기';
    if (n === 'tap') return this.state === 'lump' ? 'E — 물 붓고 처음부터' : 'E — 내려놓기';
    const what = { mixed: '소금·모래·물이 섞여 있어요', filtered: '모래는 걸렀어요 — 이제 물을 날려요',
      lump: '모래까지 굳었어요 — 물을 부어 처음부터' }[this.state];
    return `${what}`;
  }

  interact(pos) {
    if (!this.held) {
      if (this.state === 'lump' && this._near(pos) === 'tap') { this.state = 'mixed'; this._paint(); return true; }
      if (!this._atPot(pos)) return false;
      this.held = true;
      return true;
    }
    const n = this._near(pos);
    if (n === 'filter') {
      // 거름망 — 알갱이(모래)만 걸린다. 녹아 있는 소금은 물과 함께 빠져나간다.
      if (this.state === 'mixed') this.state = 'filtered';
      this._paint();
      return true;
    }
    if (n === 'burner') {
      // 화로 — 물이 날아간다. 모래가 아직 있으면 소금과 함께 굳어 버린다.
      this.state = this.state === 'filtered' ? 'salt' : 'lump';
      this._paint();
      if (this.state === 'salt') { this.held = false; this.pot.position.copy(this.potHome); }
      return true;
    }
    if (n === 'tap') {
      if (this.state === 'lump') this.state = 'mixed';
      this.held = false;
      this.pot.position.copy(this.potHome);
      this._paint();
      return true;
    }
    return false;
  }

  solvedBy() { return this.state === 'salt'; }
  restart() {
    this.state = 'mixed'; this.held = false;
    this.pot.position.copy(this.potHome);
    this._paint();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 신전 — 체를 든 신
//
// 관문 셋을 다시 시키지 않는다. 여기서 묻는 것은 **무엇으로 가르는가**이다.
// 섞인 것 셋이 놓여 있고 도구가 셋 있다. 짝을 맞추면 된다.
//   쇠구슬 + 모래  → 자석
//   소금 + 물      → 화로(증발)
//   콩 + 좁쌀      → 체
// 4-1 단원 전체의 요약이고, 몸이 아니라 머리로 푸는 자리다.
// ══════════════════════════════════════════════════════════════════════════
const PAIRS = [
  { mix: '쇠구슬과 모래', tool: 'magnet', toolName: '자석' },
  { mix: '소금물', tool: 'burner', toolName: '화로' },
  { mix: '콩과 좁쌀', tool: 'sieve', toolName: '체' },
];

export class SiftGod {
  constructor(scene, seg, theme) {
    this.REACH = 2.6;
    this.held = null;
    const cx = (seg.x0 + seg.x1) / 2;
    this.gz = seg.z0 + (seg.z1 - seg.z0) * 0.28;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    const stone = toon(theme.stoneLite), dark = toon(theme.stoneDark);

    // 신 — 체를 든 형상. 위가 넓은 원반이 얹혀 있어 실루엣이 다른 사당과 갈린다.
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 0.6, 8), dark);
    base.position.set(cx, 0.3, this.gz); g.add(base);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 3.6, 8), stone);
    body.position.set(cx, 2.4, this.gz); body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), stone);
    head.position.set(cx, 4.6, this.gz); g.add(head);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.16, 14), glowMat(theme.glow));
    disc.position.set(cx, 5.5, this.gz); g.add(disc);

    // 섞인 것 셋 — 신 앞에 나란히
    this.mixes = PAIRS.map((p, i) => {
      const x = cx - 4.0 + i * 4.0, z = this.gz + 3.6;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 1.0, 8), dark);
      ped.position.set(x, 0.5, z); g.add(ped);
      const mat = glowMat(theme.glowDim);
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      bowl.rotation.x = Math.PI; bowl.position.set(x, 1.2, z); g.add(bowl);
      return { ...p, x, z, mat, tooled: null };
    });

    // 도구 셋 — 반대편에
    this.tools = [
      { id: 'sieve', name: '체', c: 0xc9a06a },
      { id: 'magnet', name: '자석', c: 0xe0736b },
      { id: 'burner', name: '화로', c: 0xe8a04a },
    ].map((t, i) => {
      const x = cx - 4.0 + i * 4.0, z = this.gz + 7.4;
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), glowMat(t.c));
      m.position.set(x, 1.0, z);
      g.add(m);
      return { ...t, mesh: m, home: m.position.clone(), x, z, used: false };
    });

    this.obstacles = [{ x: cx, z: this.gz, r: 2.2 }];
    this.prizePos = new THREE.Vector3(cx, 0, this.gz + 10.4);
    this.solved = false;
  }

  _near(pos) {
    let best = null, bd = this.REACH;
    for (const t of this.tools) {
      if (t.used || t === this.held) continue;
      const d = Math.hypot(pos.x - t.x, pos.z - t.z);
      if (d < bd) { bd = d; best = { kind: 'tool', tool: t }; }
    }
    for (const m of this.mixes) {
      const d = Math.hypot(pos.x - m.x, pos.z - m.z);
      if (d < bd) { bd = d; best = { kind: 'mix', mix: m }; }
    }
    return best;
  }

  _check() {
    this.solved = this.mixes.every((m) => m.tooled === m.tool);
    for (const m of this.mixes) {
      m.mat.color.set(!m.tooled ? 0x9c6f2c : (m.tooled === m.tool ? 0xffd27a : 0xe0736b));
    }
  }

  update(dt, actor) {
    if (this.held) {
      this.held.mesh.position.set(actor.position.x + actor.heading.x * 0.65, 1.15,
        actor.position.z + actor.heading.z * 0.65);
      this.held.mesh.rotation.y += dt * 2;
    }
    return {};
  }

  prompt(pos) {
    if (this.solved) return null;
    const n = this._near(pos);
    if (this.held) {
      if (n && n.kind === 'mix') return `E — ${n.mix.mix}에 ${this.held.name} 쓰기`;
      return `${this.held.name}를 들었어요 — 섞인 것에 가져가요`;
    }
    if (n && n.kind === 'tool') return `E — ${n.tool.name} 들기`;
    if (n && n.kind === 'mix') {
      return n.mix.tooled ? `E — ${n.mix.mix}에서 도구 되가져오기` : `${n.mix.mix} — 무엇으로 가를까요?`;
    }
    return '⚖ 섞인 것마다 알맞은 도구를 골라요';
  }

  interact(pos) {
    const n = this._near(pos);
    if (!n) return false;
    if (this.held) {
      if (n.kind !== 'mix' || n.mix.tooled) return false;
      n.mix.tooled = this.held.id;
      this.held.used = true;
      this.held.mesh.position.set(n.mix.x, 1.9, n.mix.z);
      this.held = null;
      this._check();
      return true;
    }
    if (n.kind === 'tool') { this.held = n.tool; return true; }
    if (n.mix.tooled) {                                       // 되가져오기
      const t = this.tools.find((x) => x.id === n.mix.tooled);
      n.mix.tooled = null;
      t.used = false;
      this.held = t;
      this._check();
      return true;
    }
    return false;
  }

  solvedBy() { return this.solved; }
  restart() {
    this.held = null;
    for (const m of this.mixes) m.tooled = null;
    for (const t of this.tools) { t.used = false; t.mesh.position.copy(t.home); }
    this._check();
  }
}
