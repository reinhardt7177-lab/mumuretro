// 진입점 — 행성·플레이어·입력·엔진·루프를 연결하고 시스템을 조립한다.
//
// 여기 있어야 할 것은 **조립**뿐이다. 화면을 그리는 코드(ui/), 게임에 기여하지 않는
// 검증 코드(debug/)가 섞이면 "이 파일이 무슨 파일인지"가 흐려지고,
// 기능을 하나 붙일 때마다 이 파일만 커진다(실제로 1,197줄까지 갔다).
//   ui/Screens.js   전면 화면 — 요약·인트로·엔딩
//   ui/Shell.js     버튼 배선 — 무엇을 누르면 무엇이 열리나
//   debug/introspect.js  window.__dbg / __selftest
import { Planet, R, SCALE, TERRAIN } from './world/Planet.js';
import * as THREE from 'three';
import { Player } from './entities/Player.js';
import { Input } from './core/Input.js';
import { Engine } from './core/Engine.js';
import { Loop } from './core/Loop.js';
import { Atmosphere } from './world/Atmosphere.js';
import { Sky } from './world/Sky.js';
import { Post } from './rendering/Post.js';
import { buildTown } from './world/TownGenerator.js';
import { Navigation } from './systems/Navigation.js';
import { Codex } from './systems/Codex.js';
import { RECIPIENT_NAMES } from './data/parcels.js';
import { chime, pickup, resumeAudio, startBGM, toggleBGM, isBGMOn, footstep } from './core/Audio.js';
import { EmojiLayer } from './entities/EmojiBubble.js';
import { Townsfolk, TOWN_COLORS } from './entities/Townsfolk.js';
import { GhostMessenger } from './entities/GhostMessenger.js';
import { Dokkaebi } from './entities/Dokkaebi.js';
import { MIST_ZONE } from './data/regions.js';
import { LocalGhostSource } from './systems/PresenceSource.js';
import { Customizer } from './systems/Customizer.js';
import { makeRNG } from './util/math.js';
import { loadGLB, prepModel } from './core/Assets.js';
import { HERO_ASSETS } from './data/healingAssets.js';
import { PROP_BUILDERS } from './world/Props.js';
import { reserveSpot, localToSurface } from './world/Districts.js';
import { regionAt } from './data/regions.js';
import { LearningSystem } from './systems/Learning.js';
import { CURRICULA, byRegion, DEFAULT_CURRICULUM } from './data/curriculum/index.js';
import { Badges } from './systems/Badges.js';
import { Abilities, ABILITIES } from './systems/Abilities.js';
import { Trials, TRIAL_STREAK } from './systems/Trials.js';
import { Story, INTRO, ENDING } from './systems/Story.js';
import { Quest } from './systems/Quest.js';
import { signTexture } from './systems/Learning.js';
import { parcelKindFor } from './data/story.js';
import { createScreens } from './ui/Screens.js';
import { wireShell } from './ui/Shell.js';
import { installDebug } from './debug/introspect.js';

const canvas = document.getElementById('c');
const engine = new Engine(canvas, R);
const planet = new Planet(engine.scene);
// 하루 15분. 5분이던 때는 20분 세션에 밤낮이 네 번 돌았고, 평균 화면 휘도가
// 한낮 0.52 ↔ 밤 0.15로 3.6배씩 출렁여 눈이 계속 재적응해야 했다(실측).
// 팻말이 배경에 묻히는 노을 구간도 그만큼 자주 왔다.
const atmosphere = new Atmosphere(engine, { dayLength: 900, phase: 0.28 });
engine.attachPost(new Post(engine.renderer, engine.scene, engine.camera, engine.outline));
const sky = new Sky(engine, planet);
atmosphere.setSky(sky);                     // 하늘도 같은 시간대 키프레임으로 구동
const world = buildTown(engine.scene, planet, 7);
const player = new Player(planet);
player.setLatLon(15, -4);   // 골목 주택가(우체통 허브) 근처에서 시작(아래에서 탑 밖으로 밀어냄)
engine.scene.add(player.mesh);
const customizer = new Customizer(player);   // 저장된 로드아웃 로드 + 적용

const input = new Input(canvas);
// 카메라 접선 프레임을 플레이어 시작 자세로 초기화
engine.camFwd.copy(player.heading); engine.camUp.copy(player.up); engine._inited = true;

// ── 배달 시스템(M2) ──
// 배치된 집들 중 멀리 흩어진 ~12곳을 수령인으로 선정(farthest-point 샘플링) → 동네 곳곳에 골고루.
function pickRecipients(placed, count) {
  const houses = placed.filter(p => p.key === 'house');
  if (!houses.length) return [];
  const chosen = [houses[0]];
  while (chosen.length < Math.min(count, houses.length)) {
    let best = null, bd = -1;
    for (const h of houses) {
      if (chosen.includes(h)) continue;
      let md = Infinity;
      for (const c of chosen) { const d = h.pos.angleTo(c.pos); if (d < md) md = d; }
      if (md > bd) { bd = md; best = h; }
    }
    if (!best) break;
    chosen.push(best);
  }
  return chosen.map((h, i) => ({ id: 'r' + i, name: RECIPIENT_NAMES[i % RECIPIENT_NAMES.length], pos: h.pos.clone(), dir: h.dir.clone() }));
}
// 행성이 커지면 집도 늘어난다 → 수령인도 늘려야 assignNearest가 잡는 다음 목적지가 지나치게 멀어지지 않는다.
// 상한은 이름 풀 크기(RECIPIENT_NAMES). 넘기면 이름이 중복된다.
const recipients = pickRecipients(world.placed, Math.min(RECIPIENT_NAMES.length, 12 * SCALE));

