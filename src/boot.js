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
import { SHRINES, ENTRY_Z, EXIT_Z } from './shrine/layouts.js';
import { buildRoom } from './shrine/Room.js';
import { RoomActor } from './shrine/RoomActor.js';
import { buildMapPage } from './ui/MapPage.js';
import { buildTouchControls } from './ui/TouchControls.js';
import { buildDialogue } from './ui/Dialogue.js';
import { buildNotebook } from './ui/Notebook.js';
import { KEEPERS, ENDING, nextHint, OPENING } from './shrine/dialogue.js';
import { buildLab } from './world/Lab.js';
import { buildLanding } from './world/Landing.js';
import { installDebug } from './debug/introspect.js';

const canvas = document.getElementById('c');
const engine = new Engine(canvas, R);
const planet = new Planet(engine.scene);
const planetScene = engine.scene;   // 사당에서 돌아올 때 갈아 끼울 대상
engine.attachPost(new Post(engine));
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
// 내림판도 같은 규칙이다. 포탈에서 내렸는데 나무 한 그루가 판을 뚫고 서 있으면
// 그건 첫 화면부터 고장으로 읽힌다 — 나중에 지우는 것보다 처음부터 안 심는 게 싸다.
const landingDir = player.position.clone().normalize();
const LANDING_CLEAR = 4.2 / R;
const nearShrine = (dir) => dir.angleTo(landingDir) < LANDING_CLEAR
  || shrineSpots.some(s => dir.angleTo(s.dir) < SHRINE_CLEAR);

const scatter = buildScatter(engine.scene, planet, {
  samples: 160000, seed: 91, exclude: nearShrine,
});

// 잔디 카펫 — 지면을 덮는 한 장. 풀을 개수로 흩뿌리는 대신 바닥이 통째로 흐물거린다.
// 산포물과 같은 바이옴 판정을 쓰므로 둘이 어긋날 수 없다.
const carpet = buildGrassCarpet(engine.scene, planet, { grassAt: scatter.grassAt });

// 사당 — 이 세계에서 유일하게 각진 것. 빛기둥이 능선 너머에서도 "저기 뭔가 있다"를 만든다.
// 겉모습도 사당마다 다르다. 능선 너머에서는 색과 윤곽만 남으므로
// 그 둘이 같으면 여섯 사당은 아이에게 한 곳이다.
const shrines = buildShrines(engine.scene, planet, shrineSpots, SHRINES.map((s) => s.theme));
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

// ── 사당 안팎 전환 ────────────────────────────────────────────────────────
// 행성과 사당은 서로 다른 Scene이다. engine.setScene으로 갈아 끼우고,
// 어느 쪽을 도는지는 mode 하나가 정한다. 상태기계를 더 만들지 않는다.
const roomActor = new RoomActor(player.mesh, player.body, player.footOffset, []);

// 사당마다 자기 내부를 갖는다. 처음 들어갈 때 짓고 캐시한다 —
// 여섯을 미리 지으면 첫 로딩이 길어지고, 아이가 한 판에 여섯을 다 도는 일은 드물다.
const rooms = new Map();
function roomFor(shrine) {
  const i = shrines.shrines.indexOf(shrine);
  const key = i < 0 ? 0 : i % SHRINES.length;
  if (!rooms.has(key)) {
    const r = buildRoom(SHRINES[key]);
    rooms.set(key, r);
    console.log(`[shrine] 내부 '${r.spec.id}' 지음 — ${r.spec.name} · ${r.spec.unit}`);
  }
  return rooms.get(key);
}

let mode = 'lab';                    // 'lab' | 'planet' | 'room'
let activeShrine = null;
let room = null;                     // 지금 들어가 있는 사당의 내부
let cleared = false;                 // 이번 사당을 깼나
let noteMsg = null, noteT = 0;       // 잠깐 뜨는 알림(실패 안내·사당 이름·방 목표)
let lastSeg = null;                  // 방이 바뀌는 순간을 잡는다
let sawNote = false;                 // 수첩을 한 번이라도 펴 봤나(오프닝)
const savedPlanet = { pos: new THREE.Vector3(), heading: new THREE.Vector3() };

