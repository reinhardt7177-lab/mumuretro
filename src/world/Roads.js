// 구역을 잇는 흙길 네트워크.
// 랜드마크가 멀리서 보여도 "어디로 걸어야 하는지" 단서가 없으면 넓은 행성은 막막하다.
// 길은 지형을 깎지 않고 표면에 밀착하는 리본으로 깐다(비탈에서는 자연스럽게 기운다).
import * as THREE from 'three';
import { toon } from '../rendering/Toon.js';

const ROAD = {
  width: 2.6,        // 길 폭(월드 단위)
  // 리본은 샘플 사이가 평면이라 볼록한 지형 위에서 처진다(처짐 ≈ segLen²·곡률/8).
  // segLen을 줄이면 처짐이 제곱으로 줄어든다 — 띄우는 높이를 키우는 것보다 훨씬 낫다.
  lift: 0.22,        // 지형 위로 띄우는 높이
  segLen: 1.2,       // 길이 방향 샘플 간격(월드)
  crossSeg: 4,       // ★ 폭 방향 분할 수. 1이면 리본이 평평한 사각형이라 휜 지형이 뚫고 올라온다.
  color: 0xb59a6e,   // 마른 흙길
  // 급경사에는 길을 깔지 않는다. 리본이 절벽을 그대로 타고 올라가면 지형을 뚫고 나오고,
  // 무엇보다 "여기로 걸어가라"는 신호가 거짓이 된다. 끊긴 길은 산기슭에서 멈춘 것으로 읽힌다.
  maxSlopeDeg: 24,
};

// 단위벡터 구면 선형보간.
const _sa = new THREE.Vector3(), _sb = new THREE.Vector3();
function slerpDir(a, b, t, out) {
  const dot = Math.max(-1, Math.min(1, a.dot(b)));
  const om = Math.acos(dot);
  if (om < 1e-6) return out.copy(a);
  const so = Math.sin(om);
  _sa.copy(a).multiplyScalar(Math.sin((1 - t) * om) / so);
  _sb.copy(b).multiplyScalar(Math.sin(t * om) / so);
  return out.copy(_sa).add(_sb).normalize();
}

// 앵커 방향들에 대한 최소 신장 트리(Prim) + 가장 짧은 여분 간선 몇 개.
// MST만 쓰면 길이 나무 모양이라 막다른 길이 생긴다. 여분 간선이 순환로를 만들어 준다.
function buildEdges(dirs, extra = 2) {
  const n = dirs.length;
  const cost = (i, j) => dirs[i].angleTo(dirs[j]);
  const inTree = new Array(n).fill(false);
  const edges = [];
  inTree[0] = true;
  for (let k = 1; k < n; k++) {
    let bi = -1, bj = -1, bc = Infinity;
    for (let i = 0; i < n; i++) {
      if (!inTree[i]) continue;
      for (let j = 0; j < n; j++) {
        if (inTree[j]) continue;
        const c = cost(i, j);
        if (c < bc) { bc = c; bi = i; bj = j; }
      }
    }
    if (bj < 0) break;
    inTree[bj] = true;
    edges.push([bi, bj]);
  }
  // 여분 간선 — MST에 없는 쌍 중 가장 짧은 것부터
  const used = new Set(edges.map(([a, b]) => a < b ? a + ',' + b : b + ',' + a));
  const rest = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const key = i + ',' + j;
      if (!used.has(key)) rest.push([i, j, cost(i, j)]);
    }
  }
  rest.sort((a, b) => a[2] - b[2]);
  for (let i = 0; i < Math.min(extra, rest.length); i++) edges.push([rest[i][0], rest[i][1]]);
  return edges;
}

const _d = new THREE.Vector3(), _dn = new THREE.Vector3(), _t = new THREE.Vector3(), _perp = new THREE.Vector3();
const _l = new THREE.Vector3(), _r = new THREE.Vector3();

export function buildRoads(scene, planet, anchors) {
  const R = planet.R;
  const dirs = anchors.map(a => a.dir.clone().normalize());
  const edges = buildEdges(dirs);

  const verts = [], idx = [];
  const centerline = [];        // 길 중심선 샘플(단위 방향) — 프롭 배치 회피에 쓴다
  const halfAng = (ROAD.width * 0.5) / R;

  const inWater = (dir) => {
    for (const w of planet.waterZones) if (dir.angleTo(w.center) < w.ang * 1.05) return true;
    return false;
  };

  for (const [ia, ib] of edges) {
    const a = dirs[ia], b = dirs[ib];
    const arc = a.angleTo(b);
    const steps = Math.max(6, Math.ceil(arc * R / ROAD.segLen));

    let prevBase = -1;          // 이전 샘플의 좌/우 정점 인덱스(없으면 -1 → 이어붙이지 않음)
    for (let s = 0; s <= steps; s++) {
      slerpDir(a, b, s / steps, _d);
      // 진행 방향(접선) — 다음 샘플과의 차이로 구하고 마지막은 이전 방향 재사용
      slerpDir(a, b, Math.min(1, (s + 0.5) / steps), _dn);
      _t.copy(_dn).addScaledVector(_d, -_dn.dot(_d));
      if (_t.lengthSq() < 1e-12) { prevBase = -1; continue; }
      _t.normalize();
      _perp.crossVectors(_d, _t).normalize();      // 길 폭 방향

      // 물 위·급경사에는 깔지 않는다(나루터·산기슭처럼 끊김)
      if (inWater(_d) || planet.slopeDegAt(_d) > ROAD.maxSlopeDeg) { prevBase = -1; continue; }

      centerline.push(_d.clone());

      // 폭 방향으로도 나눠서 각 정점을 지형에 붙인다 → 리본이 지형 곡률을 따라 휜다.
      const CS = ROAD.crossSeg;
      const base = verts.length / 3;
      for (let k = 0; k <= CS; k++) {
        const off = (k / CS) * 2 - 1;                    // -1(좌) → +1(우)
        _l.copy(_d).addScaledVector(_perp, halfAng * off).normalize();
        planet.projectToSurface(_l);
        _l.multiplyScalar(1 + ROAD.lift / _l.length());
        verts.push(_l.x, _l.y, _l.z);
      }
      if (prevBase >= 0) {
        for (let k = 0; k < CS; k++) {
          const p0 = prevBase + k, p1 = prevBase + k + 1, c0 = base + k, c1 = base + k + 1;
          idx.push(p0, p1, c0);
          idx.push(c0, p1, c1);
        }
      }
      prevBase = base;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  // polygonOffset — 지형과 거의 같은 면이라 깊이 경합이 난다. 길이 항상 이기도록 깊이를 당긴다.
  const mat = toon(ROAD.color, {
    side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  });
  mat.userData.outlineParameters = { visible: false };   // 얇은 리본에 아웃라인은 지저분해진다
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // 프롭 배치 회피용 — 이 방향이 길 위(또는 갓길)인가?
  // 프롭 후보마다 중심선 전체를 훑으므로(수천 × 수백) acos·할당 없이 내적만으로 판정한다.
  const clearAng = (ROAD.width * 0.5 + 1.4) / R;
  const cosClear = Math.cos(clearAng);
  const _q = new THREE.Vector3();
  const onRoad = (posOrDir) => {
    _q.copy(posOrDir).normalize();
    for (const c of centerline) {
      if (_q.x * c.x + _q.y * c.y + _q.z * c.z > cosClear) return true;
    }
    return false;
  };

  console.log(`[roads] 간선 ${edges.length} · 중심선 샘플 ${centerline.length} · 삼각형 ${idx.length / 3}`);
  return { mesh, centerline, onRoad, edges };
}
