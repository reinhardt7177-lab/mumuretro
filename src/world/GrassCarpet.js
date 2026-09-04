// 잔디 카펫 — 지면을 덮는 **한 장**.
//
// ★ 처음엔 풀을 인스턴스로 수만 개 흩뿌렸다. 틀렸다.
//   잔디는 개수로 세는 물건이 아니다. 하나하나가 보이는 순간 그건 잔디가 아니라
//   지면에 꽂아 놓은 물건이 된다(실사용 지적).
//   잔디는 바닥에 깔린 채 **부들부들 흐물거리는 한 장**이다.
//
// 그래서 지형 메시를 한 벌 더 떠서 바깥으로 살짝 밀어낸다. 이게 카펫이다.
//  · 풀이 자라는 곳만 밀어내고, 아닌 곳은 지형 **안쪽으로** 넣어 사라지게 한다
//  · 밀어내는 양을 노이즈로 흔들어 윤곽이 매끈한 돔이 되지 않게 한다
//  · 정점 셰이더에서 파도를 흘려 보낸다 — 흐물거림의 정체가 이것이다
//
// 삼각형은 지형과 같은 27,380개. 알파도, 인스턴스도, 드로우콜 폭증도 없다.
import * as THREE from 'three';
import { fbm } from '../util/noise.js';

// 카펫이 지면 위로 솟는 높이(월드).
// ★ 0.34로 잡았다가 0.15로 내렸다. 플레이어는 **지형** 위를 걷는데 눈에 보이는 지면은
//   카펫이라, 카펫 두께가 곧 발이 잠기는 깊이가 된다(실사용 확인 — 발목까지 묻혔다).
//   아래 liftAt으로 플레이어를 카펫 위에 올려 세우지만, 두께 자체도 얇아야
//   지형 충돌(발밑)과 보이는 지면의 어긋남이 눈에 안 띈다.
const LIFT = 0.15;
const LIFT_JITTER = 0.07;     // 두께 변주 — 이게 없으면 지형을 그대로 확대한 돔이 된다
const SINK = -1.2;            // 풀이 없는 곳은 지형 안으로 넣어 완전히 감춘다

// 흐물거림. 파장이 짧으면 지글거리고, 길면 지면 전체가 출렁여 멀미가 난다.
const RIPPLE = { amp: 0.09, freq: 0.55, speed: 1.15 };

const PALETTE = [0x76994e, 0x84a659, 0x6d9048, 0x8fb063];

export function buildGrassCarpet(scene, planet, opts = {}) {
  const R = planet.R;
  const grassAt = opts.grassAt || (() => 1);      // dir → 0..1 (풀이 얼마나 자라는가)
  const uTime = { value: 0 };

  // 이 방향의 카펫 두께. 메시를 만들 때 쓴 식과 **반드시 같아야** 한다 —
  // 다르면 플레이어가 잔디 위에 뜨거나 다시 잠긴다.
  const liftAt = (dir) => {
    const g = grassAt(dir);
    if (g <= 0.01) return 0;
    return (LIFT + fbm(dir.x * 14, dir.y * 14, dir.z * 14, 2) * LIFT_JITTER) * g;
  };

  // 지형과 같은 세밀도로 뜬다. 다르면 카펫이 지형을 뚫고 나오거나 파고든다.
  const geo = planet.mesh.geometry.clone();
  const pos = geo.attributes.position;
  const n = pos.count;
  const colors = new Float32Array(n * 3);
  const grassAmt = new Float32Array(n);           // 셰이더가 파도를 걸 세기

  const d = new THREE.Vector3();
  const col = new THREE.Color(), tmp = new THREE.Color();
  const pal = PALETTE.map(c => new THREE.Color(c));

  let covered = 0;
  for (let i = 0; i < n; i++) {
    d.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const len = d.length();
    d.multiplyScalar(1 / len);                    // 단위 방향
    const g = grassAt(d);                          // 0..1
    grassAmt[i] = g;
    if (g > 0.01) covered++;

    // 두께를 노이즈로 흔든다. 주파수를 높게 잡아 지형 실루엣이 아니라 표면 질감이 되게.
    const j = fbm(d.x * 14, d.y * 14, d.z * 14, 2) * LIFT_JITTER;
    const lift = g > 0.01 ? (LIFT + j) * g : SINK;
    const r = len + lift;
    pos.setXYZ(i, d.x * r, d.y * r, d.z * r);

    // 색도 노이즈로. 한 가지 초록이 넓게 이어지면 카펫이 아니라 페인트가 된다.
    const t = fbm(d.x * 6, d.y * 6, d.z * 6, 2) * 0.5 + 0.5;
    const k = Math.min(pal.length - 1, Math.floor(t * pal.length));
    col.copy(pal[k]);
    tmp.copy(col).multiplyScalar(0.92 + ((i * 2654435761) % 1000) / 1000 * 0.16);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aGrass', new THREE.BufferAttribute(grassAmt, 1));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mat.userData.outlineParameters = { visible: false };   // 지면에 외곽선은 그물망이 된다

  // 흐물거림 — 표면 법선 방향으로 흐르는 파도. 풀이 없는 곳(aGrass=0)은 움직이지 않는다.
  // 월드 위치를 위상으로 쓰므로 파도가 지면을 가로질러 흘러간다.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCarpetT = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uCarpetT;\nattribute float aGrass;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float gw = aGrass;
        if (gw > 0.01) {
          vec3 rd = normalize(transformed);
          float ph = transformed.x * ${RIPPLE.freq.toFixed(3)} + transformed.z * ${(RIPPLE.freq * 0.83).toFixed(3)};
          float w = sin(ph + uCarpetT * ${RIPPLE.speed.toFixed(2)})
                  + 0.5 * sin(ph * 2.3 - uCarpetT * ${(RIPPLE.speed * 1.7).toFixed(2)});
          transformed += rd * (w * ${RIPPLE.amp.toFixed(3)} * gw);
        }
      `);
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;      // 카펫이 자기 그림자를 던지면 지면이 얼룩진다
  scene.add(mesh);

  console.log(`[carpet] 잔디 카펫 — 정점 ${n} · 삼각형 ${n / 3} · 덮인 정점 ${covered}`
    + ` (${Math.round(100 * covered / n)}%)`);

  return { mesh, tris: n / 3, coveredPct: covered / n, liftAt, LIFT, update(t) { uTime.value = t; } };
}