// 화면 아래 조작 안내 — **가진 것만 적는다.**
// 소포를 열기 전부터 "N 수첩"이라고 적혀 있으면, 눌러도 아무 일이 없는 키를
// 게임이 먼저 알려 준 셈이 된다. 오프닝에서 소포를 열 이유도 그만큼 흐려진다.
const hintEl = document.getElementById('hint');
function refreshHint() {
  if (!hintEl) return;
  const base = touch.visible
    ? '왼쪽 절반 이동 · 오른쪽 절반 시점 · 버튼으로 E·점프'
    : 'WASD/방향키 이동 · 마우스 드래그 시점 · 휠 줌 · Shift 달리기 · Space 점프 · E 상호작용';
  const extra = [];
  if (mapPage.has) extra.push(touch.visible ? '🗺 지도' : 'M 지도');
  if (notebook.has) extra.push(touch.visible ? '📓 수첩' : 'N 수첩');
  hintEl.textContent = base + (extra.length ? ' · ' + extra.join(' · ') : '');
}

const promptEl = document.getElementById('prompt');
function setPrompt(text) {
  if (!promptEl) return;
  if (text) { promptEl.textContent = text; promptEl.classList.add('show'); }
  else promptEl.classList.remove('show');
}

// 실패 — 방 처음으로. 사당 처음이 아니다.
// 레이저에서 몇 번 죽고 사당 입구로 쫓겨나면 아이는 그만둔다.
function failTo(seg, msg) {
  noteMsg = `💫 ${msg}`; noteT = 1.6;
  roomActor.setAt(0, seg.z1 - 1.4, -1);
}
const segOf = (id) => room.dungeon.rectOf(id);

function enterShrine(shrine) {
  room = roomFor(shrine);
  lastSeg = null;
  // 깬 사당 수가 곧 난이도다. 방을 짓는 시점이 아니라 **들어갈 때마다** 매긴다 —
  // 방은 한 번 짓고 캐시하므로 짓는 시점에 매기면 첫 방문의 난이도로 굳는다.
  // 여섯을 다 깨면 clearedCount가 6이 되는데, 그대로 쓰면 별 문자열이
  // repeat(-1)로 터진다. 단계는 0~5로 묶는다.
  const tier = Math.min(5, shrines.clearedCount());
  room.applyTier(tier);
  // 이미 깬 사당은 그대로 둔다 — 지나온 곳을 다시 잠그지 않는다.
  // 아직 못 깬 사당만 처음으로 되돌린다(중간에 나갔다 온 경우).
  if (!shrine.cleared) room.restart();
  roomActor.rects = room.dungeon.rects;
  roomActor.obstacles = room.obstacles;
  roomActor.slip = 0;                  // 얼음 방에서 나가다 만 상태가 다음 사당에 묻지 않게
  cleared = shrine.cleared;
  savedPlanet.pos.copy(player.position);
  savedPlanet.heading.copy(player.heading);
  activeShrine = shrine;
  mode = 'room';
  engine.scene.remove(player.mesh);
  contact.visible = false;
  room.scene.add(player.mesh);
  roomActor.setAt(0, ENTRY_Z, -1);
  engine.setScene(room.scene);
  // 들어서면 어디에 왔는지 3초간 알린다. 사당마다 다른 곳이라는 게 첫 정보여야 한다.
  noteMsg = `⛩ ${room.spec.name} — ${room.spec.unit} · 난이도 ${'★'.repeat(tier + 1)}${'☆'.repeat(5 - tier)} (${tier + 1}/6)`;
  noteT = 3.4;
  setPrompt(null);
}

