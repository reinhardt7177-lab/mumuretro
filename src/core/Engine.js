// 렌더러/씬/카메라/조명/아웃라인 + 구면 인식 3인칭 카메라.
// 카메라는 자체 접선 forward(camFwd)를 유지: 플레이어 이동 시 평행수송, 드래그 시 up축 회전. 극점에서도 롤 없음.
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { quality } from '../render/Quality.js';
import { orthonormalizeHeading } from '../sphere/SurfaceTransform.js';
import { smoothK } from '../util/math.js';
import { LIGHT, SKY as SKY_C, INTENSITY, FOG_DENSITY, SUN_ELEV_DEG, SUN_AZIM_DEG } from '../data/lighting.js';

const SKY = SKY_C.horizon;   // 배경·안개는 반드시 하늘 지평선 색과 같아야 한다(§3)
const _ray = new THREE.Raycaster();
const _camOff = new THREE.Vector3();
const _ground = new THREE.Vector3();
// 태양 방향 계산용 — 매 프레임 할당하지 않는다
const _WY = new THREE.Vector3(0, 1, 0), _WX = new THREE.Vector3(1, 0, 0);
const _east = new THREE.Vector3(), _north = new THREE.Vector3(), _sunDir = new THREE.Vector3();

// 그림자/안개는 행성 반지름에 그대로 비례시키면 안 된다.
// 그림자: 맵 해상도는 고정인데 커버 범위만 커지면 텍셀 밀도가 R에 반비례해 뭉갠다 → 절대 범위로 상한.
// 안개: 구면 지평선까지의 거리는 R이 아니라 √R에 비례한다(√(2·R·h)) → 그 스케일에 맞춘다.
const SHADOW_EXTENT_MAX = 40;   // 그림자 카메라 반폭 상한(월드 단위)
const SUN_HEIGHT = 60;          // 태양이 플레이어 위로 떠 있는 높이(updateCamera와 일치)
const CAM_HEIGHT = 6.3;         // 지평선 거리 추정용 대표 카메라 고도
const FOG_NEAR_K = 0.75, FOG_FAR_K = 1.45;   // 지평선 거리 대비 안개 시작/끝

// 카메라 고도 h에서 반지름 R 구면의 지평선까지 표면 거리 근사.
const horizonDist = (R, h = CAM_HEIGHT) => Math.sqrt(2 * R * h);

export class Engine {
  constructor(canvas, planetR) {
    // ★ antialias를 껐다. **켜도 아무 데도 안 쓰인다** — 이 게임은 항상 컴포저를
    //   거치므로 씬은 렌더 타깃(samples=0)에 그려지고, 기본 프레임버퍼에는 마지막
    //   전체화면 사각형 하나만 그린다. 사각형에 MSAA를 걸어 봐야 얻는 게 없다.
    //   태블릿에서는 그 MSAA 버퍼 자체가 대역폭과 메모리를 먹는다.
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // 톤매핑 — NoToneMapping이면 밝은 곳이 그냥 잘려서(clip) 색이 물 빠져 보인다.
    // ACES는 하이라이트를 부드럽게 말아 올려 채도와 대비가 살아난다.
    // 대신 전체가 어두워지므로 노출과 광원 강도를 같이 올려야 한다(아래 SUN_I/HEMI_I 보정).
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // 노출 1.1 — A/B 실측상 원래와 같은 밝기(88 vs 90)에서 채도가 0.44 → 0.51로 오른다.
    // 더 올리면 밝아지는 대신 채도를 다시 잃는다(1.6에서 0.45).
    // 노출 1.0 — 구버전 1.1은 평균 휘도를 0.519까지 밀어 화면이 떠 보였다(§2 표).
    // 대신 광원 강도를 올려 형태 대비는 유지한다.
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = quality.get('shadow') > 0;
    // PCFSoft는 그림자 한 점마다 표본을 여러 번 뜬다. 낮은 단수에서는 PCF로 내린다.
    renderer.shadowMap.type = quality.get('soft') ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer = renderer;
    // 외곽선 — 굵으면 화면이 색칠공부처럼 된다. 레퍼런스(로우폴리 툰)는 외곽선이 아예 없고
    // 평면 셰이딩과 조명만으로 형태를 읽힌다. 완전히 빼면 실루엣이 뭉개지므로
    // 얇고 옅게, 색도 검정 대신 어두운 갈청색으로 둬서 "선"이 아니라 "그늘"처럼 보이게 한다.
    this.outline = new OutlineEffect(renderer, {
      defaultThickness: 0.0021,
      defaultColor: [0.13, 0.14, 0.17],
      defaultAlpha: 0.55,
    });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY);
    // ── 대기 원근 (§3) ──────────────────────────────────────────────────
    // 구버전엔 이게 사실상 없어서 근경과 원경의 채도가 같았다 — 화면이 납작해 보인 진짜 원인.
    // 선형 안개 대신 지수 안개를 쓴다: 1 − exp(−(d·k)²)라 근경은 거의 손대지 않고
    // 원경만 빠르게 대기색으로 간다. k는 "지평선 28u에서 0.60 수렴"에서 역산한 값이다.
    scene.fog = new THREE.FogExp2(SKY, FOG_DENSITY);
    this.scene = scene;

