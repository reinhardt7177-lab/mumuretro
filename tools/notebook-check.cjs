// UI regression checks. Start tools/serve.py first, then run:
// AUDIT_URL=http://127.0.0.1:5500/ node tools/notebook-check.cjs
// Set AUDIT_NODE_MODULES to the directory containing Playwright when not installed locally.
// Runs in disposable browser contexts; no existing browser profile or save is changed.
// Scroll policy is identical to __selftest group M:
// - Every page must fit at 360/700 px wide and 440/540/660 px high (2 px rounding allowance).
// - Individual .letter bodies may scroll below 660 px; their containing page may never overflow.
// - At 660 px, every individual letter must also fit.
// Extra checks cover full recipe/trail records, the longest waterway observation, discovered map
// labels, state preservation, focus, touch controls and real viewports. Empty/full mail counts: 2/12.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.AUDIT_NODE_MODULES
  ? path.join(process.env.AUDIT_NODE_MODULES, 'playwright') : 'playwright');
const base = process.env.AUDIT_URL || 'http://127.0.0.1:5500/';
const outputDir = path.resolve(__dirname, '../tmp');
const output = path.join(outputDir, 'notebook-check.json');
const fontRequest = (url) => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url);

function pageOverflows(metrics) {
  return metrics.flatMap((run) => (run.sizes || []).flatMap((size) => Object.entries(size.pages)
    .filter(([id, m]) => (!id.includes(':편지') || size.height >= 660) && m.need - m.have > 2)
    .map(([id, m]) => ({ blocked: run.blocked, full: size.full, size: `${size.width}x${size.height}`, id, over: m.need - m.have }))));
}

