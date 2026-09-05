// 사당 04 「세 모습의 사당」 — 과학 4-2 「물의 상태 변화」
//
// 여섯 중 유일하게 **발밑이 미끄럽고**, 유일하게 방의 모양이 시간에 따라 바뀐다.
// 얼음·물·수증기 셋을 다 써야 나갈 수 있다.
//
// ★ 이 사당은 「걸을 수 있는 영역」을 관문이 직접 만든다. 물 위는 못 걷고 얼면 걷는다 —
//   그래서 Room.js가 관문에 dungeon을 넘긴다. 발판을 메시로만 만들고 판정을 따로 두면
//   보이는 얼음과 밟히는 얼음이 어긋나고, 그건 이 프로젝트에서 이미 겪은 실수다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { shuffle, range, randInt } from '../util/rand.js';

const glowMat = (c, o = {}) => {
  const m = new THREE.MeshBasicMaterial({ color: c, ...o });
  m.userData.outlineParameters = { visible: false };
  return m;
};
const REACH = 2.6;

// ══════════════════════════════════════════════════════════════════════════
// 관문 1 — 얼려서 건너기
//
// 방 한가운데가 물이다. 온도를 내리면 얼고, 그대로 두면 **녹는다.**
// 만들고 건너기까지가 한 호흡이라 "물 → 얼음 → 물"이 몸으로 남는다.
// 얼음 위에서 녹으면 물에 빠져 방 처음으로.
// ══════════════════════════════════════════════════════════════════════════
const FREEZE_T = 1.2;         // 어는 데 걸리는 시간
const SOLID_T = 6.0;          // 얼어 있는 시간
const THAW_WARN = 2.0;        // 이때부터 얼음이 깜빡인다