    // far: 가시 지오메트리는 전부 구 표면 위 → 지평선 림까지 √(L²−R²) 정도면 충분. R*3이면 넉넉.
    // near를 0.1→0.3으로 올려 깊이 정밀도 확보(카메라 최소 거리는 2.5로 클램프됨).
    // 시야각 — 3인칭 표준은 60~75다. 55는 실내에서 좁게 느껴진다는 실사용 지적이
    // 있었고, 폴리곤 하나 안 늘리고 넓힐 수 있는 유일한 손잡이가 이것이다.
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, planetR * 3);

    // ── 조명 (§2) ───────────────────────────────────────────────────────
    // 규칙 하나: 빛은 따뜻하게, 그림자는 차갑게. 그림자는 "빛이 없는 곳"이 아니라
    // "하늘이 비추는 곳"이다. 반구광의 하늘색이 곧 그림자 색이 된다.
    this.hemi = new THREE.HemisphereLight(LIGHT.air, 0x8a8560, INTENSITY.hemi);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(LIGHT.sun, INTENSITY.sun);
    sun.castShadow = quality.get('shadow') > 0;
    const sm = quality.get('shadow') || 1024;
    sun.shadow.mapSize.set(sm, sm);
    // 범위를 절대값으로 상한 → 2048맵 기준 텍셀 밀도가 R과 무관하게 최소 25 texel/u 유지.
    // (planetR*0.8을 그대로 쓰면 R=136에서 9 texel/u로 떨어져 근거리 그림자가 뭉갠다.)
    const s = Math.min(planetR * 0.8, SHADOW_EXTENT_MAX);
    // 태양은 플레이어 위 SUN_HEIGHT. 범위 끝에서 구면이 아래로 꺼지는 양까지 덮는다.
    const drop = planetR - Math.sqrt(Math.max(0, planetR * planetR - s * s));
    sun.shadow.camera.near = 1; sun.shadow.camera.far = SUN_HEIGHT + drop + 20;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.0006;
    scene.add(sun); scene.add(sun.target);
    this.sun = sun;
    // 반대편 약한 보조광 — 이게 없으면 그림자 면이 단색 판이 되어 형태가 사라진다.
    const fill = new THREE.DirectionalLight(LIGHT.shadow, INTENSITY.fill);
    fill.position.set(-26, 20, -18);
    scene.add(fill);
    this.fill = fill;

    // 카메라 접선 프레임(이동 입력 기준). 첫 프레임은 lookHeight 위를 봄.
    this.camFwd = new THREE.Vector3(0, 0, 1);
    this.camRight = new THREE.Vector3(1, 0, 0);
    this.camUp = new THREE.Vector3(0, 1, 0);
    this.lookHeight = 1.2;
    this.camColliders = [];   // 카메라가 파고들지 않게 raycast할 근처 건물 메시(boot가 매 틱 갱신)
    this._inited = false;

    // ★ 여기서 **후처리 크기를 안 맞춰 주고 있었다.** 컴포저 렌더 타깃은 만들 때
    //   크기로 굳으므로, 창이 바뀌면(태블릿 회전·주소창 접힘·전체 화면) 화면과
    //   버퍼 크기가 어긋난 채로 남는다. 늘어나거나 흐려 보이는 것이 그것이다.
    addEventListener('resize', () => this.applySize());
    // 화질 단수가 바뀌면 픽셀비·그림자를 다시 건다(스스로 내려갈 때 쓴다).
    quality.onChange((t) => {
      renderer.shadowMap.enabled = t.shadow > 0;
      renderer.shadowMap.type = t.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      this.sun.castShadow = t.shadow > 0;
      if (t.shadow > 0) this.sun.shadow.mapSize.set(t.shadow, t.shadow);
      // 그림자맵 크기를 바꾸면 이미 만든 타깃을 버려야 새 크기로 다시 만든다.
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      this.applySceneShadows();
      this.applySize();
    });
  }

  // 픽셀비 · 캔버스 · 카메라 · 후처리 버퍼를 한 자리에서 맞춘다.
  // 넷이 따로 놀면 반드시 하나가 낡은 채로 남는다.
  applySize() {
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    if (this.post) this.post.setSize(innerWidth, innerHeight);
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

    const pitch = input.camPitch, dist = input.camDist + (player.gliding ? 1.0 : 0);
    // 플레이어→카메라 방향: camFwd 뒤쪽 + up 방향으로 들어올림
    const dir = this.camFwd.clone().multiplyScalar(-Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
    const foot = player.getFootPosition ? player.getFootPosition(_ground) : _ground.copy(player.position);
    const lift = foot.length() - player.position.length();
    this._cameraLift = this._camPlaced ? THREE.MathUtils.lerp(this._cameraLift || 0, lift, 1 - Math.exp(-12 * dt)) : lift;
    const target = player.position.clone().addScaledVector(up, this.lookHeight + this._cameraLift);
    let camDist = dist;

    // 카메라 충돌 — 시선표적→희망카메라 사이에 건물이 있으면 그 앞으로 당김(파고듦 방지). town.html:294 패턴.
    if (this.camColliders.length) {
      _camOff.copy(dir);
      _ray.set(target, _camOff); _ray.far = dist;
      const hit = _ray.intersectObjects(this.camColliders, false);
      if (hit.length) camDist = Math.max(2.5, hit[0].distance - 0.5);
    }
    const desired = target.clone().addScaledVector(dir, camDist);
    // 능선을 등지고 활공할 때 카메라가 뒤쪽 언덕 속으로 들어가지 않게 한다.
    if (player.planet?.surfaceAt) {
      player.planet.surfaceAt(_ground.copy(desired).normalize(), _ground);
      if (desired.length() < _ground.length() + 0.8) desired.setLength(_ground.length() + 0.8);
    }

    if (!this._camPlaced) { this.camera.position.copy(desired); this._camPlaced = true; }
    else this.camera.position.lerp(desired, smoothK(0.0008, dt));
    if (player.planet?.surfaceAt) {
      player.planet.surfaceAt(_ground.copy(this.camera.position).normalize(), _ground);
      if (this.camera.position.length() < _ground.length() + 0.8) this.camera.position.setLength(_ground.length() + 0.8);
    }
    const fov = THREE.MathUtils.lerp(this.camera.fov, player.gliding ? 68 : 62, 1 - Math.exp(-3 * dt));
    if (Math.abs(fov - this.camera.fov) > 0.001) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }

    this.camUp.lerp(up, smoothK(0.0001, dt));
    if (this.camUp.lengthSq() > 1e-9) this.camUp.normalize();
    this.camera.up.copy(this.camUp);
    this.camera.lookAt(target);

    // 태양이 플레이어 위를 따라가 그림자가 항상 발밑에 잡힘
    // ── 태양 방향 (§2) ──────────────────────────────────────────────────
    // 구버전은 플레이어 바로 위(고도 ≈79°)에 태양을 뒀다. 그러면 그림자가 발밑으로
    // 사라져 지형이 납작해진다 — 삼각형 규칙(§1)으로 만든 능선이 아무것도 드러내지 못한다.
    // 고도 42° 측광으로 내려서 능선이 자기 그림자를 길게 드리우게 한다.
    //
    // 방위는 **카메라가 아니라 지역 좌표계**에 건다. camRight에 걸면 시점을 돌릴 때마다
    // 그림자가 같이 돌아서 형태를 못 읽는다. worldY에서 유도한 지역 북쪽을 기준으로 고정한다.
    const ref = Math.abs(up.y) > 0.99 ? _WX : _WY;
    _east.crossVectors(ref, up).normalize();
    _north.crossVectors(up, _east).normalize();
    const el = SUN_ELEV_DEG * Math.PI / 180, az = SUN_AZIM_DEG * Math.PI / 180;
    _sunDir.copy(up).multiplyScalar(Math.sin(el))
      .addScaledVector(_north, Math.cos(az) * Math.cos(el))
      .addScaledVector(_east, Math.sin(az) * Math.cos(el))
      .normalize();
    this.sun.position.copy(player.position).addScaledVector(_sunDir, SUN_HEIGHT);
    this.sun.target.position.copy(player.position);
    this.sun.target.updateMatrixWorld();
  }

  // 후처리를 붙이면 컴포저가 외곽선 패스까지 감싸서 그린다. 없으면 기존 경로 그대로.
  attachPost(post) { this.post = post; this.applySize(); }

  // 사당 안팎 전환. 배경·안개는 씬마다 다르므로 씬 자신이 들고 있고, 여기선 갈아 끼우기만 한다.
  setScene(scene) { this.scene = scene; this.applySceneShadows(); }

  // 사당의 태양도 현재 화질을 따른다. 아직 방문하지 않은 씬은 입장할 때 맞춘다.
  applySceneShadows() {
    const size = quality.get('shadow');
    if (!size) return;
    this.scene.traverse(light => {
      if (!light.isLight || !light.castShadow || !light.shadow) return;
      if (light.shadow.mapSize.x === size && light.shadow.mapSize.y === size) return;
      light.shadow.mapSize.set(size, size);
      if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; }
    });
  }

  // 외곽선은 씬을 **한 번 더** 그린다(안쪽 껍데기를 뒤집어 키운 것). 태블릿 실측으로
  // 그리기 호출 151번·삼각형 104k·화면 한 장어치 픽셀이 여기서 나간다.
  // 가장 낮은 단수에서만 뺀다 — 실루엣이 뭉개지므로 마지막에 버릴 것이다.
  drawScene() {
    if (quality.get('outline')) this.outline.render(this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
  }

  render() {
    if (this.post && this.post.enabled) this.post.render();
    else this.drawScene();
  }
}
