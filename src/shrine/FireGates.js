// 사당 05 「흔들리는 사당」 — 과학 4-2 「화산과 지진」
//
// 여섯 중 가장 시끄럽고 가장 액션에 가깝다. 화면이 실제로 흔들린다.
//
// ★ 흔들림은 장식이 아니라 **신호**다. 큰 진동이 오기 전에 작은 예진이 먼저 오고,
//   그걸 알아채는 아이는 안 죽는다. 이 사당이 가르치는 건 그거 하나다 —
//   관찰해서 예측한다. 예진 없이 흔들리면 그건 지진이 아니라 주사위다.
import * as THREE from 'three';
import { godEyes } from './GodEyes.js';
import { toon } from '../render/Toon.js';
import { shuffle, range, randInt } from '../util/rand.js';

const glowMat = (c, o = {}) => {
  const m = new THREE.MeshBasicMaterial({ color: c, ...o });
  m.userData.outlineParameters = { visible: false };
  return m;
};
const REACH = 2.6;

// ══════════════════════════════════════════════════════════════════════════
// 관문 1 — 예진
//
//   고요 4.0초 → 예진 1.4초(작게 흔들리고 먼지가 인다) → 본진 1.6초
// 본진 동안 기둥 곁에 붙어 있어야 산다. 예진은 반드시 본진보다 먼저 온다 —
// 처음 한 번은 대개 맞지만, 그 한 번이 규칙을 가르친다.
// ══════════════════════════════════════════════════════════════════════════
const CALM = 4.0, FORE = 1.4, MAIN = 1.6;
const HOLD_R = 2.0;              // 기둥에서 이 안이면 산다

export class QuakeGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.phase = 'calm'; this.t = 0;
    this.calm = range(3.2, 4.8);      // 고요한 시간도 판마다 다르다
    this.calmBase = this.calm;
    this.main = MAIN;
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    this.zIn = seg.z1 - 2.2;
    this.zOut = seg.z0 + 2.2;

    // 붙잡을 기둥 — 길을 따라 띄엄띄엄. 간격이 곧 난이도다.
    const lite = toon(th.stoneLite);
    this.pillars = [];
    // 기둥 자리를 판마다 뽑는다. 좌우를 번갈아 두어 한 줄로 달릴 수 없게 한다.
    let sd = randInt(2) ? 1 : -1;
    const spots = [0, 1, 2, 3].map((k) => { sd = -sd;
      return [sd * range(1.8, 2.8), -(1.8 + k * 3.2 + range(-0.5, 0.5))]; });
    for (const [dx, dz] of spots) {
      const x = cx + dx, z = this.zIn + dz;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, seg.h, 6), lite);
      m.position.set(x, seg.h / 2, z);
      m.castShadow = true;
      g.add(m);
      // 발밑 표시 — 어디까지가 안전한지 보여야 붙잡을 수 있다
      const ring = new THREE.Mesh(new THREE.TorusGeometry(HOLD_R, 0.09, 5, 20), glowMat(th.glowDim));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.06, z);
      g.add(ring);
      this.pillars.push({ x, z, ring });
    }

    // 경고등 — 예진이 시작되면 켜진다. 화면 흔들림만으로는 원인이 안 읽힌다.
    this.warnMat = glowMat(0xe8664a, { transparent: true, opacity: 0 });
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, seg.z1 - seg.z0 - 2), this.warnMat);
      w.position.set(cx + sx * (seg.x1 - seg.x0) / 2 * 0.94, 3.2, (seg.z0 + seg.z1) / 2);
      g.add(w);
    }
  }

  _safe(p) {
    for (const q of this.pillars) if (Math.hypot(p.x - q.x, p.z - q.z) < HOLD_R) return true;
    return false;
  }

  update(dt, actor) {
    const p = actor.position;
    const inRoom = p.z < this.zIn && p.z > this.zOut;
    this.t += dt;

    if (this.phase === 'calm') {
      this.warnMat.opacity = 0;
      if (this.t >= this.calm) { this.phase = 'fore'; this.t = 0; }
    } else if (this.phase === 'fore') {
      // 예진 — 작게 흔들리고 경고등이 켜진다. 이때 기둥으로 뛰어야 한다.
      actor.shake = Math.max(actor.shake, 0.06);
      this.warnMat.opacity = 0.35 + 0.35 * Math.abs(Math.sin(this.t * 12));
      if (this.t >= FORE) { this.phase = 'main'; this.t = 0; }
    } else {
      actor.shake = Math.max(actor.shake, 0.34);
      this.warnMat.opacity = 0.9;
      if (inRoom && !this._safe(p)) {
        this.phase = 'calm'; this.t = 0; this.warnMat.opacity = 0;
        return { fail: '지진에 휩쓸렸다 — 예진이 오면 기둥으로' };
      }
      if (this.t >= this.main) { this.phase = 'calm'; this.t = 0; }
    }
    for (const q of this.pillars) {
      q.ring.material.color.set(this.phase === 'calm' ? 0x9c2f1c : 0xffd27a);
    }
    return {};
  }

  prompt(pos) {
    if (pos.z < this.zOut) return null;
    if (this.phase === 'calm') return `🌋 고요… ${Math.max(1, Math.ceil(this.calm - this.t))} — 기둥 위치를 봐 둬라`;
    if (this.phase === 'fore') return '⚠ 예진이다! 기둥 곁으로!';
    return this._safe(pos) ? '🪨 기둥을 붙잡았다' : '⚠ 흔들린다! 기둥으로!';
  }

  // 고요가 짧아지고 본진이 길어진다. 기둥 사이를 뛸 시간이 줄어든다.
  setTier(t) { this.calm = this.calmBase * (1 - t * 0.07); this.main = MAIN * (1 + t * 0.06); }

  solvedBy(actor) { return actor.position.z < this.zOut; }
  restart() { this.phase = 'calm'; this.t = 0; this.warnMat.opacity = 0; }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 2 — 용암 육각형
