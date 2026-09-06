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
import { godEyes } from './GodEyes.js';
import { toon } from '../render/Toon.js';
import { shuffle } from '../util/rand.js';
import { josa } from '../util/josa.js';

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
// ★ 처음엔 한 번 고르면 끝이었다. E 두 번이면 방이 끝났고, 세 개 중 하나를
//   찍어도 3분의 1로 맞았다. 실사용에서 들은 그대로다 —
//   "이렇게 하나의 기믹이 원터치 또는 단 한 번이면 누가 하고 싶겠나."
//   **주문이 세 번 온다.** 남겨야 할 것이 매번 달라지므로 찍어서는 못 넘긴다.
//     1) 굵은 것만 남겨라        → 구멍 중간 체
//     2) 굵은 것과 중간을 남겨라  → 구멍 작은 체
//     3) 하나도 남기지 마라       → 구멍 큰 체
//   세 주문이 체 셋을 정확히 한 번씩 쓰게 되어 있어, 다 풀고 나면
//   "구멍이 클수록 많이 빠진다"가 손에 남는다.
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
// 주문 셋. keep = 위 접시에 남아야 할 알갱이 종류
// ★ 셋 다 체 하나로 풀렸다 — 3택1이라 찍어도 평균 두 번이면 넘었다(비평).
//   체질에는 산물이 **둘**이다. 남는 것과 빠지는 것. 단원이 가르치는 게 그거다.
//   셋째 주문 "중간만"은 체 하나로는 **절대** 안 된다(체는 큰 것부터 남긴다).
//   큰 체로 굵은 것을 걸러 내고, **아래 접시에 빠진 것을 다시 올려** 중간 체로
//   거른다 — 두 단계. 이 방에서 처음으로 "빠진 것도 재료다"를 손으로 알게 된다.
const ORDERS = [
  { keep: [0], say: '굵은 알갱이만 남겨라', steps: 1 },
  { keep: [0, 1], say: '굵은 것과 중간을 남겨라', steps: 1 },
  { keep: [1], say: '중간 알갱이만 남겨라', steps: 2 },
];

