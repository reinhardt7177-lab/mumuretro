// 지면 디테일 — 풀포기·꽃. 레퍼런스와 우리 화면의 큰 차이 중 하나가 "빈 땅"이었다.
//
// 프롭으로 깔면 수천 개 드로우콜이 되므로 InstancedMesh 두 개(풀/꽃)로 처리한다.
// 행성 전체를 덮으므로 프러스텀 컬링이 통째로만 걸리지만, 삼각형이 매우 작아 부담이 없다.
import * as THREE from 'three';
import { toon } from '../rendering/Toon.js';
import { makeRNG } from '../util/math.js';
import { regionAt } from '../data/regions.js';

const MAX_SLOPE = 26;          // 프롭과 같은 기준. 절벽엔 풀도 안 난다.
const _Y = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(1, 0, 0);

// 구역별 지면 커버 성격. 밀도 0이면 아예 안 깐다.
const COVER = {
  village: { grass: 0.55, flower: 0.25, scale: 0.85 },
  temple:  { grass: 0.60, flower: 0.15, scale: 0.9 },
  beach:   { grass: 0.18, flower: 0.05, scale: 0.7 },   // 모래라 성기게
  lake:    { grass: 0.95, flower: 0.55, scale: 1.05 },
  meadow:  { grass: 1.00, flower: 0.85, scale: 1.1 },   // 꽃밭
  forest:  { grass: 0.85, flower: 0.25, scale: 1.0 },
  hill:    { grass: 0.50, flower: 0.40, scale: 0.9 },
  mist:    { grass: 0.30, flower: 0.06, scale: 0.8 },   // 스산하게
};

const FLOWER_COLORS = [0xf2c14e, 0xe8737d, 0xf0f0f0, 0xc98bdc, 0xf59b42];

// ── 풀잎 다발 ──────────────────────────────────────────────────────────────
// 원뿔 하나로는 아무리 비율을 맞춰도 '고깔'로 보인다(실측: 아이 눈에 교통 콘처럼 보였다).
// 부드러운 풀은 **끝으로 갈수록 가늘어지며 휘는 얇은 잎** 여러 장이 만든다.
// 잎 한 장 = 3단 띠(테이퍼 + 앞으로 휨), 그걸 방향을 달리해 세 장 세운 게 한 포기.
//
// 법선은 면의 실제 법선이 아니라 위쪽으로 기울여 준다. 얇은 판의 진짜 법선을 쓰면
// 각도에 따라 어떤 잎은 새까맣고 어떤 잎은 하얗게 튀어서 잔디밭이 얼룩덜룩해진다.
// 위쪽으로 몰아 주면 전부 부드럽게 같은 빛을 받는다(스타일라이즈드 식생의 상투 수단).
const BLADE_SEGS = 3;