function exitShrine() {
  // 구슬을 주울 때 이미 기록했다. 여긴 그물 — markCleared는 두 번 불려도 아무 일도 안 한다.
  if (cleared) shrines.markCleared(activeShrine);
  mode = 'planet';
  if (room) room.scene.remove(player.mesh);
  engine.setScene(planetScene);
  engine.scene.add(player.mesh);
  contact.visible = true;
  player.position.copy(savedPlanet.pos);
  player.heading.copy(savedPlanet.heading);
  player._initFrame(); player.syncMesh();
  engine.camFwd.copy(player.heading); engine.camUp.copy(player.up);
  engine._camPlaced = false;
  activeShrine = null;
  setPrompt(null);
}

// 구슬을 주운 순간 — 지킴이가 말하고, 수첩 한 줄이 채워지고, 다음 갈 곳이 나온다.
// 마지막 사당이면 여기서 이야기가 끝난다.
function onOrb() {
  const id = room.spec.id;
  const k = KEEPERS[id];
  const last = shrines.clearedCount() >= shrines.shrines.length;  // 이미 이번 것까지 세어져 있다
  dialogue.play(`orb-${id}`, k.who, k.orb, () => {
    notebook.draw();
    if (!last) {
      // 아직 남았으면 다음 갈 곳을 한마디. 이름도 방향도 대지 않는다.
      const b = beckonNearest(savedPlanet.pos);
      if (b) dialogue.play(`next-${id}`, k.who, b);
      else noteMsg = '✨ 수첩 한 줄이 채워졌어요 — 밖으로 나가요', noteT = 2.6;
    } else {
      // 여섯째 — 반전과 엔딩. 세 뭉치를 이어 붙인다.
      const chain = (i) => {
        if (i >= ENDING.length) { noteMsg = '✨ 수첩을 다 채웠어요'; noteT = 3.0; return; }
        const [eid, who, lines] = ENDING[i];
        dialogue.play(eid, who, lines, () => chain(i + 1));
      };
      chain(0);
    }
  });
  if (!dialogue.active) { noteMsg = '✨ 지혜의 구슬을 얻었어요 — 밖으로 나가요'; noteT = 2.6; }
}

// 실내 받침등 — 주인공이 실루엣이 되지 않을 만큼만.
//
// ★ 아트 바이블 §2는 **고정 조명**이다. 따라다니는 불은 그 예외고, 예외인 이유를
//   적어 둔다. 사당은 어두운 게 의도다(그림자 사당은 lamp 0.3이라 거의 깜깜하다).
//   그런데 어두운 것과 **내 캐릭터가 안 보이는 것**은 다른 문제다. 렌더 타깃에서
//   재 보니 사당 안 캐릭터가 화면 밝기 55/255였다 — 옷 색도 모자 색도 안 읽힌다.
//   그래서 방을 밝히지 않고 **캐릭터만** 받친다: 사거리 4.2u, 감쇠 2.0이라
//   1u만 벗어나도 없는 것과 같고 바닥에 빛웅덩이가 생기지 않는다.
//   메시의 로컬 −Z가 뒤쪽이고 카메라는 늘 뒤에 있으므로, 보이는 면이 밝아진다.
const fill = new THREE.PointLight(0xffe9cf, 0, 4.2, 2.0);
fill.position.set(0, 1.7, -1.3);
player.mesh.add(fill);
const FILL_ROOM = 2.8, FILL_LAB = 1.8;   // 연구실은 갓등 셋이 이미 밝다

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
  // 사당 안에서도 E 버튼이 필요하다. 바깥 갱신에만 걸면 실내에서 안 돈다.
  touch.update();
  const intent = input.poll();
  // 대사창이 열려 있으면 E는 **여기서** 대사창으로 간다. 키보드든 터치 버튼이든
  // 같은 신호를 쓰므로 한쪽만 되는 일이 없다.
  // ★ 쓴 신호는 반드시 지운다. 마지막 줄을 넘기면 대사가 닫히는데, 지우지 않으면
  //   같은 E가 아래로 흘러 상호작용까지 한다 — 그게 바로 피하려던
  //   "넘기려다 뭘 집었다"다.
  if (dialogue.active && intent.action) { dialogue.next(); intent.action = false; }
  // 밖에서는 해가 있다. 받침등은 실내에서만 켠다.
  fill.intensity = mode === 'planet' ? 0 : (mode === 'lab' ? FILL_LAB : FILL_ROOM);
  if (mode === 'lab') { stepLab(dt, intent); return; }
  if (mode === 'room') { stepRoom(dt, intent); return; }
  stepPlanet(dt, intent);
}

