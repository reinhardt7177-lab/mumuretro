// 지면 산포 — 나무 · 바위 · 덤불 · 풀. 아트 바이블 "디테일은 밀도에서 온다".
//
// 이 파일이 화면을 채운다. 조명이 아무리 좋아도 빈 들판은 빈 들판이다.
// 로우폴리 100개가 하이폴리 1개보다 디테일해 보인다 — 그 100개를 만드는 게 여기다.
//
// 두 가지를 v1에서 배운 대로 지킨다.
//  1) 밀도는 **0 아니면 1**이다. 어중간하게 흩뿌리면 풀밭으로도 맨땅으로도 안 읽히고
//     그냥 지면에 뭔가 떨어진 것처럼 보인다.
//  2) 전역 InstancedMesh를 만들지 않는다. v1에서 frustumCulled=false인 풀 하나가
//     행성 반대편까지 매 프레임 정점 셰이더를 통과시켜 100만 삼각형을 그렸다.
//     여기서는 구를 셀로 나눠 셀마다 인스턴스를 만든다 — 등 뒤 셀은 통째로 빠진다.
import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { LIGHT } from '../data/lighting.js';
import { fbm } from '../util/noise.js';

// 구를 나누는 셀 — 위도 4띠 × 경도 6구간 = 24셀.
// 지평선이 28u(각 23.6°)라 보통 두세 셀만 프러스텀에 들어온다.
const LAT_BANDS = 4, LON_SECTORS = 6;

// ── 배치 규칙 ───────────────────────────────────────────────────────────────
// 구역 데이터를 따로 두지 않고 **지형 자신**에서 유도한다. 높이와 경사 두 축이면
// "여기 뭐가 자랄까"가 정해진다. 새 데이터가 늘지 않는 게 이 방식의 값어치다.
//
// ★ 높이·경사만으로 유도했더니 평지가 전부 같은 값이 나와서 **온 행성이 균일한 숲**이 됐다.
// 그건 §1을 정면으로 깬다 — 나무가 시야를 막으면 랜드마크가 안 보이고 삼각형 규칙이 무의미해진다.
// 그래서 축을 하나 더 둔다: **대역 노이즈**. 주파수를 낮게(1.3) 잡아 구획이 약 50u로 나온다.
// 지평선이 28u이므로 "숲 안에 있다" / "초원에 있다"가 명확히 갈린다.
const ZONE_FREQ = 1.3;
export function zoneAt(dir) {
  return fbm(dir.x * ZONE_FREQ, dir.y * ZONE_FREQ, dir.z * ZONE_FREQ, 3) * 0.5 + 0.5;   // 0..1
}

// h 높이(월드)   s 경사(도)   z 대역값(0..1)
export function biomeAt(h, s, z) {
  if (s > 32) return 'bare';            // 절벽 — 아무것도 못 붙는다
  if (h > 7.5) return 'alpine';         // 고지대 — 바위와 마른 덤불만
  if (s > 22) return 'slope';           // 비탈 — 바위와 덤불
  if (z > 0.55) return 'forest';        // 숲 구획
  if (h < -1.2) return 'basin';         // 분지 바닥 — 풀이 무성하다
  return 'meadow';                      // 초원 — 나무 0. 여기서 시야가 열린다
}

// 바이옴별 밀도. 0이면 아예 안 깐다(중간값 금지).
//
// ★ 나무 밀도를 0.10 → 0.020으로 낮췄다. 계산해 보면 0.10은 4u²당 한 그루로,
//   수관 반경 1.5u짜리 나무가 서로 닿는 밀도다(실사용에서 벽이 됐다).
//   숲으로 읽히면서 걸어 다닐 수 있는 간격은 15~20u²당 한 그루다.
const DENSITY = {
// ★ grass는 이제 인스턴스가 아니다. 잔디는 GrassCarpet이 지면 한 장으로 덮는다.
//   여기 남은 grass는 카펫 **위에 얹는 억새 몇 포기**다 — 밀도를 확 낮춰 악센트로만 쓴다.
//   잔디를 개수로 세는 순간 그건 잔디가 아니라 지면에 꽂아 놓은 물건이 된다.
  forest: { grass: 0.030, tree: 0.026, rock: 0.010, bush: 0.070 },
  meadow: { grass: 0.055, tree: 0,     rock: 0.008, bush: 0.030 },   // 나무 없음 — 시야 확보
  basin:  { grass: 0.070, tree: 0.004, rock: 0.006, bush: 0.090 },
  slope:  { grass: 0,     tree: 0.006, rock: 0.130, bush: 0.070 },
  alpine: { grass: 0,     tree: 0,     rock: 0.190, bush: 0.030 },
  bare:   { grass: 0,     tree: 0,     rock: 0,     bush: 0 },
};

