// 진입점 — 행성/플레이어/입력/엔진/루프 연결 + __dbg/__selftest(블라인드 검증).
import { Planet, R } from './world/Planet.js';
import * as THREE from 'three';
import { Player } from './entities/Player.js';
import { Input } from './core/Input.js';
import { Engine } from './core/Engine.js';
import { Loop } from './core/Loop.js';
import { Atmosphere } from './world/Atmosphere.js';
import { buildTown } from './world/TownGenerator.js';
import { DeliverySystem } from './systems/DeliverySystem.js';
import { Navigation } from './systems/Navigation.js';
import { Codex } from './systems/Codex.js';
import { RECIPIENT_NAMES } from './data/parcels.js';
import { chime, pickup, resumeAudio, startBGM, toggleBGM, isBGMOn, footstep } from './core/Audio.js';
import { EmojiLayer } from './entities/EmojiBubble.js';
import { Townsfolk, TOWN_COLORS } from './entities/Townsfolk.js';
import { GhostMessenger } from './entities/GhostMessenger.js';
import { LocalGhostSource } from './systems/PresenceSource.js';
import { Customizer } from './systems/Customizer.js';
import { makeRNG } from './util/math.js';
import { loadGLB, prepModel } from './core/Assets.js';
import { HERO_ASSETS } from './data/healingAssets.js';
import { PROP_BUILDERS } from './world/Props.js';

const canvas = document.getElementById('c');
const engine = new Engine(canvas, R);
const planet = new Planet(engine.scene);
const atmosphere = new Atmosphere(engine, { dayLength: 300, phase: 0.28 });
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
const recipients = pickRecipients(world.placed, 12);

// ── NPC + 프레즌스 + 이모지(M3) ──
const emoji = new EmojiLayer(engine.scene, 28);
const npcRng = makeRNG(123);
// 각 수령인 집에 주민 1명 배치(배달 시 감사 이모지). + 동네 곳곳 산발 주민.
const townsfolk = [];
recipients.forEach((r, i) => {
  const t = new Townsfolk(planet, r.pos, TOWN_COLORS[i % TOWN_COLORS.length], npcRng);
  engine.scene.add(t.mesh); r.npc = t; townsfolk.push(t);
});
for (let i = 0; i < 8; i++) {
  const h = world.placed[Math.floor(npcRng() * world.placed.length)];
  const t = new Townsfolk(planet, (h ? h.pos : planet.latLonToPos(npcRng() * 180 - 90, npcRng() * 360)), TOWN_COLORS[i % TOWN_COLORS.length], npcRng);
  engine.scene.add(t.mesh); townsfolk.push(t);
}
// 유령 메신저(가짜 다른 플레이어) — PresenceSource seam
const presence = new LocalGhostSource(planet, 8, 42);
const ghosts = new Map();
for (const a of presence.getRemoteActors()) {
  const gm = new GhostMessenger(planet, a.name);
  gm.position.copy(a.position); gm.heading.copy(a.heading); gm._initFrame(); gm.syncMesh();
  engine.scene.add(gm.mesh); ghosts.set(a.id, gm);
}
// 수평선 컬링 대상 액터(프롭과 동일 방식, 위치가 매 프레임 바뀌므로 position 사용)
const actors = [...townsfolk, ...ghosts.values()];

const codex = new Codex(recipients);
const nav = new Navigation(engine.scene, planet);

// HUD 참조 + 헬퍼
const parcelEl = document.getElementById('parcel');
const deliverEl = document.getElementById('deliver');
const toastsEl = document.getElementById('toasts');
const codexCountEl = document.getElementById('codexCount');
function toast(msg, ms = 2200) {
  if (!toastsEl) return;
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  toastsEl.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}
function updateCodexCount() { if (codexCountEl) codexCountEl.textContent = `${codex.count()}/${codex.total()}`; }
function updateParcelHUD() {
  if (!parcelEl) return;
  const r = delivery.current;
  parcelEl.innerHTML = r
    ? `${r.parcel.icon} <b>${r.name}</b> 님께 ${r.parcel.kind} 배달 — ${r.parcel.flavor}`
    : (delivery && delivery.allDone() ? '🎉 오늘 배달 완료! 동네를 둘러보세요' : '📮 배달 준비 중…');
}
const delivery = new DeliverySystem(planet, recipients, {
  deliverRange: 5,
  onAssign: () => updateParcelHUD(),
  onDeliver: (r) => {
    chime();
    codex.add(r.id); updateCodexCount();
    toast(`${r.parcel.icon} ${r.name} 님께 ${r.parcel.kind} 배달 완료! · 우표 +1`);
    if (r.npc) r.npc.thank(emoji);
  },
});
delivery.assignNearest(player.position);
updateParcelHUD(); updateCodexCount();

