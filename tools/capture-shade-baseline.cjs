const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES || '', 'playwright'));
const base = process.env.AUDIT_URL || 'http://127.0.0.1:5512';
const out = path.resolve(__dirname, '../reports/2026-09-08/evidence/shade-court'); fs.mkdirSync(out, { recursive: true });
(async () => {
  if (fs.existsSync(path.join(out, 'legacy-save.json'))) throw Error('Preserve the original shade fixture.');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await c.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
    const p = await c.newPage(); await p.goto(base); await p.waitForFunction(() => window.game);
    await p.locator('#title .go').click(); await p.waitForTimeout(700);
    const state = await p.evaluate(async () => {
      const THREE = await import('three'); game.loop.stop(); game.dialogue.close(); game.brief.hide();
      game.lab.importState({ version: 1, dials: [3, 5, 8], hasNote: true, read: true, open: true, done: false, sent: false });
      game.notebook.setHas(true); game.landOnPlanet(); game.dialogue.close(); game.enterShrine(game.shrines.shrines[1]);
      const r = game.room, g = r.gates[0].gate; if (r.shadeCourt) throw Error('Requires pre-upgrade source.');
      game.roomActor.setAt(0, g.seg.z1 - 1); r.nudge('r1', 60);
      const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), samples = [];
      for (const a of [0, 0.7, 1.4, 2.1, Math.PI]) {
        g.a = a; g.update(0, game.roomActor); r.scene.updateMatrixWorld(true);
        let points = 0, mismatch = 0;
        for (let x = g.seg.x0 + 0.5; x < g.seg.x1 - 0.5; x += 0.25) for (let z = g.safeOut + 0.1; z < g.safeIn; z += 0.25) {
          if (g.pillars.some(p => Math.hypot(x - p.x, z - p.z) < p.r + 0.2)) continue;
          ray.set(new THREE.Vector3(x, 1, z), down); const visible = ray.intersectObjects(g.pillars.map(p => p.shadow), false).length > 0;
          if (visible !== g.inShadow(x, z, g._lampPos())) mismatch++; points++;
        } samples.push({ a, points, mismatch });
      }
      g.a = 0.7; g.update(0, game.roomActor); game.save();
      game.roomActor.camYaw = 0; game.input.camDist = 6.5; game.input.camPitch = 0.28; game.roomActor.syncMesh();
      game.roomActor._camPlaced = false; game.roomActor.updateCamera(game.engine.camera, game.input, 0);
      return { raw: localStorage.getItem('mumuplanet.progress.v1'), samples, seed: r.seed, checkpoint: r.exportState().checkpoint };
    });
    await p.waitForTimeout(850); const metrics = await p.evaluate(() => {
      const info = game.engine.renderer.info, auto = info.autoReset; info.autoReset = false; info.reset(); game.engine.render();
      const draw = { ...info.render }; info.autoReset = auto; return draw;
    });
    await p.screenshot({ path: path.join(out, 'before.png') });
    fs.writeFileSync(path.join(out, 'legacy-save.json'), state.raw); delete state.raw;
    fs.writeFileSync(path.join(out, 'before.json'), JSON.stringify({ ...state, metrics }, null, 2)); console.log(JSON.stringify(state));
  } finally { await browser.close(); }
})();
