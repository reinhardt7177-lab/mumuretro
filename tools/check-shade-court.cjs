const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES || '', 'playwright'));
const base = (process.env.AUDIT_URL || 'http://127.0.0.1:5512').replace(/\/$/, '');
const evidence = path.resolve(__dirname, '../reports/2026-09-08/evidence/shade-court'), out = path.resolve(__dirname, '../tmp/shade-court'); fs.mkdirSync(out, { recursive: true });
const legacy = fs.readFileSync(path.join(evidence, 'legacy-save.json'), 'utf8'), report = { date: new Date().toISOString(), checks: [], errors: [] };
function check(name, pass, details) { report.checks.push({ name, pass: !!pass, details }); assert.ok(pass, `${name}: ${JSON.stringify(details)}`); console.log('PASS ' + name); }
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    async function fresh(raw = legacy, mobile = false, broken = false) {
      const c = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
      await c.addInitScript(value => {
        const raf = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window), pending = new Map(); let id = 0;
        window.requestAnimationFrame = cb => { pending.set(++id, cb); return id; }; window.cancelAnimationFrame = key => pending.delete(key);
        window.releaseFrames = () => { window.requestAnimationFrame = raf; window.cancelAnimationFrame = cancel; for (const cb of pending.values()) raf(cb); pending.clear(); };
        localStorage.setItem('mumuplanet.progress.v1', value);
      }, raw);
      await c.route('**/*', async route => {
        if (!route.request().url().startsWith(base + '/')) return route.abort();
        if (broken && route.request().url().endsWith('/src/shrine/ShadeCourt.js')) {
          const response = await route.fetch(), source = await response.text(); assert.ok(source.includes('attr.setXYZ(index++, q.x, D.shadowY, q.z)'));
          return route.fulfill({ response, body: source.replace('attr.setXYZ(index++, q.x, D.shadowY, q.z)', 'attr.setXYZ(index++, q.x + 1, D.shadowY, q.z)') });
        } return route.continue();
      });
      const p = await c.newPage(); p.on('pageerror', e => report.errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) report.errors.push(m.text()); });
      await p.goto(base); await p.waitForFunction(() => window.game, null, { polling: 50, timeout: 45000 });
      await p.locator('#title .go').click({ force: true }); await p.waitForFunction(() => game.mode !== 'title', null, { polling: 50 });
      await p.evaluate(() => {
        game.loop.stop(); releaseFrames(); game.dialogue.close(); game.brief.hide();
        window.st = {
          tick(n = 1, intent = {}) { for (let i = 0; i < n; i++) { game.dialogue.close(); game.brief.hide(); game.input.setTestIntent(intent); game.step(1 / 60); } },
          walk(x, z) { let n = 0; while (Math.hypot(x - game.roomActor.position.x, z - game.roomActor.position.z) > 0.05 && n++ < 1000) {
            const p = game.roomActor.position; game.roomActor.camYaw = Math.atan2(-(x - p.x), -(z - p.z)); this.tick(1, { y: 1 });
          } if (n >= 1000) throw Error('Walk blocked ' + [x, z, ...game.roomActor.position.toArray()]); this.tick(); },
          render() { game.dialogue.close(); game.brief.hide(); const a = game.roomActor; a.camYaw = 0; game.input.camPitch = 0.38; game.input.camDist = 6.5;
            a.heading.set(0, 0, -1); a.syncMesh(); a._camPlaced = false; a.updateCamera(game.engine.camera, game.input, 0); game.engine.render(); },
        };
      });
      await p.waitForTimeout(900); return { c, p };
    }
    const { c, p } = await fresh();
    const migration = await p.evaluate(() => { const r = game.room; st.render(); return { seed: r.seed, state: r.exportState(), position: game.roomActor.position.toArray(), width: r.gates[0].gate.seg.x1 * 2 }; });
    check('Pre-upgrade shade save restores lamp phase, hint and safe entry', migration.seed === 4171220906 && migration.width === 14
      && migration.state.devices[0].version === 2 && migration.state.devices[0].fields.a === 0.7 && migration.state.hints.r1.t === 60
      && migration.position[2] === 4 && !migration.state.solved[0], { pos: migration.position, device: migration.state.devices[0] });
    fs.writeFileSync(path.join(out, 'migration.json'), JSON.stringify(migration, null, 2));
    await p.evaluate(() => { game.input.camPitch = 0.28; game.roomActor._camPlaced = false; game.roomActor.updateCamera(game.engine.camera, game.input, 0); game.engine.render(); });
    report.comparisonMetrics = await p.evaluate(() => {
      const info = game.engine.renderer.info, auto = info.autoReset; info.autoReset = false; info.reset(); game.engine.render(); const result = { ...info.render }; info.autoReset = auto; return result;
    });
    await p.screenshot({ path: path.join(out, 'after-comparison.png') });
    const audit = async page => page.evaluate(async () => {
      const THREE = await import('three'), g = game.room.gates[0].gate, old = g.a, samples = [];
      const ray = new THREE.Raycaster(), physical = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), point = new THREE.Vector3(), light = new THREE.Vector3(), dir = new THREE.Vector3();
      for (const a of [0, 0.7, 1.4, 2.1, Math.PI]) {
        g.a = a; const L = g._lampPos(); g.court.updateVisual(L); game.room.scene.updateMatrixWorld(true); light.set(L.x, L.y, L.z);
        let count = 0, renderMismatch = 0, geometryMismatch = 0, shadowed = 0;
        for (let x = g.seg.x0 + 0.51; x < g.seg.x1 - 0.5; x += 0.27) for (let z = g.safeOut + 0.13; z < g.safeIn - 0.1; z += 0.27) {
          if (g.pillars.some(p => Math.hypot(x - p.x, z - p.z) < 1.14)) continue;
          const safe = g.inShadow(x, z, L); ray.set(point.set(x, 1, z), down); ray.far = 2;
          const visible = ray.intersectObjects(g.pillars.map(p => p.shadow), false).length > 0;
          dir.set(x, 0, z).sub(light); const distance = dir.length(); physical.set(light, dir.normalize()); physical.far = distance - 0.001;
          const occluded = physical.intersectObjects(g.pillars.map(p => p.mesh), false).length > 0;
          if (visible !== safe) renderMismatch++; if (occluded !== safe) geometryMismatch++; if (safe) shadowed++; count++;
        } samples.push({ a, count, renderMismatch, geometryMismatch, shadowed });
      }
      g.a = old; g.court.updateVisual(g._lampPos()); return samples;
    });
    const geometry = await audit(p);
    check('Rendered shadow triangles agree with safety at five lamp phases', geometry.every(v => !v.renderMismatch && v.shadowed > 0), geometry);
    check('Actual pillar meshes block every safe ray and no lit ray', geometry.every(v => !v.geometryMismatch), geometry);
    const danger = await p.evaluate(() => {
      const r = game.room, g = r.gates[0].gate; r.restart(); r.hasProgress = true; game.roomActor.setAt(0, g.safeIn - 0.8);
      st.tick(20); const warning = g.eyeMat.opacity > 0 && r.shadeCourt.footWarning.material.opacity > 0;
      game.save(); const raw = localStorage.getItem('mumuplanet.progress.v1'), phase = g.a, exposure = g.expose;
      st.tick(Math.ceil(g.exposeMax * 60) + 20); return { warning, phase, exposure, raw, reset: game.roomActor.position.z > g.safeIn && g.expose === 0, resetPosition: game.roomActor.position.toArray(), hint: r.hints.r1.t };
    });
    check('Lit floor gives visible warning then returns player to safe entry', danger.warning && danger.exposure > 0 && danger.reset && danger.hint > 8, { ...danger, raw: undefined });
    const partial = await fresh(danger.raw);
    const resumed = await partial.p.evaluate(() => {
      const g = game.room.gates[0].gate, before = { a: g.a, expose: g.expose, z: game.roomActor.position.z }; st.tick(60);
      return { before, after: { a: g.a, expose: g.expose, z: game.roomActor.position.z } };
    });
    check('Partial exposure and phase restore safely, then warning recovers', Math.abs(resumed.before.a - danger.phase) < 1e-9
      && resumed.before.expose === danger.exposure && resumed.before.z === 4 && resumed.after.z === 4 && resumed.after.expose === 0 && resumed.after.a > resumed.before.a, resumed);
    await partial.c.close();
    const routes = [];
    for (const [tier, phase] of [[0, 0], [3, 1.4], [5, 2.7]]) {
      const result = await p.evaluate(async ({ tier, phase }) => {
        const { planShade } = await import('/tools/shade-walk-planner.js'), r = game.room, g = r.gates[0].gate, a = game.roomActor;
        r.restart(); r.hasProgress = true; r.applyTier(tier); a.setAt(0, 10); g.a = phase; g.court.updateVisual(g._lampPos()); st.walk(0, 4);
        const crossingPhase = g.a;
        const plan = await planShade(g); let maxExposure = 0, maxError = 0, failures = 0; const initialHint = r.hints.r1.t;
        for (const target of plan.path) {
          const dx = target.x - a.position.x, dz = target.z - a.position.z, moving = Math.hypot(dx, dz) > 0.01;
          if (moving) a.camYaw = Math.atan2(-dx, -dz);
          for (let f = 0; f < plan.frames; f++) { st.tick(1, moving ? { y: 1 } : {}); maxExposure = Math.max(maxExposure, g.expose); }
          const error = Math.hypot(target.x - a.position.x, target.z - a.position.z); maxError = Math.max(maxError, error); if (error > 0.12) { failures++; break; }
        }
        return { tier, phase, crossingPhase, seconds: plan.seconds, steps: plan.path.length, maxExposure, exposeMax: g.exposeMax, maxError, failures, solved: r.gates[0].solved, position: a.position.toArray(), hintAdded: r.hints.r1.t - initialHint };
      }, { tier, phase });
      routes.push(result); check(`Walk through moving shadows with ordinary movement at tier ${tier}`, result.solved && !result.failures && result.maxExposure < result.exposeMax, result);
      if (tier === 0) { await p.evaluate(() => st.render()); await p.screenshot({ path: path.join(out, 'after-crossing.png') }); }
    }
    report.routes = routes;
    const roundtrip = await p.evaluate(async () => {
      const { buildRoom } = await import('/src/shrine/Room.js'), r = game.room, g = r.gates[0].gate;
      const state = r.exportState(game.roomActor), next = buildRoom(r.spec, r.seed), valid = next.importState(state);
      const completed = valid && next.shadeCourt.completed;
      const bad = JSON.parse(JSON.stringify(state)); bad.devices[0].fields.a = -1; const before = JSON.stringify(r.exportState());
      const rejected = !r.importState(bad) && before === JSON.stringify(r.exportState());
      game.save(); return { completed, rejected, raw: localStorage.getItem('mumuplanet.progress.v1') };
    });
    check('Solved state restores and invalid phase rejects atomically', roundtrip.completed && roundtrip.rejected);
    const reload = await fresh(roundtrip.raw);
    check('New shrine save reopens with completed shadow crossing', await reload.p.evaluate(() => game.room.gates[0].solved && game.room.shadeCourt.completed)); await reload.c.close();
    await p.evaluate(() => { const g = game.room.gates[0].gate; st.walk(0, g.seg.z0 - 1); st.walk(0, 4); st.render(); });
    await p.screenshot({ path: path.join(out, 'after-court.png') });
    check('Return walk stays open and warning is off after completion', await p.evaluate(() => game.roomActor.position.z > 3.9 && game.room.gates[0].gate.eyeMat.opacity === 0));
    const camera = await p.evaluate(async () => {
      const THREE = await import('three'), r = game.room, g = r.gates[0].gate, a = game.roomActor, old = a.position.clone();
      const surfaces = [], ray = new THREE.Raycaster(), target = new THREE.Vector3(), dir = new THREE.Vector3();
      r.shadeCourt.group.traverse(m => { const materials = Array.isArray(m.material) ? m.material : [m.material];
        if (m.isMesh && materials.some(mat => mat?.isMeshStandardMaterial)) surfaces.push(m); });
      const positions = [[0, 4], [0, -3], [-6.45, -3], [6.45, -3], [g.pillars[0].x, g.pillars[0].z + 1.4], [g.pillars[2].x, g.pillars[2].z - 1.4]];
      let samples = 0; const failures = [];
      for (const [x, z] of positions) for (const pitch of [0.12, 0.38, 0.7]) for (let n = 0; n < 8; n++) {
        if (r.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r)) throw Error('Invalid camera fixture');
        a.setAt(x, z); a.camYaw = n * Math.PI / 4; game.input.camPitch = pitch; a._camPlaced = false; a.updateCamera(game.engine.camera, game.input, 0);
        target.copy(a.position).y += 1.25; dir.subVectors(game.engine.camera.position, target); const length = dir.length();
        ray.set(target, dir.normalize()); ray.far = length + 0.15;
        const hit = ray.intersectObjects(surfaces, false)[0]; if (hit) failures.push({ x, z, pitch, n, length, hit: hit.distance }); samples++;
      }
      a.setAt(old.x, old.z); st.render(); return { samples, failures };
    });
    check('144 camera directions avoid pillars, arches and lamp hardware', camera.failures.length === 0, camera);
    const collision = await p.evaluate(() => {
      const g = game.room.gates[0].gate, m = g.pillars[0], a = game.roomActor, old = a.position.clone();
      a.setAt(m.x, m.z + 1.5); a.camYaw = 0; st.tick(60, { y: 1 }); const distance = Math.hypot(a.position.x - m.x, a.position.z - m.z);
      a.setAt(old.x, old.z); st.render(); return distance;
    });
    check('Walking into a pillar stops outside its solid body', collision >= 1.12 - 1e-6, collision);
    report.metrics = await p.evaluate(() => { const info = game.engine.renderer.info, auto = info.autoReset; info.autoReset = false; info.reset(); game.engine.render(); const draw = { ...info.render }; info.autoReset = auto; return draw; });
    const broken = await fresh(legacy, false, true), brokenAudit = await audit(broken.p);
    check('Fault injection catches drawing shadows one metre away from safe area', brokenAudit.some(v => v.renderMismatch > 0), brokenAudit); await broken.c.close();
    const phone = await fresh(legacy, true); await phone.p.evaluate(() => { st.tick(); st.render(); game.input.setTestIntent(null); });
    await phone.p.screenshot({ path: path.join(out, 'after-mobile.png') });
    await phone.p.locator('#tcNote').tap();
    check('Mobile notebook pauses rotating lamp and exposure', await phone.p.evaluate(() => { const g = game.room.gates[0].gate, a = g.a, e = g.expose;
      game.step(0.2); return game.notebook.isOpen && g.a === a && g.expose === e; }));
    await phone.p.locator('#nbX').tap(); await phone.c.close();
    check('No JavaScript or shader errors', report.errors.length === 0, report.errors); await c.close();
  } catch (e) { report.failure = e.stack; console.error(e); process.exitCode = 1; }
  finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
})();