// ── NPC + 프레즌스 + 이모지(M3) ──
const emoji = new EmojiLayer(engine.scene, 28);
const npcRng = makeRNG(123);
// 각 수령인 집에 주민 1명 배치(배달 시 감사 이모지). + 동네 곳곳 산발 주민.
const townsfolk = [];
recipients.forEach((r, i) => {
  const t = new Townsfolk(planet, r.pos, TOWN_COLORS[i % TOWN_COLORS.length], npcRng);
  engine.scene.add(t.mesh); r.npc = t; townsfolk.push(t);
});
// 산발 주민은 월드 장식이므로 표면적(∝SCALE²)에 비례해야 동네 밀도가 유지된다.
const SCATTER_NPC = 8 * SCALE * SCALE;
for (let i = 0; i < SCATTER_NPC; i++) {
  const h = world.placed[Math.floor(npcRng() * world.placed.length)];
  const t = new Townsfolk(planet, (h ? h.pos : planet.latLonToPos(npcRng() * 180 - 90, npcRng() * 360)), TOWN_COLORS[i % TOWN_COLORS.length], npcRng);
  engine.scene.add(t.mesh); townsfolk.push(t);
}
// 유령 메신저(가짜 다른 플레이어) — PresenceSource seam. 넓어진 만큼 늘리되 인원수는 체감 위주로 선형만.
const presence = new LocalGhostSource(planet, 8 * SCALE, 42);
const ghosts = new Map();
for (const a of presence.getRemoteActors()) {
  const gm = new GhostMessenger(planet, a.name);
  gm.position.copy(a.position); gm.heading.copy(a.heading); gm._initFrame(); gm.syncMesh();
  engine.scene.add(gm.mesh); ghosts.set(a.id, gm);
}
// 수평선 컬링 대상 액터(프롭과 동일 방식, 위치가 매 프레임 바뀌므로 position 사용)
const actors = [...townsfolk, ...ghosts.values()];

// 도감 = "익힌 문제 기록". 등록된 모든 과목의 문제를 담으므로
// 커리큘럼 파일을 추가하면 도감 총량이 저절로 늘어난다.
const codex = new Codex(
  CURRICULA.flatMap(c => c.questions.map(q => ({
    id: q.id, name: q.q, parcel: { icon: c.emoji || '⭕', kind: q.a },
  }))),
  'mumu_codex_learn_v1');
const nav = new Navigation(engine.scene, planet);

// HUD 참조 + 헬퍼
const parcelEl = document.getElementById('parcel');
const deliverEl = document.getElementById('deliver');
const toastsEl = document.getElementById('toasts');
const codexCountEl = document.getElementById('codexCount');
// cls='story'면 이야기 토스트(보라 + 이탤릭). 아이가 "문제"와 "이야기"를 색으로 구분하게 한다.
function toast(msg, ms = 2200, cls = '') {
  if (!toastsEl) return;
  const t = document.createElement('div'); t.className = 'toast' + (cls ? ' ' + cls : ''); t.textContent = msg;
  toastsEl.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}
function updateCodexCount() { if (codexCountEl) codexCountEl.textContent = `${codex.count()}/${codex.total()}`; }

// 문제 안내 배너 — 새 문제마다 크게 띄운다.
// 좌상단 작은 HUD만으로는 4학년이 "무엇을 해야 하는지" 못 알아챈다.
const qBannerEl = document.getElementById('qBanner');
let _qBannerT = 0;
function showQuestionBanner(q, cur, labels) {
  if (!qBannerEl) return;
  const n = labels ? labels.length : 4;
  document.getElementById('qSub').textContent = `${cur.emoji} ${cur.subject}`;
  document.getElementById('qText').textContent = q.q;
  document.getElementById('qHow').innerHTML =
    `이 문제의 <b>답이 걸린 집</b>을 찾아가서<br>가까이 가면 <b>E</b>를 눌러 편지를 배달하세요 (팻말 ${n}개)`;
  qBannerEl.classList.add('show');
  _qBannerT = 4.5;
}
function updateQuestionBanner(dt) {
  if (_qBannerT > 0) { _qBannerT -= dt; if (_qBannerT <= 0 && qBannerEl) qBannerEl.classList.remove('show'); }
}

// 경사로 막혔을 때 안내. 말없이 멈추면 "맵이 고장났나?"로 읽힌다.
// 자주 뜨면 시끄러우니 넉넉히 쿨다운을 둔다.
let _slopeMsgCD = 0;
function updateSlopeHint(dt) {
  if (_slopeMsgCD > 0) _slopeMsgCD -= dt;
  if (!player.blockedBySlope) return;
  player.blockedBySlope = false;
  if (_slopeMsgCD > 0) return;
  _slopeMsgCD = 14;
  toast(player.canClimb
    ? '너무 가팔라요! 다른 길로 돌아가 볼까요? (M: 지도)'
    : '너무 가팔라요! 🧗 벽 오르기를 배우면 오를 수 있어요 (M: 지도·할 일)', 3600);
}

// 건물에 막혔을 때. 막아 놓고 아무 말이 없으면 "게임이 고장났나?"가 된다.
// 경사 안내보다 훨씬 드물게(60초) — 마을에서는 계속 부딪히므로 잦으면 잔소리가 된다.
let _propMsgCD = 0;
function updatePropHint(dt) {
  if (_propMsgCD > 0) _propMsgCD -= dt;
  if (!player.blockedByProp) return;
  player.blockedByProp = false;
  if (_propMsgCD > 0) return;
  _propMsgCD = 60;
  toast('건물 안으로는 못 들어가요. 대문 앞에서 E를 눌러 배달해요', 3400);
}

// 힌트 HUD — 오답 후 계속 남아 있다. 토스트만 쓰면 놓친 아이가 다시 볼 방법이 없다.
const hintBtnEl = document.getElementById('hintBtn');
function setHint(text) {
  if (!hintBtnEl) return;
  if (!text) { hintBtnEl.classList.remove('show'); hintBtnEl.textContent = ''; return; }
  hintBtnEl.textContent = `💡 ${text}`;
  hintBtnEl.classList.add('show');
}
// ── 서사(M9) ─────────────────────────────────────────────────────────────
// 옛 집배원들이 편지를 다 전하지 못한 채 안개 골짜기에 남았다는 설정으로
// 이미 있는 시스템(유령·시련소·능력·골짜기·도깨비)을 하나로 꿴다. 새 시스템은 만들지 않는다.
const story = new Story({
  toast, planet, scene: engine.scene, makeSign: signTexture,
});