//
// 육각 발판이 깔려 있고, **밟고 지나온 칸이 가라앉는다.** 되돌아갈 수 없다.
// 1번 사당의 색 발판과 같은 계열이지만 규칙이 정반대다 —
// 거기서는 남을 곳을 보고 움직였고, 여기서는 갈 곳을 미리 정해야 한다.
// ══════════════════════════════════════════════════════════════════════════
const SINK_T = 0.7;              // 떠난 뒤 가라앉기까지

export class HexLavaGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    this.zIn = seg.z1 - 2.0;
    this.zOut = seg.z0 + 2.0;
    this.R = 1.05;                                   // 육각 반지름
    const dx = this.R * Math.sqrt(3), dz = this.R * 1.5;
    this.tiles = [];
    const cols = Math.floor((seg.x1 - seg.x0 - 1) / dx);
    const rows = Math.floor((this.zIn - this.zOut) / dz);
    const okMat = toon(th.stoneLite);
    this.lavaMat = glowMat(0xe8664a);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = cx - (cols - 1) * dx / 2 + c * dx + (r % 2 ? dx / 2 : 0);
        const z = this.zIn - 1.0 - r * dz;
        if (x < seg.x0 + 0.8 || x > seg.x1 - 0.8) continue;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(this.R * 0.92, this.R * 0.92, 0.28, 6), okMat);
        m.position.set(x, 0.14, z);
        m.rotation.y = Math.PI / 6;
        m.receiveShadow = true;
        g.add(m);
        this.tiles.push({ x, z, mesh: m, mat: okMat, state: 'ok', t: 0, baseY: 0.14 });
      }
    }
    // 아래에 깔린 용암 — 가라앉으면 이게 드러난다
    const lava = new THREE.Mesh(
      new THREE.BoxGeometry(seg.x1 - seg.x0 - 0.2, 0.06, this.zIn - this.zOut),
      glowMat(0x8e2a12));
    lava.position.set(cx, -0.02, (this.zIn + this.zOut) / 2);
    g.add(lava);
    this.cur = null;
  }

  _at(p) {
    let best = null, bd = this.R * 0.95;
    for (const t of this.tiles) {
      const d = Math.hypot(p.x - t.x, p.z - t.z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  update(dt, actor) {
    const p = actor.position;
    const inRoom = p.z < this.zIn && p.z > this.zOut;
    const here = inRoom ? this._at(p) : null;

    if (here && here !== this.cur) {
      if (this.cur && this.cur.state === 'ok') { this.cur.state = 'sinking'; this.cur.t = 0; }
      this.cur = here;
    }
    for (const t of this.tiles) {
      if (t.state === 'sinking') {
        const sk = this.sink || SINK_T;
        t.t += dt;
        t.mesh.position.y = t.baseY - (t.t / sk) * 0.55;
        t.mesh.material = this.lavaMat;
        if (t.t >= sk) { t.state = 'lava'; t.mesh.visible = false; }
      }
    }
    if (inRoom && (!here || here.state === 'lava')) {
      return { fail: '용암에 빠졌다 — 갈 길을 미리 정해라' };
    }
    return {};
  }

  prompt(pos) {
    if (pos.z < this.zOut) return null;
    if (pos.z >= this.zIn) return '🔥 밟고 지나온 칸은 가라앉는다 — 길을 미리 정해라';
    return '🔥 되돌아갈 수 없다!';
  }

  // 밟은 칸이 더 빨리 가라앉는다.
  setTier(t) { this.sink = SINK_T * (1 - t * 0.06); }

  solvedBy(actor) { return actor.position.z < this.zOut; }
  restart() {
    this.cur = null;
    for (const t of this.tiles) {
      t.state = 'ok'; t.t = 0;
      t.mesh.visible = true;
      t.mesh.position.y = t.baseY;
      t.mesh.material = t.mat;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 3 — 간헐천
//
// 분출구 셋이 각각 4·6·9초 주기로 뿜는다. 주기가 서로 어긋나 있어
// "지금 다 잠잠하다"가 오래 가지 않는다. 발밑 고리가 다음 분출까지를 보여 주므로
// 외우는 게 아니라 **읽는** 것이다.
// ══════════════════════════════════════════════════════════════════════════
const ERUPT = 1.3;               // 뿜는 시간

export class GeyserGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    this.zIn = seg.z1 - 2.2;
    this.zOut = seg.z0 + 2.2;

    this.vents = [];
    // 자리도 주기도 판마다. 주기가 서로 어긋나야 '다 잠잠한 순간'이 짧다.
    const per = shuffle([range(3.6, 4.6), range(5.4, 6.6), range(8.0, 9.6)]);
    const spec = [0, 1, 2].map((k) => [range(-3.6, 3.6), -(2.6 + k * 3.4 + range(-0.4, 0.4)),
      per[k], range(0, per[k])]);
    for (const [dx, dz, per, ph] of spec) {
      const x = cx + dx, z = this.zIn + dz;
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.2, 10), toon(th.stoneDark));
      hole.position.set(x, 0.1, z);
      g.add(hole);
      // 남은 시간 고리 — 차오르면 뿜는다. 이게 없으면 주기는 외우는 것이 된다.
      const ringMat = glowMat(th.glowDim);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.11, 5, 22), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.2, z);
      g.add(ring);
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 5.0, 8),
        glowMat(0xf0a860, { transparent: true, opacity: 0.7 }));
      jet.position.set(x, 2.5, z);
      jet.visible = false;
      g.add(jet);
      this.vents.push({ x, z, per, base: per, t: ph, ring, ringMat, jet, r: 1.7 });
    }
  }

  update(dt, actor) {
    const p = actor.position;
    const inRoom = p.z < this.zIn && p.z > this.zOut;
    let hit = false;
    for (const v of this.vents) {
      v.t += dt;
      if (v.t >= v.per) v.t -= v.per;
      const erupting = v.t < (this.erupt || ERUPT);
      v.jet.visible = erupting;
      const left = erupting ? 0 : (v.per - v.t);
      v.ringMat.color.set(erupting ? 0xe8664a : (left < 1.2 ? 0xf0a860 : 0x9c2f1c));
      v.ring.scale.setScalar(erupting ? 1.15 : 0.7 + 0.3 * (1 - Math.min(1, left / 2.5)));
      if (erupting && inRoom && Math.hypot(p.x - v.x, p.z - v.z) < v.r) hit = true;
    }
    if (hit) {
      actor.shake = Math.max(actor.shake, 0.25);
      return { fail: '간헐천에 데었다 — 고리가 차오르면 비켜라' };
    }
    return {};
  }

  prompt(pos) {
    if (pos.z < this.zOut) return null;
    const soon = this.vents.filter((v) => v.per - v.t < 1.2 && v.t >= (this.erupt || ERUPT)).length;
    if (pos.z >= this.zIn) return '💨 고리가 차오르면 뿜는다 — 주기가 셋 다 다르다';
    return soon ? '💨 곧 뿜는다!' : '💨 지금이다 — 건너라';
  }

  // 주기가 짧아지고 뿜는 시간이 길어진다 — 잠잠한 틈이 줄어든다.
  setTier(t) {
    for (const v of this.vents) v.per = v.base * (1 - t * 0.05);
    this.erupt = ERUPT * (1 + t * 0.06);
  }

  solvedBy(actor) { return actor.position.z < this.zOut; }
  restart() { for (const v of this.vents) v.t = Math.random() * v.per; }
}

