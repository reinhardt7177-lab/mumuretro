// Consolidate completed evidence; this does not run gameplay or modify the product.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const fixture = require('./world-horizon-fixture.cjs');
const { A, B } = fixture;
const read = file => JSON.parse(fs.readFileSync(path.join(B, file), 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hash = file => sha(fs.readFileSync(file));

async function main() {
  const base = read('baseline.json');
  const installed = read('installation.json');
  const inventory = {};
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.posix.join(directory, entry.name);
      assert(!fs.lstatSync(file).isSymbolicLink(), 'Unexpected product link: ' + file);
      if (entry.isDirectory()) walk(file);
      else inventory[file] = hash(file);
    }
  }
  for (const directory of ['src', 'assets', 'vendor']) walk(directory);
  for (const file of ['index.html', 'fire-trial.html']) inventory[file] = hash(file);
  assert(installed.pass);
  assert.equal(Object.keys(inventory).length, 462);
  assert.deepEqual(inventory, installed.inventory, 'Product changed after validated installation');
  const preserved = Object.keys(base.inventory).filter(file => !installed.changed.includes(file));
  assert.equal(preserved.length, 454);
  assert(preserved.every(file => inventory[file] === base.inventory[file]));
  assert.equal(preserved.filter(file => file.startsWith('assets/')).length, 225);

  const before = read('before.json'), goal = read('goal.json'), after = read('after.json');
  for (const result of [before, goal, after]) assert(result.pass && !result.errors.length);
  assert.deepEqual(goal.sources, fixture.hashes('goal'));
  assert.deepEqual(after.sources, fixture.hashes('after'));
  assert.deepEqual(goal.sources, after.sources);
  assert.deepEqual(goal.physicalHashes, after.physicalHashes);
  for (const key of ['terrain', 'carpet', 'shrines']) {
    assert.equal(after.physicalHashes[key], before.physicalHashes[key]);
  }
  for (const key of ['colliders', 'scatter']) {
    assert.notEqual(after.physicalHashes[key], before.physicalHashes[key]);
  }
  assert.equal(after.shots.length, 24);
  const poses = after.shots.map(shot => {
    const previous = before.shots.find(row => row.id === shot.id && row.view === shot.view);
    const target = goal.shots.find(row => row.id === shot.id && row.view === shot.view);
    assert(previous && target);
    for (const key of ['actor', 'foot', 'camera', 'up', 'quaternion', 'fov', 'aspect']) {
      assert.deepEqual(shot[key], previous[key]);
      assert.deepEqual(shot[key], target[key]);
    }
    return { id: shot.id, view: shot.view, poseError: 0 };
  });
  for (const response of after.assetResponses) {
    const file = new URL(response.url).pathname.slice(1);
    const target = goal.assetResponses.find(row => row.url === response.url);
    assert.equal(response.status, 200);
    assert.equal(response.sha256, inventory[file]);
    assert.equal(response.sha256, target.sha256);
    assert.equal(response.bytes, fs.statSync(file).size);
  }

  const checks = [
    ['check-after.json', 11], ['variants-after.json', 4],
    ['walk-goal/report.json', 40], ['expedition-after/report.json', 16],
    ['blender-audit.json', 6],
  ];
  for (const [file, count] of checks) {
    const result = read(file);
    assert(result.pass && !result.errors?.length && result.checks.length === count);
    assert(result.checks.every(check => check.pass));
  }
  assert(read('runtime-validation.json').pass);
  assert(read('packing.json').pass);
  const faults = read('fault-validation.json');
  assert(faults.pass && faults.rows.length === 6);
  for (const row of faults.rows) {
    const result = read('check-goal-break-' + row.name + '.json');
    assert(row.pass && row.code !== 0);
    // The verifier catches the intended assertion and records its stack as
    // `failure`; that field must identify this exact failed check, not be empty.
    assert(!result.pass && !result.errors.length);
    const failed = result.checks.filter(check => !check.pass);
    assert.equal(failed.length, 1);
    assert.equal(failed[0].name, row.failedCheck);
    assert(result.failure.startsWith('AssertionError [ERR_ASSERTION]: ' + row.failedCheck + ':'));
  }
  const suite = read('gameplay/gameplay-validation.json');
  assert(suite.pass && suite.classroom && suite.results.length === 11);
  for (const row of suite.results) {
    const result = read('gameplay/' + row.file);
    assert(row.pass && row.code === 0 && row.checks === row.expectedChecks);
    assert(result.pass && !result.errors?.length && result.checks.length === row.checks);
    assert(result.checks.every(check => typeof check === 'string' ? check.length > 0 : check.pass));
  }
  const gameplayChecks = suite.results.reduce((sum, row) => sum + row.checks, 0);
  assert.equal(gameplayChecks, 156);
  const basic = read('basic-checks.json');
  assert.equal(basic.results.length, 4);
  assert(basic.results.every(row => row.status === 'fulfilled' && row.value.exit_code === 0));

  const performance = [];
  for (const file of ['performance.json', 'performance-reverse.json', 'performance-tablet.json']) {
    const result = read(file);
    assert(result.pass && !result.errors.length && result.rows.length === 16);
    assert(result.rows.every(row => row.samples === 120 && (!row.moving || row.movingSamples === 120)));
    assert.deepEqual(result.sources.after, after.sources);
    assert(result.poseComparisons.length === 8 && result.poseComparisons.every(row => row.actor === 0 && row.camera === 0));
    performance.push({ file, conditions: 16, tabletEmulation: result.tablet, poseError: 0 });
  }
  const study = read('shader-cost-study.json'), decision = read('shader-proposal-decision.json');
  assert(study.pass && !study.errors.length && study.rows.length === 16 && study.pixels.length === 4);
  assert(study.pixels.every(row => row.maximumChannelDifference === 0 && row.meanDifference === 0));
  assert(decision.adopted === false && decision.rootUnchanged);

  const release = read('build-release.json');
  assert(read('build-validation.json').pass);
  assert.equal(Object.keys(release.files).length, 462);
  assert.deepEqual(Object.keys(release.files).sort(), Object.keys(inventory).sort());
  for (const [file, expected] of Object.entries(release.files)) {
    assert.equal(hash('dist/' + file), expected);
    let bytes = fs.readFileSync(file);
    if (!file.startsWith('vendor/') && /\.(?:html|js|css|json|svg|txt|md)$/.test(file)) {
      bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
    }
    assert.equal(sha(bytes), expected, 'Canonical build mismatch: ' + file);
  }
  const gallery = read('review-check.json');
  assert(gallery.pass && gallery.checks.length === 2);
  const images = [...fs.readFileSync(A + '/review.html', 'utf8').matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]);
  assert.equal(images.length, 76);
  assert(images.every(file => fs.existsSync(path.resolve(A, file))));
  const landscapeBase = 'reports/2026-10-26/evidence/app-landscape-v05/';
  const landscape = JSON.parse(fs.readFileSync(landscapeBase + 'report.json'));
  const landscapeSources = JSON.parse(fs.readFileSync(landscapeBase + 'source-snapshot.json'));
  const landscapeReview = JSON.parse(fs.readFileSync(landscapeBase + 'review-check.json'));
  assert(landscape.pass && !landscape.errors.length && landscape.shots.length === 18);
  assert(landscape.shots.every(shot => shot.ready && fs.existsSync(landscapeBase + shot.id + '.png')));
  assert(landscapeSources.releaseFiles === 462 && landscapeReview.pass && landscapeReview.images === 18);
  assert.deepEqual(landscapeSources.sourceHashes, inventory);

  const http = [];
  for (const route of ['/', '/' + A + '/review.html', '/art/app-landscape/v05/review.html',
    '/assets/models/adventure/world-horizon-v03.glb', '/assets/models/adventure/world-horizon-v03.json', '/vendor/three/build/three.module.js']) {
    const response = await fetch('http://127.0.0.1:5512' + route);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200, route);
    const file = route === '/' ? 'index.html' : route.slice(1);
    assert.equal(sha(bytes), hash(file));
    http.push({ route, status: response.status, bytes: bytes.length, sha256: sha(bytes) });
  }
  const result = {
    pass: true, finishedUtc: new Date().toISOString(),
    scope: 'Installed distant landscape and physical approach clearings; full game goal remains active. Prepared captures are distinct from actual controller journeys.',
    runtimeFiles: 462, preservedRuntime: 454, preservedOldAssets: 225,
    matchedPoses: 24, poseError: 0, reviewImages: 76, wholeAppPreparedViews: 18,
    normalGPUChecks: 11, variantsChecks: 4, walkingChecks: 40, expeditionChecks: 16,
    blenderChecks: 6, gameplayChecks, intentionalFaults: 6,
    sourcesMatchInstalledAndPreview: true, canonicalBuildMatches: true,
    performance, performanceConditions: 48,
    performanceLimit: 'First PC landing/mid/stationary sample fell 59.17 to 30.12 FPS. Reversed PC and same-host tablet emulation measured both versions around 30 mid/60 low. Cause unresolved; no general FPS improvement or real school-tablet claim.',
    rejectedShaderStudy: { adopted: false, blocks: 16, pixelPairs: 4, maximumPixelDifference: 0 },
    actualJourneyLimit: suite.scope, poses, http,
  };
  fs.writeFileSync(B + '/final-validation.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, poses: undefined, http: undefined }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
