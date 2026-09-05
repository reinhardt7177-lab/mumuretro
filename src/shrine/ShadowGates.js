// 사당 02 「그림자의 사당」 — 과학 4-2 「그림자와 거울」
//
// 이 사당의 전제는 **조명을 끄는 것**이다. 벽이 안 보이고 빛이 닿는 바닥만 보인다.
// 1번 사당과 정반대라 문 하나 지나는 순간 "다른 사당에 왔다"가 전달된다 —
// 분위기를 뒤집는 가장 싼 방법은 폴리곤을 늘리는 게 아니라 불을 끄는 것이다.
//
// 규칙도 뒤집는다. 1번에서는 초록(빛)이 안전했다. 여기서는 **어둠이 안전하다.**
//
// ★ 그림자를 엔진의 그림자 맵에 맡기지 않는다. 포인트라이트 그림자는 비싸고,
//   무엇보다 **판정과 눈에 보이는 것이 어긋난다.** 그림자를 직접 바닥에 그리고
//   그 그림자로 판정한다 — 보이는 것이 곧 규칙이어야 아이가 배울 수 있다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { shuffle, range, randInt, pick } from '../util/rand.js';

const glowMat = (c, o = {}) => {
  const m = new THREE.MeshBasicMaterial({ color: c, ...o });
  m.userData.outlineParameters = { visible: false };
  return m;
};
const flatMat = (c, op) => {
  const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op,
    side: THREE.DoubleSide });
  m.userData.outlineParameters = { visible: false };
  return m;
};

// ══════════════════════════════════════════════════════════════════════════
// 관문 1 — 그림자 밟기
//
// 천장의 등불이 방을 돈다. 기둥이 만드는 그림자 안에 있으면 안전하고,
// 빛에 서 있으면 벽의 눈이 뜨인다. 그림자는 등불과 함께 움직이므로
// 한 자리에 머물 수 없다 — 계속 따라다녀야 한다.
//
// 즉사가 아니라 **노출 시간**으로 판정한다. 그림자가 움직이는데 즉사면 운이 되고,
// 운으로 지면 아이는 배우지 못한다. 0.75초의 여유를 주고, 그동안 벽의 눈이
// 밝아지므로 "지금 위험하다"가 눈에 보인다.
// ══════════════════════════════════════════════════════════════════════════
const EXPOSE = 0.75;          // 이만큼 빛에 서 있으면 발각
const SH_LEN = 9.0;           // 그림자 길이
const LAMP_Y = 4.6;

