// 들 — 채집 자리 다섯 갈래를 행성 위에 놓고, 고르는 일을 판정한다.
//
// ★ 설계 원칙 하나뿐: **걸어가서 E가 아니라 골라내는 일이어야 한다.**
//   사당 여섯이 재고·맞추고·가려서 답을 내게 만들어 놨는데 들에서만 "가까이 가서
//   버튼"이면 그건 다른 게임을 덧붙인 것이다. 그래서 자리마다 **후보가 여럿**이고,
//   맞는 것은 하나이며, 무엇을 보고 고르는지는 **수첩에 적혀 있다**(data/forage.js).
//
// ★ 고르는 방법도 이 게임이 이미 쓰는 방식으로 통일한다 — **자리로 고른다.**
//   메뉴를 띄우지 않는다. 연구실 다이얼 셋도, 체 사당의 체 고르기도, 덫의 미끼
//   접시 셋도 전부 "그 앞에 서서 E"다. 조작이 하나면 배울 것도 하나다.
//
// ★ 틀려도 벌하지 않는다. 왜 아닌지만 말하고 다시 고르게 둔다. 4학년이 배우는
//   방식은 한 번에 맞히는 게 아니라 **보고, 틀리고, 다시 보는** 것이다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { RULES, KINDS, WRONG, BEASTS } from '../data/forage.js';
import { josa } from '../util/josa.js';

// ★ 처음엔 2.6이었다. 버섯 넷이 반경 1.25에 둘러서 있으니 **자리 한가운데에
//   서기만 해도 넷 다 손에 닿았다.** 그러면 "고른다"가 아니라 "가까이 갔다"가 되고,
//   무엇을 보고 있는지도 안 알려 준다. 후보 하나 앞에 서야 그 하나가 잡힌다.
const REACH = 1.4;                 // 후보 하나를 고르는 거리
const SITE_R = 9;                  // 이 안이면 그 자리에 있는 것으로 친다
const TRAP_WAIT = 42;              // 덫이 걸리는 데 걸리는 시간(초)

// 자리 배치 — 사당·내림판을 피하고, 완만한 데 놓는다.
// 그리고 **갈래마다 하나는 내림판 가까이** 둔다. 다섯 갈래를 찾겠다고 별을 한 바퀴
// 돌게 하면 그건 채집이 아니라 심부름이다.
function pickSpots(planet, avoid, count, seed, nearDir, nearMax) {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const out = [];
  const d = new THREE.Vector3();
  for (let guard = 0; guard < 60000 && out.length < count; guard++) {
    // 구면 균등 표본
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    d.set(r * Math.cos(th), u, r * Math.sin(th));
    if (planet.slopeDegAt(d) > 11) continue;
    if (avoid.some((a) => d.angleTo(a.dir) < a.r / planet.R)) continue;
    if (out.some((o) => d.angleTo(o) < 16 / planet.R)) continue;
    // 첫 하나는 내림판 가까이여야 한다
    if (out.length === 0 && nearDir && d.angleTo(nearDir) > nearMax / planet.R) continue;
    out.push(d.clone());
  }
  return out;
}

// ★ 자리를 **먼저** 잡아야 한다. 산포물(나무·바위)은 boot 초반에 뿌려지는데,
//   채집 자리를 그 뒤에 정하면 자리가 숲 한가운데에 떨어진다. 실제로 그랬고,
//   버섯밭에 서니 화면이 통째로 침엽수 안쪽이었다 — 내림판에서 이미 한 번 겪은
//   문제다(그때는 4.2u만 비워 놓고 카메라가 6.5u 뒤에 선다는 걸 잊었다).
//   그래서 자리 고르기를 떼어 낸다. boot이 이걸 먼저 부르고, 그 자리들을
//   산포 제외 목록에 넣은 다음, 같은 자리로 채집 자리를 짓는다.
export function pickForageSpots(planet, opts = {}) {
  const avoid = opts.avoid || [];
  const nearDir = opts.nearDir || null;
  const out = [];
  KINDS.forEach((k, i) => {
    const dirs = pickSpots(planet, avoid.concat(out.map((o) => ({ dir: o.dir, r: 16 }))),
      3, 5000 + i * 977, nearDir, 46);
    dirs.forEach((d, j) => out.push({ kind: k.id, dir: d, seed: 7000 + i * 131 + j * 17, idx: j }));
  });
  return out;
}