const PALETTE = {
  trunk:     0x6b5138,
  canopy:    [0x5f8a45, 0x6d9a4c, 0x537a3d, 0x7aa455],
  canopyDry: [0x8a9450, 0x9aa05c],
  rock:      [0x8a8b90, 0x7a7b82, 0x9a9aa0],
  bush:      [0x5a7f42, 0x66894a, 0x4e7038],
  grass:     [0x7fa055, 0x8caa5e, 0x74964d],
};

// ── 지오메트리 ──────────────────────────────────────────────────────────────
// 전부 한 번만 만들어 모든 셀이 공유한다. 로우폴리라 하나하나가 20~60삼각형이다.

// 나무 — 원기둥 줄기 + 원뿔 3단. 실루엣이 이 게임에서 가장 큰 식생 요소다.
// 3단으로 나누는 이유: 원뿔 하나는 크리스마스 트리로 읽히고, 3단이면 수관이 된다.
// ★ 줄기가 1.5u뿐이라 수관 밑동이 y=0.88이었다. 캐릭터 키가 1.5u이므로
//   **나무 밑을 지나갈 수 없었다** — 숲이 통과 불가능한 벽이 됐다(실사용 확인).
//   줄기를 3.0u로 늘려 수관 밑동을 y=2.2로 올린다. 머리 위로 지나간다.
// 비율도 같이 잡는다: 전체 높이 1.9~3.8u(캐릭터의 1.3~2.5배)는 관목이지 나무가 아니다.
//   실제 나무는 사람의 10배, 스타일라이즈드 게임도 보통 3~5배다.
function treeGeo(seed) {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 3.0, 5);
  trunk.translate(0, 1.5, 0);
  parts.push({ geo: trunk, kind: 'trunk' });
  const tiers = seed % 2
    ? [{ r: 1.30, h: 1.80, y: 3.10 }, { r: 1.00, h: 1.50, y: 4.20 }, { r: 0.62, h: 1.20, y: 5.10 }]
    : [{ r: 1.45, h: 1.60, y: 2.90 }, { r: 1.08, h: 1.40, y: 3.90 }, { r: 0.60, h: 1.10, y: 4.80 }];
  for (const t of tiers) {
    const g = new THREE.ConeGeometry(t.r, t.h, 6);
    g.translate(0, t.y, 0);
    parts.push({ geo: g, kind: 'canopy' });
  }
  return parts;
}

// 바위 — 이코사헤드론을 찌그러뜨린다. 구는 바위로 안 보이고, 상자는 벽돌로 보인다.
//
// ★ IcosahedronGeometry는 **인덱스 없는** 지오메트리라 면마다 정점이 따로 있다.
//   여기에 정점마다 독립적인 난수로 변위를 주면 같은 자리에 있던 정점들이 서로 다른 곳으로
//   흩어져 **면이 갈라진다** — 바위가 판자 파편이 됐던 원인이다(실사용 확인).
//   그래서 난수를 위치에서 해시해 뽑는다. 같은 자리의 정점은 반드시 같은 값을 받는다.
function rockGeo(seed) {
  const g = new THREE.IcosahedronGeometry(0.55, 0);
  const p = g.attributes.position;
  // 위치 해시 — 좌표를 정수로 양자화해 섞는다. 좌표가 같으면 결과가 같다.
  const hash = (x, y, z) => {
    const q = (v) => Math.round(v * 1000);
    let h = (q(x) * 73856093) ^ (q(y) * 19349663) ^ (q(z) * 83492791) ^ (seed * 2654435761);
    h = (h ^ (h >>> 13)) >>> 0;
    return (h % 100000) / 100000;
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.60 + hash(x, y, z) * 0.75;
    p.setXYZ(i, x * k * 1.25, y * k * 0.72, z * k * 1.1);
  }
  g.computeVertexNormals();
  g.translate(0, 0.16, 0);
  return g;
}