// ── 지하 연구실 ──────────────────────────────────────────────────────────────
// 사당 실내와 같은 걸음(RoomActor)을 쓴다. 여긴 관문이 없고 만질 것이 셋뿐이다 —
// 소포 · 다이얼 셋 · 포탈. 그 셋이 곧 걷기·E·N 연습이다.
function stepLab(dt, intent) {
  roomActor.update(dt, intent, engine.camera);
  roomActor.updateCamera(engine.camera, input, dt);
  lab.update(dt);

  let prompt = lab.prompt(roomActor.position);
  if (noteT > 0) { noteT -= dt; prompt = noteMsg; }
  setPrompt(prompt);

  // 계단 앞에 처음 서면 왜 안 올라가는지 한 번 말한다. play가 id로 한 번만 건다.
  if (lab.nearStairs(roomActor.position)) dialogue.play('op-stairs', ...OPENING.stairs);

  // ★ 수첩 내용을 대사로 요약해 주지 않는다. **직접 펴 본 뒤에** 감상만 붙인다 —
  //   읽는 건 아이가 한다. 수첩이 열려 있는 동안은 대사창이 그 아래 깔리므로
  //   (수첩 z 40, 대사창 z 35) 닫은 다음에 건다.
  if (notebook.has && notebook.isOpen) sawNote = true;
  if (sawNote && !notebook.isOpen && !lab.state.read) {
    lab.markRead();
    dialogue.play('op-read', ...OPENING.read);
  }

  if (!intent.action || dialogue.active) return;
  const did = lab.interact(roomActor.position);
  if (did === 'parcel') {
    notebook.setHas(true); refreshHint();
    dialogue.play('op-parcel', ...OPENING.parcel);
    // 프롬프트로 상주시키면 방의 95%에서 같은 문구가 뜬다(감사에서 확인).
    // 한 번, 잠깐 알리고 사라진다.
    // 키 이름은 아래 안내줄이 갖는다 — 터치 기기엔 N이 없고 📓 버튼이 있다.
    noteMsg = `📓 ${touch.visible ? '' : 'N — '}수첩을 펴 보자`; noteT = 4.5;
  } else if (did === 'solved') {
    dialogue.play('op-solved', ...OPENING.solved);
  } else if (did === 'go') {
    landOnPlanet();
  }
}

// 연구실 → 별. 첫 번째만 대사가 붙고, 그 뒤로는 그냥 오간다.
function landOnPlanet() {
  mode = 'planet';
  lab.scene.remove(player.mesh);
  engine.setScene(planetScene);
  engine.scene.add(player.mesh);
  contact.visible = true;
  player.position.copy(landing.pos);
  planet.projectToSurface(player.position);
  player._initFrame(); player.syncMesh();
  engine.camFwd.copy(player.heading); engine.camUp.copy(player.up);
  engine._camPlaced = false;
  mapPage.setHas(true); refreshHint();
  setPrompt(null);
  dialogue.play('op-arrive', ...OPENING.arrive);
}

// ★ 검사용 — A·B·C·E는 **행성 위에서만** 뜻이 있다.
//   __selftest의 runStraight는 step()을 부르는데, step()은 이제 mode를 보고
//   갈린다. 연구실에서 부르면 stepLab으로 가서 플레이어가 한 발짝도 안 움직이고,
//   그러면 "표면 밀착 편차 0.00e+0 · 대원 복귀 0.00"이 찍힌다.
//   **통과가 아니라 아무것도 안 잰 것이다.** 아무것도 안 재고 초록불이 켜지는
//   검사는 없는 것보다 나쁘다 — 진짜로 깨졌을 때도 초록불이니까.
function withPlanetMode(fn) {
  if (mode === 'planet') return fn();
  const was = mode, wasParent = player.mesh.parent;
  const pos = player.position.clone(), head = player.heading.clone();
  if (wasParent) wasParent.remove(player.mesh);
  planetScene.add(player.mesh);
  engine.setScene(planetScene);
  mode = 'planet';
  try { return fn(); } finally {
    mode = was;
    planetScene.remove(player.mesh);
    if (wasParent) wasParent.add(player.mesh);
    engine.setScene(was === 'lab' ? lab.scene : (room ? room.scene : planetScene));
    player.position.copy(pos); player.heading.copy(head);
    player._initFrame(); player.syncMesh();
  }
}

