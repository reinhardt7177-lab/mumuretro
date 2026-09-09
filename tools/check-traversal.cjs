// Deterministic terrain/flight checks in Chromium. No private game state or saved progress is changed.
// Run: AUDIT_NODE_MODULES=<packages> node tools/check-traversal.cjs
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = process.env.AUDIT_NODE_MODULES
  ? require(path.join(process.env.AUDIT_NODE_MODULES, 'playwright')) : require('playwright');
const output = path.join(ROOT, 'tmp'); fs.mkdirSync(output, { recursive: true });
const report = { date: new Date().toISOString(), checks: [], errors: [] };
const html = `<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script></head>
<body><canvas id="scene"></canvas><script type="module">
import * as THREE from 'three'; import {Player} from '/src/sphere/Player.js';
import {Engine} from '/src/core/Engine.js'; import {animateLimbs} from '/src/sphere/Character.js';
window.fixture = {THREE, Player, Engine, animateLimbs};
</script></body></html>`;
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://local').pathname;
  if (name === '/test') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
  const file = path.resolve(ROOT, '.' + decodeURIComponent(name));
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', path.extname(file) === '.js' ? 'text/javascript' : 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
function terrainFlightTest() {
  const { THREE, Player } = fixture;
  const planet = {
    R: 68,
    surfaceAt(dir, out = new THREE.Vector3()) { out.copy(dir).normalize(); return out.setLength(this.R + 6 - out.z * 25); },
    projectToSurface(v) { return this.surfaceAt(v, v); },
  };
  const p = new Player(planet); p.jumpH = 3; p.vy = -1; p.jumpsLeft = 0;
  const before = p.getFootPosition().length();
  p.update(0.05, {x: 0, y: 1}, new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
  const expected = before + (-1 - 22 * 0.05) * 0.05;
  return { error: Math.abs(p.getFootPosition().length() - expected), groundDrop: 74 - p.position.length(), height: p.jumpH };
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  const check = (name, pass, details) => {
    report.checks.push({ name, pass: !!pass, ...(details === undefined ? {} : { details }) });
    assert.ok(pass, name + ': ' + JSON.stringify(details)); console.log('PASS ' + name);
  };
  try {
    browser = await chromium.launch({ channel: process.env.AUDIT_BROWSER || 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
    await context.route('**/*', r => r.request().url().startsWith(base + '/') ? r.continue() : r.abort());
    const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(base + '/test'); await page.waitForFunction(() => window.fixture);
    const altitude = await page.evaluate(terrainFlightTest);
    check('Airborne feet preserve radial altitude over descending terrain', altitude.error < 1e-8 && altitude.groundDrop > 0.05, altitude);
    const facts = await page.evaluate(() => {
      const { THREE, Player, Engine, animateLimbs } = fixture;
      const flat = { R: 68, surfaceAt(d, out = new THREE.Vector3()) { return out.copy(d).setLength(this.R); }, projectToSurface(v) { return v.setLength(this.R); } };
      const f = new THREE.Vector3(0, 0, 1), right = new THREE.Vector3(1, 0, 0), idle = { x: 0, y: 0 };
      const p = new Player(flat), q = new Player(flat); let groundError = 0, frameError = 0;
      for (let i = 0; i < 5400; i++) {
        p.update(1 / 60, {x: 0, y: 1, run: true}, p.heading, right);
        groundError = Math.max(groundError, Math.abs(p.position.length() - 68), p.jumpH);
        frameError = Math.max(frameError, Math.abs(p.heading.dot(p.up)), Math.abs(p.heading.length() - 1));
      }
      p.position.set(0, 68, 0); p.heading.copy(f); p._initFrame(); p.resetTraversal();
      p.jumpH = 10; p.vy = -2; p.jumpsLeft = 0;
      p.update(1 / 60, {...idle, jumpHeld: true}, f, right);
      const locked = !p.gliding && !p.body.userData.glider.visible;
      p.resetTraversal(); p.canGlide = true; p.jumpH = 10; p.vy = -2; p.jumpsLeft = 0;
      q.jumpH = 10; q.vy = -2; q.jumpsLeft = 0;
      const start = p.position.clone();
      for (let i = 0; i < 180; i++) { p.update(1 / 60, {...idle, jumpHeld: true}, f, right); q.update(1 / 60, idle, f, right); }
      const glide = { height: p.jumpH, traveled: Math.acos(THREE.MathUtils.clamp(start.clone().normalize().dot(p.up), -1, 1)) * 68,
        fallSpeed: p.vy, groundedWithoutSail: q.grounded, visible: p.body.userData.glider.visible,
        raisedArms: p.body.userData.armL.rotation.z, bentKnees: p.body.userData.legL.userData.lower.rotation.x };
      p.update(1 / 60, idle, f, right);
      const released = !p.gliding && !p.body.userData.glider.visible && p.vy < -p.glideFallSpeed;
      let landingFrames = 0; while (!p.grounded && landingFrames++ < 300) p.update(1 / 60, idle, f, right);
      const landed = p.grounded && p.jumpH === 0 && p.vy === 0 && p.jumpsLeft === p.maxJumps && p.landingImpact > 0;
      p.resetTraversal(); p.jumpH = 0.04; p.vy = -1; p.jumpsLeft = 0;
      p.update(1 / 60, {...idle, jump: true}, f, right);
      for (let i = 0; i < 4; i++) p.update(1 / 60, idle, f, right);
      const buffer = p.airborne && p.vy > 0 && p.jumpsLeft === 0;
      p.canGlide = true; p.jumpH = 6; p.vy = -1;
      p.update(1 / 60, {...idle, jumpHeld: true}, f, right); p.resetTraversal();
      const reset = p.grounded && !p.gliding && !p.body.userData.glider.visible && p._jumpBuffer === 0 && p.canGlide;
      p.position.set(0, 68, 0); p.heading.copy(f); p._initFrame(); p.jumpH = 18; p.vy = -1; p.canGlide = true;
      const engine = new Engine(document.getElementById('scene'), flat.R);
      const input = {camPitch: 0.45, camDist: 9, consumeYaw: () => 0};
      p.syncMesh(); engine.updateCamera(p, input, 1 / 60);
      const target = p.getFootPosition().addScaledVector(p.up, 1.2);
      const view = engine.camera.getWorldDirection(new THREE.Vector3());
      const camera = { aimDot: view.dot(target.clone().sub(engine.camera.position).normalize()), altitude: engine.camera.position.length() - 68 };
      // A rendered close-up proves that flight is represented by a real sail and raised hands.
      p.jumpH = 2.4; p.gliding = true;
      animateLimbs(p.body, 1, false, false, {airborne: true, gliding: true, vy: -1.65}); p.syncMesh();
      engine.scene.add(p.mesh);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshToonMaterial({color: 0x79905e}));
      ground.rotation.x = -Math.PI / 2; ground.position.y = 68; ground.receiveShadow = true; engine.scene.add(ground);
      engine.sun.position.set(-14, 100, 12); engine.sun.target.position.set(0, 70, 0); engine.sun.target.updateMatrixWorld();
      engine.fill.position.set(12, 85, -4); engine.camera.position.set(3.4, 72.8, 5.8); engine.camera.up.set(0, 1, 0);
      engine.camera.lookAt(0, 71.5, 0); engine.render();
      return {groundError, frameError, locked, glide, released, landed, landingFrames, buffer, reset, camera};
    });
    check('90 seconds of surface walking stays attached and orthogonal through poles', facts.groundError < 1e-8 && facts.frameError < 1e-8, facts);
    check('Sail is unavailable before acquisition', facts.locked);
    check('Held sail crosses 25 metres while normal falling reaches ground', facts.glide.height > 4.9 && facts.glide.traveled > 25 && facts.glide.groundedWithoutSail && facts.glide.fallSpeed >= -1.65, facts.glide);
    check('Sail has raised hands and bent knees', facts.glide.visible && facts.glide.raisedArms > 2 && facts.glide.bentKnees > 0.3, facts.glide);
    check('Releasing jump folds sail and restores gravity', facts.released);
    check('Landing restores jumps and produces a landing pose', facts.landed && facts.landingFrames < 120, facts.landingFrames);
    check('Jump pressed just before landing is buffered', facts.buffer);
    check('Scene reset clears flight and buffered input but preserves equipment', facts.reset);
    check('Camera follows actual feet at 18 metres, with terrain clearance', facts.camera.aimDot > 0.999 && facts.camera.altitude > 18, facts.camera);
    await page.screenshot({ path: path.join(output, 'traversal-sail.png') });
    check('No browser exceptions', report.errors.length === 0, report.errors);
    await context.close();
    // Failure injection must catch the previous "ride the terrain while flying" implementation.
    const mutated = await browser.newContext();
    const source = fs.readFileSync(path.join(ROOT, 'src/sphere/SurfaceActor.js'), 'utf8');
    assert.ok(source.includes('this.jumpH = footRadius - this.position.length();'), 'Mutation target exists');
    await mutated.route('**/src/sphere/SurfaceActor.js', r => r.fulfill({contentType: 'text/javascript', body: source.replace('this.jumpH = footRadius - this.position.length();', 'this.jumpH = this.jumpH;')}));
    const bad = await mutated.newPage(); await bad.goto(base + '/test'); await bad.waitForFunction(() => window.fixture);
    const broken = await bad.evaluate(terrainFlightTest);
    check('Failure injection: removing altitude preservation is detected', broken.error > 0.05, broken);
    await mutated.close();
  } catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error); }
  finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(output, 'traversal-check.json'), JSON.stringify(report, null, 2));
  }
})();