export class ShadeGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.cx = (seg.x0 + seg.x1) / 2;
    this.cz = (seg.z0 + seg.z1) / 2;
    // 앞뒤 안전 구역 — 들어서자마자 발각되면 규칙을 볼 새가 없다.
    this.safeIn = seg.z1 - 2.2;
    this.safeOut = seg.z0 + 2.2;
    this.expose = 0;
    this.a = 0;
    this.speed = 0.42;

    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    // 기둥 넷 — 그림자를 만드는 유일한 물건. 방에 이것 말고는 아무것도 없다.
    const stone = toon(th.stoneLite);
    this.pillars = [];
    for (const [dx, dz] of [[-2.6, 3.4], [2.4, 0.4], [-2.2, -3.2], [2.8, -6.0]]) {
      const r = 0.62;
      const x = this.cx + dx, z = this.cz + dz;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.12, seg.h, 7), stone);
      m.position.set(x, seg.h / 2, z);
      m.castShadow = true;
      g.add(m);
      // 그림자 — 바닥에 직접 그린다. 이게 곧 판정의 근거다.
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.15, SH_LEN), flatMat(0x000000, 0.86));
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = 0.02;
      sh.renderOrder = 1;
      g.add(sh);
      this.pillars.push({ x, z, r, mesh: m, shadow: sh });
    }

    // 등불 — 이 방의 유일한 광원. 보이는 공이 있어야 어디서 오는 빛인지 안다.
    this.lampBall = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), glowMat(th.glow));
    g.add(this.lampBall);
    this.lamp = new THREE.PointLight(th.glow, 26, 26, 1.5);
    g.add(this.lamp);

    // 벽의 눈 — 노출이 쌓이면 뜬다. 경고가 보여야 여유가 여유로 쓰인다.
    this.eyeMat = flatMat(0xe0736b, 0);
    this.eye = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), this.eyeMat);
    this.eye.position.set(this.cx, 3.0, seg.z0 + 0.05);
    g.add(this.eye);
  }

  _lampPos() {
    const r = 3.6;
    return { x: this.cx + Math.cos(this.a) * r, z: this.cz + Math.sin(this.a) * r * 1.5 };
  }

  // 이 점이 어느 기둥의 그림자 안인가. 등불에서 기둥을 지나 뻗는 띠 안이면 그늘이다.
  inShadow(x, z, L) {
    for (const p of this.pillars) {
      const wx = p.x - L.x, wz = p.z - L.z;
      const wl = Math.hypot(wx, wz);
      if (wl < 1e-4) continue;
      const ux = wx / wl, uz = wz / wl;
      const vx = x - L.x, vz = z - L.z;
      const t = vx * ux + vz * uz;                  // 등불에서 잰 거리
      if (t < wl || t > wl + SH_LEN) continue;      // 기둥 앞이거나 그림자 끝 너머
      if (Math.abs(vx * uz - vz * ux) < p.r + 0.16) return true;
    }
    return false;
  }

  update(dt, actor) {
    const p = actor.position;
    this.a += dt * this.speed;
    const L = this._lampPos();
    this.lampBall.position.set(L.x, LAMP_Y, L.z);
    this.lamp.position.set(L.x, LAMP_Y, L.z);

    // 그림자를 등불 반대쪽으로 눕힌다
    for (const q of this.pillars) {
      const dx = q.x - L.x, dz = q.z - L.z;
      const d = Math.hypot(dx, dz) || 1;
      const ux = dx / d, uz = dz / d;
      q.shadow.position.set(q.x + ux * SH_LEN / 2, 0.02, q.z + uz * SH_LEN / 2);
      q.shadow.rotation.z = -Math.atan2(ux, uz);
    }

    const inRoom = p.z < this.safeIn && p.z > this.safeOut;
    const safe = !inRoom || this.inShadow(p.x, p.z, L);
    this.expose = safe ? Math.max(0, this.expose - dt * 2.2) : this.expose + dt;
    this.eyeMat.opacity = Math.min(1, this.expose / EXPOSE) * 0.95;

    if (this.expose >= EXPOSE) {
      this.expose = 0;
      this.eyeMat.opacity = 0;
      return { fail: '빛에 들켰어요 — 그림자 안으로' };
    }
    return {};
  }

  prompt(pos) {
    if (pos.z < this.safeOut) return null;
    if (pos.z >= this.safeIn) return '🕯 그림자 안으로만 — 빛에 서면 들켜요';
    return this.expose > 0.1 ? '⚠ 들키는 중! 그림자로!' : '🕯 그림자를 따라가요';
  }

  solvedBy(actor) { return actor.position.z < this.safeOut; }
  reset() { this.expose = 0; this.eyeMat.opacity = 0; }
  restart() { this.reset(); this.a = 0; }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 2 — 거울 세 장
//
// 입구에서 들어온 빛줄기를 거울로 꺾어 표적에 꽂는다. 거울은 15°씩 돈다.
// 입사각과 반사각이 같다는 것을 손으로 익히는 자리다.
//
// 거울이 셋인 데는 이유가 있다 — 마지막 거울부터 맞추면 앞이 어긋난다.
// **순서**가 있어야 아이가 "왜 안 되지"에서 "아, 앞엣것부터"로 간다.
// ══════════════════════════════════════════════════════════════════════════
// ★ 처음엔 15°였다. 24자리를 거울 셋에서 돌리면 아이가 길을 잃고,
//   무엇보다 15°의 배수로는 **풀리는 조합이 없을 수도** 있다(각도는 임의로 못 고른다).
//   45°로 하면 자리가 여덟이라 금방 훑히고, 아래 배치는 45°의 배수로 반드시 풀린다.
const STEP = Math.PI / 4;         // 45°
const MAX_BOUNCE = 8;
const HIT_R = 1.0;

