// 행성 — icosphere + 지형 높이장 + 표면 헬퍼(heightAt, surfaceAt, latLonToPos, frameAt).
// UV 극점 핀칭이 없어 배치/정렬 균일.
import * as THREE from 'three';
import { toon, noOut } from '../rendering/Toon.js';
import { orientationFromFrame, orthonormalizeHeading } from './SurfaceTransform.js';
import { fbm, ridged, smoothstep, seedNoise } from '../util/noise.js';
import { REGIONS, MIST_ZONE, latLonDir, waterZones } from '../data/regions.js';

// ── 행성 배율 ──────────────────────────────────────────────────────────────
// SCALE=1이 원래 크기(R=34). 반지름·표면 테셀레이션·콘텐츠 밀도가 전부 여기서 유도된다.
// 각도 기반 값(위경도, 구역 Voronoi, 물 캡 각)은 자동으로 비례하지만
// 길이 기반 값(셀 간격, 그림자 범위, 근접 반경)은 SCALE로 명시 보정해야 한다.
export const SCALE = 2;
const BASE_R = 34;

export const R = BASE_R * SCALE;   // 반지름. 둘레 2πR, 보행 5u/s.

// 표면 삼각형의 "월드 크기"를 SCALE과 무관하게 유지.
// PolyhedronGeometry는 면당 (detail+1)² 삼각형 → 세그먼트 수를 SCALE 배 해야 크기가 일정.
// (원래 detail 5 = 6세그먼트 = 20×6² = 720 삼각형. 코드 주석의 "20k tris"는 오기였다.)
//
// ★ 중요: 이 값은 지형 노이즈 주파수와 짝을 이뤄야 한다.
// 프롭 배치·보행은 heightAt()이라는 "정확한 수식"을 쓰지만 눈에 보이는 건 이 메시다.
// 메시 정점 간격이 노이즈 파장보다 성기면 지면이 뭉개져서 프롭이 공중에 뜨거나 땅에 박힌다.
// 정점 간격 ≈ 1.0515·R / (detail+1). TERRAIN.octaves와 함께 조정할 것.
const BASE_SEG = 20;
export const PLANET_DETAIL = BASE_SEG * SCALE - 1;

const Y_AXIS = new THREE.Vector3(0, 1, 0);
// lowestAround/seatOnSurface 임시 벡터(프레임당 호출은 없지만 로드 시 수천 번 돈다)
const _lo0 = new THREE.Vector3(), _lo1 = new THREE.Vector3(), _lo2 = new THREE.Vector3();
const _lo3 = new THREE.Vector3(), _lo4 = new THREE.Vector3(), _lo5 = new THREE.Vector3();

// ── 지형 ───────────────────────────────────────────────────────────────────
// 높이는 반지름 방향 변위(월드 단위). up은 여전히 반지름 방향으로 두므로
// 구면 보행 코어(대원 이동·쿼터니언 정렬)는 그대로 쓰고 "반지름만" 달라진다.
export const TERRAIN = {
  seed: 20260730,
  amp: 9.5,          // 최대 기복(월드 단위). 플레이어 키 1.5 기준 언덕이 확실히 읽히는 값.
  // 주파수는 단위 구 기준이라 SCALE을 곱하지 않으면 행성이 커질수록 언덕이 같이 늘어나
  // 비탈이 완만해지고 결과적으로 "더 평평해" 보인다. 언덕의 월드 크기를 일정하게 유지한다.
  //
  // ★ 옥타브를 늘리면 최고 주파수 파장이 메시 정점 간격보다 짧아져 지면이 뭉개진다.
  // 그러면 프롭은 heightAt(정확)에 놓이고 지면은 뭉개진 메시라 공중에 뜬다. BASE_SEG와 짝을 맞출 것.
  freq: 1.9 * SCALE,
  octaves: 4,
  // 능선 노이즈 비율 — 실루엣을 세워주지만 날카로운 crease는 삼각형 메시가 표현하지 못한다.
  // (crease 위 프롭이 뜨는 최대 오차의 원인이었다.) 실루엣과 정확도의 절충값.
  ridgeMix: 0.22,
  // 수심 — 플레이어 키(1.5)보다 얕게. 물에 들어가도 잠기지 않고 첨벙거리는 정도.
  waterDepth: 1.1,
  shoreH: 0.35,      // 물가 둔덕 높이(수면 +0.05보다 확실히 위)
  shoreWobble: 0.30, // 해안선 반경 흔들림 비율 — 만·곶을 만들어 원형 웅덩이 느낌을 없앤다
};
const SHORE_FREQ = 9;   // 해안선 흔들림 주파수(단위 구 기준). 클수록 굴곡이 잘다.

