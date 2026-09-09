// Device travel uses game input/step. A fixture places the player at the puzzle approach;
// the full landing-to-puzzle routes are independently walked by check-expedition.cjs.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = process.env.AUDIT_NODE_MODULES
  ? require(path.join(process.env.AUDIT_NODE_MODULES, 'playwright')) : require('playwright');
const base = (process.env.AUDIT_URL || 'http://127.0.0.1:5512').replace(/\/$/, '');
const out = path.resolve(__dirname, '../tmp'); fs.mkdirSync(out, { recursive: true });
const report = { date: new Date().toISOString(), checks: [], errors: [] };
function check(name, pass, details) {
  report.checks.push({ name, pass: !!pass, details }); assert.ok(pass, `${name}: ${JSON.stringify(details)}`); console.log('PASS ' + name);
}
async function harness(p) {
  await p.evaluate(() => {
    window.waterHarness = {
      tick(n) { game.input.setTestIntent({}); for (let i = 0; i < n; i++) game.step(1 / 60); },
      walk(x, z) {
        const target = game.waterway.localToWorld(x, z), start = game.player.position.clone();
        let i = 0;
        for (; i < 1500 && game.player.position.angleTo(target) * game.planet.R > 0.42; i++) {
          const up = game.player.up, d = target.clone().normalize(); d.addScaledVector(up, -d.dot(up)).normalize();
          game.engine.camFwd.copy(d); game.engine.camRight.crossVectors(up, d).normalize();
          game.input.setTestIntent({ y: 1 }); game.step(1 / 60);
        }
        game.input.setTestIntent({});
        if (i === 1500) throw Error(`Walk blocked at ${x},${z}: ${game.waterway.localOf(game.player.position).x},${game.waterway.localOf(game.player.position).z}`);
        return { frames: i, distance: start.angleTo(game.player.position) * game.planet.R };
      },
      act() { game.input.setTestIntent({ action: true }); game.step(1 / 60); this.tick(1); },
      render() { game.player.lastArc = 0; for (let i = 0; i < 30; i++) game.engine.updateCamera(game.player, game.input, 1 / 60); game.sky.update(game.player, game.engine.camera); game.engine.render(); },
    };
  });
}
(async () => {
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.AUDIT_BROWSER || 'msedge', headless: true });
    async function fresh(mobile = false) {
      const c = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile, isMobile: mobile });
      await c.route('**/*', r => r.request().url().startsWith(base + '/') ? r.continue() : r.abort());
      const p = await c.newPage(); p.on('pageerror', e => report.errors.push(e.message));
      await p.goto(base); await p.waitForFunction(() => window.game?.waterway, null, { timeout: 45000 });
      await p.locator('#title .go').click(); await p.waitForFunction(() => game.mode === 'lab');
      await p.evaluate(() => {
        game.loop.stop(); game.dialogue.close();
        game.lab.importState({ version: 1, dials: [3, 5, 8], hasNote: true, read: true, open: true, done: false, sent: false });
        game.notebook.setHas(true); game.landOnPlanet(); game.dialogue.close();
        // Fixture only: the outdoor route itself is tested without coordinate writes elsewhere.
        game.player.position.copy(game.waterway.localToWorld(-3, -5)); game.planet.projectToSurface(game.player.position);
        game.player._initFrame(); game.player.resetTraversal(); game.engine._camPlaced = false;
        game.input.setTestIntent({}); for (let i = 0; i < 3; i++) game.step(1 / 60);
      });
      await harness(p); return { c, p };
    }
    async function resume(p) {
      await p.reload(); await p.waitForFunction(() => window.game?.waterway, null, { timeout: 45000 });
      await p.locator('#title .go').click(); await p.waitForFunction(() => game.mode === 'planet');
      await p.evaluate(() => { game.loop.stop(); game.dialogue.close(); game.input.setTestIntent({}); }); await harness(p);
    }
    const { c, p } = await fresh();
    const initial = await p.evaluate(() => { waterHarness.tick(600); return game.waterway.status; });
    check('Unaligned light and distant heater add no energy', initial.energyJ === 0 && !initial.beamHit, initial);
    const heat = await p.evaluate(() => {
      const walks = [waterHarness.walk(-5.8, 2.8)]; waterHarness.act();
      if (!game.waterway.held) throw Error('Heater pickup failed');
      walks.push(waterHarness.walk(-2.3, -1)); waterHarness.act(); waterHarness.tick(120);
      game.save(true); return { walks, state: game.waterway.exportState(), status: game.waterway.status };
    });
    check('Walk, carry and place heater creates heat through distance', heat.status.heaterWatts > 1000 && heat.status.lightWatts === 0 && !heat.state.heater.held, heat);
    await resume(p);
    const restored = await p.evaluate(() => game.waterway.exportState());
    check('Mid-puzzle reload preserves placement and accumulated melting energy', restored.heater.x === heat.state.heater.x && restored.heater.z === heat.state.heater.z
      && restored.thermal.energyJ >= heat.state.thermal.energyJ && restored.thermal.temperatureC === 0, restored);
    const solved = await p.evaluate(() => {
      let frames = 0; while (!game.waterway.solved && frames++ < 6000) waterHarness.tick(1);
      waterHarness.tick(150); waterHarness.render();
      return { frames, status: game.waterway.status, trail: game.firstTrail.exportState(), record: game.waterway.record };
    });
    check('Heater alone restores water flow and opens the shrine gate', solved.status.phase === 'water' && solved.status.flow === 1 && solved.trail.restored, solved);
    await p.screenshot({ path: path.join(out, 'waterway-thawed.png') });
    const gate = await p.evaluate(() => {
      waterHarness.walk(-3, 5); const location = game.waterway.localOf(game.firstTrail.gateDir); waterHarness.walk(location.x, location.z);
      const before = game.player.position.toArray(), prompt = game.firstTrail.getPrompt(game.player.position);
      waterHarness.act(); const roomId = game.room?.spec.id, mode = game.mode;
      game.exitShrine(); return { prompt, roomId, mode, restored: game.player.position.toArray(), before, cleared: game.shrines.shrines[3].cleared };
    });
    check('Opened outdoor gate enters the existing water shrine and returns to the same spot', gate.mode === 'room' && gate.roomId === 'water'
      && JSON.stringify(gate.before) === JSON.stringify(gate.restored) && !gate.cleared, gate);
    await p.evaluate(() => { game.save(true); }); await resume(p);
    check('Restored waterway stays open after another reload', await p.evaluate(() => game.waterway.solved && game.firstTrail.exportState().restored));
    const oldSave = await p.evaluate(() => {
      const key = 'mumuplanet.progress.v1', saved = JSON.parse(localStorage.getItem(key)); delete saved.progress.expedition;
      return JSON.stringify(saved);
    });
    // Install after navigation's pagehide save, before the new boot reads storage.
    await c.addInitScript(raw => localStorage.setItem('mumuplanet.progress.v1', raw), oldSave);
    await resume(p);
    const legacy = await p.evaluate(() => ({ mode: game.mode, glider: game.player.canGlide, solved: game.waterway.solved }));
    check('Older saves without expedition fields remain playable', legacy.mode === 'planet' && !legacy.glider && !legacy.solved, legacy);
    await c.close();

    const phone = await fresh(true), m = phone.p;
    await m.evaluate(() => { waterHarness.walk(3.5, -4); waterHarness.walk(6, 4); game.input.setTestIntent(null); waterHarness.render(); });
    // Real DOM touch controls, then step the paused game to consume each request.
    const turn = async () => { await m.locator('#tcAct').tap(); await m.evaluate(() => { game.step(1 / 60); game.step(1 / 60); }); };
    let turns = 0;
    while (!(await m.evaluate(() => game.waterway.status.beamHit)) && turns++ < 24) await turn();
    const optics = await m.evaluate(() => game.waterway.status);
    check('Touch E rotates mirror until its actual light ray hits the receiver', turns <= 24 && optics.beamHit && optics.lightWatts > 1000 && optics.heaterWatts === 0, { turns, optics });
    await m.evaluate(() => { waterHarness.render(); }); await m.screenshot({ path: path.join(out, 'waterway-mobile-mirror.png') });
    const mirror = await m.evaluate(() => {
      let frames = 0; while (!game.waterway.solved && frames++ < 6000) waterHarness.tick(1);
      waterHarness.tick(150); game.save(true);
      return { frames, state: game.waterway.exportState(), record: game.waterway.record };
    });
    check('Mirror alone melts ice with no heater contribution', mirror.state.thermal.meltFraction === 1 && mirror.state.energyFromHeater === 0 && mirror.state.energyFromLight > 0, mirror);
    await m.evaluate(() => { game.notebook.go('mail'); game.notebook.setOpen(true); });
    await m.getByRole('button', { name: '탐사 일지', exact: true }).tap();
    check('Mobile notebook records the method that was actually used', (await m.locator('#nb .letter').innerText()).includes('흡수판'));
    await m.screenshot({ path: path.join(out, 'expedition-mobile-journal.png') });
    await m.evaluate(() => {
      game.notebook.setOpen(false); waterHarness.tick(3);
      // Walk back along the descending trail; do not grant the ability in the fixture.
      const route = game.firstTrail.plan.routes.find(r => r.key === 'descent').dirs.slice().reverse();
      for (const d of route) { const at = game.waterway.localOf(d); waterHarness.walk(at.x, at.z); }
      game.input.setTestIntent(null);
    });
    await turn();
    check('Touch E at the overlook acquires the glider after walking back', await m.evaluate(() => game.player.canGlide && game.firstTrail.glider));
    await m.evaluate(() => {
      const up = game.player.up, d = game.waterway.entryDir.clone(); d.addScaledVector(up, -d.dot(up)).normalize();
      game.player.heading.copy(d); game.engine.camFwd.copy(d); game.player.syncMesh();
    });
    const touchSession = await phone.c.newCDPSession(m), jumpBox = await m.locator('#tcJump').boundingBox();
    assert.ok(jumpBox, 'Touch jump button is visible');
    // Native touch produces an active pointer, which is required by setPointerCapture.
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
      { x: jumpBox.x + jumpBox.width / 2, y: jumpBox.y + jumpBox.height / 2, id: 41, radiusX: 2, radiusY: 2, force: 1 },
    ] });
    const phoneFlight = await m.evaluate(() => {
      for (let i = 0; i < 100; i++) game.step(1 / 60);
      return { gliding: game.player.gliding, h: game.player.jumpH, held: game.input.poll().jumpHeld };
    });
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    const released = await m.evaluate(() => { game.step(1 / 60); return !game.player.gliding && !game.input.poll().jumpHeld; });
    check('Touch jump hold opens the sail and pointer cancel releases it', phoneFlight.gliding && phoneFlight.h > 0 && phoneFlight.held && released, phoneFlight);
    await touchSession.detach();
    await phone.c.close(); check('No browser errors', report.errors.length === 0, report.errors);
  } catch (error) { report.failure = error.stack; console.error(error); process.exitCode = 1; }
  finally { await browser?.close(); fs.writeFileSync(path.join(out, 'waterway-browser-check.json'), JSON.stringify(report, null, 2)); }
})();
