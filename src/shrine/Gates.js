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
import { shuffle, range, randInt, until } from '../util/rand.js';

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
// ★ 난이도는 **사당 번호가 아니라 지금까지 깬 개수**로 오른다(tier 0~5).
//   아이가 어느 순서로 돌든 점점 어려워져야 하고, 같은 사당을 다시 와도
//   그동안 실력이 붙었으면 그만큼 올라와 있어야 한다.
//   tier를 쓰는 건 몸으로 푸는 관문뿐이다 — 생각해서 푸는 방을 재촉하면
//   그건 어려워지는 게 아니라 조급해지는 것이다.
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
    this.survive = SURVIVE;
    this.showBase = 2.6;
    this.left = this.survive; this.cleared = false; this.locked = false;
    this.fall = 0;                       // >0이면 떨어지는 중
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
    this.barrier.userData.veil = true;   // 카메라가 뒤로 물러나면 이 판 너머에 선다
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

  // 죽으면 **진짜로 떨어진다.** 글자만 뜨고 제자리에 서 있으면 아이는
  // "안 죽었는데?"라고 한다. 빨간 칸이 0.55u 가라앉는데 발은 허공에 그대로 있었다.
  _die(actor, msg) {
    this.fall = 0.5;
    this.reset();
    return { fail: msg };
  }

  update(dt, actor) {
    if (this.cleared) return {};
    const p = actor.position;

    // 떨어지는 중 — 이 동안은 어떤 판정도 없다. 다 떨어지면 입구 발판에 다시 세운다.
    if (this.fall > 0) {
      this.fall -= dt;
      p.y -= 7 * dt;
      actor.syncMesh();
      if (this.fall <= 0) actor.setAt(0, this.seg.z1 - 1.2, -1);
      return {};
    }
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
      if (onGrid && this._ropeHit(p)) return this._die(actor, '줄에 걸렸어요 — 올 때 뛰어넘어요');
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
        this.t = Math.max(1.0, this.showBase - this.round * 0.16);
        this._paint('show');
      } else if (this.phase === 'show') {
        this.phase = 'judge'; this.t = T_JUDGE;
        this._paint('judge');
      } else {
        this.phase = 'ready'; this.t = T_READY;
        this._paint('idle');
      }
    }

    // 판정은 한 순간이 아니라 judge 내내 계속된다.
    // ★ 처음엔 show→judge로 넘어가는 **그 한 프레임만** 봤다. 그래서 이미 가라앉은
    //   빨간 칸 위를 0.9초 동안 마음껏 걸어 다녀도 아무 일이 없었다.
    //   "빨간 발판에 있는데 안 죽음"이 정확히 이거였다(실사용 확인).
    if (this.phase === 'judge') {
      const cell = this._cell(p);
      if (cell !== null && !this.safe.has(cell)) return this._die(actor, '빨간 발판이 가라앉았어요');
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
    if (this.fall > 0) return '떨어졌어요!';
    if (!this.locked) return '들어가면 문이 닫혀요 — 20초 버티기';
    // ★ 예전엔 "준비… · 17초"였다. 17이 시작 카운트다운인지 생존 시간인지 안 읽힌다
    //   ("왜 17초임"). 숫자 하나에 두 가지 뜻을 담지 않는다 — 시작 카운트는 초 단위
    //   맨숫자로, 생존 시계는 항상 "N초 남음"으로 못 박는다.
    if (this.round === 0) return `⬛ 곧 시작해요 · ${Math.max(1, Math.ceil(this.t))}`;
    const rope = this._ropeOn() ? ' · 줄은 뛰어넘기' : '';
    const clock = `${Math.ceil(this.left)}초 남음`;
    if (this.phase === 'show') return `${clock} · 🟩 초록으로!${rope}`;
    if (this.phase === 'judge') return `${clock} · 🟥 빨강 가라앉는 중${rope}`;
    return `${clock} · 다음 라운드${rope}`;
  }

  // 실패해도 방에서 쫓아내지 않는다. 시계만 되돌린다.
  reset() {
    this.left = this.survive; this.round = 0;
    this.phase = 'ready'; this.t = T_READY;
    this.ropeA = 0; this.rope.visible = false;
    this._paint('idle');
  }

  // 깬 사당이 늘수록 오래 버텨야 하고, 색을 보여 주는 시간이 짧아진다.
  setTier(t) {
    this.survive = SURVIVE + t * 2.5;
    this.showBase = 2.6 - t * 0.13;
    if (!this.locked) this.left = this.survive;
  }

  solvedBy() { return this.cleared; }

  // reset()은 한 판 안에서의 실패다(시계만 되돌린다).
  // restart()는 **다음 사당**을 위한 완전 초기화 — 잠금과 장벽까지 처음으로.
  restart() {
    this.cleared = false;
    this.locked = false;
    this.fall = 0;
    this.barrier.visible = false;
    if (this.entryRect) this.entryRect.open = true;
    this.reset();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 2 — 레이저 회랑
//
// 낮은 줄은 점프로 넘고, 높은 줄은 그냥 지나간다. 속도가 서로 달라 틈이 어긋난다.
// 학습 없음. 순수하게 몸이다 — 이 방이 리듬을 만든다.
// ══════════════════════════════════════════════════════════════════════════
export class LaserGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const w = seg.x1 - seg.x0;
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    // ★ 세 번 고쳤다. 처음엔 줄이 좌우로 미끄러져 벽에 붙어 걸으면 한 번도 안 뛰고
    //   통과됐다. 방을 꽉 가로지르게 고쳤더니 넷은 벽이라 "너무 어려움"이었다.
    //   하나만 남겼더니 이번엔 점프 한 번이면 끝나는 방이 됐다.
    //
    //   답은 개수가 아니라 **구획**이었다. 복도를 셋으로 나누고 줄을 하나씩 넣는다.
    //   구획 사이에는 줄이 안 들어오는 쉼터가 있어, 한 번에 셋을 상대하지 않는다.
    //   대신 갈수록 빨라지고, 가운데 줄은 **높다** — 여기서 뛰면 맞는다.
    //   "무조건 뛰기"가 답이 아니라야 아이가 줄을 보게 된다.
    const zTop = seg.z1 - 1.6, zBot = seg.z0 + 1.6;
    const span = (zTop - zBot) / 3;
    // 판마다 **높은 줄이 어느 구획인지** 달라진다. 속도도 흔든다.
    // 자리가 고정이면 두 번째 판부터는 보지 않고 몸이 기억한 대로 뛴다.
    const hi = randInt(3);
    const spd = [range(0.26, 0.34), range(0.36, 0.46), range(0.48, 0.58)];
    const spec = [0, 1, 2].map((i) => (i === hi
      ? { y: 2.20, speed: spd[i], jump: false }     // 높다 — 뛰면 맞는다
      : { y: 0.75, speed: spd[i], jump: true }));   // 낮다 — 뛰어넘는다
    this.beams = spec.map((sp, i) => {
      const z1 = zTop - i * span, z0 = z1 - span;
      const mid = (z0 + z1) / 2, amp = (z1 - z0) / 2 - 0.6;
      const mat = glowMat(0xe0736b, { transparent: true, opacity: 0.85 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, w, 6), mat);
      m.rotation.z = Math.PI / 2;              // 눕혀서 방을 가로지른다
      m.position.set(0, sp.y, mid);
      g.add(m);
      // 바닥 띠 — 이 구획이 어디까지인지, 낮은 줄인지 높은 줄인지 색으로 알린다
      const hint = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, span - 0.2),
        glowMat(sp.jump ? 0x8a4a44 : 0x3a4a5a, { transparent: true, opacity: 0.5 }));
      hint.position.set(0, 0.03, mid);
      g.add(hint);
      // 몇 번째 구획인지 벽에 점으로
      for (let k = 0; k <= i; k++) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.06), mat);
        d.position.set(seg.x1 - 0.35, 2.9, mid - 0.3 + k * 0.3);
        g.add(d);
      }
      return { ...sp, base: sp.speed, i, mesh: m, mid, amp, z0, z1, t: i * 1.1 };
    });
    this.zOut = zBot;
  }

  setTier(t) { for (const b of this.beams) b.speed = b.base * (1 + t * 0.11); }

  update(dt, actor) {
    const p = actor.position;
    let hit = null;
    for (const b of this.beams) {
      b.t += dt * b.speed * Math.PI;
      const z = b.mid + Math.sin(b.t) * b.amp;
      b.mesh.position.z = z;
      // 방을 꽉 채우므로 x는 안 본다. 발끝(y)과 머리(y+1.5) 사이에 걸리면 맞은 것.
      if (Math.abs(p.z - z) < 0.45 && b.y > p.y + 0.15 && b.y < p.y + 1.5) {
        hit = b.jump ? '낮은 줄이에요 — Space로 뛰어넘어요' : '높은 줄이에요 — 뛰지 말고 지나가요';
      }
    }
    return hit ? { fail: hit } : {};
  }

  _zone(z) { return this.beams.find((b) => z <= b.z1 && z >= b.z0); }

  prompt(pos) {
    if (pos.z < this.zOut) return null;
    const b = this._zone(pos.z);
    if (!b) return '🔴 구획 셋 — 낮은 줄은 뛰고, 높은 줄은 뛰지 말아요';
    const near = Math.abs(pos.z - b.mesh.position.z) < 3.0;
    const what = b.jump ? '낮은 줄 — Space로 뛰어넘어요' : '높은 줄 — 뛰지 말고 지나가요';
    return `🔴 ${b.i + 1}/3 · ${near ? '지금이에요! ' : ''}${what}`;
  }

  solvedBy(actor) { return actor.position.z < this.zOut; }
  restart() { this.beams.forEach((b, i) => { b.t = i * 1.1; }); }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 3 — 무게 압력판
