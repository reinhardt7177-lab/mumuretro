// 지면 디테일 — 풀포기·꽃.
//
// 두 가지를 크게 고쳤다.
//  1) 밀도: 여덟 구역에 골고루 얇게 깔던 걸 목장·호수·숲에 몰아서 진하게 깐다.
//     골고루는 2u×2u에 한 포기라 잔디밭이 아니라 점묘였고, 원경에서 벌레처럼 보였다.
//  2) 컬링: 행성 전체를 InstancedMesh 하나에 담고 frustumCulled=false로 두었더니
//     밀도를 올리자마자 100만 삼각형이 매 프레임 정점 셰이더를 통과했다.
//     이제 **구역별 메시**라 등 뒤 구역은 프러스텀에서 통째로 빠진다.
//     드로우콜은 2 → 16이지만, 지평선이 28u라 실제로 그려지는 건 보통 두세 구역이다.
//
// 바람은 정점 셰이더에서 준다(CPU 작업 0). 자세한 건 아래 onBeforeCompile.
import * as THREE from 'three';
import { toon } from '../rendering/Toon.js';
import { makeRNG } from '../util/math.js';
import { regionAt } from '../data/regions.js';

const MAX_SLOPE = 26;          // 프롭과 같은 기준. 절벽엔 풀도 안 난다.
const _Y = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(1, 0, 0);

// 구역별 지면 커버 성격. 밀도 0이면 아예 안 깐다.
//
// ★ 예전에는 여덟 구역에 0.18~1.0으로 **골고루** 깔았다. 그게 문제였다.
// 표면이 58,000u²인데 포기가 12,560개면 2u×2u에 하나꼴이다 — 잔디밭이 아니라 점묘고,
// 얇은 잎이 원경에서 1픽셀 미만으로 찍혀 벌레처럼 보인다(실사용에서 그렇게 읽혔다).
// 넓게 얇게 까는 대신 **몇 구역에 몰아서 진하게** 깐다. 나머지는 맨땅이 낫다 —
// 맨땅은 그냥 맨땅으로 보이지만, 성긴 풀은 고장난 것처럼 보인다.
const COVER = {
  village: { grass: 0.30, flower: 0.20, scale: 0.85 },  // 골목 사이 잡초 정도
  temple:  { grass: 0.18, flower: 0.10, scale: 0.9 },   // 비어 있는 게 절 마당이다
  beach:   { grass: 0.03, flower: 0.02, scale: 0.7 },   // 모래엔 거의 안 난다
  lake:    { grass: 1.00, flower: 0.60, scale: 1.15 },  // 물가 — 넘실
  meadow:  { grass: 1.00, flower: 0.90, scale: 1.30 },  // 바람언덕 목장. 여기가 주인공이다
  forest:  { grass: 0.85, flower: 0.20, scale: 1.05 },
  hill:    { grass: 0.06, flower: 0.10, scale: 0.9 },   // 별빛 언덕은 라벤더 맨땅이 주인공
  mist:    { grass: 0.10, flower: 0.03, scale: 0.8 },   // 스산하게
};

// 바람 — 넘실거림. 잎 끝일수록 크게 흔들리고 포기마다 위상이 달라야 '물결'이 된다.
const WIND = { speed: 1.4, amp: 0.5 };

const FLOWER_COLORS = [0xf2c14e, 0xe8737d, 0xf0f0f0, 0xc98bdc, 0xf59b42];

// ── 풀잎 다발 ──────────────────────────────────────────────────────────────
// 원뿔 하나로는 아무리 비율을 맞춰도 '고깔'로 보인다(실측: 아이 눈에 교통 콘처럼 보였다).
// 부드러운 풀은 **끝으로 갈수록 가늘어지며 휘는 얇은 잎** 여러 장이 만든다.
// 잎 한 장 = 3단 띠(테이퍼 + 앞으로 휨), 그걸 방향을 달리해 세 장 세운 게 한 포기.
//
// 법선은 면의 실제 법선이 아니라 위쪽으로 기울여 준다. 얇은 판의 진짜 법선을 쓰면
// 각도에 따라 어떤 잎은 새까맣고 어떤 잎은 하얗게 튀어서 잔디밭이 얼룩덜룩해진다.
// 위쪽으로 몰아 주면 전부 부드럽게 같은 빛을 받는다(스타일라이즈드 식생의 상투 수단).
// 2단이면 휨이 살짝 각지지만, 3단은 포기당 삼각형이 1.5배다.
// 풀은 수만 포기라 이 1.5배가 곧 수십만 삼각형이 된다 — 각진 건 안 보이고 프레임은 보인다.
const BLADE_SEGS = 2;