// 구역별 기복 배율 — 마을은 평탄해야 집이 파묻히지 않고, 언덕은 높아야 한다.
const REGION_RELIEF = {
  village: 0.28, temple: 0.55, beach: 0.35, lake: 0.40,
  meadow: 0.70, forest: 1.00, hill: 1.55,
  mist: 0.22,        // 분지 바닥은 평탄해야 도깨비를 쫓을 수 있다
};

// 안개 골짜기 중심 방향(모듈 로드 시 1회)
const MIST_DIR = latLonDir(MIST_ZONE.lat, MIST_ZONE.lon);
const MIST_COS_OUTER = Math.cos(Math.min(Math.PI, MIST_ZONE.outer * 1.25));
const RELIEF_BLEND = 0.30;   // 구역 경계에서 배율이 섞이는 폭(rad)

seedNoise(TERRAIN.seed);

// 구역 앵커(방향 + 기복 배율). Planet 인스턴스 없이 계산 가능해야 heightAt이 자립한다.
const RELIEF_ANCHORS = REGIONS.map(r => ({
  dir: latLonDir(r.lat, r.lon),
  relief: REGION_RELIEF[r.id] ?? 0.8,
}));

const _WATER = waterZones(R);

// 방향 dir에서의 구역 기복 배율(경계는 가장 가까운 두 구역을 블렌딩).
// heightAt은 액터 수백 명 × 매 프레임 호출되므로 acos를 최소화한다:
// 내적은 각도에 단조라 "가장 가까운 둘"은 내적만으로 고르고, acos는 그 둘에만 쓴다.
function reliefAt(dir) {
  let a1 = null, a2 = null, k1 = -Infinity, k2 = -Infinity;
  for (const a of RELIEF_ANCHORS) {
    const k = dir.x * a.dir.x + dir.y * a.dir.y + dir.z * a.dir.z;
    if (k > k1) { a2 = a1; k2 = k1; a1 = a; k1 = k; }
    else if (k > k2) { a2 = a; k2 = k; }
  }
  if (!a2) return a1 ? a1.relief : 0.8;
  const d1 = Math.acos(Math.max(-1, Math.min(1, k1)));
  const d2 = Math.acos(Math.max(-1, Math.min(1, k2)));
  const diff = d2 - d1;
  if (diff >= RELIEF_BLEND) return a1.relief;
  const t = 0.5 * (1 - diff / RELIEF_BLEND);
  return a1.relief + (a2.relief - a1.relief) * t;
}

export class Planet {
  constructor(scene) {
    this.R = R;
    this.SCALE = SCALE;
    this.waterZones = _WATER;
    const geo = new THREE.IcosahedronGeometry(R, PLANET_DETAIL); // 20×(detail+1)² 삼각형
    this.displace(geo);
    this.mesh = new THREE.Mesh(geo, toon(0x86b56a));
    this.mesh.receiveShadow = true;
    noOut(this.mesh);             // 행성 본체는 아웃라인 제외(둘레가 굵게 칠해지는 것 방지)
    scene.add(this.mesh);
  }