export class FreezeGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    const dun = opts.dungeon;
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    this.dun = dun;

    // 물 세 줄, 사이에 디딤섬 둘. 한 줄을 얼려 건너고, 섬에서 다음 줄을 언다.
    // 얼음이 버티는 시간은 줄마다 짧아진다 — 같은 동작이지만 갈수록 급해진다.
    const W = seg.x1 - seg.x0 - 0.2;
    const zs = [seg.z1 - 3.0, 0.0, -1.2, -4.2, -5.4, -8.4];   // 입구끝, A끝, 섬1끝, B끝, 섬2끝, C끝
    const bandZ = [[zs[0], zs[1]], [zs[2], zs[3]], [zs[4], zs[5]]];

    // 원래 방 사각형 하나를 여러 개로 바꾼다. 남겨 두면 물 위를 그냥 걸어간다.
    const i0 = dun.rects.indexOf(seg);
    const mk = (z0, z1, open) => ({ ...seg, z0, z1, open });
    const parts = [mk(zs[0], seg.z1, true)];                  // 입구 발판
    this.bands = bandZ.map((bz, k) => {
      const r = mk(bz[1], bz[0], false);
      parts.push(r);
      if (k < 2) parts.push(mk(zs[k * 2 + 2], bz[1], true));  // 디딤섬
      // 버티는 시간도 판마다 흔든다. 갈수록 짧아지는 건 그대로다.
      return { rect: r, z0: bz[1], z1: bz[0], phase: 'water', t: 0,
        solid: [range(4.4, 5.6), range(3.7, 4.7), range(3.0, 3.9)][k] };
    });
    parts.push(mk(seg.z0, zs[5], true));                      // 출구 발판
    dun.rects.splice(i0, 1, ...parts);
    this.zOut = zs[5];

    const waterMat = glowMat(0x1d4f6b, { transparent: true, opacity: 0.85 });
    this.bands.forEach((b, k) => {
      const len = b.z1 - b.z0, cz = (b.z0 + b.z1) / 2;
      const w = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, len), waterMat);
      w.position.set(cx, 0.05, cz);
      g.add(w);
      b.mat = glowMat(0xbfe4f5, { transparent: true, opacity: 0 });
      b.mesh = new THREE.Mesh(new THREE.BoxGeometry(W, 0.22, len), b.mat);
      b.mesh.position.set(cx, 0.11, cz);
      g.add(b.mesh);

      // 손잡이 — 그 줄 바로 앞 발판에 하나씩
      const lz = b.z1 + 0.6;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.4, 6), toon(th.stoneDark));
      st.position.set(cx - 3.0, 0.7, lz);
      g.add(st);
      b.knobMat = glowMat(th.glow);
      const kn = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), b.knobMat);
      kn.position.set(cx - 3.0, 1.6, lz);
      g.add(kn);
      b.lever = { x: cx - 3.0, z: lz };
      // 몇 번째 줄인지 점으로
      for (let d = 0; d <= k; d++) {
        const dot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), b.knobMat);
        dot.position.set(cx - 3.0 - 0.2 + d * 0.2, 2.15, lz);
        g.add(dot);
      }
    });
  }

  _bandAt(z) { return this.bands.find((b) => z < b.z1 && z > b.z0); }

  update(dt, actor) {
    const p = actor.position;
    let fail = null;
    for (const b of this.bands) {
      if (b.phase === 'freezing') {
        b.t += dt;
        b.mat.opacity = Math.min(0.9, b.t / FREEZE_T * 0.9);
        if (b.t >= FREEZE_T) { b.phase = 'ice'; b.t = 0; b.rect.open = true; b.mat.opacity = 0.9; }
      } else if (b.phase === 'ice') {
        b.t += dt;
        const left = b.solid - b.t;
        // 녹기 직전엔 깜빡인다. 예고 없이 빠지면 규칙이 아니라 운으로 읽힌다.
        b.mat.opacity = left < THAW_WARN ? 0.4 + 0.5 * Math.abs(Math.sin(b.t * 9)) : 0.9;
        if (b.t >= b.solid) {
          b.phase = 'water'; b.t = 0; b.rect.open = false; b.mat.opacity = 0;
          if (p.z < b.z1 && p.z > b.z0) fail = '얼음이 녹아 물에 빠졌어요';
        }
      }
      b.knobMat.color.set(b.phase === 'water' ? 0x79c0e8 : 0xbfe4f5);
    }
    return fail ? { fail } : {};
  }

  _atLever(pos) {
    for (const b of this.bands) {
      if (Math.hypot(pos.x - b.lever.x, pos.z - b.lever.z) < REACH) return b;
    }
    return null;
  }

  prompt(pos) {
    if (pos.z < this.zOut) return null;
    const done = this.bands.filter((b) => pos.z < b.z0).length;
    const n = `${Math.min(3, done + 1)}/3`;
    const b = this._atLever(pos);
    if (b) {
      if (b.phase === 'water') return `E — 온도 내리기 (${n}번째 줄을 얼려요)`;
      if (b.phase === 'freezing') return '❄ 어는 중…';
      return `❄ ${Math.max(1, Math.ceil(b.solid - b.t))}초 뒤 녹아요 — 건너요!`;
    }
    const on = this._bandAt(pos.z);
    if (on && on.phase === 'ice') return `❄ ${Math.max(1, Math.ceil(on.solid - on.t))}초! 건너요`;
    return `🌊 물은 못 건너요 — 손잡이로 얼려요 (${n})`;
  }

  interact(pos) {
    const b = this._atLever(pos);
    if (!b || b.phase !== 'water') return false;
    b.phase = 'freezing'; b.t = 0;
    return true;
  }

  solvedBy(actor) { return actor.position.z < this.zOut; }
  restart() {
    for (const b of this.bands) { b.phase = 'water'; b.t = 0; b.rect.open = false; b.mat.opacity = 0; }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 2 — 미끄러운 바닥
//
// 얼음 위에서는 멈추지 않는다. 미리 감속해서 구멍 앞에 서야 한다.
// 이 방에만 있는 조작감이고, 마찰이 없으면 어떻게 되는지를 손으로 안다.
//
// 구멍은 사각형을 잘라 만들지 않고 **원으로 판정**한다. 사각형을 잘라 붙이면
// 이음매가 늘고, 이음매는 이 프로젝트에서 가장 자주 깨진 자리다.
// ══════════════════════════════════════════════════════════════════════════
export class SlideGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    this.zIn = seg.z1 - 2.4;
    this.zOut = seg.z0 + 2.0;

    // 얼음 바닥
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(seg.x1 - seg.x0 - 0.2, 0.08, this.zIn - this.zOut),
      glowMat(0xa8d8ee, { transparent: true, opacity: 0.55 }));
    floor.position.set(cx, 0.05, (this.zIn + this.zOut) / 2);
    g.add(floor);

    // 구멍 넷 — 지그재그로 놓아 한 방향으로 쭉 밀 수 없게 한다
    // 구멍 자리를 판마다 뽑는다. 좌우를 번갈아 두어 한 방향으로 쭉 밀 수 없게 한다.
    this.holes = [];
    let side = randInt(2) ? 1 : -1;
    const spots = [0, 1, 2, 3].map((k) => {
      side = -side;
      const v = [side * range(1.6, 2.8), -(1.4 + k * 3.0 + range(-0.4, 0.4)), range(1.35, 1.7)];
      return v;
    });
    for (const [dx, dz, r] of spots) {
      const x = cx + dx, z = this.zIn + dz;
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 16), glowMat(0x0a2130));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.11, z);
      g.add(m);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 5, 18), glowMat(th.glowDim));
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(x, 0.13, z);
      g.add(rim);
      this.holes.push({ x, z, r });
    }
  }

  update(dt, actor) {
    const p = actor.position;
    const on = p.z < this.zIn && p.z > this.zOut;
    actor.slip = on ? 1 : 0;                    // 이 방 안에서만 미끄럽다
    if (!on) return {};
    for (const h of this.holes) {
      if (Math.hypot(p.x - h.x, p.z - h.z) < h.r * 0.72) {
        actor.slip = 0;
        return { fail: '구멍에 빠졌어요 — 미리 속도를 줄여요' };
      }
    }
    return {};
  }

  prompt(pos) {
    if (pos.z < this.zOut) return null;
    if (pos.z >= this.zIn) return '🧊 여기부터 미끄러워요 — 미리 멈춰야 해요';
    return '🧊 미끄러워요! 구멍을 피해요';
  }

  solvedBy(actor) { return actor.position.z < this.zOut; }
  restart() {}
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 3 — 세 모습 만들기
//
// 가마솥의 온도를 바꾸면 안의 물이 얼음·물·수증기로 변한다.
// 문에 달린 세 밸브가 각각 다른 모습을 요구한다. 온도를 맞춰 놓고 밸브를 누른다.
// 순서는 없다 — 온도와 모습의 **짝**만 알면 된다.
// ══════════════════════════════════════════════════════════════════════════
const TEMPS = [
  { c: -10, state: 'ice', name: '얼음', color: 0xbfe4f5 },
  { c: 20, state: 'water', name: '물', color: 0x3d8fc4 },
  { c: 110, state: 'steam', name: '수증기', color: 0xdfeef4 },
];

