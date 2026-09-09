// Run: node tools/check-endflow.cjs (Playwright must be installed).
// Optional: AUDIT_NODE_MODULES, AUDIT_BROWSER, AUDIT_URL (existing server), AUDIT_PORT.
// Test storage is isolated; only one browser context is kept open at a time.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { chromium } = process.env.AUDIT_NODE_MODULES
  ? require(path.join(process.env.AUDIT_NODE_MODULES, 'playwright')) : require('playwright');
let BASE = process.env.AUDIT_URL || 'http://127.0.0.1';
const KEY = 'mumuplanet.progress.v1', BACKUP = 'mumuplanet.progress.previous.v1';
const report = { date: new Date().toISOString(), boots: [], checks: [], errors: [] };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, BASE).pathname.replace(/\/$/, '/index.html')));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  let browser, context, p;
  if (!process.env.AUDIT_URL) {
    await new Promise((resolve, reject) => {
      server.once('error', reject); server.listen(Number(process.env.AUDIT_PORT) || 0, '127.0.0.1', resolve);
    });
    BASE = 'http://127.0.0.1:' + server.address().port;
  }
  const origin = new URL(BASE).origin;
  try {
    browser = await chromium.launch({ channel: process.env.AUDIT_BROWSER || 'msedge', headless: true });
    async function makePage(options = {}) {
      if (context) await context.close();
      context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
      await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
      await context.addInitScript(({ origin, KEY, BACKUP, raw, blockStorage, blockBackup }) => {
        if (location.origin !== origin) return;
        const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
        if (typeof raw === 'string') set.call(localStorage, KEY, raw);
        window.__auditNativeRead = key => get.call(localStorage, key);
        Storage.prototype.getItem = function (key) {
          if (blockStorage) throw new DOMException('Test: storage is blocked', 'SecurityError');
          return get.call(this, key);
        };
        Storage.prototype.setItem = function (key, value) {
          if (blockStorage || blockBackup && key === BACKUP)
            throw new DOMException('Test: storage is full', 'QuotaExceededError');
          return set.call(this, key, value);
        };
      }, { origin, KEY, BACKUP, ...options });
      p = await context.newPage();
      p.on('pageerror', e => report.errors.push(e.message));
    }
    async function boot(label) {
      const start = Date.now();
      await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
      try {
        await p.waitForFunction(() => window.game && document.getElementById('load').style.display === 'none', null, { timeout: 60000 });
      } catch (error) {
        report.bootFailure = await p.evaluate(() => ({ ready: document.readyState, load: document.getElementById('load')?.outerHTML, mode: window.game?.mode }));
        throw error;
      }
      await p.evaluate(() => game.loop.stop());
      const result = { label, ms: Date.now() - start }; report.boots.push(result); console.log(JSON.stringify(result));
    }
    const check = (name, value) => { report.checks.push({ name, pass: !!value }); assert.ok(value, name); console.log('PASS ' + name); };
    await makePage();
    await boot('fresh');
    const prepared = await p.evaluate(({ KEY }) => {
      game.title.start(); game.dialogue.close();
      game.lab.importState({ version: 1, dials: [3, 5, 8], hasNote: true, read: true, open: true, done: true, sent: true });
      game.shrines.shrines.forEach(s => game.shrines.markCleared(s));
      game.notebook.setHas(true); game.save();
      const p = JSON.parse(localStorage.getItem(KEY)).progress;
      return p.cleared.length === 6 && p.lab.sent;
    }, { KEY });
    check('completed save prepared in real game state', prepared);
    const completedRaw = await p.evaluate(KEY => localStorage.getItem(KEY), KEY);
    await boot('completed-save');
    check('finished record offered', (await p.locator('#title .go').innerText()).includes('완성'));
    await p.locator('#title .go').click();
    await p.waitForTimeout(800);
    report.ending = await p.evaluate(() => ({ ending: game.title.isEnding, className: game.title.el.className,
      visible: getComputedStyle(game.title.el).display !== 'none', text: game.title.el.innerText }));
    check('end card remains on after 800ms', report.ending.ending && report.ending.className.includes('on') && report.ending.visible);
    await p.screenshot({ path: path.join(root, 'tmp/endflow-card.png') });
    await boot('new-game-choice');
    const before = await p.evaluate(KEY => localStorage.getItem(KEY), KEY);
    await p.locator('#title .new').click(); await p.locator('#title .cancel').click();
    check('cancel preserves exact primary record', await p.evaluate(KEY => localStorage.getItem(KEY), KEY) === before);
    await p.locator('#title .new').click(); await p.locator('#title .confirm').click();
    const after = await p.evaluate(({ KEY, BACKUP }) => ({ primary: JSON.parse(localStorage.getItem(KEY)), backup: localStorage.getItem(BACKUP), mode: game.mode }), { KEY, BACKUP });
    check('new game stores exact previous record in backup', after.backup === before);
    check('new game starts with empty progression', after.mode === 'lab' && after.primary.progress.cleared.length === 0 && !after.primary.progress.lab.hasNote && !after.primary.progress.lab.sent);

    await makePage({ blockStorage: true });
    await boot('storage-blocked');
    check('blocked storage is explained before starting', (await p.locator('#title .save-detail').innerText()).includes('저장을 사용할 수 없다'));
    await p.locator('#title .go').click();
    check('storage exceptions still allow a fresh lab session', await p.evaluate(() => game.mode === 'lab' && !game.lab.state.hasNote && game.save() === false));

    const corrupt = '{"version":1,"broken":';
    await makePage({ raw: corrupt });
    await boot('corrupted-json');
    check('corrupt JSON is explained before starting', (await p.locator('#title .save-detail').innerText()).includes('이전 기록을 읽지 못했다'));
    await p.locator('#title .go').click();
    check('corrupt source is kept verbatim in backup', await p.evaluate(({ BACKUP, corrupt }) =>
      localStorage.getItem(BACKUP) === corrupt && game.mode === 'lab' && game.save(), { BACKUP, corrupt }));

    await makePage({ raw: completedRaw, blockBackup: true });
    await boot('backup-write-blocked');
    await p.locator('#title .new').click(); await p.locator('#title .confirm').click();
    check('failed backup leaves original save untouched and disables new saves', await p.evaluate(({ KEY, completedRaw }) =>
      window.__auditNativeRead(KEY) === completedRaw && game.save() === false && game.mode === 'lab'
        && !game.lab.state.hasNote && game.shrines.clearedCount() === 0, { KEY, completedRaw }));

    const partial = JSON.parse(completedRaw);
    partial.progress.lab.sent = false;
    partial.progress.map.seen = [];
    const partialRaw = JSON.stringify(partial);
    await makePage({ raw: partialRaw });
    await boot('partial-map-restore');
    await p.locator('#title .go').click();
    check('partial restore backs up original and continues with a valid map', await p.evaluate(({ BACKUP, partialRaw }) =>
      localStorage.getItem(BACKUP) === partialRaw && game.mode === 'lab' && game.notebook.has
      && game.shrines.clearedCount() === 6 && game.mapPage.exportState().seen.length === 20000 && game.save(), { BACKUP, partialRaw }));

    const unfinished = JSON.parse(completedRaw);
    unfinished.progress.lab.done = false; unfinished.progress.lab.sent = false;
    unfinished.progress.dialogue = { version: 1, seen: [] };
    await makePage({ raw: JSON.stringify(unfinished) });
    await boot('unfinished-ending-dialogue');
    await p.locator('#title .go').click();
    check('unfinished ending resumes its dialogue', await p.evaluate(() => game.dialogue.active && !game.lab.done && game.shrines.clearedCount() === 6));
    const finishedDialogue = await p.evaluate(() => {
      let steps = 0;
      while (game.dialogue.active && steps < 100) { game.dialogue.next(); steps++; }
      return { steps, active: game.dialogue.active, done: game.lab.done, save: game.save() };
    });
    check('finishing resumed dialogue marks lab done and persists', finishedDialogue.steps > 1 && !finishedDialogue.active && finishedDialogue.done && finishedDialogue.save);
    report.resumedDialogue = finishedDialogue;
    check('no page errors', report.errors.length === 0);
    report.pass = true;
  } catch (error) { report.error = error.stack; report.pass = false; console.error(error); process.exitCode = 1; }
  finally {
    if (context) await context.close();
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
    fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
    fs.writeFileSync(path.join(root, 'tmp/endflow-check.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
