// 부엌 — 내림판 옆 모닥불. 접시 셋과 솥 하나.
//
// ★ 수첩이 "불을 피울 데부터 찾아야겠지"라고 약속만 해 둔 지 오래였다.
//   여기가 그 자리다. 별에 내려서면 바로 보인다 — 숨긴 게 아니다. 숨길 것은
//   재료(들·전설)지 부엌이 아니다.
//
// 조작은 하나다(E). 접시 앞에서 E — 가진 재료를 한 칸씩 돌린다(연구실 다이얼과
// 같은 손짓). 솥 앞에서 E — 접시 셋을 한 솥에 건다. 맞으면 요리, 아니면 그대로.
//
// ★ 틀려도 재료를 안 뺏는다. 채집물 소모로 게임을 못 깨던 막다른 길이 한 번
//   있었다(forage.js). 요리는 보상이지 벌이 아니다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { INGREDIENTS, RECIPES, matchRecipe } from '../data/recipes.js';

const REACH = 1.6;              // 손 닿는 거리 — 밀려나는 거리(0.55+0.32)보다 길어야 한다
const FIRE_BLOCK = 0.55;        // 불 둘레 충돌 반경. REACH − 0.32 보다 작아야 솥을 만진다
const _up = new THREE.Vector3(), _t = new THREE.Vector3(), _b = new THREE.Vector3();
const _gv = new THREE.Vector3(), _gn = new THREE.Vector3();