export function buildForage(scene, planet, spots) {
  const R = planet.R;

  const green = toon(0x4c7a3e), greenD = toon(0x355a2c);
  const bark = toon(0x6b4f36), stem = toon(0xd8cfb4), capMat = toon(0xb9663f);
  const capBad = toon(0x8a7f6a), rockM = toon(0x8b8b93), saltM = toon(0xcfe3ea);
  const dirtM = toon(0x6a5843), furM = toon(0x8a6a4a);
  const basic = (c, o = 1) => {
    const m = new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o });
    m.userData.outlineParameters = { visible: false };
    return m;
  };
  const box = (w, h, d2, m, x, y, z, parent) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d2), m);
    me.position.set(x, y, z);
    me.castShadow = true; me.receiveShadow = true;
    parent.add(me);
    return me;
  };

  // 자리 하나를 행성 표면에 세운다. frameAt이 로컬 +Y를 위로 준다(검사 J).
  const plant = (dir) => {
    const fr = planet.frameAt(planet.surfaceAt(dir), 0);
    const g = new THREE.Group();
    g.position.copy(fr.position);
    g.quaternion.copy(fr.quaternion);
    scene.add(g);
    return g;
  };

  const sites = [];
  // 부딪히는 것 — 나무 줄기와 소금 바위. 산포물 나무는 이미 막히는데 채집 나무만
  // 통과하면 그게 곧 고장으로 읽힌다. 버섯·허브는 작아서 밟고 지나가도 된다.
  const blocks = [];
  const bag = {};                        // 갈래별 가진 개수
  const found = {};                      // 갈래별 처음 얻었나 — 수첩이 이걸 본다

  // ── 갈래별로 자리를 짓는다 ───────────────────────────────────────────────
  // 후보(candidate)는 전부 {x, z, ok, why} 꼴이다. ok가 하나만 true다.

  // 1) 열매 나무 — 익은 것은 **무거워서 처지고 짙다**
  const buildFruit = (dir, seed) => {
    const g = plant(dir);
    box(0.5, 2.6, 0.5, bark, 0, 1.3, 0, g);
    blocks.push({ g, x: 0, z: 0, r: 0.75 });
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.9 - k * 0.45, 1.3, 7), green);
      c.position.y = 2.4 + k * 0.75; c.castShadow = true; g.add(c);
    }
    const cands = [];
    let s = seed;
    const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const ripeIdx = Math.floor(rnd() * 5);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.3;
      const ripe = k === ripeIdx;
      // 익은 것은 아래(1.5), 덜 익은 것은 위(2.5). 색도 다르다.
      const y = ripe ? 1.45 : 2.5 + (k % 2) * 0.25;
      const rad = ripe ? 0.30 : 0.20;
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 0),
        toon(ripe ? 0xb8402c : 0x9fbe5a));
      f.position.set(Math.sin(a) * 1.5, y, Math.cos(a) * 1.5);
      f.castShadow = true; g.add(f);
      // 익은 건 가지가 처진 것으로 보이게 짧은 줄기를 아래로
      box(0.06, ripe ? 0.5 : 0.22, 0.06, bark,
        f.position.x, f.position.y + (ripe ? 0.4 : 0.16), f.position.z, g);
      cands.push({ x: f.position.x, z: f.position.z, ok: ripe, why: WRONG.fruit, mesh: f });
    }
    return { kind: 'fruit', dir, group: g, cands };
  };

  // 2) 버섯 — 고리 **와** 갓, 둘 다 맞아야 한다
  const buildMushroom = (dir, seed) => {
    const g = plant(dir);
    box(3.6, 0.1, 3.6, greenD, 0, 0.03, 0, g);          // 이끼 자리
    const specs = [                                       // 고리·우산
      { ring: true, dome: true }, { ring: true, dome: false },
      { ring: false, dome: true }, { ring: false, dome: false },
    ];
    // 순서를 섞는다 — 늘 같은 자리에 답이 있으면 규칙을 안 읽는다
    let s = seed;
    const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = specs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = specs[i]; specs[i] = specs[j]; specs[j] = t;
    }
    const cands = [];
    specs.forEach((sp, k) => {
      const a = (k / 4) * Math.PI * 2 + 0.5;
      const x = Math.sin(a) * 1.25, z = Math.cos(a) * 1.25;
      box(0.16, 0.62, 0.16, stem, x, 0.31, z, g);
      if (sp.ring) {                                      // 대의 고리
        const r2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), stem);
        r2.position.set(x, 0.42, z); g.add(r2);
      }
      // ★ 맞는 것만 주황으로 칠해 놨었다. 그러면 **규칙을 안 읽어도 색으로 풀린다** —
      //   퍼즐이 통째로 사라진다. 색은 갓 모양만 따라간다(모양은 어차피 보이니까).
      //   숨겨야 하는 건 고리다.
      const cap = new THREE.Mesh(
        sp.dome ? new THREE.ConeGeometry(0.42, 0.3, 9)     // 우산처럼 덮인
          : new THREE.CylinderGeometry(0.44, 0.18, 0.18, 9), // 접시처럼 뒤집힌
        sp.dome ? capMat : capBad);
      cap.position.set(x, sp.dome ? 0.76 : 0.7, z);
      cap.castShadow = true; g.add(cap);
      cands.push({ x, z, ok: sp.ring && sp.dome,
        why: !sp.ring ? WRONG.mushroom_ring : WRONG.mushroom_cap });
    });
    return { kind: 'mushroom', dir, group: g, cands };
  };

  // 3) 허브 — 잎차례(마주나기/어긋나기)와 잎 가장자리(톱니/매끈)
  const buildHerb = (dir, seed) => {
    const g = plant(dir);
    const specs = [{ opp: true, saw: true }, { opp: false, saw: true }, { opp: true, saw: false }];
    let s = seed;
    const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = specs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = specs[i]; specs[i] = specs[j]; specs[j] = t;
    }
    const cands = [];
    specs.forEach((sp, k) => {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      const x = Math.sin(a) * 1.5, z = Math.cos(a) * 1.5;
      box(0.09, 1.0, 0.09, greenD, x, 0.5, z, g);
      // 잎 — 마주나기는 같은 높이에 둘씩, 어긋나기는 번갈아 하나씩
      for (let n = 0; n < 3; n++) {
        const y = 0.34 + n * 0.24;
        const sides = sp.opp ? [-1, 1] : [n % 2 ? 1 : -1];
        for (const sd of sides) {
          // 색은 셋 다 같다. 톱니는 **톱니로** 보여야지 색으로 보이면 안 된다 —
          // 버섯에서 색이 답을 흘리던 것과 같은 실수다.
          const leaf = box(0.44, 0.05, 0.2, green, x + sd * 0.26, y, z, g);
          leaf.rotation.z = sd * 0.25;
          if (sp.saw) {                                   // 톱니 — 가장자리에 이가 난다
            for (let t2 = 0; t2 < 3; t2++) {
              box(0.09, 0.05, 0.09, green, x + sd * (0.13 + t2 * 0.15), y + 0.02, z + 0.13, g);
            }
          }
        }
      }
      cands.push({ x, z, ok: sp.opp && sp.saw,
        why: !sp.opp ? WRONG.herb_alt : WRONG.herb_smooth });
    });
    return { kind: 'herb', dir, group: g, cands };
  };

  // 4) 암염 — **깨진 조각의 모양**으로 가린다. 빛나는 건 셋 다 빛난다.
  const buildSalt = (dir, seed) => {
    const g = plant(dir);
    const specs = ['cube', 'hex', 'rough'];
    let s = seed;
    const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = specs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = specs[i]; specs[i] = specs[j]; specs[j] = t;
    }
    const cands = [];
    specs.forEach((sp, k) => {
      const a = (k / 3) * Math.PI * 2 + 0.6;
      const x = Math.sin(a) * 1.9, z = Math.cos(a) * 1.9;
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), rockM);
      rock.position.set(x, 0.5, z); rock.castShadow = true; g.add(rock);
      blocks.push({ g, x, z, r: 0.95 });
      // 빛나는 결 — 셋 다 빛난다. 이것만 보고는 못 고른다.
      for (let n = 0; n < 4; n++) {
        const a2 = (n / 4) * Math.PI * 2;
        const sh = box(0.22, 0.05, 0.22, saltM,
          x + Math.sin(a2) * 0.6, 0.62 + (n % 2) * 0.18, z + Math.cos(a2) * 0.6, g);
        sh.rotation.y = a2;
      }
      // 발치의 **깨진 조각** — 여기에 답이 있다
      for (let n = 0; n < 5; n++) {
        const a2 = (n / 5) * Math.PI * 2 + 0.3;
        const fx = x + Math.sin(a2) * 1.05, fz = z + Math.cos(a2) * 1.05;
        let frag;
        if (sp === 'cube') frag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), saltM);
        else if (sp === 'hex') frag = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, 0.32, 6), saltM);
        else frag = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), saltM);
        frag.position.set(fx, 0.12, fz);
        if (sp !== 'cube') frag.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        else frag.rotation.y = a2;                        // 정육면체는 반듯하게 놓인다
        frag.castShadow = true; g.add(frag);
      }
      cands.push({ x, z, ok: sp === 'cube',
        why: sp === 'hex' ? WRONG.salt_hex : WRONG.salt_rough });
    });
    return { kind: 'salt', dir, group: g, cands };
  };

  // 5) 덫 자리 — 흔적을 읽고 **미끼 접시**를 고른다
  const buildTrap = (dir, seed) => {
    const g = plant(dir);
    let s = seed;
    const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const beast = BEASTS[Math.floor(rnd() * BEASTS.length)];
    box(4.4, 0.08, 4.4, dirtM, 0, 0.025, 0, g);            // 다져진 땅
    // 발자국 — 한쪽으로 이어진다. 그 끝이 덫 자리다.
    const dirA = rnd() * Math.PI * 2;
    for (let k = 0; k < 5; k++) {
      const t = -1.6 + k * 0.75;
      const fx = Math.sin(dirA) * t, fz = Math.cos(dirA) * t;
      for (const sd of [-0.16, 0.16]) {
        const fp = box(0.2, 0.03, 0.32, toon(0x4e4034),
          fx + Math.cos(dirA) * sd, 0.05, fz - Math.sin(dirA) * sd, g);
        fp.rotation.y = dirA;
      }
    }
    // 먹다 만 것 — 미끼가 무엇인지 여기 적혀 있다
    const leftK = beast.eats;
    const left = new THREE.Mesh(
      leftK === 'fruit' ? new THREE.IcosahedronGeometry(0.22, 0)
        : leftK === 'mushroom' ? new THREE.ConeGeometry(0.2, 0.24, 7)
          : new THREE.BoxGeometry(0.4, 0.05, 0.18),
      toon(leftK === 'fruit' ? 0xb8402c : leftK === 'mushroom' ? 0xb9663f : 0x6f9c52));
    left.position.set(Math.sin(dirA + 2.2) * 1.3, 0.16, Math.cos(dirA + 2.2) * 1.3);
    g.add(left);
    // 털 몇 올
    for (let k = 0; k < 4; k++) {
      const a2 = dirA + 2.0 + k * 0.14;
      box(0.05, 0.02, 0.26, furM, Math.sin(a2) * 1.6, 0.06, Math.cos(a2) * 1.6, g)
        .rotation.y = a2;
    }
    // 덫 — 발자국이 간 쪽 끝
    const tx = Math.sin(dirA) * 2.6, tz = Math.cos(dirA) * 2.6;
    const trapG = new THREE.Group(); trapG.position.set(tx, 0, tz); g.add(trapG);
    box(1.3, 0.12, 1.3, bark, 0, 0.07, 0, trapG);
    for (const sd of [-1, 1]) box(0.1, 0.5, 1.3, bark, sd * 0.6, 0.32, 0, trapG);
    const caught = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), furM);
    caught.position.set(0, 0.42, 0); caught.visible = false; trapG.add(caught);
    // 미끼 접시 셋 — 덫 앞에 나란히. **자리로 고른다**(메뉴를 띄우지 않는다)
    const dishes = [];
    ['fruit', 'mushroom', 'herb'].forEach((k, i) => {
      const off = (i - 1) * 1.5;
      const dx = tx + Math.cos(dirA) * off - Math.sin(dirA) * 1.7;
      const dz = tz - Math.sin(dirA) * off - Math.cos(dirA) * 1.7;
      const d2 = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.4, 0.14, 8), bark);
      d2.position.set(dx, 0.07, dz); d2.castShadow = true; g.add(d2);
      const mark = new THREE.Mesh(
        k === 'fruit' ? new THREE.IcosahedronGeometry(0.17, 0)
          : k === 'mushroom' ? new THREE.ConeGeometry(0.16, 0.2, 7)
            : new THREE.BoxGeometry(0.32, 0.04, 0.14),
        toon(k === 'fruit' ? 0xb8402c : k === 'mushroom' ? 0xb9663f : 0x6f9c52));
      mark.position.set(dx, 0.2, dz); g.add(mark);
      dishes.push({ x: dx, z: dz, kind: k });
    });
    return { kind: 'meat', dir, group: g, beast, dishes,
      trap: { x: tx, z: tz, caught, set: null, t: 0 }, cands: [] };
  };

  // ── 자리 놓기 ────────────────────────────────────────────────────────────
  const BUILD = { fruit: buildFruit, mushroom: buildMushroom, herb: buildHerb,
    salt: buildSalt, meat: buildTrap };
  for (const k of KINDS) { found[k.id] = false; bag[k.id] = 0; }
  for (const sp of spots) {
    const site = BUILD[sp.kind](sp.dir, sp.seed);
    site.id = `${sp.kind}${sp.idx}`;
    sites.push(site);
  }

  // ── 판정 ─────────────────────────────────────────────────────────────────
  const _up = new THREE.Vector3(), _p = new THREE.Vector3();
  // 이 자리 기준의 로컬 x·z로 옮긴다(구면 위 위치 → 자리의 접평면)
  const localOf = (site, worldPos) => {
    site.group.updateMatrixWorld();
    _p.copy(worldPos);
    site.group.worldToLocal(_p);
    return _p;
  };
  const siteAt = (worldPos) => {
    _up.copy(worldPos).normalize();
    let best = null, bd = SITE_R / R;
    for (const s of sites) {
      const a = _up.angleTo(s.dir);
      if (a < bd) { bd = a; best = s; }
    }
    return best;
  };
  const nearestOf = (list, l) => {
    let best = null, bd = REACH;
    for (const c of list) {
      const d2 = Math.hypot(l.x - c.x, l.z - c.z);
      if (d2 < bd) { bd = d2; best = c; }
    }
    return best;
  };

  // 구면 위에서 밀어낸다 — shrines.resolve와 같은 방식. 평면 거리로 재면
  // 별 반대편에서도 걸린다.
  const _b = new THREE.Vector3(), _t = new THREE.Vector3();
  const resolve = (position, playerR = 0.32) => {
    _up.copy(position).normalize();
    let hit = 0;
    for (const b of blocks) {
      if (!b.dir) {                       // 처음 한 번만 월드 방향을 구해 둔다
        b.g.updateMatrixWorld();
        b.dir = b.g.localToWorld(new THREE.Vector3(b.x, 0, b.z)).normalize();
      }
      const cosA = _up.dot(b.dir);
      if (cosA <= 0) continue;
      const need = (b.r + playerR) / R;
      if (cosA >= Math.cos(need)) {
        _t.copy(_up).addScaledVector(b.dir, -cosA);
        // ★ 물체 **정중앙**에 서면 접선이 0이 되어 밀어낼 방향이 없다. 사당에서
        //   베껴 온 가드는 여기서 그냥 continue했고, 그래서 나무 줄기 한가운데에
        //   서면 아무 일도 안 일어났다 — 사당 기단은 정면으로 걸어 들어갈 일이
        //   없지만 나무는 그게 보통이다. 방향이 없으면 **아무 방향으로나** 민다.
        if (_t.lengthSq() < 1e-12) {
          _b.set(Math.abs(b.dir.y) > 0.9 ? 1 : 0, Math.abs(b.dir.y) > 0.9 ? 0 : 1, 0);
          _t.crossVectors(_b, b.dir);
        }
        _t.normalize();
        _up.copy(b.dir).multiplyScalar(Math.cos(need)).addScaledVector(_t, Math.sin(need)).normalize();
        hit++;
      }
    }
    if (hit) { position.copy(_up); planet.projectToSurface(position); }
    return hit;
  };

  return {
    sites, bag, found, blocks, resolve,
    at: siteAt,
    RULES,

    update(dt) {
      for (const s of sites) {
        if (s.kind !== 'meat' || !s.trap.set) continue;
        s.trap.t += dt;
        if (s.trap.t >= TRAP_WAIT && !s.trap.caught.visible) {
          s.trap.caught.visible = s.trap.set === s.beast.eats;
          s.trap.done = true;
        }
      }
    },

    // ★ 판정 문구("덜 익었다")를 여기서 타이머로 띄우고 있었다. 그러면 자리를
    //   벗어나도 3초간 따라다니며 **다른 프롬프트를 전부 덮는다.** 잠깐 뜨는
    //   알림은 boot의 noteMsg가 이미 맡고 있다 — 같은 일을 두 군데서 하면
    //   한쪽만 고쳐지는 날이 온다. 여기는 **자리만** 본다.
    prompt(worldPos) {
      const s = siteAt(worldPos);
      if (!s) return null;
      const l = localOf(s, worldPos);
      if (s.kind === 'meat') {
        const t = s.trap;
        if (Math.hypot(l.x - t.x, l.z - t.z) < REACH) {
          if (t.caught.visible) return 'E — 걸린 것을 거두기';
          // ★ 시간이 다 됐는데 아무것도 안 걸렸을 때 "놓아둔 지 0초"만 계속 떠 있었다.
          //   빈 덫인지 아직 기다리는 중인지 알 길이 없어서 **영원히 기다리는 것처럼**
          //   보였다. 헛수고였다는 것도 결과다 — 결과는 말해 줘야 한다.
          if (t.done) return 'E — 빈 덫을 거두기';
          if (t.set) return `🪤 놓아둔 지 ${Math.max(0, Math.ceil(TRAP_WAIT - t.t))}초`;
          return '🪤 덫 — 앞의 접시에 미끼를 놓아야 한다';
        }
        const d2 = nearestOf(s.dishes, l);
        if (d2) {
          const nm = KINDS.find((k) => k.id === d2.kind).label;
          if (t.set) return '🪤 미끼는 이미 걸었다';
          if (!bag[d2.kind]) return `${josa(nm, '이')} 없다 — 먼저 모아 와야 한다`;
          return `E — ${josa(nm, '을')} 미끼로 놓기`;
        }
        return `🐾 발자국과 먹다 만 것. 무엇이 지나갔나 — ${RULES.meat}`;
      }
      const lab = KINDS.find((k) => k.id === s.kind).label;
      const c = nearestOf(s.cands, l);
      if (!c) return `🌿 ${lab} 자리 — ${RULES[s.kind]}`;
      if (c.taken) return '이미 가져갔다';
      return `E — 이걸로 고르기 (${lab})`;
    },

    // 무엇을 했는지 문자열로 돌려준다. 대사·수첩은 boot이 맡는다.
    interact(worldPos) {
      const s = siteAt(worldPos);
      if (!s) return null;
      const l = localOf(s, worldPos);
      if (s.kind === 'meat') {
        const t = s.trap;
        if (Math.hypot(l.x - t.x, l.z - t.z) < REACH) {
          if (t.caught.visible) {
            t.caught.visible = false; t.set = null; t.t = 0;
            bag.meat = (bag.meat || 0) + 1;
            const first = !found.meat; found.meat = true;
            return { kind: 'meat', ok: true, first };
          }
          if (t.done && !t.caught.visible) {
            t.set = null; t.t = 0; t.done = false;
            return { kind: 'meat', ok: false, why: WRONG.empty };
          }
          return null;
        }
        const d2 = nearestOf(s.dishes, l);
        if (d2 && !t.set && bag[d2.kind] > 0) {
          bag[d2.kind]--;
          t.set = d2.kind; t.t = 0; t.done = false;
          return { kind: 'bait', ok: d2.kind === s.beast.eats, set: d2.kind };
        }
        return null;
      }
      const c = nearestOf(s.cands, l);
      if (!c || c.taken) return null;
      if (!c.ok) return { kind: s.kind, ok: false, why: c.why };
      c.taken = true;
      if (c.mesh) c.mesh.visible = false;
      bag[s.kind]++;
      const first = !found[s.kind];
      found[s.kind] = true;
      return { kind: s.kind, ok: true, first };
    },

    // 검사용 — 자리마다 정답 후보가 정확히 하나인가
    audit() {
      const bad = [];
      for (const s of sites) {
        if (s.kind === 'meat') {
          if (!s.dishes.some((d2) => d2.kind === s.beast.eats))
            bad.push(`${s.id} 미끼 접시에 정답 없음`);
          continue;
        }
        const n = s.cands.filter((c) => c.ok).length;
        if (n !== 1) bad.push(`${s.id} 정답 ${n}개`);
      }
      return bad;
    },
  };
}