// 별 → 연구실. 베이스캠프로 돌아간다.
function returnToLab() {
  mode = 'lab';
  engine.scene.remove(player.mesh);
  contact.visible = false;
  lab.scene.add(player.mesh);
  roomActor.rects = lab.rects;
  roomActor.obstacles = lab.obstacles;
  roomActor.slip = 0;
  roomActor.setAt(lab.CIRCLE.x, lab.CIRCLE.z + 2.6, 1);   // 포탈에서 방을 보고 선다
  engine.setScene(lab.scene);
  setPrompt(null);
  dialogue.play('op-home', ...OPENING.home);
}

// 실내 — 관문 셋을 지나 신전으로. 통로 끝을 넘어서면 밖으로 나간다.
function stepRoom(dt, intent) {
  roomActor.update(dt, intent, engine.camera);
  roomActor.updateCamera(engine.camera, input, dt);

  // 카메라와 나 사이에 낀 판(닫힌 문·가림막)은 흐린다. 카메라를 가두는 대신이다.
  if (room.fadeVeils) room.fadeVeils(engine.camera.position.z, roomActor.position.z, dt);

  const { dungeon, gates, final, prize } = room;
  const seg = dungeon.segmentAt(roomActor.position.z);
  let prompt = null;

  // 새 방에 들어서면 목표를 한 번 알린다. 놓칠 수 없게 —
  // 벽의 판은 언제든 다시 읽을 수 있지만, 처음 한 번은 눈앞에 띄워야 한다.
  if (seg && seg.id !== lastSeg) {
    lastSeg = seg.id;
    const goal = room.goals[seg.id];
    if (seg.id === 'shrine') {
      const k = KEEPERS[room.spec.id];
      dialogue.play(`arrive-${room.spec.id}`, k.who, k.arrive);
    }
    if (goal) { noteMsg = `📜 ${seg.name} — ${goal}`; noteT = 3.6; }
  }

  // 관문 — 자기 구간에 있을 때만 돈다. 레이저는 방 밖에서도 움직여야 자연스럽지만
  // 판정은 방 안에서만 한다(통로에서 맞으면 부당하다).
  for (const g of gates) {
    const inSeg = seg && seg.id === g.room;
    const r = g.gate.update(dt, roomActor) || {};
    // 헤맨 시간 — 자기 방에 있고 아직 못 풀었으면 쌓인다.
    // 실패는 8초어치로 친다. 가만히 서 있는 것과 부딪히며 애쓰는 것은 다르다.
    if (inSeg && !g.solved) {
      const got = room.nudge(g.room, dt + (r.fail ? 8 : 0));
      if (got) { noteMsg = `💡 힌트가 켜졌어요 — 오른쪽 벽`; noteT = 2.6; }
    }
    if (inSeg && r.fail) {
      // 스스로 자리를 옮기는 관문(타일은 갇혀 있어 되돌릴 곳이 없다)은 그대로 둔다.
      // 나머지는 방 처음으로 보낸다 — 사당 처음이 아니다.
      if (r.stay) { noteMsg = `💫 ${r.fail}`; noteT = 1.6; }
      else failTo(segOf(g.room), r.fail);
    }
    if (!g.solved && g.gate.solvedBy(roomActor)) {
      g.solved = true;
      dungeon.openDoor(g.room);
    }
    if (inSeg && g.gate.prompt) prompt = g.gate.prompt(roomActor.position) || prompt;
  }

  // 신전 — 사당마다 다른 물건이 서 있다(저울·거울의 신…). 계약은 관문과 같다.
  final.update(dt, roomActor, room.scene);
  if (seg && seg.id === 'shrine' && !final.solvedBy(roomActor)) {
    const got = room.nudge('shrine', dt);
    if (got) { noteMsg = '💡 힌트가 켜졌어요 — 오른쪽 벽'; noteT = 2.6; }
  }
  if (final.solvedBy(roomActor)) prize.reveal();
  prize.update(dt);
  if (seg && seg.id === 'shrine') {
    // 구슬이 나와 있으면 그게 최우선이다 — 방에서 가장 밝은 곳이 곧 다음 할 일이다.
    prompt = prize.prompt(roomActor.position) || final.prompt(roomActor.position) || prompt;
  }

  // 알림이 떠 있으면 그게 우선이다
  if (noteT > 0) { noteT -= dt; prompt = noteMsg; }
  const atExit = roomActor.position.z > EXIT_Z - 0.9;
  if (atExit) prompt = 'E — 사당 밖으로';
  setPrompt(prompt);

  // 대사창이 열려 있으면 E는 대사창 것이다. 넘기려다 뭘 집으면
  // 그건 조작을 뺏는 것보다 나쁘다.
  if (intent.action && !dialogue.active) {
    if (atExit) { exitShrine(); return; }
    if (seg && seg.id === 'shrine') {
      if (prize.interact(roomActor.position)) {
        cleared = true;
        // ★ 여기서 바로 기록한다. 나갈 때 기록하면 두 군데가 어긋난다 —
        //   지킴이는 "수첩에 적어 두고"라고 말하는데 그 자리에서 수첩을 열면
        //   아직 비어 있고, 다음 갈 곳을 알려주는 beckonNearest는 **지금 서 있는
        //   이 사당**을 가장 가깝다고 짚는다. 둘 다 "아직 안 깬 것"으로 보기 때문이다.
        shrines.markCleared(activeShrine);
        onOrb();
      } else if (final.interact) final.interact(roomActor.position);
    } else {
      // 손으로 만지는 관문은 자기 방 안에서만 반응한다
      const g = gates.find((x) => seg && x.room === seg.id);
      if (g && g.gate.interact) g.gate.interact(roomActor.position);
    }
  }
}

