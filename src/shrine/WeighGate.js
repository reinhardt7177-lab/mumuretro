// 관문 — 무게 순서. 균형의 사당 첫 방.
//
// ★ 이 사당의 첫 두 방이 **빛 타일**과 **레이저**였다. 반사신경 방이고 무게와는
//   아무 상관이 없었다. 아이가 처음 만나는 사당이 "이 게임은 과학이 아니라
//   피하기 게임"이라고 가르치고 있었다(비평 ②). 첫인상은 되돌리기 어렵다.
//
// 지킴이의 첫마디가 이 방의 규칙이다 — **"눈은 자주 틀린다. 저울은 한 번도
// 틀린 적이 없고."** 상자 다섯은 크기와 무게가 **일부러 어긋나** 있다.
// 큰 게 가볍고 작은 게 무겁다. 눈으로 고르면 반드시 틀리고, 저울에 둘씩 올려
// 비교해야만 순서가 나온다. 저울은 어느 쪽이 무거운지만 말한다 — 숫자는 없다.
// 넷을 정렬하려면 비교가 여러 번 필요하다. 그게 이 방의 사고 단계다.
//
// 계약은 다른 관문과 같다: update · prompt · interact · solvedBy · restart.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { SHRINE } from '../data/lighting.js';
import { shuffle } from '../util/rand.js';

const glowMat = (c) => {
  const m = new THREE.MeshBasicMaterial({ color: c });
  m.userData.outlineParameters = { visible: false };
  return m;
};
const N = 5;
const REACH = 2.6;          // 접시 — 둘뿐이고 3.8 떨어져 있다
// ★ 상자·받침은 2.2 간격인데 손이 2.6이면 어디 서든 둘이 겹친다 — 내려놓기 버그의 배경.
//   촘촘한 것은 손을 좁게 잡는다(SortGate의 ITEM_REACH와 같은 이유). 1.4면 겹치는
//   띠가 2.2−1.4 = 0.8 → 둘 사이 0.6u 밖에 없고, 거기서도 가까운 쪽이 이긴다.
const NEAR = 1.4;