export class SteamGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.ti = 1;                        // 물에서 시작
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    const dark = toon(th.stoneDark), lite = toon(th.stoneLite);

    // 가마솥
    this.pot = { x: cx, z: seg.z1 - 3.4 };
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 1.2, 10), dark);
    body.position.set(this.pot.x, 0.6, this.pot.z); g.add(body);
    this.brewMat = glowMat(TEMPS[1].color);
    this.brew = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.2, 10), this.brewMat);
    this.brew.position.set(this.pot.x, 1.22, this.pot.z); g.add(this.brew);
    // 김 — 수증기일 때만 뜬다
    this.steam = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6),
      glowMat(0xdfeef4, { transparent: true, opacity: 0.4 }));
    this.steam.position.set(this.pot.x, 2.3, this.pot.z);
    this.steam.visible = false;
    g.add(this.steam);

    // 온도 손잡이
    this.lever = { x: cx + 2.6, z: seg.z1 - 3.4 };
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.4, 6), dark);
    st.position.set(this.lever.x, 0.7, this.lever.z); g.add(st);
    this.knobMat = glowMat(TEMPS[1].color);
    const kn = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), this.knobMat);
    kn.position.set(this.lever.x, 1.6, this.lever.z); g.add(kn);

    // 밸브 셋 — 각자 다른 모습을 요구한다
    // 어느 밸브가 무엇을 원하는지 판마다 섞는다.
    this.valves = shuffle(['steam', 'ice', 'water'])
      .map((want, i) => ({ want, x: cx - 3.4 + i * 3.4 })).map((v) => {
      const z = seg.z0 + 2.2;
      const mat = glowMat(TEMPS.find((t) => t.state === v.want).color,
        { transparent: true, opacity: 0.45 });
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.16, 6, 14), mat);
      m.position.set(v.x, 1.5, z);
      g.add(m);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), lite);
      post.position.set(v.x, 0.75, z); g.add(post);
      return { ...v, z, mat, filled: false };
    });
    this._paint();
  }

  get state() { return TEMPS[this.ti].state; }

  _paint() {
    const t = TEMPS[this.ti];
    this.brewMat.color.set(t.color);
    this.knobMat.color.set(t.color);
    this.brew.scale.y = t.state === 'steam' ? 0.4 : 1;
    this.steam.visible = t.state === 'steam';
    for (const v of this.valves) v.mat.opacity = v.filled ? 0.95 : 0.45;
  }

  update(dt) {
    if (this.steam.visible) this.steam.position.y = 2.3 + Math.sin(performance.now() / 400) * 0.12;
    return {};
  }

  _near(pos) {
    if (Math.hypot(pos.x - this.lever.x, pos.z - this.lever.z) < REACH) return { kind: 'lever' };
    for (const v of this.valves) {
      if (Math.hypot(pos.x - v.x, pos.z - v.z) < REACH) return { kind: 'valve', valve: v };
    }
    return null;
  }

  prompt(pos) {
    if (this.solvedBy()) return null;
    const t = TEMPS[this.ti];
    const n = this._near(pos);
    if (n && n.kind === 'lever') return `E — 온도 바꾸기 (지금 ${t.c}° · ${t.name})`;
    if (n && n.kind === 'valve') {
      const want = TEMPS.find((x) => x.state === n.valve.want).name;
      if (n.valve.filled) return `${want} 밸브는 채웠어요`;
      return t.state === n.valve.want ? `E — ${want} 넣기` : `이 밸브는 ${want}를 원해요 (지금 ${t.name})`;
    }
    return `🫖 지금 ${t.c}° · ${t.name} — 밸브 셋을 채워요`;
  }

  interact(pos) {
    const n = this._near(pos);
    if (!n) return false;
    if (n.kind === 'lever') { this.ti = (this.ti + 1) % TEMPS.length; this._paint(); return true; }
    if (n.valve.filled || n.valve.want !== this.state) return false;
    n.valve.filled = true;
    this._paint();
    return true;
  }

  solvedBy() { return this.valves.every((v) => v.filled); }
  restart() { this.ti = 1; for (const v of this.valves) v.filled = false; this._paint(); }
}

