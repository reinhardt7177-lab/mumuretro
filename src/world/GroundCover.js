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

export function buildGroundCover(scene, planet, anchors, opts = {}) {
  const count = opts.count ?? 9000;
  const rng = makeRNG(opts.seed ?? 31);
  const R = planet.R;

  // 풀 — 4면 스파이크. 8삼각형짜리라 만 개를 깔아도 가볍다.
  const grassGeo = new THREE.ConeGeometry(0.13, 0.62, 4);
  grassGeo.translate(0, 0.31, 0);
  // 꽃 — 줄기 없이 작은 판. 멀리서 색점으로 읽히면 충분하다.
  const flowerGeo = new THREE.ConeGeometry(0.11, 0.3, 5);
  flowerGeo.translate(0, 0.34, 0);

  const grassMat = toon(0xffffff, { vertexColors: true });
  const flowerMat = toon(0xffffff, { vertexColors: true });
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
    const s = cfg.scale * (0.7 + rng() * 0.7);
    scl.set(s, s * (0.8 + rng() * 0.6), s);
    m.compose(pos, q, scl);

    if (isFlower) {
      col.set(FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)]);
      fList.push({ m: m.clone(), c: col.clone() });
    } else {
      // 구역 지면색을 기준으로 밝기만 흔들어 자연스럽게
      col.copy(region.color).multiplyScalar(0.78 + rng() * 0.5);
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
