// Actual expedition traversal from the landing pad. Only the lab tutorial is staged.
// No player coordinates are assigned: all outdoor travel uses game input and game.step.
// Run with a server: EXPEDITION_URL=http://127.0.0.1:5512 AUDIT_NODE_MODULES=<packages> node tools/check-expedition.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = process.env.AUDIT_NODE_MODULES
  ? require(path.join(process.env.AUDIT_NODE_MODULES, 'playwright')) : require('playwright');
const base = (process.env.EXPEDITION_URL || 'http://127.0.0.1:5512').replace(/\/$/, '');
const out = path.join(ROOT, 'tmp'); fs.mkdirSync(out, { recursive: true });
const report = { date: new Date().toISOString(), base, checks: [], errors: [], routes: {} };
function check(name, pass, details) {
  report.checks.push({ name, pass: !!pass, ...(details === undefined ? {} : { details }) });
  assert.ok(pass, name + ': ' + JSON.stringify(details)); console.log('PASS ' + name);
}
async function installHarness(page) {
  await page.evaluate(() => {
    const DT = 1 / 60;
    window.expeditionHarness = {
      steer(target, extra = {}) {
        const p = game.player, d = target.clone().normalize();
        const tangent = d.addScaledVector(p.up, -d.dot(p.up)).normalize();
        game.engine.camFwd.copy(tangent); game.engine.camRight.crossVectors(p.up, tangent).normalize();
        game.input.setTestIntent({x: 0, y: 1, ...extra}); game.step(DT);
      },
      distance(target) { return game.player.position.angleTo(target) * game.planet.R; },
      walk(target, label, tolerance = 0.45, limit = 1800) {
        let frames = 0, stall = 0, traveled = 0, maxHeight = 0, previous = game.player.position.clone();
        let best = this.distance(target);
        while (this.distance(target) > tolerance && frames < limit) {
          this.steer(target); frames++;
          const now = this.distance(target), moved = previous.distanceTo(game.player.position);
          traveled += moved; previous.copy(game.player.position); maxHeight = Math.max(maxHeight, game.player.jumpH);
          if (now < best - 0.01) { best = now; stall = 0; } else stall++;
          if (stall > 180) throw new Error(`Walking blocked at ${label}: ${now.toFixed(2)}u remains; position=${game.player.position.toArray()}; prompt=${document.getElementById('prompt')?.textContent}`);
        }
        game.input.setTestIntent({});
        if (this.distance(target) > tolerance) throw new Error(`Walking exceeded ${limit} frames at ${label}`);
        return {label, frames, seconds: frames * DT, traveled, remaining: this.distance(target), maxHeight};
      },
      action() { game.input.setTestIntent({action: true}); game.step(DT); game.input.setTestIntent({}); game.step(DT); },
      pause(frames = 120) {
        game.notebook.setOpen(true); const before = { position: game.player.position.toArray(), h: game.player.jumpH,
          vy: game.player.vy, thermal: game.waterway.exportState(), gliding: game.player.gliding };
        for (let i = 0; i < frames; i++) game.step(DT);
        const after = {position: game.player.position.toArray(), h: game.player.jumpH, vy: game.player.vy,
          thermal: game.waterway.exportState(), gliding: game.player.gliding};
        game.notebook.setOpen(false); game.input.setTestIntent({});
        return {unchanged: JSON.stringify(before) === JSON.stringify(after), before, after};
      },
      render(toward) {
        // The loop is stopped for deterministic screenshots. Flush the overlay-close frame
        // and redraw HUD without advancing position, gravity or heat.
        game.input.setTestIntent({jumpHeld: game.player.gliding});
        game.step(0);
        game.input.setTestIntent({jumpHeld: game.player.gliding});
        game.step(0);
        game.input.setTestIntent({}); game.player.lastArc = 0;
        if (toward) {
          const d = toward.clone().normalize(), up = game.player.up;
          game.engine.camFwd.copy(d.addScaledVector(up, -d.dot(up)).normalize());
        }
        for (let i = 0; i < 30; i++) game.engine.updateCamera(game.player, game.input, DT);
        game.sky.update(game.player, game.engine.camera); game.engine.render();
      },
    };
  });
}
(async () => {
  let browser;
  try {
    browser = await chromium.launch({channel: process.env.AUDIT_BROWSER || 'msedge', headless: true});
    async function fresh() {
      const context = await browser.newContext({viewport: {width: 1440, height: 900}});
      await context.route('**/*', r => r.request().url().startsWith(base + '/') ? r.continue() : r.abort());
      const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
      await page.goto(base, {waitUntil: 'domcontentloaded'});
      await page.waitForFunction(() => window.game?.firstTrail && window.game?.waterway, null, {timeout: 45000});
      await page.locator('#title .go').click();
      await page.waitForFunction(() => game.mode === 'lab'); await page.waitForTimeout(700);
      await page.evaluate(() => {
        game.loop.stop(); game.dialogue.close();
        // The lab opening is already covered by quality-check. This fixture prepares its completed state only.
        if (!game.lab.importState({version: 1, dials: [3, 5, 8], hasNote: true, read: true, open: true, done: false, sent: false})) throw new Error('Lab fixture rejected');
        game.notebook.setHas(true); game.landOnPlanet(); game.dialogue.close(); game.brief.hide();
        game.input.setTestIntent({}); game.step(1 / 60);
      });
      await page.waitForTimeout(800); await installHarness(page);
      return {context, page};
    }
    const {context, page} = await fresh();
    check('Start at landing pad with an unopened glider', await page.evaluate(() => game.mode === 'planet'
      && game.player.position.angleTo(game.landing.pos) * game.planet.R < 0.05 && !game.player.canGlide));
    await page.evaluate(() => expeditionHarness.render(game.firstTrail.plan.overlook));
    await page.waitForTimeout(300);
    await page.screenshot({path: path.join(out, 'expedition-landing.png')});
    report.routes.ridge = await page.evaluate(() => {
      const route = game.firstTrail.plan.routes.find(r => r.key === 'ridge');
      return route.dirs.map((d, i) => expeditionHarness.walk(d, `ridge ${i}`));
    });
    check('Ridge route is reachable by actual ground walking', report.routes.ridge.every(r => r.remaining <= 0.45 && r.maxHeight < 0.001), report.routes.ridge);
    await page.evaluate(() => expeditionHarness.render(game.firstTrail.plan.waterway));
    await page.waitForTimeout(300);
    await page.screenshot({path: path.join(out, 'expedition-overlook.png')});
    const acquired = await page.evaluate(() => {
      const prompt = game.firstTrail.getPrompt(game.player.position); expeditionHarness.action();
      return {prompt, glider: game.player.canGlide, trail: game.firstTrail.exportState(), saved: JSON.parse(localStorage.getItem('mumuplanet.progress.v1'))?.progress?.expedition};
    });
    check('E at overlook acquires and saves the glider', acquired.prompt?.startsWith('E — 접이식') && acquired.glider && acquired.saved?.trail?.glider, acquired);
    const launch = await page.evaluate(() => {
      const target = game.waterway.entryDir, start = game.player.position.clone();
      let frames = 0, glideFrames = 0, maxHeight = 0, distance = 0;
      expeditionHarness.steer(target, {jump: true, jumpHeld: true});
      while (frames++ < 80) {
        expeditionHarness.steer(target, {jumpHeld: true});
        if (game.player.gliding) glideFrames++;
        maxHeight = Math.max(maxHeight, game.player.jumpH);
        distance = start.angleTo(game.player.position) * game.planet.R;
        if (glideFrames >= 20 && distance > 5) break;
        if (game.player.grounded) throw new Error(`Landed before sail opened: ${distance.toFixed(2)}u`);
      }
      window.expeditionFlightStart = start;
      return {frames, glideFrames, maxHeight, distance, h: game.player.jumpH, pause: expeditionHarness.pause()};
    });
    check('Jump-and-hold opens sail in actual downhill flight', launch.glideFrames >= 20 && launch.distance > 5 && launch.h > 0.7, launch);
    check('Notebook freezes mid-flight position, gravity and waterway state', launch.pause.unchanged && launch.pause.before.gliding, launch.pause);
    await page.evaluate(() => expeditionHarness.render(game.waterway.entryDir));
    await page.waitForTimeout(300);
    await page.screenshot({path: path.join(out, 'expedition-glide.png')});
    const flight = await page.evaluate(() => {
      const target = game.waterway.entryDir; let frames = 0, glideFrames = 0, maxHeight = game.player.jumpH;
      while (frames++ < 900 && game.player.airborne) {
        const remaining = expeditionHarness.distance(target);
        if (remaining < 1.2) { game.input.setTestIntent({}); game.step(1 / 60); }
        else expeditionHarness.steer(target, {jumpHeld: true});
        if (game.player.gliding) glideFrames++;
        maxHeight = Math.max(maxHeight, game.player.jumpH);
      }
      const traveled = expeditionFlightStart.angleTo(game.player.position) * game.planet.R;
      const remaining = expeditionHarness.distance(target), landed = game.player.grounded;
      const finish = expeditionHarness.walk(target, 'waterway entry after landing', 0.48, 1000);
      expeditionHarness.render(game.firstTrail.gateDir);
      return {frames, glideFrames, maxHeight, traveled, remainingAtLanding: remaining, landed, finish, discovered: game.waterway.discovered};
    });
    check('Downhill sail crosses the 24u approach and lands within 2u of the waterway', flight.traveled > 20 && flight.landed && flight.remainingAtLanding < 2 && flight.discovered, flight);
    await page.waitForTimeout(300);
    await page.screenshot({path: path.join(out, 'expedition-waterway.png')});
    const heatPause = await page.evaluate(() => {
      const H = expeditionHarness, w = game.waterway;
      // Walk outside the ice collider, then approach the heater within hand range.
      const walks = [H.walk(w.localToWorld(-3, -5), 'outside ice'), H.walk(w.localToWorld(-5.8, 2.8), 'heater approach', 0.4)];
      H.action(); if (!w.held) throw new Error('E at heater did not pick it up');
      walks.push(H.walk(w.localToWorld(-2.3, -1), 'carry heater to ice', 0.4));
      H.action();
      game.input.setTestIntent({}); for (let i = 0; i < 30; i++) game.step(1 / 60);
      const status = {...w.status}, pause = H.pause(180), energyBefore = w.status.energyJ;
      for (let i = 0; i < 30; i++) game.step(1 / 60);
      return {walks, status, pause, energyAfter: w.status.energyJ, energyBefore};
    });
    check('Notebook freezes active waterway heating, then heating resumes', heatPause.status.heaterWatts > 0 && heatPause.pause.unchanged && heatPause.energyAfter > heatPause.energyBefore, heatPause);
    const beforeReload = await page.evaluate(() => { game.input.setTestIntent({}); game.save(true); return game.snapshot(); });
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.game?.firstTrail, null, {timeout: 45000});
    await page.locator('#title .go').click(); await page.waitForFunction(() => game.mode === 'planet');
    await page.evaluate(() => { game.loop.stop(); game.dialogue.close(); });
    const resumed = await page.evaluate(() => ({glider: game.player.canGlide, trail: game.firstTrail.exportState(), waterway: game.waterway.exportState(), grounded: game.player.grounded, position: game.player.position.toArray()}));
    check('Reload restores glider and waterway progress at a grounded checkpoint', resumed.glider && resumed.trail.glider && resumed.grounded
      && resumed.waterway.thermal.energyJ >= beforeReload.expedition.waterway.thermal.energyJ, resumed);
    await context.close();
    const alternate = await fresh();
    const stalled = await alternate.page.evaluate(() => {
      const original = game.player.update;
      try {
        game.player.update = () => {};
        expeditionHarness.walk(game.firstTrail.plan.routes.find(r => r.key === 'meadow').dirs[1], 'injected immobilization');
        return false;
      } catch (error) { return /Walking blocked at injected immobilization/.test(error.message); }
      finally { game.player.update = original; game.input.setTestIntent({}); }
    });
    check('Failure injection: immobilized movement is detected instead of reporting reachability', stalled);
    report.routes.meadow = await alternate.page.evaluate(() => {
      const route = game.firstTrail.plan.routes.find(r => r.key === 'meadow');
      const entries = route.dirs.map((d, i) => expeditionHarness.walk(d, `meadow ${i}`));
      return {entries, discovered: game.waterway.discovered, acquired: game.player.canGlide};
    });
    check('Meadow alternative is walkable from the same landing without a glider', report.routes.meadow.entries.every(r => r.remaining <= 0.45 && r.maxHeight < 0.001)
      && report.routes.meadow.discovered && !report.routes.meadow.acquired, report.routes.meadow);
    await alternate.context.close();
    check('No browser exceptions', report.errors.length === 0, report.errors);
  } catch (error) { report.failure = error.stack; console.error(error); process.exitCode = 1; }
  finally {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(out, 'expedition-check.json'), JSON.stringify(report, null, 2));
  }
})();
