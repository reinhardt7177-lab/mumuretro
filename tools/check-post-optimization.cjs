// Isolated rendering comparison. No personal profile/save or Root source writes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.AUDIT_NODE_MODULES, 'playwright'));
const fixture = require('./arrival-performance-fixture.cjs');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'reports/2026-10-29/evidence/runtime-optimization';
const abs = file => path.join(ROOT, file);
const read = file => fs.readFileSync(abs(file));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fault = process.argv.includes('--fault');
const supplied = process.argv.find(value => value.startsWith('--out='));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = supplied ? supplied.slice(6) : `${BASE}/post-${fault ? 'fault' : 'normal'}-${stamp}`;
assert(path.resolve(abs(out)).startsWith(path.resolve(abs(BASE)) + path.sep), 'Report must remain in this audit directory');
assert(!fs.existsSync(abs(out)), 'Preserve existing post-comparison results');
fs.mkdirSync(abs(out), { recursive: true });

function immutable(file, content) {
  if (fs.existsSync(abs(file))) assert.equal(sha(read(file)), sha(content), 'Preserved file differs: ' + file);
  else { fs.mkdirSync(path.dirname(abs(file)), { recursive: true }); fs.writeFileSync(abs(file), content); }
  return { file, bytes: Buffer.byteLength(content), sha256: sha(content) };
}
function browserModule(source) {
  // Both .mjs copies retain imports as though located at /src/render/Post.js.
  // Bare 'three' / 'three/addons/...' continue to use the game's import map.
  return source.replace(/(\bfrom\s+)(['"])(\.{1,2}\/[^'"]+)\2/g,
    (_, prefix, quote, specifier) => prefix + quote + new URL(specifier, 'http://127.0.0.1:5512/src/render/Post.js').pathname + quote);
}
const original = read('src/render/Post.js');
const before = `${BASE}/before/src/render/Post.js`;
const beforeRow = immutable(before, original);
const candidateFile = `${BASE}/candidate/Post.js`;
const candidate = read(candidateFile);
const moduleRows = [
  immutable(`${BASE}/browser-modules/legacy.mjs`, browserModule(original.toString('utf8'))),
  immutable(`${BASE}/browser-modules/candidate.mjs`, browserModule(candidate.toString('utf8'))),
];
const camerasFile = 'art/arrival-coherence/v01/performance/cameras.json';
const cameras = JSON.parse(read(camerasFile));
const files = ['src/core/Engine.js', 'src/render/Post.js', 'src/render/Quality.js', 'src/render/LookProfiles.js',
  'src/data/lighting.js', 'vendor/three/build/three.module.js',
  'vendor/three/examples/jsm/postprocessing/OutputPass.js', 'vendor/three/examples/jsm/shaders/OutputShader.js']
  .map(file => ({ file, sha256: sha(read(file)) }));
const conditions = [];
for (const tier of ['mid', 'high', 'low', 'min']) for (const view of ['front', 'side', 'rear'])
  conditions.push({ tier, view, width: 1280, height: 800, profile: 'planet' });
conditions.push({ tier: 'mid', view: 'front', width: 390, height: 844, profile: 'planet' },
  { tier: 'mid', view: 'side', width: 844, height: 390, profile: 'planet' });
for (const profile of ['ship', 'balance', 'shadow', 'sift', 'water', 'fire', 'strata'])
  conditions.push({ tier: 'mid', view: 'front', width: 1280, height: 800, profile });

const report = {
  schema: 'mumu.post-output-optimization.v1', createdUtc: new Date().toISOString(), fault,
  scope: 'One fresh headless Edge context with the current Root game. Same frozen planet scene/camera alternates legacy/candidate/candidate/legacy; synchronous drawing-buffer readPixels. Profile rows change uniforms on this same planet scene, not temple-entry validation. No FPS/GPU timing or physical-device claim.',
  acceptance: { maxChannelDifference: 1, exactDrawReduction: 1, canvasBufferMatchesComposer: true },
  baseline: beforeRow, candidate: { file: candidateFile, sha256: sha(candidate) }, modules: moduleRows,
  cameras: { file: camerasFile, sha256: sha(read(camerasFile)) }, files,
  moduleDelivery: 'The local server has no .mjs MIME mapping. Playwright serves the preserved .mjs bytes at their matching localhost URLs as text/javascript; current Root game requests remain native.',
  conditions, rows: [], errors: [], consoleErrors: [], failures: [], pass: false,
};
const checkpoint = () => fs.writeFileSync(abs(out + '/report.json'), JSON.stringify(report, null, 2) + '\n');
checkpoint();

(async () => {
  let browser, context, page;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    report.browser = browser.version();
    context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    page = await context.newPage();
    for (const row of moduleRows) await page.route('**/' + row.file, route =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: read(row.file) }));
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    await fixture.prepare(page, 'after', 'mid', 'front', cameras);
    report.prepared = await page.evaluate(async rows => {
      game.loop.stop();
      const legacy = await import('/' + rows[0].file), candidate = await import('/' + rows[1].file);
      const engine = game.engine;
      window.__postAudit = { legacy: new legacy.Post(engine), candidate: new candidate.Post(engine), original: engine.post,
        quality: (await import('/src/render/Quality.js')).quality,
        looks: (await import('/src/render/LookProfiles.js')).LOOKS,
        outdoor: (await import('/src/data/lighting.js')).OUTDOOR,
        originalProfile: engine.scene.userData.lookProfile };
      const renderer = engine.renderer, gl = renderer.getContext();
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      return { mode: game.mode, field: game.meadowField, loopRunning: game.loop.running,
        gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
        context: { webgl2: renderer.capabilities.isWebGL2, maxSamples: renderer.capabilities.maxSamples },
        candidateRaw: __postAudit.candidate.grade.material.isRawShaderMaterial,
        candidateShader: __postAudit.candidate.grade.material.fragmentShader,
        legacyPasses: __postAudit.legacy.composer.passes.map(p => p.constructor.name),
        candidatePasses: __postAudit.candidate.composer.passes.map(p => p.constructor.name) };
    }, moduleRows);
    assert.equal(report.prepared.mode, 'planet');
    assert.equal(report.prepared.loopRunning, false);
    assert(report.prepared.candidateRaw, 'Candidate must retain OutputPass RawShaderMaterial');
    assert(report.prepared.field.loaded, 'Require current loaded meadow field');
    assert.equal(report.prepared.field.signature, 'f2a7ee29');

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      await page.setViewportSize({ width: condition.width, height: condition.height });
      const row = await page.evaluate(({ condition, cameras, fault }) => {
        const audit = window.__postAudit, engine = game.engine, renderer = engine.renderer;
        game.loop.stop();
        audit.quality.pin(condition.tier);
        engine.applySize();
        for (const post of [audit.legacy, audit.candidate]) post.setSize(innerWidth, innerHeight);
        const pose = cameras.views.find(p => p.view === condition.view), camera = engine.camera;
        camera.position.fromArray(pose.camera); camera.quaternion.fromArray(pose.quaternion); camera.up.fromArray(pose.up);
        camera.fov = pose.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        engine.scene.userData.lookProfile = condition.profile;
        const sceneState = () => ({ actor: game.player.position.toArray(), camera: camera.position.toArray(),
          quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray(),
          snapshot: JSON.stringify(game.snapshot()), wind: game.meadow.clock.value });
        const before = sceneState();
        const gl = renderer.getContext(), width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
        function buffers(post) {
          const composer = post.composer, a = composer.renderTarget1, b = composer.renderTarget2;
          return { canvas: [width, height], composer: [[a.width, a.height], [b.width, b.height]],
            samples: [a.samples, b.samples], bloomEnabled: post.bloom.enabled,
            bloomBright: [post.bloom.renderTargetBright.width, post.bloom.renderTargetBright.height] };
        }
        const savedAutoReset = renderer.info.autoReset;
        function capture(post, mutate) {
          engine.post = post;
          renderer.info.autoReset = false; renderer.info.reset();
          if (mutate) post.grade.uniforms.uContrast.value = .2;
          const start = performance.now(); engine.render(); const submitMs = performance.now() - start;
          // Must read before returning to the browser event loop: preserveDrawingBuffer=false.
          const rgba = new Uint8Array(width * height * 4);
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
          const error = gl.getError(), calls = renderer.info.render.calls, triangles = renderer.info.render.triangles;
          let nonBlack = 0, alphaNonzero = 0, sum = 0;
          for (let j = 0; j < rgba.length; j += 4) { const colour = rgba[j] + rgba[j + 1] + rgba[j + 2]; if (colour) nonBlack++; if (rgba[j + 3]) alphaNonzero++; sum += colour; }
          return { rgba, calls, triangles, submitMs, error, nonBlack, alphaNonzero, meanRgb: sum / (width * height * 3) };
        }
        function difference(a, b) {
          let max = 0, channels = 0, beyondOne = 0, total = 0, differingPixels = 0;
          for (let j = 0; j < a.length; j += 4) {
            let different = false;
            for (let k = 0; k < 4; k++) { const d = Math.abs(a[j + k] - b[j + k]); max = Math.max(max, d); total += d; if (d) { channels++; different = true; } if (d > 1) beyondOne++; }
            if (different) differingPixels++;
          }
          return { max, channels, beyondOne, differingPixels, meanAbsolute: total / a.length };
        }
        try {
          // Warm both shader variants before the comparison. No simulation advances.
          audit.legacy.render(); audit.candidate.render();
          if (fault) audit.candidate.grade.uniforms.uContrast.value = .2;
          const a1 = capture(audit.legacy, false), b1 = capture(audit.candidate, fault),
            b2 = capture(audit.candidate, fault), a2 = capture(audit.legacy, false);
          const summaries = [a1, b1, b2, a2].map(({ rgba, ...summary }) => summary);
          const expectedLook = condition.profile === 'planet'
            ? { saturation: audit.outdoor.planetSaturation, contrast: audit.outdoor.planetContrast, vignette: audit.outdoor.planetVignette, bloom: audit.outdoor.planetBloom }
            : audit.looks[condition.profile];
          const uniforms = post => ({ saturation: post.saturation, contrast: post.grade.uniforms.uContrast.value,
            vignette: post.grade.uniforms.uVignette.value, bloom: post.bloomStrength });
          return { condition, before, after: sceneState(), drawingBuffer: [width, height],
            comparisons: { a1b1: difference(a1.rgba, b1.rgba), a2b2: difference(a2.rgba, b2.rgba),
              legacyRepeat: difference(a1.rgba, a2.rgba), candidateRepeat: difference(b1.rgba, b2.rgba) },
            captures: summaries, buffers: { legacy: buffers(audit.legacy), candidate: buffers(audit.candidate) },
            passes: { legacy: audit.legacy.composer.passes.filter(p => p.enabled).length,
              candidate: audit.candidate.composer.passes.filter(p => p.enabled).length },
            uniforms: { legacy: uniforms(audit.legacy), candidate: uniforms(audit.candidate), expected: expectedLook },
            quality: { name: audit.quality.name, forced: audit.quality.forced, pixelRatio: audit.quality.pixelRatio },
            programs: renderer.info.programs.map(p => ({ name: p.name, runnable: p.diagnostics?.runnable ?? null })) };
        } finally { renderer.info.autoReset = savedAutoReset; }
      }, { condition, cameras, fault });
      row.pass = true;
      const problems = [];
      if (row.comparisons.a1b1.max > 1 || row.comparisons.a2b2.max > 1) problems.push('pixel max exceeds 1/255');
      if (row.comparisons.legacyRepeat.max || row.comparisons.candidateRepeat.max) problems.push('frozen repeat differs');
      if (row.captures[0].calls - row.captures[1].calls !== 1 || row.captures[3].calls - row.captures[2].calls !== 1) problems.push('expected exactly one fewer draw');
      if (row.captures.some(c => c.error || c.nonBlack < 1000 || c.alphaNonzero < 1000)) problems.push('GL error or empty image');
      if (JSON.stringify(row.before) !== JSON.stringify(row.after)) problems.push('game or camera changed during comparison');
      if (row.passes.legacy - row.passes.candidate !== 1) problems.push('expected one fewer enabled pass');
      for (const [name, buffer] of Object.entries(row.buffers)) {
        if (!buffer.composer.every(size => JSON.stringify(size) === JSON.stringify(buffer.canvas))) problems.push(name + ' composer/canvas dimensions differ');
        const expectedSamples = Math.min(report.prepared.context.maxSamples || 0, condition.tier === 'high' ? 4 : 0);
        if (!buffer.samples.every(n => n === expectedSamples)) problems.push(name + ' MSAA differs');
      }
      if (JSON.stringify(row.buffers.legacy) !== JSON.stringify(row.buffers.candidate)) problems.push('quality/resize buffers differ');
      if (JSON.stringify(row.uniforms.legacy) !== JSON.stringify(row.uniforms.expected)) problems.push('legacy look uniforms differ');
      if (!fault && JSON.stringify(row.uniforms.candidate) !== JSON.stringify(row.uniforms.expected)) problems.push('candidate look uniforms differ');
      if (row.programs.some(p => p.runnable === false)) problems.push('shader failed to link');
      row.problems = problems; row.pass = !problems.length;
      report.rows.push(row); checkpoint();
      console.log(JSON.stringify({ completed: i + 1, total: conditions.length, ...condition,
        pass: row.pass, max: row.comparisons.a1b1.max, legacyCalls: row.captures[0].calls, candidateCalls: row.captures[1].calls }));
      if (!row.pass) { report.failures.push(...problems.map(problem => ({ index: i, condition, problem }))); break; }
    }
    for (const file of files) assert.equal(sha(read(file.file)), file.sha256, 'Root changed during comparison: ' + file.file);
    assert.equal(sha(read(candidateFile)), report.candidate.sha256, 'Candidate changed during comparison');
    report.pass = report.rows.length === conditions.length && report.rows.every(row => row.pass) && !report.errors.length && !report.consoleErrors.length;
    if (fault) {
      report.faultDetected = report.failures.some(f => f.problem === 'pixel max exceeds 1/255');
      assert(report.faultDetected, 'Contrast fault did not trip the actual pixel acceptance gate');
    }
    if (!report.pass) process.exitCode = 1;
  } catch (error) {
    report.pass = false; report.exception = error.stack; console.error(error); process.exitCode = 1;
  } finally {
    if (page && !page.isClosed()) {
      try { await page.evaluate(() => { game.loop.stop(); game.engine.post = __postAudit.original;
        game.engine.scene.userData.lookProfile = __postAudit.originalProfile; }); } catch {}
    }
    if (context) await context.close();
    if (browser) await browser.close();
    report.endedUtc = new Date().toISOString(); checkpoint();
    console.log(JSON.stringify({ pass: report.pass, faultDetected: report.faultDetected || false, rows: report.rows.length,
      errors: report.errors.length, consoleErrors: report.consoleErrors.length, report: out + '/report.json' }));
  }
})();
