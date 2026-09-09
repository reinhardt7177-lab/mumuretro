const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES || '', 'playwright'));
const base = process.env.AUDIT_URL || 'http://127.0.0.1:5512';
const out = path.resolve(__dirname, '../reports/2026-09-08/evidence/silhouette-court'); fs.mkdirSync(out, { recursive: true });
(async () => {
  if (fs.existsSync(path.join(out, 'legacy-save.json'))) throw Error('Preserve the original silhouette fixture.');
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
      const r = game.room, g = r.gates[2].gate; if (r.silhouetteCourt) throw Error('Requires pre-upgrade source.');
      r.gates.slice(0, 2).forEach(w => { w.solved = true; w.gate.restoreSolved?.(true); r.dungeon.openDoor(w.room); });
      game.roomActor.setAt(0, g.seg.z1 - 1); r.nudge('r3', 60);
      const initial = r.exportState(), samples = [], vertices = g.obj.geometry.attributes.position;
      for (const distance of [1.2, 2.8, 4, 6.4, 9.2]) {
        g.objZ = g.lampZ - distance; g.obj.position.z = g.objZ; g.solved = true; g._resize(); r.scene.updateMatrixWorld(true);
        const points = [], light = g.lampBall.position;
        for (let i = 0; i < vertices.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(g.obj.matrixWorld), t = (g.wallZ - light.z) / (v.z - light.z);
          points.push({ x: light.x + t * (v.x - light.x), y: light.y + t * (v.y - light.y) });
        }
        const lo = Math.min(...points.map(p => p.x)), hi = Math.max(...points.map(p => p.x));
        const bottom = Math.min(...points.map(p => p.y)), top = Math.max(...points.map(p => p.y));
        samples.push({ distance, formulaWidth: g._size(), physicalWidth: hi - lo, physicalY: (bottom + top) / 2, renderedY: g.shadow.position.y });
      }
      r.importState(initial); g.held = true; g.objZ = g.lampZ - 4.4; g.obj.position.z = g.objZ; g._resize();
      game.roomActor.setAt(0, g.objZ); game.save(); const raw = localStorage.getItem('mumuplanet.progress.v1'), heldPrompt = g.prompt(game.roomActor.position);
      game.roomActor.setAt(0, g.seg.z1 - 1); game.roomActor.camYaw = 0; game.input.camDist = 6.5; game.input.camPitch = 0.28; game.roomActor.syncMesh();
      game.roomActor._camPlaced = false; game.roomActor.updateCamera(game.engine.camera, game.input, 0);
      return { raw, seed: r.seed, samples, heldPrompt, initialRound: initial.devices[2].fields.round };
    });
    await p.waitForTimeout(850); state.metrics = await p.evaluate(() => {
      const info = game.engine.renderer.info, auto = info.autoReset; info.autoReset = false; info.reset(); game.engine.render(); const result = { ...info.render }; info.autoReset = auto; return result;
    });
    await p.screenshot({ path: path.join(out, 'before.png') });
    fs.writeFileSync(path.join(out, 'legacy-save.json'), state.raw); delete state.raw;
    fs.writeFileSync(path.join(out, 'before.json'), JSON.stringify(state, null, 2)); console.log(JSON.stringify(state));
  } finally { await browser.close(); }
})();
