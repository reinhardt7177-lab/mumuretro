// 렌더러/씬/카메라/조명/아웃라인 + 구면 인식 3인칭 카메라.
// 카메라는 자체 접선 forward(camFwd)를 유지: 플레이어 이동 시 평행수송, 드래그 시 up축 회전. 극점에서도 롤 없음.
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { orthonormalizeHeading } from '../world/SurfaceTransform.js';
import { smoothK } from '../util/math.js';

const SKY = 0xaee0e6;
const _ray = new THREE.Raycaster();
const _camOff = new THREE.Vector3();

export class Engine {
  constructor(canvas, planetR) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;
    this.outline = new OutlineEffect(renderer, { defaultThickness: 0.005, defaultColor: [0.05, 0.06, 0.09], defaultAlpha: 0.9 });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY);
    scene.fog = new THREE.Fog(SKY, planetR * 2.2, planetR * 4.0);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 800);

    // 조명: 반구광 + 그림자 던지는 태양(플레이어 up을 따라감) + 약한 필. (색/강도는 Atmosphere가 구동)
    this.hemi = new THREE.HemisphereLight(0xcfeef2, 0x6b7355, 1.1);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = planetR * 3;
    const s = planetR * 0.8;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.0006;
    scene.add(sun); scene.add(sun.target);
    this.sun = sun;
    const fill = new THREE.DirectionalLight(0xbfd6ff, 0.35);
    fill.position.set(-26, 20, -18);
    scene.add(fill);

    // 카메라 접선 프레임(이동 입력 기준). 첫 프레임은 lookHeight 위를 봄.
    this.camFwd = new THREE.Vector3(0, 0, 1);
    this.camRight = new THREE.Vector3(1, 0, 0);
    this.camUp = new THREE.Vector3(0, 1, 0);
    this.lookHeight = 1.2;
    this.camColliders = [];   // 카메라가 파고들지 않게 raycast할 근처 건물 메시(boot가 매 틱 갱신)
    this._inited = false;

    addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  // 플레이어 이동/시점에 맞춰 카메라 + camFwd 갱신. step 내부에서 호출(결정론 보장).
  updateCamera(player, input, dt) {
    const up = player.up;
    if (!this._inited) { this.camFwd.copy(player.heading); this.camUp.copy(up); this._inited = true; }

    // 평행수송: 플레이어가 이동한 회전만큼 camFwd도 회전 → 카메라가 경로를 따라 자연스럽게 휨.
    if (player.lastArc) this.camFwd.applyAxisAngle(player.lastAxis, player.lastArc);
    // 사용자 시점 회전
    this.camFwd.applyAxisAngle(up, input.consumeYaw());
    orthonormalizeHeading(this.camFwd, up);
    this.camRight.crossVectors(up, this.camFwd).normalize();   // 화면 오른쪽 = up × forward

    const pitch = input.camPitch, dist = input.camDist;
    // 플레이어→카메라 방향: camFwd 뒤쪽 + up 방향으로 들어올림
    const dir = this.camFwd.clone().multiplyScalar(-Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
    const target = player.position.clone().addScaledVector(up, this.lookHeight);
    let camDist = dist;

    // 카메라 충돌 — 시선표적→희망카메라 사이에 건물이 있으면 그 앞으로 당김(파고듦 방지). town.html:294 패턴.
    if (this.camColliders.length) {
      _camOff.copy(dir);
      _ray.set(target, _camOff); _ray.far = dist;
      const hit = _ray.intersectObjects(this.camColliders, false);
      if (hit.length) camDist = Math.max(2.5, hit[0].distance - 0.5);
    }
    const desired = target.clone().addScaledVector(dir, camDist);

    if (!this._camPlaced) { this.camera.position.copy(desired); this._camPlaced = true; }
    else this.camera.position.lerp(desired, smoothK(0.0008, dt));

    this.camUp.lerp(up, smoothK(0.0001, dt));
    if (this.camUp.lengthSq() > 1e-9) this.camUp.normalize();
    this.camera.up.copy(this.camUp);
    this.camera.lookAt(target);

    // 태양이 플레이어 위를 따라가 그림자가 항상 발밑에 잡힘
    this.sun.position.copy(player.position).addScaledVector(up, 60).addScaledVector(this.camRight, 12);
    this.sun.target.position.copy(player.position);
  }

  render() { this.outline.render(this.scene, this.camera); }
}
