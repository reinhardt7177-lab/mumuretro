// 양팔저울 — 이 사당이 존재하는 이유.
//
// 과학 4학년 1학기 「물체의 무게」 수평잡기. 교과서의 `무게 × 거리`가 화면에서
// 눈으로 보이는 유일한 지점이다.
//
// ★ 물리 엔진을 쓰지 않는다. 슬롯에 놓고 토크를 합산해 막대를 기울이는 것뿐이다.
//   오히려 그 편이 낫다 — 물건이 굴러가거나 튕기지 않아 아이가 다룰 수 있고,
//   "왼쪽 2칸에 3kg" 같은 상태가 화면에 정확히 남는다. 자유 강체였다면
//   상자가 미끄러져 아이는 무게가 아니라 조작과 싸우게 된다.
//
// ★ 한쪽을 고정한다. 양쪽이 다 비어 있으면 아무것도 안 놓아도 0 = 0으로 이미 수평이다.
//   그건 문제가 아니라 빈 화면이다. 왼쪽에 고정 상자를 놓아 **풀어야 할 값**을 준다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { SHRINE } from '../data/lighting.js';

// 치수 — 플레이어 1.5u 기준.
const BEAM_LEN = 8, BEAM_Y = 1.15;     // 막대가 캐릭터 허리 높이. 상자를 올리고 내리기 좋다
const SLOT_STEP = 1.2, SLOTS = 3;      // 받침점에서 1·2·3칸
const MAX_TILT = 20 * Math.PI / 180;   // 이보다 기울면 상자가 미끄러져 보인다
// 상호작용 거리. 압력판에서 1.6이 인색해 "빼는 게 안 된다"는 말을 들었다(실사용 확인).
// 저울도 같은 병이라 함께 늘린다. 선반(x=-6.4)과 끝칸(x=-3.6)이 2.8 떨어져 있어
// 2.1까지는 둘이 안 헷갈린다.
const REACH = 2.1;
const BALANCE_EPS = 0.001;

// 상자 무게. ★ 5를 뺐다 — 소수라 다른 조합과 맞아떨어지지 않아 막다른 길만 만든다.
// 1·2·3·4·6이면 토크 6을 만드는 방법이 다섯 가지다.
export const WEIGHTS = [1, 2, 3, 4, 6];

// 문제 — 왼쪽 고정. 3kg를 2칸에 놓았으니 목표 토크는 6이다.
// 오른쪽 정답: 6@1 · 3@2 · 2@3 · {1@2, 4@1} · {1@3, 3@1}  — 다섯 가지
const FIXED = { w: 3, slot: 2 };

const boxSize = (w) => 0.42 + w * 0.05;      // 무게가 크면 눈에도 커야 한다

// 선반 위치. ★ 처음엔 x=-5.0에 뒀다가 옮겼다. 막대 왼쪽 끝 슬롯이 x=-3.6인데
// 상호작용 반경이 1.7u라, 선반 앞에 서면 **슬롯이 더 가깝게 잡혀** 상자를 집을 수 없었다.
// 간격을 2.8u로 벌린다. 레벨 설계로도 이쪽이 맞다 — 재료 선반이 저울을 비집고 있으면 안 된다.
const SHELF = new THREE.Vector3(-6.4, 0, 1.6);
const SHELF_GAP = 1.1;                       // 상자 간격. 반경 1.7보다 작지만 x가 갈려서 안 겹친다

