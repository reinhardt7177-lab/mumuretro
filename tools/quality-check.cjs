// Browser integration. Run: AUDIT_NODE_MODULES=<packages> node tools/quality-check.cjs
// Starts its own local server. All external hosts (including fonts/CDNs) are blocked.
// Tutorial acquisition uses walking; later progress/ending checks explicitly stage state.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = process.env.AUDIT_NODE_MODULES
  ? require(path.join(process.env.AUDIT_NODE_MODULES, 'playwright')) : require('playwright');
const out = path.join(ROOT, 'tmp'); fs.mkdirSync(out, { recursive: true });
const report = { date: new Date().toISOString(), checks: [], pageErrors: [], failedLocalRequests: [] };
function check(name, ok, details) {
  report.checks.push({ name, pass: !!ok, ...(details === undefined ? {} : { details }) });
  assert.ok(ok, name + ': ' + JSON.stringify(details));
  console.log('PASS ' + name);
}
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const file = path.resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname.replace(/\/$/, '/index.html')));
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const KEY = 'mumuplanet.progress.v1', BACKUP = 'mumuplanet.progress.previous.v1';
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: process.env.AUDIT_BROWSER || 'msedge', headless: true });
  async function makeContext(options = {}) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...options });
    await c.route('**/*', r => r.request().url().startsWith(base + '/') ? r.continue() : r.abort());
    await c.addInitScript(() => {
      const NativeAudio = window.Audio;
      window.__testAudio = [];
      window.Audio = function (...args) { const a = new NativeAudio(...args); window.__testAudio.push(a); return a; };
      window.Audio.prototype = NativeAudio.prototype;
    });
    const p = await c.newPage();
    p.on('pageerror', error => report.pageErrors.push(error.message));
    p.on('response', response => {
      if (response.url().startsWith(base) && response.status() >= 400) report.failedLocalRequests.push(response.url().slice(base.length));
    });
    return { c, p };
  }
  async function boot(p) {
    await p.goto(base, { waitUntil: 'domcontentloaded' });
    try {
      await p.waitForFunction(() => window.game && document.getElementById('load').style.display === 'none', null, { timeout: 45000 });
    } catch (error) {
      report.bootFailure = await p.evaluate(() => ({ mode: window.game?.mode, load: document.getElementById('load').outerHTML, title: document.getElementById('title')?.innerText }));
      await p.screenshot({ path: path.join(out, 'quality-boot-failure.png') });
      throw error;
    }
  }
  try {
    const { c, p } = await makeContext();
    await boot(p);
    check('External hosts blocked: local engine boots', await p.evaluate(() => game.mode === 'title'));
    await p.locator('#title .by a').dispatchEvent('pointerdown');
    check('Author link does not start game', await p.evaluate(() => game.mode === 'title'));
    await p.locator('#title .go').click();
    await p.waitForTimeout(1400);
    check('First gesture keeps lab music', await p.evaluate(() => game.mode === 'lab'
      && window.__testAudio.filter(a => a.getAttribute('src')).every(a => a.src.endsWith('/lab.mp3'))));
    check('Opening dialogue has a camera inside the lab', await p.evaluate(() => game.dialogue.active
      && game.engine.camera.position.distanceTo(game.roomActor.position) < 15));
    await p.screenshot({ path: path.join(out, 'rebirth-lab.png') });
    await p.locator('#mute').focus(); await p.keyboard.press('Enter');
    await p.waitForTimeout(500);
    check('Mute via Enter and during fade', await p.evaluate(() => document.getElementById('mute').getAttribute('aria-pressed') === 'true'
      && window.__testAudio.every(a => !a.getAttribute('src') || a.muted && a.volume === 0)));
    await p.keyboard.press('Space');
    check('Unmute via Space', await p.locator('#mute').getAttribute('aria-pressed') === 'false');
    await p.evaluate(() => {
      game.loop.stop(); game.dialogue.close();
      for (let i = 0; i < 3; i++) game.step(1 / 60);
      document.activeElement.blur();
    });
    const walking = await p.evaluate(() => {
      const before=game.roomActor.position.toArray();
      const tick=(intent={})=>{game.input.setTestIntent(intent);game.step(1/60);};
      const walk=(x,z)=>{let n=0;while(Math.hypot(x-game.roomActor.position.x,z-game.roomActor.position.z)>.08&&n++<1200){const a=game.roomActor;a.camYaw=Math.atan2(-(x-a.position.x),-(z-a.position.z));tick({y:1});}if(n>=1200)throw Error('Opening walk blocked');tick();};
      const act=()=>{tick({action:true});tick();};
      walk(2.8,6);walk(3.1,4);act();for(let i=0;i<100;i++)tick();
      walk(2.8,2);walk(.4,1.75);const prompt=game.lab.prompt(game.roomActor.position);act();game.dialogue.close();
      for(let i=0;i<3;i++)tick();game.input.setTestIntent(null);game.touch.update();
      return{before,after:game.roomActor.position.toArray(),prompt,recovered:game.lab.starsail.recovered};
    });
    check('Walk across deck, recover parcel and reach worktable',walking.recovered&&walking.after[2]<walking.before[2]-2,walking);
    check('Parcel grants notebook and PC icon',await p.evaluate(()=>game.notebook.has&&!document.getElementById('tcNote').hidden));
    await p.locator('#tcNote').focus(); await p.keyboard.press('Enter');
    await p.keyboard.down('w');
    check('Reading freezes movement and consumes held input', await p.evaluate(() => {
      const a = game.roomActor.position.toArray();
      for (let i = 0; i < 90; i++) game.step(1 / 60);
      return game.notebook.isOpen && JSON.stringify(a) === JSON.stringify(game.roomActor.position.toArray()) && !game.input.keys.KeyW;
    }));
    await p.keyboard.up('w'); await p.keyboard.press('Escape');
    await p.evaluate(() => { for (let i = 0; i < 4; i++) game.step(1 / 60); game.dialogue.close(); });
    check('Notebook reading advances tutorial', await p.evaluate(() => game.lab.state.read));
    await p.keyboard.down('w');
    check('Blur releases all game input', await p.evaluate(() => {
      game.input._holdJump = true; window.dispatchEvent(new Event('blur'));
      const i = game.input.poll(); return !i.x && !i.y && !i.jumpHeld && !i.action;
    }));
    await p.keyboard.up('w');
    // Actual dial interactions; positions are staged after the separate walking check.
    const staged = await p.evaluate(async () => {
      const { RECIPES } = await import('/src/data/recipes.js');
      game.lab.dials.forEach((d, i) => { for (let n = 0; n < [3, 5, 8][i]; n++) game.lab.interact(d); });
      game.landOnPlanet(); game.dialogue.close();
      game.shrines.markCleared(game.shrines.shrines[0]);
      game.forage.bag.fruit = 4; game.forage.found.fruit = true;
      game.kitchen.made.add(RECIPES[0].id);
      game.mapPage.reveal(game.shrines.shrines[3].dir);
      game.notebook.go('field'); game.notebook.setOpen(false);
      game.enterShrine(game.shrines.shrines[4]); game.brief.hide();
      const q = game.room.gates.find(g => g.gate.constructor.name === 'QuakeGate').gate;
      game.notebook.setOpen(true);
      const t = q.t; for (let i = 0; i < 120; i++) game.step(1 / 60);
      const frozen = q.t === t; game.notebook.setOpen(false);
      const snapshot = game.snapshot(); game.save();
      return { frozen, snapshot, map: game.mapPage.stats(), recipe: RECIPES[0].id };
    });
    check('Notebook also freezes quake clock', staged.frozen);
    const raw = await p.evaluate(KEY => localStorage.getItem(KEY), KEY);
    check('Versioned checkpoint contains expected progress', JSON.parse(raw).progress.lab.open === true);
    await boot(p);
    check('Continue offered after reload', await p.locator('#title .go').innerText() === '이어서 탐사');
    await p.locator('#title .go').click(); await p.waitForTimeout(550);
    await p.evaluate(() => game.loop.stop());
    const restored = await p.evaluate(() => ({ snapshot: game.snapshot(), count: game.shrines.clearedCount(), mode: game.mode, map: game.mapPage.stats(), has: game.notebook.has }));
    check('Progress survives reload and resumes active fire shrine', restored.mode === 'room' && restored.snapshot.shrineRuns.active === 'fire' && restored.count === 1 && restored.has
      && restored.snapshot.forage.bag.fruit === 4 && restored.snapshot.kitchen.made.includes(staged.recipe)
      && restored.map.seen >= staged.map.seen && restored.snapshot.notebook.tab === 'field',
    { mode: restored.mode, count: restored.count, map: restored.map, tab: restored.snapshot.notebook.tab });
    const distance = Math.hypot(...restored.snapshot.position.map((v, i) => v - staged.snapshot.position[i]));
    check('Checkpoint returns to saved outdoor position', distance < 0.3, distance);
    await p.evaluate(() => { game.enterShrine(game.shrines.shrines[0]); game.loop.stop(); });
    check('Completed shrine stays open without duplicate orb', await p.evaluate(() => game.room.gates.every(g => g.solved)
      && game.room.prize.taken && !game.room.prize.group.visible));
    check('Hint three waits until 135 seconds', await p.evaluate(() => {
      const r = game.room; const id = Object.keys(r.hints).find(id => r.hints[id].texts.length >= 3); const h = r.hints[id];
      r.nudge(id, 45); const a = h.level; r.nudge(id, 45); const b = h.level;
      r.nudge(id, 0.1); const c = h.level; r.nudge(id, 44.9); return a === 1 && b === 2 && c === 2 && h.level === 3;
    }));
    // Completed save -> ending must remain visible past the start fade timer.
    await p.evaluate(() => {
      game.exitShrine(); game.returnToLab(); game.dialogue.close();
      game.shrines.shrines.forEach(s => game.shrines.markCleared(s));
      game.lab.markDone(); game.lab.interact(game.lab.reachables.find(p => p.name === '소포'));
      game.save();
    });
    await boot(p); await p.locator('#title .go').click(); await p.waitForTimeout(800);
    check('Completed save opens a lasting end card', await p.evaluate(() => game.title.isEnding && game.title.el.classList.contains('on')));
    await boot(p); await p.locator('#title .new').click(); await p.locator('#title .cancel').click();
    check('Cancel new exploration preserves saved progress', await p.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)).progress.cleared.length === 6, KEY));
    await p.locator('#title .new').click(); await p.locator('#title .confirm').click();
    check('New exploration keeps previous save as backup', await p.evaluate(({ KEY, BACKUP }) =>
      JSON.parse(localStorage.getItem(BACKUP)).progress.cleared.length === 6 && JSON.parse(localStorage.getItem(KEY)).progress.cleared.length === 0, { KEY, BACKUP }));
    await c.close();

    const { c: mobile, p: m } = await makeContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await boot(m); await m.locator('#title .go').tap(); await m.waitForTimeout(500);
    await m.evaluate(() => { game.dialogue.close(); game.notebook.setHas(true); game.touch.update(); });
    await m.locator('#tcNote').tap();
    check('Phone notebook opens by tap', await m.evaluate(() => game.notebook.isOpen));
    await m.screenshot({ path: path.join(out, 'rebirth-mobile-notebook.png') });
    await m.locator('#nbX').tap();
    check('Phone notebook closes by tap', await m.evaluate(() => !game.notebook.isOpen));
    await mobile.close();

    const { c: broken, p: e } = await makeContext();
    await broken.route('**/vendor/three/build/three.module.js', r => r.abort());
    await e.goto(base, { waitUntil: 'domcontentloaded' });
    await e.waitForSelector('#load.failed button');
    check('Missing engine shows retry instead of endless loading', await e.locator('#load.failed button').innerText() === '다시 열기');
    await broken.close();
    check('No unhandled browser errors', report.pageErrors.length === 0, report.pageErrors);
    check('All requested local assets exist', report.failedLocalRequests.length === 0, report.failedLocalRequests);
  } catch (error) { report.error = error.stack; console.error(error); process.exitCode = 1; }
  finally {
    fs.writeFileSync(path.join(out, 'quality-check.json'), JSON.stringify(report, null, 2));
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
