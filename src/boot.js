// 진입점 — 행성/플레이어/입력/엔진/루프 연결 + __dbg/__selftest(블라인드 검증).
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
import { regionAt } from './data/regions.js';
import { LearningSystem } from './systems/Learning.js';
import { CURRICULA, byRegion, DEFAULT_CURRICULUM } from './data/curriculum/index.js';
import { Badges } from './systems/Badges.js';
import { Abilities, ABILITIES } from './systems/Abilities.js';
import { Trials, TRIAL_STREAK } from './systems/Trials.js';
import { Story, INTRO, ENDING } from './systems/Story.js';
import { signTexture } from './systems/Learning.js';
import { parcelKindFor } from './data/story.js';

const canvas = document.getElementById('c');
const engine = new Engine(canvas, R);
const planet = new Planet(engine.scene);
const atmosphere = new Atmosphere(engine, { dayLength: 300, phase: 0.28 });
engine.attachPost(new Post(engine.renderer, engine.scene, engine.camera, engine.outline));
const sky = new Sky(engine, planet);
atmosphere.setSky(sky);                     // 하늘도 같은 시간대 키프레임으로 구동
const world = buildTown(engine.scene, planet, 7);
const player = new Player(planet);
player.setLatLon(15, -4);   // 골목 주택가(우체통 허브) 근처에서 시작
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
const trialSpots = world.healingPoints.map(hp => {
  const a = world.anchors.find(x => x.id === hp.region);
  const pos = hp.pos.clone();
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

// ── 세션 요약 ────────────────────────────────────────────────────────────
// 리서치상 아이들이 보상에 집중하는 건 플레이 중이 아니라 "끝나고 보는 화면"이다.
// 그래서 배지의 진짜 무대는 여기다.
const summaryEl = document.getElementById('summary');
function showSummary() {
  if (!summaryEl) return;
  const total = session.correct + session.wrong;
  const acc = total ? Math.round(100 * session.correct / total) : 0;
  document.getElementById('sumSub').textContent =
    `오늘 목표 ${DAILY_GOAL}통을 모두 배달했어요!`;

  const st = (v, k) => `<div class="st"><div class="v">${v}</div><div class="k">${k}</div></div>`;
  document.getElementById('sumStats').innerHTML =
    st(session.correct, '맞힌 문제') + st(acc + '%', '정답률') +
    st(session.comebacks, '다시 도전 성공') + st(badges.count() + '/' + badges.total(), '배지');

  // 이번 세션에 새로 얻은 배지 — 중복 제거
  const seen = new Set(), fresh = [];
  for (const b of session.newBadges) { if (!seen.has(b.id)) { seen.add(b.id); fresh.push(b); } }
  document.getElementById('sumNew').innerHTML = fresh.length
    ? fresh.map((b, i) => `<div class="nb" style="animation-delay:${i * 0.12}s"><div class="e">${b.emoji}</div><div class="n">${b.name}</div></div>`).join('')
    : '';

  // 과목별 진도
  if (learning) {
    document.getElementById('sumSubjects').innerHTML = CURRICULA.map(c => {
      const done = c.questions.filter(q => learning.boxOf(q.id) >= 3).length;
      const pct = Math.round(100 * done / c.questions.length);
      return `${c.emoji} ${c.subject} — ${done}/${c.questions.length} 익힘 (${pct}%)`;
    }).join('<br>');
  }
  summaryEl.classList.add('show');
}
// ── 인트로 / 엔딩 오버레이 ───────────────────────────────────────────────
// #summary와 CSS를 공유한다. 일시정지는 만들지 않는다 — 실패 상태가 없는 게임이라
// 뒤에서 행성이 돌아도 무방하고, 일시정지는 새 상태기계다.
function showIntro() {
  const el = document.getElementById('intro'); if (!el) return;
  document.getElementById('introTitle').textContent = INTRO.title;
  document.getElementById('introLines').innerHTML = INTRO.lines.join('<br>');
  document.getElementById('introHint').textContent = INTRO.hint;
  const btn = document.getElementById('introBtn');
  btn.textContent = INTRO.button;
  btn.onclick = () => { el.classList.remove('show'); story.markIntroShown(); resumeAudio(); };
  el.classList.add('show');
}

function showEnding() {
  const el = document.getElementById('ending'); if (!el) return;
  document.getElementById('endTitle').textContent = ENDING.title;
  document.getElementById('endLetter').innerHTML = ENDING.letter.join('<br>');
  document.getElementById('endLines').innerHTML = ENDING.lines.join('<br>');
  const btn = document.getElementById('endBtn');
  btn.textContent = ENDING.button;
  btn.onclick = () => el.classList.remove('show');
  story.markEndingShown();
  el.classList.add('show');
}

const sumCloseEl = document.getElementById('sumClose');
if (sumCloseEl) sumCloseEl.addEventListener('click', () => {
  summaryEl.classList.remove('show');
  session.newBadges = [];      // 다음 요약에는 그 이후 것만
});

// 도감 오버레이 토글 + 진행 바
const codexOverlay = document.getElementById('codex');
const codexBarFill = document.getElementById('codexBarFill');
// 도감 안 탭 — 우표 / 배지
const codexGridEl = document.getElementById('codexGrid');
const badgeGridEl = document.getElementById('badgeGrid');
const badgeCountEl = document.getElementById('badgeCount');
function showCodexTab(which) {
  if (!codexGridEl || !badgeGridEl) return;
  const stamps = which === 'stamps';
  codexGridEl.style.display = stamps ? 'grid' : 'none';
  badgeGridEl.style.display = stamps ? 'none' : 'grid';
  document.querySelectorAll('#codexTabs .tab').forEach(t =>
    t.classList.toggle('on', t.dataset.tab === which));
  if (!stamps) badges.renderInto(badgeGridEl);
}
document.querySelectorAll('#codexTabs .tab').forEach(t =>
  t.addEventListener('click', () => showCodexTab(t.dataset.tab)));

const openCodex = () => {
  codex.renderInto(codexGridEl);
  if (badgeCountEl) badgeCountEl.textContent = `${badges.count()}/${badges.total()}`;
  showCodexTab('stamps');
  if (codexBarFill) codexBarFill.style.width = (codex.total() ? (codex.count() / codex.total() * 100) : 0) + '%';
  codexOverlay.classList.add('show');
};
const closeCodex = () => codexOverlay.classList.remove('show');
document.getElementById('codexBtn').addEventListener('click', openCodex);
document.getElementById('codexClose').addEventListener('click', closeCodex);
addEventListener('keydown', e => { if (e.code === 'KeyC') (codexOverlay.classList.contains('show') ? closeCodex() : openCodex()); });

// 꾸미기 오버레이 토글
const czOverlay = document.getElementById('customize');
const openCz = () => { customizer.buildUI(document.getElementById('czControls')); czOverlay.classList.add('show'); };
const closeCz = () => czOverlay.classList.remove('show');
document.getElementById('customizeBtn').addEventListener('click', openCz);
document.getElementById('czClose').addEventListener('click', closeCz);

// 플레이어 이모지 보내기 → 머리 위 이모지 + 가까운 유령이 손 흔들기로 답함
document.querySelectorAll('#emotes button').forEach(b => {
  b.addEventListener('click', () => {
    resumeAudio();
    emoji.spawn(player.position, player.up, b.dataset.e, { size: 1.5, life: 2.6 });
    pickup();
    const gid = presence.sendEmote(player.position);
    if (gid) { const gm = ghosts.get(gid); if (gm) setTimeout(() => emoji.spawn(gm.position, gm.up, '👋', { life: 2.2 }), 350); }
  });
});

// 첫 사용자 제스처에 오디오 활성화 + BGM 시작(브라우저 자동재생 정책)
const _wake = () => { resumeAudio(); startBGM('assets/audio/bgm_village.mp3'); removeEventListener('pointerdown', _wake); removeEventListener('keydown', _wake); };
addEventListener('pointerdown', _wake); addEventListener('keydown', _wake);

// 모바일 점프 버튼 — 탭 지연/중복을 피하려고 touchend에서 preventDefault 후 직접 트리거.
const jumpBtn = document.getElementById('jumpBtn');
if (jumpBtn) {
  const doJump = (e) => { if (e) e.preventDefault(); resumeAudio(); input.requestJump(); };
  jumpBtn.addEventListener('click', doJump);
  // 누르고 있으면 활공 — touchstart에서 점프, 유지 동안 hold, 떼면 해제.
  jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); doJump(); input.setHoldJump(true); }, { passive: false });
  const releaseJump = () => input.setHoldJump(false);
  jumpBtn.addEventListener('touchend', (e) => { e.preventDefault(); releaseJump(); }, { passive: false });
  jumpBtn.addEventListener('touchcancel', releaseJump);
}

