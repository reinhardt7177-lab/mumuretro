const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES || '', 'playwright'));
const base = (process.env.AUDIT_URL || 'http://127.0.0.1:5512').replace(/\/$/, '');
const evidence = path.resolve(__dirname, '../reports/2026-09-08/evidence/shadow-sanctum');
const out = path.resolve(__dirname, '../tmp/shadow-sanctum'); fs.mkdirSync(out, { recursive: true });
const legacy = fs.readFileSync(path.join(evidence, 'legacy-save.json'), 'utf8'), legacyReward = fs.readFileSync(path.join(evidence, 'legacy-reward.json'), 'utf8');
const baseline = JSON.parse(fs.readFileSync(path.join(evidence, 'before.json'))), report = { date: new Date().toISOString(), checks: [], errors: [] };
function check(name, pass, details) { report.checks.push({ name, pass: !!pass, details }); assert.ok(pass, `${name}: ${JSON.stringify(details)}`); console.log('PASS ' + name); }
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    async function fresh(raw = legacy, mobile = false, broken = false) {
      const c = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
      await c.addInitScript(value => {
        const raf = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window), pending = new Map(); let id = 0;
        window.requestAnimationFrame = cb => { pending.set(++id, cb); return id; }; window.cancelAnimationFrame = key => pending.delete(key);
        window.releaseFrames = () => { window.requestAnimationFrame = raf; window.cancelAnimationFrame = cancel; for (const cb of pending.values()) raf(cb); pending.clear(); };
        localStorage.setItem('mumuplanet.progress.v1', value);
      }, raw);
      await c.route('**/*', async route => {
        if (!route.request().url().startsWith(base + '/')) return route.abort();
        if (broken && route.request().url().endsWith('/src/shrine/ShadowSanctum.js')) {
          const response = await route.fetch(), source = await response.text(); assert.ok(source.includes('positions.push(v.x, D.shadowY, v.z)'));
          return route.fulfill({ response, body: source.replace('positions.push(v.x, D.shadowY, v.z)', 'positions.push(v.x + 0.8, D.shadowY, v.z)') });
        } return route.continue();
      });
      const p = await c.newPage(); p.on('pageerror', e => report.errors.push(e.message));
      p.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) report.errors.push(m.text()); });
      await p.goto(base); await p.waitForFunction(() => window.game, null, { polling: 50, timeout: 45000 });
      await p.locator('#title .go').click({ force: true }); await p.waitForFunction(() => game.mode !== 'title', null, { polling: 50 });
      await p.evaluate(() => {
        game.loop.stop(); releaseFrames(); game.dialogue.close(); game.brief.hide();
        window.st = {
          tick(n = 1, intent = {}) { for (let i = 0; i < n; i++) { game.dialogue.close(); game.brief.hide(); game.input.setTestIntent(intent); game.step(1 / 60); } },
          act() { this.tick(1, { action: true }); this.tick(); },
          walk(x, z) { let n = 0; while (Math.hypot(x - game.roomActor.position.x, z - game.roomActor.position.z) > 0.06 && n++ < 1300) {
            const p = game.roomActor.position; game.roomActor.camYaw = Math.atan2(-(x - p.x), -(z - p.z)); this.tick(1, { y: 1 });
          } if (n >= 1300) throw Error('Walk blocked ' + [x, z, ...game.roomActor.position.toArray()]); this.tick(); return n; },
          stage() { const r = game.room; r.restart(); r.hasProgress = true;
            r.gates.forEach(w => { w.solved = true; w.gate.restoreSolved?.(true); r.dungeon.openDoor(w.room); });
            game.roomActor.setAt(0, r.shrineSeg.z1 + 3); },
          render(pitch = 0.28) { game.dialogue.close(); game.brief.hide(); const a = game.roomActor;
            a.camYaw = 0; game.input.camPitch = pitch; game.input.camDist = 6.5; a.heading.set(0, 0, -1);
            a.syncMesh(); a._camPlaced = false; a.updateCamera(game.engine.camera, game.input, 0); game.engine.render(); },
        };
      });
      await p.waitForTimeout(900); return { c, p };
    }
    const { c, p } = await fresh();
    const migration = await p.evaluate(() => { const r = game.room, zones = r.dungeon.rects.cameraLookHeightZones;
      r.dungeon.rects.cameraLookHeightZones = []; st.render(); r.dungeon.rects.cameraLookHeightZones = zones;
      return { seed: r.seed, state: r.exportState(), position: game.roomActor.position.toArray(), answer: r.final.answer }; });
    check('Legacy finale preserves direction, height, target, hints and open gates at safe entry', migration.seed === baseline.seed
      && migration.state.final.version === 2 && migration.state.final.fields.ai === baseline.partial.ai && migration.state.final.fields.hi === baseline.partial.hi
      && JSON.stringify(migration.answer) === JSON.stringify(baseline.answer) && migration.state.solved.every(Boolean)
      && migration.state.hints.shrine.t === 60 && migration.position[0] === 0 && migration.position[2] === -56, migration);
    report.comparisonMetrics = await p.evaluate(() => { const info = game.engine.renderer.info, auto = info.autoReset; info.autoReset = false; info.reset(); game.engine.render(); const v = { ...info.render }; info.autoReset = auto; return v; });
    await p.screenshot({ path: path.join(out, 'after-comparison.png') });
    const audit = async (page, brief = false) => page.evaluate(async brief => {
      const THREE = await import('three'), { shadowContains } = await import('/src/shrine/SanctumOptics.js');
      const g = game.room.final, s = g.sanctum, old = { ai: g.ai, hi: g.hi }, rows = [];
      const physical = new THREE.Raycaster(), drawn = new THREE.Raycaster(), point = new THREE.Vector3(), dir = new THREE.Vector3(), light = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
      const allBodies = []; s.statue.traverse(m => { if (m.isMesh) allBodies.push(m); });
      const angles = brief ? [0, 3] : [0, 1, 2, 3, 4, 5, 6, 7];
      for (const ai of angles) for (let hi = 0; hi < 3; hi++) {
        g.ai = ai; g.hi = hi; g._apply(); game.room.scene.updateMatrixWorld(true); g.lampBall.getWorldPosition(light);
        const polygons = s.polygonsAt(ai, hi); let count = 0, visualMismatch = 0, physicalMismatch = 0, shadowed = 0, signature = 2166136261;
        for (let x = -7.39; x < 7.4; x += 0.31) for (let z = g.gz - 7.37; z < g.gz + 7.4; z += 0.31) {
          point.set(x, 0, z); dir.copy(point).sub(light); const length = dir.length(); physical.set(light, dir.normalize()); physical.far = length;
          const blocked = physical.intersectObjects(allBodies, false).length > 0, computed = shadowContains(polygons, x, z);
          drawn.set(point.set(x, 0.1, z), down); drawn.far = 0.15; const visible = drawn.intersectObject(g.shadow, false).length > 0;
          if (blocked !== computed) physicalMismatch++; if (visible !== computed) visualMismatch++; if (blocked) shadowed++;
          signature = Math.imul(signature ^ Number(blocked), 16777619) >>> 0; count++;
        }
        rows.push({ ai, hi, count, visualMismatch, physicalMismatch, shadowed, signature, length: g._len(hi), solved: g.solved, lampY: light.y,
          bounded: polygons.flat().every(v => v.x >= s.bounds.x0 - 1e-6 && v.x <= s.bounds.x1 + 1e-6 && v.z >= s.bounds.z0 - 1e-6 && v.z <= s.bounds.z1 + 1e-6) });
      }
      g.ai = old.ai; g.hi = old.hi; g._apply(); return rows;
    }, brief);
    const optics = await audit(p); report.optics = optics;
    check('All 24 direction-height combinations match actual statue ray blocking', optics.every(v => v.physicalMismatch === 0 && v.shadowed > 0 && v.bounded), optics);
    check('Rendered triangles match computed shadows in every combination', optics.every(v => v.visualMismatch === 0), optics);
    check('24 distinct visible shadows have exactly one winning combination', new Set(optics.map(v => v.signature)).size === 24
      && optics.filter(v => v.solved).length === 1 && optics.find(v => v.solved).ai === baseline.answer.a && optics.find(v => v.solved).hi === baseline.answer.h);
    check('Raising the light shortens the shadow at all eight directions', [0,1,2,3,4,5,6,7].every(a => { const v = optics.filter(v => v.ai === a); return v[0].length > v[1].length && v[1].length > v[2].length; }));
    const framing = await p.evaluate(async () => {
      const THREE = await import('three'), g = game.room.final, old = { ai: g.ai, hi: g.hi }, failures = [], controlErrors = [];
      game.roomActor.setAt(0, g.seg.z1 - 1);
      for (let ai = 0; ai < 8; ai++) for (let hi = 0; hi < 3; hi++) {
        g.ai = ai; g.hi = hi; g._apply(); st.render(); game.room.scene.updateMatrixWorld(true);
        const L = g.lampBall.getWorldPosition(new THREE.Vector3()), projected = L.clone().project(game.engine.camera);
        if (Math.abs(projected.x) > 0.96 || Math.abs(projected.y) > 0.96 || projected.z < -1 || projected.z > 1) failures.push({ ai, hi, projected: projected.toArray() });
        const handle = g.leverA.knob.getWorldPosition(new THREE.Vector3()).sub(new THREE.Vector3(g.leverA.x, 0, g.leverA.z));
        const direction = new THREE.Vector2(handle.x, handle.z).normalize(), lampDirection = new THREE.Vector2(L.x - g.gx, L.z - g.gz).normalize();
        if (direction.distanceTo(lampDirection) > 1e-6 || Math.abs(g.leverB.knob.position.y - (0.98 + hi * 0.39)) > 1e-6) controlErrors.push({ ai, hi });
      } g.ai = old.ai; g.hi = old.hi; g._apply(); return { combinations: 24, failures, controlErrors };
    });
    check('Default PC entrance view contains the lamp in all 24 states', !framing.failures.length, framing);
    check('Wheel marker and height grip show actual lamp settings', !framing.controlErrors.length);
    const boundary = await p.evaluate(async () => {
      const { shadowContains } = await import('/src/shrine/SanctumOptics.js'), g = game.room.final, s = g.sanctum, polygons = s.polygonsAt(g.answer.a, g.answer.h);
      const bad = []; for (const [a, b] of s.targetEdges) {
        const dx = b.x - a.x, dz = b.z - a.z, k = 0.003 / Math.hypot(dx, dz), x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
        if (!shadowContains(polygons, x - dz * k, z + dx * k) || shadowContains(polygons, x + dz * k, z - dx * k)) bad.push([a, b]);
      } return { segments: s.targetEdges.length, bad };
    });
    check('Target lines follow the outer silhouette, without internal part seams', boundary.segments > 6 && !boundary.bad.length, boundary);
    const wrong = await p.evaluate(() => {
      const r = game.room, good = JSON.stringify(r.exportState()), bad = JSON.parse(good); bad.final.fields.solved = !bad.final.fields.solved;
      return !r.importState(bad) && JSON.stringify(r.exportState()) === good;
    });
    check('Inconsistent solved flag rejects before changing live state', wrong);
    const reward = await fresh(legacyReward);
    const resumedReward = await reward.p.evaluate(() => { const r = game.room, before = r.exportState(); st.tick(24); return { before, after: r.exportState() }; });
    check('Legacy awakening and falling orb resume partway through, without replaying start', resumedReward.before.final.fields.solved
      && Math.abs(resumedReward.before.final.fields.eyes - 0.4) < 1e-8 && resumedReward.before.prize.drop > 0 && resumedReward.before.prize.drop < 1
      && resumedReward.after.final.fields.eyes > resumedReward.before.final.fields.eyes && resumedReward.after.prize.drop > resumedReward.before.prize.drop, resumedReward); await reward.c.close();
    const walks = [];
    for (const tier of [0, 3, 5]) {
      const route = await p.evaluate(tier => {
        st.stage(); const r = game.room, g = r.final; r.applyTier(tier); let steps = st.walk(0, g.seg.z1 - 1), turns = 0;
        steps += st.walk(g.leverB.x, g.leverB.z + 1.5); const wrongHeight = (g.answer.h + 1) % 3;
        while (g.hi !== wrongHeight) { st.act(); if (++turns > 15) throw Error('Height handle unreachable'); }
        const beforeA = g.ai, h = g.hi; steps += st.walk(g.leverA.x, g.leverA.z + 1.5);
        while (g.ai !== g.answer.a) { st.act(); if (++turns > 25) throw Error('Direction wheel unreachable'); }
        const directionOnly = !g.solved && g.hi === h && g.ai !== beforeA;
        steps += st.walk(g.leverB.x, g.leverB.z + 1.5); const a = g.ai;
        while (g.hi !== g.answer.h) { st.act(); if (++turns > 30) throw Error('Height match blocked'); }
        const solved = g.solved && g.ai === a; st.tick(120);
        steps += st.walk(0, g.leverB.z + 1.5); steps += st.walk(r.prize.pos.x, r.prize.pos.z + 1.4);
        return { tier, steps, turns, directionOnly, solved, eyes: g.eyes.awake, drop: r.prize.drop, collectible: r.prize._near(game.roomActor.position) };
      }, tier); walks.push(route);
    }
    check('Walk to both controls and combine direction with height at three tiers', walks.every(v => v.directionOnly && v.solved && v.eyes === 1 && v.drop === 1 && v.collectible), walks);
    await p.evaluate(() => { st.render(0.46); }); await p.screenshot({ path: path.join(out, 'after-solved.png') });
    const saved = await p.evaluate(() => { game.save(); return { raw: localStorage.getItem('mumuplanet.progress.v1'), state: game.room.exportState() }; });
    const restored = await fresh(saved.raw);
    const collected = await restored.p.evaluate(() => {
      const r = game.room, before = r.exportState(); st.tick(2); st.act(); const taken = r.prize.taken, first = JSON.stringify(game.snapshot().notebook);
      st.act(); const duplicate = r.prize.interact(game.roomActor.position), unchanged = JSON.stringify(game.snapshot().notebook) === first;
      game.save(); return { before, taken, duplicate, unchanged, raw: localStorage.getItem('mumuplanet.progress.v1') };
    });
    check('New completed save restores and orb can be collected only once', JSON.stringify(collected.before) === JSON.stringify(saved.state) && collected.taken && !collected.duplicate && collected.unchanged,
      { same: JSON.stringify(collected.before) === JSON.stringify(saved.state), taken: collected.taken, duplicate: collected.duplicate, unchanged: collected.unchanged, before: saved.state, restored: collected.before }); await restored.c.close();
    const completed = await fresh(collected.raw);
    check('Collected orb stays collected after reopening game', await completed.p.evaluate(() => game.room.prize.taken && game.room.final.solved && !game.room.prize.group.visible)); await completed.c.close();
    const oldComplete = JSON.parse(legacy); oldComplete.progress.cleared = ['shadow']; delete oldComplete.progress.shrineRuns;
    const clearedLegacy = await fresh(JSON.stringify(oldComplete));
    const oldResult = await clearedLegacy.p.evaluate(() => {
      game.enterShrine(game.shrines.shrines[1]); game.dialogue.close(); game.brief.hide(); const r = game.room;
      const valid = r.importState(r.exportState()); st.tick(60);
      return { valid, taken: r.prize.taken, hidden: !r.prize.group.visible, legacy: r.legacyCompleted,
        awake: r.final.eyes.awake, count: game.shrines.clearedCount(), locked: !r.final.interact(r.final.leverA) };
    });
    check('Old completion-only record opens awakened shrine without another reward', oldResult.valid && oldResult.taken && oldResult.hidden
      && oldResult.legacy && oldResult.awake === 1 && oldResult.count === 1 && oldResult.locked, oldResult); await clearedLegacy.c.close();
    const camera = await p.evaluate(async () => {
      const THREE = await import('three'), r = game.room, a = game.roomActor, surfaces = r.sanctum.cameraOccluders;
      const target = new THREE.Vector3(), dir = new THREE.Vector3(), ray = new THREE.Raycaster(); const failures = []; let samples = 0;
      for (const [x,z] of [[0,-56],[-4.7,-57],[4.7,-57],[0,-60],[-2.5,-64],[5,-67]]) for (const pitch of [0.12,0.38,0.7]) for (let n=0;n<8;n++) {
        a.setAt(x,z); a.camYaw=n*Math.PI/4; game.input.camPitch=pitch;game.input.camDist=6.5;a._camPlaced=false;r.scene.updateMatrixWorld(true);a.updateCamera(game.engine.camera,game.input,0);
        target.copy(a.position);target.y+=a.lookHeight();dir.copy(game.engine.camera.position).sub(target);const length=dir.length();ray.set(target,dir.normalize());ray.far=length+0.15;
        const hit=ray.intersectObjects(surfaces,false)[0];if(hit)failures.push({x,z,pitch,n,length,hit:hit.distance});samples++;
      }return{samples,failures};
    });
    check('144 camera views avoid guardian, controls, lamp and arches', !camera.failures.length, camera);
    const collision = await p.evaluate(() => { const g = game.room.final, a = game.roomActor; a.setAt(0,g.gz+2.6);a.camYaw=0;st.tick(60,{y:1});return Math.hypot(a.position.x,a.position.z-g.gz); });
    check('Walking into the guardian stops outside the stone base', collision >= 1.88 - 1e-6, collision);
    await p.evaluate(() => { st.stage(); const g=game.room.final;st.walk(0,g.seg.z1-2.8); st.render(0.4); });
    await p.screenshot({ path: path.join(out, 'after-sanctum.png') });
    const broken = await fresh(legacy,false,true), brokenOptics = await audit(broken.p,true);
    check('Fault injection detects shadow displaced from actual statue', brokenOptics.some(v=>v.visualMismatch>0),brokenOptics);await broken.c.close();
    const phone = await fresh(legacy,true);
    await phone.p.evaluate(()=>{st.stage();const g=game.room.final;st.walk(0,g.seg.z1-1);st.walk(g.leverA.x,g.leverA.z+1.5);st.render(0.35);game.input.setTestIntent(null);});
    const beforeTouch=await phone.p.evaluate(()=>({a:game.room.final.ai,h:game.room.final.hi}));
    await phone.p.locator('#tcAct').tap();await phone.p.evaluate(()=>{game.step(1/60);game.step(1/60);});
    check('Touch wheel changes only direction once',await phone.p.evaluate(v=>game.room.final.ai===(v.a+1)%8&&game.room.final.hi===v.h,beforeTouch));
    await phone.p.evaluate(()=>{const g=game.room.final;st.walk(g.leverB.x,g.leverB.z+1.5);st.render(0.35);game.input.setTestIntent(null);});
    const beforeHeight=await phone.p.evaluate(()=>({a:game.room.final.ai,h:game.room.final.hi}));
    await phone.p.locator('#tcAct').tap();await phone.p.evaluate(()=>{game.step(1/60);game.step(1/60);});
    check('Touch height handle changes only height once',await phone.p.evaluate(v=>game.room.final.ai===v.a&&game.room.final.hi===(v.h+1)%3,beforeHeight));
    await phone.p.waitForTimeout(250);await phone.p.screenshot({path:path.join(out,'after-mobile.png')});
    await phone.p.evaluate(()=>{const g=game.room.final;g.ai=g.answer.a;g.hi=g.answer.h;g._apply();g.eyes.restore(.2);game.room.prize.reveal();});
    await phone.p.locator('#tcNote').tap();check('Mobile notebook pauses partial awakening and falling reward',await phone.p.evaluate(()=>{const g=game.room.final,a=g.ai,h=g.hi,e=g.eyes.awake,d=game.room.prize.drop;game.input.setTestIntent({action:true});game.step(.2);return game.notebook.isOpen&&g.ai===a&&g.hi===h&&g.eyes.awake===e&&game.room.prize.drop===d;}));
    await phone.p.locator('#nbX').tap();await phone.c.close();
    check('No JavaScript or shader errors',!report.errors.length,report.errors);await c.close();
  }catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;}
  finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})();
