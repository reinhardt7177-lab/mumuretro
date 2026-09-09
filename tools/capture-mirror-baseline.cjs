// Run once before the mirror-gallery upgrade; the saved v1 fixture is kept as migration evidence.
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES || '', 'playwright'));
const base = process.env.AUDIT_URL || 'http://127.0.0.1:5512';
const out = path.resolve(__dirname, '../reports/2026-09-08/evidence/mirror-gallery'); fs.mkdirSync(out, { recursive: true });
(async () => {
  if (fs.existsSync(path.join(out, 'legacy-save.json'))) throw Error('Baseline already exists; preserve it.');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await c.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
    const p = await c.newPage(); await p.goto(base); await p.waitForFunction(() => window.game);
    await p.locator('#title .go').click(); await p.waitForTimeout(700);
    const state = await p.evaluate(() => {
      game.loop.stop(); game.dialogue.close(); game.brief.hide();
      game.lab.importState({ version: 1, dials: [3, 5, 8], hasNote: true, read: true, open: true, done: false, sent: false });
      game.notebook.setHas(true); game.landOnPlanet(); game.dialogue.close(); game.enterShrine(game.shrines.shrines[1]);
      const r = game.room, g = r.gates[1].gate; r.gates[0].solved = true; r.dungeon.openDoor('r1');
      if (r.gallery) throw Error('Requires pre-upgrade source. The preserved fixture must not be regenerated from the new gallery.');
      g.interact(g.mirrors[0]); r.nudge('r2', 60);
      game.roomActor.setAt(0, g.seg.z1 - 0.8); game.roomActor.camYaw = 0; game.input.camDist = 6.5; game.input.camPitch = 0.28;
      game.roomActor._camPlaced = false; game.roomActor.updateCamera(game.engine.camera, game.input, 0);
      game.save(); const raw = localStorage.getItem('mumuplanet.progress.v1');
      return { raw, seed: r.seed, checkpoint: r.exportState().checkpoint, layout: g.seg, fields: r.exportState().devices[1].fields };
    });
    await p.waitForTimeout(850); const metrics = await p.evaluate(() => {
      const info = game.engine.renderer.info, auto = info.autoReset; info.autoReset = false; info.reset(); game.engine.render();
      const result = { ...info.render }; info.autoReset = auto; return result;
    });
    await p.screenshot({ path: path.join(out, 'before.png') });
    fs.writeFileSync(path.join(out, 'legacy-save.json'), state.raw);
    delete state.raw; fs.writeFileSync(path.join(out, 'before.json'), JSON.stringify({ ...state, metrics }, null, 2));
    console.log(JSON.stringify({ seed: state.seed, fields: state.fields, metrics }));
  } finally { await browser.close(); }
})();
