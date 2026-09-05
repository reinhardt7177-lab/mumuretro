// 사당 06 「시간의 사당」 — 과학 4-1 「지층과 화석」 · 마지막 사당
//
// 여기는 깊이가 곧 시간이다. 한 층 내려갈 때마다 더 오래된 것이 나온다.
// 그리고 이 사당은 앞선 다섯을 **기억해 냈는지** 묻는다 — 다시 가르치지 않는다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';

const glowMat = (c, o = {}) => {
  const m = new THREE.MeshBasicMaterial({ color: c, ...o });
  m.userData.outlineParameters = { visible: false };
  return m;
};
const REACH = 2.6;

// 앞선 다섯 사당의 색. 마지막 사당은 이 다섯을 계속 불러낸다.
export const SHRINE_COLORS = [
  { id: 'balance', c: 0x6fe3d2, name: '균형' },
  { id: 'shadow', c: 0xe9e3cd, name: '그림자' },
  { id: 'sift', c: 0xe0a955, name: '분리' },
  { id: 'water', c: 0x79c0e8, name: '물' },
  { id: 'fire', c: 0xe8664a, name: '화산' },
];

// ══════════════════════════════════════════════════════════════════════════
// 관문 1 — 층의 순서
//
// 화석 넷을 지층 벽의 빈칸에 꽂는다. 규칙은 하나다 — **아래일수록 오래된 것.**
// 그거 하나만 알면 풀리고, 모르면 아무리 봐도 안 풀린다. 단원의 핵심이 그거다.
// ══════════════════════════════════════════════════════════════════════════
const FOSSILS = [
  { age: 4, name: '삼엽충', c: 0x8b7f97, r: 0.42 },   // 가장 오래됨 → 맨 아래
  { age: 3, name: '암모나이트', c: 0xa08a63, r: 0.40 },
  { age: 2, name: '고사리', c: 0x7d9b5a, r: 0.38 },
  { age: 1, name: '조개', c: 0xc2ab7e, r: 0.34 },     // 가장 최근 → 맨 위
];

