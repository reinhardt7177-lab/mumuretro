// 사당 03 관문 2 — 성질로 나누기 (과학 4-1 「혼합물의 분리」)
//
// ★ 물건 여섯이 **똑같이 생겼다.** 눈으로는 못 고르고 반드시 대 보고 담가 봐야 한다.
//   겉모습으로 알 수 있으면 그건 분류가 아니라 기억이다.
//
// ★ 처음엔 자석 한 번으로 끝이었다. 여섯을 검사하니 행동 수는 열둘이었지만
//   첫 물건을 대 보는 순간 나머지는 기계적이었다. **기준이 세 번 바뀐다.**
//     1) 자석에 붙는가        — 자석을 대 본다
//     2) 물에 뜨는가          — 물통에 담가 본다
//     3) 붙으면서 가라앉는가   — 두 성질을 함께 봐야 한다
//   같은 물건이 기준에 따라 다른 통으로 간다. 3라운드가 가르치는 건 그거다 —
//   **한 가지 성질만으로는 못 가르는 것이 있다.**
//   그래서 '속 빈 쇠통'을 넣었다. 자석에는 붙는데 물에는 뜬다 —
//   1라운드와 2라운드에서 서로 다른 통으로 가는 유일한 물건이고, 3라운드의 핵심이다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { shuffle } from '../util/rand.js';

const glowMat = (c, o = {}) => {
  const m = new THREE.MeshBasicMaterial({ color: c, ...o });
  m.userData.outlineParameters = { visible: false };
  return m;
};
const REACH = 2.6;
const ITEM_REACH = 1.3;      // 물건은 촘촘하다. 이것만 좁게 잡는다
const PULL_R = 1.8;          // 자석이 닿는 거리

const ITEMS = [
  { iron: true, floats: false, name: '못' },
  { iron: false, floats: true, name: '나무 조각' },
  { iron: true, floats: false, name: '쇠구슬' },
  { iron: false, floats: false, name: '유리 구슬' },
  { iron: true, floats: true, name: '속 빈 쇠통' },
  { iron: false, floats: true, name: '고무 마개' },
];
const CRITERIA = [
  { yes: '자석에 붙는 것', no: '안 붙는 것', test: (it) => it.iron },
  { yes: '물에 뜨는 것', no: '가라앉는 것', test: (it) => it.floats },
  { yes: '붙으면서 가라앉는 것', no: '나머지', test: (it) => it.iron && !it.floats },
];