// ══════════════════════════════════════════════════════════════════════════
// 신전 — 화산을 든 신
//
// 신의 발밑에서 용암이 흘러나온다. 수로 조각 셋을 돌려 신에서 배수구까지
// 길을 이으면 용암이 빠지고, 굳은 자리로 걸어가 구슬을 받는다.
//
// 조각마다 맞는 방향이 하나뿐이고 **앞엣것이 이어져야 다음이 채워진다** —
// 거울 세 장과 같은 종류의 순서다. 용암이 이어진 데까지만 흐르므로
// 어디서 끊겼는지가 눈에 보인다.
// ══════════════════════════════════════════════════════════════════════════
// 각 조각: 열린 두 방향. 0=+z 1=+x 2=−z 3=−x
//
// ★ 처음엔 셋을 한 줄로 놓고 전부 −x로 받아 +x로 내보내게 했다. 그런데 엘보 조각은
//   회전해도 **마주 보는 두 방향을 동시에 열 수 없다.** 정답이 아예 없는 퍼즐이었다.
//   길을 L자로 꺾어, 조각마다 필요한 들어오는 방향과 나가는 방향을 다르게 준다.
//   그래야 곧은 수로와 굽은 수로가 각자 쓸 자리를 갖는다.
const PIECES = [
  { open: [0, 2], name: '곧은 수로', need: [3, 1], dx: -3.0, dz: 0 },    // ←로 받아 →로
  { open: [0, 1], name: '굽은 수로', need: [3, 0], dx: 0, dz: 0 },       // ←로 받아 앞으로
  { open: [0, 1], name: '굽은 수로', need: [2, 1], dx: 0, dz: 3.0 },     // 뒤로 받아 →로
];

