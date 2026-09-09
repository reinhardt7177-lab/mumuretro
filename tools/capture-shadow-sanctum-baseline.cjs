const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES || '', 'playwright'));
const base = process.env.AUDIT_URL || 'http://127.0.0.1:5512';
const out = path.resolve(__dirname, '../reports/2026-09-08/evidence/shadow-sanctum'); fs.mkdirSync(out, { recursive: true });
(async () => {
  if (fs.existsSync(path.join(out, 'legacy-save.json'))) throw Error('Preserve the original sanctum fixture.');
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
      const r = game.room, g = r.final; if (r.sanctum) throw Error('Requires pre-upgrade source.');
      r.gates.forEach(w => { w.solved = true; w.gate.restoreSolved?.(true); r.dungeon.openDoor(w.room); });
      game.roomActor.setAt(0, g.seg.z1 - 1); r.nudge('shrine', 60);
      const bodies = g.group.children.filter(m => m.isMesh && m.geometry.type === 'CylinderGeometry'), ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), physical = new THREE.Raycaster(), samples = [];
      for (const ai of [0, 2, 5]) for (let hi = 0; hi < 3; hi++) {
        g.ai = ai; g.hi = hi; g._apply(); r.scene.updateMatrixWorld(true); let count = 0, mismatch = 0;
        for (let x = g.seg.x0 + 0.37; x < g.seg.x1 - 0.3; x += 0.29) for (let z = g.seg.z0 + 0.37; z < g.seg.z1 - 0.3; z += 0.29) {
          if (Math.hypot(x - g.gx, z - g.gz) < 2) continue;
          const point = new THREE.Vector3(x, 0, z), direction = point.clone().sub(g.lampBall.position), distance = direction.length();
          physical.set(g.lampBall.position, direction.normalize()); physical.far = distance;
          const blocked = physical.intersectObjects(bodies, false).length > 0;
          ray.set(point.clone().setY(0.2), down); ray.far = 0.3; const shown = ray.intersectObject(g.shadow, false).length > 0;
          if (blocked !== shown) mismatch++; count++;
        } samples.push({ ai, hi, lampY: g.lampBall.position.y, count, mismatch });
      }
      g.ai = (g.answer.a + 1) % 8; g.hi = g.answer.h; g._apply(); game.save(); const raw = localStorage.getItem('mumuplanet.progress.v1');
      g.ai = g.answer.a; g._apply(); g.eyes.tick(0.6, true); r.prize.reveal(); r.prize.update(0.6); game.save();
      const rewardRaw = localStorage.getItem('mumuplanet.progress.v1');
      r.prize.reset(); g.ai = (g.answer.a + 1) % 8; g._apply(); g.eyes.reset();
      game.roomActor.camYaw = 0; game.input.camDist = 6.5; game.input.camPitch = 0.28; game.roomActor.syncMesh();
      game.roomActor._camPlaced = false; game.roomActor.updateCamera(game.engine.camera, game.input, 0);
      return { raw, rewardRaw, seed: r.seed, answer: g.answer, partial: { ai: g.ai, hi: g.hi }, samples };
    });
    await p.waitForTimeout(850); state.metrics = await p.evaluate(() => {
      const info = game.engine.renderer.info, auto = info.autoReset; info.autoReset = false; info.reset(); game.engine.render(); const v = { ...info.render }; info.autoReset = auto; return v;
    });
    await p.screenshot({ path: path.join(out, 'before.png') });
    fs.writeFileSync(path.join(out, 'legacy-save.json'), state.raw); fs.writeFileSync(path.join(out, 'legacy-reward.json'), state.rewardRaw); delete state.raw; delete state.rewardRaw;
    fs.writeFileSync(path.join(out, 'before.json'), JSON.stringify(state, null, 2)); console.log(JSON.stringify(state));
  } finally { await browser.close(); }
})();
