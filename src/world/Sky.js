// 하늘 — 그라데이션 돔 + 해/달 + 별 + 구름.
//
// 작은 행성에서는 "위"가 플레이어마다 다르다. 그래서 하늘 그라데이션의 기준축은
// 월드 Y가 아니라 플레이어의 up이어야 한다(uUp 유니폼). 돔은 매 프레임 카메라 위치로
// 옮겨서 카메라가 어디로 가든 항상 감싸게 한다.
import * as THREE from 'three';
// 구름은 시간대에 따라 색·투명도를 바꾸므로 공유 머티리얼(toonShared)을 쓰면 안 된다.
// 같은 흰색을 쓰는 프롭이 전부 같이 반투명해진다.
import { toon } from '../rendering/Toon.js';
import { makeRNG } from '../util/math.js';

const STAR_COUNT = 700;
const CLOUD_CLUSTERS = 44;   // 구름 덩어리 수
const CLOUD_PUFFS = 5;       // 덩어리당 뭉치 수

const SKY_VERT = `
  varying vec3 vDir;
  void main() {
    vDir = position;                       // 돔은 회전시키지 않으므로 로컬 = 방향
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = `
  uniform vec3 uUp, uTop, uHorizon, uGround;
  varying vec3 vDir;
  void main() {
    float d = dot(normalize(vDir), uUp);    // 1=천정, 0=지평선, -1=발밑
    vec3 c = mix(uHorizon, uTop, smoothstep(0.0, 0.62, d));
    c = mix(uGround, c, smoothstep(-0.30, 0.03, d));   // 지평선 아래는 살짝 어둡게
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

export class Sky {
  constructor(engine, planet) {
    this.engine = engine;
    this.planet = planet;
    this.phase = 0;
    // 돔은 카메라를 따라다니므로 카메라 far 안에 들어와야 잘리지 않는다(far = R*3).
    const DOME_R = planet.R * 2.2;
    this.domeR = DOME_R;

    // ── 돔 ──
    this.uniforms = {
      uUp: { value: new THREE.Vector3(0, 1, 0) },
      uTop: { value: new THREE.Color(0x5fa8dd) },
      uHorizon: { value: new THREE.Color(0xd8f0f2) },
      uGround: { value: new THREE.Color(0x9ec0c4) },
    };
    const domeMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    domeMat.userData.outlineParameters = { visible: false };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 32, 20), domeMat);
    this.dome.renderOrder = -1000;         // 항상 가장 먼저(배경)
    this.dome.frustumCulled = false;
    engine.scene.add(this.dome);

    // ── 별 ──
    const rng = makeRNG(2026);
    const sp = new Float32Array(STAR_COUNT * 3);
    const ss = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      const z = rng() * 2 - 1, th = rng() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      const d = DOME_R * 0.92;
      sp[i * 3] = r * Math.cos(th) * d; sp[i * 3 + 1] = z * d; sp[i * 3 + 2] = r * Math.sin(th) * d;
      ss[i] = 1.2 + rng() * 2.6;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    starGeo.setAttribute('size', new THREE.Float32BufferAttribute(ss, 1));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 2.6, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    this.starMat.userData.outlineParameters = { visible: false };
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.renderOrder = -999;
    this.stars.frustumCulled = false;
    engine.scene.add(this.stars);

    // ── 해 / 달 ──
    const disc = (color, size) => {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, fog: false });
      m.userData.outlineParameters = { visible: false };
      const s = new THREE.Mesh(new THREE.CircleGeometry(size, 28), m);
      s.renderOrder = -998;
      s.frustumCulled = false;
      engine.scene.add(s);
      return s;
    };
    this.sunDisc = disc(0xfff3c4, 26);
    this.moonDisc = disc(0xe8eefc, 18);

    // ── 구름 ── 행성 위 일정 고도에 뜬 저폴리 덩어리. InstancedMesh 1 드로우콜.
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);
    this.cloudMat = toon(0xffffff, { transparent: true, opacity: 0.92, fog: false });
    this.cloudMat.userData.outlineParameters = { visible: false };
    const n = CLOUD_CLUSTERS * CLOUD_PUFFS;
    this.clouds = new THREE.InstancedMesh(puffGeo, this.cloudMat, n);
    this.clouds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.clouds.castShadow = false;
    this.clouds.receiveShadow = false;
    this.clouds.frustumCulled = false;
    const alt = planet.R + 16;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    const pos = new THREE.Vector3(), scl = new THREE.Vector3();
    const up = new THREE.Vector3(), east = new THREE.Vector3(), north = new THREE.Vector3();
    const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
    let k = 0;
    for (let c = 0; c < CLOUD_CLUSTERS; c++) {
      const z = rng() * 2 - 1, th = rng() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      up.set(r * Math.cos(th), z, r * Math.sin(th)).normalize();
      const ref = Math.abs(up.dot(Y)) > 0.99 ? X : Y;
      east.crossVectors(ref, up).normalize();
      north.crossVectors(up, east).normalize();
      const w = 3.2 + rng() * 3.4;                 // 덩어리 크기
      for (let p = 0; p < CLOUD_PUFFS; p++) {
        pos.copy(up).multiplyScalar(alt + (rng() - 0.5) * 3);
        pos.addScaledVector(east, (rng() - 0.5) * w * 2.2);
        pos.addScaledVector(north, (rng() - 0.5) * w * 1.2);
        const s = w * (0.45 + rng() * 0.5);
        scl.set(s, s * 0.62, s * 0.85);            // 납작하게
        q.setFromAxisAngle(up, rng() * Math.PI * 2);
        m4.compose(pos, q, scl);
        this.clouds.setMatrixAt(k++, m4);
      }
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    engine.scene.add(this.clouds);

    this._tmp = new THREE.Vector3();
    this._east = new THREE.Vector3();
  }

  // Atmosphere가 키프레임 보간 결과를 넘겨준다.
  applyPalette(a, b, t) {
    const u = this.uniforms;
    _cA.set(a.skyTop); _cB.set(b.skyTop); u.uTop.value.copy(_cA.lerp(_cB, t));
    _cA.set(a.skyHorizon); _cB.set(b.skyHorizon); u.uHorizon.value.copy(_cA.lerp(_cB, t));
    // 지평선 아래는 지평선 색을 살짝 어둡게
    u.uGround.value.copy(u.uHorizon.value).multiplyScalar(0.72);
    this.starMat.opacity = a.starI + (b.starI - a.starI) * t;
    this.stars.visible = this.starMat.opacity > 0.015;      // 낮에는 아예 그리지 않음
    _cA.set(a.cloudTint); _cB.set(b.cloudTint); this.cloudMat.color.copy(_cA.lerp(_cB, t));
    // 해의 고도도 키프레임에서 직접 보간 — 시간대 이름과 하늘 색이 항상 일치한다.
    this.sunElev = (a.sunElev + (b.sunElev - a.sunElev) * t) * Math.PI / 180;
  }

  // 매 프레임: 돔·별을 카메라에 붙이고, 해/달을 시간대에 맞는 고도에 놓는다.
  update(phase, player, camera) {
    this.phase = phase;
    const up = player.up;
    this.uniforms.uUp.value.copy(up);

    this.dome.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    // 별은 월드에 고정된 것처럼 보여야 하므로 회전은 주지 않는다(위치만 따라감).

    // 해의 고도각: 한낮(0.28)에 최고, 노을(0.60) 무렵 지평선, 밤엔 아래.
    // 그림자용 DirectionalLight는 계속 머리 위에 두어 그림자 품질을 지키고,
    // 눈에 보이는 해/달만 따로 궤도를 돈다.
    const elev = this.sunElev ?? 0.9;
    // up에 수직인 기준 "동쪽". camera.up은 플레이어 up으로 수렴하므로 외적이 0이 되어 쓸 수 없다.
    // 월드 Y를 기준으로 삼되 극 근처에서는 X로 교체한다.
    const ref = Math.abs(up.y) > 0.99 ? _X : _Y;
    this._east.crossVectors(ref, up);
    if (this._east.lengthSq() < 1e-9) this._east.set(1, 0, 0);
    this._east.normalize();

    const far = this.domeR * 0.86;
    const place = (disc, e) => {
      this._tmp.copy(up).multiplyScalar(Math.sin(e)).addScaledVector(this._east, Math.cos(e)).normalize();
      disc.position.copy(camera.position).addScaledVector(this._tmp, far);
      disc.lookAt(camera.position);
      disc.visible = e > -0.28;                    // 지평선 아래로 충분히 내려가면 숨김
    };
    place(this.sunDisc, elev);
    place(this.moonDisc, -elev);                    // 달은 해의 반대편
  }
}

const _cA = new THREE.Color(), _cB = new THREE.Color();
const _Y = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(1, 0, 0);
