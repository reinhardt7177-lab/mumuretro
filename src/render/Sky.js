// 하늘 — 고정 시간대(오후 3시). 아트 바이블 §2 §3.
//
// 하늘의 일은 두 가지뿐이다.
//  1) 지평선 색이 대기색(LIGHT.air)과 **정확히 같을 것.** 다르면 원경 지형이 하늘에 붙지 않고
//     오려붙인 것처럼 뜬다. 대기 원근(§3)이 수렴하는 목적지가 곧 이 색이다.
//  2) 원경 레이어를 만들 것. 산 실루엣 두 겹이 지평선 너머에 깊이를 만든다 —
//     실제로 갈 수 있는 곳이 아니어도 "저 너머가 있다"는 감각이 화면을 넓힌다.
//
// 돔은 플레이어 up을 따라 회전한다. 구면 행성이라 걸어가면 '위'가 바뀌기 때문이다.
import * as THREE from 'three';
import { SKY, LIGHT } from '../data/lighting.js';

const VERT = `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// 지평선 → 천정 그라데이션. t를 그대로 쓰면 띠가 보이므로 smoothstep으로 부드럽게 민다.
const FRAG = `
  uniform vec3 uTop, uHorizon;
  varying vec3 vLocal;
  void main() {
    float t = clamp(normalize(vLocal).y, 0.0, 1.0);
    t = smoothstep(0.0, 0.62, t);
    gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.0);
  }
`;

export class Sky {
  constructor(engine, planet) {
    this.engine = engine;
    this.planet = planet;

    const R = planet.R;
    this.uniforms = {
      uTop:     { value: new THREE.Color(SKY.top) },
      uHorizon: { value: new THREE.Color(SKY.horizon) },
    };

    // 돔 — 안쪽에서 보므로 BackSide. depthWrite를 끄고 renderOrder를 낮춰 항상 맨 뒤에 둔다.
    const domeMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    domeMat.userData.outlineParameters = { visible: false };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(R * 2.4, 32, 20), domeMat);
    this.dome.renderOrder = -100;
    this.dome.frustumCulled = false;
    engine.scene.add(this.dome);

    // ── 원경 산맥 세 겹 ──────────────────────────────────────────────────────
    // ★ 처음엔 세그먼트마다 독립 삼각형을 세웠다. 밑변이 서로 붙지 않아 사이가 비었고,
    //   폭이 전부 같아서 산맥이 아니라 **판지로 오린 피라미드 줄**로 보였다(실사용 확인).
    //   닫힌 스트립 하나로 바꾸고 능선 높이를 다중 옥타브로 흔든다.
    // 먼 겹일수록 대기색(LIGHT.air)에 가깝게 — 이것만으로 깊이가 세 단계 생긴다.
    this.ridges = [
      this._ridge(R * 2.15, 3,  SKY.mtnFar,  0.070, 0.012, 0.72),
      this._ridge(R * 1.92, 17, SKY.mtnNear, 0.092, 0.008, 0.42),
      this._ridge(R * 1.72, 41, SKY.mtnNear, 0.108, 0.004, 0.16),
    ];
    for (const m of this.ridges) engine.scene.add(m);

    this._up = new THREE.Vector3(0, 1, 0);
  }

  // 능선 하나. 닫힌 띠라서 봉우리 사이가 비지 않는다.
  //   amp/base   반경 대비 능선 진폭 / 기본 높이
  //   airMix     대기색과 섞는 비율. 먼 겹일수록 크게 — 이게 깊이를 만든다
  _ridge(radius, seed, color, amp, base, airMix) {
    const N = 160;                       // 능선 표본. 이보다 성기면 봉우리가 각져 보인다
    let s = seed;
    const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const ph = [rnd() * 6.283, rnd() * 6.283, rnd() * 6.283, rnd() * 6.283];

    // 다중 옥타브 — 하나만 쓰면 사인파 언덕이 되고, 넷을 겹치면 산맥이 된다.
    // 마지막에 지수를 먹여 골을 눌러야 '봉우리만 솟은' 실루엣이 나온다.
    const hs = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      let v = Math.sin(a * 3 + ph[0]) * 0.55
            + Math.sin(a * 7 + ph[1]) * 0.27
            + Math.sin(a * 13 + ph[2]) * 0.13
            + Math.sin(a * 23 + ph[3]) * 0.05;
      v = Math.pow(Math.max(0, v * 0.5 + 0.5), 1.7);
      hs[i] = radius * (base + amp * v);
    }

    // 바닥은 지평선 한참 아래로. 얕게 두면 띠의 밑변이 화면에 가로줄로 보인다(구버전 실측).
    const yBot = -radius * 0.30;
    const pos = [], idx = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, cx = Math.cos(a) * radius, cz = Math.sin(a) * radius;
      pos.push(cx, yBot, cz);      // 2i
      pos.push(cx, hs[i], cz);     // 2i+1
    }
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const b0 = i * 2, t0 = i * 2 + 1, b1 = j * 2, t1 = j * 2 + 1;
      idx.push(b0, b1, t1, b0, t1, t0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    // 대기 원근을 색으로 직접 굽는다. 이 메시들은 안개 밖(fog:false)이라 자동으로는 안 걸린다.
    const c = new THREE.Color(color).lerp(new THREE.Color(LIGHT.air), airMix);
    const mat = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, fog: false, depthWrite: false });
    mat.userData.outlineParameters = { visible: false };
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -90;
    m.frustumCulled = false;
    return m;
  }

  // 돔과 산은 카메라를 따라다니고, 플레이어의 up을 '위'로 삼는다.
  update(player, camera) {
    const up = this._up.copy(player.position).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(_Y, up);
    for (const m of [this.dome, ...this.ridges]) {
      m.position.copy(camera.position);
      m.quaternion.copy(q);
    }
  }
}

const _Y = new THREE.Vector3(0, 1, 0);
export { LIGHT };
