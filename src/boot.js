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

// 봉우리 표식 — 임시. 삼각형 규칙이 "저기 가볼까"를 만드는지 확인하려면
// 봉우리가 어디인지 눈으로 확인할 수 있어야 한다. 프롭이 들어오면 지운다.
const markers = new THREE.Group();
for (const p of PEAKS) {
  const d = new THREE.Vector3(
    Math.cos(p.lat * Math.PI / 180) * Math.cos(p.lon * Math.PI / 180),
    Math.sin(p.lat * Math.PI / 180),
    Math.cos(p.lat * Math.PI / 180) * Math.sin(p.lon * Math.PI / 180),
  );
  const m = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 2.2, 5),
    new THREE.MeshBasicMaterial({ color: 0xf0a860 }),
  );
  m.material.userData.outlineParameters = { visible: false };
  const fr = planet.frameAt(planet.surfaceAt(d), 0);
  m.position.copy(fr.position).addScaledVector(d, 1.4);
  m.quaternion.copy(fr.quaternion);
  markers.add(m);
}
engine.scene.add(markers);

function step(dt) {
  const intent = input.poll();
  player.update(dt, intent, engine.camFwd, engine.camRight);
  engine.updateCamera(player, input, dt);
  sky.update(player, engine.camera);
}

const loop = new Loop(step, () => engine.render());

const game = { step, planet, player, engine, input, loop, sky, markers };
window.game = game;
installDebug({ planet, player, engine, input, step, sky, markers, PEAKS });

const load = document.getElementById('load');
if (load) load.style.display = 'none';
loop.start();
console.log(`[boot] 재설계 v2 — 봉우리 ${PEAKS.length} · 지형면 ${planet.mesh.geometry.attributes.position.count / 3} · __dbg/__selftest`);