export class SieveGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.held = null;
    this.fitted = -1;
    this.round = 0;             // 지금 주문
    this.solved = false;
    this.mix = new Set([0, 1, 2]);   // 지금 위에 부어 둔 알갱이 — 아래 접시를 올리면 줄어든다
    // 주문 순서를 섞는다. 늘 "굵은 것만"으로 시작하면 첫 수는 외워진다.
    this.orders = shuffle(ORDERS);
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

    // 주문판 — 남겨야 할 알갱이를 그 알갱이 색 점으로 보여 준다.
    // 글씨 없이 "무엇을 남길 것인가"가 읽혀야 아이가 체를 고를 수 있다.
    const boardMat = toon(th.stoneDark);
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.16), boardMat);
    board.position.set(this.frame.x, 3.1, this.frame.z - 1.7);
    g.add(board);
    this.orderDots = GRAINS.map((gr, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.1), glowMat(gr.color));
      m.position.set(this.frame.x - 0.8 + i * 0.8, 3.1, this.frame.z - 1.79);
      g.add(m);
      return m;
    });
    // 라운드 표시 — 세 번이라는 걸 처음부터 알려 준다
    this.pips = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.1), glowMat(0x4a3a22));
      m.position.set(this.frame.x + 1.55, 3.35 - i * 0.28, this.frame.z - 1.79);
      g.add(m);
      return m;
    });

    // 위 접시 · 아래 접시 — 알갱이가 이 둘로 갈린다. 갈리는 게 보여야 한다.
    this.above = new THREE.Group(); this.above.position.set(this.frame.x, 1.75, this.frame.z);
    // ★ 아래 접시는 틀 **앞**에 제 자리를 갖는다. 틀과 같은 자리에 두면 "체 빼기"와
    //   "아래 접시 올리기"가 한 자리에 겹쳐 메뉴가 된다(조작은 하나로 — 자리로 고른다).
    this.tray = { x: cx, z: seg.z0 + 6.2 };
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.14, 10), dark);
    tray.position.set(this.tray.x, 0.07, this.tray.z); g.add(tray);
    this.trayMat = glowMat(th.glowDim);
    const trayRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 5, 18), this.trayMat);
    trayRing.rotation.x = -Math.PI / 2; trayRing.position.set(this.tray.x, 0.15, this.tray.z); g.add(trayRing);
    this.below = new THREE.Group(); this.below.position.set(this.tray.x, 0.14, this.tray.z);
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
    // 체가 놓인 자리도 섞는다. 자리가 고정이면 "왼쪽 것"으로 외워진다.
    shuffle(SIEVES.map((sv, i) => i)).forEach((si, i) => {
      const sv = SIEVES[si];
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
      this.sieves.push({ i: si, x, z, home: new THREE.Vector3(x, 1.0, z), grp, spec: sv });
    });

    this._apply();
  }

  // 지금 끼운 체로 무엇이 남고 무엇이 빠지는가. 알갱이가 체 구멍보다 크면 남는다.
  // 지금 체로 위에 남는 알갱이 종류(mix 안에서)
  _aboveSet(sv, mix = this.mix) {
    return new Set([...mix].filter((gi) => !sv || GRAINS[gi].mm > sv.mm));
  }
  _apply() {
    const sv = this.fitted >= 0 ? this.sieves[this.fitted].spec : null;
    const upSet = this._aboveSet(sv);
    for (const gm of this.grainMesh) {
      const inMix = this.mix.has(gm.gi);
      gm.mesh.visible = inMix;                       // 부어 두지 않은 것은 없다
      const parent = inMix && upSet.has(gm.gi) ? this.above : this.below;
      if (gm.mesh.parent !== parent) parent.add(gm.mesh);
    }
    const belowN = [...this.mix].filter((gi) => !upSet.has(gi)).length;
    this.trayMat.color.set(sv && belowN ? 0xe0a955 : 0x9c6f2c);
    this._paintOrder();
    if (this.solved || this.fitted < 0) {
      this.slotMat.color.set(this.solved ? 0xffd27a : 0x9c6f2c);
      return;
    }
    // 이번 주문대로 갈렸는가
    const up = new Set(this.grainMesh.filter((m) => m.mesh.parent === this.above).map((m) => m.gi));
    const want = this.orders[this.round].keep;
    const ok = up.size === want.length && want.every((i) => up.has(i));
    this.slotMat.color.set(ok ? 0xffd27a : 0x9c6f2c);
    if (!ok) return;
    // 맞았다 — 체를 도로 내주고 다음 주문으로. 같은 체로 다음도 되면 배우는 게 없다.
    this.pips[this.round].material.color.set(0xffd27a);
    this.round++;
    if (this.round >= this.orders.length) { this.solved = true; return; }
    const s = this.sieves[this.fitted];
    this.fitted = -1;
    s.grp.position.copy(s.home);
    this.mix = new Set([0, 1, 2]);                   // 다음 주문은 다시 다 부어 놓고
    this._apply();
  }

  // 주문 하나를 푸는 데 체질이 몇 번 필요한가(검사용). 1·2·불가(0).
  minSteps(order) {
    const want = new Set(order.keep);
    const same = (a) => a.size === want.size && [...want].every((x) => a.has(x));
    const all = new Set([0, 1, 2]);
    for (const sv of SIEVES) if (same(this._aboveSet(sv, all))) return 1;
    for (const a of SIEVES) {
      const below = new Set([...all].filter((gi) => !this._aboveSet(a, all).has(gi)));
      if (!below.size) continue;
      for (const b of SIEVES) if (same(this._aboveSet(b, below))) return 2;
    }
    return 0;
  }

  _paintOrder() {
    if (this.solved) { for (const d of this.orderDots) d.material.color.set(0xffd27a); return; }
    const want = this.orders[this.round].keep;
    this.orderDots.forEach((d, i) => d.material.color.set(want.includes(i) ? GRAINS[i].color : 0x2a2018));
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
  _atTray(pos) { return Math.hypot(pos.x - this.tray.x, pos.z - this.tray.z) < 1.4; }
  _belowSet() {
    const sv = this.fitted >= 0 ? this.sieves[this.fitted].spec : null;
    const up = this._aboveSet(sv);
    return new Set([...this.mix].filter((gi) => !up.has(gi)));
  }

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
    const say = `주문 ${this.round + 1}/3 · ${this.orders[this.round].say}`;
    if (this.held) {
      return this._atFrame(pos)
        ? `E — ${this.held.spec.label} 끼우기 (${say})` : `${josa(this.held.spec.label, '를')} 들었다 — 틀로`;
    }
    if (this._atTray(pos)) {
      const b = this._belowSet();
      if (this.fitted >= 0 && b.size) return `E — 아래 접시를 위로 올리기 (빠진 것만 다시 거른다) · ${say}`;
      return this.fitted < 0 ? '아래 접시 — 체를 끼우면 빠진 것이 여기 모인다' : '아래 접시가 비었다';
    }
    if (this._atFrame(pos) && this.fitted >= 0) return `E — 체 빼기 · ${say}`;
    const s = this._nearSieve(pos);
    if (s) return `E — ${s.spec.label} 들기 · ${say}`;
    return `🧺 ${say}`;
  }

  interact(pos) {
    if (this.held) {
      if (!this._atFrame(pos)) return false;
      if (this.fitted >= 0) return false;                    // 먼저 빼야 한다
      this.fitted = this.sieves.indexOf(this.held);
      this.held.grp.position.set(this.frame.x, 1.75, this.frame.z);
      this.held.grp.rotation.y = 0;
      this.held = null;
      this._apply();
      return true;
    }
    // 아래 접시 올리기 — 빠진 것만 남기고 체는 선반으로 돌아간다
    if (this._atTray(pos) && this.fitted >= 0) {
      const b = this._belowSet();
      if (!b.size) return false;
      this.mix = b;
      const s = this.sieves[this.fitted];
      this.fitted = -1;
      s.grp.position.copy(s.home); s.grp.rotation.y = 0;
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
    this.round = 0; this.solved = false; this.mix = new Set([0, 1, 2]);
    this.orders = shuffle(ORDERS);       // 다시 도전하면 주문 순서도 새로
    for (const p of this.pips) p.material.color.set(0x4a3a22);
    for (const s of this.sieves) { s.grp.position.copy(s.home); s.grp.rotation.y = 0; }
    this._apply();
  }
}