// ── 능력 해금(M8) ────────────────────────────────────────────────────────
// 경사 제한이 먼저 있어야 "못 가는 곳"이 생기고, 그래야 벽 오르기가 능력이 된다.
const MAX_CLIMB_DEG = 32;
player.maxClimbTan = Math.tan(MAX_CLIMB_DEG * Math.PI / 180);

const abilities = new Abilities({
  onUnlock: (a) => toast(`${a.emoji} 새 능력 — ${a.name}! ${a.desc}`, 4000),
});
function applyAbilities() {
  player.maxJumps = abilities.has('doubleJump') ? 2 : 1;
  player.jumpsLeft = Math.min(player.jumpsLeft, player.maxJumps);
  player.canClimb = abilities.has('wallClimb');
  player.canGlide = abilities.has('glide');
}
applyAbilities();

// ── 배지 + 세션(M7) ──────────────────────────────────────────────────────
const DAILY_GOAL = 5;                       // 이만큼 맞히면 세션 요약이 뜬다
// 이번 세션(새로고침 단위) 기록. 요약 화면 재료.
const session = { correct: 0, wrong: 0, comebacks: 0, newBadges: [], goalShown: false };
const badges = new Badges({
  // 어느 경로로 수여되든(정답·구역 발견·점프·정상 등정) 여기서 한 번에 세션에 담는다.
  // 개별 호출부에서 반환값을 챙기면 빠뜨리기 쉽다(실제로 '오늘의 목표' 배지가 빠졌었다).
  onEarn: (b) => { session.newBadges.push(b); toast(`${b.emoji} 배지 획득 — ${b.name}!`, 3000); },
});

// ── 학습 모드(M7) ────────────────────────────────────────────────────────
// 팻말을 걸 집은 수령인 16명이 아니라 "건물 전체"를 쓴다.
// 수령인은 행성 전체에 최원점 샘플링으로 흩어져 있어 반경 30u(지평선) 안에 4채가 모이지 않는다.
// 그러면 팻말을 읽지 못한 채 찍기가 되므로 학습이 성립하지 않는다.
const HOUSE_KEYS = new Set(['house', 'cornerShop', 'stationery', 'bathhouse', 'cabin', 'barn', 'post_office', 'schoolFacade']);
const answerHouses = world.placed
  .filter(p => HOUSE_KEYS.has(p.key))
  .map((p, i) => {
    // 수령인 집이면 주민을 붙여 정답 시 고마워하는 연출을 살린다.
    // 수령인이 아닌 집도 이름을 준다 — 한 줄로 모든 배달이 이름 있는 사람에게 간다.
    const r = recipients.find(x => x.pos.distanceToSquared(p.pos) < 0.01);
    return {
      id: 'h' + i,
      name: r ? r.name : RECIPIENT_NAMES[i % RECIPIENT_NAMES.length],
      pos: p.pos, dir: p.dir, npc: r ? r.npc : null,
    };
  });

const learning = new LearningSystem(engine.scene, planet, answerHouses, CURRICULA, {
  range: 5,
  initial: byRegion(regionAt(player.position, world.anchors).id) || DEFAULT_CURRICULUM,
  onQuestion: (q, labels, cur) => {
    // 문제 앞에는 아이콘 한 글자만. 플레이버 텍스트를 붙이면 그게 곧 읽기 부담이다.
    const kind = parcelKindFor(q.id);
    if (parcelEl) parcelEl.innerHTML =
      `${kind.icon} <b>${q.q}</b> <span style="opacity:.7">— ${cur.subject}</span>`;
    setHint(null);   // 새 문제 → 힌트 감춤(처음부터 주면 생각을 건너뛴다)
    showQuestionBanner(q, cur, labels);
  },
  onResult: (res) => {
    // 배지 갱신 — 오답이었던 문제를 맞히면 comeback으로 잡힌다.
    const bres = badges.onAnswer(res.question.id, res.correct);   // 배지는 onEarn에서 세션에 담긴다
    const tres = trials.onAnswer(res.correct);                    // 시련 진행(진행 중일 때만)
    if (tres && tres.reset) toast(`아쉬워요! 시련 연속이 0으로 — 다시 ${TRIAL_STREAK}문제`, 2600);
    if (res.correct) {
      session.correct++;
      if (bres.comeback) session.comebacks++;
      chime();
      codex.add(res.question.id); updateCodexCount();
      // 정답/문제 확인은 학습적으로 중요하므로 형식을 유지하고 수령인만 뒤에 붙인다.
      const who = res.label.house.name;
      toast(bres.comeback
        ? `💪 이 편지, 드디어 전했어요! ${res.question.q} = ${res.question.a}`
        : `⭕ 정답! ${res.question.q} = ${res.question.a} · ${who}께 전했어요`, 2600);
      if (res.label.house.npc) res.label.house.npc.thank(emoji);
      emoji.spawn(player.position, player.up,
        bres.comeback ? '💪' : parcelKindFor(res.question.id).icon, { size: 1.6, life: 2.2 });
      // 하루 목표 달성 → 세션 요약(한 판을 마무리하는 순간)
      if (!session.goalShown && session.correct >= DAILY_GOAL) {
        session.goalShown = true;
        badges.bumpStat('goalsMet', 1);
        setTimeout(showSummary, 900);   // 정답 연출이 끝난 뒤
      }
    } else {
      session.wrong++;
      // 벌점 없음 — 다시 찾으면 된다. 2회 틀리면 힌트(네비)가 열린다.
      pickup();
      emoji.spawn(player.position, player.up, '😅', { size: 1.3, life: 1.8 });
      // 힌트는 토스트로 한 번 보여주고, HUD에도 남긴다.
      // 3초짜리 토스트를 놓치면 영영 못 보는 건 4학년에게 가혹하다.
      setHint(res.question.hint);
      toast(res.wrongStreak >= 2
        ? `아니에요! 💡 ${res.question.hint} (길잡이를 켰어요)`
        : `아니에요! 다시 찾아볼까요? 💡 ${res.question.hint}`, 3000);
    }
  },
});