// BGM 음소거 토글
const muteBtn = document.getElementById('muteBtn');
if (muteBtn) muteBtn.addEventListener('click', () => { const on = toggleBGM(); muteBtn.textContent = on ? '🔊' : '🔇'; });

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
let _ccT = 0;
function updateCamColliders(dt) {
  _ccT -= dt;
  if (_ccT > 0) return;
  _ccT = 0.15;
  const near = [];
  for (const b of buildings) if (player.position.angleTo(b.pos) < COLLIDER_ANG) for (const m of b.meshes) near.push(m);
  engine.camColliders = near;
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

// ── 디버그 인트로스펙션(스크린샷 없이 preview_eval로 읽기) ──
window.__dbg = {
  get altitude() { return +player.position.length().toFixed(4); },
  get pos() { return player.position.toArray().map(v => +v.toFixed(2)); },
  get heading() { return player.heading.toArray().map(v => +v.toFixed(3)); },
  get up() { return player.up.toArray().map(v => +v.toFixed(3)); },
  get camPos() { return engine.camera.position.toArray().map(v => +v.toFixed(2)); },
  get camDist() { return +input.camDist.toFixed(2); },
  get R() { return planet.R; },
  get propCount() { return world.placed.length; },
  get visibleProps() { return world._visible ?? 0; },
  get zones() { return (world.heroSpots ? [...new Set(world.heroSpots.map(s => s.zone))] : []); },
  get heroSpots() { return (world.heroSpots || []).length; },
  get waterCaps() { return (world.water || []).length; },
  get heroGlb() { return world._heroGlb ?? -1; },
  // 구역(M6) 검증용
  get region() { return regionAt(player.position, world.anchors).id; },
  get healingPoints() { return (world.healingPoints || []).map(h => h.region); },
  get discovered() { return discovered.size; },
  warpToLatLon(lat, lon) { player.setLatLon(lat, lon); engine.camFwd.copy(player.heading); engine.camUp.copy(player.up); return regionAt(player.position, world.anchors).id; },
  regionFill() { const m = {}; for (const p of world.placed) m[p.theme] = (m[p.theme] || 0) + 1; return m; },
  // 하늘(검증용)
  // 안개 골짜기 · 도깨비(M8) 검증용
  get mist() {
    const inV = planet.inMistValley(_dirOfPlayer());
    return {
      inValley: inV,
      distToDokkaebiU: dokkaebi.mesh.visible
        ? +(player.position.angleTo(dokkaebi.position) * planet.R).toFixed(1) : null,
      dokkaebiVisible: dokkaebi.mesh.visible,
      caughtTotal: _dokkaebiCaught,
      rimMaxSlope: +planet.slopeDegAt(
        planet.mistDir.clone().applyAxisAngle(
          new THREE.Vector3(1, 0, 0).cross(planet.mistDir).normalize(), MIST_ZONE.rim * 0.85)).toFixed(0),
    };
  },
  warpToMist() {
    player.position.copy(planet.mistDir).multiplyScalar(planet.R);
    planet.projectToSurface(player.position);
    player._initFrame(); player.syncMesh();
    return 'mist valley';
  },
  // 도깨비를 향해 실제로 조준하며 추격(검증용). 카메라 접선 프레임을 매 프레임 도깨비 쪽으로 돌린다.
  chaseDokkaebi(run = true, maxFrames = 1800) {
    if (!dokkaebi.mesh.visible) return 'no dokkaebi';
    const before = _dokkaebiCaught;
    const dir = new THREE.Vector3();
    input.setTestIntent({ x: 0, y: 1, run });
    let f = 0;
    for (; f < maxFrames; f++) {
      dir.copy(dokkaebi.position).sub(player.position);
      dir.addScaledVector(player.up, -dir.dot(player.up));
      if (dir.lengthSq() > 1e-9) { dir.normalize(); engine.camFwd.copy(dir); }
      step(1 / 60);
      if (_dokkaebiCaught > before) break;
    }
    input.setTestIntent(null);
    return { caught: _dokkaebiCaught > before, sec: +(f / 60).toFixed(1),
             dist: +(player.position.angleTo(dokkaebi.position) * planet.R).toFixed(1) };
  },
  // 시련소(M8) 검증용
  get trials() {
    return {
      towers: trials.towers.map(t => `${t.emoji}${t.name}${t.cleared ? '✅' : ''}`),
      active: trials.active ? { region: trials.active.regionId, streak: trials.active.streak } : null,
      dots: trials.streakDots,
      nearTower: (() => { const t = trials.towerInRange(player.position); return t ? t.name : null; })(),
    };
  },
  warpToTrial(i = 0) {
    const t = trials.towers[i]; if (!t) return 'no tower';
    player.position.copy(t.pos); planet.projectToSurface(player.position);
    player._initFrame(); player.syncMesh();
    return t.name;
  },
  startTrial() {
    const t = trials.towerInRange(player.position);
    const ok = trials.start(t);
    if (ok) { learning.nextQuestion(player.position); updateTrialHUD(trials.active); }
    return ok ? t.name : 'cannot start';
  },
  // 서사(M9) 검증용 — 최초 1회 이벤트라 reset 없이는 반복 테스트가 불가능하다
  get story() { return { ...story.state(), finalTarget: !!_finalTarget }; },
  resetStory() { return story.reset(); },
  showIntro() { showIntro(); return 'intro'; },
  showEnding() { showEnding(); return 'ending'; },
  parcelOf(id) { const k = parcelKindFor(id); return k.icon + ' ' + k.kind; },
  // 능력(M8) 검증용
  get abilities() {
    return {
      cleared: [...abilities.cleared], count: abilities.clearedCount(),
      unlocked: [...abilities.unlocked],
      next: abilities.next() ? abilities.next().name + '(시련소 ' + abilities.next().at + '개)' : '전부 해금',
      player: { maxJumps: player.maxJumps, canClimb: player.canClimb, canGlide: player.canGlide,
                maxClimbDeg: +(Math.atan(player.maxClimbTan) * 180 / Math.PI).toFixed(0) },
    };
  },
  clearTrial(regionId) { const f = abilities.clearTrial(regionId); applyAbilities(); return f.map(a => a.name); },
  grantAllAbilities() { abilities.grantAll(); applyAbilities(); return [...abilities.unlocked]; },
  resetAbilities() { abilities.reset(); applyAbilities(); return 'reset'; },
  // 배지/세션(M7) 검증용
  get badges() {
    return { earned: [...badges.earned], count: badges.count() + '/' + badges.total(), stats: { ...badges.stats } };
  },
  get session() { return { ...session, newBadges: session.newBadges.map(b => b.id) }; },
  summaryVisible() { return !!summaryEl && summaryEl.classList.contains('show'); },
  showSummary() { showSummary(); return true; },
  // 학습(M7) 검증용
  get learn() {
    if (!learning) return null;
    const c = learning.current;
    return {
      q: c ? c.question.q : null,
      answer: c ? c.question.a : null,
      labels: c ? c.labels.map(l => l.text + (l.correct ? '✓' : '')) : [],
      signCount: learning.signs.children.length,
      wrongStreak: learning.wrongStreak,
      hintUnlocked: learning.hintUnlocked,
      navActive: nav.beacon.visible,
      subject: learning.active.subject,
      curriculumId: learning.active.id,
      pending: learning.pending ? learning.pending.id : null,
      solved: learning.solved,
      mastered: learning.masteredCount() + '/' + learning.totalCount(),
      masteredAll: learning.masteredAll() + '/' + learning.totalAll(),
      // 후보 집까지의 거리(월드) — 걷는 맛 튜닝용
      distU: c ? c.labels.map(l => +(player.position.angleTo(l.house.pos) * planet.R).toFixed(1)) : [],
    };
  },
  // 정답/오답 집으로 순간이동 후 제출(검증용)
  learnGoto(wantCorrect = true) {
    if (!learning || !learning.current) return 'no question';
    const l = learning.current.labels.find(x => x.correct === wantCorrect);
    if (!l) return 'no such label';
    player.position.copy(l.house.pos); planet.projectToSurface(player.position);
    player._initFrame(); player.syncMesh();
    return l.text;
  },
  learnSubmit() {
    if (!learning) return null;
    const r = learning.submit(player.position);
    if (r && r.correct) learning.nextQuestion(player.position);
    return r ? { correct: r.correct, box: r.box } : 'not in range';
  },
  get skyState() {
    return {
      domeAtCamera: sky.dome.position.distanceTo(engine.camera.position) < 0.01,
      starsVisible: sky.stars.visible,
      starOpacity: +sky._starI.toFixed(2),
      sunVisible: sky.sunDisc.visible,
      moonVisible: sky.moonDisc.visible,
      sunElevDeg: +(Math.asin(Math.max(-1, Math.min(1,
        sky.sunDisc.position.clone().sub(engine.camera.position).normalize().dot(player.up)))) * 180 / Math.PI).toFixed(1),
      clouds: sky.clouds.count,
      skyTop: '#' + sky.uniforms.uTop.value.getHexString(),
      skyHorizon: '#' + sky.uniforms.uHorizon.value.getHexString(),
    };
  },
  get timePhase() { return +atmosphere.phase.toFixed(3); },
  get timeName() { return atmosphere.timeName; },
  setTime(p) { atmosphere.setPhase(p); return atmosphere.timeName; },   // 0~1 시간대 스크럽(검증용)
  onSurface(eps = 1e-2) { return Math.abs(surfaceDev(player.position)) < eps; },
  get inRange() { return !!learning.labelInRange(player.position); },
  get codex() { return codex.count() + '/' + codex.total(); },
  get recipients() { return recipients.length; },
  get townsfolk() { return townsfolk.length; },
  get ghosts() { return ghosts.size; },
  get emojiActive() { return emoji.items.length; },
  get actorsVisible() { return actors.filter(a => a.mesh.visible).length; },
  ghostPositions() { return [...ghosts.values()].map(g => g.position.toArray().map(v => +v.toFixed(1))); },
  onSurfaceActors(eps = 0.05) { return actors.every(a => Math.abs(surfaceDev(a.position)) < eps); },
  get terrainH() { return +planet.heightAt(player.position.clone().normalize()).toFixed(2); },
  terrainRange(n = 4000) {   // 지형 높이 분포 확인용(검증)
    let lo = Infinity, hi = -Infinity, sum = 0;
    const rng = makeRNG(7), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const z = rng() * 2 - 1, th = rng() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      const h = planet.heightAt(v.set(r * Math.cos(th), z, r * Math.sin(th)));
      lo = Math.min(lo, h); hi = Math.max(hi, h); sum += h;
    }
    return { min: +lo.toFixed(2), max: +hi.toFixed(2), avg: +(sum / n).toFixed(2) };
  },
  // 커스터마이즈(M4) 검증용
  get loadout() { return { ...player.loadout }; },
  get bodyMeshes() { let n = 0; player.body.traverse(o => { if (o.isMesh) n++; }); return n; },
  setPart(part, val) { customizer.set(part, val); return { ...player.loadout }; },
  cycleHair(d = 1) { customizer.cycleHair(d); return player.loadout.hairId; },
  // 현재 목표 집 앞으로 순간이동 후 배달(검증용)
  deliverNow() { const r = learning.submit(player.position); if (r && r.correct) learning.nextQuestion(player.position); return r || 'not in range'; },
};