//
// 여기서 '무게'가 처음 등장한다. 신전의 저울을 미리 알려 주는 자리다 —
// 신전에서 무게를 처음 보면 아이가 규칙부터 배워야 한다.
// 학습: 덧셈. 5 = 2+3, 3 = 1+2 … 답이 여러 개다.
// ══════════════════════════════════════════════════════════════════════════
// ★ 처음엔 [1,2,3,4]에 목표가 5와 3이었다. 답이 5={1,4}·3={3} **하나뿐**이라
//   5를 2+3으로 맞추는 순간 남는 건 1과 4뿐이고 3을 만들 길이 없다.
//   아이 눈에는 "한 판은 금색인데 문이 안 열린다"로만 보인다(실사용 확인).
//   5를 더해 길을 여러 갈래로 열고, 막혔을 때는 막혔다고 말해 준다.
const PLATE_WEIGHTS = [1, 2, 3, 4, 5];
// ★ 처음엔 한 판(5와 3)으로 끝이었다. 한 번 맞히면 방이 끝나 E 네 번짜리였다.
//   주문이 세 번 온다. 셋 다 상자 다섯으로 풀리지만 조합이 매번 다르고,
//   숫자가 커질수록 상자를 더 많이 써야 한다(전수 확인: 정답 3·2·3가지).
//   그리고 숫자는 **판마다 다시 뽑는다.** 고정이면 두 번째부터는 외운 대로 올린다.
//   뽑은 뒤 반드시 풀리는지 전수로 확인한다 — 못 풀 판을 한 번이라도 내주면
//   아이는 게임이 고장났다고 생각한다.
const PW = [1, 2, 3, 4, 5];
// ★ 처음엔 무작위로 (a,b)를 뽑고 풀리는지 검사해 다시 뽑는 식이었다.
//   난이도가 오르면 목표 합이 상자 총합(15)을 넘어서 **뽑을 수 있는 값이
//   아예 없어졌고**, 그러면 재시도 한도에 걸려 못 푸는 주문을 그대로 내놨다.
//   그래서 뽑기 전에 **풀리는 짝을 전부 구해 놓고 그 안에서만 고른다.**
//   "못 풀 판은 한 판도 내주지 않는다"를 검사가 아니라 구조로 보장한다.
const SOLVABLE = (() => {
  const set = new Set();
  for (let m = 0; m < 243; m++) {
    let k = m, A = 0, B = 0;
    for (let i = 0; i < 5; i++) { const t = k % 3; k = (k / 3) | 0;
      if (t === 0) A += PW[i]; else if (t === 1) B += PW[i]; }
    if (A >= 2 && B >= 2) set.add(A + ',' + B);
  }
  return [...set].map((s) => s.split(',').map(Number));
})();