export function buildKitchen(scene, planet, landing, carpet, forage) {
  const R = planet.R;
  // 내림판에서 6.5u 옆. 판 반경 2.4 + 여유. 착지 섬광이 여기까지 안 온다.
  const dir = landing.dir.clone();
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  const kdir = dir.clone().addScaledVector(east, 6.5 / R).normalize();
  const fr = planet.frameAt(planet.surfaceAt(kdir), 0);
  const g = new THREE.Group();
  g.position.copy(fr.position);
  g.quaternion.copy(fr.quaternion);
  scene.add(g);

  const lift = carpet && carpet.liftAt ? carpet.liftAt(kdir) : 0;
  const groundY = (x, z) => {
    g.updateMatrixWorld();
    const w = g.localToWorld(_gv.set(x, 0, z));
    return R + planet.heightAt(_gn.copy(w).normalize()) - w.length() + lift;
  };
  const stone = toon(0x6e7078), dark = toon(0x3a3230), wood = toon(0x6b4f36);
  const glow = (c, o = {}) => {
    const m = new THREE.MeshBasicMaterial({ color: c, ...o });
    m.userData.outlineParameters = { visible: false };
    return m;
  };

  // ── 불 자리 — 돌 여덟, 장작, 불꽃 ─────────────────────────────────────
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.sin(a) * 0.62, z = Math.cos(a) * 0.62;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), stone);
    s.position.set(x, groundY(x, z) + 0.12, z);
    s.rotation.set(i, i * 0.7, 0); s.castShadow = true;
    g.add(s);
  }
  for (const [rx, rz, ry] of [[0.35, 0, 0.4], [-0.3, 0.2, 1.9], [0.05, -0.32, 3.2]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 6), wood);
    log.rotation.z = Math.PI / 2; log.rotation.y = ry;
    log.position.set(rx * 0.4, groundY(0, 0) + 0.1, rz * 0.4);
    g.add(log);
  }
  const flameMat = glow(0xffa64a, { transparent: true, opacity: 0.85 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), flameMat);
  flame.position.set(0, groundY(0, 0) + 0.45, 0);
  g.add(flame);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 5), glow(0xfff0a8));
  flame2.position.set(0.06, groundY(0, 0) + 0.5, -0.04);
  g.add(flame2);
  const light = new THREE.PointLight(0xffa050, 2.2, 7, 1.8);
  light.position.set(0, groundY(0, 0) + 0.9, 0);
  g.add(light);

  // ── 솥 — 불 위. 삼발이에 걸린다 ────────────────────────────────────────
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.42, 10), dark);
  pot.position.set(0, groundY(0, 0) + 1.05, 0); pot.castShadow = true;
  g.add(pot);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4), dark);
    leg.position.set(Math.sin(a) * 0.45, groundY(0, 0) + 0.75, Math.cos(a) * 0.45);
    leg.rotation.x = Math.cos(a) * 0.3; leg.rotation.z = -Math.sin(a) * 0.3;
    g.add(leg);
  }
  const brothMat = glow(0x5a4a3a);
  const broth = new THREE.Mesh(new THREE.CircleGeometry(0.38, 10), brothMat);
  broth.rotation.x = -Math.PI / 2;
  broth.position.set(0, groundY(0, 0) + 1.27, 0);
  g.add(broth);
  const potAt = { x: 0, z: 0 };

  // ── 접시 셋 — 불 앞에 반원으로. 서는 자리가 곧 고르는 접시 ─────────────
  const plates = [-1, 0, 1].map((k) => {
    const a = k * 0.62;
    const x = Math.sin(a) * 2.1, z = Math.cos(a) * 2.1;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.12, 10), stone);
    base.position.set(x, groundY(x, z) + 0.06, z);
    g.add(base);
    const ringMat = glow(0x3f4a52);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 5, 16), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, groundY(x, z) + 0.13, z);
    g.add(ring);
    // 올린 재료 — 색 덩이 하나. 무엇인지는 프롬프트가 말한다.
    const itemMat = glow(0xffffff);
    const item = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), itemMat);
    item.position.set(x, groundY(x, z) + 0.3, z);
    item.visible = false;
    g.add(item);
    return { i: k + 1, x, z, key: null, ringMat, item, itemMat };
  });

  const COLORS = {
    fruit: 0xa8482f, mushroom: 0x8a6a2f, herb: 0x3f7a4a, salt: 0xbfd0d8,
    meat_rabbit: 0xb07a68, meat_deer: 0x7a3a34, meat_chicken: 0xe0c29a, meat_boar: 0x5a3028,
    icebloom: 0xa9d8ea, nightmoss: 0x59c48a, starstone: 0xc8a2e0,
  };

  // 가진 재료 열쇠들 — bag에 하나 이상 있는 것만, INGREDIENTS 순서로
  const owned = () => Object.keys(INGREDIENTS).filter((k) => (forage.bag[k] || 0) > 0);

  const made = new Set();
  let msg = null, msgT = 0;
  let lastCook = null;

  const paint = () => {
    for (const p of plates) {
      p.item.visible = !!p.key;
      if (p.key) p.itemMat.color.set(COLORS[p.key] || 0xffffff);
      p.ringMat.color.set(p.key ? 0xffd27a : 0x3f4a52);
    }
  };

  // ── 충돌 — 불 둘레만 막는다. 접시는 밟아도 된다 ─────────────────────────
  let fireDir = null;
  const resolve = (position, playerR = 0.32) => {
    if (!fireDir) { g.updateMatrixWorld(); fireDir = g.localToWorld(new THREE.Vector3(0, 0, 0)).normalize(); }
    _up.copy(position).normalize();
    const cosA = _up.dot(fireDir);
    if (cosA <= 0) return 0;
    const need = (FIRE_BLOCK + playerR) / R;
    if (cosA < Math.cos(need)) return 0;
    _t.copy(_up).addScaledVector(fireDir, -cosA);
    if (_t.lengthSq() < 1e-12) {
      _b.set(Math.abs(fireDir.y) > 0.9 ? 1 : 0, Math.abs(fireDir.y) > 0.9 ? 0 : 1, 0);
      _t.crossVectors(_b, fireDir);
    }
    _t.normalize();
    _up.copy(fireDir).multiplyScalar(Math.cos(need)).addScaledVector(_t, Math.sin(need)).normalize();
    position.copy(_up).multiplyScalar(position.length());
    return 1;
  };

  const local = (position) => {
    g.updateMatrixWorld();
    return g.worldToLocal(position.clone());
  };
  const near = (position) => {
    const p = local(position);
    let best = null, bd = REACH;
    for (const pl of plates) {
      const d = Math.hypot(p.x - pl.x, p.z - pl.z);
      if (d < bd) { bd = d; best = { kind: 'plate', plate: pl }; }
    }
    const dp = Math.hypot(p.x - potAt.x, p.z - potAt.z);
    if (dp < bd) { best = { kind: 'pot' }; }
    return best;
  };
  const at = (position) => {
    const p = local(position);
    return Math.hypot(p.x, p.z) < 4.2;
  };

  const label = (k) => INGREDIENTS[k] || k;

  return {
    group: g, plates, made, dir: kdir,
    resolve, at,
    update(dt) {
      flame.scale.y = 1 + Math.sin(performance.now() * 0.012) * 0.12;
      flame2.rotation.y += dt * 3;
      if (msgT > 0) msgT -= dt;
    },
    prompt(position) {
      if (msgT > 0) return msg;
      const n = near(position);
      const have = owned();
      if (!n) {
        if (!have.length) return '🔥 불은 있다. 솥도. 들에서 뭔가 가져와야겠다';
        const set = plates.filter((p) => p.key).length;
        return set < 3 ? `🔥 접시에 재료를 올려라 (${set}/3) — 접시 앞에서 E` : '🔥 솥 앞에서 E — 셋을 한 솥에';
      }
      if (n.kind === 'plate') {
        if (!have.length) return '접시가 비었다 — 들에서 가져올 것이 없다';
        return `E — ${n.plate.i}번 접시 돌리기 (지금 ${n.plate.key ? label(n.plate.key) : '비움'})`;
      }
      const set = plates.filter((p) => p.key).length;
      return set === 3 ? 'E — 솥에 걸기' : `접시 ${set}/3 — 셋을 다 올려야 건다`;
    },
    // 결과: null(아무 일 없음) | { ok:false, why } | { ok:true, recipe, first }
    interact(position) {
      const n = near(position);
      if (!n) return null;
      const have = owned();
      if (n.kind === 'plate') {
        if (!have.length) return null;
        const pl = n.plate;
        // 비움 → 가진 것 순서대로 → 비움. 다른 접시에 이미 올린 것도 고를 수 있다
        // (같은 재료 둘이 필요한 요리는 없지만, 막지 않는다 — 틀려도 벌하지 않는다).
        const idx = pl.key ? have.indexOf(pl.key) : -1;
        pl.key = idx + 1 >= have.length ? null : have[idx + 1];
        paint();
        return null;
      }
      const keys = plates.map((p) => p.key);
      if (keys.filter(Boolean).length < 3) return null;
      const r = matchRecipe(keys);
      if (!r) {
        msg = '이건 요리가 아니다 — 셋이 서로 안 어울린다'; msgT = 2.6;
        return { ok: false, why: msg };
      }
      // 재료는 맞을 때만 하나씩 쓴다. 들에서 다시 난다.
      for (const k of r.needs) forage.bag[k] = Math.max(0, (forage.bag[k] || 0) - 1);
      for (const p of plates) p.key = null;
      paint();
      const first = !made.has(r.id);
      made.add(r.id);
      lastCook = r;
      brothMat.color.set(COLORS[r.needs[0]] || 0x8a5a3a);
      msg = `🍲 ${r.name}`; msgT = 2.2;
      return { ok: true, recipe: r, first };
    },
    // 검사용 — 만질 것과 손 닿는 거리
    touchables() {
      return plates.map((p) => ({ name: `접시${p.i}`, x: p.x, z: p.z, r: REACH }))
        .concat([{ name: '솥', x: 0, z: 0, r: REACH }]);
    },
    // 검사용 — 접시 셋에 열쇠를 놓고 걸어 본다(재고를 안 건드리고 판정만)
    judge(keys) { return matchRecipe(keys); },
    RECIPES,
  };
}
