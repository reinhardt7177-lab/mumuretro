// 사당 입구 — 아트 바이블 §4 실루엣 · §5 형태 언어.
//
// 이 세계에서 유일하게 **각진** 것이다. 나무는 원뿔, 바위는 덩어리, 지형은 매끈한 곡면이다.
// 사당만 직선과 직각으로 서 있으면 아이는 배우지 않고도 안다 — 저건 사람이 만든 것이다.
//
// 그리고 빛기둥. 이게 §1의 "가볼 만한 목표"를 실제로 만든다.
// 지형 실루엣은 지평선(28u) 안에서만 읽히지만, 하늘로 솟는 빛은 능선 너머에서도 보인다.
// v1의 시련소에서 이미 확인된 수법이다 — "저기 뭔가 있다"를 만드는 가장 싼 방법.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { SHRINE } from '../data/lighting.js';

// 플레이어 키 1.5u 기준. 전체 높이 8u ≈ 5.3배 — 지형 봉우리(최대 15u)보다는 낮고
// 나무(4.6~8u)와는 비슷하되, 형태가 완전히 달라 섞이지 않는다.
const BASE_R = 3.4;          // 기단 반경. 이 값이 충돌 반경과 진입 판정의 기준이 된다
const DOOR_W = 1.5, DOOR_H = 2.4;   // 입구 — 플레이어(1.5u)가 넉넉히 들어간다
const BEAM_H = 46;           // 빛기둥 높이. 지평선 28u 밖에서도 보이려면 이 정도는 되어야 한다

const DEG = Math.PI / 180;

// ── 배치 ────────────────────────────────────────────────────────────────────
// 봉우리 근처에 두되 **봉우리 위에는 두지 않는다.** 정상은 경사가 급해서
// 걸어서 못 닿고(v1에서 8곳 중 4곳이 그랬다), 무엇보다 봉우리 자신이 이미 랜드마크다.
// 중턱의 완만한 자리에 두면 "봉우리를 향해 걷다가 사당을 만난다"가 된다.
export function pickShrineSpots(planet, peaks, opts = {}) {
  const count = opts.count ?? 6;
  const MAX_SLOPE = opts.maxSlope ?? 15;      // 이보다 가파르면 기단이 지형을 뚫거나 뜬다
  const spots = [];

  // ★ 처음엔 봉우리 반경의 55% 지점만 훑었다가 한 곳도 못 골랐다.
  //   봉우리는 원뿔이라 **중턱이 가장 가파르다** — 주 봉우리는 atan(15/26) ≈ 30°다.
  //   완만한 곳은 기슭이다. 그래서 여러 고리를 훑어 가장 완만한 자리를 고른다.
  const RINGS = [0.72, 0.88, 1.02, 1.18, 1.35];

  const scored = [];
  for (let i = 0; i < peaks.length; i++) {
    const p = peaks[i];
    const la = p.lat * DEG, lo = p.lon * DEG;
    const center = new THREE.Vector3(
      Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo));
    const ref = Math.abs(center.y) > 0.99 ? _X : _Y;
    const e = new THREE.Vector3().crossVectors(ref, center).normalize();
    const n = new THREE.Vector3().crossVectors(center, e).normalize();

    let best = null, bestSlope = 999;
    for (const rk of RINGS) {
      const ringAng = p.r * DEG * rk;
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        const d = center.clone()
          .addScaledVector(e, Math.sin(a) * ringAng)
          .addScaledVector(n, Math.cos(a) * ringAng).normalize();
        const sl = planet.slopeDegAt(d);
        if (sl < bestSlope) { bestSlope = sl; best = d; }
      }
    }
    if (best && bestSlope <= MAX_SLOPE) scored.push({ dir: best, slope: bestSlope, peak: i, h: p.h });
  }

  // 큰 봉우리 옆의 사당부터 고른다 — 봉우리가 크면 멀리서 보이고, 사당이 그 옆에 있으면
  // "저 산을 향해 걷다 보면 사당을 만난다"가 성립한다.
  scored.sort((a, b) => b.h - a.h);

  // 서로 너무 가까우면 하나만 남긴다. 30u는 지평선(28u)보다 조금 커서,
  // 한 사당에 서면 다음 사당이 겨우 안 보이는 거리다 — 찾아 나설 이유가 생긴다.
  const MIN_SEP = 30 / planet.R;
  for (const c of scored) {
    if (spots.length >= count) break;
    if (spots.some(s => s.dir.angleTo(c.dir) < MIN_SEP)) continue;
    spots.push(c);
  }
  return spots;
}