(async () => {
  let browser;
  const result = { date: new Date().toISOString(), base, ok: false, errors: [], fontFailures: [], metrics: [] };
  fs.mkdirSync(outputDir, { recursive: true });
  const observe = (page) => {
    page.on('pageerror', (e) => result.errors.push(String(e)));
    page.on('requestfailed', (req) => {
      (fontRequest(req.url()) ? result.fontFailures : result.errors).push(req.url() + ': ' + req.failure()?.errorText);
    });
  };
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const blocked of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      if (blocked) await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
      const page = await context.newPage();
      observe(page);
      await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction(() => !!window.game, null, { timeout: 60000 });
      await page.evaluate(() => {
        game.loop.stop();
        while (game.dialogue.active) game.dialogue.next();
        game.notebook.setHas(true);
        game.notebook.setOpen(true);
      });
      result.metrics.push(await page.evaluate(async (blocked) => {
        const { RECIPES } = await import('/src/data/recipes.js');
        const { IceThermal } = await import('/src/core/Thermal.js');
        const { WATERWAY_TEXT } = await import('/src/data/waterway.js');
        const nb = game.notebook;
        nb.setOpen(false);
        const before = nb.exportState();
        const saved = { cleared: game.shrines.shrines.map((s) => s.cleared), found: { ...game.forage.found }, caught: { ...game.forage.caught }, made: [...game.kitchen.made],
          waterway: game.waterway.exportState(), trail: game.firstTrail.exportState(), map: game.mapPage.exportState() };
        const sizes = [], fixtures = [];
        // The light-only observation is longer than the heat-only and combined alternatives.
        // Measure it with all four trail paragraphs; do not hide the new letter to make M pass.
        const observationVariants = [WATERWAY_TEXT.recordHeat, WATERWAY_TEXT.recordLight, WATERWAY_TEXT.recordBoth];
        if (WATERWAY_TEXT.recordLight.length !== Math.max(...observationVariants.map((s) => s.length))) {
          throw new Error('Waterway text changed: update the fixture to use the longest observation');
        }
        for (const full of [false, true]) {
          game.shrines.shrines.forEach((s) => { s.cleared = full; });
          for (const k in game.forage.found) game.forage.found[k] = full;
          for (const k in game.forage.caught) game.forage.caught[k] = full ? 1 : 0;
          game.kitchen.made.clear();
          if (full) RECIPES.forEach((r) => game.kitchen.made.add(r.id));
          const thermal = new IceThermal();
          if (full) thermal.addPower(thermal.totalEnergy, 1);
          if (!game.waterway.importState({ ...saved.waterway, version: 1, discovered: full,
            thermal: thermal.exportState(), energyFromHeater: 0, energyFromLight: thermal.energyJ,
            flow: full ? 1 : 0 })) throw new Error('Waterway fixture failed validation');
          if (!game.firstTrail.importState({ version: 1, overlook: full, glider: full,
            water: full, restored: full })) throw new Error('FirstTrail fixture failed validation');
          if (!game.mapPage.importState({ version: 1, has: full,
            seen: saved.map.seen.map(() => full ? 1 : 0) })) throw new Error('Map fixture failed validation');
          const mapContext = game.mapPage.canvas.getContext('2d');
          const drawnText = [], fillText = mapContext.fillText;
          mapContext.fillText = function (text, ...args) { drawnText.push(String(text)); return fillText.call(this, text, ...args); };
          try { game.mapPage.draw(); } finally { mapContext.fillText = fillText; }
          fixtures.push({ full, records: game.firstTrail.records, landmarks: game.firstTrail.landmarks.map((m) => m.label),
            drawnText: [...new Set(drawnText)], waterwayRecord: game.waterway.record, explored: game.mapPage.exploredPct() });
          for (const height of [440, 540, 660]) for (const width of [360, 700]) sizes.push({ full, width, height, pages: nb.pageMetrics(height, width) });
        }
        game.shrines.shrines.forEach((s, i) => { s.cleared = saved.cleared[i]; });
        Object.assign(game.forage.found, saved.found); Object.assign(game.forage.caught, saved.caught);
        game.kitchen.made.clear(); saved.made.forEach((id) => game.kitchen.made.add(id));
        if (!game.waterway.importState(saved.waterway) || !game.firstTrail.importState(saved.trail)
          || !game.mapPage.importState(saved.map)) throw new Error('Could not restore expedition/map state after measurement');
        const after = nb.exportState();
        const expeditionStable = JSON.stringify({ waterway: saved.waterway, trail: saved.trail, map: saved.map })
          === JSON.stringify({ waterway: game.waterway.exportState(), trail: game.firstTrail.exportState(), map: game.mapPage.exportState() });
        return { blocked, sizes, fixtures, expeditionStable, stateStable: JSON.stringify(before) === JSON.stringify(after) };
      }, blocked));
      if (!blocked) {
        result.persistence = await page.evaluate(() => {
          const n = game.notebook;
          n.setOpen(false);
          const before = n.exportState();
          const exported = JSON.parse(JSON.stringify(before));
          n.importState({ version: 1, tab: 'kitchen', mailSel: -100, seen: { ask: '1' }, lit: ['ask:balance', '__proto__', 3] });
          const sanitized = n.exportState();
          n.importState(exported);
          return { same: JSON.stringify(before) === JSON.stringify(n.exportState()), sanitized, invalidRejected: n.importState(null) === false && n.importState({ version: 999 }) === false };
        });
        await page.evaluate(() => {
          const title = document.getElementById('title');
          if (title) title.style.display = 'none';
          document.body.classList.remove('titling');
          game.touch.update();
          document.getElementById('tcNote').focus();
        });
        await page.keyboard.press('Enter');
        result.keyboard = { opened: await page.evaluate(() => ({ open: game.notebook.isOpen, focus: document.activeElement.id })) };
        await page.keyboard.press('ArrowRight');
        result.keyboard.arrow = await page.evaluate(() => ({ tab: game.notebook.tab, focus: document.activeElement.id }));
        await page.keyboard.press('End');
        result.keyboard.end = await page.evaluate(() => ({ tab: game.notebook.tab, focus: document.activeElement.id }));
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        result.keyboard.trapped = await page.evaluate(() => !!document.activeElement.closest('#nb'));
        await page.keyboard.press('Escape');
        result.keyboard.closed = await page.evaluate(() => ({ open: game.notebook.isOpen, focus: document.activeElement.id }));
        await page.evaluate(() => game.brief.show('무게 순서', '저울로 무게를 비교해라.', 'carry'));
        result.brief = await page.evaluate(async () => ({ open: game.brief.isOpen, focus: document.activeElement.className, overlay: (await import('/src/ui/overlay.js')).hasOpenOverlay() }));
        await page.keyboard.press('Enter');
        result.brief.closedByEnter = await page.evaluate(() => !game.brief.isOpen);
      }
      for (const viewport of [{ width: 360, height: 440 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport);
        await page.evaluate(() => { game.notebook.go('ask'); game.notebook.setOpen(true); });
        result.metrics.push(await page.evaluate(({ viewport, blocked }) => {
          const p = document.querySelector('#nb .page'), b = document.getElementById('nbBody');
          return { viewport, blocked, actual: { page: p.getBoundingClientRect().toJSON(), bodyNeed: b.scrollHeight, bodyHave: b.clientHeight, horizontalOverflow: p.scrollWidth - p.clientWidth, close: document.getElementById('nbX').getBoundingClientRect().toJSON() } };
        }, { viewport, blocked }));
      }
      if (!blocked) await page.screenshot({ path: path.join(outputDir, 'notebook-check-landscape.png') });
      await context.close();
    }
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage();
    observe(phone);
    await phone.goto(base, { waitUntil: 'networkidle' });
    await phone.waitForFunction(() => !!window.game, null, { timeout: 60000 });
    await phone.evaluate(() => {
      game.loop.stop(); document.body.classList.remove('titling');
      document.getElementById('title').style.display = 'none';
      game.notebook.setHas(true); game.touch.update();
    });
    await phone.locator('#tcNote').tap();
    result.mobile = { openedByTap: await phone.evaluate(() => game.notebook.isOpen) };
    await phone.screenshot({ path: path.join(outputDir, 'notebook-check-mobile.png') });
    await phone.locator('#nbX').tap();
    result.mobile.closedByTap = await phone.evaluate(() => !game.notebook.isOpen);
    const jump = await phone.locator('#tcJump').boundingBox();
    await phone.mouse.move(jump.x + jump.width / 2, jump.y + jump.height / 2);
    await phone.mouse.down();
    result.mobile.heldJump = await phone.evaluate(() => game.input.poll());
    await phone.mouse.move(20, 20); await phone.mouse.up();
    result.mobile.releasedJump = await phone.evaluate(() => game.input.poll());
    await mobile.close();
    // Fail the process, rather than merely printing measurements, on any regression.
    result.overflows = pageOverflows(result.metrics);
    assert.deepEqual(result.errors, [], 'No runtime errors or failed non-font requests');
    const runs = result.metrics.filter((m) => m.sizes);
    assert.equal(runs.length, 2, 'Both normal and font-blocked contexts ran');
    for (const run of runs) {
      assert.equal(run.sizes.length, 12, 'Every size and empty/full state was measured');
      assert.equal(run.stateStable, true, 'Measuring must not consume unread/highlight state');
      assert.equal(run.expeditionStable, true, 'Measuring must restore the expedition and map');
      assert.equal(run.fixtures.length, 2, 'Both expedition progress fixtures ran');
      for (const fixture of run.fixtures) {
        assert.equal(fixture.records.length, fixture.full ? 4 : 0, 'Every trail observation is included only after discovery');
        assert.equal(fixture.landmarks.length, fixture.full ? 2 : 0, 'Both discovered landmarks are included');
        if (fixture.full) {
          assert.ok(fixture.records.at(-1).text.endsWith(fixture.waterwayRecord), 'Final paragraph includes the waterway observation');
          assert.equal(fixture.explored, 100, 'Full fixture reveals the map');
          for (const label of ['바람고개', '물길 유적']) assert.ok(fixture.drawnText.includes(label), `Map canvas rendered ${label}`);
        }
      }
      for (const size of run.sizes) {
        for (const id of ['star', 'ask', 'field', 'kitchen', 'mail#0', 'mail#0:편지']) {
          assert.ok(size.pages[id], `Missing page measurement: ${id}`);
        }
        assert.equal(Object.keys(size.pages).filter((id) => id.endsWith(':편지')).length,
          size.full ? 12 : 2, 'Every available letter, including the completed expedition log, was measured');
        for (const m of Object.values(size.pages)) {
          assert.ok(m.have > 0 && Number.isFinite(m.need), 'Measurements require visible layout');
        }
      }
    }
    assert.deepEqual(result.overflows, [], 'Notebook content must fit the group M scroll policy');
    const actual = result.metrics.filter((m) => m.actual);
    assert.equal(actual.length, 6, 'All three real viewports ran in both contexts');
    for (const { viewport, actual: m } of actual) {
      assert.ok(m.horizontalOverflow <= 2, 'No horizontal page clipping');
      for (const box of [m.page, m.close]) {
        assert.ok(box.width > 0 && box.height > 0 && box.left >= -1 && box.top >= -1
          && box.right <= viewport.width + 1 && box.bottom <= viewport.height + 1,
        'Page and close button must stay inside the viewport');
      }
    }
    assert.equal(result.persistence.same, true, 'Notebook save round-trip');
    assert.equal(result.persistence.invalidRejected, true, 'Invalid save versions rejected');
    assert.deepEqual(result.persistence.sanitized.lit, ['ask:balance'], 'Unknown record IDs discarded');
    assert.equal(result.persistence.sanitized.mailSel, 0, 'Invalid letter selection reset');
    assert.deepEqual(result.keyboard.opened, { open: true, focus: 'nb-tab-ask' }, 'Enter opens icon and moves focus');
    assert.deepEqual(result.keyboard.arrow, { tab: 'field', focus: 'nb-tab-field' }, 'ArrowRight switches/focuses next tab');
    assert.deepEqual(result.keyboard.end, { tab: 'kitchen', focus: 'nb-tab-kitchen' }, 'End switches/focuses final tab');
    assert.equal(result.keyboard.trapped, true, 'Tab focus stays in notebook');
    assert.deepEqual(result.keyboard.closed, { open: false, focus: 'tcNote' }, 'Escape closes and restores icon focus');
    assert.deepEqual(result.brief, { open: true, focus: 'ok', overlay: true, closedByEnter: true }, 'Room brief keyboard and overlay state');
    assert.equal(result.mobile.openedByTap, true, 'Mobile icon opens');
    assert.equal(result.mobile.closedByTap, true, 'Mobile close button closes');
    assert.equal(result.mobile.heldJump.jumpHeld, true, 'Holding jump enables glide');
    assert.equal(result.mobile.releasedJump.jumpHeld, false, 'Releasing outside button ends glide');
    result.ok = true;
  } catch (e) {
    result.failure = e.stack || String(e);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ok: result.ok, output, errors: result.errors, overflows: result.overflows, failure: result.failure }, null, 2));
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