// ── 시련소(M8) ───────────────────────────────────────────────────────────
// 구역마다 하나. 힐링 포인트 자리를 쓰되 급경사는 피해 앉힌다.
// 시련소는 반드시 걸어서 닿을 수 있어야 한다. 힐링 포인트가 급경사에 걸리면
// 벽 오르기(시련 3개 필요) 없이는 접근이 막혀 진행이 멈춘다 —
// 실측에서 8곳 중 4곳이 그랬다. 주변에서 완만한 자리를 찾아 옮긴다.
const _tsTmp = new THREE.Vector3();
function findGentleSpot(pos, radius) {
  let best = pos.clone(), bestSlope = planet.slopeDegAt(_tsTmp.copy(pos).normalize());
  if (bestSlope <= 12) return best;
  const N = 28;
  for (let i = 0; i < N; i++) {
    const a = i * 2.399963;                      // 황금각 나선
    const r = radius * Math.sqrt((i + 1) / N);
    const cand = localToSurface(pos, Math.cos(a) * r, Math.sin(a) * r, planet);
    const s = planet.slopeDegAt(_tsTmp.copy(cand).normalize());
    if (s < bestSlope) { bestSlope = s; best = cand; }
    if (bestSlope <= 8) break;
  }
  return best;
}

const trialSpots = world.healingPoints.map(hp => {
  const a = world.anchors.find(x => x.id === hp.region);
  const pos = findGentleSpot(hp.pos.clone(), 20);
  planet.seatOnSurface(pos, 3.2);   // 넓어진 기단에 맞춰 접지 반경도 키운다
  return { regionId: hp.region, name: a ? a.name : hp.region, emoji: a ? a.emoji : '🗼', pos, dir: pos.clone().normalize() };
});

const trials = new Trials(engine.scene, planet, trialSpots, abilities, {
  onStart: (t) => {
    toast(`🗼 ${t.name} 시련 시작! ${TRIAL_STREAK}문제 연속으로 맞히세요`, 3200);
    chime();
  },
  onProgress: (a) => updateTrialHUD(a),
  onAbort: (a, why) => {
    updateTrialHUD(null);
    if (why === 'far') toast('시련소에서 멀어져 시련이 중단됐어요', 2600);
  },
  onClear: (t, fresh) => {
    updateTrialHUD(null);
    chime();
    emoji.spawn(player.position, player.up, '🏆', { size: 2.0, life: 3.0 });
    toast(`🏆 ${t.name} 시련 클리어! (시련소 ${abilities.clearedCount()}/${trialSpots.length})`, 3600);
    applyAbilities();
    updateTrialCount();
    badges.setStat('trialsCleared', abilities.clearedCount());

    // 잊혀진 우체국(안개 골짜기 8번째 탑) = 마지막 편지.
    // 도깨비에게서 이름 없는 편지를 되찾은 뒤여야 이야기가 성립한다.
    if (t.regionId === 'mist' && _dokkaebiCaught > 0) {
      _finalTarget = null;                       // 유도 화살표 해제
      badges.setStat('lastLetter', true);
      if (story.needsEnding()) setTimeout(showEnding, 1000);
    } else {
      story.onTrialClear(abilities.clearedCount());
    }
  },
});

// 시련 진행 표시 — HUD 우측에 ●●●○○
const trialHudEl = document.getElementById('trialHud');
function updateTrialHUD(a) {
  if (!trialHudEl) return;
  if (!a) { trialHudEl.classList.remove('show'); return; }
  trialHudEl.textContent = `🗼 시련 ${trials.streakDots}`;
  trialHudEl.classList.add('show');
}

// 상시로 보이는 유일한 카운터. 이 게임의 진행 축은 시련소 하나뿐이고,
// 우표(103)·배지(14)·Leitner 상자는 축이 아니라 그 축을 걷다 남는 기록이다.
// 셋을 다 상시로 띄웠더니 아이 눈에 진도 막대가 여섯 개였다.
const trialCountEl = document.getElementById('trialCount');
function updateTrialCount() {
  if (trialCountEl) trialCountEl.textContent = `🗼 ${abilities.clearedCount()}/${trialSpots.length}`;
}
updateTrialCount();

// ── 도깨비(M8) ───────────────────────────────────────────────────────────
// 안개 골짜기에 들어오면 나타나 편지를 훔쳐 달아난다. 잡아야 배달을 이어갈 수 있다.
// 전투가 아니라 술래잡기 — 달리기(Shift)로 따라붙고 점프로 지형을 질러가면 잡힌다.
const dokkaebi = new Dokkaebi(planet, {
  homeDir: planet.mistDir,
  homeAng: MIST_ZONE.rim * 0.78,
  speed: 5.6,
});
engine.scene.add(dokkaebi.mesh);
let _mistWasIn = false, _dokkaebiCaught = 0;

