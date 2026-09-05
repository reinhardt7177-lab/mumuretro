// 구면 행성 — 아트 바이블 §1 "삼각형 규칙".
//
// ★ 이전 버전은 FBM 노이즈 4옥타브 + 능선 노이즈로 지형을 만들었다. 폐기했다.
//   절차 노이즈는 균일하게 울퉁불퉁할 뿐이라 **눈을 아무 데로도 유도하지 않는다.**
//   어디에 서도 보이는 것이 같고, 가야 할 이유가 생기는 지점이 없다.
//
// 대신 봉우리를 **손으로 배치**한다. BotW 아트 디렉터 타키자와가 GDC에서 밝힌 삼각형 규칙:
// 삼각형 언덕은 (1) 눈을 정상으로 유도하고 (2) 그 너머를 가려 궁금하게 만들고
// (3) 넘어갈지 돌아갈지 선택을 준다. 노이즈는 셋 중 아무것도 못 한다.
//
// 노이즈는 완전히 버리지 않고 **표면 잔결**로 강등한다(±0.8u). 실루엣은 절대 건드리지 않는다.
import * as THREE from 'three';
import { fbm } from '../util/noise.js';
import { GROUND } from '../data/lighting.js';

// 고도와 경사로 지면 색을 고른다.
// ★ 지도(ui/MapPage.js)가 이 함수를 그대로 쓴다. 지도용 색을 따로 적으면
//   지형을 손볼 때마다 두 곳이 어긋나고, 아이 눈에는 "지도가 틀렸다"로 보인다.
const _gLow = new THREE.Color(GROUND.grassLow);
const _gHigh = new THREE.Color(GROUND.grassHigh);
const _rock = new THREE.Color(GROUND.rock);
const _rockD = new THREE.Color(GROUND.rockDark);
const _peak = new THREE.Color(GROUND.peak);
const _sand = new THREE.Color(GROUND.sand);

export function terrainColor(h, slopeDeg, out) {
  // 고도 t: 분지 바닥(−3) → 최고봉(15)
  const t = Math.min(1, Math.max(0, (h + 3) / 18));
  if (slopeDeg > 34) out.copy(slopeDeg > 46 ? _rockD : _rock);      // 급경사는 노출암
  else if (t < 0.10) out.copy(_sand).lerp(_gLow, t / 0.10);          // 저지대 마른 흙 → 풀
  else if (t > 0.72) out.copy(_gHigh).lerp(_peak, (t - 0.72) / 0.28); // 정상부는 밝게
  else out.copy(_gLow).lerp(_gHigh, (t - 0.10) / 0.62);
  return out;
}

export const SCALE = 2;
export const R = 34 * SCALE;                 // 68u. 둘레 427u
export const GRAIN_AMP = 0.8;                // 표면 잔결 — 이 값이 2u를 넘으면 실루엣을 오염시킨다

// 지형 메시 세밀도. IcosahedronGeometry의 detail은 각 모서리를 (detail+1)등분한다.
// 정점 간격 ≈ 1.0515·R / (detail+1) = 1.98u — 로우폴리 면이 눈에 보이는 밀도다.
// 플랫 셰이딩과 면 단위 색을 쓰므로 이 면들이 곧 디테일이 된다(§"정점 색").
const DETAIL = 36;