export class WeighGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme || SHRINE;
    this.held = null;
    this.solved = false;
    const cx = (seg.x0 + seg.x1) / 2, cz = (seg.z0 + seg.z1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    const dark = toon(th.stoneDark), lite = toon(th.stoneLite);
    this.glow = glowMat(th.glow);

    // ── 상자 다섯 — 무게 1~5, 크기는 무게와 **어긋나게** ───────────────────
    // ★ 크기가 무게를 따라가면 눈으로 풀린다("답을 흘리지 않는다").
    //   크기 순위와 무게 순위가 다섯 자리 중 셋 이상 다르도록 섞는다(검사 P가 잰다).
    let sizes;
    do { sizes = shuffle([0, 1, 2, 3, 4]); }
    while (sizes.filter((s, i) => s === i).length > 2);
    const woods = [0x9a7a52, 0x8a6a44, 0xa8875c, 0x7f6140, 0x94714b];
    this.boxes = [];
    for (let w = 1; w <= N; w++) {
      const sz = 0.5 + sizes[w - 1] * 0.14;           // 0.5 ~ 1.06 — 크기는 무게와 무관
      const m = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), toon(woods[w - 1]));
      m.castShadow = true; m.receiveShadow = true;
      const x = cx - 4.4 + (w - 1) * 2.2, z = seg.z1 - 3.2;
      m.position.set(x, sz / 2, z);
      g.add(m);
      this.boxes.push({ w, sz, mesh: m, home: m.position.clone(), where: 'home', at: null });
    }
    // 처음 놓인 순서도 섞는다 — 왼쪽부터 1·2·3·4·5면 자리로 풀린다
    shuffle(this.boxes.slice()).forEach((b, i) => {
      b.home.set(cx - 4.4 + i * 2.2, b.sz / 2, seg.z1 - 3.2);
      b.mesh.position.copy(b.home);
    });

    // ── 비교 저울 — 접시 둘. 어느 쪽이 무거운지만 말한다 ──────────────────
    const sx = cx, sz0 = cz + 0.4;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.7, 8), dark);
    post.position.set(sx, 0.85, sz0); g.add(post);
    this.beam = new THREE.Group();
    this.beam.position.set(sx, 1.7, sz0);
    g.add(this.beam);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 0.16), lite);
    this.beam.add(bar);
    this.pans = [-1, 1].map((sd) => {
      const pg = new THREE.Group();
      pg.position.set(sd * 1.9, 0, 0);
      this.beam.add(pg);
      const chain = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.04), dark);
      chain.position.y = -0.45; pg.add(chain);
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.6, 0.1, 10), dark);
      pan.position.y = -0.95; pg.add(pan);
      return { sd, group: pg, box: null, x: sx + sd * 1.9, z: sz0 };
    });
    this.tilt = 0;

    // ── 받침 다섯 — 왼쪽이 가장 가벼운 것. 점 개수가 자리다 ─────────────────
    this.slots = [];
    for (let i = 0; i < N; i++) {
      const x = cx - 4.4 + i * 2.2, z = seg.z0 + 2.6;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.18, 8), dark);
      pad.position.set(x, 0.09, z); g.add(pad);
      const ringMat = glowMat(th.glowDim);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 5, 16), ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.2, z); g.add(ring);
      for (let k = 0; k <= i; k++) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.12), ringMat);
        d.position.set(x - 0.4 + k * 0.2, 0.2, z + 0.95);
        g.add(d);
      }
      this.slots.push({ i, x, z, box: null, ringMat });
    }
  }

  _near(pos) {
    let best = null, bd = REACH;
    // ★ 들고 있을 때는 상자를 후보에서 뺀다. 넣어 두니 옆 상자가 접시·받침보다
    //   가까우면 "내려놓기"가 그냥 무시됐다 — 실사용에서 "상자 내려놓기가 안 됨".
    //   손에 든 채로 만질 수 있는 건 접시와 받침뿐이다.
    if (!this.held) {
      bd = NEAR;
      for (const b of this.boxes) {
        const p = b.mesh.position;
        const d = Math.hypot(pos.x - p.x, pos.z - p.z);
        if (d < bd) { bd = d; best = { kind: 'box', box: b }; }
      }
      bd = best ? bd : REACH;
    }
    for (const p of this.pans) {
      const d = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (d < bd && !p.box) { bd = d; best = { kind: 'pan', pan: p }; }
    }
    for (const s of this.slots) {
      const d = Math.hypot(pos.x - s.x, pos.z - s.z);
      if (d < Math.min(bd, NEAR) && !s.box) { bd = d; best = { kind: 'slot', slot: s }; }
    }
    return best;
  }

  _check() {
    this.solved = this.slots.every((s) => s.box && s.box.w === s.i + 1);
    for (const s of this.slots) s.ringMat.color.set(this.solved ? 0xffd27a : SHRINE.glowDim);
  }

  update(dt, actor) {
    if (this.held) {
      this.held.mesh.position.set(actor.position.x + actor.heading.x * 0.7,
        0.9 + this.held.sz / 2, actor.position.z + actor.heading.z * 0.7);
    }
    // 저울은 두 접시의 무게 차로 기운다. 같으면 수평 — 그것도 답이다.
    const l = this.pans[0].box ? this.pans[0].box.w : 0, r = this.pans[1].box ? this.pans[1].box.w : 0;
    const want = (l || r) ? Math.max(-1, Math.min(1, (r - l) / 2)) * 0.32 : 0;
    this.tilt += (want - this.tilt) * Math.min(1, dt * 4);
    this.beam.rotation.z = -this.tilt;
    for (const p of this.pans) {
      p.group.rotation.z = this.tilt;                  // 접시는 늘 수평을 지킨다
      if (p.box) {
        const wp = new THREE.Vector3(0, -0.9, 0);
        p.group.localToWorld(wp);
        p.box.mesh.position.set(wp.x, wp.y + p.box.sz / 2, wp.z);
      }
    }
    return {};
  }

  prompt(pos) {
    if (this.solved) return null;
    const n = this._near(pos);
    const l = this.pans[0].box, r = this.pans[1].box;
    const verdict = (l && r) ? (l.w === r.w ? '⚖ 같다' : (l.w > r.w ? '⚖ 왼쪽이 무겁다' : '⚖ 오른쪽이 무겁다')) : null;
    if (this.held) {
      if (n && n.kind === 'pan') return 'E — 접시에 올리기';
      if (n && n.kind === 'slot') return `E — ${n.slot.i + 1}번 받침에 놓기 (왼쪽이 가장 가볍다)`;
      return 'E — 여기 내려놓기 · 저울 접시나 받침으로 가져가도 된다';
    }
    if (n && n.kind === 'box') {
      const b = n.box;
      return b.where === 'pan' ? 'E — 접시에서 내리기' : b.where === 'slot' ? 'E — 받침에서 들기' : 'E — 상자 들기';
    }
    if (verdict) return `${verdict} — 저울은 틀리지 않는다`;
    return '⚖ 상자 둘씩 저울에 올려 비교하고, 가벼운 것부터 받침에 세워라';
  }

  interact(pos) {
    const n = this._near(pos);
    if (this.held && !n) {
      // ★ 제자리에 도로 내려놓는 길이 없었다. 접시나 받침이 아니면 E가 아무 일도
      //   안 했다 — 든 상자를 못 버리는 건 벌이다. 아무 데서나 내려놓는다.
      const b = this.held;
      b.where = 'home'; b.at = null;
      b.mesh.position.copy(b.home);
      this.held = null;
      return true;
    }
    if (!n) return false;
    if (this.held) {
      if (n.kind === 'pan') {
        n.pan.box = this.held; this.held.where = 'pan'; this.held.at = n.pan; this.held = null;
        return true;
      }
      if (n.kind === 'slot') {
        n.slot.box = this.held; this.held.where = 'slot'; this.held.at = n.slot;
        this.held.mesh.position.set(n.slot.x, 0.18 + this.held.sz / 2, n.slot.z);
        this.held = null;
        this._check();
        return true;
      }
      return false;
    }
    if (n.kind === 'box') {
      const b = n.box;
      if (b.at) { b.at.box = null; b.at = null; }
      b.where = 'held'; this.held = b;
      this._check();
      return true;
    }
    return false;
  }

  solvedBy() { return this.solved; }

  restart() {
    this.held = null; this.solved = false;
    for (const p of this.pans) p.box = null;
    for (const s of this.slots) { s.box = null; s.ringMat.color.set(SHRINE.glowDim); }
    for (const b of this.boxes) { b.where = 'home'; b.at = null; b.mesh.position.copy(b.home); }
  }

  // 검사 P — 눈으로 풀리지 않는가. 크기 순위와 무게 순위가 같은 자리 수를 돌려준다.
  sizeAgreement() {
    const bySize = this.boxes.slice().sort((a, b) => a.sz - b.sz);
    return bySize.filter((b, i) => b.w === i + 1).length;
  }
}
