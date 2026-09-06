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
import { RULES, KINDS, WRONG, BEASTS, LEGEND } from '../data/forage.js';
import { josa } from '../util/josa.js';

// ★ 씨앗 난수를 `(s * 1103515245 + 12345) % 2147483648`로 굴리고 있었다.
//   s가 2^31까지 가면 곱이 **2.4e18** — 자바스크립트 안전 정수(9.0e15)를 넘어
//   하위 비트가 뭉개진다. `% 2^31`이 쓰는 게 하필 그 비트다.
//
//   ★★ 여기서 한 번 잘못 짚었다. 실제 씨앗 아홉 중 여섯이 정답을 같은 자리에
//      놓은 걸 보고 "그래서 안 섞였다"고 단정했는데, **재 보니 옛 난수도 실제
//      사용 패턴에서 균등했다**(3칸 33/38/30, 4칸 26/21/32/22). 아홉 개는
//      그냥 표본이 작았던 것이다. 원인을 눈으로 짚고 넘어갈 뻔했다.
//
//   그래도 바꾼 채로 둔다. 안전 정수를 넘긴 곱에 기대는 건 **우연히 맞는 코드**고,
//   정밀도가 언제 어떻게 깎일지는 보장이 없다. Math.imul은 32비트 곱을 정확히
//   한다(mulberry32). 고친 이유는 결과가 나빠서가 아니라 근거가 없어서다.
export const mkRnd = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ★ 처음엔 2.6이었다. 버섯 넷이 반경 1.25에 둘러서 있으니 **자리 한가운데에
//   서기만 해도 넷 다 손에 닿았다.** 그러면 "고른다"가 아니라 "가까이 갔다"가 되고,
//   무엇을 보고 있는지도 안 알려 준다. 후보 하나 앞에 서야 그 하나가 잡힌다.
const REACH = 1.4;                 // 후보 하나를 고르는 거리
// ★ 덫은 부딪히는 물건이라(제단 위에 올라설 수 없다) **밀려나는 거리보다
//   손이 더 길어야** 한다. 반경 1.15 + 몸 0.32 = 1.47까지 밀리는데 손이 1.4면
//   영영 못 만진다 — 연구실 콘솔에서 오프닝을 통째로 못 깨게 만들었던 그 버그다.
//   같은 실수를 두 번 하지 않으려고 숫자를 나란히 적어 둔다.
const TRAP_BLOCK = 1.15, TRAP_REACH = 2.2;
const SITE_R = 9;                  // 이 안이면 그 자리에 있는 것으로 친다
// 짐승이 오기까지, 그리고 오는 길에 걸리는 시간. 기다림이 길면 그건 재미가
// 아니라 벌이다 — 42초를 30초로 줄이고 마지막 7초는 **눈앞에서 걸어온다.**
const TRAP_WAIT = 30, APPROACH = 7;
// ★ 캔 자리는 다시 난다. 이 한 줄이 문제 셋을 같이 푼다.
//   ① **막다른 길이 사라진다.** 갈래마다 자리 셋 × 정답 하나 = 평생 3개뿐인데,
//      덫 미끼는 틀리면 그 재료를 먹는다(열매 2 + 허브 1이 필요하다).
//      세 번 틀리면 고기를 **영영** 못 얻었다. 요리까지 오면 더 심해진다.
//   ② **암기가 안 통한다.** 씨앗이 고정이라 다시 켜면 같은 자리에 같은 답이었다.
//      재 보니 암염은 세 곳 다 정답이 같은 자리였다. 사당은 들어갈 때마다 다시
//      섞는데 들만 안 그랬다 — 규칙이 두 개면 하나는 틀린 것이다.
//   ③ **캔 것이 사라진다.** 다시 지으니 캔 자리가 비었다가 새로 찬다.
//   자리(위치)는 그대로 둔다. 지도가 안개인 게임에서 자리까지 바뀌면 지도가
//   기록이 아니라 거짓말이 된다 — 사당이 방은 그대로 두고 문제만 바꾸는 것과 같다.
const REGROW = 75;                 // 캔 자리가 다시 나기까지(초)