export class FireGod {
  constructor(scene, seg, theme) {
    this.REACH = 2.6;
    const cx = (seg.x0 + seg.x1) / 2;
    this.gz = seg.z0 + (seg.z1 - seg.z0) * 0.26;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    const stone = toon(theme.stoneLite), dark = toon(theme.stoneDark);

    // 신 — 원뿔 셋을 겹친 분화구 형상. 다른 신전과 실루엣이 확실히 갈린다.
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 0.7, 6), dark);
    base.position.set(cx, 0.35, this.gz); g.add(base);
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(1.9 - k * 0.55, 2.4 - k * 0.55, 1.5, 6), stone);
      c.position.set(cx, 1.2 + k * 1.4, this.gz);
      c.castShadow = true;
      g.add(c);
    }
    this.crater = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.3, 8), glowMat(0xe8664a));
    this.crater.position.set(cx, 5.2, this.gz); g.add(this.crater);
    this.eyes = godEyes(g, cx, 2.75, this.gz + 1.62, 0.42, 0.44, 0.16);

    // 수로 조각 셋 — 신 앞에서 배수구까지. 길이 L자로 꺾인다.
    this.cells = PIECES.map((p) => {
      const x = cx + p.dx, z = this.gz + 4.4 + p.dz;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 2.4), dark);
      pad.position.set(x, 0.1, z); g.add(pad);
      const grp = new THREE.Group();
      grp.position.set(x, 0.25, z);
      // 열린 두 방향으로 홈을 판다 — 어느 쪽이 뚫렸는지 눈으로 봐야 한다
      const arm = (dir) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 1.3), glowMat(theme.glowDim));
        const a = dir * Math.PI / 2;
        m.position.set(Math.sin(a) * 0.6, 0, Math.cos(a) * 0.6);
        m.rotation.y = a;
        return m;
      };
      for (const d of p.open) grp.add(arm(d));
      g.add(grp);
      // 시작 회전을 판마다 뽑는다. 0에서 시작하면 몇 번 눌렀는지가 곧 답이 된다.
      const rot = randInt(4);
      grp.rotation.y = rot * Math.PI / 2;
      return { ...p, x, z, rot, grp };
    });

    // 흐르는 용암 — 이어진 데까지만 보인다
    this.flow = this.cells.map((c) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.9), glowMat(0xf0a860));
      m.position.set(c.x, 0.34, c.z);
      m.visible = false;
      g.add(m);
      return m;
    });

    // 배수구 — 마지막 조각의 오른쪽
    this.drain = { x: cx + 3.0, z: this.gz + 7.4 };
    const d = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.5, 8), dark);
    d.position.set(this.drain.x, 0.25, this.drain.z); g.add(d);
    this.drainMat = glowMat(theme.glowDim);
    const dr = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.12, 5, 16), this.drainMat);
    dr.rotation.x = -Math.PI / 2;
    dr.position.set(this.drain.x, 0.52, this.drain.z); g.add(dr);

    this.obstacles = [{ x: cx, z: this.gz, r: 2.9 }];
    this.prizePos = new THREE.Vector3(cx, 0, this.gz + 8.6);
    this.solved = false;
    // ★ 젤다 신전의 마지막은 새 기믹이 아니라 **앞 방을 합쳐 묻는 자리**다.
    //   이 신전은 수로 퍼즐 셋뿐이라 첫 방(예진→본진)과 아무 관계가 없었다.
    //   이제 신이 주기적으로 흔들린다. 예진이 오면 곧 본진이고, **본진 중엔
    //   수로를 못 돌린다** — 손이 떨려서. 첫 방에서 배운 "작은 흔들림이 먼저
    //   온다"를 여기서 다시 써야 한다. 전조를 읽고 그 사이에 돌려라.
    this.phase = 'calm'; this.pt = 0;
    this.CALM = 6.5; this.FORE = 1.4; this.MAIN = 1.6;
    this._flow();
  }

  // 조각의 지금 열린 방향들
  _open(c) { return c.open.map((d) => (d + c.rot) % 4); }

  // 조각마다 받아야 할 방향과 내보내야 할 방향이 다르다.
  // 앞엣것이 이어져야 다음이 채워지므로 어디서 끊겼는지가 눈에 보인다.
  _flow() {
    let reach = 0;
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      const o = this._open(c);
      if (o.includes(c.need[0]) && o.includes(c.need[1])) reach = i + 1;
      else break;
    }
    this.reach = reach;
    for (let i = 0; i < this.flow.length; i++) this.flow[i].visible = i < reach;
    this.solved = reach === this.cells.length;
    this.drainMat.color.set(this.solved ? 0xffd27a : 0x9c2f1c);
    this.crater.material.color.set(this.solved ? 0x8e2a12 : 0xe8664a);
  }

  _near(pos) {
    let best = null, bd = this.REACH;
    for (const c of this.cells) {
      const d = Math.hypot(pos.x - c.x, pos.z - c.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  update(dt) {
    if (this.eyes) this.eyes.tick(dt, this.solvedBy());
    if (this.solved) return {};
    this.pt += dt;
    const len = this.phase === 'calm' ? this.CALM : this.phase === 'fore' ? this.FORE : this.MAIN;
    if (this.pt >= len) {
      this.pt = 0;
      this.phase = this.phase === 'calm' ? 'fore' : this.phase === 'fore' ? 'main' : 'calm';
    }
    // 예진은 분화구가 깜빡이고, 본진은 조각이 들썩인다 — 소리 없이 눈으로 온다.
    const k = this.phase === 'main' ? Math.sin(this.pt * 42) * 0.06 : 0;
    for (const c of this.cells) c.grp.position.y = 0.25 + Math.abs(k) * 2;
    this.crater.material.color.set(this.phase === 'fore'
      ? (Math.floor(this.pt * 8) % 2 ? 0xfff0b0 : 0xe8664a) : (this.solved ? 0x8e2a12 : 0xe8664a));
    return {};
  }

  prompt(pos) {
    if (this.solved) return null;
    if (this.phase === 'main') return '⚠ 본진이다 — 손이 떨려 못 돌린다. 지나갈 때까지';
    const c = this._near(pos);
    const warn = this.phase === 'fore' ? '⚠ 예진 — 곧 흔들린다 · ' : '';
    if (!c) return `${warn}🌋 용암이 ${this.reach}번째 수로까지 왔다 — 길을 이어라`;
    return `${warn}E — ${c.name} 돌리기 (${c.rot * 90}°)`;
  }

  interact(pos) {
    // 본진 중엔 안 돌아간다. 벌이 아니다 — 때를 읽으라는 것이다.
    if (this.phase === 'main') return true;
    const c = this._near(pos);
    if (!c) return false;
    c.rot = (c.rot + 1) % 4;
    c.grp.rotation.y = c.rot * Math.PI / 2;   // rotY(+90°): +z → +x, 즉 (d+1)%4
    this._flow();
    return true;
  }

  solvedBy() { return this.solved; }
  restart() {if (this.eyes) this.eyes.reset(); 
    for (const c of this.cells) { c.rot = 0; c.grp.rotation.y = 0; c.grp.position.y = 0.25; }
    this.phase = 'calm'; this.pt = 0;
    this._flow();
  }
}
