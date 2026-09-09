const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES || '', 'playwright'));
const base = (process.env.AUDIT_URL || 'http://127.0.0.1:5512').replace(/\/$/, '');
const evidence = path.resolve(__dirname, '../reports/2026-09-08/evidence/silhouette-court');
const out = path.resolve(__dirname, '../tmp/silhouette-court'); fs.mkdirSync(out, { recursive: true });
const legacy = fs.readFileSync(path.join(evidence, 'legacy-save.json'), 'utf8'), baseline = JSON.parse(fs.readFileSync(path.join(evidence, 'before.json')));
const report = { date: new Date().toISOString(), checks: [], errors: [] };
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
        if (broken && route.request().url().endsWith('/src/shrine/SilhouetteCourt.js')) {
          const response = await route.fetch(), source = await response.text(); assert.ok(source.includes('g.shadow.scale.set(clipped, clipped, 1)'));
          return route.fulfill({ response, body: source.replace('g.shadow.scale.set(clipped, clipped, 1)', 'g.shadow.scale.set(clipped * 0.7, clipped * 0.7, 1)') });
        } return route.continue();
      });
      const p = await c.newPage(); p.on('pageerror', e => report.errors.push(e.message));
      p.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) report.errors.push(m.text()); });
      await p.goto(base); await p.waitForFunction(() => window.game, null, { polling: 50, timeout: 45000 });
      await p.locator('#title .go').click({ force: true }); await p.waitForFunction(() => game.mode !== 'title', null, { polling: 50 });
      await p.evaluate(() => {
        game.loop.stop(); releaseFrames(); game.dialogue.close(); game.brief.hide();
        window.st = {
          tick(n = 1, intent = {}) { for (let i = 0; i < n; i++) { game.dialogue.close(); game.brief.hide(); game.input.setTestIntent(intent); game.step(1 / 60); } },
          walk(x, z) { let n = 0; while (Math.hypot(x - game.roomActor.position.x, z - game.roomActor.position.z) > 0.05 && n++ < 1000) {
            const p = game.roomActor.position; game.roomActor.camYaw = Math.atan2(-(x - p.x), -(z - p.z)); this.tick(1, { y: 1 });
          } if (n >= 1000) throw Error('Walk blocked ' + [x, z, ...game.roomActor.position.toArray()]); this.tick(); return n; },
          stage() { const r = game.room; r.restart(); r.hasProgress = true;
            r.gates.slice(0, 2).forEach(w => { w.solved = true; w.gate.restoreSolved?.(true); r.dungeon.openDoor(w.room); });
            game.roomActor.setAt(0, r.gates[2].gate.seg.z1 + 3); },
          render(pitch = 0.28) { this.tick(); game.dialogue.close(); game.brief.hide(); const a = game.roomActor;
            a.camYaw = 0; game.input.camPitch = pitch; game.input.camDist = 6.5; a.heading.set(0, 0, -1);
            a.syncMesh(); a._camPlaced = false; a.updateCamera(game.engine.camera, game.input, 0); game.engine.render(); },
        };
      });
      await p.waitForTimeout(900); return { c, p };
    }
    const { c, p } = await fresh();
    const migration = await p.evaluate(() => { const r = game.room, g = r.gates[2].gate, before = r.exportState(); st.tick(60);
      return { seed: r.seed, before, after: r.exportState(), position: game.roomActor.position.toArray(), handle: g.theatre.handle() }; });
    check('Legacy held panel restores distance, target, hints and opened doors without scoring', migration.seed === baseline.seed
      && migration.before.devices[2].version === 2 && migration.before.devices[2].fields.held
      && migration.before.devices[2].fields.objZ === migration.after.devices[2].fields.objZ
      && migration.before.devices[2].fields.round === migration.after.devices[2].fields.round
      && migration.before.solved.join(',') === 'true,true,false' && migration.before.hints.r3.t === 60
      && Math.abs(migration.position[0] - migration.handle.x) < 1e-8, { position: migration.position, fields: migration.before.devices[2].fields });
    await p.evaluate(() => { const g = game.room.gates[2].gate; g.held = false; game.roomActor.setAt(0, g.seg.z1 - 1); st.render(); });
    report.comparisonMetrics = await p.evaluate(() => { const info = game.engine.renderer.info, auto = info.autoReset; info.autoReset = false; info.reset(); game.engine.render(); const v = { ...info.render }; info.autoReset = auto; return v; });
    await p.screenshot({ path: path.join(out, 'after-comparison.png') });
    const audit = async page => page.evaluate(async () => {
      const THREE = await import('three'), g = game.room.gates[2].gate, old = g.objZ, rows = [], light = g.lampBall.position.clone();
      const physical = new THREE.Raycaster(), drawn = new THREE.Raycaster(), point = new THREE.Vector3(), dir = new THREE.Vector3();
      const bodies = []; g.theatre.carriage.traverse(m => { if (m.isMesh) bodies.push(m); });
      for (const distance of [1.2, 2.8, 4.4, 6.4, 9.2]) {
        g.objZ = g.lampZ - distance; g._resize(); game.room.scene.updateMatrixWorld(true);
        let count = 0, mismatch = 0, shadowed = 0; const squares = [g.shadow, g.theatre.stemShadow].filter(m => m.visible);
        for (let x = g.objX - 1.971; x < g.objX + 1.99; x += 0.065) for (let y = light.y - 1.973; y < light.y + 1.99; y += 0.065) {
          point.set(x, y, g.wallZ); dir.copy(point).sub(light); const length = dir.length(); physical.set(light, dir.normalize()); physical.far = length;
          const blocked = physical.intersectObjects(bodies, false).length > 0;
          drawn.set(point.set(x, y, g.wallZ + 0.1), dir.set(0, 0, -1)); drawn.far = 0.15;
          const visible = drawn.intersectObjects(squares, false).length > 0;
          if (blocked !== visible) mismatch++; if (blocked) shadowed++; count++;
        }
        const vertices = g.obj.geometry.attributes.position, points = [];
        for (let i = 0; i < vertices.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(g.obj.matrixWorld), t = (g.wallZ - light.z) / (v.z - light.z);
          points.push({ x: light.x + t * (v.x - light.x), y: light.y + t * (v.y - light.y) });
        }
        const actualWidth = Math.max(...points.map(v => v.x)) - Math.min(...points.map(v => v.x));
        const actualY = (Math.max(...points.map(v => v.y)) + Math.min(...points.map(v => v.y))) / 2;
        rows.push({ distance, count, mismatch, shadowed, actualWidth, formulaWidth: g._size(), actualY, drawnY: g.shadow.position.y });
      }
      g.objZ = old; g._resize(); return rows;
    });
    const optics = await audit(p); report.optics = optics;
    check('Actual panel projection agrees with distance law and screen centre', optics.every(v => Math.abs(v.actualWidth - v.formulaWidth) < 1e-6 && Math.abs(v.actualY - v.drawnY) < 1e-6), optics);
    check('Visible clipped shadows match all opaque carriage parts at five distances', optics.every(v => !v.mismatch && v.shadowed > 0), optics);
    const screenGap = await p.evaluate(async () => {
      const THREE = await import('three'), r = game.room, g = r.gates[2].gate, frames = r.scene.children.filter(m => m.userData.doorFrame === g.seg.id);
      r.scene.updateMatrixWorld(true); const front = Math.max(...frames.map(m => new THREE.Box3().setFromObject(m).max.z));
      return g.wallZ - front;
    });
    check('Exit frame stays behind screen instead of sharing its surface', screenGap > 0.1, screenGap);
    const freshness = await p.evaluate(async () => {
      const { buildRoom } = await import('/src/shrine/Room.js'), results = [];
      for (const seed of [1, 3, 8, 15, 77, 2026, 9137, 39144]) {
        const r = buildRoom(game.SHRINES[1], seed), g = r.gates[2].gate; r.hasProgress = true; const initial = g.round;
        r.restart(); const restarted = g.round; g.held = true; g.objZ = g.answers[0]; g._resize(); const rendered = g.round;
        results.push({ seed, initial, restarted, rendered });
      } return results;
    });
    check('Construction, restart and rendering never advance a puzzle', freshness.every(v => v.initial === 0 && v.restarted === 0 && v.rendered === 0), freshness);
    const walks = [];
    for (const tier of [0, 3, 5]) {
      const route = await p.evaluate(tier => {
        st.stage(); const r = game.room, g = r.gates[2].gate, a = game.roomActor; r.applyTier(tier);
        let steps = st.walk(0, g.seg.z1 - 1); steps += st.walk(g.theatre.handle().x, g.objZ + 0.6);
        const z = g.objZ; st.tick(1, { action: true }); st.tick(); const grabNoSnap = g.held && g.objZ === z;
        st.tick(1, { action: true }); st.tick(); const released = !g.held;
        const rounds = [];
        for (let n = 0; n < 3; n++) {
          steps += st.walk(g.theatre.handle().x, g.objZ); st.tick(1, { action: true }); st.tick(); if (!g.held) throw Error('Unable to grab handle');
          const target = g.answers[g.round] + g.dragOffset; steps += st.walk(g.theatre.handle().x, target);
          if (g.round !== n + 1 || g.held) throw Error('Did not match round ' + n);
          rounds.push({ round: g.round, objZ: g.objZ, size: g._size() });
        }
        steps += st.walk(0.6, a.position.z); steps += st.walk(0.6, g.seg.z0 - 3);
        const state = r.exportState(a); return { tier, steps, rounds, grabNoSnap, released, solved: r.gates[2].solved, exitZ: a.position.z, state };
      }, tier);
      walks.push({ ...route, state: undefined }); if (tier === 5) report.completedState = route.state;
    }
    check('Walk to handle, grab without snapping, release, solve all rounds and exit at three tiers', walks.every(v => v.grabNoSnap && v.released && v.solved && v.exitZ < -51), walks);
    const detached = await p.evaluate(() => {
      st.stage(); const g = game.room.gates[2].gate; st.walk(0, g.seg.z1 - 1); st.walk(g.theatre.handle().x, g.objZ);
      st.tick(1, { action: true }); st.tick(); const z = g.objZ; st.walk(2, game.roomActor.position.z);
      return { released: !g.held, stationary: g.objZ === z };
    });
    check('Walking away from handle releases panel without dragging it sideways', detached.released && detached.stationary, detached);
    const saved = await p.evaluate(() => {
      st.stage(); const g = game.room.gates[2].gate; st.walk(0, g.seg.z1 - 1); st.walk(g.theatre.handle().x, g.objZ + 0.5);
      st.tick(1, { action: true }); st.tick(); st.walk(g.theatre.handle().x, game.roomActor.position.z + 0.3); game.save();
      const r = game.room, state = r.exportState(), before = JSON.stringify(state), bad = JSON.parse(before); bad.devices[2].fields.holeW *= 1.5;
      const rejected = !r.importState(bad) && JSON.stringify(r.exportState()) === before;
      return { raw: localStorage.getItem('mumuplanet.progress.v1'), state, rejected };
    });
    check('Inconsistent target is rejected before any live state changes', saved.rejected);
    const restored = await fresh(saved.raw);
    const resume = await restored.p.evaluate(() => { const g = game.room.gates[2].gate, before = game.room.exportState(), z = g.objZ; st.tick(60); const idle = g.objZ === z && g.round === before.devices[2].fields.round;
      st.walk(g.theatre.handle().x, game.roomActor.position.z - 0.2); return { before, idle, delta: g.objZ - z, held: g.held }; });
    check('Reload preserves grabbed offset and resumes moving without a jump or free answer', JSON.stringify(resume.before) === JSON.stringify(saved.state)
      && resume.idle && Math.abs(resume.delta + 0.2) < 0.055 && resume.held, { idle: resume.idle, delta: resume.delta, held: resume.held }); await restored.c.close();
    const camera = await p.evaluate(async () => {
      const THREE = await import('three'), g = game.room.gates[2].gate, r = game.room, a = game.roomActor;
      g.held = false; const surfaces = r.silhouetteCourt.cameraOccluders, target = new THREE.Vector3(), dir = new THREE.Vector3(), ray = new THREE.Raycaster();
      const failures = []; let samples = 0, min = Infinity;
      for (const [x, z] of [[0, -38], [-1.65, -41], [-1.65, -45.5], [0.6, -47.5], [5.5, -43], [-6, -43]]) for (const pitch of [0.12, 0.38, 0.7]) for (let n = 0; n < 8; n++) {
        a.setAt(x, z); a.camYaw = n * Math.PI / 4; game.input.camPitch = pitch; game.input.camDist = 6.5;
        a._camPlaced = false; r.scene.updateMatrixWorld(true); a.updateCamera(game.engine.camera, game.input, 0);
        target.copy(a.position); target.y += 1.25; dir.copy(game.engine.camera.position).sub(target); const length = dir.length(); min = Math.min(min, length);
        ray.set(target, dir.normalize()); ray.far = length + 0.15; const hit = ray.intersectObjects(surfaces, false)[0];
        if (hit) failures.push({ x, z, pitch, n, length, hit: hit.distance }); samples++;
      }
      return { samples, min, failures };
    });
    check('144 camera directions avoid screen, panel, lamp and arches', camera.failures.length === 0, camera);
    const bridge = await p.evaluate(() => {
      const r = game.room, g = r.gates[0].gate, a = game.roomActor, phase = g.a, rows = [];
      for (let i = 0; i < 32; i++) { g.a = i * Math.PI / 16; g.court.updateVisual(g._lampPos());
        a.setAt(0, -15.5); game.input.camPitch = 0.7; game.input.camDist = 6.5; a._camPlaced = false;
        a.updateCamera(game.engine.camera, game.input, 0); const target = a.position.clone(); target.y += 1.25;
        rows.push(game.engine.camera.position.distanceTo(target));
      } g.a = phase; g.court.updateVisual(g._lampPos()); return rows;
    });
    check('Moving lamp cannot collapse camera distance on connecting bridge', bridge.every(d => d >= 6.5 * 0.85), { phases: bridge.length, min: Math.min(...bridge) });
    const collision = await p.evaluate(() => {
      const g = game.room.gates[2].gate, a = game.roomActor; g.held = false;
      a.setAt(g.objX, g.objZ + 1.6); a.camYaw = 0; st.tick(45, { y: 1 }); const panel = Math.hypot(a.position.x - g.objX, a.position.z - g.objZ);
      a.setAt(g.objX, g.wallZ + 1.2); a.camYaw = 0; st.tick(45, { y: 1 }); const screen = a.position.z - g.wallZ; return { panel, screen };
    });
    check('Walking into carriage and screen stops outside visible solids', collision.panel >= 0.9 - 1e-6 && collision.screen >= 0.5, collision);
    await p.evaluate(() => { st.stage(); const g = game.room.gates[2].gate; st.walk(0, g.seg.z1 - 2.5); st.render(0.22); });
    await p.screenshot({ path: path.join(out, 'after-court.png') });
    const broken = await fresh(legacy, false, true), brokenOptics = await audit(broken.p);
    check('Fault injection detects drawing panel shadow 30 percent too small', brokenOptics.some(v => v.mismatch > 0), brokenOptics); await broken.c.close();
    const phone = await fresh(legacy, true);
    await phone.p.evaluate(() => { st.tick(); st.render(0.22); game.input.setTestIntent(null); });
    await phone.p.waitForTimeout(250);
    await phone.p.screenshot({ path: path.join(out, 'after-mobile.png') });
    const hud = await phone.p.evaluate(() => { const p = document.getElementById('prompt').getBoundingClientRect(), n = document.getElementById('note').getBoundingClientRect();
      return { promptTop: p.top, noteBottom: n.bottom, gap: p.top - n.bottom }; });
    check('Wrapped mobile prompt and notification have a visible gap', hud.gap >= 7, hud);
    const oldHud = await phone.p.evaluate(() => { const p = document.getElementById('prompt'), n = document.getElementById('note');
      n.style.bottom = '112px'; const gap = p.getBoundingClientRect().top - n.getBoundingClientRect().bottom; n.style.removeProperty('bottom'); return gap; });
    check('Fault injection catches old fixed notification position overlapping long prompt', oldHud < 0, oldHud);
    const responsive = [];
    for (const viewport of [{ width: 844, height: 390 }, { width: 1280, height: 800 }]) {
      await phone.p.setViewportSize(viewport); await phone.p.waitForTimeout(220);
      responsive.push(await phone.p.evaluate(() => { const p = document.getElementById('prompt').getBoundingClientRect(), n = document.getElementById('note').getBoundingClientRect();
        return { width: innerWidth, height: innerHeight, gap: p.top - n.bottom, noteTop: n.top }; }));
    }
    check('Notification remains separate after landscape and desktop resizing', responsive.every(v => v.gap >= 7 && v.noteTop > 0), responsive);
    await phone.p.setViewportSize({ width: 390, height: 844 }); await phone.p.waitForTimeout(200);
    await phone.p.locator('#tcAct').tap(); await phone.p.evaluate(() => { game.step(1 / 60); game.step(1 / 60); });
    check('Touch release remains available while dragging', await phone.p.evaluate(() => !game.room.gates[2].gate.held));
    await phone.p.locator('#tcAct').tap(); await phone.p.evaluate(() => { game.step(1 / 60); game.step(1 / 60); });
    check('Touch can grab again at the same handle', await phone.p.evaluate(() => game.room.gates[2].gate.held));
    await phone.p.locator('#tcNote').tap();
    check('Mobile notebook pauses dragged panel and round state', await phone.p.evaluate(() => { const g = game.room.gates[2].gate, z = g.objZ, n = g.round;
      game.input.setTestIntent({ y: 1 }); game.step(0.2); return game.notebook.isOpen && g.objZ === z && g.round === n; }));
    await phone.p.locator('#nbX').tap(); await phone.c.close();
    check('No JavaScript or shader errors', report.errors.length === 0, report.errors); await c.close();
  } catch (e) { report.failure = e.stack; console.error(e); process.exitCode = 1; }
  finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
})();