function updateDokkaebi(dt) {
  const inValley = planet.inMistValley(_dirOfPlayer());
  if (inValley && !_mistWasIn) {
    // 처음 들어옴 — 도깨비 등장
    const spawn = planet.mistDir.clone();
    const t = new THREE.Vector3(0, 1, 0); t.addScaledVector(spawn, -t.dot(spawn));
    if (t.lengthSq() < 1e-6) t.set(1, 0, 0);
    t.normalize();
    const a = MIST_ZONE.rim * 0.5;
    spawn.multiplyScalar(Math.cos(a)).addScaledVector(t, Math.sin(a)).normalize().multiplyScalar(planet.R);
    dokkaebi.spawnAt(spawn);
    story.onValleyEnter();                    // 최초 1회만(내부 게이트)
    toast('🌫️ 도깨비가 편지를 들고 달아나요! 쫓아가서 잡으세요 (Shift로 달리기)', 4200);
    emoji.spawn(dokkaebi.position, dokkaebi.up, '😈', { size: 1.8, life: 2.4 });
  }
  _mistWasIn = inValley;

  const r = dokkaebi.update(dt, player.position);
  if (r === 'caught') {
    _dokkaebiCaught++;
    chime();
    emoji.spawn(player.position, player.up, '📨', { size: 1.8, life: 2.6 });
    toast(`📨 편지를 되찾았어요! (${_dokkaebiCaught}번째)`, 3000);
    badges.setStat('dokkaebiCaught', _dokkaebiCaught);
    // 최초 포획에만 서사 + 잊혀진 우체국으로 유도.
    // 8구역짜리 행성에서 말로만 가리키면 아이는 못 찾는다 — 서사가 아니라 유실 방지다.
    if (_dokkaebiCaught === 1) {
      story.onDokkaebiFirst();
      const mistTower = trials.towers.find(t => t.regionId === 'mist');
      if (mistTower && !mistTower.cleared) _finalTarget = { pos: mistTower.pos, dir: mistTower.dir };
    }
  }
}
let _finalTarget = null;   // 마지막 편지 목적지(잊혀진 우체국). 엔딩 시 해제된다.
const _dp = new THREE.Vector3();
const _dirOfPlayer = () => _dp.copy(player.position).normalize();

learning.nextQuestion(player.position);
updateCodexCount();

// ── 전면 화면(요약 · 인트로 · 엔딩) ──
const { showSummary, showIntro, showEnding, summaryEl } = createScreens({
  session, badges, learning, story, curricula: CURRICULA, dailyGoal: DAILY_GOAL,
  INTRO, ENDING, toast, resumeAudio,
});


// 퀘스트 + 전체 지도 — "지금 뭘 해야 하나 / 저긴 왜 못 가나"를 한 화면에.
// 새 상태를 만들지 않는다. abilities·trials·learning의 현재값을 읽어 그때그때 그린다.
const quest = new Quest({
  planet, player, trials, abilities, learning, world,
  dokkaebiCaught: () => _dokkaebiCaught > 0,
});
// 시작 위치를 시련소 탑 밖으로 밀어낸다.
// 마을 시련소는 구역 중심(=우체통 허브)에 서고 시작 좌표도 같은 점이라 거리가 정확히 0이었다.
// 탑에 충돌을 넣은 뒤로는 그게 곧 '탑 속에 파묻힌 채 시작'이 된다.
// 좌표를 손으로 옮기지 않고 밀어내는 이유: 나중에 탑이나 허브가 움직여도 알아서 맞는다.
(function pushStartOutOfTower() {
  const CLEAR = 6;                     // 탑 표면에서 이만큼 떨어져 선다(충돌반경 3.4 + 여유)
  for (const t of trials.towers) {
    const d = player.position.angleTo(t.pos) * planet.R;
    if (d >= t.hitR + CLEAR) continue;
    // 탑에서 멀어지는 접선 방향. 거리가 0이면 밀 방향이 없으니 현재 진행 방향을 쓴다.
    const away = player.position.clone().sub(t.pos);
    away.addScaledVector(t.dir, -away.dot(t.dir));
    if (away.lengthSq() < 1e-9) away.copy(player.heading);
    away.addScaledVector(t.dir, -away.dot(t.dir)).normalize();
    player.position.copy(t.pos).addScaledVector(away, t.hitR + CLEAR);
    planet.projectToSurface(player.position);
    player.heading.copy(t.pos).sub(player.position);       // 탑을 바라보게 — 첫 화면에 목표가 보인다
    const up = player.position.clone().normalize();
    player.heading.addScaledVector(up, -player.heading.dot(up)).normalize();
    player.syncMesh();
    engine.camFwd.copy(player.heading); engine.camUp.copy(player.up);
    break;
  }
})();

wireShell({
  codex, badges, quest, customizer, emoji, player, presence, ghosts, input,
  resumeAudio, pickup, startBGM, toggleBGM,
});


// 수평선 컬링 — 카메라에서 보이는 건 지평선 안쪽 캡뿐. 뒤편(지평선 아래) 프롭은 숨김.
//
// 정확한 판정: 반지름 r=R+h 인 점은 고도 L 카메라에서 각거리
//   θ < acos(R/L) + acos(R/r)   일 때 보인다. (앞항=카메라 지평선, 뒷항=프롭이 지평선 위로 솟는 여유)
// cos(A+B) = cosA·cosB − sinA·sinB 로 전개하면 프롭별 cosB/sinB만 미리 구해두고
// 프레임당 cosA/sinA 한 번으로 전부 판정할 수 있다(삼각함수 호출 없음).
//
// 기존 근사 `R/L − 0.30`은 R에 따라 오차가 크게 달라진다. R=136에서는 실제 필요한 38°보다
// 훨씬 넓은 49°를 켜서 안 보이는 프롭 수천 개를 그리게 된다.
const PROP_H_PAD = 0.3;    // 프롭 높이 측정 여유(기울어진 프롭 대비)
const ACTOR_H = 1.8;       // 주민·유령 키
const _camDir = new THREE.Vector3();

// 기존 근접 판정은 전부 각도 상수였고 R=34 기준으로 튜닝돼 있었다.
// 각도를 그대로 두면 행성이 커질 때 반경이 같이 커져(0.22rad = R34에서 7.5u, R136에서 30u)
// 콜라이더 수집량과 이모지 발동 거리가 엉킨다 → 월드 거리로 고정한다.
// 지형이 생기면서 |position|은 더 이상 상수 R이 아니다. "표면에 붙어 있는가"는
// 기준 R이 아니라 그 방향의 지형 높이와 비교해야 한다. selftest/__dbg의 판정 기준.
const _sdTmp = new THREE.Vector3();
function surfaceDev(pos) {
  _sdTmp.copy(pos).normalize();
  return pos.length() - (planet.R + planet.heightAt(_sdTmp));
}

