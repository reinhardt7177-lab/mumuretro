// 진입점 — 조립만 한다.
//
// 재설계 1주차: 걸어다닐 수 있는 행성 하나. 학습·UI·프롭은 아직 없다.
// 아트 바이블 §1(삼각형 지형) §2(고정 조명) §3(대기 원근)이 실제로 화면에서 되는지
// 확인하는 것이 이 빌드의 전부다.
//
//   sphere/   구면 보행 — v1에서 검증된 채로 가져왔다(극점 통과 편차 2.84e-14)
//   render/   조명·하늘·툰·후처리 — 전부 새로
//   debug/    __dbg / __selftest — 눈이 없으면 또 장님이 된다
import * as THREE from 'three';
import { Planet, R, PEAKS } from './sphere/Planet.js';
import { Player } from './sphere/Player.js';
import { Engine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { Loop } from './core/Loop.js';
import { Sky } from './render/Sky.js';
import { Post } from './render/Post.js';
import { buildScatter } from './world/Scatter.js';
import { buildGrassCarpet } from './world/GrassCarpet.js';
import { pickShrineSpots, buildShrines } from './world/Shrine.js';
import { installDebug } from './debug/introspect.js';

const canvas = document.getElementById('c');
const engine = new Engine(canvas, R);
const planet = new Planet(engine.scene);
engine.attachPost(new Post(engine.renderer, engine.scene, engine.camera, engine.outline));
const sky = new Sky(engine, planet);

const player = new Player(planet);
player.setLatLon(6, -18);           // 주 랜드마크(lat 30 / lon 0)가 정면에 들어오는 자리
engine.scene.add(player.mesh);

const input = new Input(canvas);
engine.camFwd.copy(player.heading);
engine.camUp.copy(player.up);
engine._inited = true;

// 지면 산포 — 나무·바위·덤불·풀. 화면을 채우는 것은 빛이 아니라 밀도다.
// 봉우리에 세워 뒀던 주황 원뿔 표식은 뺐다. 이제 식생이 그 역할을 한다 —
// 나무가 없는 능선과 바위뿐인 고지대가 곧 "저기는 다르다"는 신호가 된다.
// 사당 자리를 **먼저** 잡는다. 산포물이 사당 안에서 자라면 즉시 고장으로 읽히므로
// 배치 순서가 곧 정답이다 — 나중에 지우는 것보다 처음부터 안 심는 게 싸고 확실하다.
const shrineSpots = pickShrineSpots(planet, PEAKS, { count: 6 });
const SHRINE_CLEAR = 5.6 / R;                     // 기단(3.4u) + 여유
const nearShrine = (dir) => shrineSpots.some(s => dir.angleTo(s.dir) < SHRINE_CLEAR);

const scatter = buildScatter(engine.scene, planet, {
  samples: 160000, seed: 91, exclude: nearShrine,
});

// 잔디 카펫 — 지면을 덮는 한 장. 풀을 개수로 흩뿌리는 대신 바닥이 통째로 흐물거린다.
// 산포물과 같은 바이옴 판정을 쓰므로 둘이 어긋날 수 없다.
const carpet = buildGrassCarpet(engine.scene, planet, { grassAt: scatter.grassAt });

// 사당 — 이 세계에서 유일하게 각진 것. 빛기둥이 능선 너머에서도 "저기 뭔가 있다"를 만든다.
const shrines = buildShrines(engine.scene, planet, shrineSpots);
// 시작 위치를 가장 가까운 사당 쪽으로 돌려 세운다 — 첫 화면에 목표가 보여야 한다.
(function faceNearestShrine() {
  const n = shrines.nearest(player.position);
  if (!n.shrine) return;
  const up = player.position.clone().normalize();
  const to = n.shrine.pos.clone().sub(player.position);
  to.addScaledVector(up, -to.dot(up));
  if (to.lengthSq() < 1e-9) return;
  player.heading.copy(to.normalize());
  player.syncMesh();
  engine.camFwd.copy(player.heading); engine.camUp.copy(player.up);
})();

let _windT = 0;
// 발밑 접지 자국 — 잔디가 눌린 것처럼 보이는 어두운 원반.
// 그림자만으로는 캐릭터가 지면에 "닿아" 있는 느낌이 약하다. 이 원반 하나가 그걸 만든다.
const contact = new THREE.Mesh(
  new THREE.CircleGeometry(0.42, 14),
  new THREE.MeshBasicMaterial({ color: 0x2c3a24, transparent: true, opacity: 0.28, depthWrite: false }),
);
contact.material.userData.outlineParameters = { visible: false };
contact.renderOrder = 1;
engine.scene.add(contact);

const _cUp = new THREE.Vector3();
const _CZ = new THREE.Vector3(0, 0, 1);   // CircleGeometry의 법선은 +Z다
function step(dt) {
  const intent = input.poll();
  player.update(dt, intent, engine.camFwd, engine.camRight);
  // 나무 줄기와 바위를 통과하지 못하게. 이동 직후, 카메라 갱신 전에 밀어낸다 —
  // 순서가 뒤바뀌면 카메라가 한 프레임 늦게 따라와 화면이 튄다.
  scatter.resolve(player.position, 0.32);
  shrines.resolve(player.position, 0.32);
  // 플레이어는 **지형** 위를 걷는데 눈에 보이는 지면은 카펫(0.15u 위)이다.
  // 그 차이만큼 시각적으로 올려 세운다. 안 그러면 발이 정확히 카펫 두께만큼 잠긴다.
  _cUp.copy(player.position).normalize();
  player.mesh.position.copy(player.position).addScaledVector(_cUp, carpet.liftAt(_cUp));
  // 접지 자국은 카펫 표면 바로 위에
  contact.position.copy(player.mesh.position).addScaledVector(_cUp, 0.03);
  contact.quaternion.setFromUnitVectors(_CZ, _cUp);
  engine.updateCamera(player, input, dt);
  sky.update(player, engine.camera);
  // 바람 시계. 정점 셰이더가 이 값 하나로 풀·수관·덤불을 전부 흔든다(CPU 작업 0).
  _windT += dt;
  scatter.update(_windT);
  carpet.update(_windT);
}

const loop = new Loop(step, () => engine.render());

const game = { step, planet, player, engine, input, loop, sky, scatter, carpet, shrines, contact };
window.game = game;
installDebug({ planet, player, engine, input, step, sky, scatter, carpet, shrines, PEAKS });

const load = document.getElementById('load');
if (load) load.style.display = 'none';
loop.start();
console.log(`[boot] 재설계 v2 — 봉우리 ${PEAKS.length} · 지형면 ${planet.mesh.geometry.attributes.position.count / 3}`
  + ` · 산포 ${scatter.meshes.length}메시 · 사당 ${shrines.shrines.length} · __dbg/__selftest`);