// ══════════════════════════════════════════════════════════════════════════
// 신전 — 세 모습이 바뀌는 신
//
// 신이 스스로 얼음 → 물 → 수증기로 바뀐다. 벽의 표지가 한 모습을 가리키고,
// 신이 그 모습일 때 제단을 눌러야 한다. 세 번 맞히면 구슬이 내려온다.
// 관문 셋이 "만드는" 것이었다면 여기는 **알아보고 기다리는** 자리다.
// ══════════════════════════════════════════════════════════════════════════
const CYCLE = 2.6;              // 한 모습이 유지되는 시간
const NEED = 3;

export class WaterGod {
  constructor(scene, seg, theme) {
    this.REACH = 2.8;
    this.t = 0; this.si = 0;
    this.got = 0;
    this.want = randInt(TEMPS.length);      // 처음 문제도 판마다 다르다
    this.flash = 0;
    const cx = (seg.x0 + seg.x1) / 2;
    this.gz = seg.z0 + (seg.z1 - seg.z0) * 0.30;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    const dark = toon(theme.stoneDark);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 0.6, 8), dark);
    base.position.set(cx, 0.3, this.gz); g.add(base);
    // 신 자신이 색을 바꾼다 — 실루엣은 그대로고 재질만 변한다.
    this.godMat = glowMat(TEMPS[0].color, { transparent: true, opacity: 0.9 });
    this.god = new THREE.Mesh(new THREE.OctahedronGeometry(2.1, 1), this.godMat);
    this.god.position.set(cx, 3.0, this.gz);
    g.add(this.god);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.09, 6, 20), glowMat(theme.glowDim));
    halo.rotation.x = Math.PI / 2;
    halo.position.set(cx, 3.0, this.gz);
    g.add(halo);

    // 표지 — 지금 무엇을 기다리는지. 신 위에 떠 있다.
    this.signMat = glowMat(TEMPS[this.want].color);
    this.sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.2), this.signMat);
    this.sign.position.set(cx, 6.4, this.gz);
    g.add(this.sign);

    // 제단 — 여기서 누른다
    this.altar = { x: cx, z: this.gz + 4.6 };
    const al = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.1, 8), dark);
    al.position.set(this.altar.x, 0.55, this.altar.z); g.add(al);
    this.altarMat = glowMat(theme.glow);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.14, 8), this.altarMat);
    top.position.set(this.altar.x, 1.17, this.altar.z); g.add(top);

    // 맞힌 횟수 — 구슬 셋
    this.pips = [];
    for (let i = 0; i < NEED; i++) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0),
        glowMat(0x3a4a52, { transparent: true, opacity: 0.8 }));
      m.position.set(this.altar.x - 0.6 + i * 0.6, 1.6, this.altar.z);
      g.add(m);
      this.pips.push(m);
    }

    this.obstacles = [{ x: cx, z: this.gz, r: 2.6 }];
    this.prizePos = new THREE.Vector3(cx, 0, this.gz + 8.2);
  }

  update(dt) {
    this.t += dt;
    if (this.t >= CYCLE) {
      this.t = 0;
      this.si = (this.si + 1) % TEMPS.length;
      this.godMat.color.set(TEMPS[this.si].color);
    }
    this.god.rotation.y += dt * 0.5;
    if (this.flash > 0) this.flash -= dt;
    this.altarMat.color.set(this.flash > 0 ? 0xe0736b
      : (this.si === this.want ? 0xffd27a : 0x3d8fc4));
    return {};
  }

  _atAltar(pos) { return Math.hypot(pos.x - this.altar.x, pos.z - this.altar.z) < this.REACH; }

  prompt(pos) {
    if (this.solvedBy()) return null;
    const w = TEMPS[this.want].name, now = TEMPS[this.si].name;
    if (!this._atAltar(pos)) return `💧 표지는 ${w} — 신이 ${w}일 때 제단을 눌러요`;
    if (this.flash > 0) return `${now}였어요 — 다시 기다려요 (${this.got}/${NEED})`;
    return `E — 지금 신은 ${now} · 표지는 ${w} (${this.got}/${NEED})`;
  }

  interact(pos) {
    if (!this._atAltar(pos) || this.solvedBy()) return false;
    if (this.si !== this.want) { this.flash = 0.8; return true; }
    this.pips[this.got].material.color.set(0xffd27a);
    this.got++;
    if (this.got < NEED) {
      // 다음 문제는 지금 모습이 아닌 것으로 — 서 있기만 해서는 못 맞힌다
      let n = this.want;
      while (n === this.want || n === this.si) n = (n + 1) % TEMPS.length;
      this.want = n;
      this.signMat.color.set(TEMPS[this.want].color);
    }
    return true;
  }

  solvedBy() { return this.got >= NEED; }
  restart() {
    this.got = 0; this.want = randInt(TEMPS.length); this.si = 0; this.t = 0; this.flash = 0;
    this.signMat.color.set(TEMPS[this.want].color);
    for (const p of this.pips) p.material.color.set(0x3a4a52);
  }
}
