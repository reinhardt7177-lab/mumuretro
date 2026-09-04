// 디버그 인트로스펙션 — window.__dbg / window.__selftest.
//
// v1에서 이 하네스가 찾아낸 것들: 팻말 대비 1.02:1, 풀 100만 삼각형, 길 위의 풀,
// 버튼 38px 겹침. 전부 눈으로는 못 봤을 것들이다. 재설계에서도 이건 먼저 세운다.
//
// installDebug에 넘기는 인자 목록이 곧 "이 게임의 상태 전부"다. 늘어나기 시작하면 그게 경고다.
import * as THREE from 'three';
import { LIGHT, SKY, FOG_DENSITY, HORIZON_U, SUN_ELEV_DEG } from '../data/lighting.js';

export function installDebug(ctx) {
  const { planet, player, engine, input, step, sky, scatter, PEAKS } = ctx;

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
      const f = engine.scene.fog;
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
        scatterMeshes: scatter ? scatter.meshes.length : 0,
        scatterCounts: scatter ? scatter.counts : null,
        ridgeTris: sky.ridges.reduce((a, m) => a + m.geometry.index.count / 3, 0),
        sceneChildren: engine.scene.children.length,
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

  window.__selftest = function () {
    const log = [], Rp = planet.R;
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

    const ok = aDevOK && aNanOK && loopOK && bDevOK && bNanOK && covOK && fogOK;
    console.log('%c[selftest]\n' + log.join('\n') + '\n=== ' + (ok ? 'ALL PASS ✅' : 'FAIL ❌') + ' ===',
      'font-family:monospace');

    player.setLatLon(6, -18);
    engine.camFwd.copy(player.heading); engine.camUp.copy(player.up);
    // 한 틱 돌려 카메라·태양을 새 위치에 맞춘다. 이게 없으면 테스트 직후
    // sun.position이 옮기기 전 플레이어 기준으로 남아 조명 계측이 엉뚱하게 나온다.
    step(1 / 60);
    return ok;
  };
}