const ANG = (worldDist) => worldDist / planet.R;
const COLLIDER_ANG = ANG(7.5);    // 카메라 충돌용 건물 수집 반경
const NEAR_ANG = ANG(20.4);       // 주민·유령 이모지 활성 반경
const HEAL_ANG = ANG(4.1);        // 힐링 포인트 발견 반경

// 높이 h인 물체가 지평선 위로 솟는 각 B에 대해 cosB/sinB를 항목에 심는다.
// 히어로 GLB는 비동기로 나중에 world.placed에 추가되므로 그때도 반드시 호출해야 한다
// (누락 시 cosB=undefined → 임계값 NaN → 해당 프롭이 영구히 안 보인다).
function initCull(entry, h) {
  // 지형 때문에 프롭이 놓인 반지름이 제각각이다 → 기준 R이 아니라 실제 꼭대기 반지름을 쓴다.
  // (언덕 위 등대는 더 멀리서 보이고, 계곡 바닥 꽃은 더 일찍 가려진다.)
  const topR = entry.pos.length() + (h || 0) + PROP_H_PAD;
  const cosB = Math.min(1, planet.R / Math.max(planet.R * 0.5, topR));
  entry.cosB = cosB;
  entry.sinB = Math.sqrt(Math.max(0, 1 - cosB * cosB));
}
for (const p of world.placed) initCull(p, p.group.userData.propHeight);

// 액터는 매 프레임 움직이므로 최대 지형 높이를 여유로 잡아 보수적으로(더 보이게) 판정한다.
const _actorCos = Math.min(1, planet.R / (planet.R + TERRAIN.amp + ACTOR_H));
const _actorCosB = _actorCos, _actorSinB = Math.sqrt(Math.max(0, 1 - _actorCos * _actorCos));

function cullProps() {
  _camDir.copy(engine.camera.position);
  const L = _camDir.length();
  if (L < 1e-3) return;
  _camDir.multiplyScalar(1 / L);
  const R = planet.R;
  const cosA = Math.min(1, R / L);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  let vis = 0;
  for (const p of world.placed) {
    const on = p.dir.dot(_camDir) > cosA * p.cosB - sinA * p.sinB;
    p.group.visible = on;
    if (on) vis++;
  }
  world._visible = vis;
  // 액터(주민·유령)도 동일 판정 — 위치가 매 프레임 바뀌므로 position 정규화로 계산
  const aThr = cosA * _actorCosB - sinA * _actorSinB;
  const _ad = _camDir; // 이미 정규화됨
  for (const a of actors) {
    a.mesh.visible = (a.position.x * _ad.x + a.position.y * _ad.y + a.position.z * _ad.z) / R > aThr;
  }
}

// 카메라 충돌 콜라이더 — 단단한 건물만 메시 미리 수집, 0.15s마다 근처 것만 engine에 전달.
const SOLID_KEYS = new Set(['house', 'cornerShop', 'stationery', 'bathhouse', 'schoolFacade']);
const buildings = world.placed.filter(p => SOLID_KEYS.has(p.key));
for (const b of buildings) { b.meshes = []; b.group.traverse(o => { if (o.isMesh) b.meshes.push(o); }); }
// 플레이어 충돌용 원형 콜라이더. 발자국이 모서리 기준이라 그대로 쓰면 벽면에서 너무 멀리
// 막히므로 0.78을 곱해 내접에 가깝게 맞춘다(모서리는 조금 파고들지만 통과보다는 낫다).
// (+0.35는 플레이어 몸 반경. 없으면 벽에 얼굴이 파묻힌 채로 멈춘다.)
for (const b of buildings) b.hitR = Math.max(1.3, (b.group.userData.footprint || 1.4) * 0.82 + 0.35);

let _ccT = 0;
function updateCamColliders(dt) {
  _ccT -= dt;
  if (_ccT > 0) return;
  _ccT = 0.15;
  const near = [], hits = [];
  for (const b of buildings) {
    if (player.position.angleTo(b.pos) >= COLLIDER_ANG) continue;
    for (const m of b.meshes) near.push(m);
    hits.push({ pos: b.pos, r: b.hitR });     // 같은 근접 판정을 플레이어 충돌에도 재사용
  }
  // 시련소 탑도 단단하다. world.placed가 아니라 Trials가 만든 것이라 따로 넣어야 한다
  // (안 넣으면 돌탑을 그대로 통과해 지나간다).
  for (const t of trials.towers) {
    if (player.position.angleTo(t.pos) >= COLLIDER_ANG) continue;
    for (const m of t.solidMeshes) near.push(m);
    hits.push({ pos: t.pos, r: t.hitR });
  }
  engine.camColliders = near;
  player.colliders = hits;
}

// 배달 = 정답 제출 (키 E / 탭 공용). 시련소 앞에서는 시련 시작.
function doDeliver() {
  const tower = trials.towerInRange(player.position);
  if (tower && !tower.cleared && !trials.active) {
    if (trials.start(tower)) {
      // 시련을 시작하면 문제를 새로 낸다.
      // 안 그러면 직전 문제의 답 집이 탑에서 멀리(실측 134u) 잡혀 있어
      // 첫 배달에 이탈 반경(46u)을 넘겨 시련이 시작하자마자 중단된다.
      learning.nextQuestion(player.position);
      updateTrialHUD(trials.active);
      if (deliverEl) deliverEl.classList.remove('show');
      _inRangePrev = false;
      return;
    }
  }
  const res = learning.submit(player.position);
  if (!res) return;
  if (res.correct) {
    // 과목 마스터 배지 — 한 과목의 모든 문제를 상자 3까지 올렸는가
    const done = CURRICULA.filter(c => c.questions.every(q => learning.boxOf(q.id) >= 3)).length;
    badges.setStat('masteredSubjects', done);
    learning.nextQuestion(player.position);                  // 맞히면 다음 문제
  }
  if (deliverEl) deliverEl.classList.remove('show');
  _inRangePrev = false;
}
if (deliverEl) {
  deliverEl.addEventListener('click', doDeliver);                                  // 데스크톱 클릭
  deliverEl.addEventListener('touchend', (e) => { e.preventDefault(); doDeliver(); }, { passive: false });  // 모바일 탭(클릭 지연/누락 대비, preventDefault로 중복 방지)
}

