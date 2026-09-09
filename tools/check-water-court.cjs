// Walk from the shrine entrance through all water puzzles; no actor teleports for reachability.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = process.env.AUDIT_NODE_MODULES ? require(path.join(process.env.AUDIT_NODE_MODULES, 'playwright')) : require('playwright');
const base = (process.env.AUDIT_URL || 'http://127.0.0.1:5512').replace(/\/$/, '');
const out = path.resolve(__dirname, '../tmp/water-court'); fs.mkdirSync(out, { recursive: true });
const report = { date: new Date().toISOString(), checks: [], errors: [] };
function check(name, pass, details) { report.checks.push({ name, pass: !!pass, details }); assert.ok(pass, name + ': ' + JSON.stringify(details)); console.log('PASS ' + name); }
async function harness(p) {
  await p.evaluate(() => {
    game.loop.stop();
    window.courtTest = {
      tick(n = 1, intent = {}) {
        for (let i = 0; i < n; i++) { game.dialogue.close(); game.brief.hide(); game.input.setTestIntent(intent); game.step(1 / 60); }
      },
      walk(x, z) {
        let n = 0, peak = game.roomActor.position.y;
        while (Math.hypot(x - game.roomActor.position.x, z - game.roomActor.position.z) > 0.13 && n++ < 2400) {
          const p = game.roomActor.position; game.roomActor.camYaw = Math.atan2(-(x - p.x), -(z - p.z));
          this.tick(1, { y: 1, run: true }); peak = Math.max(peak, p.y);
        }
        if (n >= 2400) throw Error(`Walk blocked toward ${x},${z} at ${game.roomActor.position.toArray()} / ${document.querySelector('#prompt')?.textContent}`);
        this.tick(1); return { frames: n, peak, position: game.roomActor.position.toArray() };
      },
      act() { this.tick(1, { action: true }); this.tick(1); },
      temp(want, lever) {
        this.walk(lever.x, lever.z); let i = 0;
        while (game.room.gates[2].gate.state !== want && i++ < 3) this.act();
        if (game.room.gates[2].gate.state !== want) throw Error('Temperature lever failed');
      },
      render() { game.dialogue.close(); game.brief.hide(); game.roomActor.camYaw = 0; game.input.camPitch = 0.28; game.input.camDist = 6.5;
        game.roomActor.heading.set(0, 0, -1); game.roomActor.syncMesh();
        game.roomActor._camPlaced = false; game.roomActor.updateCamera(game.engine.camera, game.input, 0); game.engine.render(); },
      approach() {
        const freeze = game.room.gates[0].gate, slide = game.room.gates[1].gate, walks = [];
        for (const b of freeze.bands) { walks.push(this.walk(b.lever.x, b.lever.z)); this.act(); this.tick(75); }
        walks.push(this.walk(-3, freeze.seg.z0 + 0.7)); walks.push(this.walk(0, freeze.seg.z0 + 0.7));
        walks.push(this.walk(0, slide.seg.z1 - 1)); walks.push(this.walk(0, slide.seg.z0 - 1.5));
        walks.push(this.walk(0, game.room.gates[2].gate.seg.z1 - 1.5)); this.render(); return walks;
      },
    };
  });
}
(async () => {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    async function fresh(breakFloor = false, savedRaw = null, mobile = false) {
      const c = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 }, isMobile: mobile, hasTouch: mobile });
      await c.route('**/*', async route => {
        if (!route.request().url().startsWith(base + '/')) return route.abort();
        if (breakFloor === true && route.request().url().endsWith('/src/shrine/RoomActor.js')) {
          const response = await route.fetch(); const source = await response.text();
          return route.fulfill({ response, body: source.replace('return this.rects.floorAt?.(x, z, y) ?? 0;', 'return 0;') });
        }
        if (breakFloor === 'save' && route.request().url().endsWith('/src/shrine/WaterProgress.js')) {
          const response = await route.fetch(); const source = await response.text();
          return route.fulfill({ response, body: source.replace('live.filled = v.filled[i];', 'live.filled = false;') });
        }
        return route.continue();
      });
      if (savedRaw) await c.addInitScript(raw => localStorage.setItem('mumuplanet.progress.v1', raw), savedRaw);
      const p = await c.newPage(); p.on('pageerror', e => report.errors.push(e.message));
      p.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) report.errors.push(m.text()); });
      await p.goto(base); await p.waitForFunction(() => window.game, null, { timeout: 45000 });
      await p.locator('#title .go').click(); await p.waitForFunction(() => game.mode !== 'title');
      if (!savedRaw) await p.evaluate(() => {
        game.loop.stop(); game.dialogue.close(); game.lab.importState({ version: 1, dials: [3, 5, 8], hasNote: true, read: true, open: true, done: false, sent: false });
        game.notebook.setHas(true); game.landOnPlanet(); game.dialogue.close(); game.enterShrine(game.shrines.shrines[3]);
      });
      await harness(p);
      await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('#flash')).opacity) < 0.01);
      await p.waitForFunction(() => !document.querySelector('#title').classList.contains('on'));
      return { c, p };
    }
    const { c, p } = await fresh();
    const phaseSave = await p.evaluate(() => {
      const gate = game.room.gates[0].gate, band = gate.bands[0];
      courtTest.walk(band.lever.x, band.lever.z); courtTest.act(); courtTest.tick(20);
      const freezing = game.room.exportState(game.roomActor), okFreezing = game.room.importState(freezing);
      const sameTime = gate.bands[0].t === freezing.freeze[0].t;
      courtTest.tick(75); courtTest.walk(-3, 1.4);
      const onIce = game.room.exportState(game.roomActor), safe = onIce.checkpoint.z === gate.bands[0].lever.z;
      const okIce = game.room.importState(onIce); game.room.resume(game.roomActor);
      game.room.restart(); game.room.hasProgress = true; game.roomActor.setAt(0, 10);
      return { okFreezing, sameTime, phase: freezing.freeze[0].phase, okIce, safe };
    });
    check('Freezing timer restores and temporary ice saves a safe island checkpoint', phaseSave.okFreezing && phaseSave.sameTime && phaseSave.phase === 'freezing' && phaseSave.okIce && phaseSave.safe, phaseSave);
    const approach = await p.evaluate(() => ({ walks: courtTest.approach(), solved: game.room.gates.map(g => g.solved) }));
    check('Walk from entrance, freeze three bands and cross slippery room', approach.solved[0] && approach.solved[1] && !approach.solved[2], approach);
    await p.screenshot({ path: path.join(out, 'court-entry.png') });
    const ground = await p.evaluate(() => {
      const z = game.room.gates[2].gate.seg.z1 - 16;
      courtTest.walk(-5.4, game.room.gates[2].gate.seg.z1 - 1.5); courtTest.walk(-5.4, z);
      const before = game.roomActor.position.clone(); game.roomActor.camYaw = Math.PI / 2; courtTest.tick(70, { y: 1 });
      const after = game.roomActor.position.clone();
      return { before: before.toArray(), after: after.toArray(), near: game.room.gates[2].gate._near(after), bridge: game.room.court.bridgeProgress };
    });
    check('Terrace wall blocks side entry and elevated valve cannot be operated from below', ground.after[0] > -6 && ground.after[1] === 0 && ground.near === null && ground.bridge === 0, ground);
    const first = await p.evaluate(() => {
      const s = game.room.gates[2].gate, front = s.seg.z1 - 1.5;
      courtTest.walk(-5.4, front); courtTest.walk(-8, front); const ramp = courtTest.walk(-8, s.levers[1].z);
      courtTest.temp(s.valves[0].want, s.levers[1]); courtTest.walk(s.valves[0].x, s.valves[0].z); courtTest.act(); courtTest.tick(85);
      game.room.nudge('r3', 46); game.save(true); courtTest.render();
      return { ramp, state: game.room.exportState(game.roomActor), raw: localStorage.getItem('mumuplanet.progress.v1') };
    });
    check('Walking the left ramp reaches 3m gallery and first valve opens bridge', first.ramp.peak === 3 && first.state.steam.filled[0] && first.state.steam.bridge === 1, first.state);
    await p.screenshot({ path: path.join(out, 'court-gallery.png') });
    const atomic = await p.evaluate(() => {
      const before = JSON.stringify(game.room.exportState(game.roomActor)); const bad = JSON.parse(before); bad.checkpoint.x = 999;
      const ok = game.room.importState(bad); return !ok && before === JSON.stringify(game.room.exportState(game.roomActor));
    });
    check('Invalid checkpoint is rejected without partially changing devices', atomic);
    const pause = await p.evaluate(() => {
      game.notebook.setOpen(true); const before = JSON.stringify(game.room.exportState(game.roomActor)); courtTest.tick(180, { y: 1, action: true });
      const same = before === JSON.stringify(game.room.exportState(game.roomActor)); game.notebook.setOpen(false); return same;
    });
    check('Notebook pauses shrine movement and puzzle state', pause);
    await p.reload(); await p.waitForFunction(() => window.game, null, { timeout: 45000 }); await p.locator('#title .go').click(); await p.waitForFunction(() => game.mode === 'room'); await harness(p);
    await p.waitForFunction(() => !document.querySelector('#title').classList.contains('on'));
    const resumed = await p.evaluate(() => ({ mode: game.mode, state: game.room.exportState(game.roomActor), p: game.roomActor.position.toArray() }));
    check('Reload resumes upper gallery, valve order, holes, tier and hint', resumed.p[1] === 3 && resumed.state.steam.filled[0]
      && JSON.stringify(resumed.state.steam.wants) === JSON.stringify(first.state.steam.wants)
      && JSON.stringify(resumed.state.holes) === JSON.stringify(first.state.holes) && resumed.state.tier === first.state.tier
      && resumed.state.hints.r3.level === first.state.hints.r3.level, resumed);
    const revisit = await p.evaluate(() => {
      const state = game.room.exportState(game.roomActor); game.exitShrine(); game.enterShrine(game.shrines.shrines[3]);
      return { before: state, after: game.room.exportState(game.roomActor) };
    });
    check('Leaving and re-entering preserves an unfinished water run', JSON.stringify(revisit.before) === JSON.stringify(revisit.after));
    const second = await p.evaluate(() => {
      const s = game.room.gates[2].gate; const bridge = courtTest.walk(8, s.valves[1].z);
      courtTest.temp(s.valves[1].want, s.levers[2]); courtTest.walk(s.valves[1].x, s.valves[1].z); courtTest.act();
      courtTest.walk(8, s.seg.z1 - 1.5); courtTest.walk(0, s.seg.z1 - 1.5);
      courtTest.temp(s.valves[2].want, s.levers[0]); courtTest.walk(0, s.seg.z1 - 16);
      courtTest.render(); const cam = game.engine.camera.position.toArray(), below = game.roomActor.position.toArray();
      courtTest.walk(s.valves[2].x, s.valves[2].z); courtTest.act(); courtTest.tick(2);
      return { bridge, below, cam, solved: game.room.gates.map(g => g.solved) };
    });
    check('Walk across raised bridge, down other ramp and under bridge to third valve', second.bridge.position[1] === 3 && second.below[1] === 0 && second.cam[1] < 2.72 && second.solved.every(Boolean), second);
    await p.evaluate(() => { courtTest.walk(0, game.room.gates[2].gate.seg.z1 - 1.5); courtTest.render(); });
    await p.screenshot({ path: path.join(out, 'court-open.png') });
    const sceneMetrics = await p.evaluate(() => {
      const info = game.engine.renderer.info, auto = info.autoReset; info.autoReset = false; info.reset(); game.engine.render();
      const draw = { ...info.render }; info.autoReset = auto;
      let meshes = 0; game.room.scene.traverse(o => { if (o.isMesh) meshes++; });
      const pos = game.roomActor.position.toArray(), cam = game.engine.camera.position.toArray();
      return { meshes, draw, position: pos, camera: cam, court: { width: 26, length: 26, galleryHeight: 3, bridgeWidth: 12, bridgeDepth: 4 } };
    });
    report.sceneMetrics = sceneMetrics;
    const end = await p.evaluate(() => {
      const god = game.room.final; courtTest.walk(0, game.room.shrineSeg.z1 - 1.5);
      for (let k = 0; k < 3; k++) { courtTest.walk(god.lever.x, god.lever.z); let n = 0;
        while (god.si !== god.want && n++ < 3) courtTest.act(); courtTest.walk(god.altar.x + 0.4, god.altar.z); courtTest.act(); }
      courtTest.tick(100); courtTest.walk(game.room.prize.pos.x, game.room.prize.pos.z); courtTest.act();
      const taken = game.room.prize.taken; courtTest.walk(game.room.court.returnPos.x, game.room.court.returnPos.z); courtTest.act();
      return { got: god.got, taken, p: game.roomActor.position.toArray(), cleared: game.shrines.shrines[3].cleared };
    });
    check('Complete final temperature puzzle, collect orb and use return shortcut', end.got === 3 && end.taken && end.cleared && end.p[2] === 10, end);
    const reenter = await p.evaluate(() => { game.exitShrine(); game.enterShrine(game.shrines.shrines[3]);
      courtTest.tick(1); return { solved: game.room.gates.map(g => g.solved), open: game.room.gates[0].gate.bands.every(b => b.rect.open), final: game.room.final.got }; });
    check('Completed water shrine remains open on re-entry', reenter.solved.every(Boolean) && reenter.open && reenter.final === 3, reenter);
    const selftestLog = []; p.on('console', m => { if (m.text().includes('[selftest]')) selftestLog.push(m.text()); });
    const bounds = await p.evaluate(async () => {
      const THREE = await import('three'), { solidBounds } = await import('/src/debug/solidBounds.js');
      const scene = new THREE.Scene(), mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 2);
      scene.add(mesh); mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-2, 0, 0)); mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(2, 0, 0));
      const clear = !solidBounds(scene).some(b => b.box.containsPoint(new THREE.Vector3()));
      const occupied = solidBounds(scene).some(b => b.box.containsPoint(new THREE.Vector3(2, 0, 0)));
      mesh.setMatrixAt(1, new THREE.Matrix4()); const detectsMovedSolid = solidBounds(scene).some(b => b.box.containsPoint(new THREE.Vector3()));
      mesh.geometry.dispose(); mesh.material.dispose(); return { clear, occupied, detectsMovedSolid };
    });
    check('Camera audit distinguishes instance gaps and detects a solid moved into the camera', bounds.clear && bounds.occupied && bounds.detectsMovedSolid, bounds);
    const selftest = await p.evaluate(() => {
      const before = JSON.stringify(game.room.exportState(game.roomActor)), pos = game.roomActor.position.toArray();
      const ok = __selftest(); return { ok, restored: before === JSON.stringify(game.room.exportState(game.roomActor)), pos,
        after: game.roomActor.position.toArray() };
    });
    fs.writeFileSync(path.join(out, 'selftest.txt'), selftestLog.join('\n'));
    check('Existing A–W selftests pass and preserve active water run', selftest.ok && selftest.restored && JSON.stringify(selftest.pos) === JSON.stringify(selftest.after), selftest);
    await c.close();
    const fault = await fresh(true); let caught = false;
    try { await fault.p.evaluate(() => { courtTest.approach(); const s = game.room.gates[2].gate; courtTest.walk(-8, s.seg.z1 - 1.5); courtTest.walk(-8, s.levers[1].z);
      if (game.roomActor.position.y !== 3) throw Error('Gallery elevation missing'); }); } catch (e) { caught = /Gallery elevation missing/.test(e.message); }
    check('Regression probe detects intentionally removed elevation', caught); await fault.c.close();
    const right = await fresh();
    const reverse = await right.p.evaluate(() => {
      game.room.applyTier(5); courtTest.approach(); const s = game.room.gates[2].gate;
      courtTest.walk(8, s.seg.z1 - 1.5); courtTest.temp(s.valves[1].want, s.levers[2]); courtTest.walk(8, s.valves[1].z); courtTest.act(); courtTest.tick(85);
      const first = s.valves.map(v => v.filled), crossed = courtTest.walk(-8, s.valves[0].z);
      courtTest.temp(s.valves[0].want, s.levers[1]); courtTest.walk(-8, s.valves[0].z); courtTest.act();
      return { first, crossed, tier: game.room.runTier, filled: s.valves.map(v => v.filled) };
    });
    check('Highest tier and right gallery first also open a traversable bridge', reverse.first[1] && !reverse.first[0] && reverse.crossed.position[1] === 3
      && reverse.filled[0] && reverse.filled[1] && reverse.tier === 5, reverse); await right.c.close();
    const brokenSave = await fresh('save', first.raw);
    check('Regression probe detects intentionally lost valve restoration', !(await brokenSave.p.evaluate(() => game.room.gates[2].gate.valves[0].filled)));
    await brokenSave.c.close();
    const old = JSON.parse(first.raw); delete old.progress.waterRoom; delete old.progress.waterRoomActive;
    const legacy = await fresh(false, JSON.stringify(old));
    check('Older saves without water progress resume outside safely', await legacy.p.evaluate(() => game.mode === 'planet' && game.notebook.has)); await legacy.c.close();
    const bad = JSON.parse(first.raw); bad.progress.waterRoom.checkpoint.y = 999;
    const corrupt = await fresh(false, JSON.stringify(bad));
    check('Corrupt water snapshot is backed up and other progress survives', await corrupt.p.evaluate(() => game.mode === 'planet' && game.notebook.has
      && JSON.parse(localStorage.getItem('mumuplanet.progress.previous.v1')).progress.waterRoom.checkpoint.y === 999)); await corrupt.c.close();
    const phone = await fresh(false, first.raw, true);
    await phone.p.evaluate(() => { courtTest.render(); game.input.setTestIntent(null); });
    await phone.p.screenshot({ path: path.join(out, 'court-mobile.png') });
    await phone.p.locator('#tcNote').tap(); check('Mobile notebook icon opens above the gallery', await phone.p.evaluate(() => game.notebook.isOpen));
    await phone.p.locator('#nbX').tap();
    await phone.p.evaluate(() => { const s = game.room.gates[2].gate; courtTest.walk(8, s.valves[1].z); courtTest.walk(s.levers[2].x, s.levers[2].z); game.input.setTestIntent(null); game.step(1 / 60); });
    const ti = await phone.p.evaluate(() => game.room.gates[2].gate.ti);
    await phone.p.locator('#tcAct').tap(); await phone.p.evaluate(() => { game.step(1 / 60); game.step(1 / 60); });
    check('Mobile E operates elevated temperature control', await phone.p.evaluate(before => game.room.gates[2].gate.ti === (before + 1) % 3, ti));
    await phone.c.close();
    check('Browser has no uncaught JavaScript errors', report.errors.length === 0, report.errors);
  } finally { fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(report, null, 2)); await browser?.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