// 주문 셋 — 합이 갈수록 커진다. 난이도가 올라도 마지막 밴드는 15를 못 넘으므로
// 앞 두 밴드만 밀어 올리고, 서로 겹치지 않게 위를 눌러 둔다.
function makeRounds(tier = 0) {
  const t = Math.max(0, Math.min(5, tier));
  const bands = [[6 + t * 0.8, 9 + t * 0.6], [10 + t * 0.5, 12 + t * 0.4], [13, 15]];
  return bands.map(([lo, hi]) => {
    const in_ = SOLVABLE.filter(([a, b]) => a + b >= lo && a + b <= Math.min(15, hi));
    const pool = in_.length ? in_ : SOLVABLE;
    return pool[randInt(pool.length)];
  });
}
const pboxSize = (w) => 0.44 + w * 0.06;

export class PlateGate {
  constructor(scene, seg) {
    this.seg = seg;
    this.held = null;
    // ★ 1.6이었다. 판 지름이 1.9라 **판 위에 거의 올라서야만** E가 먹었고,
    //   한 발짝 물러나 판을 바라보는 자세에서는 프롬프트조차 안 떴다.
    //   "넣고 다시 집어서 빼는 게 안 됨"이 이거였다(실사용 확인).
    //   집는 거리는 인색할 이유가 없다 — 인색해서 얻는 건 아무것도 없다.
    this.REACH = 2.6;
    this.glow = glowMat(SHRINE.glow);
    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    const cz = (seg.z0 + seg.z1) / 2;
    const dark = toon(SHRINE.stoneDark), lite = toon(SHRINE.stoneLite);

    // 압력판 둘. 필요 무게를 점으로 새긴다 — 숫자는 3D에서 각도에 따라 안 읽힌다.
    this.round = 0;
    this.tier = 0;
    this.rounds = makeRounds();
    this.plates = [];
    for (const [i, spec] of [[0, { need: this.rounds[0][0], x: -3.2 }],
      [1, { need: this.rounds[0][1], x: 3.2 }]]) {
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
      // 필요 무게 점 — 주문마다 개수가 바뀌므로 최대치를 만들어 두고 켜고 끈다
      const dots = [];
      for (let k = 0; k < 9; k++) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.13), ringMat);
        d.position.set((k % 3 - 1) * 0.28, 0.16, Math.floor(k / 3) * 0.28 - 0.28);
        d.visible = k < spec.need;
        pg.add(d);
        dots.push(d);
      }
      this.plates.push({ need: spec.need, x: spec.x, z: cz - 1.6, boxes: [], ringMat, group: pg, dots });
    }

    // 라운드 표시 — 세 번이라는 걸 처음부터 알려 준다
    this.pips = [0, 1, 2].map((k) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.1), glowMat(0x3a3020));
      m.position.set((seg.x0 + seg.x1) / 2 - 0.24 + k * 0.24, 2.6, cz - 2.6);
      g.add(m);
      return m;
    });

    // 상자 — 바닥에 흩어 둔다. 선반을 또 만들지 않는다(신전에 이미 있다).
    this.stock = [];
    PLATE_WEIGHTS.forEach((w, i) => {
      const m = this._box(w);
      const x = -4.8 + i * 2.4, z = cz + 2.6;
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
    if (this.solvedBy()) return null;
    // 막다른 길에 들어섰으면 그 사실부터 말한다. 아이가 스스로 알아낼 수 없는 종류다.
    const say = `주문 ${Math.min(3, this.round + 1)}/3`;
    const stuck = !this._canFinish() ? ' — 지금은 못 맞춰요, 되가져와요' : '';
    const n = this._nearest(pos);
    // 손에 뭘 들었는지, 어디로 가야 하는지 항상 말해 준다. 방 안에서 침묵하지 않는다.
    if (!n) {
      if (this.held) return `${this.held.w}kg 상자를 들고 있어요 — 판 가까이 가서 E`;
      return stuck ? '⚠ 판에서 상자를 되가져와 다시 해 봐요 (E)'
        : `📦 ${say} · ${this.plates[0].need}과 ${this.plates[1].need}을 만들어요`;
    }
    if (n.kind === 'stock') return this.held ? `${this.held.w}kg 상자를 들고 있어요 — 판 위에서 E` : `E — ${n.item.w}kg 상자 들기`;
    const p = this._sum(n.plate), need = n.plate.need;
    if (this.held) return `E — 판에 올리기 (${p} / ${need})${stuck}`;
    if (n.plate.boxes.length) return `E — 되가져오기 (${p} / ${need})${p > need ? ' 너무 무거워요' : stuck}`;
    // 빈 판 앞에 빈손으로 선 자리. 흔한 상태인데 여기서 침묵하고 있었다(전수 조사).
    return `이 판은 ${need}이 필요해요 — 상자를 가져와요`;
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
      const s = this._sum(p);
      // 넘친 판은 붉게. 모자란 것과 넘친 것이 같은 색이면 어느 쪽으로 갈지 알 수 없다.
      p.ringMat.color.set(s === p.need ? 0xffd27a : (s > p.need ? 0xe0736b : SHRINE.glow));
    }
    if (this.round >= this.rounds.length) return;
    if (!this.plates.every((p) => this._sum(p) === p.need)) return;
    // 한 주문을 맞췄다 — 상자를 돌려주고 다음 주문으로. 숫자가 커지니 다시 짜야 한다.
    this.pips[this.round].material.color.set(0xffd27a);
    this.round++;
    if (this.round >= this.rounds.length) return;
    for (const p of this.plates) p.boxes.length = 0;
    for (const it of this.stock) { it.taken = false; it.mesh.position.copy(it.home); }
    this.held = null;
    this.plates.forEach((p, i) => {
      p.need = this.rounds[this.round][i];
      p.dots.forEach((d, k) => { d.visible = k < p.need; });
      p.ringMat.color.set(SHRINE.glow);
    });
  }

  // 지금 놓인 상태에서 **남은 상자만으로** 두 판을 다 채울 수 있나.
  // 상자가 다섯이라 3^5=243가지를 전수로 본다 — 영리할 필요가 없다.
  _canFinish() {
    const onPlate = new Set();
    for (const p of this.plates) for (const b of p.boxes) onPlate.add(b);
    const free = this.stock.filter((it) => !onPlate.has(it));
    const want = this.plates.map((p) => p.need - this._sum(p));
    if (want.some((w) => w < 0)) return false;               // 이미 넘쳤다
    const n = free.length;
    for (let m = 0; m < 3 ** n; m++) {
      const got = [0, 0];
      let k = m;
      for (let i = 0; i < n; i++) { const a = k % 3; k = (k / 3) | 0; if (a < 2) got[a] += free[i].w; }
      if (got[0] === want[0] && got[1] === want[1]) return true;
    }
    return false;
  }

  update(dt, actor) {
    if (this.held) {
      const h = this.held.mesh;
      h.position.copy(actor.position).addScaledVector(actor.heading, 0.55);
      h.position.y = 0.95;
    }
    return {};
  }

  // 깬 사당이 늘수록 주문 숫자가 커진다 — 상자를 더 많이 조합해야 한다.
  // 시간을 죄지 않는다. 생각하는 방을 재촉하면 조급해질 뿐 어려워지지 않는다.
  setTier(t) { this.tier = t; }

  solvedBy() { return this.round >= this.rounds.length; }

  reset() {
    this.round = 0;
    this.rounds = makeRounds(this.tier);   // 다시 도전하면 주문도 새로 뽑는다
    for (const q of this.pips) q.material.color.set(0x3a3020);
    for (const p of this.plates) { p.boxes.length = 0; }
    this.plates.forEach((p, i) => {
      p.need = this.rounds[0][i];
      p.dots.forEach((d, k) => { d.visible = k < p.need; });
    });
    for (const it of this.stock) { it.taken = false; it.mesh.position.copy(it.home); }
    this.held = null;
    this._refresh();
  }
}