// ── 봉우리 목록 ─────────────────────────────────────────────────────────────
// 손으로 배치한다. 이 배열이 이 행성의 지형 전부다.
//   r  영향 반경(도). 지평선이 23.6°이므로 r=22면 화면을 꽉 채우는 주 랜드마크가 된다
//   h  높이(월드 단위). 플레이어 키 1.5u 기준
//   s  프로파일 지수. 1.0이면 곧은 원뿔(=삼각형), 클수록 밑동이 넓고 끝이 뾰족해진다
//
// 크기를 반드시 다르게 둔다 — 같은 크기가 반복되면 노이즈와 똑같아진다.
// 큰 것 하나, 중간 다섯, 작은 여섯.
export const PEAKS = [
  // 주 랜드마크 — 행성 어디서든 이것 하나는 방향 기준이 된다
  { lat:  30, lon:   0, r: 22, h: 15.0, s: 1.15 },
  // 중간 — 구역을 가르고 시야를 자른다
  { lat: -10, lon:  70, r: 15, h:  9.0, s: 1.10 },
  { lat:  55, lon: 140, r: 14, h:  8.0, s: 1.25 },
  { lat: -40, lon: 200, r: 16, h: 10.0, s: 1.05 },
  { lat:  10, lon: 250, r: 13, h:  7.0, s: 1.20 },
  { lat: -25, lon: 310, r: 12, h:  6.5, s: 1.15 },
  // 작은 것 — 걷는 동안의 리듬. 넘어갈지 돌아갈지를 자주 묻는다
  { lat:  45, lon:  45, r:  8, h:  4.0, s: 1.30 },
  { lat: -55, lon:  20, r:  9, h:  4.5, s: 1.20 },
  { lat:  15, lon: 180, r:  8, h:  3.8, s: 1.35 },
  { lat: -15, lon: 120, r:  7, h:  3.2, s: 1.40 },
  { lat:  70, lon: 260, r: 10, h:  5.0, s: 1.10 },
  { lat: -70, lon: 150, r:  9, h:  4.2, s: 1.25 },
  // ── 커버리지 보충 ────────────────────────────────────────────────────────
  // §1 규칙 "어느 지점에 서도 목표가 최소 두 개". __dbg.landmarkCoverage로 재 보니
  // 위 12개만으로는 400표본 중 63곳에서 하나 이하만 보였다. 구멍 좌표를 그대로 읽어 메운다.
  // 높이를 6~7u대로 잡은 이유: 가시 거리 = 28 + √(2·R·h)라 6u면 57u까지 보인다.
  // 4u짜리로 메우면 51u밖에 못 미쳐 구멍이 다시 생긴다.
  { lat: -25, lon: 285, r: 13, h:  7.2, s: 1.15 },
  { lat: -18, lon:  10, r: 11, h:  6.2, s: 1.25 },
  { lat:  20, lon: 225, r: 12, h:  6.6, s: 1.10 },
  { lat:  25, lon: 118, r: 11, h:  6.0, s: 1.30 },
  { lat:  58, lon: 300, r: 12, h:  6.8, s: 1.20 },
  // 2차 보충 — 남반구 lon 130~225에 큰 공백이 남아 있었다(13곳).
  // (-30,172) 하나가 lon 136~164 무리와 193~225 무리를 동시에 덮는다.
  { lat: -30, lon: 172, r: 12, h:  6.6, s: 1.15 },
  { lat: -38, lon: 232, r: 11, h:  6.2, s: 1.20 },
  { lat:  -5, lon:  45, r: 11, h:  6.0, s: 1.25 },
];

// 얕은 분지 — 봉우리만 있으면 나머지가 전부 같은 높이의 평지가 된다.
// 파인 곳이 있어야 능선이 능선으로 읽힌다.
export const BASINS = [
  { lat:   0, lon:  35, r: 18, d: 3.0 },
  { lat:  35, lon: 200, r: 20, d: 3.6 },
  { lat: -50, lon: 265, r: 16, d: 2.6 },
];

const DEG = Math.PI / 180;

function latLonDir(latDeg, lonDeg) {
  const la = latDeg * DEG, lo = lonDeg * DEG;
  return new THREE.Vector3(
    Math.cos(la) * Math.cos(lo),
    Math.sin(la),
    Math.cos(la) * Math.sin(lo),
  );
}

// 미리 계산 — heightAt은 정점마다 불리므로 삼각함수를 매번 돌리면 안 된다.
const _peaks = PEAKS.map(p => ({
  dir: latLonDir(p.lat, p.lon), rad: p.r * DEG, h: p.h, s: p.s,
  cosR: Math.cos(p.r * DEG),
}));
const _basins = BASINS.map(b => ({
  dir: latLonDir(b.lat, b.lon), rad: b.r * DEG, d: b.d,
  cosR: Math.cos(b.r * DEG),
}));

export class Planet {
  constructor(scene) {
    this.R = R;
    this.scene = scene;
    this.mesh = this._build();
    if (scene) scene.add(this.mesh);
  }

  // ── 높이장 ────────────────────────────────────────────────────────────────
  // dir은 단위벡터. 반환값은 기준 R로부터의 높이(월드 단위).
  //
  // 봉우리 기여는 acos 없이 내적으로 끝낸다. 정점 27,000개 × 봉우리 12개를 매번
  // acos로 돌면 빌드가 눈에 띄게 멈춘다. cos(반경)과 비교해 영향권을 먼저 거른다.
  heightAt(dir) {
    let h = 0;
    for (const p of _peaks) {
      const c = dir.x * p.dir.x + dir.y * p.dir.y + dir.z * p.dir.z;
      if (c <= p.cosR) continue;             // 영향권 밖 — acos 없이 걸러낸다
      const ang = Math.acos(Math.min(1, c));
      if (ang >= p.rad) continue;
      const t = 1 - ang / p.rad;
      h += p.h * Math.pow(t, p.s);          // s=1이면 곧은 원뿔 = 삼각형 단면
    }
    for (const b of _basins) {
      const c = dir.x * b.dir.x + dir.y * b.dir.y + dir.z * b.dir.z;
      if (c <= b.cosR) continue;
      const ang = Math.acos(Math.min(1, c));
      if (ang >= b.rad) continue;
      const t = 1 - ang / b.rad;
      h -= b.d * t * t;                     // 분지는 가장자리를 부드럽게(t²)
    }
    // 표면 잔결 — 실루엣이 아니라 면의 질감. 주파수를 높게, 진폭을 낮게.
    h += fbm(dir.x * 9, dir.y * 9, dir.z * 9, 3) * GRAIN_AMP;
    return h;
  }