function pushBlade(pos, nor, idx, yaw, lean, height, halfW, bend, ox = 0, oz = 0) {
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
      pos.push(ox + (lx + bx) * cy - lz * sy, y, oz + (lx + bx) * sy + lz * cy);
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
  // 잎을 한 점에서 세우면 포기가 '뾰족한 심지' 하나로 보이고, 그게 원경에서 점이 된다.
  // 밑동을 0.16u쯤 벌려 심으면 포기 하나가 바닥을 **면으로** 덮어서 잔디로 읽힌다.
  // 잎도 굵혔다(0.055 → 0.075) — 얇은 잎은 멀어지면 1픽셀 미만이라 검은 얼룩이 된다.
  const blades = [
    { yaw: 0.0, lean: 0.02, h: 0.50, w: 0.085, bend: 0.14, ox: 0.02, oz: 0.00 },
    { yaw: 2.1, lean: -0.01, h: 0.42, w: 0.080, bend: 0.17, ox: 0.22, oz: 0.08 },
    { yaw: 4.2, lean: 0.03, h: 0.36, w: 0.075, bend: 0.11, ox: -0.15, oz: 0.19 },
    { yaw: 1.1, lean: -0.02, h: 0.45, w: 0.078, bend: 0.15, ox: -0.19, oz: -0.14 },
  ];
  for (const b of blades) pushBlade(pos, nor, idx, b.yaw, b.lean, b.h, b.w, b.bend, b.ox, b.oz);
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

  // ── 바람 ────────────────────────────────────────────────────────────────
  // 정점 셰이더에서 밀어 준다. CPU로 흔들려면 매 프레임 수만 개 행렬을 다시 써야 한다.
  // <begin_vertex> 시점의 transformed는 **인스턴스 로컬** 좌표라 y가 곧 잎 높이다
  // (instanceMatrix는 그 뒤 <project_vertex>에서 곱해진다). 그래서 밑동 고정이 공짜다.
  const uTime = { value: 0 };
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        // 위상을 포기 위치에서 뽑는다 — 전부 같은 박자로 흔들리면 물결이 아니라 경련이다.
        float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x * 0.6 + instanceMatrix[3].z * 0.45;
        #endif
        // 밑동(y=0)은 0, 끝은 최대. 제곱이라 잎 끝만 눕는다.
        float k = transformed.y * transformed.y * ${WIND.amp.toFixed(3)};
        transformed.x += sin(uTime * ${WIND.speed.toFixed(2)} + ph) * k;
        transformed.z += cos(uTime * ${(WIND.speed * 0.72).toFixed(2)} + ph * 1.3) * k * 0.6;
      `);
  };
  // 꽃도 같은 바람을 받아야 한다 — 풀만 흔들리면 꽃이 말뚝처럼 박혀 보인다.
  flowerMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x * 0.6 + instanceMatrix[3].z * 0.45;
        #endif
        float k = transformed.y * transformed.y * ${(WIND.amp * 0.5).toFixed(3)};
        transformed.x += sin(uTime * ${WIND.speed.toFixed(2)} + ph) * k;
      `);
  };

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
      fList.push({ m: m.clone(), c: col.clone(), r: region.id });
    } else {
      // 구역 지면색보다 조금 어둡게. 밝게 흔들면 지면과 대비가 사라져
      // 창백한 삼각형이 떠 있는 것처럼 보이고(실측: 0.78~1.28 범위),
      // 너무 어둡게 하면 얇은 잎이 검게 뭉친다.
      col.copy(region.color).multiplyScalar(0.72 + rng() * 0.30);
      gList.push({ m: m.clone(), c: col.clone(), r: region.id });
    }
  }

  // ── 구역별로 쪼개서 만든다 ────────────────────────────────────────────────
  // 예전엔 행성 전체를 InstancedMesh 하나에 담고 frustumCulled=false로 두었다.
  // 드로우콜은 1이지만 **매 프레임 전 행성의 풀이 정점 셰이더를 통과한다** —
  // 밀도를 올리자마자 999k 삼각형이 되어 프레임이 무너졌다(실측: 30초 안에 60프레임 실패).
  // 구역별로 나누면 드로우콜이 8~16개로 늘지만, 등 뒤 구역은 프러스텀에서 통째로 빠진다.
  // 지평선이 28u고 구역 하나가 그보다 넓으니, 보통 한두 구역만 남는다.
  const meshes = [];
  const makeByRegion = (geo, mat, list) => {
    const byRegion = new Map();
    for (const it of list) {
      if (!byRegion.has(it.r)) byRegion.set(it.r, []);
      byRegion.get(it.r).push(it);
    }
    for (const [rid, items] of byRegion) {
      const inst = new THREE.InstancedMesh(geo, mat, items.length);
      inst.castShadow = false;      // 풀 그림자는 비용만 크고 눈에 안 띈다
      inst.receiveShadow = true;
      items.forEach((it, i) => { inst.setMatrixAt(i, it.m); inst.setColorAt(i, it.c); });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      // 인스턴스 행렬까지 반영한 경계구 — 이게 있어야 프러스텀 컬링이 맞게 걸린다.
      inst.computeBoundingSphere();
      inst.name = `cover_${rid}`;
      scene.add(inst);
      meshes.push(inst);
    }
  };

  makeByRegion(grassGeo, grassMat, gList);
  makeByRegion(flowerGeo, flowerMat, fList);
  const grass = meshes[0] || null, flowers = meshes[meshes.length - 1] || null;
  const tris = (gList.length * (grassGeo.index.count / 3)) + (fList.length * 5);
  console.log(`[cover] 풀 ${gList.length} · 꽃 ${fList.length} · 삼각형 ~${Math.round(tris / 1000)}k · 구역 메시 ${meshes.length}개`);
  // update(t) — 바람 시간. boot의 step에서 부른다.
  return {
    grass, flowers, meshes, grassCount: gList.length, flowerCount: fList.length, tris,
    update(t) { uTime.value = t; },
  };
}