// ── 구조물 ──────────────────────────────────────────────────────────────────
function buildStructure() {
  const g = new THREE.Group();
  const stone = toon(SHRINE.stone);
  const dark = toon(SHRINE.stoneDark);
  const lite = toon(SHRINE.stoneLite);
  // 발광면은 조명을 받으면 안 된다 — 받는 순간 그늘진 쪽이 어두워져 '빛'으로 안 읽힌다.
  const glow = new THREE.MeshBasicMaterial({ color: SHRINE.glow });
  glow.userData.outlineParameters = { visible: false };

  const put = (mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  // 기단 3단 — 아래로 갈수록 넓다. 계단처럼 보여야 "올라가는 곳"으로 읽힌다.
  put(box(BASE_R * 2.00, 0.45, BASE_R * 2.00, dark), 0, 0.225, 0);
  put(box(BASE_R * 1.72, 0.42, BASE_R * 1.72, stone), 0, 0.66, 0);
  put(box(BASE_R * 1.48, 0.40, BASE_R * 1.48, lite), 0, 1.07, 0);

  // 본체 — 위로 갈수록 좁아지는 사다리꼴. 정확한 직육면체보다 이쪽이 '지어진 것'으로 보인다.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.55, 4.3, 4), stone);
  body.rotation.y = Math.PI / 4;      // 4각 기둥의 면을 정면으로
  put(body, 0, 3.42, 0);

  // 입구 — 어두운 구멍. 안쪽을 발광시키지 않는다. 검은 구멍이라야 "들어가는 곳"이 된다.
  const doorDepth = 0.55;
  put(box(DOOR_W, DOOR_H, doorDepth, new THREE.MeshBasicMaterial({ color: 0x0d1418 })),
    0, 1.27 + DOOR_H / 2, 2.26);
  // 문틀 — 발광 띠 두 줄. 입구가 어디인지 멀리서도 알린다.
  put(box(DOOR_W + 0.34, 0.14, 0.16, glow), 0, 1.27 + DOOR_H + 0.07, 2.42);
  for (const s of [-1, 1]) put(box(0.14, DOOR_H + 0.14, 0.16, glow), s * (DOOR_W / 2 + 0.17), 1.27 + DOOR_H / 2, 2.42);

  // 지붕 판 + 첨탑
  put(box(BASE_R * 1.62, 0.34, BASE_R * 1.62, dark), 0, 5.74, 0);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.9, 4), lite);
  spire.rotation.y = Math.PI / 4;
  put(spire, 0, 6.86, 0);
  // 꼭대기 보석 — 빛기둥의 뿌리
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), glow);
  orb.userData.outlineParameters = { visible: false };
  put(orb, 0, 8.05, 0);

  // 옆면 발광 띠 — 본체가 통짜 돌덩이로 보이지 않게 가른다.
  for (const s of [-1, 1]) {
    put(box(0.10, 2.6, 0.10, glow), s * 1.98, 3.4, 1.98);
    put(box(0.10, 2.6, 0.10, glow), s * 1.98, 3.4, -1.98);
  }

  // ── 빛기둥 ────────────────────────────────────────────────────────────────
  // 위로 갈수록 사라진다. 끝이 딱 잘리면 '기둥'이 아니라 '막대'로 보인다.
  const beamGeo = new THREE.CylinderGeometry(0.62, 1.05, BEAM_H, 7, 1, true);
  const bpos = beamGeo.attributes.position;
  const bcol = new Float32Array(bpos.count * 3);
  const c0 = new THREE.Color(SHRINE.glow), c1 = new THREE.Color(SHRINE.glowDim);
  const tmp = new THREE.Color();
  for (let i = 0; i < bpos.count; i++) {
    const t = (bpos.getY(i) + BEAM_H / 2) / BEAM_H;      // 0 아래 → 1 위
    tmp.copy(c0).lerp(c1, t);
    bcol[i * 3] = tmp.r; bcol[i * 3 + 1] = tmp.g; bcol[i * 3 + 2] = tmp.b;
  }
  beamGeo.setAttribute('color', new THREE.BufferAttribute(bcol, 3));
  const beamMat = new THREE.ShaderMaterial({
    vertexColors: true, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, fog: false,
    uniforms: { uH: { value: BEAM_H } },
    vertexShader: `
      varying float vT; varying vec3 vC;
      void main(){ vT = (position.y + ${(BEAM_H / 2).toFixed(1)}) / ${BEAM_H.toFixed(1)};
        vC = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      varying float vT; varying vec3 vC;
      void main(){
        // 아래는 진하고 위로 갈수록 사라진다. 제곱이라 밑동만 또렷하다.
        float a = pow(1.0 - vT, 1.8) * 0.55;
        gl_FragColor = vec4(vC, a);
      }
    `,
  });
  beamMat.userData.outlineParameters = { visible: false };
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 8.0 + BEAM_H / 2;
  beam.renderOrder = 2;
  beam.frustumCulled = false;     // 기둥이 화면 밖으로 나가도 밑동은 보여야 한다
  g.add(beam);

  return { group: g, beam };
}