  // 방향 dir(단위벡터)에서의 지형 높이(기준 R 대비 월드 단위). 물 영역은 음수(해저).
  heightAt(dir) {
    const x = dir.x * TERRAIN.freq, y = dir.y * TERRAIN.freq, z = dir.z * TERRAIN.freq;
    const base = fbm(x, y, z, TERRAIN.octaves);                 // [-1,1]
    const ridge = ridged(x * 0.75, y * 0.75, z * 0.75, 3) * 2 - 1;   // [-1,1]
    const n = base * (1 - TERRAIN.ridgeMix) + ridge * TERRAIN.ridgeMix;
    let h = n * TERRAIN.amp * reliefAt(dir);

    // 물가 성형 — 바닥 → 모래톱 → 물가 둔덕 → 자연 지형 순으로 이어 붙인다.
    // u = 물 중심에서의 각거리 / 물 반경. 물 메시는 u<1, 모래톱은 u<1.16.
    //
    // 단순히 "물속만 파고 바로 자연 지형으로 복귀"시키면 물 경계 바깥에도 지형이
    // 한동안 수면 아래 머물러서 물도 모래도 없는 마른 도랑이 물을 빙 두른다.
    // 그래서 모래톱이 끝나는 지점(1.16)을 막 지나서 수면 위로 올라오도록 맞춘다.
    for (const w of this.waterZones) {
      const k = dir.x * w.center.x + dir.y * w.center.y + dir.z * w.center.z;
      if (k < w.cosOuter) continue;                              // 영향권 밖
      // 해안선 흔들기 — 물 반경을 방향에 따라 ±20% 흔들면 만·곶이 생겨
      // 완벽한 원(수영장 테두리)에서 벗어난다. 물 메시는 이보다 크게 깔려 있다.
      const wob = 1 + TERRAIN.shoreWobble *
        fbm(dir.x * SHORE_FREQ, dir.y * SHORE_FREQ, dir.z * SHORE_FREQ, 2);
      const u = Math.acos(Math.max(-1, Math.min(1, k))) / (w.ang * wob);
      const bed = -TERRAIN.waterDepth;
      // 바닥에서 물가 둔덕까지: 1.16 직전까지는 수면 아래라 모래톱이 보인다.
      const shoreH = bed + (TERRAIN.shoreH - bed) * smoothstep(0.80, 1.30, u);
      const back = smoothstep(1.35, 2.20, u);                    // 자연 지형으로 복귀
      h = shoreH * (1 - back) + h * back;
    }

    // 안개 골짜기 — 절벽 능선으로 둘러싸인 분지.
    // 물 성형과 같은 방식이지만 방향이 반대다: 가장자리를 높이 세우고 안쪽을 판다.
    // 능선 경사가 플레이어 한계(32°)를 넘어야 "벽 오르기 없이는 못 들어감"이 성립한다.
    {
      const k = dir.x * MIST_DIR.x + dir.y * MIST_DIR.y + dir.z * MIST_DIR.z;
      if (k >= MIST_COS_OUTER) {
        const a = Math.acos(Math.max(-1, Math.min(1, k)));
        const Z = MIST_ZONE;
        let mh;
        if (a <= Z.inner) {
          mh = -Z.depth;                                          // 바닥(평탄)
        } else if (a <= Z.rim) {
          mh = -Z.depth + (Z.wallH + Z.depth) * smoothstep(Z.inner, Z.rim, a);   // 안쪽 절벽
        } else {
          mh = Z.wallH * (1 - smoothstep(Z.rim, Z.outer, a));     // 바깥 사면
        }
        // 바깥 경계에서 자연 지형으로 섞는다
        const blend = smoothstep(Z.outer * 0.88, Z.outer * 1.22, a);
        h = mh * (1 - blend) + h * blend;
      }
    }
    return h;
  }

  // 이 방향이 안개 골짜기 안(분지 바닥)인가.
  inMistValley(dir) {
    const k = dir.x * MIST_DIR.x + dir.y * MIST_DIR.y + dir.z * MIST_DIR.z;
    return k >= Math.cos(MIST_ZONE.rim * 0.92);
  }
  get mistDir() { return MIST_DIR; }