function stepPlanet(dt, intent) {
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

  // 사당 진입 — 기단 가까이 오면 프롬프트, E로 들어간다.
  const near = shrines.nearest(player.position);
  // ★ 예전엔 그냥 'E — 사당에 들어가기'였다. 사당 여섯이 서로 다른데 이름이
  //   어디에도 안 나와서, 가장 가까운 곳만 반복해 들어가면 "다 똑같다"로 읽힌다.
  //   무엇이 있는 곳인지 들어가기 전에 말해 준다.
  mapPage.update();
  landing.update(dt);
  // 내림판 — 사당보다 먼저 본다. 판 위에 사당이 겹칠 일은 없지만(사당 자리를 먼저 잡고
  // 그 밖에 스폰한다) 겹치면 **돌아갈 길이 막히는 쪽**이 더 나쁘다.
  if (landing.near(player.position)) {
    setPrompt('E — 연구실로 돌아가기');
    if (intent.action && !dialogue.active) returnToLab();
    return;
  }
  const atDoor = near.shrine && near.distU < shrines.ENTER_R;
  // ★ layouts에 locked: 5라고 적어 놓고 **아무도 확인하지 않았다.**
  //   마지막 사당은 앞선 다섯의 구슬이 열쇠라는 게 그 방의 전제인데,
  //   처음부터 곧장 들어갈 수 있었다. 적어 둔 규칙은 지켜져야 규칙이다.
  let canEnter = atDoor;
  if (atDoor) {
    const sp = SHRINES[shrines.shrines.indexOf(near.shrine) % SHRINES.length];
    const need = sp.locked || 0;
    const have = shrines.clearedCount();
    if (need && have < need) {
      canEnter = false;
      setPrompt(`🔒 ${sp.name} — 구슬 ${need}개가 필요해요 (${have}/${need})`);
    } else if (!near.shrine.cleared && !dialogue.hasSeen(`enter-${sp.id}`)) {
      // 지킴이의 첫마디. 들어가기 전에 한 번만.
      dialogue.play(`enter-${sp.id}`, KEEPERS[sp.id].who, KEEPERS[sp.id].enter);
      setPrompt(`E — ${sp.name}에 들어가기 (${sp.unit})`);
    } else if (near.shrine.cleared) {
      setPrompt(`E — ${sp.name} · 이미 깬 곳이에요`);
    } else {
      setPrompt(`E — ${sp.name}에 들어가기 (${sp.unit})`);
    }
  } else setPrompt(null);
  if (canEnter && intent.action && !dialogue.active) enterShrine(near.shrine);
}