// 도감 오버레이 토글 + 진행 바
const codexOverlay = document.getElementById('codex');
const codexBarFill = document.getElementById('codexBarFill');
const openCodex = () => {
  codex.renderInto(document.getElementById('codexGrid'));
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

// BGM 음소거 토글
const muteBtn = document.getElementById('muteBtn');
if (muteBtn) muteBtn.addEventListener('click', () => { const on = toggleBGM(); muteBtn.textContent = on ? '🔊' : '🔇'; });

// 수평선 컬링 — 작은 행성이라 카메라에서 보이는 건 ~지평선 안쪽(약 한 캡)뿐. 뒤편(지평선 아래) 프롭은 숨김.
// 키 큰 프롭(굴뚝·전봇대)이 지평선 너머에서 삐죽 보일 수 있어 여유(margin)를 둔다. 아웃라인은 보이는 것에만 유지.
const _camDir = new THREE.Vector3();
function cullProps() {
  _camDir.copy(engine.camera.position);
  const L = _camDir.length();
  if (L < 1e-3) return;
  _camDir.multiplyScalar(1 / L);
  const thr = planet.R / L - 0.30;   // 지평선 cos(R/L)에 여유. 작을수록 더 많이 보임
  let vis = 0;
  for (const p of world.placed) {
    const on = p.dir.dot(_camDir) > thr;
    p.group.visible = on;
    if (on) vis++;
  }
  world._visible = vis;
  // 액터(주민·유령)도 동일 수평선 컬링 — 위치가 매 프레임 바뀌므로 position 정규화로 판정
  const _ad = _camDir; // 이미 정규화됨
  for (const a of actors) {
    a.mesh.visible = (a.position.x * _ad.x + a.position.y * _ad.y + a.position.z * _ad.z) / planet.R > thr;
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
  for (const b of buildings) if (player.position.angleTo(b.pos) < 0.22) for (const m of b.meshes) near.push(m);
  engine.camColliders = near;
}

// 배달 실행(키 E/탭 공용)
function doDeliver() {
  if (delivery.inRange(player.position)) {
    delivery.tryDeliver(player.position);
    if (deliverEl) deliverEl.classList.remove('show');
    _inRangePrev = false;
  }
}
if (deliverEl) {
  deliverEl.addEventListener('click', doDeliver);                                  // 데스크톱 클릭
  deliverEl.addEventListener('touchend', (e) => { e.preventDefault(); doDeliver(); }, { passive: false });  // 모바일 탭(클릭 지연/누락 대비, preventDefault로 중복 방지)
}

// 물결 애니메이션 — 힐링 존 물 캡 정점을 반경 방향으로 잔잔히 변위.
let _wT = 0;
function animateWater(dt) {
  if (!world.water || !world.water.length) return;
  _wT += dt;
  for (const w of world.water) {
    const arr = w.geo.attributes.position.array, base = w.base;
    for (let i = 0; i < arr.length; i += 3) {
      const bx = base[i], by = base[i + 1], bz = base[i + 2];
      const k = 1 + 0.006 * Math.sin(_wT * 1.4 + bx * 0.5 + bz * 0.5);
      arr[i] = bx * k; arr[i + 1] = by * k; arr[i + 2] = bz * k;
    }
    w.geo.attributes.position.needsUpdate = true;
  }
}

const phaseEl = document.getElementById('phase');
let _hudT = 1, _inRangePrev = false, _stepT = 0;
function step(dt) {
  const intent = input.poll();
  player.update(dt, intent, engine.camFwd, engine.camRight);
  // 발소리
  if (player.moving) { _stepT -= dt; if (_stepT <= 0) { footstep(); _stepT = player.running ? 0.26 : 0.34; } } else _stepT = 0;
  updateCamColliders(dt);
  engine.updateCamera(player, input, dt);
  atmosphere.update(dt);

  // 주민 — 가까운 주민만 이모지 스폰(풀 절약)
  for (const t of townsfolk) t.update(dt, t.position.angleTo(player.position) < 0.6 ? emoji : null);
  // 유령(프레즌스 시뮬) → 보간 + 가까울 때 이모지
  presence.update(dt);
  for (const a of presence.getRemoteActors()) {
    const gm = ghosts.get(a.id); if (!gm) continue;
    gm.applyState(a, dt);
    if (a.emote && a.position.angleTo(player.position) < 0.6) emoji.spawn(a.position, a.up, a.emote);
  }
  emoji.update(dt);
  animateWater(dt);

  cullProps();
  nav.update(player, delivery.current, dt);

  // 배달: 근접 시 프롬프트 + E/탭
  const inRange = delivery.inRange(player.position);
  if (inRange !== _inRangePrev && deliverEl) { deliverEl.classList.toggle('show', inRange); _inRangePrev = inRange; }
  if (intent.action) doDeliver();

  _hudT += dt;
  if (_hudT > 0.5 && phaseEl) { _hudT = 0; phaseEl.textContent = '🕓 ' + atmosphere.timeName; }
}
const loop = new Loop(step, () => engine.render());

const game = { step, planet, player, engine, input, loop, atmosphere, world, delivery, nav, codex, customizer, presence, emoji };
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
  get timePhase() { return +atmosphere.phase.toFixed(3); },
  get timeName() { return atmosphere.timeName; },
  setTime(p) { atmosphere.setPhase(p); return atmosphere.timeName; },   // 0~1 시간대 스크럽(검증용)
  onSurface(eps = 1e-2) { return Math.abs(player.position.length() - planet.R) < eps; },
  // 배달(M2) 검증용
  get target() { return delivery.current ? delivery.current.name + ' / ' + delivery.current.parcel.kind : null; },
  get targetDeg() { return delivery.current ? +(player.position.angleTo(delivery.current.pos) * 180 / Math.PI).toFixed(1) : null; },
  get inRange() { return delivery.inRange(player.position); },
  get codex() { return codex.count() + '/' + codex.total(); },
  get recipients() { return recipients.length; },
  get townsfolk() { return townsfolk.length; },
  get ghosts() { return ghosts.size; },
  get emojiActive() { return emoji.items.length; },
  get actorsVisible() { return actors.filter(a => a.mesh.visible).length; },
  ghostPositions() { return [...ghosts.values()].map(g => g.position.toArray().map(v => +v.toFixed(1))); },
  onSurfaceActors(eps = 0.05) { return actors.every(a => Math.abs(a.position.length() - planet.R) < eps); },
  // 커스터마이즈(M4) 검증용
  get loadout() { return { ...player.loadout }; },
  get bodyMeshes() { let n = 0; player.body.traverse(o => { if (o.isMesh) n++; }); return n; },
  setPart(part, val) { customizer.set(part, val); return { ...player.loadout }; },
  cycleHair(d = 1) { customizer.cycleHair(d); return player.loadout.hairId; },
  // 현재 목표 집 앞으로 순간이동 후 배달(검증용)
  warpToTarget() { if (!delivery.current) return 'no target'; player.position.copy(delivery.current.pos).setLength(planet.R); player._initFrame(); player.syncMesh(); return delivery.current.name; },
  deliverNow() { return delivery.tryDeliver(player.position)?.name || 'not in range'; },
};

// ── 결정론 셀프테스트(rAF 불필요) ──
function runStraight(lat, lon, headingVec, nSteps) {
  player.setLatLon(lat, lon);
  player.heading.copy(headingVec); player._initFrame();
  engine.camFwd.copy(player.heading); engine.camUp.copy(player.up);
  input.setTestIntent({ x: 0, y: 1, run: false });
  let maxDev = 0, nan = false;
  for (let i = 0; i < nSteps; i++) {
    step(1 / 60);
    const dev = Math.abs(player.position.length() - planet.R);
    if (dev > maxDev) maxDev = dev;
    const q = player.mesh.quaternion;
    if (Number.isNaN(player.position.x) || Number.isNaN(q.x) || Number.isNaN(q.w)) nan = true;
  }
  input.setTestIntent(null);
  return { maxDev, nan, end: player.position.clone() };
}

window.__selftest = function () {
  const log = [], R = planet.R;
  const full = Math.round((2 * Math.PI * R / player.speed) * 60);

  // A) 대원 한 바퀴 → 시작점 복귀 + 반지름 일정
  const start = planet.latLonToPos(5, 0).setLength(R);
  const a = runStraight(5, 0, new THREE.Vector3(0, 0, 1), full);
  const back = a.end.distanceTo(start);
  const aDevOK = a.maxDev < 1e-2, aNanOK = !a.nan, loopOK = back < R * 0.2;
  log.push(`A radius dev max=${a.maxDev.toExponential(2)} -> ${aDevOK ? 'PASS' : 'FAIL'}`);
  log.push(`A no NaN -> ${aNanOK ? 'PASS' : 'FAIL'}`);
  log.push(`A great-circle return dist=${back.toFixed(2)} (<${(R * 0.2).toFixed(1)}) -> ${loopOK ? 'PASS' : 'FAIL'}`);

  // B) 극점 통과: 적도(R,0,0)에서 +Y로 직진 → 북극 통과. 롤/플립/NaN 없어야.
  const b = runStraight(0, 0, new THREE.Vector3(0, 1, 0), Math.round(full * 0.6));
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
    const fr = planet.frameAt(spot.pos, spot.rot);
    group.position.copy(fr.position); group.quaternion.copy(fr.quaternion);
    if (def.onWater) group.position.addScaledVector(spot.dir, 0.25);   // 물 위로 살짝
    engine.scene.add(group);
    world.placed.push({ group, key: spot.asset, theme: 'hero', pos: spot.pos, dir: spot.dir });
  }
  console.log(`[healing] 히어로 배치 — GLB ${glbN}, 절차 폴백 ${fbN} / ${(world.heroSpots || []).length} 스폿`);
  world._heroGlb = glbN;
}
loadHealingEnv();

const load = document.getElementById('load');
if (load) load.style.display = 'none';
loop.start();
console.log('[boot] 무무 행성 집배원 — 힐링 존(해변·숲·꽃밭). __selftest()/__dbg로 검증.');
