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

    // ── 원경 산 두 겹 ────────────────────────────────────────────────────────
    // 지평선 아래에서 살짝 올라온 톱니 링. 실제 지형이 아니라 그림이다.
    // 먼 겹일수록 대기색에 가깝게 — 이것만으로 깊이가 두 단계 생긴다.
    this.mtnFar = this._ring(R * 2.05, 0.055, 0.030, SKY.mtnFar, 31, 7);
    this.mtnNear = this._ring(R * 1.85, 0.078, 0.046, SKY.mtnNear, 23, 3);
    engine.scene.add(this.mtnFar, this.mtnNear);

    this._up = new THREE.Vector3(0, 1, 0);
  }

  // 톱니 링 하나. seg개의 봉우리를 만들고 높이를 seed로 흔든다.
  _ring(radius, peakH, baseH, color, seg, seed) {
    const pos = [], idx = [];
    let s = seed;
    const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      // 봉우리 높이를 크게 흔든다 — 같은 높이 톱니는 톱니로 보이고 산으로 안 보인다
      const h = radius * (baseH + peakH * (0.35 + rnd() * 0.9));
      const yb = -radius * 0.02;
      const p = (a, y, r) => { pos.push(Math.cos(a) * r, y, Math.sin(a) * r); return pos.length / 3 - 1; };
      const i0 = p(a0, yb, radius), i1 = p(a1, yb, radius), i2 = p(am, h, radius * 0.995);
      idx.push(i0, i1, i2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false, depthWrite: false });
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
    for (const m of [this.dome, this.mtnFar, this.mtnNear]) {
      m.position.copy(camera.position);
      m.quaternion.copy(q);
    }
  }
}

const _Y = new THREE.Vector3(0, 1, 0);
export { LIGHT };