  // 표면점(|·| = R + height)
  surfaceAt(dir, out = new THREE.Vector3()) {
    out.copy(dir).normalize();
    return out.multiplyScalar(R + this.heightAt(out));
  }

  // 제자리에서 표면으로 투영 — SurfaceTransform이 매 이동마다 부른다.
  projectToSurface(v) {
    v.normalize();
    return v.multiplyScalar(R + this.heightAt(v));
  }

  latLonToPos(latDeg, lonDeg) {
    return this.surfaceAt(latLonDir(latDeg, lonDeg));
  }

  // 경사(도) — 프롭 배치와 등반 판정에 쓴다.
  // 접선 두 방향으로 살짝 움직여 높이차를 본다.
  slopeDegAt(dir) {
    const up = _t1.copy(dir).normalize();
    const ref = Math.abs(up.y) > 0.99 ? _X : _Y;
    const e = _t2.crossVectors(ref, up).normalize();
    const n = _t3.crossVectors(up, e).normalize();
    const d = 0.6 / R;                          // 0.6u 떨어진 두 점
    const h0 = this.heightAt(up);
    const he = this.heightAt(_t4.copy(up).addScaledVector(e, d).normalize());
    const hn = this.heightAt(_t4.copy(up).addScaledVector(n, d).normalize());
    const g = Math.hypot(he - h0, hn - h0) / 0.6;
    return Math.atan(g) * 180 / Math.PI;
  }

  // 표면 위 물체를 앉히는 프레임(위치 + 회전). rotDeg는 up축 기준 yaw.
  frameAt(pos, rotDeg = 0) {
    const up = _t1.copy(pos).normalize();
    const ref = Math.abs(up.y) > 0.99 ? _X : _Y;
    const e = _t2.crossVectors(ref, up).normalize();
    const n = _t3.crossVectors(up, e).normalize();
    const m = new THREE.Matrix4().makeBasis(e, up, n);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(_Y, rotDeg * DEG));
    return { position: this.surfaceAt(up), quaternion: q };
  }

  // ── 메시 ──────────────────────────────────────────────────────────────────
  // 플랫 셰이딩 + 면 단위 색. 텍스처를 쓰지 않는다(§"정점 색").
  // IcosahedronGeometry는 인덱스 없는 지오메트리라 정점 3개가 곧 한 면이다 —
  // 같은 색을 세 번 쓰면 면 전체가 단색이 되어 로우폴리 면이 또렷하게 읽힌다.
  _build() {
    const geo = new THREE.IcosahedronGeometry(R, DETAIL);
    const pos = geo.attributes.position;
    const n = pos.count;
    const colors = new Float32Array(n * 3);

    const d = new THREE.Vector3();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const col = new THREE.Color(), tmp = new THREE.Color();

    // 1) 정점을 높이장으로 밀어낸다
    const heights = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const h = this.heightAt(d);
      heights[i] = h;
      d.multiplyScalar(R + h);
      pos.setXYZ(i, d.x, d.y, d.z);
    }

    // 2) 면마다 색 — 고도와 경사 두 축으로 고른다
    for (let f = 0; f < n; f += 3) {
      a.set(pos.getX(f), pos.getY(f), pos.getZ(f));
      b.set(pos.getX(f + 1), pos.getY(f + 1), pos.getZ(f + 1));
      c.set(pos.getX(f + 2), pos.getY(f + 2), pos.getZ(f + 2));
      const hAvg = (heights[f] + heights[f + 1] + heights[f + 2]) / 3;

      // 면 법선과 반지름 방향의 각도 = 경사
      const nx = _t2.subVectors(b, a).cross(_t3.subVectors(c, a)).normalize();
      const up = _t4.copy(a).add(b).add(c).normalize();
      const slope = Math.acos(Math.min(1, Math.max(-1, Math.abs(nx.dot(up))))) * 180 / Math.PI;

      terrainColor(hAvg, slope, col);

      // 면마다 아주 살짝 흔든다. 완전히 같은 색이 넓게 이어지면 로우폴리가 저해상도로 보인다.
      const j = 0.965 + ((f * 2654435761) % 1000) / 1000 * 0.07;
      tmp.copy(col).multiplyScalar(j);

      for (let k = 0; k < 3; k++) {
        colors[(f + k) * 3] = tmp.r;
        colors[(f + k) * 3 + 1] = tmp.g;
        colors[(f + k) * 3 + 2] = tmp.b;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    mat.userData.outlineParameters = { visible: false };   // 지형에 외곽선은 그물망이 된다
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;                                // 구 전체가 자기 그림자를 던지면 얼룩진다
    return mesh;
  }

  // 봉우리 방향 목록 — 카메라·배치·검증에서 "랜드마크가 보이는가"를 물을 때 쓴다.
  peakDirs() { return _peaks.map(p => p.dir.clone()); }
}

const _Y = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(1, 0, 0);
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
const _t3 = new THREE.Vector3(), _t4 = new THREE.Vector3();