export class MagnetGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.held = null;
    this.round = 0;
    this.solved = false;
    // 기준 순서를 섞되 **셋째는 늘 두 성질을 함께 보는 것**으로 둔다.
    // 어려운 것을 먼저 내면 앞의 둘이 그 답을 알려 주는 힌트가 되어 버린다.
    this.crits = [...shuffle(CRITERIA.slice(0, 2)), CRITERIA[2]];
    const cx = (seg.x0 + seg.x1) / 2;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;
    const dark = toon(th.stoneDark);

    // 통 둘 — 기준의 "그렇다"와 "아니다". 라운드마다 뜻이 바뀐다.
    const bin = (x, z, c, yes) => {
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
      return { x, z, yes, ringMat, got: [] };
    };
    this.bins = [
      bin(cx - 3.6, seg.z0 + 3.0, th.glow, true),
      bin(cx + 3.6, seg.z0 + 3.0, 0x8a8b90, false),
    ];

    // 물통 — 담가 보면 뜨는지 가라앉는지 보인다. 2라운드부터 쓴다.
    this.basin = { x: cx + 4.8, z: seg.z1 - 6.2 };
    const bw = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 1.0, 10), dark);
    bw.position.set(this.basin.x, 0.5, this.basin.z); g.add(bw);
    const wt = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.16, 10),
      glowMat(0x3d8fc4, { transparent: true, opacity: 0.8 }));
    wt.position.set(this.basin.x, 1.0, this.basin.z); g.add(wt);
    this.testMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), toon(0x9a938a));
    this.testMesh.visible = false;
    g.add(this.testMesh);
    this.testItem = null;
    this.testT = 0;

    // 라운드 표시 — 세 번이라는 걸 처음부터 알려 준다
    this.pips = [0, 1, 2].map((k) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.1), glowMat(0x3a3020));
      m.position.set(cx - 0.24 + k * 0.24, 2.8, seg.z0 + 0.4);
      g.add(m);
      return m;
    });

    // 물건 여섯 — 전부 같은 회색 덩어리다. 겉으로는 구별이 안 된다.
    const same = toon(0x9a938a);
    // 물건 자리도 섞는다. 자리가 고정이면 "왼쪽 셋이 쇠"로 외워진다.
    this.items = shuffle(ITEMS).map((it, i) => {
      const x = cx - 5.5 + i * 2.2, z = seg.z1 - 3.0;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), same);
      m.position.set(x, 0.31, z);
      m.castShadow = true;
      g.add(m);
      return { ...it, mesh: m, home: m.position.clone(), x, z, bin: null, jig: 0 };
    });

    // 자석 — 늘 손에 들고 있다. 붙는 것만 흔들린다.
    const mag = new THREE.Group();
    mag.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 6, 10, Math.PI), glowMat(0xe0736b)));
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.22), glowMat(0xdfe3e6));
    p1.position.set(-0.3, -0.15, 0); mag.add(p1);
    const p2 = p1.clone(); p2.position.x = 0.3; mag.add(p2);
    g.add(mag);
    this.magnet = mag;
    this._paint();
  }

  get crit() { return this.crits[Math.min(this.round, this.crits.length - 1)]; }

  _paint() {
    this.bins[0].ringMat.color.set(0x6fe3d2);
    this.bins[1].ringMat.color.set(0x8a8b90);
    for (const b of this.bins) {
      if (b.got.some((it) => this.crit.test(it) !== b.yes)) b.ringMat.color.set(0xe0736b);
    }
  }

  _near(pos) {
    let best = null, bd = REACH;
    let ib = ITEM_REACH;
    for (const it of this.items) {
      if (it.bin || it === this.held || it === this.testItem) continue;
      const d = Math.hypot(pos.x - it.x, pos.z - it.z);
      if (d < ib) { ib = d; bd = d; best = { kind: 'item', item: it }; }
    }
    for (const b of this.bins) {
      const d = Math.hypot(pos.x - b.x, pos.z - b.z);
      if (d < bd) { bd = d; best = { kind: 'bin', bin: b }; }
    }
    const db = Math.hypot(pos.x - this.basin.x, pos.z - this.basin.z);
    if (db < bd) best = { kind: 'basin' };
    return best;
  }

  _nextRound() {
    this.pips[this.round].material.color.set(0xffd27a);
    this.round++;
    if (this.round >= this.crits.length) { this.solved = true; return; }
    for (const b of this.bins) b.got.length = 0;
    for (const it of this.items) {
      it.bin = null;
      it.mesh.position.copy(it.home);
      it.mesh.rotation.set(0, 0, 0);
    }
    this.held = null;
    this._paint();
  }

  update(dt, actor) {
    const p = actor.position;
    this.magnet.position.set(p.x + actor.heading.x * 0.6, 1.0, p.z + actor.heading.z * 0.6);
    this.magnet.rotation.y = Math.atan2(actor.heading.x, actor.heading.z);

    // 자석에 붙는 물건만 떨린다 — 1·3라운드의 정보
    for (const it of this.items) {
      if (it.bin || it === this.held || it === this.testItem) continue;
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
    // 물통에 담근 물건 — 뜨면 떠 있고 가라앉으면 내려간다
    if (this.testItem) {
      this.testT = Math.min(1, this.testT + dt * 1.6);
      const y = this.testItem.floats
        ? 1.05 + Math.sin(this.testT * 6) * 0.05 : 1.05 - this.testT * 0.8;
      this.testMesh.position.set(this.basin.x, y, this.basin.z);
    }
    return {};
  }

  prompt(pos) {
    if (this.solved) return null;
    const c = this.crit;
    const say = `기준 ${this.round + 1}/3 · ${c.yes}`;
    const n = this._near(pos);
    if (this.held) {
      if (n && n.kind === 'bin') return `E — ${n.bin.yes ? c.yes : c.no} 통에`;
      if (n && n.kind === 'basin') return 'E — 물통에 담가 보기';
      return `${say} — 통에 담아요`;
    }
    if (n && n.kind === 'item') {
      return `E — 들기 · ${n.item.iron ? '자석이 당겨요' : '자석이 반응 안 해요'}`;
    }
    if (n && n.kind === 'basin') {
      if (this.testItem) return `${this.testItem.floats ? '떠요!' : '가라앉아요!'} — E로 꺼내기`;
      return '💧 물통 — 물건을 담가 보면 알아요';
    }
    if (n && n.kind === 'bin' && n.bin.got.length) return 'E — 통에서 되꺼내기';
    return `🧲 ${say}`;
  }

  interact(pos) {
    const n = this._near(pos);
    if (!n) return false;
    if (this.held) {
      if (n.kind === 'basin') {                       // 담가 보기
        if (this.testItem) return false;
        this.testItem = this.held;
        this.testT = 0;
        this.testMesh.visible = true;
        this.held.mesh.visible = false;
        this.held = null;
        return true;
      }
      if (n.kind !== 'bin') return false;
      const b = n.bin;
      this.held.bin = b;
      b.got.push(this.held);
      const k = b.got.length - 1;
      this.held.mesh.position.set(b.x + (k % 2 - 0.5) * 0.7, 1.35 + Math.floor(k / 2) * 0.7,
        b.z + (k % 2 - 0.5) * 0.6);
      this.held = null;
      this._paint();
      // 여섯이 다 제 통에 들어갔으면 다음 기준으로
      if (this.items.every((it) => it.bin && this.crit.test(it) === it.bin.yes)) this._nextRound();
      return true;
    }
    if (n.kind === 'basin' && this.testItem) {        // 물통에서 꺼내기
      const it = this.testItem;
      this.testItem = null;
      this.testMesh.visible = false;
      it.mesh.visible = true;
      this.held = it;
      return true;
    }
    if (n.kind === 'item') { this.held = n.item; return true; }
    if (n.kind === 'bin' && n.bin.got.length) {       // 되꺼내기 — 막다른 길을 만들지 않는다
      const it = n.bin.got.pop();
      it.bin = null;
      this.held = it;
      this._paint();
      return true;
    }
    return false;
  }

  solvedBy() { return this.solved; }
  restart() {
    this.held = null;
    this.round = 0;
    this.solved = false;
    this.crits = [...shuffle(CRITERIA.slice(0, 2)), CRITERIA[2]];
    this.testItem = null;
    this.testMesh.visible = false;
    for (const p of this.pips) p.material.color.set(0x3a3020);
    for (const b of this.bins) b.got.length = 0;
    for (const it of this.items) {
      it.bin = null;
      it.mesh.visible = true;
      it.mesh.position.copy(it.home);
      it.mesh.rotation.set(0, 0, 0);
    }
    this._paint();
  }
}
