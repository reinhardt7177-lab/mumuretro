const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES || '', 'playwright'));
const base = (process.env.AUDIT_URL || 'http://127.0.0.1:5512').replace(/\/$/, '');
const out = path.resolve(__dirname, '../tmp/shrine-progress'); fs.mkdirSync(out, { recursive: true });
const report = { date: new Date().toISOString(), checks: [], errors: [] };
function check(name, value, details) { report.checks.push({ name, pass: !!value, details }); assert.ok(value, `${name}: ${JSON.stringify(details)}`); console.log('PASS ' + name); }
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    async function fresh(raw, broken = false) {
      const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await c.addInitScript(() => { window.requestAnimationFrame = () => 0; });
      await c.route('**/*', async route => {
        if (!route.request().url().startsWith(base + '/')) return route.abort();
        if (broken && route.request().url().endsWith('/src/shrine/DeviceProgress.js')) {
          const response = await route.fetch(); const source = await response.text();
          return route.fulfill({ response, body: source.replace('f.set(copy(s.fields[k]));', "{ if (k !== 'held') f.set(copy(s.fields[k])); }") });
        } return route.continue();
      });
      if (raw) await c.addInitScript(value => localStorage.setItem('mumuplanet.progress.v1', value), raw);
      const p = await c.newPage(); p.on('pageerror', e => report.errors.push(e.message));
      await p.goto(base); await p.waitForFunction(() => window.game, null, { timeout: 45000, polling: 50 });
      await p.locator('#title .go').click({ force: true }); await p.waitForFunction(() => game.mode !== 'title', null, { polling: 50 });
      await p.evaluate(() => {
        game.loop.stop(); game.dialogue.close(); game.brief.hide();
        window.pt = {
          tick(n = 1, intent = {}) { for (let i = 0; i < n; i++) { game.dialogue.close(); game.brief.hide(); game.input.setTestIntent(intent); game.step(1 / 60); } },
          walk(x, z) { let n = 0; while (Math.hypot(x - game.roomActor.position.x, z - game.roomActor.position.z) > 0.13 && n++ < 2400) {
            const p = game.roomActor.position; game.roomActor.camYaw = Math.atan2(-(x - p.x), -(z - p.z)); this.tick(1, { y: 1, run: true });
          } if (n >= 2400) throw Error(`Walk blocked ${x},${z} at ${game.roomActor.position.toArray()}`); this.tick(); return n; },
          act() { this.tick(1, { action: true }); this.tick(); },
          setup(i) { game.lab.importState({ version: 1, dials: [3, 5, 8], hasNote: true, read: true, open: true, done: false, sent: false });
            game.notebook.setHas(true); game.landOnPlanet(); game.dialogue.close(); game.enterShrine(game.shrines.shrines[i]); this.tick(2); },
        };
      });
      return { c, p };
    }
    const { c, p } = await fresh();
    const smoke = await p.evaluate(async () => {
      const { buildRoom } = await import('/src/shrine/Room.js'); const results = [];
      for (const i of [0, 1, 2, 4, 5]) {
        pt.setup(i); const r = game.room, state = r.exportState(game.roomActor), other = buildRoom(r.spec, r.seed);
        const imported = other.importState(state); results.push({ id: r.spec.id, imported, bytes: JSON.stringify(state).length,
          same: imported && JSON.stringify(other.exportState()) === JSON.stringify(state) }); game.exitShrine();
      } return results;
    });
    for (const result of smoke) check('Fresh seeded room roundtrip: ' + result.id, result.imported && result.same, result);
    check('All five saves fit below storage size limit', smoke.reduce((n, r) => n + r.bytes, 0) < 400000, smoke);
    const contracts = await p.evaluate(async () => {
      const { buildRoom } = await import('/src/shrine/Room.js'), results = [];
      for (const i of [0, 1, 2, 4, 5]) {
        const r = buildRoom(game.SHRINES[i], 812743 + i); r.restart(); r.hasProgress = true;
        const actor = { position: game.roomActor.position.clone().set(0, 0, 10), heading: game.roomActor.heading.clone().set(0, 0, -1), shake: 0 };
        const update = g => g.update?.(0, actor, r.scene);
        const gs = r.gates.map(g => g.gate), f = r.final;
        if (i === 0) {
          const w = gs[0]; w.interact(w.boxes[0].home); w.interact(w.pans[0]); w.interact(w.boxes[1].home); update(w);
          const pl = gs[1]; pl.interact(pl.stock[0].home); pl.interact(pl.plates[0]); pl.interact(pl.stock[1].home); update(pl);
          const stock = f.stock[0]; const pos = stock.home.clone().applyMatrix4(stock.parent.matrixWorld); r.scene.updateMatrixWorld(true);
          stock.mesh.getWorldPosition(pos); f.interact(pos); update(f);
        } else if (i === 1) {
          gs[0].update(0.25, actor); gs[1].interact(gs[1].mirrors[0]);
          const s = gs[2]; s.interact({ x: s.objX, z: s.objZ }); actor.position.z = s.objZ + 0.7; update(s);
          f.interact(f.leverA); f.interact(f.leverB);
        } else if (i === 2) {
          const sieve = gs[0]; sieve.interact(sieve.sieves[0]); update(sieve);
          const m = gs[1]; m.interact(m.items[0]); m.interact(m.basin); m.update(0.3, actor); m.interact(m.items[1]); update(m);
          const e = gs[2]; e.interact(e.potHome); update(e);
          const mix = f.mixes.find(m => m.order), t = f.tools.find(t => t.id === 'filter'); f.interact(t); f.interact(mix); update(f);
        } else if (i === 4) {
          gs[0].update(0.6, actor); const h = gs[1]; actor.position.set(h.tiles[0].x, 0, h.tiles[0].z); h.update(0.1, actor);
          actor.position.set(h.tiles[1].x, 0, h.tiles[1].z); h.update(0.2, actor); gs[2].update(0.4, actor);
          f.interact(f.cells[0]); f.update(0.3, actor);
        } else {
          const s = gs[0]; s.interact(s.fossils[0]); s.interact(s.marks[0]); s.interact(s.fossils[1]); update(s);
          const shaft = gs[1]; actor.position.set(0, 0, (shaft.zIn + shaft.zOut) / 2); shaft.update(0.9, actor); shaft.update(0.2, actor);
          gs[2].interact(gs[2].levers[0]);
          const orb = f.orbs[0]; f.interact(orb); f.interact(f.altars.find(a => a.id === orb.id)); f.interact(f.orbs[1]); update(f);
        }
        const before = r.exportState(), other = buildRoom(r.spec, r.seed); const imported = other.importState(before);
        const after = imported && other.exportState();
        results.push({ id: r.spec.id, imported, same: JSON.stringify(before) === JSON.stringify(after), bytes: JSON.stringify(before).length,
          held: before.devices.map(d => d.fields.held), finalHeld: before.final.fields.held });
        const bad = JSON.parse(JSON.stringify(before));
        if (bad.final.version === 2) bad.final.fields.hi = 99;
        else bad.final.visual.nodes.push([0, [0]]);
        const original = JSON.stringify(r.exportState()); const accepted = r.importState(bad);
        results.push({ id: r.spec.id + ' atomic corrupt', imported: !accepted, same: original === JSON.stringify(r.exportState()) });
      } return results;
    });
    for (const result of contracts) check('Partial device state: ' + result.id, result.imported && result.same, result);
    let heldRaw;
    for (const i of [0, 1, 2, 4, 5]) {
      const a = await fresh();
      const before = await a.p.evaluate(i => {
        pt.setup(i); const g = game.room.gates[0].gate; let frames = 0;
        if (i === 0) { frames += pt.walk(g.boxes[0].home.x, g.boxes[0].home.z); pt.act(); }
        if (i === 1) { frames += pt.walk(0, g.seg.z1 - 1.2); pt.tick(15); }
        if (i === 2) { frames += pt.walk(g.sieves[0].x + (g.workshop ? 1.3 : 0), g.sieves[0].z); pt.act(); }
        if (i === 4) { frames += pt.walk(0, g.seg.z1 - 1.2); pt.tick(20); }
        if (i === 5) { frames += pt.walk(g.fossils[0].x, g.fossils[0].z); pt.act(); }
        game.save(); const raw = localStorage.getItem('mumuplanet.progress.v1');
        return { raw, state: game.room.exportState(), mode: game.mode, frames, held: !!g.held };
      }, i);
      const b = await fresh(before.raw);
      const after = await b.p.evaluate(() => ({ mode: game.mode, id: game.room?.spec.id, state: game.room?.exportState(), held: !!game.room?.gates[0].gate.held }));
      check('Walk, interact, restart browser and resume ' + before.state.id, after.mode === 'room' && after.id === before.state.id
        && before.state.seed === after.state.seed && before.state.tier === after.state.tier
        && before.state.devices.every((d, k) => JSON.stringify(d.fields) === JSON.stringify(after.state.devices[k].fields)),
        { frames: before.frames, heldBefore: before.held, heldAfter: after.held, id: after.id });
      if ([0, 2, 5].includes(i)) check('Held object remains usable ' + before.state.id, before.held && after.held, null);
      const revisit = await b.p.evaluate(i => { const state = game.room.exportState(); game.exitShrine(); game.enterShrine(game.shrines.shrines[i]);
        return { same: JSON.stringify(state.devices.map(d => d.fields)) === JSON.stringify(game.room.exportState().devices.map(d => d.fields)), tier: game.room.runTier }; }, i);
      check('Exit and reenter preserves ' + before.state.id, revisit.same && revisit.tier === before.state.tier, revisit);
      if ([0, 2, 5].includes(i)) {
        const usable = await b.p.evaluate(i => { const g = game.room.gates[0].gate, held = g.held;
          const dest = i === 0 ? g.pans[0] : i === 2 ? g.frame : g.marks.find(m => m.slot.level === held.level);
          if (i === 2 && g.workshop) { pt.walk(-2.85, 2); pt.walk(2.8, 2); pt.walk(2.35, g.frame.z); }
          else pt.walk(dest.x, dest.z);
          pt.act(); return !g.held && (i === 0 ? g.pans[0].box === held : i === 2 ? g.fitted >= 0 || g.round > 0 : !!held.slot);
        }, i);
        check('Restored object can be walked to device and placed ' + before.state.id, usable, null);
      }
      if (i === 0) heldRaw = before.raw;
      await a.c.close(); await b.c.close();
    }
    const faulty = await fresh(heldRaw, true);
    const lost = await faulty.p.evaluate(() => game.mode === 'room' && !game.room.gates[0].gate.held);
    check('Fault injection: missing held-object restoration is detected', lost, null); await faulty.c.close();
    const later = await p.evaluate(async () => {
      const { buildRoom } = await import('/src/shrine/Room.js'); const results = [];
      let r;
      const mark = i => { r.gates[i].solved = true; r.dungeon.openDoor(r.gates[i].room); };
      const checkpoint = label => {
        const before = r.exportState(), next = buildRoom(r.spec, r.seed), ok = next.importState(before);
        if (!ok || JSON.stringify(before) !== JSON.stringify(next.exportState())) throw Error('Late round restore failed: ' + label);
        r = next; results.push(label);
      };
      const make = i => { r = buildRoom(game.SHRINES[i], 18501 + i); r.applyTier(5); r.restart(); r.hasProgress = true; };
      const actor = { position: game.roomActor.position.clone().set(0, 0, 10), heading: game.roomActor.heading.clone().set(0, 0, -1), shake: 0 };
      make(0);
      if (!r.gates[1].gate.plates.every(p => p.dots.length >= 13 && p.dots.filter(d => d.visible).length === p.need)) throw Error('Plate target exceeds visible weight marks');
      for (let i = 0; i < 5; i++) { const g = r.gates[0].gate; g.interact(g.boxes[i].home); g.interact(g.slots[g.boxes[i].w - 1]); checkpoint('weigh slot ' + i); }
      mark(0);
      for (let round = 0; round < 3; round++) {
        const g = r.gates[1].gate; let solution;
        for (let code = 0; code < 243; code++) { const a = [], sum = [0, 0]; let n = code;
          g.stock.forEach(b => { const at = n % 3; a.push(at); n = Math.floor(n / 3); if (at < 2) sum[at] += b.w; });
          if (g.plates.every((p, i) => p.need === sum[i])) { solution = a; break; }
        }
        solution.forEach((at, i) => { if (at < 2) { g.interact(g.stock[i].home); g.interact(g.plates[at]); } });
        if (g.round !== round + 1) throw Error('Plate round did not advance'); checkpoint('plate round ' + g.round);
      }
      mark(1); r.scene.updateMatrixWorld(true); let f = r.final;
      const pos = f.stock.find(b => b.w === 6).mesh.getWorldPosition(actor.position.clone()); f.interact(pos);
      f.update(0, actor, r.scene); checkpoint('scale held'); f = r.final;
      f.interact({ x: f.origin.x + 1.2 * Math.cos(f.tilt), z: f.origin.z });
      if (!f.solvedBy()) throw Error('Scale solution failed'); r.prize.reveal(); r.prize.update(0.6); checkpoint('scale prize falling');
      r.prize.update(2); r.prize.interact(r.prize.pos); checkpoint('balance collected prize');
      make(1); mark(0); mark(1);
      for (let i = 0; i < 3; i++) { const g = r.gates[2].gate;
        g.interact({ x: g.objX, z: g.objZ }); actor.position.set(g.objX, 0, g.answers[g.round]); g.update(0, actor);
        if (g.round !== i + 1) throw Error('Silhouette round did not advance'); checkpoint('silhouette round ' + g.round);
      }
      mark(2); f = r.final; while (f.ai !== f.answer.a) f.interact(f.leverA); while (f.hi !== f.answer.h) f.interact(f.leverB);
      r.prize.reveal(); checkpoint('shadow reward');
      make(2);
      for (let round = 0; round < 3; round++) {
        let g = r.gates[0].gate; const wanted = g.orders[g.round].keep;
        const same = a => a.size === wanted.length && wanted.every(v => a.has(v));
        let seq = g.sieves.map((s, i) => same(g._aboveSet(s.spec, g.mix)) ? [i] : null).find(Boolean);
        if (!seq) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
          const up = g._aboveSet(g.sieves[a].spec, g.mix), below = new Set([...g.mix].filter(v => !up.has(v)));
          if (same(g._aboveSet(g.sieves[b].spec, below))) seq = [a, b];
        }
        if (!seq) throw Error('Sieve has no solution');
        for (let n = 0; n < seq.length; n++) { g = r.gates[0].gate; g.interact(g.sieves[seq[n]]); g.interact(g.frame);
          if (n + 1 < seq.length) { checkpoint('sieve intermediate fitted'); g = r.gates[0].gate; g.interact(g.tray); checkpoint('sieve repoured'); }
        }
        if (r.gates[0].gate.round !== round + 1) throw Error('Sieve round did not advance'); checkpoint('sieve round ' + (round + 1));
      }
      mark(0);
      for (let round = 0; round < 3; round++) { const g = r.gates[1].gate;
        for (const it of g.items) { g.interact(it); g.interact(g.bins.find(b => b.yes === g.crit.test(it))); }
        if (g.round !== round + 1) throw Error('Magnet round did not advance'); checkpoint('magnet round ' + g.round);
      }
      mark(1); const e = r.gates[2].gate; e.interact(e.potHome);
      for (const name of ['magnet', 'filter', 'burner']) { e.interact(e[name]); }
      if (!e.solvedBy()) throw Error('Evaporate solution failed'); mark(2); checkpoint('evaporate salt');
      f = r.final;
      for (const m of f.mixes) for (const id of m.need) { const tool = f.tools.find(t => t.id === id);
        f.interact(tool); f.interact(m); }
      results.push('sift final solvable=' + f.solvedBy());
      r.prize.reveal(); checkpoint('sift reward');
      make(4); [0, 1, 2].forEach(mark); f = r.final;
      for (const cell of f.cells) { let n = 0; while (!cell.need.every(d => cell.open.map(o => (o + cell.rot) % 4).includes(d)) && n++ < 4) f.interact(cell); }
      if (!f.solvedBy()) throw Error('Fire final solution failed'); r.prize.reveal(); checkpoint('fire reward');
      make(5);
      for (let i = 0; i < 4; i++) { const g = r.gates[0].gate; g.interact(g.fossils[i]); g.interact(g.marks.find(m => m.slot.level === g.fossils[i].level)); checkpoint('fossil slot ' + i); }
      mark(0); mark(1); const d = r.gates[2].gate; for (const l of d.levers) { while (l.ci !== l.si) d.interact(l); }
      mark(2); checkpoint('five color doors');
      for (let i = 0; i < 5; i++) { f = r.final; const orb = f.orbs[i]; f.interact(orb); f.interact(f.altars.find(a => a.id === orb.id)); checkpoint('grand altar ' + i); }
      r.final.update(0.8, actor); checkpoint('grand awakening'); r.final.update(1, actor); r.prize.reveal(); checkpoint('grand reward');
      return results;
    });
    check('Later rounds, intermediate mixtures, all finale types and reward transitions restore', later.length > 30 && later.includes('sift final solvable=true'), later);
    const negative = await p.evaluate(() => {
      const r = game.roomFor(game.shrines.shrines[0]); r.hasProgress = true;
      const state = r.exportState(), before = JSON.stringify(state), variants = [];
      let bad = structuredClone(state); bad.seed = (bad.seed + 1) >>> 0; variants.push(bad);
      bad = structuredClone(state); bad.devices[0].fields.held = 0; bad.devices[0].fields['box.0'] = 0; variants.push(bad);
      bad = structuredClone(state); bad.checkpoint.z = r.shrineSeg.z0 + 2; variants.push(bad);
      bad = structuredClone(state); bad.prize.taken = true; variants.push(bad);
      bad = structuredClone(state); bad.final.visual.nodes.push([0, [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, true, [], null, null]]); variants.push(bad);
      return variants.map(v => !r.importState(v) && JSON.stringify(r.exportState()) === before);
    });
    check('Seed, duplicate ownership, closed door, prize and cyclic parent corruption reject atomically', negative.every(Boolean), negative);
    const corrupted = JSON.parse(heldRaw); corrupted.progress.shrineRuns.rooms.balance.checkpoint.x = 999;
    const corruptRaw = JSON.stringify(corrupted), recovery = await fresh(corruptRaw);
    const recovered = await recovery.p.evaluate(() => ({ mode: game.mode, lab: game.lab.state.open,
      backup: localStorage.getItem('mumuplanet.progress.previous.v1'), hasRun: !!game.snapshot().shrineRuns.rooms.balance }));
    check('Invalid active shrine backs up exact source and keeps other progress', recovered.mode === 'planet' && recovered.lab && !recovered.hasRun && recovered.backup === corruptRaw, { mode: recovered.mode, lab: recovered.lab });
    await recovery.c.close();
    const old = JSON.parse(heldRaw); delete old.progress.shrineRuns; old.progress.cleared = ['balance'];
    const legacy = await fresh(JSON.stringify(old));
    const legacyResult = await legacy.p.evaluate(() => { const outside = game.mode === 'planet'; game.enterShrine(game.shrines.shrines[0]);
      const r = game.room, state = r.exportState(); const valid = r.importState(state); pt.tick(8);
      return { outside, valid, completed: r.prize.taken && r.gates.every(g => g.solved), hidden: !r.prize.group.visible,
        legacy: r.legacyCompleted, count: game.shrines.clearedCount() };
    });
    check('Older completed shrine stays open and cannot grant a second orb', Object.values(legacyResult).every(Boolean) && legacyResult.count === 1, legacyResult);
    await legacy.c.close();
    const hazards = await p.evaluate(async () => {
      const { buildRoom } = await import('/src/shrine/Room.js'); const result = [];
      for (const [i, index] of [[1, 0], [4, 0], [4, 1], [4, 2], [5, 1]]) {
        const r = buildRoom(game.SHRINES[i], 417 + i); r.restart(); r.hasProgress = true;
        for (let j = 0; j < index; j++) { r.gates[j].solved = true; r.dungeon.openDoor(r.gates[j].room); }
        const g = r.gates[index].gate, actor = game.roomActor; actor.setAt(0, (g.seg.z0 + g.seg.z1) / 2);
        if (g.phase) { g.phase = 'main'; g.t = 0; }
        if (g.tiles) { const t = g.tiles[Math.floor(g.tiles.length / 2)]; actor.setAt(t.x, t.z); g.update(0, actor); g.tiles[0].state = 'lava'; g.tiles[0].mesh.visible = false; }
        const state = r.exportState(actor), next = buildRoom(r.spec, r.seed), imported = next.importState(state);
        if (imported) { next.resume(actor); const response = next.gates[index].gate.update(1 / 60, actor);
          result.push({ id: r.spec.id, gate: index, safe: !response?.fail, imported,
            prior: next.gates.slice(0, index).every(g => g.solved), lava: !g.tiles || next.gates[index].gate.tiles[0].state === 'lava' });
        } else result.push({ id: r.spec.id, gate: index, imported });
      } return result;
    });
    check('All timed hazards resume safely and hex path history remains', hazards.every(h => h.imported && h.safe && h.prior && h.lava), hazards);
    const allLog = []; p.on('console', message => { if (message.text().includes('[selftest]')) allLog.push(message.text()); });
    const preserved = await p.evaluate(() => {
      pt.setup(0); const w = game.room.gates[0].gate; w.interact(w.boxes[0].home); pt.tick();
      const before = JSON.stringify(game.snapshot().shrineRuns), stored = localStorage.getItem('mumuplanet.progress.v1');
      const ok = __selftest(); const after = JSON.stringify(game.snapshot().shrineRuns);
      return { ok, same: before === after, storage: stored === localStorage.getItem('mumuplanet.progress.v1') };
    });
    fs.writeFileSync(path.join(out, 'selftest.txt'), allLog.join('\n'));
    check('A–W checks preserve all cached shrine states and storage', preserved.ok && preserved.same && preserved.storage, preserved);
    const multi = await p.evaluate(() => {
      game.room.nudge('r1', 60);
      game.shrines.markCleared(game.shrines.shrines[3]); // 다른 사당 완료 뒤에도 기존 도전의 단계는 유지한다.
      const tier = game.room.runTier; game.exitShrine(); game.enterShrine(game.shrines.shrines[0]);
      const inactive = JSON.stringify(game.snapshot().shrineRuns.rooms.fire); pt.tick(120);
      const frozen = inactive === JSON.stringify(game.snapshot().shrineRuns.rooms.fire);
      game.save(); return { tier, afterTier: game.room.runTier, frozen, state: game.snapshot().shrineRuns,
        raw: localStorage.getItem('mumuplanet.progress.v1') };
    });
    check('Inactive shrine clock freezes and original tier survives other completion', multi.frozen && multi.tier === multi.afterTier, { frozen: multi.frozen, tier: multi.tier });
    const bundle = await fresh(multi.raw);
    const bundleState = await bundle.p.evaluate(() => game.snapshot().shrineRuns);
    check('Five simultaneous runs, hint progress and active room survive full reload', Object.keys(bundleState.rooms).length === 5
      && Object.entries(multi.state.rooms).every(([id, s]) => {
        const t = bundleState.rooms[id]; return t && s.seed === t.seed && s.tier === t.tier
          && JSON.stringify(s.hints) === JSON.stringify(t.hints) && JSON.stringify(s.devices.map(d => d.fields)) === JSON.stringify(t.devices.map(d => d.fields));
      }) && bundleState.active === multi.state.active, { bytes: multi.raw.length, rooms: Object.keys(bundleState.rooms), hint: bundleState.rooms.balance.hints.r1 });
    await bundle.c.close();
    check('No browser page errors', report.errors.length === 0, report.errors);
    await c.close();
  } catch (error) { report.failure = error.stack; console.error(error); process.exitCode = 1; }
  finally { fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(report, null, 2)); await browser.close(); }
})();