export function buildShrines(scene, planet, spots) {
  const R = planet.R;
  const shrines = [];
  const colliders = [];

  for (const sp of spots) {
    const { group } = buildStructure();
    const fr = planet.frameAt(planet.surfaceAt(sp.dir), 0);
    group.position.copy(fr.position);
    group.quaternion.copy(fr.quaternion);
    scene.add(group);

    // 입구가 향하는 방향(로컬 +Z)을 월드로. 나중에 "들어간다" 판정에 쓴다.
    const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion);
    const shrine = {
      dir: sp.dir.clone(), pos: fr.position.clone(), group, facing,
      slope: sp.slope, peak: sp.peak, entered: false,
    };
    shrines.push(shrine);
    // 기단을 막는다. 입구 앞은 비워야 하므로 반경을 기단보다 조금 작게 잡는다 —
    // 정확히 기단 크기로 막으면 계단에 올라설 수가 없다.
    colliders.push({ dir: sp.dir.clone(), r: BASE_R * 0.92 });
  }

  const _up = new THREE.Vector3(), _tan = new THREE.Vector3();
  const resolve = (position, playerR = 0.32) => {
    _up.copy(position).normalize();
    let hit = 0;
    for (const c of colliders) {
      const cosA = _up.dot(c.dir);
      if (cosA <= 0) continue;
      const need = (c.r + playerR) / R;
      if (cosA >= Math.cos(need)) {
        _tan.copy(_up).addScaledVector(c.dir, -cosA);
        if (_tan.lengthSq() < 1e-12) continue;
        _tan.normalize();
        _up.copy(c.dir).multiplyScalar(Math.cos(need)).addScaledVector(_tan, Math.sin(need)).normalize();
        hit++;
      }
    }
    if (hit) { position.copy(_up); planet.projectToSurface(position); }
    return hit;
  };

  // 가장 가까운 사당과 그 거리(월드). 진입 프롬프트와 검증에 쓴다.
  const _p = new THREE.Vector3();
  const nearest = (position) => {
    _p.copy(position).normalize();
    let best = null, bd = Infinity;
    for (const s of shrines) {
      const d = _p.angleTo(s.dir) * R;
      if (d < bd) { bd = d; best = s; }
    }
    return { shrine: best, distU: bd };
  };

  console.log(`[shrine] 사당 ${shrines.length}곳 · 기단 반경 ${BASE_R}u · 빛기둥 ${BEAM_H}u`
    + ` · 최대 경사 ${Math.max(...shrines.map(s => s.slope)).toFixed(1)}°`);

  return { shrines, colliders, resolve, nearest, BASE_R, ENTER_R: BASE_R + 2.0 };
}

const _Y = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(1, 0, 0);
