// 사당 06 관문 1 — 층의 순서 (과학 4-1 「지층과 화석」)
//
// ★ 두 번 갈아엎었다. 처음엔 화석이 갈 칸을 코드가 정해 **틀릴 수가 없었다.**
//   그래서 아이가 층을 고르게 고쳤는데 그건 더 나빴다 — 화석을 들고 있으면
//   겨냥을 못 바꿔서, 층을 고르려면 빈손으로 벽에 가 E를 여러 번 누르고
//   화석을 주우러 갔다가 다시 와야 했다.
//
//   그리고 더 큰 문제가 남아 있었다. **아이가 추론할 근거가 없었다.**
//   삼엽충과 암모나이트 중 뭐가 오래됐는지 게임 안 어디에도 없다.
//   아는 아이는 맞히고 모르는 아이는 찍는다 — 그건 문제가 아니라 퀴즈다.
//
// 그래서 이 방이 주는 것은 **시추 코어**다. 땅에서 뽑아 올린 기둥에 지층이
// 쌓인 그대로 화석이 박혀 있다. 아이가 할 일은 외우는 게 아니라 읽어서 옮기는 것이고,
// 그건 지질학자가 실제로 하는 일이다. 배치가 판마다 섞이므로 외워서는 못 넘긴다.
//
// 층은 **바닥 표석**으로 고른다. 벽 앞 네 자리에 서면 그 자리가 곧 그 층이다 —
// 서 있는 곳이 곧 선택이라 누르는 순서를 따로 배울 게 없다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { josa } from '../util/josa.js';

const glowMat = (c, o = {}) => {
  const m = new THREE.MeshBasicMaterial({ color: c, ...o });
  m.userData.outlineParameters = { visible: false };
  return m;
};

const FOSSILS = [
  { name: '삼엽충', c: 0x8b7f97, r: 0.42 },
  { name: '암모나이트', c: 0xa08a63, r: 0.40 },
  { name: '고사리', c: 0x7d9b5a, r: 0.38 },
  { name: '조개', c: 0xc2ab7e, r: 0.34 },
];
const BAND_C = [0x4a4152, 0x5b5164, 0x6a5f72, 0x7d7286];   // 아래가 어둡다

