// 디버그 인트로스펙션 — window.__dbg / window.__selftest.
//
// 왜 별도 파일인가: 이 블록은 게임의 거의 모든 시스템을 만지지만 게임에 아무것도 기여하지 않는다.
// boot.js에 두면 조립 코드 사이에 검증 코드가 278줄 섞여 "이 파일이 무슨 파일인지"가 흐려진다.
//
// 대신 의존이 인자로 드러난다 — installDebug에 넘기는 목록이 곧 "이 게임의 상태 전부"다.
// 값이 아니라 함수로 받는 것(dokkaebiCaught·finalTarget)은 boot.js에서 계속 바뀌는 지역 변수라
// 스냅샷으로 넘기면 영원히 초기값을 보고한다.
import * as THREE from 'three';
import { makeRNG } from '../util/math.js';
import { regionAt, MIST_ZONE } from '../data/regions.js';
import { parcelKindFor } from '../data/story.js';

export function installDebug(ctx) {
  const {
    planet, player, engine, input, world, step, surfaceDev,
    quest, trials, learning, abilities, badges, story, codex, nav, sky, atmosphere,
    customizer, emoji, dokkaebi, session, discovered, recipients, townsfolk, ghosts, actors,
    applyAbilities, updateTrialHUD, showIntro, showEnding, showSummary, summaryEl,
    dirOfPlayer: _dirOfPlayer, dokkaebiCaught, finalTarget,
  } = ctx;

  window.__dbg = {
    // 퀘스트 패널 — 목록/지도를 실제로 그려 보고 결과를 문자열로 확인한다.
    quest(open = true) {
      if (open) quest.show(); else quest.hide();
      return {
        open: quest.open,
        items: [...document.querySelectorAll('#questList .qi')]
          .map(e => `[${e.className.replace('qi ', '')}] ${e.querySelector('.qi-t').textContent}`),
        mapPx: quest.canvas ? `${quest.canvas.width}x${quest.canvas.height}` : null,
        bakeMs: +quest._bakeMs.toFixed(0),
        worstChunkMs: +quest._worstChunkMs.toFixed(1),
        paintMs: quest._paintMs ?? null,
      };
    },
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
        caughtTotal: dokkaebiCaught(),
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
      const before = dokkaebiCaught();
      const dir = new THREE.Vector3();
      input.setTestIntent({ x: 0, y: 1, run });
      let f = 0;
      for (; f < maxFrames; f++) {
        dir.copy(dokkaebi.position).sub(player.position);
        dir.addScaledVector(player.up, -dir.dot(player.up));
        if (dir.lengthSq() > 1e-9) { dir.normalize(); engine.camFwd.copy(dir); }
        step(1 / 60);
        if (dokkaebiCaught() > before) break;
      }
      input.setTestIntent(null);
      return { caught: dokkaebiCaught() > before, sec: +(f / 60).toFixed(1),
               dist: +(player.position.angleTo(dokkaebi.position) * planet.R).toFixed(1) };
    },
    // 탑을 향해 걸어가 실제로 막히는지 확인(통과 버그 회귀 안전망).
    // 정면으로 밀어붙였을 때 최종 거리가 콜라이더 반경 근처에서 멈춰야 한다.
    walkIntoTower(i = 0, frames = 600) {
      const t = trials.towers[i]; if (!t) return 'no tower';
      // 탑에서 12u 떨어진 곳에서 출발
      const away = new THREE.Vector3().copy(player.position).sub(t.pos);
      away.addScaledVector(t.dir, -away.dot(t.dir));
      if (away.lengthSq() < 1e-9) away.copy(engine.camFwd);
      away.normalize();
      player.position.copy(t.pos).addScaledVector(away, 12);
      planet.projectToSurface(player.position);
      const dir = new THREE.Vector3();
      input.setTestIntent({ x: 0, y: 1, run: false });
      let min = Infinity;
      for (let f = 0; f < frames; f++) {
        dir.copy(t.pos).sub(player.position);
        dir.addScaledVector(player.up, -dir.dot(player.up));
        if (dir.lengthSq() > 1e-9) { dir.normalize(); engine.camFwd.copy(dir); }
        step(1 / 60);
        min = Math.min(min, player.position.distanceTo(t.pos));
      }
      input.setTestIntent(null);
      return { name: t.name, hitR: +t.hitR.toFixed(2), minDist: +min.toFixed(2),
               finalDist: +player.position.distanceTo(t.pos).toFixed(2),
               blocked: min > t.hitR - 0.35, canEnter: !!trials.towerInRange(player.position) };
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
    get story() { return { ...story.state(), finalTarget: !!finalTarget() }; },
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
}