// 덤불 — 낮은 반구 3개. 나무와 풀 사이의 중간 크기를 메운다.
function bushGeo() {
  const parts = [];
  for (const b of [[0, 0, 0, 0.42], [0.26, 0, 0.12, 0.30], [-0.20, 0, -0.14, 0.26]]) {
    const g = new THREE.IcosahedronGeometry(b[3], 0);
    g.scale(1, 0.72, 1);
    g.translate(b[0], b[3] * 0.55, b[2]);
    parts.push(g);
  }
  return mergeGeos(parts);
}

// 풀 다발 — 잎 4장을 벌려 심는다. 한 점에서 세우면 원경에서 점이 된다(v1 실측).
function grassGeo() {
  const pos = [], nor = [], idx = [];
  const blades = [
    { yaw: 0.0, h: 0.58, w: 0.075, bend: 0.20, ox: 0.02, oz: 0.00 },
    { yaw: 2.1, h: 0.46, w: 0.070, bend: 0.24, ox: 0.16, oz: 0.06 },
    { yaw: 4.2, h: 0.38, w: 0.066, bend: 0.16, ox: -0.11, oz: 0.14 },
    { yaw: 1.1, h: 0.50, w: 0.070, bend: 0.22, ox: -0.14, oz: -0.10 },
  ];
  const SEG = 2;
  for (const b of blades) {
    const base = pos.length / 3;
    const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG, y = b.h * t;
      // 끝을 뾰족하게 만들지 않는다 — 폭 0이면 바늘이 되고 수만 개면 가시밭이 된다(v1 실측).
      const hw = b.w * (0.32 + 0.68 * Math.pow(1 - t, 0.55));
      const off = b.bend * t * t;
      for (const sg of [-1, 1]) {
        const lx = sg * hw + off;
        pos.push(b.ox + lx * cy, y, b.oz + lx * sy);
        // 법선을 위로 몰아 준다. 얇은 판의 진짜 법선을 쓰면 잎마다 명암이 튀어 얼룩덜룩해진다.
        nor.push(0.2 * cy, 0.96, 0.2 * sy);
      }
    }
    for (let i = 0; i < SEG; i++) {
      const a = base + i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// 인덱스 없는 지오메트리 여러 개를 하나로. BufferGeometryUtils를 끌어오지 않으려고 직접 한다.
function mergeGeos(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  const idx = [];
  let vo = 0;
  for (const g of list) {
    const p = g.attributes.position, nAttr = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
      nor[(vo + i) * 3] = nAttr.getX(i); nor[(vo + i) * 3 + 1] = nAttr.getY(i); nor[(vo + i) * 3 + 2] = nAttr.getZ(i);
    }
    const gi = g.index;
    if (gi) for (let i = 0; i < gi.count; i++) idx.push(vo + gi.getX(i));
    else for (let i = 0; i < p.count; i++) idx.push(vo + i);
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

// ── 바람 ────────────────────────────────────────────────────────────────────
// 정점 셰이더에서 민다. CPU로 흔들면 매 프레임 수만 개 행렬을 다시 써야 한다.
// <begin_vertex>의 transformed는 인스턴스 로컬이라 y가 곧 높이다 — 밑동 고정이 공짜다.
const WIND = { speed: 1.35, amp: 0.16 };
function injectWind(mat, ampScale, uTime) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader) => {
    if (prev) prev(shader);
    shader.uniforms.uWindT = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindT;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float wph = 0.0;
        #ifdef USE_INSTANCING
          wph = instanceMatrix[3].x * 0.55 + instanceMatrix[3].z * 0.42;
        #endif
        float wk = transformed.y * transformed.y * ${(WIND.amp * ampScale).toFixed(4)};
        transformed.x += sin(uWindT * ${WIND.speed.toFixed(2)} + wph) * wk;
        transformed.z += cos(uWindT * ${(WIND.speed * 0.7).toFixed(2)} + wph * 1.3) * wk * 0.55;
      `);
  };
  mat.needsUpdate = true;
}

export function buildScatter(scene, planet, opts = {}) {
  const R = planet.R;
  const samples = opts.samples ?? 160000;
  let seed = opts.seed ?? 91;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const uTime = { value: 0 };

  // 종류별 지오메트리와 머티리얼
  const treeA = treeGeo(1), treeB = treeGeo(2);
  const geos = {
    trunk:  treeA[0].geo,
    canopyA: mergeGeos(treeA.filter(p => p.kind === 'canopy').map(p => p.geo)),
    canopyB: mergeGeos(treeB.filter(p => p.kind === 'canopy').map(p => p.geo)),
    rockA: rockGeo(3), rockB: rockGeo(11),
    bush: bushGeo(),
    grass: grassGeo(),
  };

  // ★ toonShared를 쓰면 안 된다. 캐시 키가 색+옵션이라 0xffffff를 세 번 부르면
  //   수관·바위·덤불이 **같은 머티리얼 인스턴스**를 받는다. 거기에 종류별로 다른 바람을
  //   injectWind로 세 번 겹쳐 넣어서 바위가 흔들리고 수관 진폭이 배가 됐다(실사용 확인).
  // ★ 베이스 색은 전부 흰색이어야 한다. instanceColor는 머티리얼 색에 **곱해지므로**
  //   갈색 머티리얼 × 갈색 인스턴스색 = 거의 검정이 된다(줄기가 새까맣게 나온 원인).
  const mats = {
    trunk:  toon(0xffffff),
    canopy: toon(0xffffff),
    rock:   toon(0xffffff),
    bush:   toon(0xffffff),
    grass:  toon(0xffffff, { side: THREE.DoubleSide, rim: 0 }),   // 얇은 잎에 림 금지
  };
  mats.grass.userData.outlineParameters = { visible: false };   // 얇은 잎에 외곽선은 지저분하다
  mats.bush.userData.outlineParameters = { visible: false };
  injectWind(mats.grass, 1.0, uTime);
  injectWind(mats.canopy, 0.16, uTime);   // 수관도 흔들려야 한다. 풀만 흔들리면 나무가 말뚝이 된다
  injectWind(mats.bush, 0.35, uTime);

  // 셀별 수집통
  const cellCount = LAT_BANDS * LON_SECTORS;
  const kinds = ['trunk', 'canopyA', 'canopyB', 'rockA', 'rockB', 'bush', 'grass'];
  const bins = [];
  for (let c = 0; c < cellCount; c++) {
    const b = {}; for (const k of kinds) b[k] = [];
    bins.push(b);
  }
  const cellOf = (dir) => {
    const lat = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));            // -π/2..π/2
    const lon = Math.atan2(dir.z, dir.x) + Math.PI;                         // 0..2π
    const bi = Math.min(LAT_BANDS - 1, Math.floor((lat / Math.PI + 0.5) * LAT_BANDS));
    const si = Math.min(LON_SECTORS - 1, Math.floor(lon / (Math.PI * 2) * LON_SECTORS));
    return bi * LON_SECTORS + si;
  };

  const dir = new THREE.Vector3(), up = new THREE.Vector3(), pos = new THREE.Vector3();
  const q = new THREE.Quaternion(), m = new THREE.Matrix4(), scl = new THREE.Vector3();
  const col = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0);
  const counts = { tree: 0, rock: 0, bush: 0, grass: 0 };

  const place = (cell, kind, size, tilt, color) => {
    up.copy(dir);
    pos.copy(up).multiplyScalar(R + planet.heightAt(up));
    q.setFromUnitVectors(Y, up);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, rnd() * Math.PI * 2));
    if (tilt) {
      // 살짝 기울인다. 전부 수직이면 심어 놓은 티가 난다.
      const ax = new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize();
      q.multiply(new THREE.Quaternion().setFromAxisAngle(ax, (rnd() - 0.5) * tilt));
    }
    scl.setScalar(size);
    m.compose(pos, q, scl);
    bins[cell][kind].push({ m: m.clone(), c: color.clone() });
  };

  for (let i = 0; i < samples; i++) {
    const z = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    dir.set(r * Math.cos(th), z, r * Math.sin(th));
    const h = planet.heightAt(dir);
    const s = planet.slopeDegAt(dir);
    const d = DENSITY[biomeAt(h, s, zoneAt(dir))];
    const cell = cellOf(dir);
    const roll = rnd();

    if (roll < d.tree) {
      const b = rnd() < 0.5;
      const sz = 0.80 + rnd() * 0.60;   // 전체 4.6~8.4u = 캐릭터(1.5u)의 3~5.6배
      place(cell, 'trunk', sz, 0.10, col.set(PALETTE.trunk));
      const pal = h > 5.5 ? PALETTE.canopyDry : PALETTE.canopy;
      place(cell, b ? 'canopyA' : 'canopyB', sz, 0.10,
        col.set(pal[Math.floor(rnd() * pal.length)]).multiplyScalar(0.88 + rnd() * 0.24));
      counts.tree++;
    } else if (roll < d.tree + d.rock) {
      place(cell, rnd() < 0.5 ? 'rockA' : 'rockB', 0.5 + rnd() * 1.5, 0.6,
        col.set(PALETTE.rock[Math.floor(rnd() * PALETTE.rock.length)]).multiplyScalar(0.85 + rnd() * 0.3));
      counts.rock++;
    } else if (roll < d.tree + d.rock + d.bush) {
      place(cell, 'bush', 0.6 + rnd() * 0.8, 0.15,
        col.set(PALETTE.bush[Math.floor(rnd() * PALETTE.bush.length)]).multiplyScalar(0.88 + rnd() * 0.24));
      counts.bush++;
    } else if (roll < d.grass) {
      place(cell, 'grass', 0.85 + rnd() * 0.55, 0.10,
        col.set(PALETTE.grass[Math.floor(rnd() * PALETTE.grass.length)]).multiplyScalar(0.85 + rnd() * 0.3));
      counts.grass++;
    }
  }

  // 셀 × 종류마다 InstancedMesh 하나. 등 뒤 셀은 프러스텀에서 통째로 빠진다.
  const meshes = [];
  let tris = 0;
  const geoOf = (k) => geos[k];
  const matOf = (k) => k === 'trunk' ? mats.trunk
    : k.startsWith('canopy') ? mats.canopy
    : k.startsWith('rock') ? mats.rock
    : k === 'bush' ? mats.bush : mats.grass;

  for (let c = 0; c < cellCount; c++) {
    for (const k of kinds) {
      const list = bins[c][k];
      if (!list.length) continue;
      const geo = geoOf(k);
      const inst = new THREE.InstancedMesh(geo, matOf(k), list.length);
      inst.castShadow = k !== 'grass';       // 풀 그림자는 비용만 크고 눈에 안 띈다
      inst.receiveShadow = true;
      list.forEach((it, i) => { inst.setMatrixAt(i, it.m); inst.setColorAt(i, it.c); });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();          // 인스턴스 행렬 반영 — 없으면 컬링이 엉뚱하게 걸린다
      inst.name = `sc_${c}_${k}`;
      scene.add(inst);
      meshes.push(inst);
      tris += list.length * (geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3);
    }
  }

  console.log(`[scatter] 나무 ${counts.tree} · 바위 ${counts.rock} · 덤불 ${counts.bush} · 풀 ${counts.grass}`
    + ` · 메시 ${meshes.length}개 · ~${Math.round(tris / 1000)}k삼각형`);

  // 카펫이 "여기 풀이 자라는가"를 물을 때 쓴다. 바이옴 판정을 그대로 재사용하므로
  // 카펫과 산포물이 절대 어긋나지 않는다 — 규칙이 한 곳에만 있다.
  const grassAt = (dir) => {
    const b = biomeAt(planet.heightAt(dir), planet.slopeDegAt(dir), zoneAt(dir));
    return b === 'meadow' || b === 'basin' ? 1 : (b === 'forest' ? 0.75 : 0);
  };

  return { meshes, counts, tris, biomeAt, zoneAt, grassAt, update(t) { uTime.value = t; } };
}