  // 방향 dir에서의 지형 표면점(길이 = R + heightAt).
  surfaceAt(dir, out = new THREE.Vector3()) {
    out.copy(dir).normalize();
    return out.multiplyScalar(this.R + this.heightAt(out));
  }

  // 발자국 반경 안에서 가장 낮은 지형 높이.
  //
  // 프롭은 중심점의 높이에 "수평으로" 놓이는데 땅은 기울어 있다. 그래서 중심 높이에 놓으면
  // 내리막 쪽 모서리가 공중에 뜬다(건물이 클수록 심하다). 최저점에 놓으면 대신 오르막 쪽이
  // 살짝 묻히는데, 언덕에 파고든 집은 자연스럽지만 떠 있는 집은 명백히 고장으로 보인다.
  lowestAround(dir, radius, samples = 8) {
    let lo = this.heightAt(dir);
    if (radius <= 0.01) return lo;
    const up = _lo0.copy(dir).normalize();
    const ref = Math.abs(up.dot(Y_AXIS)) > 0.99 ? _lo1.set(1, 0, 0) : _lo1.set(0, 1, 0);
    const east = _lo2.crossVectors(ref, up).normalize();
    const north = _lo3.crossVectors(up, east).normalize();
    const ang = radius / this.R;
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      _lo4.copy(up)
        .addScaledVector(east, Math.cos(t) * ang)
        .addScaledVector(north, Math.sin(t) * ang)
        .normalize();
      const h = this.heightAt(_lo4);
      if (h < lo) lo = h;
    }
    return lo;
  }

  // 지형 기울기(라디안). 접선 두 방향으로 높이를 샘플해 경사도를 구한다.
  // 급경사에는 길도 건물도 놓지 않는다 — 현실에서도 절벽에 집을 짓지 않고,
  // 무엇보다 수평으로 놓이는 프롭이 비탈에서 뜨거나 파묻혀 고장처럼 보인다.
  slopeAt(dir, sampleDist = 2.5) {
    const up = _lo0.copy(dir).normalize();
    const ref = Math.abs(up.dot(Y_AXIS)) > 0.99 ? _lo1.set(1, 0, 0) : _lo1.set(0, 1, 0);
    const east = _lo2.crossVectors(ref, up).normalize();
    const north = _lo3.crossVectors(up, east).normalize();
    const a = sampleDist / this.R;
    const h = (e, n) => this.heightAt(
      _lo4.copy(up).addScaledVector(east, e * a).addScaledVector(north, n * a).normalize());
    const dE = (h(1, 0) - h(-1, 0)) / (2 * sampleDist);
    const dN = (h(0, 1) - h(0, -1)) / (2 * sampleDist);
    return Math.atan(Math.hypot(dE, dN));
  }

  slopeDegAt(dir, sampleDist) { return this.slopeAt(dir, sampleDist) * 180 / Math.PI; }

  // 프롭을 발자국 기준으로 접지시킨 표면점(비탈에서 뜨지 않음).
  seatOnSurface(pos, footprintRadius) {
    const d = _lo5.copy(pos).normalize();
    const h = this.lowestAround(d, footprintRadius);
    return pos.copy(d).multiplyScalar(this.R + h);
  }

  // 임의의 점을 지형 표면으로 투영(방향 유지, 길이만 보정).
  projectToSurface(pos) {
    const len = pos.length();
    if (len < 1e-9) return pos;
    pos.multiplyScalar(1 / len);
    return pos.multiplyScalar(this.R + this.heightAt(pos));
  }

  // 지오메트리 정점을 높이장만큼 반경 방향으로 변위 + 법선 재계산.
  displace(geo) {
    const pos = geo.attributes.position;
    const d = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const r = this.R + this.heightAt(d);
      pos.setXYZ(i, d.x * r, d.y * r, d.z * r);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  // 표면 법선(= 중력 반대 방향). 지형이 있어도 up은 반지름 방향을 유지한다.
  normalAt(pos) { return pos.clone().normalize(); }

  // 바이옴 채색 — 각 정점을 가장 가까운 구역 색으로(경계는 2위 구역과 블렌딩). vertexColors 사용.
  applyBiomeColors(anchors) {
    const geo = this.mesh.geometry;
    const pos = geo.attributes.position;
    const n = pos.count;
    const colors = new Float32Array(n * 3);
    const v = new THREE.Vector3(), c = new THREE.Color();
    const BAND = 0.16;   // 경계 블렌딩 폭(rad)
    // 고도 채색 — 물가는 모래, 능선은 바랜 바위색. 지형이 색으로도 읽히게 한다.
    const SAND = new THREE.Color(0xe0cf9e), ROCK = new THREE.Color(0xb9b6ad);
    const peak = TERRAIN.amp * 0.62;
    for (let i = 0; i < n; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const h = v.length() - this.R;          // 변위된 정점이므로 길이에서 고도가 나온다
      v.normalize();
      let a1 = anchors[0], a2 = anchors[0], d1 = Infinity, d2 = Infinity;
      for (const a of anchors) {
        const d = v.angleTo(a.dir);
        if (d < d1) { a2 = a1; d2 = d1; a1 = a; d1 = d; }
        else if (d < d2) { a2 = a; d2 = d; }
      }
      c.copy(a1.color);
      const diff = d2 - d1;
      if (diff < BAND) c.lerp(a2.color, 0.5 * (1 - diff / BAND));   // 경계 부드럽게
      // 모래는 "물가에서만". 고도만으로 칠하면 평균 고도가 낮은 행성 대부분이 사막이 된다.
      let sandT = 0;
      for (const w of this.waterZones) {
        const k = v.x * w.center.x + v.y * w.center.y + v.z * w.center.z;
        if (k < w.cosOuter) continue;
        const u = Math.acos(Math.max(-1, Math.min(1, k))) / w.ang;
        const s = 1 - smoothstep(1.05, 1.65, u);          // 물가 밖으로 갈수록 사라짐
        if (s > sandT) sandT = s;
      }
      if (sandT > 0) c.lerp(SAND, sandT * 0.9);
      // 바위는 실제로 높은 능선에서만(관측 최고 고도 ~6u 기준)
      const rockT = smoothstep(peak, peak * 1.6, h);
      if (rockT > 0) c.lerp(ROCK, rockT * 0.65);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.mesh.material.vertexColors = true;
    this.mesh.material.color.set(0xffffff);   // 흰색 베이스 → 정점색이 그대로
    this.mesh.material.needsUpdate = true;
  }

  // 위도/경도(도) → 반지름 r 표면점.
  latLonToPos(latDeg, lonDeg, r = this.R) {
    const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180;
    return new THREE.Vector3(
      r * Math.cos(lat) * Math.cos(lon),
      r * Math.sin(lat),
      r * Math.cos(lat) * Math.sin(lon)
    );
  }

  // 표면점 + heading(도, up 기준 회전)으로 프롭 배치용 {position, quaternion} 산출.
  // up과 평행하지 않은 기준벡터로 접선 forward를 만든 뒤 headingDeg만큼 회전.
  frameAt(pos, headingDeg = 0, outQuat = new THREE.Quaternion()) {
    const up = pos.clone().normalize();
    const ref = Math.abs(up.dot(Y_AXIS)) > 0.99 ? new THREE.Vector3(1, 0, 0) : Y_AXIS;
    const forward = ref.clone();
    orthonormalizeHeading(forward, up);
    forward.applyAxisAngle(up, headingDeg * Math.PI / 180);
    orientationFromFrame(up, forward, outQuat);
    return { position: pos.clone(), quaternion: outQuat };
  }
}
