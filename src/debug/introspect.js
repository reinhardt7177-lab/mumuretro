// 디버그 인트로스펙션 — window.__dbg / window.__selftest.
//
// v1에서 이 하네스가 찾아낸 것들: 팻말 대비 1.02:1, 풀 100만 삼각형, 길 위의 풀,
// 버튼 38px 겹침. 전부 눈으로는 못 봤을 것들이다. 재설계에서도 이건 먼저 세운다.
//
// installDebug에 넘기는 인자 목록이 곧 "이 게임의 상태 전부"다. 늘어나기 시작하면 그게 경고다.
import * as THREE from 'three';
import { LIGHT, SKY, FOG_DENSITY, HORIZON_U, SUN_ELEV_DEG } from '../data/lighting.js';

const ENTRY_Z_TEST = 10.0;   // layouts.ENTRY_Z. 여기서만 쓰므로 import를 늘리지 않는다

export function installDebug(ctx) {
  const { planet, player, engine, input, step, sky, scatter, carpet, PEAKS } = ctx;

  const srgb = (v) => (v /= 255, v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);

  window.__dbg = {
    // ── 위치 ────────────────────────────────────────────────────────────
    get pos() { return player.position.toArray().map(v => +v.toFixed(2)); },
    get altitude() { return +player.position.length().toFixed(3); },
    get height() { return +planet.heightAt(player.position.clone().normalize()).toFixed(2); },
    get slope() { return +planet.slopeDegAt(player.position.clone().normalize()).toFixed(1); },
    get R() { return planet.R; },
    warpToLatLon(lat, lon) {
      player.setLatLon(lat, lon);
      engine.camFwd.copy(player.heading); engine.camUp.copy(player.up);
      return this.pos;
    },
    warpToPeak(i = 0) {
      const p = PEAKS[i]; if (!p) return 'no peak';
      player.setLatLon(p.lat, p.lon);
      engine.camFwd.copy(player.heading); engine.camUp.copy(player.up);
      return `${p.lat}/${p.lon} h=${this.height}`;
    },

    // ── 지형 (§1) ───────────────────────────────────────────────────────
    // 높이 분포. 삼각형 규칙이 걸렸으면 최고점이 봉우리 목록의 최댓값 근처여야 하고,
    // 중앙값은 그보다 한참 낮아야 한다(=대부분이 평지, 소수가 봉우리).
    terrainRange(n = 6000) {
      let lo = Infinity, hi = -Infinity, sum = 0;
      const hs = [], v = new THREE.Vector3();
      let s = 7;
      const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
      for (let i = 0; i < n; i++) {
        const z = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
        const h = planet.heightAt(v.set(r * Math.cos(th), z, r * Math.sin(th)));
        hs.push(h); lo = Math.min(lo, h); hi = Math.max(hi, h); sum += h;
      }
      hs.sort((a, b) => a - b);
      return {
        min: +lo.toFixed(2), max: +hi.toFixed(2), avg: +(sum / n).toFixed(2),
        median: +hs[n >> 1].toFixed(2), p90: +hs[Math.floor(n * 0.9)].toFixed(2),
      };
    },

    // ★ §1의 핵심 검증: "어느 지점에 서도 가볼 만한 목표가 최소 두 개 보이는가".
    // 지평선(28u = 0.41rad) 안에 들어오는 봉우리를 센다.
    landmarkCoverage(samples = 400) {
      // 가시 거리는 봉우리 높이에 따라 다르다. 구면에서 눈높이 h₁, 물체 높이 h₂일 때
      //   d_max = √(2·R·h₁) + √(2·R·h₂)
      // 15u 봉우리는 73u 밖에서도 꼭대기가 보이지만 4u 봉우리는 51u가 한계다.
      // 전부 같은 반경으로 재면 작은 봉우리를 과대평가한다.
      const R = planet.R;
      const marks = PEAKS.map(p => {
        const la = p.lat * Math.PI / 180, lo = p.lon * Math.PI / 180;
        return {
          dir: new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)),
          maxAng: (HORIZON_U + Math.sqrt(2 * R * p.h)) / R,
          h: p.h,
        };
      });
      const hist = {}; let worst = 99, sum = 0;
      const v = new THREE.Vector3();
      let s = 13;
      const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
      const holes = [];
      for (let i = 0; i < samples; i++) {
        const z = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
        v.set(r * Math.cos(th), z, r * Math.sin(th));
        let n = 0;
        for (const m of marks) if (v.angleTo(m.dir) < m.maxAng) n++;
        hist[n] = (hist[n] || 0) + 1;
        if (n < 2) holes.push([Math.round(Math.asin(v.y) * 180 / Math.PI),
                               Math.round(((Math.atan2(v.z, v.x) * 180 / Math.PI) + 360) % 360)]);
        worst = Math.min(worst, n); sum += n;
      }
      return {
        visibleHist: hist, worst, avg: +(sum / samples).toFixed(2),
        holeCount: holes.length, holes: holes.slice(0, 16),
        rangeU: marks.map(m => +(m.maxAng * R).toFixed(0)),
      };
    },

    // ── 조명 · 대기 (§2 §3) ─────────────────────────────────────────────
    get lighting() {
      const s = engine.sun, h = engine.hemi;
      return {
        sunColor: '#' + s.color.getHexString(), sunIntensity: s.intensity,
        hemiSky: '#' + h.color.getHexString(), hemiGround: '#' + h.groundColor.getHexString(),
        exposure: engine.renderer.toneMappingExposure,
        elevDeg: SUN_ELEV_DEG,
        // 실제 태양 고도 검증 — 플레이어 up과 태양 방향의 각
        measuredElevDeg: +(90 - s.position.clone().sub(player.position).normalize()
          .angleTo(player.up) * 180 / Math.PI).toFixed(1),
      };
    },
    get fog() {
      // 사당 안에서 부르면 안개 없는 씬이라 f가 null이다. 계측이 게임을 죽이면 안 된다.
      const f = engine.scene.fog;
      if (!f) return { note: '실내(안개 없음)' };
      const at = (d) => +(1 - Math.exp(-Math.pow(d * f.density, 2))).toFixed(3);
      return {
        color: '#' + f.color.getHexString(), density: f.density,
        skyHorizon: '#' + sky.uniforms.uHorizon.value.getHexString(),
        matchesSky: '#' + f.color.getHexString() === '#' + sky.uniforms.uHorizon.value.getHexString(),
        convergence: { '8u': at(8), '16u': at(16), '28u': at(28), '45u': at(45), '62u': at(62) },
      };
    },
    get post() {
      const p = engine.post;
      return p ? { bloomStrength: p.bloom.strength, bloomThreshold: p.bloom.threshold,
                   saturation: p.saturation, enabled: p.enabled } : null;
    },

    // 렌더된 프레임의 픽셀을 직접 잰다. v1에서 문제를 찾아낸 방법 그대로.
    frameStats(step = 16) {
      engine.render();
      const c = engine.renderer.domElement;
      const s = document.createElement('canvas');
      s.width = c.width; s.height = c.height;
      const x = s.getContext('2d'); x.drawImage(c, 0, 0);
      const D = x.getImageData(0, 0, s.width, s.height).data;
      let L = 0, sat = 0, n = 0, blown = 0, dark = 0, clip = 0;
      for (let i = 0; i < D.length; i += 4 * step) {
        const r = D[i], g = D[i + 1], b = D[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        L += lum(r, g, b); sat += mx ? (mx - mn) / mx : 0; n++;
        if (mx > 250) blown++; if (mx < 25) dark++;
        // ★ 채널 클리핑 — 이걸 안 재서 그레이드 채도 1.28이 지형의 파랑을 통째로
        // 0으로 깎는 걸 놓칠 뻔했다. 어두운 화면은 눈에 띄지만 죽은 채널은 안 띈다.
        if ((mn === 0 && mx > 40) || mx === 255) clip++;
      }
      return {
        avgLum: +(L / n).toFixed(3), avgSatPct: +(sat / n * 100).toFixed(1),
        blownPct: +(100 * blown / n).toFixed(2), darkPct: +(100 * dark / n).toFixed(2),
        clippedPct: +(100 * clip / n).toFixed(2), samples: n,
      };
    },

    // ── 렌더 예산 ───────────────────────────────────────────────────────
    get budget() {
      const g = planet.mesh.geometry;
      return {
        terrainTris: g.attributes.position.count / 3,
        scatterTris: scatter ? Math.round(scatter.tris) : 0,
        carpetTris: carpet ? carpet.tris : 0,
        carpetCoveredPct: carpet ? +(carpet.coveredPct * 100).toFixed(1) : 0,
        scatterMeshes: scatter ? scatter.meshes.length : 0,
        scatterCounts: scatter ? scatter.counts : null,
        ridgeTris: sky.ridges.reduce((a, m) => a + m.geometry.index.count / 3, 0),
        sceneChildren: engine.scene.children.length,
      };
    },
    // ★ "맵에 구분이 있는가" — 이걸 안 재서 온 행성이 균일한 숲이 된 걸 놓쳤다.
    // 바이옴이 골고루 나오고, 특히 시야가 트인 구획(meadow)이 충분해야 §1이 성립한다.
    biomes(samples = 8000) {
      if (!scatter || !scatter.biomeAt) return null;
      const v = new THREE.Vector3(); const tally = {};
      let s = 5;
      const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
      for (let i = 0; i < samples; i++) {
        const z = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
        v.set(r * Math.cos(th), z, r * Math.sin(th));
        const b = scatter.biomeAt(planet.heightAt(v), planet.slopeDegAt(v), scatter.zoneAt(v));
        tally[b] = (tally[b] || 0) + 1;
      }
      const out = {};
      for (const k of Object.keys(tally)) out[k] = +(100 * tally[k] / samples).toFixed(1) + '%';
      return out;
    },
    // 나무 간격 — 숲 안에서 실제로 몇 u마다 한 그루인가.
    // 수관 반경이 1.4u쯤이라 3u 아래로 내려가면 걸어 다닐 수 없는 벽이 된다.
    treeSpacing() {
      if (!scatter) return null;
      const b = this.biomes(4000);
      const forestPct = parseFloat(b.forest || '0') / 100;
      const area = 4 * Math.PI * planet.R * planet.R * forestPct;
      const n = scatter.counts.tree;
      return {
        trees: n, forestArea: Math.round(area),
        perU2: +(n / area).toFixed(4),
        spacingU: +Math.sqrt(area / n).toFixed(1),
        canopyRadiusU: 1.4,
      };
    },

    // 컬링이 실제로 걸리는지 — v1에서 frustumCulled=false 하나가 100만 삼각형을 매 프레임
    // 통과시켰다. 그때 이걸 안 재서 몰랐다.
    get culling() {
      const all = scatter ? scatter.meshes : [];
      return {
        total: all.length,
        allCullable: all.every(m => m.frustumCulled === true),
        validSpheres: all.filter(m => m.boundingSphere && isFinite(m.boundingSphere.radius)).length,
      };
    },

    spec: { LIGHT, SKY, FOG_DENSITY, HORIZON_U },
  };

  // ── 결정론 셀프테스트 ─────────────────────────────────────────────────
  // v1에서 그대로 가져왔다. 구면 보행 코어를 손대지 않았음을 매번 확인한다.
  function runStraight(lat, lon, headingVec, nSteps, dt = 1 / 60) {
    player.setLatLon(lat, lon);
    player.heading.copy(headingVec); player._initFrame();
    engine.camFwd.copy(player.heading); engine.camUp.copy(player.up);
    input.setTestIntent({ x: 0, y: 1, run: false });
    let maxDev = 0, nan = false;
    const v = new THREE.Vector3();
    for (let i = 0; i < nSteps; i++) {
      step(dt);
      v.copy(player.position).normalize();
      const dev = Math.abs(player.position.length() - (planet.R + planet.heightAt(v)));
      if (dev > maxDev) maxDev = dev;
      const q = player.mesh.quaternion;
      if (Number.isNaN(player.position.x) || Number.isNaN(q.x) || Number.isNaN(q.w)) nan = true;
    }
    input.setTestIntent(null);
    return { maxDev, nan, end: player.position.clone() };
  }

  // ★ 행성 검사는 **반드시 행성 모드에서** 돈다. runStraight가 step()을 부르는데
  //   step()은 이제 mode로 갈린다 — 연구실에서 부르면 stepLab으로 가서 플레이어가
  //   한 발짝도 안 움직이고, 그런데도 "밀착 편차 0.00e+0 · 대원 복귀 0.00"이 찍힌다.
  //   아무것도 안 재고 켜지는 초록불은 없느니만 못하다.
  const onPlanet = ctx.withPlanetMode || ((fn) => fn());
  window.__selftest = () => onPlanet(_selftest);

  function _selftest() {
    const log = [], Rp = planet.R;
    // ★ A·B는 **구면 보행 코어**를 재는 테스트다. 충돌이 켜져 있으면 직진 중 나무에
    // 밀려나 "대원 한 바퀴 → 제자리 복귀"가 성립하지 않는다(충돌을 넣자마자 깨졌다).
    // 코어와 충돌은 서로 다른 것이므로 따로 잰다.
    const hadCollision = scatter && scatter.collision ? scatter.collision.enabled : false;
    if (scatter && scatter.collision) scatter.collision.enabled = false;
    const lapSec = 2 * Math.PI * Rp / player.speed;
    const STEPS = 1500, dt = lapSec / STEPS;

    // A) 대원 한 바퀴 → 시작점 복귀 + 표면 밀착
    const start = planet.latLonToPos(5, 0);
    const a = runStraight(5, 0, new THREE.Vector3(0, 0, 1), STEPS, dt);
    const back = a.end.distanceTo(start);
    const aDevOK = a.maxDev < 1e-2, aNanOK = !a.nan, loopOK = back < Rp * 0.2;
    log.push(`A 표면 밀착 max=${a.maxDev.toExponential(2)} -> ${aDevOK ? 'PASS' : 'FAIL'}`);
    log.push(`A NaN 없음 -> ${aNanOK ? 'PASS' : 'FAIL'}`);
    log.push(`A 대원 복귀 dist=${back.toFixed(2)} (<${(Rp * 0.2).toFixed(1)}) -> ${loopOK ? 'PASS' : 'FAIL'}`);

    // B) 극점 통과 — 롤/플립/NaN 없어야
    const b = runStraight(0, 0, new THREE.Vector3(0, 1, 0), Math.round(STEPS * 0.6), dt);
    const bDevOK = b.maxDev < 1e-2, bNanOK = !b.nan;
    log.push(`B 극점 통과 밀착=${b.maxDev.toExponential(2)} -> ${bDevOK ? 'PASS' : 'FAIL'}`);
    log.push(`B 극점 통과 NaN 없음 -> ${bNanOK ? 'PASS' : 'FAIL'}`);

    // C) §1 — 어디에 서도 랜드마크가 최소 2개 보이는가
    const cov = window.__dbg.landmarkCoverage(400);
    const covOK = cov.worst >= 2;
    log.push(`C 랜드마크 최소 가시수=${cov.worst} (>=2) -> ${covOK ? 'PASS' : 'FAIL'}`);

    // D) §3 — 안개 색이 하늘 지평선 색과 같은가
    const fogOK = window.__dbg.fog.matchesSky;
    log.push(`D 안개색 == 하늘 지평선색 -> ${fogOK ? 'PASS' : 'FAIL'}`);

    if (scatter && scatter.collision) scatter.collision.enabled = hadCollision;

    // E) 충돌 — 콜라이더 안으로 밀어 넣고 정확히 밖으로 나오는지
    let colOK = true;
    if (scatter && scatter.colliders && scatter.colliders.length) {
      const me = player.position.clone().normalize();
      let best = null, bd = 9;
      for (const c of scatter.colliders) { const d = me.angleTo(c.dir); if (d < bd) { bd = d; best = c; } }
      const tan = new THREE.Vector3().copy(me).addScaledVector(best.dir, -me.dot(best.dir)).normalize();
      const deep = (0.2 * best.r) / Rp;
      player.position.copy(best.dir).multiplyScalar(Math.cos(deep))
        .addScaledVector(tan, Math.sin(deep)).normalize();
      planet.projectToSurface(player.position);
      scatter.resolve(player.position, 0.32);
      const after = player.position.clone().normalize().angleTo(best.dir) * Rp;
      colOK = after >= best.r + 0.32 - 0.03;
      log.push(`E 충돌 밀어내기 ${after.toFixed(2)}u (>=${(best.r + 0.32).toFixed(2)}) -> ${colOK ? 'PASS' : 'FAIL'}`);
    }

    // ── F 사당을 걸어서 끝까지 지날 수 있는가 ─────────────────────────────
    // ★ 이걸 넣는 이유: 구간 사각형을 여백만큼 안쪽으로 줄여 검사하던 시절,
    //   맞닿기만 하고 겹치지 않는 이음매마다 폭 1.0u의 **못 걷는 띠**가 생겨
    //   아이가 첫 방에도 못 들어갔다. 텔레포트로 하는 검증은 이걸 절대 못 잡는다.
    //   방을 하나 더 붙이는 순간 되살아나는 종류라 상시 검사로 박아 둔다.
    let walkOK = true;
    // 사당마다 내부가 다르므로 **여섯을 다 걸어 본다.** 사당을 하나 붙일 때마다
    // 이음매가 새로 생기고, 이음매는 이 프로젝트에서 가장 자주 깨진 자리다.
    const ra = ctx.roomActor;
    if (ctx.roomFor && ctx.shrines && ra) {
      const savedRects = ra.rects, savedObs = ra.obstacles, savedPos = ra.position.clone();
      const hits = [];
      for (const sh of ctx.shrines.shrines) {
        const rm = ctx.roomFor(sh);
        const rects = rm.dungeon.rects;
        const open = rects.map((r) => r.open);
        rects.forEach((r) => { r.open = true; });    // 문을 전부 연 상태로 통로만 본다
        ra.rects = rects;
        ra.obstacles = [];                           // 신전의 석상에 걸려 멈추면 통로 문제가 아니다
        ra.setAt(0, ENTRY_Z_TEST, -1);
        const last = rects[rects.length - 1];
        for (let i = 0; i < 9000; i++) {
          ra.update(1 / 60, { x: 0, y: 1, run: true, jump: false }, engine.camera);
          if (ra.position.z < last.z1) break;
        }
        const seg = rm.dungeon.segmentAt(ra.position.z);
        const id = seg ? seg.id : '(밖)';
        if (id !== last.id) { walkOK = false; hits.push(`${rm.spec.id}:${id}@${ra.position.z.toFixed(1)}`); }
        rects.forEach((r, i) => { r.open = open[i]; });
      }
      ra.rects = savedRects; ra.obstacles = savedObs;
      ra.setAt(savedPos.x, savedPos.z, -1);
      log.push(`F 사당 관통 ${ctx.shrines.shrines.length}곳`
        + (walkOK ? ' 전부' : ` 실패=${hits.join(' ')}`) + ` -> ${walkOK ? 'PASS' : 'FAIL'}`);
    }

    // ── G 어느 칸에 서도 카메라가 물러날 수 있는가 ─────────────────────────
    // ★ 실사용에서 들은 말: "집이나 사당이나 공간감이 너무 협소하다, 특히 높이가
    //   낮아 답답하다." 재 보니 방이 좁은 게 아니라 **카메라가 천장 위에 서고
    //   싶어 했다** — 시선표적 1.25u + 6.5u·sin28.6° = 4.37u인데 복도 천장이
    //   3.2u였다. 55칸 중 19칸에서 카메라가 못 물러났고, 사당 입구 여섯 곳은
    //   전부 희망의 38%였다.
    //   이건 방을 하나 붙일 때마다 되살아나는 종류라 눈으로 볼 게 아니라 잰다.
    //   기준은 **희망 거리의 85%**. 카메라가 각도를 낮춰서라도 물러나야 한다.
    let camOK = true, hangOK = true;
    const camBad = [], hangBad = [];
    const _v3 = new THREE.Vector3();
    if (ctx.roomFor && ctx.shrines && ra) {
      const want = Math.max(3.2, Math.min(6.5, input.camDist));
      const savedR = ra.rects, savedO = ra.obstacles, savedP = ra.position.clone();
      const _bb = new THREE.Box3();
      const solidsOf = (scn) => {
        const out = [];
        scn.traverse((o) => {
          if (!o.isMesh || !o.material || o.material.transparent) return;
          if (o.material.visible === false || !o.visible) return;
          for (let p = o.parent; p; p = p.parent) if (p === player.mesh) return;
          out.push({ box: new THREE.Box3().setFromObject(o), o });
        });
        return out;
      };
      const scan = (rects, label, scn) => {
        ra.rects = rects; ra.obstacles = [];
        const outerZ = Math.max(...rects.map((r) => r.z1));
        // 벽·바닥·천장 슬래브는 카메라가 그 안에 있으면 그것도 버그다 — 다 넣는다.
        const solids = scn ? solidsOf(scn) : [];
        for (const r of rects) {
          // 칸 가운데와 앞뒤 1/4 지점 — 가운데만 재면 이음매 근처를 놓친다
          for (const f of [0.25, 0.5, 0.75]) {
            const z = r.z0 + (r.z1 - r.z0) * f;
            // 바깥 벽에서 6.5u 안쪽까지만 잰다. 카메라는 건물 밖으로 못 물러난다 —
            // 그건 고칠 수 있는 문제가 아니라 **모든 유한한 방이 가진 가장자리**다.
            // 대신 입구 통로를 카메라보다 길게 잡아 시작 지점이 그 가장자리에
            // 안 걸리게 했다(layouts.ENTRY_Z).
            if (z > outerZ - want) continue;
            ra.setAt((r.x0 + r.x1) / 2, z, -1);
            ra._camPlaced = false;
            ra.updateCamera(engine.camera, input, 1 / 60);
            const d = Math.hypot(engine.camera.position.x - ra.position.x,
              engine.camera.position.y - (ra.position.y + 1.25),
              engine.camera.position.z - ra.position.z);
            if (d < want * 0.85) {
              camOK = false;
              camBad.push(`${label}/${r.id}@${f}=${d.toFixed(1)}`);
            }
            // H — 세운 카메라가 물건 **안**인가. 추론이 아니라 그 점을 직접 본다.
            const cp = engine.camera.position;
            for (const sd of solids) {
              if (!sd.box.containsPoint(cp)) continue;
              hangOK = false;
              const sz = sd.box.getSize(_v3);
              hangBad.push(`${label}/${r.id}@${f}`
                + `[${sz.x.toFixed(1)}x${sz.y.toFixed(1)}x${sz.z.toFixed(1)}]`);
              break;
            }
          }
        }
      };
      if (ctx.lab) scan(ctx.lab.rects, '연구실', ctx.lab.scene);
      for (const sh of ctx.shrines.shrines) {
        const rm = ctx.roomFor(sh);
        scan(rm.dungeon.rects, rm.spec.id, rm.scene);
      }
      ra.rects = savedR; ra.obstacles = savedO;
      ra.setAt(savedP.x, savedP.z, -1); ra._camPlaced = false;
      log.push(`G 카메라 후퇴 >=${(want * 0.85).toFixed(1)}u`
        + (camOK ? ' 전 구간' : ` 실패 ${camBad.length}곳=${camBad.slice(0, 6).join(' ')}`)
        + ` -> ${camOK ? 'PASS' : 'FAIL'}`);
      log.push('H 카메라가 물건 밖'
        + (hangOK ? ' 전 구간' : ` 파묻힘 ${hangBad.length}=${hangBad.slice(0, 4).join(' ')}`)
        + ` -> ${hangOK ? 'PASS' : 'FAIL'}`);
    }

    // ── H 카메라가 물건 속으로 들어가지 않는가 ──────────────────────────────
    // ★ 연구실 갓등을 진짜로 매달았더니 방 한가운데 x=0, 하필 카메라 순항 높이
    //   4.37u에 걸렸다. 침상에서 소포까지 걸어가면 **반드시 갓 안을 통과**했고
    //   화면이 통째로 갓 안쪽 색으로 덮였다. 카메라는 벽만 보고 소품은 안 본다 —
    //   그건 그것대로 맞다(소품마다 카메라를 밀면 소품이 거리를 도로 뺏는다).
    //   그래서 규칙을 반대로 건다: **천장에 다는 것은 카메라 자리로 안 내려온다.**
    //
    //   ★ 처음엔 이걸 기하로 **추론**하려 했다 — "천장에 닿는데 아래로 내려오면
    //     걸린 것". 그러자 바닥부터 천장까지 선 기둥과 벽에 붙은 문까지 다 걸렸다.
    //     추론은 틀린 것을 잡고 맞는 것을 놓친다. 그래서 **재는 쪽으로 바꿨다** —
    //     카메라를 실제로 세워 보고 그 점이 물건 안에 있는지 본다. G와 같은 자리를
    //     쓰므로 값이 거의 안 든다.
    // ── I 만질 것에 **걸어서** 닿는가 ──────────────────────────────────────
    // ★ 콘솔을 원 하나(r 2.7)로 막았더니 밀려나는 거리가 손 닿는 거리(1.3u)보다
    //   멀어져서 다이얼을 영영 못 만졌다. 오프닝이 통째로 못 깨는 상태였는데
    //   **검사가 다이얼 좌표로 순간이동해서** 만지는 바람에 안 걸렸다.
    //   F가 "걸어서(텔레포트 말고) 지나가는가"를 재는 것과 같은 이유다 —
    //   닿는지는 걸어 봐야 안다. 장애물을 하나 놓을 때마다 되살아난다.
    let reachOK = true;
    const reachBad = [];
    if (ctx.lab) {
      const lab = ctx.lab;
      const savedR = ra.rects, savedO = ra.obstacles, savedP = ra.position.clone();
      ra.rects = lab.rects; ra.obstacles = lab.obstacles;
      // 만져야 하는 것 전부 — 다이얼 셋과 포탈 자리
      // ★ 목록은 Lab이 가진다. 검사가 목록을 따로 적으면 물건을 하나 옮길 때마다
      //   검사만 옛날 자리를 재게 되고, 그건 검사가 아니라 거짓말이다.
      const targets = lab.reachables;
      for (const t of targets) {
        // 여덟 방향에서 다가가 본다. 한 방향이라도 닿으면 된다.
        let best = Infinity, bx = 0, bz = 0;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          ra.setAt(t.x + Math.sin(a) * 5.0, t.z + Math.cos(a) * 5.0, -1);
          for (let i = 0; i < 400; i++) {
            const p = ra.position;
            const dx = t.x - p.x, dz = t.z - p.z;
            const L = Math.hypot(dx, dz);
            if (L < 0.05) break;
            // 목표 쪽으로 곧장 민다(카메라 기준 이동이므로 yaw를 맞춘다)
            ra.camYaw = Math.atan2(-dx, -dz);
            ra.update(1 / 60, { x: 0, y: 1, run: false, jump: false }, engine.camera);
          }
          const p = ra.position;
          const l = Math.hypot(t.x - p.x, t.z - p.z);
          if (l < best) { best = l; bx = p.x; bz = p.z; }
        }
        // 손 닿는 거리는 물건마다 다르다. 여백 0.15u는 걸음이 딱 떨어지지 않는 몫.
        if (best > t.r - 0.15) {
          reachOK = false;
          reachBad.push(`${t.name}=${best.toFixed(2)}u(닿는거리 ${t.r})`);
          continue;
        }
        // ★ 닿는 것만으로는 모자란다. **그것이 잡히는지**까지 봐야 한다.
        //   다이얼 셋이 겹쳐 있던 시절, 2번 앞에 서면 1번이 돌았다.
        //   닿기만 재는 검사는 그걸 전부 통과시킨다.
        ra.setAt(bx, bz, -1);
        const got = lab.pickAt(ra.position);
        if (got !== t.name) {
          reachOK = false;
          reachBad.push(`${t.name}자리에서 ${got || '아무것도'} 잡힘`);
        }
      }
      ra.rects = savedR; ra.obstacles = savedO;
      ra.setAt(savedP.x, savedP.z, -1); ra._camPlaced = false;
      log.push('I 연구실에서 걸어서 닿기'
        + (reachOK ? ' 전부' : ` 못 닿음 ${reachBad.join(' ')}`)
        + ` -> ${reachOK ? 'PASS' : 'FAIL'}`);
    }

    // ── J 표면에 세운 것이 하늘을 보는가 ──────────────────────────────────
    // ★ planet.frameAt이 makeBasis(e, up, n)으로 기저를 만들었는데 e × up = −n이라
    //   **왼손 기저**였다. 행렬식이 −1이면 그건 회전이 아니라 반사고,
    //   setFromRotationMatrix에 넣으면 엉뚱한 회전이 나온다. 그래서 사당 여섯이
    //   46°~110°씩 기울어 서 있었고 내림판은 아예 옆으로 누워 있었다.
    //   숫자로 재면 한 줄인데 눈으로는 "행성이 둥그니까 그런가 보다"로 넘어간다.
    let uprightOK = true;
    const tilt = [];
    {
      const q = new THREE.Quaternion(), y = new THREE.Vector3(), up = new THREE.Vector3();
      const chk = (name, grp, dir) => {
        grp.getWorldQuaternion(q);
        y.set(0, 1, 0).applyQuaternion(q);
        up.copy(dir).normalize();
        const deg = y.angleTo(up) * 180 / Math.PI;
        if (deg > 1) { uprightOK = false; tilt.push(`${name}=${deg.toFixed(1)}°`); }
      };
      if (ctx.shrines) ctx.shrines.shrines.forEach((sh, i) => chk(`사당${i}`, sh.group, sh.dir));
      if (ctx.landing) chk('내림판', ctx.landing.group, ctx.landing.dir);
      log.push('J 지면 구조물이 하늘을 봄'
        + (uprightOK ? ' 전부(<1°)' : ` 기울어짐 ${tilt.join(' ')}`)
        + ` -> ${uprightOK ? 'PASS' : 'FAIL'}`);
    }

    // ── K 조사가 맞는가 ───────────────────────────────────────────────────
    // ★ 화면에 "얼음**를** 원해요"가 떠 있었다. 이름을 문자열로 끼워 넣고 조사를
    //   손으로 붙였기 때문이다. 이름이 하나뿐이면 안 틀리는데 이 게임은
    //   얼음·물·수증기, 암모나이트·쇠구슬·모래처럼 **받침이 섞인 이름**을 같은
    //   문장에 넣는다. 그러면 반드시 하나는 틀린다.
    //   4학년이 읽는 앱에서 조사가 틀리는 건 오타가 아니라 가르치는 내용이 틀린 것이다.
    //
    //   을/를·과/와만 본다. 은/는·이/가는 "작은"·"높이"처럼 낱말 끝과 겹쳐
    //   오탐이 난다 — 오탐이 나는 검사는 곧 아무도 안 보는 검사가 된다.
    let josaOK = true;
    const josaBad = new Set();
    {
      const PAIR = { '을': true, '를': false, '과': true, '와': false };
      const bat = (ch) => {
        const c = ch.charCodeAt(0);
        if (c < 0xac00 || c > 0xd7a3) return null;
        return (c - 0xac00) % 28 !== 0;
      };
      const scan = (t) => {
        if (typeof t !== 'string' || !t) return;
        for (let k = 1; k < t.length; k++) {
          const pj = t[k];
          if (!(pj in PAIR)) continue;
          const b = bat(t[k - 1]);
          if (b !== null && b !== PAIR[pj]) { josaOK = false; josaBad.add(t); }
        }
      };
      const deep = (v, d = 0) => {
        if (d > 4) return;
        if (typeof v === 'string') scan(v);
        else if (Array.isArray(v)) v.forEach((x) => deep(x, d + 1));
        else if (v && typeof v === 'object') Object.values(v).forEach((x) => deep(x, d + 1));
      };
      const P = { x: 0, y: 0, z: 0 };
      if (ctx.roomFor && ctx.shrines) {
        for (const sh of ctx.shrines.shrines) {
          const rm = ctx.roomFor(sh);
          deep(rm.goals); deep(rm.hints);
          // 프롬프트는 상태에 따라 바뀐다 — 자리를 훑어 나오는 것을 전부 본다.
          // step()은 안 돈다(알림이 끼면 그건 다른 검사거리다).
          for (const r of rm.dungeon.rects) {
            for (let x = r.x0 + 0.9; x <= r.x1 - 0.9; x += 1.8) {
              for (let z = r.z0 + 0.9; z <= r.z1 - 0.9; z += 1.8) {
                P.x = x; P.z = z;
                const seg = rm.dungeon.segmentAt(z);
                for (const gt of rm.gates) {
                  if (seg && seg.id === gt.room && gt.gate.prompt) scan(gt.gate.prompt(P));
                }
                if (seg && seg.id === 'shrine') {
                  scan(rm.prize.prompt(P)); scan(rm.final.prompt(P));
                }
              }
            }
          }
        }
      }
      if (ctx.dialogue) deep(ctx.dialogue);
      if (ctx.lab) {
        const st = ctx.lab.state, keep = { ...st };
        for (const set of [{ hasNote: false, read: false, open: false },
          { hasNote: true, read: false, open: false },
          { hasNote: true, read: true, open: false },
          { hasNote: true, read: true, open: true }]) {
          Object.assign(st, set);
          for (const r of ctx.lab.rects) {
            for (let x = r.x0 + 0.9; x <= r.x1 - 0.9; x += 1.4) {
              for (let z = r.z0 + 0.9; z <= r.z1 - 0.9; z += 1.4) {
                P.x = x; P.z = z; scan(ctx.lab.prompt(P));
              }
            }
          }
        }
        Object.assign(st, keep);
      }
      log.push('K 조사(을/를·과/와)'
        + (josaOK ? ' 전부' : ` 틀림 ${josaBad.size}=${[...josaBad].slice(0, 3).join(' | ')}`)
        + ` -> ${josaOK ? 'PASS' : 'FAIL'}`);
    }

    const ok = aDevOK && aNanOK && loopOK && bDevOK && bNanOK && covOK && fogOK && colOK
      && walkOK && camOK && hangOK && reachOK && uprightOK && josaOK;
    console.log('%c[selftest]\n' + log.join('\n') + '\n=== ' + (ok ? 'ALL PASS ✅' : 'FAIL ❌') + ' ===',
      'font-family:monospace');

    player.setLatLon(6, -18);
    engine.camFwd.copy(player.heading); engine.camUp.copy(player.up);
    // 한 틱 돌려 카메라·태양을 새 위치에 맞춘다. 이게 없으면 테스트 직후
    // sun.position이 옮기기 전 플레이어 기준으로 남아 조명 계측이 엉뚱하게 나온다.
    step(1 / 60);
    return ok;
  }
}