// 자리 배치 — 사당·내림판을 피하고, 완만한 데 놓는다.
// 그리고 **갈래마다 하나는 내림판 가까이** 둔다. 다섯 갈래를 찾겠다고 별을 한 바퀴
// 돌게 하면 그건 채집이 아니라 심부름이다.
function pickSpots(planet, avoid, count, seed, nearDir, nearMax) {
  const rnd = mkRnd(seed);
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

// 전설의 자리 셋 — 계산으로 딱 한 점씩 나온다.
//   가장 높은 데 = 지형 최고점 · 가장 깊은 데 = 최저점 · 가장 먼 데 = 내림판의 대척점
// ★ 꼭대기와 골짜기는 그대로 두면 너무 가파를 수 있다. 서 있지도 못하는 데에
//   물건을 놓으면 그건 숨긴 게 아니라 없는 것이다 — 둘레를 훑어 설 만한 데로 옮긴다.
export function pickLegendSpots(planet, landingDir) {
  const N = 24000;
  let hi = null, hiH = -1e9, lo = null, loH = 1e9;
  const d = new THREE.Vector3();
  // 황금각 나선 — 구면에 고르게 뿌린다
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), th = ga * i;
    d.set(Math.cos(th) * r, y, Math.sin(th) * r);
    const h = planet.heightAt(d);
    if (h > hiH) { hiH = h; hi = d.clone(); }
    if (h < loH) { loH = h; lo = d.clone(); }
  }
  // 그 언저리에서 **설 만한**(완만한) 자리로 옮긴다
  const settle = (center, maxSlope) => {
    let best = center, bs = planet.slopeDegAt(center);
    if (bs <= maxSlope) return best;
    const up = center.clone();
    const ref = Math.abs(up.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const e = new THREE.Vector3().crossVectors(ref, up).normalize();
    const n = new THREE.Vector3().crossVectors(up, e).normalize();
    for (let ring = 1; ring <= 4; ring++) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, ang = (ring * 2.2) / planet.R;
        const c = up.clone().addScaledVector(e, Math.sin(a) * ang)
          .addScaledVector(n, Math.cos(a) * ang).normalize();
        const sl = planet.slopeDegAt(c);
        if (sl < bs) { bs = sl; best = c; }
      }
      if (bs <= maxSlope) break;
    }
    return best;
  };
  const far = settle(landingDir.clone().negate().normalize(), 10);
  return [
    { id: 'icebloom', dir: settle(hi, 16) },
    { id: 'nightmoss', dir: settle(lo, 12) },
    { id: 'starstone', dir: far },
  ];
}