export { MagnetGate } from './SortGate.js';

// ══════════════════════════════════════════════════════════════════════════
// 관문 3 — 거름과 증발
//
// ★ 처음엔 도구가 둘이라 순서가 두 가지뿐이었고, 반은 찍어도 맞았다.
//   **도구가 셋이다.** 쇠가루·모래·소금이 물에 섞여 있고, 순서는 여섯 가지 중 하나뿐이다.
//     자석으로 쇠가루 → 거름망으로 모래 → 화로로 물 날리기 → 소금  ← 정답
//   알갱이 크기로 못 거르는 것(쇠), 체로 거르는 것(모래), 녹아 있는 것(소금) —
//   셋을 다른 방법으로 갈라야 한다는 게 이 방이 가르치는 전부다.
// 순서를 틀려도 벌은 없다. 물을 다시 부으면 된다 — 실험은 다시 하는 것이다.
// ══════════════════════════════════════════════════════════════════════════
export class EvaporateGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    // mixed → demag(쇠 제거) → filtered(모래 제거) → salt
    // 순서를 어기고 화로에 올리면 lump. 물을 부으면 처음으로.
    this.state = 'mixed';
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
    // 도구가 놓인 자리를 섞는다. 순서는 물리가 정하지만, 자리까지 고정이면
    // "왼쪽→가운데→오른쪽"이라는 몸의 기억으로 풀린다.
    const xs = shuffle([cx - 4.4, cx, cx + 4.4]);
    this.magnet = station(xs[0], seg.z0 + 3.4, 0xe0736b, 1.2);
    this.filter = station(xs[1], seg.z0 + 3.4, 0x79c0e8, 1.1);
    this.burner = station(xs[2], seg.z0 + 3.4, 0xe8a04a, 1.0);
    this.tap = station(cx - 3.2, seg.z1 - 2.6, 0x9ab4c2, 0.8);

    this._paint();
  }

  _paint() {
    const c = { mixed: 0x6b5f45, demag: 0x8a7a52, filtered: 0x9fb6c4,
      salt: 0xf0ece0, lump: 0x5d5347 }[this.state];
    this.fluidMat.color.set(c);
    this.fluid.scale.y = this.state === 'salt' || this.state === 'lump' ? 0.5 : 1;
    const done = { mixed: 0, demag: 1, filtered: 2, salt: 3, lump: 0 }[this.state];
    this.magnet.mat.color.set(done >= 1 ? 0xffd27a : 0xe0736b);
    this.filter.mat.color.set(done >= 2 ? 0xffd27a : 0x79c0e8);
    this.burner.mat.color.set(done >= 3 ? 0xffd27a : 0xe8a04a);
  }

  _near(pos) {
    const d = (s) => Math.hypot(pos.x - s.x, pos.z - s.z);
    if (d(this.magnet) < REACH) return 'magnet';
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
    if (n === 'magnet') return 'E — 자석 대기 (쇠가루)';
    if (n === 'filter') return 'E — 거름망에 붓기 (알갱이)';
    if (n === 'burner') return 'E — 화로에 올리기 (물 날리기)';
    if (n === 'tap') return this.state === 'lump' ? 'E — 물 붓고 처음부터' : 'E — 내려놓기';
    return { mixed: '쇠가루·모래·소금이 물에 섞여 있다 (1/3)',
      demag: '쇠가루는 뺐다 — 다음은 알갱이 (2/3)',
      filtered: '모래도 걸렀다 — 이제 물을 날려라 (3/3)',
      lump: '순서가 어긋나 굳었다 — 물을 부어 처음부터' }[this.state];
  }

  interact(pos) {
    if (!this.held) {
      if (this.state === 'lump' && this._near(pos) === 'tap') { this.state = 'mixed'; this._paint(); return true; }
      if (!this._atPot(pos)) return false;
      this.held = true;
      return true;
    }
    const n = this._near(pos);
    if (n === 'magnet') {
      // 자석 — 쇠가루만 끌려 나온다. 알갱이 크기와 상관없다.
      if (this.state === 'mixed') this.state = 'demag';
      this._paint();
      return true;
    }
    if (n === 'filter') {
      // 거름망 — 알갱이(모래)만 걸린다. 쇠가루가 남아 있으면 함께 걸려 못 쓴다.
      if (this.state === 'demag') this.state = 'filtered';
      this._paint();
      return true;
    }
    if (n === 'burner') {
      // 화로 — 물이 날아간다. 아직 안 걸러 낸 게 있으면 소금과 함께 굳어 버린다.
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
    this.eyes = godEyes(g, cx, 4.62, this.gz + 0.62, 0.26, 0.34, 0.12);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.16, 14), glowMat(theme.glow));
    disc.position.set(cx, 5.5, this.gz); g.add(disc);

    // 섞인 것 셋 — 신 앞에 나란히
    // 섞인 것과 도구의 자리를 판마다 섞는다. 짝은 물리가 정하지만
    // 자리까지 고정이면 "왼쪽은 왼쪽"으로 외워진다.
    this.mixes = shuffle(PAIRS).map((p, i) => {
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
    ];
    this.tools = shuffle(this.tools).map((t, i) => {
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
    if (this.eyes) this.eyes.tick(dt, this.solvedBy());
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
      return `${josa(this.held.name, '를')} 들었다 — 섞인 것에 가져가라`;
    }
    if (n && n.kind === 'tool') return `E — ${n.tool.name} 들기`;
    if (n && n.kind === 'mix') {
      return n.mix.tooled ? `E — ${n.mix.mix}에서 도구 되가져오기` : `${n.mix.mix} — 무엇으로 가르지?`;
    }
    return '⚖ 섞인 것마다 알맞은 도구를 골라라';
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
  restart() {if (this.eyes) this.eyes.reset(); 
    this.held = null;
    for (const m of this.mixes) m.tooled = null;
    for (const t of this.tools) { t.used = false; t.mesh.position.copy(t.home); }
    this._check();
  }
}