// 물결 애니메이션 — 힐링 존 물 캡 정점을 반경 방향으로 잔잔히 변위.
const WAVE_AMP = 0.2;   // 물결 진폭(월드 단위, R과 무관)
let _wT = 0;
function animateWater(dt) {
  if (!world.water || !world.water.length) return;
  _wT += dt;
  // 변위는 반경 방향 배율이라 R에 비례한다 → 월드 진폭을 일정하게 유지하려면 R로 나눈다.
  const kAmp = WAVE_AMP / planet.R;
  for (const w of world.water) {
    const arr = w.geo.attributes.position.array, base = w.base;
    for (let i = 0; i < arr.length; i += 3) {
      const bx = base[i], by = base[i + 1], bz = base[i + 2];
      // 사인 하나면 넓은 수면에 굵은 줄무늬로 보인다. 방향·주기가 다른 두 파를 겹쳐 잔물결로.
      const k = 1 + kAmp * (
        0.6 * Math.sin(_wT * 1.4 + bx * 0.55 + bz * 0.35) +
        0.4 * Math.sin(_wT * 0.9 - bx * 0.28 + by * 0.4 + bz * 0.62));
      arr[i] = bx * k; arr[i + 1] = by * k; arr[i + 2] = bz * k;
    }
    w.geo.attributes.position.needsUpdate = true;
  }
}

// ── 구역 배너 + 힐링 포인트 발견(M6) ──
const regionBannerEl = document.getElementById('regionBanner');
const discovered = new Set((() => { try { return JSON.parse(localStorage.getItem('mumu_regions_v1') || '[]'); } catch (e) { return []; } })());
let _curRegion = null, _bannerT = 0;
function showRegionBanner(region, subject) {
  if (!regionBannerEl) return;
  regionBannerEl.textContent = subject
    ? `${region.emoji} ${region.name} · ${subject}`
    : `${region.emoji} ${region.name}`;
  regionBannerEl.classList.add('show');
  _bannerT = 2.6;
}
function updateRegion(dt) {
  const region = regionAt(player.position, world.anchors);
  if (region.id !== _curRegion) {
    _curRegion = region.id;
    // 과목 전환 "예약" — 실제 교체는 다음 문제 때. 풀던 문제가 경계를 넘는다고 사라지면 안 된다.
    const switched = learning.requestRegion(region.id);
    const cur = byRegion(region.id);
    showRegionBanner(region, cur ? cur.subject : null);
    if (switched) toast(`${cur.emoji} ${region.name}에 왔어요 — 다음 편지는 ${cur.subject} 문제예요`, 2800);
  }
  if (_bannerT > 0) { _bannerT -= dt; if (_bannerT <= 0 && regionBannerEl) regionBannerEl.classList.remove('show'); }
  // 힐링 포인트 첫 발견
  for (const hp of world.healingPoints) {
    if (discovered.has(hp.region)) continue;
    if (player.position.angleTo(hp.pos) < HEAL_ANG) {
      discovered.add(hp.region);
      try { localStorage.setItem('mumu_regions_v1', JSON.stringify([...discovered])); } catch (e) { /* 무시 */ }
      toast(`✨ ${hp.name} · ${hp.label} 발견! (${discovered.size}/${world.healingPoints.length})`, 2600);
      chime();
      badges.setStat('regionsFound', discovered.size);   // 탐험 배지
    }
  }
}

const phaseEl = document.getElementById('phase');
let _hudT = 1, _inRangePrev = false, _stepT = 0;
function step(dt) {
  const intent = input.poll();
  const wasGrounded = player.grounded;
  player.update(dt, intent, engine.camFwd, engine.camRight);
  // 배지 지표 — 점프 횟수, 최고봉 등정, 과목 마스터
  if (wasGrounded && !player.grounded) badges.bumpStat('jumps', 1);
  if (!badges.stats.summit && surfaceDev(player.position) > -1e6) {
    const h = player.position.length() - planet.R;
    if (h > TERRAIN.amp * 0.6) badges.setStat('summit', true);
  }
  // 발소리
  if (player.moving) { _stepT -= dt; if (_stepT <= 0) { footstep(); _stepT = player.running ? 0.26 : 0.34; } } else _stepT = 0;
  updateCamColliders(dt);
  engine.updateCamera(player, input, dt);
  atmosphere.update(dt);
  sky.update(atmosphere.phase, player, engine.camera);   // 카메라 갱신 이후여야 돔이 정확히 따라온다

  // 주민 — 가까운 주민만 이모지 스폰(풀 절약)
  for (const t of townsfolk) t.update(dt, t.position.angleTo(player.position) < NEAR_ANG ? emoji : null);
  // 유령(프레즌스 시뮬) → 보간 + 가까울 때 이모지
  presence.update(dt);
  for (const a of presence.getRemoteActors()) {
    const gm = ghosts.get(a.id); if (!gm) continue;
    gm.applyState(a, dt);
    if (a.emote && a.position.angleTo(player.position) < NEAR_ANG) emoji.spawn(a.position, a.up, a.emote);
  }
  emoji.update(dt);
  animateWater(dt);
  updateRegion(dt);
  updateQuestionBanner(dt);
  updateSlopeHint(dt);
  updatePropHint(dt);

  cullProps();
  // ★ 학습 모드에서는 네비를 기본으로 끈다. 켜두면 화살표가 정답 집을 가리켜 학습이 사라진다.
  //   오답 2회 후에만 hintTarget이 채워져 길잡이가 열린다.
  // 마지막 편지 목적지가 있으면 그쪽을 우선 가리킨다(유실 방지).
  nav.update(player, _finalTarget || learning.hintTarget, dt);
  learning.update(engine.camera);   // 팻말 빌보드
  trials.update(dt, player.position);
  updateDokkaebi(dt);
  story.ghostTick(dt, player.position, ghosts.values(), {
    trialActive: !!trials.active,
    wrongStreak: learning.wrongStreak,
    camera: engine.camera,
  });

  // 근접 시 프롬프트 + E/탭. 시련소 앞이면 "시련 시작"으로 바뀐다.
  const tower = trials.towerInRange(player.position);
  const atTower = !!tower && !tower.cleared && !trials.active;
  const inRange = atTower || !!learning.labelInRange(player.position);
  if (inRange !== _inRangePrev && deliverEl) { deliverEl.classList.toggle('show', inRange); _inRangePrev = inRange; }
  if (inRange && deliverEl) deliverEl.textContent = atTower ? 'E — 시련 시작' : 'E — 배달하기';
  if (intent.action) doDeliver();

  _hudT += dt;
  if (_hudT > 0.5 && phaseEl) { _hudT = 0; phaseEl.textContent = '🕓 ' + atmosphere.timeName; }
}
const loop = new Loop(step, () => engine.render());