export class StrataOrderGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.held = null;
    this.solved = false;
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    const dark = toon(th.stoneDark), lite = toon(th.stoneLite);

    // 어느 화석이 몇 층인지는 **판마다 섞는다.** 고정이면 한 번 풀고 외우면 끝이다.
    this.order = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }

    // ── 지층 벽 · 층마다 빈 자리 ──────────────────────────────────────────
    this.slots = [];
    const wz = seg.z0 + 0.5;
    for (let i = 0; i < 4; i++) {
      const y = 0.95 + i * 1.15;                    // i=0이 맨 아래 = 가장 오래됨
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(seg.x1 - seg.x0 - 1.2, 1.12, 0.3), toon(BAND_C[i]));
      band.position.set(cx, y, wz);
      g.add(band);
      const holeMat = glowMat(th.glowDim);
      const hole = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 5, 14), holeMat);
      hole.position.set(cx, y, wz + 0.22);
      g.add(hole);
      this.slots.push({ level: i, x: cx, y, z: wz + 0.5, holeMat, got: null });
    }

    // ── 바닥 표석 넷 — 서는 자리가 곧 고르는 층 ───────────────────────────
    // 표석에서 벽의 그 층까지 줄을 이어, 어디에 꽂힐지 눈으로 확인된다.
    this.marks = this.slots.map((s, i) => {
      const x = cx - 3.3 + i * 2.2, z = wz + 3.4;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.16, 8), dark);
      pad.position.set(x, 0.08, z);
      g.add(pad);
      const ringMat = glowMat(th.glowDim);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 5, 18), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.18, z);
      g.add(ring);
      const dz = z - (wz + 0.3), dy = s.y - 0.2;
      const link = new THREE.Mesh(new THREE.BoxGeometry(0.07, Math.hypot(dz, dy), 0.07), ringMat);
      link.position.set(x, 0.2 + dy / 2, z - dz / 2);
      link.rotation.x = Math.atan2(dz, dy);
      g.add(link);
      // 몇 층인지 점으로. 맨 아래가 1층이다.
      for (let k = 0; k <= i; k++) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.13), ringMat);
        d.position.set(x - 0.3 + k * 0.2, 0.2, z + 0.62);
        g.add(d);
      }
      return { x, z, slot: s, ringMat };
    });

    // ── 시추 코어 — 이 방의 유일한 근거 ───────────────────────────────────
    // 화석 줄과 겹치지 않게 앞쪽에 둔다 — 겹치면 코어를 읽으려는데 화석이 집힌다.
    const coreX = seg.x0 + 2.2, coreZ = seg.z1 - 2.2;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.5, 8), dark);
    stand.position.set(coreX, 0.25, coreZ);
    g.add(stand);
    for (let i = 0; i < 4; i++) {
      const y = 0.7 + i * 0.92;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.9, 8), toon(BAND_C[i]));
      band.position.set(coreX, y, coreZ);
      g.add(band);
      // 그 층에 묻힌 화석 — 색과 크기가 바닥의 화석과 같다
      const f = FOSSILS[this.order[i]];
      const emb = new THREE.Mesh(new THREE.DodecahedronGeometry(f.r * 0.8, 0), toon(f.c));
      emb.position.set(coreX, y, coreZ + 0.42);
      g.add(emb);
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 8), lite);
    cap.position.set(coreX, 4.65, coreZ);
    g.add(cap);
    this.core = { x: coreX, z: coreZ };

    // ── 바닥의 화석 넷 ────────────────────────────────────────────────────
    this.fossils = FOSSILS.map((f, i) => {
      const x = cx - 2.85 + i * 1.9, z = seg.z1 - 5.6;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(f.r, 0), toon(f.c));
      m.position.set(x, f.r, z);
      m.castShadow = true;
      g.add(m);
      // 이 화석이 있어야 할 층 = 코어에서 그 화석이 박힌 칸
      return { ...f, idx: i, level: this.order.indexOf(i), mesh: m,
        home: m.position.clone(), x, z, slot: null };
    });
    this._paint();
  }

  _paint() {
    for (const s of this.slots) {
      s.holeMat.color.set(s.got ? (s.got.level === s.level ? 0xffd27a : 0xe0736b) : 0x6b52a0);
    }
    for (const m of this.marks) {
      m.ringMat.color.set(m.slot.got
        ? (m.slot.got.level === m.slot.level ? 0xffd27a : 0xe0736b) : 0x6b52a0);
    }
  }

  // 서 있는 표석이 곧 고른 층. 표석 밖이면 null.
  _mark(pos) {
    // 표석 간격이 2.2다. 반경을 1.05로 잡아야 두 표석 사이에 어정쩡하게 설 때
    // 엉뚱한 층이 잡히지 않는다.
    for (const m of this.marks) if (Math.hypot(pos.x - m.x, pos.z - m.z) < 1.05) return m;
    return null;
  }
  _nearFossil(pos) {
    let best = null, bd = 1.5;
    for (const f of this.fossils) {
      if (f.slot || f === this.held) continue;
      const d = Math.hypot(pos.x - f.x, pos.z - f.z);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }
  _atCore(pos) { return Math.hypot(pos.x - this.core.x, pos.z - this.core.z) < 2.6; }

  _check() {
    this.solved = this.fossils.every((f) => f.slot && f.slot.level === f.level);
    this._paint();
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
    const m = this._mark(pos);
    if (this.held) {
      if (!m) return `${josa(this.held.name, '을')} 들었어요 — 꽂을 층의 표석 위로`;
      return m.slot.got ? `${m.slot.level + 1}층은 이미 찼어요` : `E — ${m.slot.level + 1}층에 꽂기`;
    }
    if (m && m.slot.got) return `E — ${m.slot.level + 1}층에서 되빼기`;
    const f = this._nearFossil(pos);
    if (f) return `E — ${f.name} 들기`;
    if (this._atCore(pos)) return '⛏ 시추 코어 — 아래부터 쌓인 순서 그대로예요';
    const n = this.fossils.filter((x) => x.slot).length;
    return `🦴 코어를 읽고 같은 순서로 벽에 꽂아요 (${n}/4)`;
  }

  interact(pos) {
    const m = this._mark(pos);
    if (this.held) {
      if (!m || m.slot.got) return false;
      m.slot.got = this.held;
      this.held.slot = m.slot;
      this.held.mesh.position.set(m.slot.x, m.slot.y, m.slot.z - 0.2);
      this.held = null;
      this._check();
      return true;
    }
    if (m && m.slot.got) {
      this.held = m.slot.got;
      m.slot.got.slot = null;
      m.slot.got = null;
      this._check();
      return true;
    }
    const f = this._nearFossil(pos);
    if (!f) return false;
    this.held = f;
    return true;
  }

  solvedBy() { return this.solved; }
  restart() {
    this.held = null;
    for (const s of this.slots) s.got = null;
    for (const f of this.fossils) { f.slot = null; f.mesh.position.copy(f.home); }
    this._check();
  }
}