function pushBlade(pos, nor, idx, yaw, lean, height, halfW, bend) {
  const base = pos.length / 3;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  for (let i = 0; i <= BLADE_SEGS; i++) {
    const t = i / BLADE_SEGS;
    const y = height * t;
    // 끝으로 갈수록 가늘어진다. 지수를 1보다 작게 둬야 밑동이 통통하고 끝만 뾰족하다.
    const hw = halfW * Math.pow(1 - t, 0.65);
    // 휨 — t²이라 밑동은 곧고 끝만 눕는다. 이게 '부드러움'의 대부분을 만든다.
    const off = bend * t * t + lean * t;
    for (const sgn of [-1, 1]) {
      // 잎의 폭 방향은 yaw에 수직, 휨은 yaw 방향으로
      const lx = sgn * hw, lz = 0;
      const bx = off;
      pos.push((lx + bx) * cy - lz * sy, y, (lx + bx) * sy + lz * cy);
      // 위로 몰아 준 법선(위 0.8 + 잎이 눕는 쪽 0.2)
      const nx = 0.2 * cy, nz = 0.2 * sy;
      nor.push(nx, 0.96, nz);
    }
  }
  for (let i = 0; i < BLADE_SEGS; i++) {
    const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
}

function makeGrassTuft() {
  const pos = [], nor = [], idx = [];
  // 세 장이면 어느 각도에서 봐도 최소 한 장은 넓은 면을 보여 준다. 네 장부터는
  // 삼각형만 늘고 눈에 띄는 차이가 없다(포기당 15 → 20삼각형).
  const blades = [
    { yaw: 0.0, lean: 0.02, h: 0.50, w: 0.055, bend: 0.14 },
    { yaw: 2.1, lean: -0.01, h: 0.42, w: 0.050, bend: 0.17 },
    { yaw: 4.2, lean: 0.03, h: 0.34, w: 0.045, bend: 0.11 },
  ];
  for (const b of blades) pushBlade(pos, nor, idx, b.yaw, b.lean, b.h, b.w, b.bend);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

export function buildGroundCover(scene, planet, anchors, opts = {}) {
  const count = opts.count ?? 9000;   // 표본 수(밀도 컷을 통과한 것만 실제로 심긴다)
  const rng = makeRNG(opts.seed ?? 31);
  const R = planet.R;

  const grassGeo = makeGrassTuft();
  // 꽃 — 줄기 없이 작은 판. 멀리서 색점으로 읽히면 충분하다.
  const flowerGeo = new THREE.ConeGeometry(0.11, 0.30, 5);
  flowerGeo.translate(0, 0.24, 0);

  // ★ vertexColors를 켜면 안 된다. InstancedMesh의 setColorAt은 instanceColor를 쓰는데,
  // vertexColors=true면 셰이더가 geometry의 color 속성을 찾고, 그게 없어서 전부 검게 그려진다
  // (실측: 뾰족한 검은 가시로 보였다). 인스턴스 색은 setColorAt만으로 적용된다.
  const grassMat = toon(0xffffff);
  grassMat.side = THREE.DoubleSide;      // 얇은 잎이라 뒷면이 사라지면 구멍이 뚫린 것처럼 보인다
  const flowerMat = toon(0xffffff);
  grassMat.userData.outlineParameters = { visible: false };   // 풀에 외곽선은 지저분하다
  flowerMat.userData.outlineParameters = { visible: false };

  const gList = [], fList = [];
  const dir = new THREE.Vector3(), up = new THREE.Vector3();
  const east = new THREE.Vector3(), north = new THREE.Vector3();
  const q = new THREE.Quaternion(), m = new THREE.Matrix4();
  const pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const col = new THREE.Color();

  const inWater = (d) => {
    for (const w of planet.waterZones) if (d.angleTo(w.center) < w.ang * 1.05) return true;
    return false;
  };

  for (let i = 0; i < count; i++) {
    const z = rng() * 2 - 1, th = rng() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    dir.set(r * Math.cos(th), z, r * Math.sin(th));
    if (inWater(dir)) continue;
    if (planet.slopeDegAt(dir) > MAX_SLOPE) continue;

    const region = regionAt(dir, anchors);
    const cfg = COVER[region.id] || COVER.village;
    const roll = rng();
    const isFlower = roll < cfg.flower * 0.35;
    if (!isFlower && roll > cfg.grass) continue;              // 밀도 컷

    up.copy(dir).normalize();
    pos.copy(up).multiplyScalar(R + planet.heightAt(up));
    const ref = Math.abs(up.dot(_Y)) > 0.99 ? _X : _Y;
    east.crossVectors(ref, up).normalize();
    north.crossVectors(up, east).normalize();
    // +Y를 up으로 정렬 + 랜덤 yaw
    q.setFromUnitVectors(_Y, up);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(_Y, rng() * Math.PI * 2));
    // 포기가 크면 성겨 보인다 — 하나하나가 도드라져 '잔디밭'이 아니라 '풀 몇 포기'가 된다.
    const s = cfg.scale * (0.55 + rng() * 0.5);
    scl.set(s, s * (0.8 + rng() * 0.6), s);
    m.compose(pos, q, scl);

    if (isFlower) {
      col.set(FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)]);
      fList.push({ m: m.clone(), c: col.clone() });
    } else {
      // 구역 지면색보다 조금 어둡게. 밝게 흔들면 지면과 대비가 사라져
      // 창백한 삼각형이 떠 있는 것처럼 보이고(실측: 0.78~1.28 범위),
      // 너무 어둡게 하면 얇은 잎이 검게 뭉친다.
      col.copy(region.color).multiplyScalar(0.72 + rng() * 0.30);
      gList.push({ m: m.clone(), c: col.clone() });
    }
  }

  const make = (geo, mat, list) => {
    if (!list.length) return null;
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    inst.castShadow = false;      // 풀 그림자는 비용만 크고 눈에 안 띈다
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    list.forEach((it, i) => { inst.setMatrixAt(i, it.m); inst.setColorAt(i, it.c); });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);
    return inst;
  };

  const grass = make(grassGeo, grassMat, gList);
  const flowers = make(flowerGeo, flowerMat, fList);
  console.log(`[cover] 풀 ${gList.length} · 꽃 ${fList.length} (인스턴싱 ${grass && flowers ? 2 : 1} 드로우콜)`);
  return { grass, flowers, grassCount: gList.length, flowerCount: fList.length };
}