const game = { step, planet, player, engine, input, loop, atmosphere, sky, world, learning, badges, nav, codex, customizer, presence, emoji };
window.game = game;

// ── 디버그 인트로스펙션 ──
// __dbg/__selftest는 src/debug/introspect.js로 옮겼다. 게임의 모든 시스템을 만지지만
// 게임에는 아무것도 기여하지 않는 278줄이라, 여기 두면 조립 코드가 검증 코드에 파묻힌다.
// 아래 인자 목록이 곧 "이 게임의 상태 전부"다 — 늘어나기 시작하면 그게 곧 경고다.
installDebug({
  planet, player, engine, input, world, step, surfaceDev,
  quest, trials, learning, abilities, badges, story, codex, nav, sky, atmosphere,
  customizer, emoji, dokkaebi, session, discovered, recipients, townsfolk, ghosts, actors,
  applyAbilities, updateTrialHUD, showIntro, showEnding, showSummary, summaryEl,
  dirOfPlayer: _dirOfPlayer,
  // 이 둘만 함수다 — boot.js에서 계속 바뀌는 지역 변수라 값으로 넘기면 초기값에 얼어붙는다.
  dokkaebiCaught: () => _dokkaebiCaught,
  finalTarget: () => _finalTarget,
});

// 힐링 존 히어로 — Meshy GLB(assets/env/*.glb)가 있으면 배치, 없으면 절차 폴백. 비동기(파일 추가 후 새로고침 시 자동 반영).
const _heroBB = new THREE.Box3();
async function loadHealingEnv() {
  const cache = {};
  let glbN = 0, fbN = 0;
  for (const spot of (world.heroSpots || [])) {
    const def = HERO_ASSETS[spot.asset];
    if (!def) continue;
    if (!(spot.asset in cache)) {
      const g = await loadGLB('assets/env/' + def.glb);
      cache[spot.asset] = g ? g.scene : null;
    }
    const src = cache[spot.asset];
    let group = null;
    if (src) { group = prepModel(src.clone(true), def.height, { toon: true, yaw: (def.yaw || 0) * Math.PI / 180 }); glbN++; }
    else if (def.fallback && PROP_BUILDERS[def.fallback]) { group = PROP_BUILDERS[def.fallback]({}, Math.random); fbN++; }
    if (!group) continue;
    // 히어로 GLB는 헛간·등대처럼 덩치가 커서 비탈에서 뜨는 게 가장 눈에 띈다.
    // 실제 모델 바운딩으로 발자국을 재고 그 안 최저 지형에 앉힌다.
    const seat = spot.pos.clone();
    if (!def.onWater) {
      _heroBB.setFromObject(group);
      const foot = Number.isFinite(_heroBB.max.x)
        ? Math.max(Math.abs(_heroBB.max.x), Math.abs(_heroBB.min.x), Math.abs(_heroBB.max.z), Math.abs(_heroBB.min.z))
        : 0;
      planet.seatOnSurface(seat, Math.max(foot, 0.45));
      // 랜드마크도 점유를 등록한다. 안 하면 나중에 배치되는 프롭이 등대 안에 생긴다.
      reserveSpot(seat, Math.max(foot, 1.2));
    }
    const fr = planet.frameAt(seat, spot.rot);
    group.position.copy(fr.position); group.quaternion.copy(fr.quaternion);
    // 물 위 오브젝트는 흘수(draft)만큼 잠기거나 뜬다. 수면은 기준 R + 0.05.
    if (def.onWater) group.position.addScaledVector(spot.dir, 0.05 + (def.draft ?? 0.2));
    engine.scene.add(group);
    const entry = { group, key: spot.asset, theme: 'hero', pos: seat, dir: spot.dir };
    initCull(entry, def.height);   // 등대·탑처럼 키 큰 히어로는 지평선 여유가 커야 한다
    world.placed.push(entry);
  }
  console.log(`[healing] 히어로 배치 — GLB ${glbN}, 절차 폴백 ${fbN} / ${(world.heroSpots || []).length} 스폿`);
  world._heroGlb = glbN;
}
loadHealingEnv();

const load = document.getElementById('load');
if (load) load.style.display = 'none';
loop.start();
if (story.needsIntro()) showIntro();
console.log('[boot] 무무 행성 집배원 — 7개 구역(M6). __selftest()/__dbg로 검증.');