export function buildForage(scene, planet, spots, legendSpots, carpet) {
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

  // ★ 자리의 바닥면은 **중심 한 점**에서 잰 접평면이다. 중심에서 멀어질수록
  //   실제 지형과 벌어지고, 재 보니 최악 1.45u가 땅에 파묻혀 있었다
  //   (암염 조각·버섯·얼음꽃). 물건은 **자기 자리의** 지형 높이에 앉아야 한다.
  const _gv = new THREE.Vector3(), _gn = new THREE.Vector3();
  const groundY = (g, x, z) => {
    g.updateMatrixWorld();
    const w = g.localToWorld(_gv.set(x, 0, z));
    return planet.R + planet.heightAt(_gn.copy(w).normalize()) - w.length();
  };

  // ★ 바닥에 까는 판은 groundY만으로는 모자란다. 그건 **중심 한 점**만 맞추는데,
  //   1.5u짜리 판이 삼각면 지형에 놓이면 한쪽은 뜨고 한쪽은 묻힌다.
  //   실사용 스크린샷에서 길 자국이 공중에 떠 그림자가 갈라져 보였다.
  //   면 전체를 **지형 법선에 맞춰 눕히고**, 살짝 파묻어 뜨지 않게 한다.
  //   (파묻히는 건 "닳아 들어간 자국"으로 읽히지만 뜨는 건 그냥 고장이다.)
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _nm = new THREE.Vector3();
  const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _pc = new THREE.Vector3();
  const YAX = new THREE.Vector3(0, 1, 0);
  // ★ 그리고 바닥 판은 **지형이 아니라 잔디 위**에 깔아야 한다. 잔디 카펫은
  //   지형에서 0.15u 떠 있는데(플레이어도 그만큼 들려 걷는다) 판을 지형 높이에
  //   두면 0.185u 아래로 들어가 **아예 안 보인다.** 실제로 길과 발자국이 통째로
  //   사라졌고, 그걸 스크린샷으로 지적받고서야 알았다 —
  //   "지면"이라는 말이 두 가지를 가리키고 있었던 것이다.
  const lift = (dir) => (carpet && carpet.liftAt ? carpet.liftAt(dir) : 0);
  const layFlat = (mesh, g, x, z, yaw = 0, over = 0.02) => {
    g.updateMatrixWorld();
    const w = _gv.set(x, 0, z);
    g.localToWorld(w);
    const up = _gn.copy(w).normalize();
    // 접선 두 방향으로 0.5u 떨어진 표면점 → 그 세 점의 법선이 실제 지면 기울기다
    const ref = Math.abs(up.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : YAX;
    _e1.crossVectors(ref, up).normalize();
    _e2.crossVectors(up, _e1).normalize();
    const d = 0.5 / planet.R;
    planet.surfaceAt(_pa.copy(up), _pa);
    planet.surfaceAt(_pb.copy(up).addScaledVector(_e1, d).normalize(), _pb);
    planet.surfaceAt(_pc.copy(up).addScaledVector(_e2, d).normalize(), _pc);
    _nm.crossVectors(_pb.sub(_pa), _pc.sub(_pa)).normalize();
    if (_nm.dot(up) < 0) _nm.negate();
    // 월드 법선을 자리(group)의 로컬 방향으로
    g.getWorldQuaternion(_q1);
    _nm.applyQuaternion(_q2.copy(_q1).invert());
    mesh.quaternion.setFromUnitVectors(YAX, _nm);
    if (yaw) mesh.quaternion.multiply(_q2.setFromAxisAngle(YAX, yaw));
    mesh.position.set(x, groundY(g, x, z) + lift(up) + over, z);
    // 검사가 "바닥에 깐 것"만 골라 보게 표시해 둔다. 두께와 크기로 짐작하면
    // 줄기에 달린 허브 잎까지 바닥 판으로 잡는다(실제로 오탐이 났다).
    mesh.userData.decal = true;
    return mesh;
  };

  // ★ 후보는 저마다 **자기 무리**를 갖는다. 캐면 그 무리만 사라진다.
  //   처음엔 열매만 메시를 숨기고 버섯·허브·암염은 그대로 서 있었다 —
  //   캔 것이 그대로 있으면 그건 고장으로 읽힌다.
  const cand = (g, x, z) => {
    const c = new THREE.Group();
    c.position.set(x, groundY(g, x, z), z);
    g.add(c);
    return c;
  };

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
    const rnd = mkRnd(seed);
    const ripeIdx = Math.floor(rnd() * 5);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.3;
      const ripe = k === ripeIdx;
      const x = Math.sin(a) * 1.5, z = Math.cos(a) * 1.5;
      const cg = cand(g, x, z);
      // 익은 것은 아래(1.45), 덜 익은 것은 위(2.5). 색도 다르다 — 규칙이 그렇다.
      const y = ripe ? 1.45 : 2.5 + (k % 2) * 0.25;
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(ripe ? 0.30 : 0.20, 0),
        toon(ripe ? 0xb8402c : 0x9fbe5a));
      f.position.y = y; f.castShadow = true; cg.add(f);
      // 익은 건 가지가 처진 것으로 보이게 줄기를 길게
      box(0.06, ripe ? 0.5 : 0.22, 0.06, bark, 0, y + (ripe ? 0.4 : 0.16), 0, cg);
      cands.push({ x, z, ok: ripe, why: WRONG.fruit, grp: cg });
    }
    return { kind: 'fruit', dir, group: g, cands };
  };

  // 2) 버섯 — 고리 **와** 갓, 둘 다 맞아야 한다
  const buildMushroom = (dir, seed) => {
    const g = plant(dir);
    // ★ 3.6×3.6짜리 이끼판 한 장이었다. 그 크기의 평판은 삼각면 지형 위에서
    //   **반드시** 한쪽이 뜬다. 작은 이끼 여럿으로 쪼개고 각자 눕힌다.
    for (let m = 0; m < 9; m++) {
      const am = (m / 9) * Math.PI * 2 + 0.4, rm = 0.5 + (m % 3) * 0.62;
      layFlat(box(0.8, 0.08, 0.8, greenD, 0, 0, 0, g),
        g, Math.sin(am) * rm, Math.cos(am) * rm, am, 0.04);
    }
    const specs = [                                       // 고리·우산
      { ring: true, dome: true }, { ring: true, dome: false },
      { ring: false, dome: true }, { ring: false, dome: false },
    ];
    // 순서를 섞는다 — 늘 같은 자리에 답이 있으면 규칙을 안 읽는다
    const rnd = mkRnd(seed);
    for (let i = specs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = specs[i]; specs[i] = specs[j]; specs[j] = t;
    }
    const cands = [];
    specs.forEach((sp, k) => {
      const a = (k / 4) * Math.PI * 2 + 0.5;
      const x = Math.sin(a) * 1.25, z = Math.cos(a) * 1.25;
      const cg = cand(g, x, z);
      box(0.16, 0.62, 0.16, stem, 0, 0.31, 0, cg);
      if (sp.ring) {                                      // 대의 고리
        const r2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), stem);
        r2.position.y = 0.42; cg.add(r2);
      }
      // ★ 맞는 것만 주황으로 칠해 놨었다. 그러면 **규칙을 안 읽어도 색으로 풀린다** —
      //   퍼즐이 통째로 사라진다. 색은 갓 모양만 따라간다(모양은 어차피 보이니까).
      //   숨겨야 하는 건 고리다.
      const cap = new THREE.Mesh(
        sp.dome ? new THREE.ConeGeometry(0.42, 0.3, 9)     // 우산처럼 덮인
          : new THREE.CylinderGeometry(0.44, 0.18, 0.18, 9), // 접시처럼 뒤집힌
        sp.dome ? capMat : capBad);
      cap.position.y = sp.dome ? 0.76 : 0.7;
      cap.castShadow = true; cg.add(cap);
      cands.push({ x, z, ok: sp.ring && sp.dome, grp: cg,
        why: !sp.ring ? WRONG.mushroom_ring : WRONG.mushroom_cap });
    });
    return { kind: 'mushroom', dir, group: g, cands };
  };

  // 3) 허브 — 잎차례(마주나기/어긋나기)와 잎 가장자리(톱니/매끈)
  const buildHerb = (dir, seed) => {
    const g = plant(dir);
    const specs = [{ opp: true, saw: true }, { opp: false, saw: true }, { opp: true, saw: false }];
    const rnd = mkRnd(seed);
    for (let i = specs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = specs[i]; specs[i] = specs[j]; specs[j] = t;
    }
    const cands = [];
    specs.forEach((sp, k) => {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      const x = Math.sin(a) * 1.5, z = Math.cos(a) * 1.5;
      const cg = cand(g, x, z);
      box(0.09, 1.0, 0.09, greenD, 0, 0.5, 0, cg);
      // 잎 — 마주나기는 같은 높이에 둘씩, 어긋나기는 번갈아 하나씩
      for (let n = 0; n < 3; n++) {
        const y = 0.34 + n * 0.24;
        const sides = sp.opp ? [-1, 1] : [n % 2 ? 1 : -1];
        for (const sd of sides) {
          // 색은 셋 다 같다. 톱니는 **톱니로** 보여야지 색으로 보이면 안 된다 —
          // 버섯에서 색이 답을 흘리던 것과 같은 실수다.
          const leaf = box(0.44, 0.05, 0.2, green, sd * 0.26, y, 0, cg);
          leaf.rotation.z = sd * 0.25;
          if (sp.saw) {                                   // 톱니 — 가장자리에 이가 난다
            for (let t2 = 0; t2 < 3; t2++) {
              box(0.09, 0.05, 0.09, green, sd * (0.13 + t2 * 0.15), y + 0.02, 0.13, cg);
            }
          }
        }
      }
      cands.push({ x, z, ok: sp.opp && sp.saw, grp: cg,
        why: !sp.opp ? WRONG.herb_alt : WRONG.herb_smooth });
    });
    return { kind: 'herb', dir, group: g, cands };
  };

  // 4) 암염 — **깨진 조각의 모양**으로 가린다. 빛나는 건 셋 다 빛난다.
  const buildSalt = (dir, seed) => {
    const g = plant(dir);
    const specs = ['cube', 'hex', 'rough'];
    const rnd = mkRnd(seed);
    for (let i = specs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = specs[i]; specs[i] = specs[j]; specs[j] = t;
    }
    const cands = [];
    specs.forEach((sp, k) => {
      const a = (k / 3) * Math.PI * 2 + 0.6;
      const x = Math.sin(a) * 1.9, z = Math.cos(a) * 1.9;
      const cg = cand(g, x, z);
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), rockM);
      rock.position.y = 0.5; rock.castShadow = true; cg.add(rock);
      // ★ 0.95였다. 밀려나는 거리 0.95+0.32=1.27인데 손이 1.4라 여유가 0.13u뿐 —
      //   각도가 조금만 틀어져도 프롬프트가 깜박인다. 바위 반지름은 0.85이므로
      //   0.78이면 표면에서 0.07 안쪽까지만 들어가고 여유는 0.30u가 된다.
      blocks.push({ g, x, z, r: 0.78 });
      // 빛나는 결 — 셋 다 빛난다. 이것만 보고는 못 고른다.
      for (let n = 0; n < 4; n++) {
        const a2 = (n / 4) * Math.PI * 2;
        const sh = box(0.22, 0.05, 0.22, saltM,
          Math.sin(a2) * 0.6, 0.62 + (n % 2) * 0.18, Math.cos(a2) * 0.6, cg);
        sh.rotation.y = a2;
      }
      // 발치의 **깨진 조각** — 여기에 답이 있다
      for (let n = 0; n < 5; n++) {
        const a2 = (n / 5) * Math.PI * 2 + 0.3;
        let frag;
        if (sp === 'cube') frag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), saltM);
        else if (sp === 'hex') frag = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, 0.32, 6), saltM);
        else frag = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), saltM);
        frag.position.set(Math.sin(a2) * 0.78, 0.12, Math.cos(a2) * 0.78);
        if (sp !== 'cube') frag.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        else frag.rotation.y = a2;                        // 정육면체는 반듯하게 놓인다
        frag.castShadow = true; cg.add(frag);
      }
      cands.push({ x, z, ok: sp === 'cube', grp: cg,
        why: sp === 'hex' ? WRONG.salt_hex : WRONG.salt_rough });
    });
    return { kind: 'salt', dir, group: g, cands };
  };

  // 5) 덫 자리 — 흔적을 읽고 **미끼 접시**를 고른다
  //
  // ★ 처음엔 바닥에 판자를 눕혀 놨더니 스크린샷에서 "널브러진 널판"으로 보였다.
  //   재 보니 그럴 만했다 — 덫이 흙판(반경 2.2) **밖**인 2.6u에 있었고, 접시
  //   가운데 것은 중심에서 0.9u라 발자국·먹다 만 것과 겹쳤고, 접시 간격 1.5u는
  //   손 닿는 거리 1.4u와 거의 같았다.
  //   그래서 **한 축 위에 늘어놓는다.** 짐승이 오는 길(u축)을 정하고,
  //   흔적 → 미끼 접시 셋 → 제단이 그 길을 따라 순서대로 선다.
  //   덫은 **띄운 제단**이다. 바닥에 붙은 물건은 지형에 묻히고 눕혀 놓은 것처럼
  //   보이지만, 다리를 달아 띄우면 "놓인 것"으로 읽힌다.
  const buildTrap = (dir, seed) => {
    const g = plant(dir);
    const rnd = mkRnd(seed);
    const beast = BEASTS[Math.floor(rnd() * BEASTS.length)];
    const A = rnd() * Math.PI * 2;                     // 짐승이 오는 방향
    const su = Math.sin(A), cu = Math.cos(A);
    // 로컬 좌표: u는 오는 길, v는 그 옆
    const at = (u, v) => ({ x: su * u + cu * v, z: cu * u - su * v });

    // ★ 여기가 이 자리의 **전부**다. 발자국과 먹다 만 것이 곧 문제고, 제단과 접시는
    //   답을 적는 칸일 뿐이다. 그런데 처음엔 발자국이 0.2×0.34짜리라 플레이 거리
    //   (7.5u 뒤)에서 **아예 안 보였다.** 단서가 안 보이면 남는 건 접시 셋 찍기다.
    //   레퍼런스도 같은 말을 한다 — 몬스터 헌터의 함정은 지면 자국이 크고 대비가
    //   세서 못 지나친다. 자국을 키우고, 풀밭 위에서 읽히도록 어둡게 깐다.
    // ★ 처음엔 같은 크기 판 아홉을 0.5u 간격으로 깔았더니 **연속된 널판**이 됐다.
    //   닳은 길은 규칙적이지 않다 — 폭·각도·간격을 흔들고 사이를 벌려 둔다.
    const PATH = toon(0x6b5940), FOOT = toon(0x2e2419);
    for (let k = 0; k < 8; k++) {
      const p2 = at(-3.3 + k * 0.62, (rnd() - 0.5) * 0.4);
      layFlat(box(0.85 + rnd() * 0.6, 0.08, 0.5 + rnd() * 0.3, PATH, 0, 0, 0, g),
        g, p2.x, p2.z, A + (rnd() - 0.5) * 0.5, 0.02);
    }
    // 발자국 — 오는 길을 따라 제단 쪽으로. 크고 어둡게, 그리고 짐승마다 모양이 다르다.
    for (let k = 0; k < 5; k++) {
      const u = -3.0 + k * 0.62;
      for (const sd of [-0.3, 0.3]) {
        const p2 = at(u, sd + (beast.id === 'graze' ? 0 : (k % 2 ? 0.06 : -0.06)));
        const gy = groundY(g, p2.x, p2.z) + 0.055;
        void gy;
        if (beast.id === 'graze') {                 // 갈라진 발굽 — 둘로 나뉜 자국
          for (const half of [-0.09, 0.09]) {
            const q = at(u, sd + half);
            layFlat(box(0.15, 0.06, 0.38, FOOT, 0, 0, 0, g), g, q.x, q.z, A, 0.05);
          }
        } else if (beast.id === 'dig') {             // 발톱이 길게 끌린 자국
          layFlat(box(0.3, 0.06, 0.7, FOOT, 0, 0, 0, g), g, p2.x, p2.z, A, 0.05);
        } else {                                     // 깡충이 — 앞이 넓은 두 발
          layFlat(box(0.38, 0.06, 0.5, FOOT, 0, 0, 0, g), g, p2.x, p2.z, A, 0.05);
        }
      }
    }
    // 먹다 만 것 — **미끼가 무엇인지 여기 적혀 있다.** 길에서 비켜 둔다.
    const lk = beast.eats;
    const lp = at(-2.5, 1.45);
    // ★ 미끼가 무엇인지 **여기 적혀 있다.** 작으면 그건 안 적힌 것이다 —
    //   밝은 돌판 위에 올리고 크기를 키운다(먹다 만 것이라 조각도 흩어 둔다).
    const lgy = groundY(g, lp.x, lp.z);
    layFlat(box(1.1, 0.1, 1.1, toon(0xa8a49a), 0, 0, 0, g), g, lp.x, lp.z, A, 0.04);
    const left = new THREE.Mesh(
      lk === 'fruit' ? new THREE.IcosahedronGeometry(0.34, 0)
        : lk === 'mushroom' ? new THREE.ConeGeometry(0.32, 0.4, 7)
          : new THREE.BoxGeometry(0.62, 0.09, 0.3),
      toon(lk === 'fruit' ? 0xb8402c : lk === 'mushroom' ? 0xb9663f : 0x6f9c52));
    left.position.set(lp.x, lgy + 0.28, lp.z);
    left.rotation.set(0.4, A, 0.25);                 // 먹다 만 것은 반듯하지 않다
    left.castShadow = true; g.add(left);
    for (let k = 0; k < 3; k++) {                    // 부스러기
      const q = at(-2.5 + (k - 1) * 0.32, 1.45 + (k % 2 ? 0.3 : -0.3));
      const bit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0),
        toon(lk === 'fruit' ? 0xb8402c : lk === 'mushroom' ? 0xb9663f : 0x6f9c52));
      bit.position.set(q.x, groundY(g, q.x, q.z) + 0.1, q.z); g.add(bit);
    }
    // 털 몇 올 — 반대편에
    for (let k = 0; k < 4; k++) {
      const fp2 = at(-2.0 - k * 0.18, -1.3 - (k % 2) * 0.2);
      box(0.05, 0.03, 0.28, furM, fp2.x, groundY(g, fp2.x, fp2.z) + 0.05, fp2.z, g)
        .rotation.y = A + 0.4;
    }

    // ── 제단형 덫 ─────────────────────────────────────────────────────────
    const tp0 = at(2.7, 0);
    const trapG = new THREE.Group();
    trapG.position.set(tp0.x, groundY(g, tp0.x, tp0.z), tp0.z);
    trapG.rotation.y = A;
    g.add(trapG);
    blocks.push({ g, x: tp0.x, z: tp0.z, r: TRAP_BLOCK });   // 제단 위엔 못 올라선다
    const PLAT_Y = 0.58;                              // 띄운 높이
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(0.26, PLAT_Y, 0.26, toon(0x7d776c), sx * 0.62, PLAT_Y / 2, sz * 0.62, trapG);
    }
    box(1.72, 0.18, 1.72, toon(0xa8a49a), 0, PLAT_Y + 0.09, 0, trapG);   // 돌판
    box(1.96, 0.09, 1.96, toon(0xc2bdb0), 0, PLAT_Y + 0.22, 0, trapG);   // 갓돌 — 밝게
    // 문틀 — 기둥 둘과 가로대. 문은 위에 걸려 있다가 걸리면 내려온다.
    for (const sx of [-1, 1]) box(0.22, 1.6, 0.22, toon(0x7a5b3a), sx * 0.9, PLAT_Y + 1.05, 0, trapG);
    box(2.24, 0.26, 0.3, toon(0x7a5b3a), 0, PLAT_Y + 1.95, 0, trapG);
    const gate = box(1.68, 1.1, 0.14, toon(0x8a6a44), 0, PLAT_Y + 1.3, 0.66, trapG);
    for (let k = 0; k < 5; k++) box(0.08, 1.0, 0.08, toon(0x4a3625),
      -0.66 + k * 0.33, PLAT_Y + 1.3, 0.66, trapG);
    // 판 위에 올려 둔 미끼 — 무엇을 걸었는지 눈으로 보인다
    const baitM = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), toon(0xb8402c));
    baitM.position.set(0, PLAT_Y + 0.42, 0); baitM.visible = false; trapG.add(baitM);

    // ── 짐승 ──────────────────────────────────────────────────────────────
    // ★ "실제 동물이 와서 먹는 연출". 시간만 흐르고 결과만 바뀌면 그건 타이머지
    //   사냥이 아니다. 길을 따라 걸어 들어와 판 위에 올라선다.
    const beastG = new THREE.Group();
    beastG.visible = false; g.add(beastG);
    const fur = toon(beast.id === 'hop' ? 0xb59a76 : beast.id === 'dig' ? 0x6f5a45 : 0x8d8672);
    const body = box(0.46, 0.36, 0.72, fur, 0, 0.34, 0, beastG);
    box(0.34, 0.3, 0.3, fur, 0, 0.5, -0.46, beastG);                     // 머리
    for (const sx of [-1, 1]) {                                          // 귀 — 짐승마다 다르다
      const ear = box(0.1, beast.id === 'hop' ? 0.42 : 0.14, 0.08, fur,
        sx * 0.11, beast.id === 'hop' ? 0.82 : 0.66, -0.5, beastG);
      ear.rotation.z = sx * 0.2;
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(0.11, 0.28, 0.11, fur, sx * 0.17, 0.14, sz * 0.22, beastG);
    }
    box(0.12, 0.12, 0.22, fur, 0, 0.4, 0.44, beastG);                    // 꼬리
    for (const sx of [-1, 1]) box(0.04, 0.04, 0.04, basic(0x241a12), sx * 0.09, 0.54, -0.61, beastG);

    const dishes = [];
    ['fruit', 'mushroom', 'herb'].forEach((k, i) => {
      const p2 = at(0.9, (i - 1) * 1.9);              // 간격 1.9u — 손 닿는 거리 1.4보다 넉넉히
      const gy = groundY(g, p2.x, p2.z);
      box(0.66, 0.42, 0.66, toon(0xa8a49a), p2.x, gy + 0.21, p2.z, g);   // 밝은 돌받침
      const d3 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.16, 8), toon(0x7a5b3a));
      d3.position.set(p2.x, gy + 0.5, p2.z); d3.castShadow = true; g.add(d3);
      const mark = new THREE.Mesh(
        k === 'fruit' ? new THREE.IcosahedronGeometry(0.17, 0)
          : k === 'mushroom' ? new THREE.ConeGeometry(0.16, 0.2, 7)
            : new THREE.BoxGeometry(0.32, 0.05, 0.14),
        toon(k === 'fruit' ? 0xb8402c : k === 'mushroom' ? 0xb9663f : 0x6f9c52));
      mark.position.set(p2.x, gy + 0.68, p2.z); g.add(mark);
      dishes.push({ x: p2.x, z: p2.z, kind: k, mark });
    });

    return { kind: 'meat', dir, group: g, beast, dishes, A, at,
      trap: { x: tp0.x, z: tp0.z, set: null, t: 0, done: false,
        gate, gateY: PLAT_Y + 1.3, baitM, beastG, platY: PLAT_Y + 0.26, caught: false } };
  };

  // ── 자리 놓기 ────────────────────────────────────────────────────────────
  const BUILD = { fruit: buildFruit, mushroom: buildMushroom, herb: buildHerb,
    salt: buildSalt, meat: buildTrap };
  for (const k of KINDS) { found[k.id] = false; bag[k.id] = 0; }

  // 자리를 짓는다. 블록(부딪히는 것)은 어느 자리 것인지 표시해 둔다 —
  // 다시 지을 때 옛 블록을 걷어내야 하니까.
  let seedTick = 1;
  const raise = (kind, dir, seed, id) => {
    const before = blocks.length;
    const site = BUILD[kind](dir, seed);
    for (let k = before; k < blocks.length; k++) blocks[k].site = id;
    site.id = id; site.dir = dir; site.seed = seed; site.regrowT = -1;
    return site;
  };
  for (const sp of spots) sites.push(raise(sp.kind, sp.dir, sp.seed, `${sp.kind}${sp.idx}`));

  // ── 전설의 재료 셋 ───────────────────────────────────────────────────────
  // 후보가 없다. 고를 것이 없으니 **찾는 것 자체가 문제**다.
  // 멀리서 보이는 표식도 없다 — 있으면 그건 숨긴 게 아니라 안내판이다.
  // 대신 가까이(18u) 가면 은은히 빛나서, 근처까지 왔다면 놓치지는 않는다.
  const LEG = { icebloom: 0xa9d8ea, nightmoss: 0x59c48a, starstone: 0xc8a2e0 };
  const buildLegend = (spec) => {
    const g = plant(spec.dir);
    const col = LEG[spec.id];
    const glow = basic(col, 0.9);
    const cg = cand(g, 0, 0);
    if (spec.id === 'icebloom') {                 // 얼음꽃 — 바위 틈의 결정
      const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), toon(0x8b8b93));
      rk.position.y = 0.3; rk.castShadow = true; cg.add(rk);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const sp2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.62, 4), glow);
        sp2.position.set(Math.sin(a) * 0.24, 0.85, Math.cos(a) * 0.24);
        sp2.rotation.z = -Math.sin(a) * 0.5; sp2.rotation.x = Math.cos(a) * 0.5;
        cg.add(sp2);
      }
    } else if (spec.id === 'nightmoss') {         // 밤빛이끼 — 바닥에 번진 빛
      const patch = new THREE.Mesh(new THREE.CircleGeometry(1.15, 12), basic(col, 0.5));
      patch.rotation.x = -Math.PI / 2; patch.position.y = 0.03; cg.add(patch);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + 0.3, r2 = 0.25 + (k % 3) * 0.28;
        const b2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), glow);
        b2.position.set(Math.sin(a) * r2, 0.14, Math.cos(a) * r2); cg.add(b2);
      }
    } else {                                      // 별똥돌 — 얕은 구덩이 속 갈라진 돌
      const crater = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.9, 14), toon(0x6a5843));
      crater.rotation.x = -Math.PI / 2; crater.position.y = 0.03; cg.add(crater);
      const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), toon(0x3a3540));
      rk.position.y = 0.42; rk.castShadow = true; cg.add(rk);
      for (const ax of [0, 1]) {
        const seam = box(ax ? 1.3 : 0.09, 0.09, ax ? 0.09 : 1.3, glow, 0, 0.5, 0, cg);
        seam.rotation.y = ax * 0.6;
      }
    }
    const lt = new THREE.PointLight(col, 3.2, 9, 1.8);
    lt.position.y = 0.8; cg.add(lt);
    return { kind: spec.id, dir: spec.dir, group: g, legend: true,
      cands: [{ x: 0, z: 0, ok: true, why: '', grp: cg }] };
  };
  for (const spec of legendSpots || []) {
    found[spec.id] = false; bag[spec.id] = 0;
    const before = blocks.length;
    const site = buildLegend(spec);
    for (let k = before; k < blocks.length; k++) blocks[k].site = spec.id;
    site.id = spec.id; site.seed = 1; site.regrowT = -1;
    BUILD[spec.id] = () => buildLegend(spec);      // 다시 날 때도 같은 모양
    sites.push(site);
  }

  // 다시 난다 — 자리는 그대로, **문제만 새로 섞인다.**
  const regrow = (site) => {
    const i = sites.indexOf(site);
    if (i < 0) return;
    scene.remove(site.group);
    site.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (let k = blocks.length - 1; k >= 0; k--) if (blocks[k].site === site.id) blocks.splice(k, 1);
    // 새 씨앗 — 같은 자리라도 답이 달라진다
    const seed = (site.seed * 7919 + seedTick++ * 104729) % 2147483647;
    sites[i] = raise(site.kind, site.dir, seed, site.id);
  };

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
    // ★ 검사용 — 만질 것과 그 손 닿는 거리. 연구실이 검사 I에서 쓰는 것과 같은 꼴이다.
    //   덫에 충돌체를 다는 순간 밀려나는 거리(1.15+0.32)가 손(1.4)보다 커져
    //   **영영 못 만지는** 상태가 됐었다 — 연구실 콘솔과 똑같은 실수였다.
    //   목록을 여기서 내보내야 검사가 옛 자리를 재는 일이 없다.
    touchables(site) {
      if (site.kind === 'meat') {
        return [{ name: '덫', x: site.trap.x, z: site.trap.z, r: TRAP_REACH }]
          .concat(site.dishes.map((d, i) => ({ name: `접시${i + 1}`, x: d.x, z: d.z, r: REACH })));
      }
      return site.cands.map((c, i) => ({ name: `후보${i + 1}`, x: c.x, z: c.z, r: REACH }));
    },
    RULES,

    update(dt) {
      for (let i = sites.length - 1; i >= 0; i--) {
        const s = sites[i];
        if (s.regrowT > 0) {
          s.regrowT -= dt;
          if (s.regrowT <= 0) { regrow(s); continue; }
        }
        if (s.kind !== 'meat' || !s.trap.set) continue;
        const t = s.trap;
        t.t += dt;
        const right = t.set === s.beast.eats;
        // ★ 시간만 흐르고 결과만 바뀌면 그건 타이머지 사냥이 아니다.
        //   맞는 미끼면 마지막 7초 동안 **길을 따라 걸어 들어온다.**
        if (right && !t.caught && t.t >= TRAP_WAIT - APPROACH) {
          const k = Math.min(1, (t.t - (TRAP_WAIT - APPROACH)) / APPROACH);
          const u = -6.0 + k * 8.7;                   // 길 밖에서 제단까지
          const p2 = s.at(u, 0);
          t.beastG.visible = true;
          const gy = k < 0.92 ? 0 : t.platY;          // 마지막에 판 위로 올라선다
          t.beastG.position.set(p2.x, gy + Math.abs(Math.sin(k * 26)) * 0.16, p2.z);
          t.beastG.rotation.y = s.A + Math.PI;
        }
        if (t.t >= TRAP_WAIT && !t.done) {
          t.done = true;
          t.caught = right;
          if (right) {
            t.gate.position.y = t.gateY - 0.86;       // 문이 내려온다
            t.baitM.visible = false;
          } else {
            t.beastG.visible = false;
            t.baitM.visible = false;                  // 미끼만 없어졌다
          }
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
        if (Math.hypot(l.x - t.x, l.z - t.z) < TRAP_REACH) {
          if (t.caught) return `E — 걸린 ${josa(s.beast.name, '을')} 거두기`;
          // ★ 시간이 다 됐는데 아무것도 안 걸렸을 때 "놓아둔 지 0초"만 계속 떠 있었다.
          //   빈 덫인지 아직 기다리는 중인지 알 길이 없어서 **영원히 기다리는 것처럼**
          //   보였다. 헛수고였다는 것도 결과다 — 결과는 말해 줘야 한다.
          if (t.done) return 'E — 빈 덫을 거두기';
          if (t.set) {
            if (t.beastG.visible) return '🐾 뭔가 온다 — 움직이지 말자';
            return `🪤 놓아둔 지 ${Math.max(0, Math.ceil(TRAP_WAIT - t.t))}초`;
          }
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
      if (s.legend) {
        const c2 = s.cands[0];
        if (c2.taken) return `🌱 가져갔다 — 다시 나기까지 ${Math.max(1, Math.ceil(s.regrowT))}초`;
        if (Math.hypot(l.x, l.z) > REACH) return '✨ 뭔가 빛난다';
        const lg = LEGEND.find((x) => x.id === s.kind);
        return `E — ${josa(lg.label, '을')} 가져가기`;
      }
      const lab = KINDS.find((k) => k.id === s.kind).label;
      const c = nearestOf(s.cands, l);
      if (!c) return `🌿 ${lab} 자리 — ${RULES[s.kind]}`;
      if (c.taken) return `🌱 가져갔다 — 다시 나기까지 ${Math.max(1, Math.ceil(s.regrowT))}초`;
      return `E — 이걸로 고르기 (${lab})`;
    },

    // 무엇을 했는지 문자열로 돌려준다. 대사·수첩은 boot이 맡는다.
    interact(worldPos) {
      const s = siteAt(worldPos);
      if (!s) return null;
      const l = localOf(s, worldPos);
      if (s.kind === 'meat') {
        const t = s.trap;
        if (Math.hypot(l.x - t.x, l.z - t.z) < TRAP_REACH) {
          const reset = () => {
            t.set = null; t.t = 0; t.done = false; t.caught = false;
            t.gate.position.y = t.gateY;
            t.beastG.visible = false; t.baitM.visible = false;
            for (const d3 of s.dishes) d3.mark.visible = true;
          };
          if (t.caught) {
            reset();
            bag.meat = (bag.meat || 0) + 1;
            const first = !found.meat; found.meat = true;
            return { kind: 'meat', ok: true, first };
          }
          if (t.done) { reset(); return { kind: 'meat', ok: false, why: WRONG.empty }; }
          return null;
        }
        const d2 = nearestOf(s.dishes, l);
        if (d2 && !t.set && bag[d2.kind] > 0) {
          bag[d2.kind]--;
          t.set = d2.kind; t.t = 0; t.done = false; t.caught = false;
          // 접시에서 집어 제단 위에 올려 둔다 — 무엇을 걸었는지 눈으로 보인다
          d2.mark.visible = false;
          t.baitM.visible = true;
          t.baitM.material = toon(d2.kind === 'fruit' ? 0xb8402c
            : d2.kind === 'mushroom' ? 0xb9663f : 0x6f9c52);
          return { kind: 'bait', ok: d2.kind === s.beast.eats, set: d2.kind };
        }
        return null;
      }
      const c = nearestOf(s.cands, l);
      if (!c || c.taken) return null;
      if (!c.ok) return { kind: s.kind, ok: false, why: c.why };
      c.taken = true;
      if (c.grp) c.grp.visible = false;
      s.regrowT = REGROW;                 // 이 자리는 잠시 뒤 새로 난다
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