export class BalanceScale {
  // onBalance: 수평이 되는 순간 한 번 불린다(문 열기 등)
  constructor(scene, opts = {}) {
    this.onBalance = opts.onBalance || (() => {});
    this.origin = opts.origin || new THREE.Vector3(0, 0, -1.0);
    this.balanced = false;
    this.held = null;                        // 들고 있는 상자
    this.tilt = 0; this.targetTilt = 0;

    const stone = toon(SHRINE.stone);
    const dark = toon(SHRINE.stoneDark);
    const lite = toon(SHRINE.stoneLite);
    this.glowMat = new THREE.MeshBasicMaterial({ color: SHRINE.glow });
    this.glowMat.userData.outlineParameters = { visible: false };

    const root = new THREE.Group();
    root.position.copy(this.origin);
    scene.add(root);
    this.root = root;

    const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    const put = (mesh, x, y, z, parent = root) => {
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
      parent.add(mesh); return mesh;
    };

    // ── 석상 — 신이 저울을 들고 있다 ─────────────────────────────────────
    // 무릎 꿇은 자세로 만든다. 서 있으면 손이 3u를 넘어가 아이가 닿을 수 없다.
    // 이 세계에서 유일하게 각진 것이 사당이고, 석상은 그중에서도 가장 각져야 한다(§5).
    const st = new THREE.Group();
    st.position.set(0, 0, -2.4);
    root.add(st);
    put(box(2.6, 0.5, 1.8, dark), 0, 0.25, 0, st);                       // 받침
    put(box(1.7, 1.5, 1.2, stone), 0, 1.25, 0, st);                      // 몸통
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.85, 6), lite);
    put(head, 0, 2.45, 0, st);
    // 눈 — 수평이 되면 켜진다. 이게 "해냈다"를 말하는 장치다.
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = put(box(0.14, 0.09, 0.06, dark), s * 0.17, 2.52, 0.4, st);
      this.eyes.push(e);
    }
    // 앞으로 뻗은 팔 — 손바닥 위에 막대가 얹힌다
    for (const s of [-1, 1]) {
      const arm = put(box(0.34, 0.30, 2.0, stone), s * 0.85, BEAM_Y - 0.28, 1.15, st);
      arm.rotation.x = -0.06;
    }

    // ── 받침점 ──────────────────────────────────────────────────────────
    const fulc = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 4), lite);
    fulc.rotation.y = Math.PI / 4;
    put(fulc, 0, BEAM_Y - 0.5, 0);

    // ── 막대 ────────────────────────────────────────────────────────────
    // 슬롯에 놓인 상자는 막대의 자식이라 함께 기운다. 그게 "무게가 실렸다"를 보여 준다.
    const beam = new THREE.Group();
    beam.position.set(0, BEAM_Y, 0);
    root.add(beam);
    this.beam = beam;
    put(box(BEAM_LEN, 0.18, 0.34, lite), 0, 0, 0, beam);

    // 칸 눈금 — 거리가 보여야 `무게 × 거리`가 보인다. 이게 없으면 그냥 시소다.
    this.slots = [];
    for (const side of [-1, 1]) {
      for (let i = 1; i <= SLOTS; i++) {
        const x = side * i * SLOT_STEP;
        put(box(0.5, 0.07, 0.42, dark), x, 0.12, 0, beam);              // 접시
        // 칸 번호 — 굵기로 표시한다. 텍스트는 4학년이 각도에 따라 못 읽는다.
        for (let k = 0; k < i; k++) {
          put(box(0.07, 0.05, 0.07, this.glowMat), x + (k - (i - 1) / 2) * 0.14, 0.19, 0.26, beam);
        }
        this.slots.push({ side, index: i, x, box: null, fixed: false, mesh: null });
      }
    }

    // 왼쪽 고정 상자 — 이게 문제다
    const fx = this.slots.find(s => s.side === -1 && s.index === FIXED.slot);
    fx.fixed = true;
    fx.box = { w: FIXED.w, mesh: this._makeBox(FIXED.w, true) };
    beam.add(fx.box.mesh);
    fx.box.mesh.position.set(fx.x, 0.16 + boxSize(FIXED.w) / 2, 0);

    // ── 상자 선반 ───────────────────────────────────────────────────────
    // 왼쪽 벽. 문으로 가는 길목이라 지나가며 눈에 들어온다.
    const shelf = new THREE.Group();
    shelf.position.copy(SHELF);
    root.add(shelf);
    put(box(0.7, 0.55, WEIGHTS.length * SHELF_GAP + 0.6, dark), 0, 0.275, 0, shelf);
    this.stock = [];
    WEIGHTS.forEach((w, i) => {
      const m = this._makeBox(w, false);
      const z = (i - (WEIGHTS.length - 1) / 2) * SHELF_GAP;
      m.position.set(0, 0.55 + boxSize(w) / 2, z);
      shelf.add(m);
      this.stock.push({ w, mesh: m, home: m.position.clone(), parent: shelf, taken: false });
    });

    this._updateTilt(true);
  }

  // 상자 — 무게에 비례해 크고, 점으로 무게를 표시한다.
  // 숫자를 쓰지 않는 이유: 3D에서 각도에 따라 안 읽히고, 점은 세면 되기 때문이다.
  _makeBox(w, fixed) {
    const g = new THREE.Group();
    const s = boxSize(w);
    const mat = toon(fixed ? 0xb08a5a : 0x6f9ad6);
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    // 무게 표시 점 — 앞면에 w개
    const cols = Math.min(3, w), rows = Math.ceil(w / 3);
    for (let i = 0; i < w; i++) {
      const c = i % 3, r = Math.floor(i / 3);
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), this.glowMat);
      d.position.set((c - (cols - 1) / 2) * 0.13, (rows - 1) / 2 * 0.13 - r * 0.13, s / 2 + 0.01);
      g.add(d);
    }
    g.userData.weight = w;
    return g;
  }

  // ── 토크 ────────────────────────────────────────────────────────────────
  // 토크 = Σ(무게 × 칸번호). 좌우가 같으면 수평.
  torque(side) {
    let t = 0;
    for (const s of this.slots) if (s.side === side && s.box) t += s.box.w * s.index;
    return t;
  }

  _updateTilt(snap = false) {
    const L = this.torque(-1), R = this.torque(1);
    // 왼쪽이 무거우면 왼쪽(-X)이 내려간다. +Z축 회전이 -X를 -Y로 보낸다.
    const raw = (L - R) * 0.045;
    this.targetTilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, raw));
    if (snap) this.tilt = this.targetTilt;

    const wasBalanced = this.balanced;
    // 양쪽에 무언가 놓여 있고 토크가 같을 때만 수평이다.
    // 둘 다 0인 상태(아무것도 안 놓음)를 정답으로 치면 문제가 성립하지 않는다.
    this.balanced = L > 0 && R > 0 && Math.abs(L - R) < BALANCE_EPS;
    if (this.balanced && !wasBalanced) this._onBalanced();
    return { L, R };
  }

  _onBalanced() {
    for (const e of this.eyes) e.material = this.glowMat;
    this.glowMat.color.set(0xffd27a);        // 청록 → 금색. 색 하나가 "해냈다"를 말한다
    this.onBalance();
  }

  // ── 상호작용 ────────────────────────────────────────────────────────────
  // "즉시 배치" — 집으면 몸에 붙고 슬롯에서 놓는다. 떨어뜨리기·던지기는 없다.
  // 4학년이 다뤄야 하므로 조작이 하나여야 한다: E.
  _nearest(pos) {
    const p = _p.copy(pos).sub(this.origin);
    let best = null, bd = REACH;
    // 슬롯 — 막대가 기울어 있으므로 실제 월드 위치로 잰다
    for (const s of this.slots) {
      _q.set(s.x, BEAM_Y, 0).applyAxisAngle(_Z, this.tilt);
      const d = Math.hypot(p.x - _q.x, p.z - _q.z);
      if (d < bd) { bd = d; best = { kind: 'slot', slot: s }; }
    }
    // 선반
    for (const it of this.stock) {
      if (it.taken) continue;
      _q.copy(it.home).add(SHELF);
      const d = Math.hypot(p.x - _q.x, p.z - _q.z);
      if (d < bd) { bd = d; best = { kind: 'stock', item: it }; }
    }
    return best;
  }

  // 지금 무엇을 할 수 있나 — 프롬프트 문구를 돌려준다(없으면 null)
  // ★ 예전엔 여기서 null을 네 군데나 돌려줬다. 그중 둘은 **가장 흔한 상태**다 —
  //   상자를 든 채 이미 찬 칸 앞에 섰을 때, 그리고 고정된 추를 건드렸을 때.
  //   화면이 침묵하면 아이는 "고장났다"로 읽는다. 못 하는 것도 못 한다고 말해 준다.
  prompt(pos) {
    if (this.balanced) return null;
    const held = this.held ? `${this.held.w}kg 들고 있어요` : null;
    const n = this._nearest(pos);
    if (!n) return held ? `${held} — 막대의 빈 칸으로 가서 E` : '선반에서 추를 골라 E로 들어요';
    if (n.kind === 'stock') return held ? `${held} — 막대의 빈 칸으로 가서 E` : `E — ${n.item.w}kg 추 들기`;
    const s = n.slot;
    if (this.held) {
      if (s.box) return `${held} — 이 칸엔 이미 있어요, 빈 칸으로`;
      return `E — 여기 놓기 (${s.side < 0 ? '왼쪽' : '오른쪽'} ${s.index}칸)`;
    }
    if (s.box && s.fixed) return '이건 고정된 추예요 — 반대쪽으로 수평을 맞춰요';
    if (s.box) return `E — ${s.box.w}kg 되가져오기`;
    return '여기는 비었어요 — 선반에서 추를 가져와요';
  }

  // E를 눌렀다. 무언가 했으면 true.
  interact(pos) {
    if (this.balanced) return false;
    const n = this._nearest(pos);
    if (!n) return false;

    if (n.kind === 'stock') {
      if (this.held) return false;
      const it = n.item;
      it.taken = true;
      it.mesh.parent.remove(it.mesh);
      this.held = { w: it.w, mesh: it.mesh, stock: it };
      return true;
    }

    const s = n.slot;
    if (this.held) {
      if (s.box) return false;
      this.beam.add(this.held.mesh);
      this.held.mesh.position.set(s.x, 0.16 + boxSize(this.held.w) / 2, 0);
      this.held.mesh.rotation.set(0, 0, 0);
      s.box = { w: this.held.w, mesh: this.held.mesh, stock: this.held.stock };
      this.held = null;
      this._updateTilt();
      return true;
    }
    if (s.box && !s.fixed) {
      this.beam.remove(s.box.mesh);
      this.held = { w: s.box.w, mesh: s.box.mesh, stock: s.box.stock };
      s.box = null;
      this._updateTilt();
      return true;
    }
    return false;
  }

  // 들고 있는 상자를 몸 앞에 붙여 그린다. 씬에 직접 붙이므로 방을 나가면 같이 사라진다.
  update(dt, actor, scene) {
    // 기울기는 부드럽게 따라간다. 즉시 꺾이면 무게가 실린 느낌이 안 난다.
    this.tilt += (this.targetTilt - this.tilt) * Math.min(1, dt * 6);
    this.beam.rotation.z = this.tilt;

    if (this.held) {
      if (this.held.mesh.parent !== scene) scene.add(this.held.mesh);
      const h = this.held.mesh;
      h.position.copy(actor.position)
        .addScaledVector(actor.heading, 0.55);
      h.position.y = 0.95;
      h.rotation.y = Math.atan2(actor.heading.x, actor.heading.z);
    }
  }

  // 방을 처음부터 다시 — 실패해도 벌은 없다. 상자를 선반으로 되돌린다.
  reset() {
    if (this.held) {
      this.held.mesh.parent && this.held.mesh.parent.remove(this.held.mesh);
      this._returnToShelf(this.held.stock, this.held.mesh);
      this.held = null;
    }
    for (const s of this.slots) {
      if (s.box && !s.fixed) {
        this.beam.remove(s.box.mesh);
        this._returnToShelf(s.box.stock, s.box.mesh);
        s.box = null;
      }
    }
    this._updateTilt(true);
  }

  // 관문과 같은 계약을 지킨다 — 신전도 결국 "풀렸나"를 묻는 물건이다(Room.js).
  solvedBy() { return this.balanced; }
  restart() { this.reset(); }

  _returnToShelf(stock, mesh) {
    if (!stock) return;
    stock.parent.add(mesh);
    mesh.position.copy(stock.home);
    mesh.rotation.set(0, 0, 0);
    stock.taken = false;
  }

  // 검증용 — 지금 상태를 한눈에
  state() {
    return {
      left: this.torque(-1), right: this.torque(1),
      balanced: this.balanced,
      tiltDeg: +(this.tilt * 180 / Math.PI).toFixed(1),
      held: this.held ? this.held.w : null,
      slots: this.slots.map(s => `${s.side < 0 ? 'L' : 'R'}${s.index}:${s.box ? s.box.w : '-'}${s.fixed ? '*' : ''}`),
      target: FIXED.w * FIXED.slot,
    };
  }
}

const _p = new THREE.Vector3(), _q = new THREE.Vector3();
const _Z = new THREE.Vector3(0, 0, 1);