export class StrataOrderGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.held = null;
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    const dark = toon(th.stoneDark);

    // 지층 벽 — 층마다 색이 다르다. 아래로 갈수록 어둡고 오래되어 보인다.
    this.slots = [];
    const wz = seg.z0 + 0.5;
    for (let i = 0; i < 4; i++) {
      const y = 0.9 + i * 1.15;                       // i=0이 맨 아래 = 가장 오래됨
      const band = new THREE.Mesh(new THREE.BoxGeometry(seg.x1 - seg.x0 - 1.2, 1.1, 0.3),
        toon([0x4a4152, 0x5b5164, 0x6a5f72, 0x7d7286][i]));
      band.position.set(cx, y, wz);
      g.add(band);
      const holeMat = glowMat(th.glowDim);
      const hole = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 5, 14), holeMat);
      hole.position.set(cx, y, wz + 0.22);
      g.add(hole);
      // 아래일수록 오래됨 — 층 번호를 점으로 새긴다
      for (let k = 0; k <= 3 - i; k++) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), holeMat);
        d.position.set(cx + 1.6 + k * 0.24, y, wz + 0.22);
        g.add(d);
      }
      this.slots.push({ age: 4 - i, x: cx, y, z: wz + 0.5, holeMat, got: null });
    }

    // 화석 넷 — 바닥에 흩어 둔다
    this.fossils = FOSSILS.map((f, i) => {
      const x = cx - 3.6 + i * 2.4, z = seg.z1 - 3.0;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(f.r, 0), toon(f.c));
      m.position.set(x, f.r, z);
      m.castShadow = true;
      g.add(m);
      return { ...f, mesh: m, home: m.position.clone(), x, z, slot: null };
    });
    this.solved = false;
    this.aim = 0;                                    // 지금 겨냥한 층(0이 맨 아래)
    this._paintAim();
  }

  // 겨냥한 층을 밝혀 준다. 어디에 꽂힐지 안 보이면 고르는 게 아니라 찍는 것이다.
  _paintAim() {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      s.holeMat.color.set(s.got ? (s.got.age === s.age ? 0xffd27a : 0xe0736b)
        : (i === this.aim ? 0xd9c9ff : 0x6b52a0));
    }
  }

  _near(pos) {
    let best = null, bd = REACH;
    for (const f of this.fossils) {
      if (f.slot || f === this.held) continue;
      const d = Math.hypot(pos.x - f.x, pos.z - f.z);
      if (d < bd) { bd = d; best = { kind: 'fossil', f }; }
    }
    // 벽은 붙어 서므로 x만 본다 — 네 칸이 같은 x에 세로로 있어 z로는 못 가른다.
    for (const s of this.slots) {
      const d = Math.hypot(pos.x - s.x, pos.z - s.z);
      if (d < bd + 1.2) { bd = d; best = { kind: 'slot', s }; }
    }
    return best;
  }

  // ★ 예전엔 손에 든 화석이 갈 칸을 **코드가 정했다**(s.age === f.age).
  //   그래서 아이는 틀릴 수가 없었다 — 맨 위 칸 앞에서 삼엽충을 꽂아도
  //   맨 아래로 들어갔다. 단원의 핵심을 가르치는 방이 오답을 허용하지 않으면
  //   그건 문제가 아니라 버튼이다.
  //   이제 **어느 층에 꽂을지는 아이가 고른다.** 벽 앞에서 E를 누를 때마다
  //   겨냥한 층이 한 칸씩 올라가고(맨 위 다음은 맨 아래로 돈다), 겨냥한 층에 꽂힌다.
  //   높이로 고르게 하면 점프를 시켜야 하는데, 그건 이 방이 가르치려는 것과 무관하다.
  _slotFor() { return this.slots[this.aim]; }
  _aimNext() { this.aim = (this.aim + 1) % this.slots.length; }

  _check() {
    this.solved = this.fossils.every((f) => f.slot && f.slot.age === f.age);
    this._paintAim();
  }

  update(dt, actor) {
    if (this.held) {
      this.held.mesh.position.set(actor.position.x + actor.heading.x * 0.7, 1.0,
        actor.position.z + actor.heading.z * 0.7);
      this.held.mesh.rotation.y += dt * 1.6;
    }
    return {};
  }

  prompt(pos) {
    if (this.solved) return null;
    const n = this._near(pos);
    const lv = this.aim + 1;
    if (this.held) {
      if (n && n.kind === 'slot') {
        const s = this._slotFor();
        return s.got ? `${lv}층은 이미 찼어요 — E로 다음 층 겨냥`
          : `E — ${this.held.name}을 아래서 ${lv}층에 꽂기`;
      }
      return `${this.held.name}을 들었어요 — 지층 벽으로`;
    }
    if (n && n.kind === 'fossil') return `E — ${n.f.name} 들기`;
    if (n && n.kind === 'slot') {
      const filled = this.slots.filter((s) => s.got).length;
      return filled ? `E — ${lv}층에서 되빼기 (${filled}/4 꽂힘)` : `E — 겨냥 바꾸기 (지금 ${lv}층)`;
    }
    return '🦴 아래일수록 오래된 것이에요';
  }

  interact(pos) {
    const n = this._near(pos);
    if (!n) return false;
    if (this.held) {
      if (n.kind !== 'slot') return false;
      const s = this._slotFor();
      if (s.got) { this._aimNext(); this._paintAim(); return true; }   // 찬 칸이면 겨냥만 옮긴다
      s.got = this.held;
      this.held.slot = s;
      this.held.mesh.position.set(s.x, s.y, s.z - 0.2);
      this.held = null;
      this._check();
      return true;
    }
    if (n.kind === 'fossil') { this.held = n.f; return true; }
    // 빈손으로 벽 앞: 겨냥한 층에 꽂힌 게 있으면 빼고, 없으면 겨냥을 옮긴다
    const s = this._slotFor();
    if (s.got) {
      this.held = s.got;
      s.got.slot = null;
      s.got = null;
      this._check();
      return true;
    }
    this._aimNext();
    this._paintAim();
    return true;
  }

  solvedBy() { return this.solved; }
  restart() {
    this.held = null;
    this.aim = 0;
    for (const s of this.slots) s.got = null;
    for (const f of this.fossils) { f.slot = null; f.mesh.position.copy(f.home); }
    this._check();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 2 — 내려가는 갱도
//
// 위에서 바위가 떨어진다. 떨어지기 1.0초 전에 **바닥에 그림자가 먼저 뜬다** —
// 예고 없는 낙석은 지진과 마찬가지로 규칙이 아니라 주사위다.
// 그림자를 보고 비키면서 앞으로 나아간다.
// ══════════════════════════════════════════════════════════════════════════
const TELL = 1.0;                // 그림자가 먼저 뜨는 시간
const FALL = 0.45;               // 떨어지는 데 걸리는 시간
const SPAWN = 0.85;              // 낙석 간격

export class ShaftGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.cx = (seg.x0 + seg.x1) / 2;
    this.zIn = seg.z1 - 2.0;
    this.zOut = seg.z0 + 2.0;
    this.t = 0;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    this.h = seg.h;

    this.rocks = [];
    const rockMat = toon(th.stone);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), rockMat);
      m.visible = false;
      m.castShadow = true;
      g.add(m);
      const sh = new THREE.Mesh(new THREE.CircleGeometry(1.0, 14),
        glowMat(0x000000, { transparent: true, opacity: 0.7 }));
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = 0.03;
      sh.visible = false;
      g.add(sh);
      this.rocks.push({ mesh: m, shadow: sh, state: 'off', t: 0, x: 0, z: 0, r: 1.0 });
    }
  }

  _spawn() {
    const r = this.rocks.find((q) => q.state === 'off');
    if (!r) return;
    r.x = this.seg.x0 + 1.2 + Math.random() * (this.seg.x1 - this.seg.x0 - 2.4);
    r.z = this.zOut + 1.0 + Math.random() * (this.zIn - this.zOut - 2.0);
    r.state = 'tell'; r.t = 0;
    r.shadow.position.set(r.x, 0.03, r.z);
    r.shadow.visible = true;
    r.shadow.scale.setScalar(0.4);
  }

  update(dt, actor) {
    const p = actor.position;
    const inRoom = p.z < this.zIn && p.z > this.zOut;
    if (inRoom) {
      this.t += dt;
      if (this.t >= SPAWN) { this.t = 0; this._spawn(); }
    }
    let hit = false;
    for (const r of this.rocks) {
      if (r.state === 'off') continue;
      r.t += dt;
      if (r.state === 'tell') {
        // 그림자가 커진다 = 바위가 가까워진다
        r.shadow.scale.setScalar(0.4 + 0.6 * (r.t / TELL));
        if (r.t >= TELL) {
          r.state = 'fall'; r.t = 0;
          r.mesh.visible = true;
          r.mesh.position.set(r.x, this.h, r.z);
        }
      } else if (r.state === 'fall') {
        r.mesh.position.y = this.h * (1 - r.t / FALL);
        if (r.t >= FALL) {
          r.state = 'land'; r.t = 0;
          r.mesh.position.y = 0.5;
          if (inRoom && Math.hypot(p.x - r.x, p.z - r.z) < r.r) hit = true;
          actor.shake = Math.max(actor.shake, 0.16);
        }
      } else {
        if (r.t >= 0.5) { r.state = 'off'; r.mesh.visible = false; r.shadow.visible = false; }
      }
    }
    if (hit) return { fail: '낙석에 맞았어요 — 바닥 그림자를 보고 비켜요' };
    return {};
  }

  prompt(pos) {
    if (pos.z < this.zOut) return null;
    const soon = this.rocks.some((r) => r.state === 'tell' && r.t > TELL * 0.5);
    if (pos.z >= this.zIn) return '🪨 바닥에 그림자가 뜨면 그 자리로 바위가 떨어져요';
    return soon ? '⚠ 그림자를 피해요!' : '🪨 앞으로 — 그림자를 보면서';
  }

  solvedBy(actor) { return actor.position.z < this.zOut; }
  restart() {
    this.t = 0;
    for (const r of this.rocks) { r.state = 'off'; r.mesh.visible = false; r.shadow.visible = false; }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 3 — 다섯 색의 문
//
// 손잡이 다섯. 위에 걸린 표지가 앞선 다섯 사당을 하나씩 가리키고,
// 그 사당의 색으로 맞추면 문이 열린다. 다시 가르치는 게 아니라
// **기억해 냈는지**를 묻는 자리라 각각은 아주 짧다.
// ══════════════════════════════════════════════════════════════════════════
export class FiveDoorsGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    const dark = toon(th.stoneDark), lite = toon(th.stoneLite);

    // 표지의 순서는 섞어 둔다. 왼쪽부터 1·2·3·4·5면 색을 몰라도 위치로 풀린다.
    const order = [2, 0, 4, 1, 3];
    this.levers = order.map((si, i) => {
      const x = cx - 4.4 + i * 2.2, z = seg.z0 + 3.0;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.0, 0.34), dark);
      post.position.set(x, 1.0, z); g.add(post);
      // 표지 — 그 사당의 실루엣을 본뜬 모양. 색은 안 준다(그게 문제니까).
      const sign = new THREE.Mesh(
        [new THREE.BoxGeometry(1.0, 0.14, 0.2), new THREE.CircleGeometry(0.42, 14),
          new THREE.CylinderGeometry(0.42, 0.42, 0.12, 12), new THREE.OctahedronGeometry(0.44, 0),
          new THREE.ConeGeometry(0.44, 0.8, 6)][si], lite);
      sign.position.set(x, 2.5, z);
      g.add(sign);
      const gemMat = glowMat(0x3f3748);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), gemMat);
      gem.position.set(x, 2.05, z);
      g.add(gem);
      return { x, z, si, ci: -1, gemMat };
    });
    this.solved = false;
  }

  _near(pos) {
    let best = null, bd = 1.6;                  // 손잡이가 촘촘하다
    for (const l of this.levers) {
      const d = Math.hypot(pos.x - l.x, pos.z - l.z);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }

  _check() { this.solved = this.levers.every((l) => l.ci === l.si); }

  update() { return {}; }

  prompt(pos) {
    if (this.solved) return null;
    const l = this._near(pos);
    if (!l) {
      const n = this.levers.filter((x) => x.ci === x.si).length;
      return `🔮 표지의 사당 색으로 맞춰요 (${n}/5)`;
    }
    const cur = l.ci < 0 ? '없음' : SHRINE_COLORS[l.ci].name;
    return `E — 색 바꾸기 (지금 ${cur})`;
  }

  interact(pos) {
    const l = this._near(pos);
    if (!l) return false;
    l.ci = (l.ci + 1) % SHRINE_COLORS.length;
    l.gemMat.color.set(SHRINE_COLORS[l.ci].c);
    this._check();
    return true;
  }

  solvedBy() { return this.solved; }
  restart() {
    for (const l of this.levers) { l.ci = -1; l.gemMat.color.set(0x3f3748); }
    this.solved = false;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 신전 — 다섯을 안고 앉은 신
//
// 이 방의 첫인상은 **천장이 안 보이는 것**이어야 한다(방 높이 20u).
// 신은 앉아 있다. 무릎 높이가 아이 키(1.5u)와 같다 —
// 서 있는 거인보다 앉은 거인이 더 크게 읽힌다. 올려다보는 각도가 생기기 때문이다.
//
// 구슬 다섯을 하나씩 바친다. 하나 올릴 때마다 신의 몸 한 부분에 그 사당의 색으로
// 불이 들어온다. 다섯 번의 작은 절정을 만들고, 마지막에 눈이 뜬다 —
// 위에서 떨어지던 빛이 꺼지고 신 자신이 광원이 되어 방의 그림자가 한 번에 뒤집힌다.
// ══════════════════════════════════════════════════════════════════════════
export class GrandGod {
  constructor(scene, seg, theme) {
    this.REACH = 2.8;
    this.held = null;
    this.lit = 0;
    this.awake = 0;                              // 눈뜸 연출 진행도
    const cx = (seg.x0 + seg.x1) / 2;
    this.gz = seg.z0 + (seg.z1 - seg.z0) * 0.30;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    const stone = toon(theme.stoneLite), dark = toon(theme.stoneDark);

    // ── 앉은 신 ────────────────────────────────────────────────────────
    // 무릎 2.0u(아이 키 1.5u보다 조금 높다) · 어깨 9.4u · 머리끝 12.6u
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.4, 1.2, 8), dark);
    dais.position.set(cx, 0.6, this.gz); g.add(dais);
    for (const sx of [-1, 1]) {                                   // 무릎
      const knee = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 3.4), stone);
      knee.position.set(cx + sx * 2.1, 2.2, this.gz + 2.2);
      knee.castShadow = true; g.add(knee);
    }
    const lap = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.4, 3.0), stone);
    lap.position.set(cx, 1.9, this.gz + 0.4); g.add(lap);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.4, 6.6, 8), stone);
    torso.position.set(cx, 5.9, this.gz - 0.4);
    torso.castShadow = true; g.add(torso);
    for (const sx of [-1, 1]) {                                   // 팔
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 5.4, 6), stone);
      arm.position.set(cx + sx * 3.1, 5.4, this.gz + 0.6);
      arm.rotation.x = 0.34; arm.rotation.z = sx * 0.18;
      g.add(arm);
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 1.0, 8), stone);
    neck.position.set(cx, 9.6, this.gz - 0.4); g.add(neck);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.7, 2.4, 8), stone);
    head.position.set(cx, 11.2, this.gz - 0.4);
    head.castShadow = true; g.add(head);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.6, 8), stone);
    crown.position.set(cx, 13.1, this.gz - 0.4); g.add(crown);

    // 눈 — 다섯을 다 바치면 뜬다
    this.eyeMats = [];
    for (const sx of [-1, 1]) {
      const m = glowMat(0x2a2430);
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.14), m);
      e.position.set(cx + sx * 0.72, 11.5, this.gz + 0.92);
      g.add(e);
      this.eyeMats.push(m);
    }

    // 몸에 새겨진 다섯 자리 — 구슬을 바칠 때마다 하나씩 불이 든다
    this.panels = SHRINE_COLORS.map((s, i) => {
      const a = (i - 2) * 0.38;
      const m = glowMat(0x2a2430);
      const pn = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), m);
      pn.position.set(cx + Math.sin(a) * 2.7, 6.6 + Math.cos(a) * 0.3, this.gz + 2.3 + Math.cos(a) * 0.4);
      g.add(pn);
      return { mat: m, color: s.c };
    });

    // ── 제단 다섯 — 반원으로 ────────────────────────────────────────────
    this.altars = SHRINE_COLORS.map((s, i) => {
      const a = -Math.PI / 2 + (i - 2) * 0.32;
      const x = cx + Math.cos(a + Math.PI / 2) * 6.8;
      const z = this.gz + 7.4 + Math.sin(a + Math.PI / 2) * 1.6;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 1.2, 8), dark);
      base.position.set(x, 0.6, z); g.add(base);
      const ringMat = glowMat(0x3f3748);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.12, 5, 14), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 1.26, z); g.add(ring);
      return { x, z, ringMat, got: null, color: s.c, name: s.name };
    });

    // ── 구슬 다섯 — 입구 쪽 선반 ───────────────────────────────────────
    this.orbs = SHRINE_COLORS.map((s, i) => {
      const x = cx - 4.4 + i * 2.2, z = seg.z1 - 3.0;
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), glowMat(s.c));
      m.position.set(x, 1.0, z);
      g.add(m);
      return { ...s, mesh: m, home: m.position.clone(), x, z, placed: false };
    });

    // 위에서 내려오던 빛 — 다섯 번째에 꺼진다
    this.key = new THREE.SpotLight(0xfff0cf, 26, 40, Math.PI / 5, 0.5, 1.3);
    this.key.position.set(cx, seg.h - 1.0, this.gz + 5.0);
    this.key.target.position.set(cx, 4.0, this.gz);
    g.add(this.key); g.add(this.key.target);
    // 신 자신의 빛 — 다섯 번째에 켜진다. 방의 그림자 방향이 한 번에 뒤집힌다.
    this.inner = new THREE.PointLight(0xffd27a, 0, 34, 1.5);
    this.inner.position.set(cx, 8.0, this.gz + 1.0);
    g.add(this.inner);

    this.obstacles = [{ x: cx, z: this.gz, r: 6.0 }];
    this.prizePos = new THREE.Vector3(cx, 0, this.gz + 11.0);
  }

  _near(pos) {
    let best = null, bd = this.REACH;
    for (const o of this.orbs) {
      if (o.placed || o === this.held) continue;
      const d = Math.hypot(pos.x - o.x, pos.z - o.z);
      if (d < bd) { bd = d; best = { kind: 'orb', orb: o }; }
    }
    for (const a of this.altars) {
      const d = Math.hypot(pos.x - a.x, pos.z - a.z);
      if (d < bd) { bd = d; best = { kind: 'altar', altar: a }; }
    }
    return best;
  }

  update(dt, actor) {
    if (this.held) {
      this.held.mesh.position.set(actor.position.x + actor.heading.x * 0.7, 1.15,
        actor.position.z + actor.heading.z * 0.7);
      this.held.mesh.rotation.y += dt * 2.2;
    }
    if (this.lit >= 5 && this.awake < 1) {
      // 눈뜸 — 위의 빛이 꺼지고 신이 광원이 된다
      this.awake = Math.min(1, this.awake + dt / 1.8);
      this.key.intensity = 26 * (1 - this.awake);
      this.inner.intensity = 40 * this.awake;
      const k = Math.round(0x2a + (0xff - 0x2a) * this.awake);
      for (const m of this.eyeMats) m.color.setRGB(1, 0.82 * this.awake + 0.14, 0.48 * this.awake + 0.19);
      if (this.awake >= 1) for (const m of this.eyeMats) m.color.set(0xffd27a);
    }
    return {};
  }

  prompt(pos) {
    if (this.lit >= 5) return this.awake < 1 ? '✨ 신이 눈을 떠요…' : null;
    const n = this._near(pos);
    if (this.held) {
      if (n && n.kind === 'altar') {
        return n.altar.got ? '이 제단은 찼어요' : `E — ${this.held.name}의 구슬 바치기 (${this.lit}/5)`;
      }
      return `${this.held.name}의 구슬을 들었어요 — 제단으로`;
    }
    if (n && n.kind === 'orb') return `E — ${n.orb.name}의 구슬 들기`;
    if (n && n.kind === 'altar' && n.altar.got) return 'E — 되가져오기';
    return `⛩ 구슬 다섯을 제단에 바쳐요 (${this.lit}/5)`;
  }

  interact(pos) {
    const n = this._near(pos);
    if (!n) return false;
    if (this.held) {
      if (n.kind !== 'altar' || n.altar.got) return false;
      const a = n.altar;
      a.got = this.held;
      this.held.placed = true;
      this.held.mesh.position.set(a.x, 1.7, a.z);
      a.ringMat.color.set(this.held.c);
      // 신의 몸에 그 색으로 불이 든다 — 다섯 번의 작은 절정
      this.panels[this.lit].mat.color.set(this.held.c);
      this.lit++;
      this.held = null;
      return true;
    }
    if (n.kind === 'orb') { this.held = n.orb; return true; }
    if (n.altar.got) {
      const o = n.altar.got;
      n.altar.got = null;
      o.placed = false;
      this.held = o;
      n.altar.ringMat.color.set(0x3f3748);
      this.lit--;
      this.panels[this.lit].mat.color.set(0x2a2430);
      return true;
    }
    return false;
  }

  solvedBy() { return this.lit >= 5 && this.awake >= 1; }
  restart() {
    this.held = null; this.lit = 0; this.awake = 0;
    this.key.intensity = 26; this.inner.intensity = 0;
    for (const m of this.eyeMats) m.color.set(0x2a2430);
    for (const p of this.panels) p.mat.color.set(0x2a2430);
    for (const a of this.altars) { a.got = null; a.ringMat.color.set(0x3f3748); }
    for (const o of this.orbs) { o.placed = false; o.mesh.position.copy(o.home); }
  }
}