// 지도 — 처음엔 온통 검고, 걸어간 자리만 밝아진다. 길을 알려주는 게 아니라
// 다녀온 것을 기록한다(M으로 연다).
const mapPage = buildMapPage(planet, player, shrines, SHRINES);
// 터치 조작 — 터치 기기에서만 나타난다. 이게 없으면 모바일에서는 걷기만 되고
// 사당에 들어갈 수조차 없다(점검에서 확인).
// notebook은 아래에서 만들어지므로 게터로 넘긴다 — 순서를 바꾸면 mapPage가 꼬인다.
const touch = buildTouchControls(input, mapPage, () => notebook);
// 대사창과 탐사 수첩. 사당이 왜 있는지를 이 둘이 말한다.
const dialogue = buildDialogue(input);
const notebook = buildNotebook(shrines, SHRINES);

touch.onShow(refreshHint);
refreshHint();

// 지하 연구실과, 별 위의 같은 자리. 이 둘이 포탈의 양 끝이다.
const lab = buildLab();
const landing = buildLanding(planetScene, planet, landingDir);

// 가장 가까운 **안 깬** 사당이 어떤 곳인지 한마디로. 이름도 방향도 대지 않는다 —
// 화살표를 띄우면 이 게임은 문제가 아니라 심부름이 된다.
function beckonNearest(from) {
  let best = null, bd = Infinity;
  const up = from.clone().normalize();
  shrines.shrines.forEach((s, i) => {
    if (s.cleared) return;
    const d = up.angleTo(s.dir);
    if (d < bd) { bd = d; best = SHRINES[i % SHRINES.length]; }
  });
  return best ? nextHint(KEEPERS[best.id].beckon) : null;
}

const loop = new Loop(step, () => engine.render());

const game = {
  step, planet, player, engine, input, loop, sky, scatter, carpet, shrines, contact,
  roomActor, planetScene, roomFor, SHRINES, mapPage, touch, dialogue, notebook,
  get room() { return room; },
  lab, landing, landOnPlanet, returnToLab,
  get cleared() { return cleared; },
  get mode() { return mode; },
  enterShrine, exitShrine,
};
window.game = game;
installDebug({ planet, player, engine, input, step, sky, scatter, carpet, shrines, PEAKS,
  roomActor, roomFor, withPlanetMode, lab });

// ── 시작 — 별이 아니라 **집**에서 ────────────────────────────────────────────
// 아이를 낯선 행성 위에 아무 말 없이 떨어뜨리지 않는다(Lab.js 머리말).
engine.scene.remove(player.mesh);
contact.visible = false;
lab.scene.add(player.mesh);
roomActor.rects = lab.rects;
roomActor.obstacles = lab.obstacles;
roomActor.setAt(0, lab.ENTRY_Z, -1);
engine.setScene(lab.scene);
dialogue.play('op-wake', ...OPENING.wake);

const load = document.getElementById('load');
if (load) load.style.display = 'none';
loop.start();
console.log(`[boot] 재설계 v2 — 봉우리 ${PEAKS.length} · 지형면 ${planet.mesh.geometry.attributes.position.count / 3}`
  + ` · 산포 ${scatter.meshes.length}메시 · 사당 ${shrines.shrines.length} · __dbg/__selftest`);