export class MirrorGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.REACH = 2.4;
    const cx = (seg.x0 + seg.x1) / 2;

    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    // ★ 처음엔 광원과 표적을 방 한가운데 일직선으로 놓았다. 그래서 거울을 하나도
    //   안 돌린 상태에서 빛이 곧장 표적에 꽂혔다 — 들어서는 순간 이미 풀려 있었다.
    //   자리는 **답에서 역산해서** 잡는다. 아래 경로가 정답이다.
    //     (0,−1)로 내려와 M1에서 45° → (−1,0)
    //     M2에서 45° → (0,−1)
    //     M3에서 135° → (1,0) → 표적
    //   세 각이 전부 45°의 배수라 반드시 풀리고, 순서를 지켜야만 이어진다.
    // 판마다 L자가 꺾이는 쪽과 다리 길이가 달라진다 —
    // 자리가 고정이면 두 번째 판부터는 각도를 외운 대로 돌린다.
    // 어느 쪽으로 꺾든 정답은 45°의 배수다(왼쪽 45·45·135 / 오른쪽 135·135·45).
    const sgn = pick([-1, 1]);
    const d1 = range(2.6, 3.6), dx = range(2.8, 3.6), d2 = range(8.0, 10.5);
    this.src = { x: cx, z: seg.z1 - 0.4 };
    this.target = { x: cx - sgn * range(3.0, 3.8), z: seg.z1 - d2 };

    const post = toon(th.stoneLite);
    this.mirrors = [];
    for (const pl of [
      { x: cx, z: seg.z1 - d1 },
      { x: cx + sgn * dx, z: seg.z1 - d1 },
      { x: cx + sgn * dx, z: seg.z1 - d2 },
    ]) {
      const grp = new THREE.Group();
      grp.position.set(pl.x, 0, pl.z);
      g.add(grp);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.0, 6), post);
      stand.position.y = 0.5;
      grp.add(stand);
      const face = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 0.09), glowMat(0xdfe9ee));
      face.position.y = 1.5;
      grp.add(face);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.12), toon(th.stoneDark));
      back.position.set(0, 1.5, -0.09);
      grp.add(back);
      this.mirrors.push({ x: pl.x, z: pl.z, a: 0, grp, half: 0.85 });
    }

    // 빛줄기 — 반사할 때마다 마디가 하나씩 는다. 미리 만들어 두고 길이만 바꾼다.
    this.segs = [];
    for (let i = 0; i < MAX_BOUNCE; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 5),
        glowMat(th.glow, { transparent: true, opacity: 0.9 }));
      m.visible = false;
      g.add(m);
      this.segs.push(m);
    }

    this.targetMat = glowMat(0x6b6455);
    const t = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), this.targetMat);
    t.position.set(this.target.x, 1.5, this.target.z);
    g.add(t);
    this.hit = false;
    this._trace();
  }

  // 빛줄기를 따라가며 거울에 맞으면 꺾는다. 반사: d' = d − 2(d·n)n
  _trace() {
    let px = this.src.x, pz = this.src.z;
    let dx = 0, dz = -1;
    let used = 0;
    this.hit = false;
    let skip = -1;                                   // 같은 거울에 두 번 튀지 않게

    for (let b = 0; b < MAX_BOUNCE; b++) {
      let best = null, bt = Infinity;
      for (let i = 0; i < this.mirrors.length; i++) {
        if (i === skip) continue;
        const m = this.mirrors[i];
        // 거울 면: 중심 m, 방향 (cos a, sin a), 법선 (−sin a, cos a)
        const tx = Math.cos(m.a), tz = Math.sin(m.a);
        const nx = -Math.sin(m.a), nz = Math.cos(m.a);
        const den = dx * nx + dz * nz;
        if (Math.abs(den) < 1e-6) continue;
        const t = ((m.x - px) * nx + (m.z - pz) * nz) / den;
        if (t <= 0.05) continue;
        const hx = px + dx * t, hz = pz + dz * t;
        if (Math.abs((hx - m.x) * tx + (hz - m.z) * tz) > m.half) continue;
        if (t < bt) { bt = t; best = { i, nx, nz, hx, hz }; }
      }

      // 표적에 먼저 닿는가
      const vx = this.target.x - px, vz = this.target.z - pz;
      const proj = vx * dx + vz * dz;
      if (proj > 0 && Math.abs(vx * dz - vz * dx) < HIT_R && (!best || proj < bt)) {
        this._seg(used++, px, pz, this.target.x, this.target.z);
        this.hit = true;
        break;
      }
      if (!best) {                                   // 벽까지 뻗고 끝
        this._seg(used++, px, pz, px + dx * 40, pz + dz * 40);
        break;
      }
      this._seg(used++, px, pz, best.hx, best.hz);
      const dot = dx * best.nx + dz * best.nz;
      dx -= 2 * dot * best.nx; dz -= 2 * dot * best.nz;
      px = best.hx; pz = best.hz;
      skip = best.i;
    }
    for (let i = used; i < this.segs.length; i++) this.segs[i].visible = false;
    this.targetMat.color.set(this.hit ? 0xffd27a : 0x6b6455);
  }

  _seg(i, x0, z0, x1, z1) {
    if (i >= this.segs.length) return;
    const m = this.segs[i];
    const dx = x1 - x0, dz = z1 - z0;
    m.visible = true;
    m.scale.set(1, Math.hypot(dx, dz), 1);
    m.position.set((x0 + x1) / 2, 1.5, (z0 + z1) / 2);
    m.rotation.set(Math.PI / 2, 0, -Math.atan2(dx, dz));
  }

  _near(pos) {
    let best = null, bd = this.REACH;
    for (const m of this.mirrors) {
      const d = Math.hypot(pos.x - m.x, pos.z - m.z);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  interact(pos) {
    const m = this._near(pos);
    if (!m) return false;
    m.a = (m.a + STEP) % (Math.PI * 2);
    m.grp.rotation.y = -m.a;
    this._trace();
    return true;
  }

  update() { return {}; }

  prompt(pos) {
    if (this.hit) return null;
    const m = this._near(pos);
    if (!m) return '🔦 거울을 돌려 빛을 표적에 꽂아요';
    return `E — 거울 돌리기 (${Math.round(m.a * 180 / Math.PI) % 360}°)`;
  }

  solvedBy() { return this.hit; }
  reset() {}
  restart() {
    for (const m of this.mirrors) { m.a = 0; m.grp.rotation.y = 0; }
    this._trace();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 관문 3 — 그림자 크기
//
// ★ 처음엔 구멍이 하나였다. 물체를 한 번 밀면 끝이라 E 두 번짜리 방이었다.
//   **구멍이 세 번 바뀐다.** 큰 구멍 → 작은 구멍 → 중간 구멍 순서라
//   "가까이 = 크게"를 한 번 알아낸 뒤에도 세 번을 다시 써야 한다.
//
// 문에 구멍이 뚫려 있고, 물체의 그림자를 그 구멍에 꼭 맞춰야 한다.
// 등불에 **가까이** 놓으면 그림자가 커지고 멀리 놓으면 작아진다 —
// 4-2 단원에서 아이가 가장 자주 틀리는 지점이라 이 방 하나를 통째로 준다.
//
//   그림자 크기 = 물체 크기 × (등불→벽 거리) ÷ (등불→물체 거리)
// ══════════════════════════════════════════════════════════════════════════
export class SilhouetteGate {
  constructor(scene, seg, opts = {}) {
    this.seg = seg;
    const th = opts.theme;
    this.REACH = 2.4;
    this.held = false;
    this.solved = false;
    const cx = (seg.x0 + seg.x1) / 2;

    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    this.lampZ = seg.z1 - 1.2;                  // 등불(입구 쪽)
    this.wallZ = seg.z0 + 0.35;                 // 그림자가 맺히는 벽
    this.objSize = 0.9;
    this.homeZ = this.lampZ - 4.0;
    this.objZ = this.homeZ;
    this.objX = cx;

    this.lampBall = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), glowMat(th.glow));
    this.lampBall.position.set(cx, 2.0, this.lampZ);
    g.add(this.lampBall);
    const pl = new THREE.PointLight(th.glow, 22, 24, 1.5);
    pl.position.set(cx, 2.0, this.lampZ);
    g.add(pl);

    this.obj = new THREE.Mesh(new THREE.BoxGeometry(this.objSize, this.objSize, this.objSize),
      toon(th.stoneLite));
    this.obj.castShadow = true;
    this.obj.position.set(this.objX, 1.5, this.objZ);
    g.add(this.obj);

    // 맞춰야 할 구멍 — **답을 먼저 정하고** 거기서 구멍 크기를 역산한다.
    // 크기를 손으로 찍으면 풀 수 없는 값이 나온다.
    // 답을 먼저 정하고 구멍 크기를 역산한다. 세 번 다.
    // 답 셋을 판마다 뽑고 순서도 섞는다. 크게·작게가 번갈아 나오도록
    // 가까운 것 하나, 먼 것 하나, 중간 하나를 각각 범위에서 뽑는다.
    this.answers = shuffle([
      this.lampZ - range(2.8, 3.8), this.lampZ - range(5.6, 7.0),
      this.lampZ - range(8.0, 9.2)]);
    this.round = 0;
    const D = this.lampZ - this.wallZ;
    this._holeAt = (z) => this.objSize * D / (this.lampZ - z);
    this.holeW = this._holeAt(this.answers[0]);

    this.holeMat = glowMat(th.glow, { transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    this.hole = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.holeMat);
    this.hole.scale.set(this.holeW, this.holeW, 1);
    this.hole.position.set(cx, 1.5, this.wallZ + 0.06);
    g.add(this.hole);
    // 몇 번 남았는지 — 세 번이라는 걸 처음부터 알려 준다
    this.pips = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.08), glowMat(0x3a3730));
      m.position.set(cx - 0.2 + i * 0.2, 2.9, this.wallZ + 0.1);
      g.add(m);
      return m;
    });

    // 그림자 — 벽에 맺힌다. 크기가 실시간으로 바뀐다.
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flatMat(0x000000, 0.82));
    this.shadow.position.set(cx, 1.5, this.wallZ + 0.12);
    g.add(this.shadow);
    this._resize();
  }

  _size() {
    const D = this.lampZ - this.wallZ;
    return this.objSize * D / Math.max(0.4, this.lampZ - this.objZ);
  }

  _resize() {
    const s = this._size();
    this.shadow.scale.set(s, s, 1);
    if (this.solved) return;
    const hit = Math.abs(s - this.holeW) < this.holeW * 0.09;
    this.holeMat.opacity = hit ? 0.95 : 0.5;
    if (!hit) return;
    // 맞으면 손을 놓는다. 안 놓으면 물체를 든 채 다음 방까지 끌고 가고,
    // 그 순간 그림자가 어긋나 방금 푼 것이 다시 안 풀린 것처럼 보인다.
    this.held = false;
    this.pips[this.round].material.color.set(0xffd27a);
    this.round++;
    if (this.round >= this.answers.length) { this.solved = true; return; }
    this.holeW = this._holeAt(this.answers[this.round]);
    this.hole.scale.set(this.holeW, this.holeW, 1);
    this.holeMat.opacity = 0.5;
  }

  update(dt, actor) {
    if (this.held) {
      // 물체는 등불–벽 축을 따라서만 움직인다. 좌우로 흔들면 원리가 흐려진다.
      this.objZ = Math.max(this.wallZ + 1.2, Math.min(this.lampZ - 1.2, actor.position.z));
      this.obj.position.z = this.objZ;
      this._resize();
    }
    return {};
  }

  _near(pos) { return Math.hypot(pos.x - this.objX, pos.z - this.objZ) < this.REACH; }

  interact(pos) {
    if (this.held) { this.held = false; return true; }
    if (!this._near(pos)) return false;
    this.held = true;
    return true;
  }

  prompt(pos) {
    if (this.solved) return null;
    const n = `${this.round + 1}/3`;
    const gap = this._size() > this.holeW
      ? '그림자가 커요 — 등불에서 멀리' : '그림자가 작아요 — 등불 가까이';
    if (this.held) return `${n} · ${gap} (E로 놓기)`;
    return this._near(pos) ? `E — 물체 밀기 (${n})` : `🔦 ${n} · ${gap}`;
  }

  solvedBy() { return this.solved; }
  reset() {}
  restart() {
    this.held = false;
    this.solved = false;
    this.round = 0;
    this.answers = shuffle(this.answers);       // 다시 도전하면 순서도 새로
    for (const p of this.pips) p.material.color.set(0x3a3730);
    this.holeW = this._holeAt(this.answers[0]);
    this.hole.scale.set(this.holeW, this.holeW, 1);
    this.objZ = this.homeZ;
    this.obj.position.z = this.objZ;
    this._resize();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 신전 — 거울을 든 신
//
// 관문 2를 한 번 더 시키지 않는다. 여기서 묻는 것은 그림자의 **방향과 길이**다.
//   손잡이 A — 등불이 신 둘레를 여덟 자리로 돈다 → 그림자의 **방향**
//   손잡이 B — 등불이 세 높이로 오르내린다      → 그림자의 **길이**
// 바닥에 새겨진 자리에 신의 그림자를 정확히 얹으면 구슬이 내려온다.
// 손잡이가 둘이라 "방향은 맞는데 길이가 안 맞네"라는 말이 아이 입에서 나온다.
// ══════════════════════════════════════════════════════════════════════════
const ANGLES = 8;
const HEIGHTS = [2.6, 4.4, 6.6];          // 낮을수록 그림자가 길다
// 정답은 판마다 뽑는다(생성자에서). 고정이면 손잡이를 세는 것으로 풀린다.
const SH_BASE = 26;                       // 그림자 길이 = SH_BASE / 등불 높이

export class MirrorGod {
  constructor(scene, seg, theme) {
    this.seg = seg;
    this.REACH = 2.6;
    this.ai = 0; this.hi = 0;
    this.solved = false;
    // 처음 자리(0,0)가 곧 정답이면 아무것도 안 해도 풀린다 — 그걸 피해 뽑는다.
    this.answer = { a: 1 + randInt(ANGLES - 1), h: randInt(HEIGHTS.length) };
    const cx = (seg.x0 + seg.x1) / 2;
    this.gx = cx;
    this.gz = seg.z0 + (seg.z1 - seg.z0) * 0.30;      // 신은 안쪽에 선다

    const g = new THREE.Group();
    scene.add(g);
    this.group = g;

    // 신 — 사당마다 실루엣이 달라야 한다. 여기서는 위가 넓은 원뿔(거울을 든 형상).
    const stone = toon(theme.stoneLite), dark = toon(theme.stoneDark);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 0.6, 8), dark);
    base.position.set(this.gx, 0.3, this.gz);
    g.add(base);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 0.75, 4.2, 8), stone);
    body.position.set(this.gx, 2.7, this.gz);
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), stone);
    head.position.set(this.gx, 5.3, this.gz);
    g.add(head);
    // 신이 든 거울 — 이 사당의 상징이다. 신 자신보다 이게 먼저 보여야 한다.
    const mir = new THREE.Mesh(new THREE.CircleGeometry(1.05, 16), glowMat(0xeef4f6));
    mir.position.set(this.gx, 3.4, this.gz + 1.32);
    g.add(mir);
    this.godR = 1.25;

    // 등불
    this.lampBall = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), glowMat(theme.glow));
    g.add(this.lampBall);
    this.lamp = new THREE.PointLight(theme.glow, 30, 34, 1.5);
    g.add(this.lamp);

    // 신의 그림자와, 그림자를 얹어야 할 자리
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(this.godR * 2.1, 1), flatMat(0x000000, 0.84));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.03;
    this.shadow.renderOrder = 1;
    g.add(this.shadow);

    this.markMat = glowMat(theme.glowDim, { transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    this.mark = new THREE.Mesh(new THREE.PlaneGeometry(this.godR * 2.4, 1), this.markMat);
    this.mark.rotation.x = -Math.PI / 2;
    this.mark.position.y = 0.015;
    g.add(this.mark);
    this._placeMark();

    // 손잡이 둘 — 신 앞 좌우. 무엇을 바꾸는 손잡이인지 색으로 가른다.
    const lever = (x, c) => {
      const grp = new THREE.Group();
      grp.position.set(x, 0, this.gz + 4.2);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.3, 6), dark);
      st.position.y = 0.65; grp.add(st);
      const kn = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), glowMat(c));
      kn.position.y = 1.5; grp.add(kn);
      g.add(grp);
      return { x, z: this.gz + 4.2, grp, knob: kn };
    };
    this.leverA = lever(cx - 3.4, theme.glow);
    this.leverB = lever(cx + 3.4, theme.glowDim);

    this.obstacles = [{ x: this.gx, z: this.gz, r: 2.1 }];
    this.prizePos = new THREE.Vector3(cx, 0, this.gz + 6.4);
    this._apply();
  }

  _dir(i) { const a = (i / ANGLES) * Math.PI * 2; return { x: Math.cos(a), z: Math.sin(a) }; }
  _len(i) { return SH_BASE / HEIGHTS[i]; }

  _placeMark() {
    const d = this._dir(this.answer.a), L = this._len(this.answer.h);
    this.mark.scale.set(1, L, 1);
    this.mark.position.set(this.gx + d.x * L / 2, 0.015, this.gz + d.z * L / 2);
    this.mark.rotation.z = -Math.atan2(d.x, d.z);
  }

  _apply() {
    const d = this._dir(this.ai), L = this._len(this.hi), H = HEIGHTS[this.hi];
    // 등불은 그림자 **반대쪽**에 있어야 한다
    const lx = this.gx - d.x * 3.2, lz = this.gz - d.z * 3.2;
    this.lampBall.position.set(lx, H, lz);
    this.lamp.position.set(lx, H, lz);
    this.shadow.scale.set(1, L, 1);
    this.shadow.position.set(this.gx + d.x * L / 2, 0.03, this.gz + d.z * L / 2);
    this.shadow.rotation.z = -Math.atan2(d.x, d.z);
    this.solved = this.ai === this.answer.a && this.hi === this.answer.h;
    this.markMat.color.set(this.solved ? 0xffd27a : 0x8b8571);
    this.markMat.opacity = this.solved ? 0.95 : 0.55;
  }

  _near(pos) {
    const da = Math.hypot(pos.x - this.leverA.x, pos.z - this.leverA.z);
    const db = Math.hypot(pos.x - this.leverB.x, pos.z - this.leverB.z);
    if (da < this.REACH && da <= db) return 'a';
    if (db < this.REACH) return 'b';
    return null;
  }

  update() { return {}; }

  prompt(pos) {
    if (this.solved) return null;
    const n = this._near(pos);
    if (n === 'a') return `E — 등불 돌리기 (그림자 방향) ${this.ai + 1}/${ANGLES}`;
    if (n === 'b') return `E — 등불 높이 (그림자 길이) ${this.hi + 1}/${HEIGHTS.length}`;
    return '🕯 신의 그림자를 바닥의 자리에 맞춰요';
  }

  interact(pos) {
    const n = this._near(pos);
    if (!n) return false;
    if (n === 'a') this.ai = (this.ai + 1) % ANGLES;
    else this.hi = (this.hi + 1) % HEIGHTS.length;
    this._apply();
    return true;
  }

  solvedBy() { return this.solved; }
  reset() {}
  restart() { this.ai = 0; this.hi = 0; this._apply(); }
}
