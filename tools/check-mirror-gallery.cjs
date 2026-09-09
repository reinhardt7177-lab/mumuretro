const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES || '', 'playwright'));
const base = process.env.AUDIT_URL || 'http://127.0.0.1:5512';
const evidence = path.resolve(__dirname, '../reports/2026-09-08/evidence/mirror-gallery');
const out = path.resolve(__dirname, '../tmp/mirror-gallery'); fs.mkdirSync(out, { recursive: true });
const legacy = fs.readFileSync(path.join(evidence, 'legacy-save.json'), 'utf8');
const report = { date: new Date().toISOString(), checks: [], errors: [] };
function check(name, ok, detail) { report.checks.push({ name, pass: !!ok, detail }); assert.ok(ok, `${name}: ${JSON.stringify(detail)}`); console.log('PASS ' + name); }
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    async function fresh(raw = legacy, mobile = false, broken = false) {
      const c = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
      await c.addInitScript(value => {
        const nativeRAF = window.requestAnimationFrame.bind(window), nativeCancel = window.cancelAnimationFrame.bind(window);
        const pending = new Map(); let id = 0;
        window.requestAnimationFrame = callback => { pending.set(++id, callback); return id; };
        window.cancelAnimationFrame = key => pending.delete(key);
        window.releaseFrames = () => {
          window.requestAnimationFrame = nativeRAF; window.cancelAnimationFrame = nativeCancel;
          for (const callback of pending.values()) nativeRAF(callback); pending.clear();
        };
        localStorage.setItem('mumuplanet.progress.v1', value);
      }, raw);
      await c.route('**/*', async route => {
        if (!route.request().url().startsWith(base + '/')) return route.abort();
        if (broken === true && route.request().url().endsWith('/src/shrine/MirrorOptics.js')) {
          const response = await route.fetch(), source = await response.text();
          assert.ok(source.includes('Math.max(0, wall)')); return route.fulfill({ response, body: source.replace('Math.max(0, wall)', '40') });
        }
        if (broken === 'camera' && route.request().url().endsWith('/src/shrine/RoomActor.js')) {
          const response = await route.fetch(), source = await response.text();
          assert.ok(source.includes('Math.max(0.12, hit.distance - 0.35)'));
          return route.fulfill({ response, body: source.replace('Math.max(0.12, hit.distance - 0.35)', 'Math.max(0.6, hit.distance - 0.35)') });
        } return route.continue();
      });
      const p = await c.newPage(); p.on('pageerror', e => report.errors.push(e.message));
      p.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) report.errors.push(m.text()); });
      await p.goto(base); await p.waitForFunction(() => window.game, null, { polling: 50, timeout: 45000 });
      await p.locator('#title .go').click({ force: true }); await p.waitForFunction(() => game.mode !== 'title', null, { polling: 50 });
      await p.evaluate(() => {
        game.loop.stop(); window.releaseFrames(); game.dialogue.close(); game.brief.hide();
        window.mt = {
          tick(n = 1, intent = {}) { for (let i = 0; i < n; i++) { game.dialogue.close(); game.brief.hide(); game.input.setTestIntent(intent); game.step(1 / 60); } },
          walk(x, z) { let n = 0; while (Math.hypot(x - game.roomActor.position.x, z - game.roomActor.position.z) > 0.13 && n++ < 1600) {
            const p = game.roomActor.position; game.roomActor.camYaw = Math.atan2(-(x - p.x), -(z - p.z)); this.tick(1, { y: 1, run: true });
          } if (n >= 1600) throw Error(`Walk blocked toward ${x},${z} at ${game.roomActor.position.toArray()}`); this.tick(); return n; },
          act() { this.tick(1, { action: true }); this.tick(); },
          render() { game.dialogue.close(); game.brief.hide(); game.roomActor.camYaw = 0; game.input.camPitch = 0.28; game.input.camDist = 6.5;
            game.roomActor.heading.set(0, 0, -1); game.roomActor.syncMesh(); game.roomActor._camPlaced = false;
            game.roomActor.updateCamera(game.engine.camera, game.input, 0); game.engine.render(); },
        };
      });
      await p.waitForTimeout(950); return { c, p };
    }
    const { c, p } = await fresh();
    const migrated = await p.evaluate(() => {
      const r = game.room, g = r.gates[1].gate; mt.render();
      return { id: r.spec.id, seed: r.seed, pos: game.roomActor.position.toArray(), state: r.exportState(), seg: g.seg, mirrors: g.mirrors.map(m => ({ x: m.x, z: m.z, a: m.a })), trace: g.traceSegments };
    });
    fs.writeFileSync(path.join(out, 'migrated.json'), JSON.stringify(migrated, null, 2));
    check('Real pre-upgrade save resumes in expanded mirror room', migrated.id === 'shadow' && migrated.seed === 2199462457
      && migrated.seg.x1 - migrated.seg.x0 === 18 && migrated.pos[0] === 0 && migrated.pos[2] === migrated.seg.z1 - 1, migrated.pos);
    check('Legacy angle, first gate, hint and unfinished status survive migration', migrated.state.devices[1].version === 2
      && migrated.state.devices[1].fields['a.0'] === Math.PI / 4 && migrated.state.solved[0] && !migrated.state.solved[1]
      && migrated.state.hints.r2.level === 1 && migrated.state.hints.r2.t === 60, migrated.state.devices[1]);
    await p.screenshot({ path: path.join(out, 'after-entry.png') });
    // Reference comparison uses the baseline's same camera and actor position (visual staging only).
    await p.evaluate(() => { game.roomActor.setAt(0, game.room.gates[1].gate.seg.z1 - 0.8); mt.tick(); mt.render(); });
    await p.screenshot({ path: path.join(out, 'after-comparison.png') });
    const optics = await p.evaluate(async () => {
      const { traceMirrors } = await import('/src/shrine/MirrorOptics.js'); const { buildRoom } = await import('/src/shrine/Room.js');
      const stats = [];
      for (const seed of [2199462457, 1, 2, 7, 31, 208, 812744, 20260908]) {
        const room = seed === game.room.seed ? game.room : buildRoom(game.SHRINES[1], seed), g = room.gates[1].gate;
        let solutions = 0, shortest = 9, outside = 0, reflections = 0, reflectionError = 0;
        for (let n = 0; n < 512; n++) {
          const result = traceMirrors(g, [n & 7, (n >> 3) & 7, (n >> 6) & 7].map(a => a * Math.PI / 4));
          if (result.hit) { solutions++; shortest = Math.min(shortest, result.segments.filter(s => s.end === 'mirror').length); }
          const b = g.galleryOptics.bounds;
          result.segments.forEach((s, i) => {
            if (s.x1 < b.x0 - 1e-5 || s.x1 > b.x1 + 1e-5 || s.z1 < b.z0 - 1e-5 || s.z1 > b.z1 + 1e-5) outside++;
            if (s.end !== 'mirror' || !result.segments[i + 1]) return;
            reflections++; const next = result.segments[i + 1], l = Math.hypot(s.x1 - s.x0, s.z1 - s.z0), l2 = Math.hypot(next.x1 - next.x0, next.z1 - next.z0);
            const incoming = { x: (s.x1 - s.x0) / l, z: (s.z1 - s.z0) / l }, outgoing = { x: (next.x1 - next.x0) / l2, z: (next.z1 - next.z0) / l2 };
            const dot = incoming.x * s.normal.x + incoming.z * s.normal.z;
            reflectionError = Math.max(reflectionError, Math.hypot(outgoing.x - (incoming.x - 2 * dot * s.normal.x), outgoing.z - (incoming.z - 2 * dot * s.normal.z)), Math.hypot(s.x1 - next.x0, s.z1 - next.z0));
          });
        }
        stats.push({ seed, solutions, shortest, outside, reflections, reflectionError, initialSolved: traceMirrors(g, [0, 0, 0]).hit });
      } return stats;
    });
    check('All 4096 angle layouts stay bounded and obey continuous equal-angle reflection', optics.every(r => !r.outside && r.reflections > 0 && r.reflectionError < 1e-5), optics);
    check('Eight seeds require all three mirrors and never auto-complete on entry', optics.every(r => r.solutions > 0 && r.shortest === 3 && !r.initialSolved), optics);
    const walked = await p.evaluate(async () => {
      const { traceMirrors } = await import('/src/shrine/MirrorOptics.js'); const r = game.room, g = r.gates[1].gate;
      // Stage the already-tested first gate as clear; every move inside the upgraded room uses game.step.
      g.restart(); r.gates[1].solved = false; r.dungeon.resetDoors(); r.dungeon.openDoor('r1');
      game.roomActor.setAt(0, g.seg.z1 + 2); const frames = [mt.walk(0, g.seg.z1 - 1)];
      let solution; for (let n = 0; n < 512 && !solution; n++) { const a = [n & 7, n >> 3 & 7, n >> 6 & 7]; if (traceMirrors(g, a.map(i => i * Math.PI / 4)).hit) solution = a; }
      const turns = [];
      // Route above/below each pedestal through clear space; the actor never occupies a device centre.
      for (let i = 0; i < 3; i++) {
        const m = g.mirrors[i], p = game.roomActor.position;
        const approachZ = m.z + 1.4;
        if (i === 0) { frames.push(mt.walk(m.x, g.seg.z1 - 1)); frames.push(mt.walk(m.x, approachZ)); }
        if (i === 1) { frames.push(mt.walk(m.x + 1.5, p.z)); frames.push(mt.walk(m.x + 1.5, approachZ)); frames.push(mt.walk(m.x, approachZ)); }
        if (i === 2) { frames.push(mt.walk(m.x, p.z)); frames.push(mt.walk(m.x, approachZ)); }
        const before = g.mirrors.map(v => v.a); for (let j = 0; j < solution[i]; j++) mt.act();
        turns.push({ index: i, expected: solution[i], actual: Math.round(m.a / (Math.PI / 4)), position: game.roomActor.position.toArray(), otherUnchanged: g.mirrors.every((v, k) => i === k || v.a === before[k]) });
      }
      mt.tick(); mt.render(); game.save();
      return { frames, turns, solved: r.gates[1].solved, hit: g.hit, trace: g.traceSegments, raw: localStorage.getItem('mumuplanet.progress.v1') };
    });
    check('Walk from connecting bridge and turn each reachable mirror with E', walked.turns.every(t => t.expected === t.actual && t.otherUnchanged) && walked.solved && walked.hit, walked.turns);
    await p.screenshot({ path: path.join(out, 'after-solved.png') });
    fs.writeFileSync(path.join(out, 'new-save.json'), walked.raw);
    const camera = await p.evaluate(async () => {
      const THREE = await import('three'), r = game.room, a = game.roomActor, g = r.gates[1].gate;
      const old = a.position.clone(), oldYaw = a.camYaw, oldPitch = game.input.camPitch;
      const target = new THREE.Vector3(), dir = new THREE.Vector3(), ray = new THREE.Raycaster();
      const failures = [], surfaces = []; let count = 0;
      // 카메라가 등록한 목록과 별개로 실제 불투명 석재·장치 메시를 검사한다.
      r.gallery.group.traverse(m => {
        if (m.isMesh && !m.userData.sky && !m.material.transparent && m.material.type === 'MeshStandardMaterial') surfaces.push(m);
      });
      const positions = [[0, g.seg.z1 - 1], [-8.5, (g.seg.z0 + g.seg.z1) / 2], [7.5, g.seg.z0 + 2],
        ...g.mirrors.map(m => [m.x, m.z + 1.4])];
      for (const [x, z] of positions) for (const pitch of [0.08, 0.28, 0.65]) for (let n = 0; n < 8; n++) {
        if (r.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r)) throw Error('Camera fixture overlaps an obstacle');
        a.setAt(x, z); a.camYaw = n * Math.PI / 4; game.input.camPitch = pitch; a._camPlaced = false; a.updateCamera(game.engine.camera, game.input, 0);
        target.copy(a.position).y += 1.25; dir.subVectors(game.engine.camera.position, target); const length = dir.length();
        ray.set(target, dir.normalize()); ray.far = length + 0.20;
        const hit = ray.intersectObjects(surfaces, false)[0];
        if (hit) failures.push({ x, z, pitch, yaw: a.camYaw, distance: hit.distance, length }); count++;
      }
      a.setAt(old.x, old.z); a.camYaw = oldYaw; game.input.camPitch = oldPitch; mt.render();
      return { count, failures };
    });
    check('144 camera directions avoid real stone and mirror surfaces', camera.failures.length === 0, camera);
    const visual = await p.evaluate(async () => {
      const THREE = await import('three'), g = game.room.gates[1].gate;
      game.room.scene.updateMatrixWorld(true); let maxError = 0;
      g.traceSegments.forEach((s, i) => {
        const beam = g.segs[i]; const ends = [-0.5, 0.5].map(y => new THREE.Vector3(0, y, 0).applyMatrix4(beam.matrixWorld));
        const a = new THREE.Vector3(s.x0, 1.5, s.z0), b = new THREE.Vector3(s.x1, 1.5, s.z1);
        maxError = Math.max(maxError, Math.min(ends[0].distanceTo(a) + ends[1].distanceTo(b), ends[1].distanceTo(a) + ends[0].distanceTo(b)));
      });
      const before = JSON.stringify(game.room.exportState()), bad = JSON.parse(before); bad.devices[1].fields.hit = !bad.devices[1].fields.hit;
      const rejected = !game.room.importState(bad) && JSON.stringify(game.room.exportState()) === before;
      return { maxError, rejected };
    });
    check('Rendered beam endpoints coincide with computed reflection path', visual.maxError < 1e-5, visual);
    check('Corrupted optical hit flag rejects without changing live progress', visual.rejected);
    await p.evaluate(() => {
      const g = game.room.gates[1].gate; mt.walk(5.8, game.roomActor.position.z); mt.walk(5.8, g.seg.z1 - 2); mt.walk(0, g.seg.z1 - 2); mt.render();
    });
    await p.screenshot({ path: path.join(out, 'after-gallery.png') });
    report.sceneMetrics = await p.evaluate(() => {
      const info = game.engine.renderer.info, auto = info.autoReset; info.autoReset = false; info.reset(); game.engine.render(); const draw = { ...info.render }; info.autoReset = auto;
      let meshes = 0, batches = 0, instances = 0; game.room.gallery.group.traverse(m => { if (m.isMesh) meshes++; if (m.isInstancedMesh) { batches++; instances += m.count; } });
      return { draw, meshes, batches, instances, camera: game.engine.camera.position.toArray() };
    });
    check('Full-pass render stays within 1000 draw calls', report.sceneMetrics.draw.calls < 1000, report.sceneMetrics);
    const crossed = await p.evaluate(() => {
      const g = game.room.gates[1].gate; mt.walk(5.8, game.roomActor.position.z); mt.walk(5.8, g.seg.z0 + 1); mt.walk(0, g.seg.z0 + 1); mt.walk(0, g.seg.z0 - 2);
      return { pos: game.roomActor.position.toArray(), boundary: g.seg.z0 };
    });
    check('Solved mirror door opens and player walks into next corridor', crossed.pos[2] < crossed.boundary, crossed);
    const reload = await fresh(walked.raw);
    const restored = await reload.p.evaluate(() => ({ state: game.room.exportState(), hit: game.room.gates[1].gate.hit, pos: game.roomActor.position.toArray() }));
    check('New semantic save restores solved optics and pedestal-side checkpoint', restored.state.solved[1] && restored.hit
      && Math.hypot(restored.pos[0] - walked.turns[2].position[0], restored.pos[2] - walked.turns[2].position[2]) < 0.01, restored.pos);
    await reload.c.close();
    const broken = await fresh(legacy, false, true);
    const escaped = await broken.p.evaluate(async () => { const { traceMirrors } = await import('/src/shrine/MirrorOptics.js'), g = game.room.gates[1].gate, b = g.galleryOptics.bounds;
      return traceMirrors(g, [0, 0, 0]).segments.some(s => s.x1 < b.x0 || s.x1 > b.x1 || s.z1 < b.z0 || s.z1 > b.z1); });
    check('Fault injection: removing wall clipping is detected', escaped); await broken.c.close();
    const badCamera = await fresh(legacy, false, 'camera');
    const cameraInside = await badCamera.p.evaluate(() => {
      const g = game.room.gates[1].gate, a = game.roomActor; a.setAt(-8.5, (g.seg.z0 + g.seg.z1) / 2);
      game.room.dungeon.rects.cameraLiftZone = null; // 기본 충돌 여유 검사. 회랑의 위쪽 우회는 별도로 검사한다.
      a.camYaw = -Math.PI / 2; game.input.camPitch = 0.08; a._camPlaced = false; a.updateCamera(game.engine.camera, game.input, 0);
      return game.engine.camera.position.x < -8.9;
    });
    check('Fault injection: old camera minimum places camera inside near wall', cameraInside); await badCamera.c.close();
    const phone = await fresh(legacy, true);
    await phone.p.evaluate(() => {
      const g = game.room.gates[1].gate, m = g.mirrors[0]; mt.walk(m.x, g.seg.z1 - 1); mt.walk(m.x, m.z + 1.4);
      game.input.setTestIntent(null); game.step(1 / 60); mt.render();
    });
    const angle = await phone.p.evaluate(() => game.room.gates[1].gate.mirrors[0].a);
    await phone.p.locator('#tcAct').tap(); await phone.p.evaluate(() => { game.step(1 / 60); game.step(1 / 60); mt.render(); });
    check('Mobile touch E rotates the nearby mirror once', await phone.p.evaluate(a => Math.abs(game.room.gates[1].gate.mirrors[0].a - a - Math.PI / 4) < 1e-6, angle));
    check('Close mirror camera lifts above device and keeps explorer visible', await phone.p.evaluate(() => {
      const target = game.roomActor.position.clone(); target.y += 1.25;
      return game.engine.camera.position.distanceTo(target) >= 2;
    }));
    await phone.p.screenshot({ path: path.join(out, 'after-mobile.png') });
    await phone.p.locator('#tcNote').tap(); check('Mobile notebook button opens', await phone.p.evaluate(() => game.notebook.isOpen));
    await phone.p.locator('#nbX').tap(); await phone.c.close();
    await p.evaluate(() => { game.input.setTestIntent(null); game.step(1 / 60); });
    await p.locator('#tcNote').click(); check('PC notebook button opens', await p.evaluate(() => game.notebook.isOpen));
    await p.locator('#nbX').click();
    await c.close();
    check('No JavaScript or WebGL shader errors', report.errors.length === 0, report.errors);
  } catch (e) { report.failure = e.stack; console.error(e); process.exitCode = 1; }
  finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
})();