// ── 결정론 셀프테스트(rAF 불필요) ──
function runStraight(lat, lon, headingVec, nSteps, dt = 1 / 60) {
  player.setLatLon(lat, lon);
  player.heading.copy(headingVec); player._initFrame();
  engine.camFwd.copy(player.heading); engine.camUp.copy(player.up);
  input.setTestIntent({ x: 0, y: 1, run: false });
  let maxDev = 0, nan = false;
  for (let i = 0; i < nSteps; i++) {
    step(dt);
    const dev = Math.abs(surfaceDev(player.position));
    if (dev > maxDev) maxDev = dev;
    const q = player.mesh.quaternion;
    if (Number.isNaN(player.position.x) || Number.isNaN(q.x) || Number.isNaN(q.w)) nan = true;
  }
  input.setTestIntent(null);
  return { maxDev, nan, end: player.position.clone() };
}

window.__selftest = function () {
  const log = [], R = planet.R;
  // 한 바퀴에 필요한 총 시간(초). 대원 이동은 임의의 dt에서 정확(회전 각도 = dist/R)하므로
  // 프레임 수를 고정하고 dt를 늘려도 결과가 같다. R이 커져도 테스트 시간이 폭발하지 않게 한다.
  const lapSec = 2 * Math.PI * R / player.speed;
  const STEPS = 1500;
  const dt = lapSec / STEPS;

  // A) 대원 한 바퀴 → 시작점 복귀 + 반지름 일정
  const start = planet.projectToSurface(planet.latLonToPos(5, 0));
  const a = runStraight(5, 0, new THREE.Vector3(0, 0, 1), STEPS, dt);
  const back = a.end.distanceTo(start);
  const aDevOK = a.maxDev < 1e-2, aNanOK = !a.nan, loopOK = back < R * 0.2;
  log.push(`A radius dev max=${a.maxDev.toExponential(2)} -> ${aDevOK ? 'PASS' : 'FAIL'}`);
  log.push(`A no NaN -> ${aNanOK ? 'PASS' : 'FAIL'}`);
  log.push(`A great-circle return dist=${back.toFixed(2)} (<${(R * 0.2).toFixed(1)}) -> ${loopOK ? 'PASS' : 'FAIL'}`);

  // B) 극점 통과: 적도(R,0,0)에서 +Y로 직진 → 북극 통과. 롤/플립/NaN 없어야.
  const b = runStraight(0, 0, new THREE.Vector3(0, 1, 0), Math.round(STEPS * 0.6), dt);
  const bDevOK = b.maxDev < 1e-2, bNanOK = !b.nan;
  log.push(`B pole-cross radius dev=${b.maxDev.toExponential(2)} -> ${bDevOK ? 'PASS' : 'FAIL'}`);
  log.push(`B pole-cross no NaN -> ${bNanOK ? 'PASS' : 'FAIL'}`);

  const ok = aDevOK && aNanOK && loopOK && bDevOK && bNanOK;
  console.log('%c[selftest]\n' + log.join('\n') + '\n=== ' + (ok ? 'ALL PASS ✅' : 'FAIL ❌') + ' ===', 'font-family:monospace');

  // 상태 복원
  player.setLatLon(8, 0);
  engine.camFwd.copy(player.heading); engine.camUp.copy(player.up);
  return ok;
};

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
    }
    const fr = planet.frameAt(seat, spot.rot);
    group.position.copy(fr.position); group.quaternion.copy(fr.quaternion);
    if (def.onWater) group.position.addScaledVector(spot.dir, 0.25);   // 물 위로 살짝
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
