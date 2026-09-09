// Independent browser checks of both physical routes. No saved player session is touched.
// AUDIT_NODE_MODULES=<directory containing playwright> node tools/check-waterway.cjs
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = process.env.AUDIT_NODE_MODULES
  ? require(path.join(process.env.AUDIT_NODE_MODULES, 'playwright')) : require('playwright');
const report = { date: new Date().toISOString(), checks: [], pageErrors: [] };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js"}}</script>'); return;
  }
  const file = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', path.extname(file) === '.js' ? 'text/javascript' : 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: process.env.AUDIT_BROWSER || 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await context.newPage(); page.on('pageerror', e => report.pageErrors.push(e.message));
    await page.goto(base);
    const actual = await page.evaluate(async () => {
      const THREE = await import('three');
      const { Planet } = await import('/src/sphere/Planet.js');
      const { buildWaterway } = await import('/src/world/Waterway.js');
      const { WATERWAY: C } = await import('/src/data/waterway.js');
      const { IceThermal, proximityHeat } = await import('/src/core/Thermal.js');
      const checks = [], check = (name, pass, details) => {
        checks.push({ name, pass: !!pass, ...(details === undefined ? {} : { details }) });
        if (!pass) throw Error(JSON.stringify(checks));
      };
      const planet = new Planet(new THREE.Scene()), dir = planet.latLonToPos(9, 14).normalize();
      const make = () => buildWaterway(new THREE.Scene(), planet, dir);
      const actorAt = (w, x, z, towardX = x, towardZ = z - 1) => {
        const position = w.localToWorld(x, z), heading = w.localToWorld(towardX, towardZ).sub(position).normalize();
        return { position, heading };
      };
      const run = (w, actor, seconds) => { for (let n = 0; n < seconds * 60; n++) w.update(1 / 60, actor); };

      const ice = new IceThermal();
      ice.addPower(ice.warmingEnergy / 2, 1);
      check('Energy warms ice before melting', ice.temperatureC === -4 && ice.meltFraction === 0);
      ice.addPower(ice.warmingEnergy / 2 + ice.meltingEnergy / 3, 1);
      check('Melting holds 0 Celsius', ice.temperatureC === 0 && Math.abs(ice.meltFraction - 1 / 3) < 1e-8);
      check('Heat decreases continuously with distance', proximityHeat(1, 4.4, 18000) > proximityHeat(3, 4.4, 18000)
        && proximityHeat(4.4, 4.4, 18000) === 0);

      const idle = make(), idleActor = actorAt(idle, 0, -5);
      run(idle, idleActor, 90);
      check('Wrong aim and distant heater do not thaw ice', idle.status.energyJ === 0 && !idle.solved, idle.status);
      check('Approach discovers site without solving', idle.discovered && !idle.solved);

      const heat = make();
      check('Heater has an E action', heat.getPrompt(heat.localToWorld(C.heater.x, C.heater.z)).startsWith('E —'));
      check('Heater can be picked up', heat.interact(heat.localToWorld(C.heater.x, C.heater.z)).kind === 'pickup');
      const heatActor = actorAt(heat, -1.9, -1, 0, -1);
      heat.update(1 / 60, heatActor);
      check('Heater can be put beside ice', heat.interact(heatActor.position).kind === 'place');
      run(heat, heatActor, 6);
      check('Heater route gradually melts at 0 Celsius', heat.meltFraction > 0 && heat.meltFraction < 1
        && heat.temperatureC === 0 && heat.status.lightWatts === 0, heat.status);
      const midway = JSON.parse(JSON.stringify(heat.exportState())), restored = make();
      check('Mid-thaw state restores', restored.importState(midway));
      check('Mid-thaw position angle temperature restored exactly', JSON.stringify(restored.exportState()) === JSON.stringify(midway));
      run(heat, heatActor, 40); run(restored, heatActor, 40);
      check('Heater alone opens waterway', heat.solved && heat.status.flow === 1, heat.status);
      check('Restored simulation continues identically', JSON.stringify(restored.exportState()) === JSON.stringify(heat.exportState()));
      check('Completion records the heat route', heat.record.includes('온열기') && !heat.record.includes('거울'));
      let outletBlocks = 0;
      for (let z = 1; z <= 5.5; z += 0.15) outletBlocks += heat.resolve(heat.localToWorld(0, z));
      check('Opened channel has a clear walking line to its outlet', outletBlocks === 0);

      const light = make(), mirrorPos = light.localToWorld(C.mirror.x, C.mirror.z);
      const aims = [];
      for (let n = 0; n < 24; n++) {
        aims.push({ angle: light.exportState().mirrorAngle, hit: light.status.beamHit, watts: light.status.lightWatts });
        light.interact(mirrorPos);
      }
      check('Geometry offers working and missing beam directions', aims.some(a => a.hit) && aims.some(a => !a.hit), aims);
      for (let n = 0; n < 24 && !light.status.beamHit; n++) light.interact(mirrorPos);
      check('Turning mirror moves visible beam onto receiver', light.status.beamHit && light.status.lightWatts > 0);
      const lightActor = actorAt(light, C.mirror.x, C.mirror.z + 1.2);
      run(light, lightActor, 5);
      check('Light route also melts at 0 Celsius', light.meltFraction > 0 && light.meltFraction < 1 && light.temperatureC === 0, light.status);
      const lightSave = light.exportState(), lightRestored = make();
      check('Mirror aim and optical power restore mid-thaw', lightRestored.importState(lightSave)
        && lightRestored.status.beamHit && Math.abs(lightRestored.status.lightWatts - light.status.lightWatts) < 1e-6);
      run(light, lightActor, 55);
      check('Light alone opens waterway with stationary distant heater', light.solved && light.status.heaterWatts === 0, light.status);
      check('Completion records the light route', light.record.includes('거울') && !light.record.includes('온열기'));

      const carry = make(); carry.interact(carry.localToWorld(C.heater.x, C.heater.z));
      const carryRestored = make();
      check('Carried apparatus is saved and restored', carryRestored.importState(carry.exportState()) && carryRestored.held);
      const away = { position: planet.latLonToPos(-20, 100), heading: new THREE.Vector3(1, 0, 0) };
      const returned = carryRestored.update(1 / 60, away);
      check('Leaving with heater returns it without consuming it', !carryRestored.held
        && carryRestored.exportState().heater.x === C.heater.x && !!returned.message);
      const corrupted = structuredClone(midway); corrupted.thermal.temperatureC = 20;
      const beforeInvalid = JSON.stringify(restored.exportState());
      check('Inconsistent thermal save rejected atomically', !restored.importState(corrupted)
        && JSON.stringify(restored.exportState()) === beforeInvalid);

      let maxGroundError = 0, maxTilt = 0;
      idle.group.children.forEach(node => {
        const a = node.userData.waterwayAnchor; if (!a) return;
        const expected = planet.surfaceAt(node.position.clone().normalize()).length() + 0.17 + a.lift;
        maxGroundError = Math.max(maxGroundError, Math.abs(node.position.length() - expected));
        maxTilt = Math.max(maxTilt, new THREE.Vector3(0, 1, 0).applyQuaternion(node.quaternion).angleTo(node.position.clone().normalize()));
      });
      check('Structure anchors follow curved ground', maxGroundError < 1e-7 && maxTilt < 1e-7, { maxGroundError, maxTilt });
      const collisionPoint = idle.localToWorld(C.mirror.x, C.mirror.z);
      const collisions = idle.resolve(collisionPoint);
      check('Collision resolves to walkable terrain within reach', collisions > 0
        && Math.abs(collisionPoint.length() - planet.surfaceAt(collisionPoint).length()) < 1e-7
        && idle.getPrompt(collisionPoint).startsWith('E —'));
      for (const w of [idle, heat, restored, light, lightRestored, carry, carryRestored]) w.dispose();
      return checks;
    });
    report.checks.push(...actual);

    // Deliberately break the real thermal module in an isolated fresh context.
    // The same 0°C-during-melting invariant must reject it; no workspace file is changed.
    const brokenContext = await browser.newContext();
    const thermalPath = path.join(ROOT, 'src/core/Thermal.js');
    const source = fs.readFileSync(thermalPath, 'utf8');
    const broken = source.replace('if (this.energyJ >= this.warmingEnergy) return 0;', 'if (this.energyJ >= this.warmingEnergy) return 7;');
    assert.notEqual(broken, source, 'Mutation anchor must exist');
    await brokenContext.route('**/*', route => {
      if (route.request().url() === base + '/src/core/Thermal.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: broken });
      return route.request().url().startsWith(base) ? route.continue() : route.abort();
    });
    const brokenPage = await brokenContext.newPage(); await brokenPage.goto(base);
    const brokenPasses = await brokenPage.evaluate(async () => {
      const { IceThermal } = await import('/src/core/Thermal.js');
      const ice = new IceThermal(); ice.addPower(ice.warmingEnergy + ice.meltingEnergy / 3, 1);
      return ice.temperatureC === 0 && Math.abs(ice.meltFraction - 1 / 3) < 1e-8;
    });
    report.checks.push({ name: 'Deliberately broken phase-change rule is detected', pass: brokenPasses === false });
    await brokenContext.close();
    assert.equal(report.pageErrors.length, 0, 'Browser errors');
    assert.ok(report.checks.every(c => c.pass), 'All waterway checks pass');
    report.passed = true;
  } catch (e) { report.passed = false; report.error = e.stack; process.exitCode = 1; }
  finally {
    const out = path.join(ROOT, 'tmp'); fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'waterway-check.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2)); await browser.close(); server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
