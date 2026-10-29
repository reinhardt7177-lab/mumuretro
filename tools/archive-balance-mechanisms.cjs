// Preserve this local phase's evidence without replacing earlier phase receipts.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const base = 'reports/2026-10-22/evidence/balance-mechanisms/';
const art = 'art/balance-mechanisms/v01/';
const OUT = path.join(ROOT, base);
const DEST = path.join(OUT, 'verified');
const reports = [];
fs.mkdirSync(DEST, {recursive: true});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hash = file => sha(fs.readFileSync(path.join(ROOT, file)));
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
function copy(name, file) {
  const target = path.relative(ROOT, path.join(DEST, name + '.json')).replaceAll('\\', '/');
  fs.copyFileSync(path.join(ROOT, file), path.join(ROOT, target));
  reports.push({name, source: file, archive: target, sha256: hash(target)});
  return read(file);
}
function checks(report, count, name) {
  assert(report.pass !== false && report.checks.length === count && report.checks.every(c => c.pass), name);
  assert(!report.errors?.length, name + ' browser errors');
}
const baseline = copy('baseline-contact', base + 'baseline-contact.json');
checks(baseline, 2, 'baseline');
assert(baseline.baseline && baseline.checks[0].details.rows.length === 36);
assert(baseline.checks[0].details.worstPenetration < -.149 && baseline.checks[0].details.maxGap > .129);
const contact = copy('contact', base + 'contact.json');
checks(contact, 2, 'contact');
const feet = contact.checks[0].details;
assert(!contact.baseline && feet.native && feet.rows.length === 36);
assert(feet.rows.every(r => Number.isFinite(r.gap) && Math.abs(r.gap) <= .003));
assert.deepEqual(feet.rows.reduce((s, r) => (s[r.kind] = (s[r.kind] || 0) + 1, s), {}), {order: 4, twin: 12, lever: 20});

const native = copy('mechanisms', base + 'mechanisms.json');
checks(native, 12, 'native mechanisms');
assert.equal(native.checks[0].details.colliders, 91);
assert.equal(native.checks[5].details.length, 42);
assert(native.checks[5].details.every(r => r.gap >= .28 && r.gap <= .32));
assert.deepEqual(native.checks[6].details, {halls: 30, boards: 12, missing: 0, stockExcluded: true});
const camera = native.checks[7].details;
assert(camera.rows.length === 72 && camera.full === 72 && camera.improved === 6 && !camera.worse.length);
const journey = copy('journey', base + 'journey.json');
checks(journey, 15, 'continuous input');
const route = journey.checks[3].details;
assert(route.length === 2 && route[1].frames > 0 && route[1].total > 19 && route[1].remaining < .1);
assert(journey.checks[4].details.native && journey.checks[4].details.unsolved);
assert(journey.checks[6].details.compares.length === 3);
assert(journey.checks[6].details.compares.every(c => c.heights.length === 2 && c.heights.every(Number.isFinite) && c.feedback.includes('접시')));
assert.deepEqual(journey.checks[10].details.torques, [3, 3]);
assert(journey.checks[11].details.dialogue && !journey.checks[11].details.reward);
assert.deepEqual(journey.checks[12].details, {pages: 4, mode: 'planet', count: 1, sealed: true});
assert(journey.checks[13].details.three === 3 && journey.checks[13].details.sealed && journey.checks[13].details.count === 1);

const all = copy('regressions', base + 'regressions/report.json');
assert(all.pass && all.cases.length === 15 && all.cases.every(c => c.pass));
const normal = {
  'legacy-balance': ['report.json', 8], mobile: ['mobile-save.json', 6],
  actions: ['input-report.json', 12], 'app-save': ['app-progress.json', 7],
  notebook: ['notebook-pages.json', 19], 'sift-native': ['architecture.json', 15]
};
for (const [name, [file, count]] of Object.entries(normal)) {
  const r = copy('regression-' + name, base + 'regressions/' + name + '/' + file);
  checks(r, count, name);
  assert.equal(all.cases.find(c => c.name === name).code, 0);
}
const counts = copy('regression-counts', base + 'regressions/counts/report.json');
assert(!counts.errors.length && counts.results.length === 3);
assert.deepEqual(counts.results.map(r => r.count), [3, 4, 5]);
assert(counts.results.every(r => r.solved && r.open && r.restored && r.restoredOpen && r.z < -16));
assert.deepEqual(counts.edge, {wrongBlocked: true, panBlocked: true, reconciled: true});
assert.equal(all.cases.find(c => c.name === 'counts').code, 0);
const classroom = copy('regression-classroom', base + 'regressions/classroom/classroom-browser.json');
assert(classroom.pass && classroom.clients === 3 && classroom.checks.length === 5 && classroom.separatePhysicalStudentDevices === false);
assert.equal(all.cases.find(c => c.name === 'classroom').code, 0);
const failures = {
  model: ['fault-model.json', 'native articulated mechanisms'],
  counterrotate: ['fault-counterrotate.json', 'counter-rotating pans'],
  collision: ['fault-collision.json', 'column body clearance'],
  camera: ['fault-camera.json', 'architecture,sign backs'],
  restore: ['fault-restore.json', 'v3 restore immediately'],
  foot: ['fault-contact-foot.json', 'all actual crate feet'],
  rotation: ['fault-contact-rotation.json', 'all actual crate feet']
};
for (const [name, [file, prefix]] of Object.entries(failures)) {
  const r = copy('fault-' + name, base + 'regressions/fault-' + name + '/' + file);
  const row = all.cases.find(c => c.name === 'fault-' + name);
  assert(row.code === 1 && r.pass === false && r.checks.at(-1).pass === false, name);
  assert(r.checks.at(-1).name.startsWith(prefix) && row.terminal === r.checks.at(-1).name, name + ' designated failure');
}
const adaptationFiles = [];
for (const row of all.cases) {
  const dir = base + 'regressions/' + row.name + '/';
  const adaptations = copy('adaptations-' + row.name, dir + 'adaptations.json');
  assert.equal(adaptations.assertionsWeakened, false, row.name);
  adaptationFiles.push(dir + 'executed-check.cjs', dir + 'adaptations.json');
}
assert.equal(all.cases.filter(c => c.code === 0).length, 8);
assert.equal(all.cases.filter(c => c.code === 1).length, 7);

const views = ['before', 'after'].map(p => copy('staged-' + p, base + p + '/report.json'));
assert(views.every(v => v.pass && v.staged && v.shots.length === 9 && !v.errors.length));
for (let i = 0; i < 9; i++) {
  assert.equal(views[0].shots[i].id, views[1].shots[i].id);
  assert.deepEqual(views[0].shots[i].actor, views[1].shots[i].actor);
  assert.deepEqual(views[0].shots[i].camera, views[1].shots[i].fixedCamera);
  assert.equal(views[0].shots[i].fov, views[1].shots[i].fov);
}
const comp = copy('comparison', art + 'comparison-metrics.json');
assert.deepEqual(comp, {pass: true, fixedPairs: 9, actorDelta: 0, nativeGoals: 9, nativePartViews: 9, actualScreens: 6, galleryImages: 43});
const ui = copy('review-ui', base + 'review-ui.json');
assert(ui.pass && ui.rows.length === 2 && ui.rows.every(r => r.fixed === 43 && r.auto === 43 && r.noOverflow));
assert.deepEqual(ui.rows.map(r => r.width), [1440, 390]);

const model = copy('model', art + 'model-metrics.json');
const parts = ['OrderScale', 'TwinScale', 'LeverAssembly'];
assert.equal(parts.reduce((s, p) => s + model[p].meshes, 0), 33);
assert.equal(parts.reduce((s, p) => s + model[p].triangles, 0), 20284);
assert.equal(model.glbBytes, 2898908);
assert(parts.every(p => Math.abs(model[p].webMin[1]) < .001));
assert(model.textures.length === 4 && model.textures.every(t => t.width === 512 && t.height === 512));
assert.deepEqual(read(art + 'design-spec.json'), read('assets/models/adventure/balance-mechanisms-v01.json'));
const source = copy('source-open', art + 'source-open.json');
assert(source.pass && !source.sourceModified && source.textures.length === 4);
assert(source.textures.every(t => t.exists && t.path.startsWith('//') && t.size[0] === 512 && t.size[1] === 512));
assert(parts.every(p => source.parts[p].meshes === model[p].meshes));
const material = copy('material-export', art + 'material-export.json');
const glb = fs.readFileSync(path.join(ROOT, 'assets/models/adventure/balance-mechanisms-v01.glb'));
assert(material.pass && material.geometryAndImageChunkUnchanged && material.materials.length === 5);
assert.equal(sha(glb.subarray(20 + glb.readUInt32LE(12))), material.binaryChunkSha256);
assert.equal(glb.length, model.glbBytes);
const oldRelease = read(base + 'before/source-release.json');
assert.equal(Object.keys(oldRelease.files).length, 355);
const preserved = ['assets/models/balance-temple-v04.glb', 'assets/models/heritage/balance-deity.glb'];
for (const file of preserved) assert.equal(hash(file), oldRelease.files[file], file + ' preserved');
const perf = copy('performance', base + 'performance.json');
assert(perf.pass && perf.rows.length === 6 && !perf.errors.length);
assert(perf.rows.every(r => r.native && r.averageFps > 0 && r.meanFrameMs > 0 && r.gpuBytes === null));
assert.deepEqual(perf.rows.map(r => r.tier + '-' + r.view), ['mid-order', 'mid-twin', 'mid-lever', 'min-order', 'min-twin', 'min-lever']);
for (const name of ['preflight-failure', 'bound-estimate-failure', 'direction-assertion', 'board-count-assertion']) copy('initial-' + name, base + 'initial-' + name + '.json');
const refBase = 'reports/2026-10-22/evidence/architecture-reference/';
const ref = copy('reference', refBase + 'source.json');
assert(ref.httpStatus === 200 && ref.observed.pdfPage === 26 && !ref.originalRuntimeExecuted && !ref.reaBinaryAnalysis && !ref.referencePixelsCopiedIntoGameAssets);
assert.equal(hash(refBase + 'ExplorersGuide.pdf'), ref.sha256);
for (const name of ['source', 'save', 'audio']) {
  const file = base + 'basic-' + name + '.log';
  const log = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert(name === 'audio' ? JSON.parse(log).pass : log.includes('PASS '));
  fs.copyFileSync(path.join(ROOT, file), path.join(DEST, 'basic-' + name + '.log'));
}
const release = read('dist/assets/release.json');
assert.equal(Object.keys(release.files).length, 358);
for (const [file, expected] of Object.entries(release.files)) {
  let bytes = fs.readFileSync(path.join(ROOT, file));
  if (!file.startsWith('vendor/') && /\.(?:html|js|css|json|svg|txt|md)$/.test(file)) bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
  assert.equal(sha(bytes), expected, file + ' canonical source');
  assert.equal(hash('dist/' + file), expected, file + ' build');
}
const files = [
  'src/shrine/BalanceArt.js', 'src/shrine/BalanceTemple.js', 'src/shrine/BalanceTrials.js', 'src/shrine/Room.js',
  'src/render/StaticRaycastTree.js', 'src/sphere/CarryPresentation.js',
  'assets/models/adventure/balance-mechanisms-v01.glb', 'assets/models/adventure/balance-mechanisms-v01.json',
  ...preserved, ...adaptationFiles,
  art + 'balance-mechanisms-v01.blend', art + 'design-spec.json', art + 'DESIGN.md', art + 'review.html', art + 'blueprint.svg',
  'reports/2026-10-22/BALANCE_MECHANISMS.md', base + 'initial-goal-metadata-failure.log',
  base + 'before/source-release.json', base + 'build.log', ...['source', 'save', 'audio'].map(n => base + 'basic-' + n + '.log')
];
for (const name of ['build-balance-mechanisms.py', 'finalize-balance-materials.cjs', 'audit-balance-source.py', 'check-balance-contact.cjs', 'check-balance-mechanisms.cjs', 'check-balance-journey.cjs', 'capture-balance-mechanisms.cjs', 'run-balance-mechanism-regressions.cjs', 'run-balance-check-case.cjs', 'build-balance-review.cjs', 'check-balance-review.cjs', 'measure-balance-mechanisms.cjs', 'archive-balance-mechanisms.cjs']) files.push('tools/' + name);
for (const name of ['stone-albedo', 'stone-normal', 'wood-albedo', 'wood-normal']) files.push(art + name + '.png');
for (const part of parts) for (const view of ['front', 'side', 'rear']) files.push(art + part + '-' + view + '.png');
for (const shot of views[1].shots) {
  files.push(art + 'goal-' + shot.id + '.png');
  for (const phase of ['before', 'after']) files.push(base + phase + '/' + shot.id + '.png');
  files.push(base + 'after/' + shot.id + '-fixed.png');
}
for (const name of ['exterior', 'comparison', 'order', 'twin', 'lever', 'audience']) files.push(base + 'actual-' + name + '.png');
const index = {
  pass: true, created: new Date().toISOString(), wholeGoalComplete: false,
  publicReleaseUpdated: false, studentPhysicalDevicesVerified: false, originalRuntimeExecuted: false,
  checks: {nativeMechanisms: 12, contact: 2, physicalPlacements: 36, continuousInput: 15,
    regressionGroups: 8, designatedFaults: 7, columnClearances: 42, bodyBoxes: 91,
    cameraViews: 72, improvedViews: camera.improved, ninePointsClear: camera.full,
    fixedPairs: 9, nativeGoals: 9, nativePartViews: 9, actualScreens: 6, galleryImages: 43,
    runtimeFiles: 358, canonicalSourceAndBuildHashesMatch: true},
  models: {sourceTriangles: 20284, renderMeshes: 33, bytes: 2898908, materials: 5, images: 4},
  contact: {beforeMin: baseline.checks[0].details.worstPenetration, beforeMax: baseline.checks[0].details.maxGap,
    afterMin: feet.worstPenetration, afterMax: feet.maxGap, toleranceMetres: .003},
  worldApproachMetres: route[1].total,
  averageFpsRange: [Math.min(...perf.rows.map(r => r.averageFps)), Math.max(...perf.rows.map(r => r.averageFps))],
  limitations: [
    'Official PDF observation; no original runtime, binary REA or internal parameters established.',
    'Native composition goals omit hero, crates, other devices, doors and interaction UI.',
    'Input is automated, navigation code is known; no student fun or physical-device verification.',
    'This seed starts in ascending home order; active comparisons in the test do not remove that gameplay issue.',
    'Protected work-area boxes are not rope physics, jump-on-pan support, player weight or rigid-body friction.',
    'Nine-point camera samples are not all transitions or complete pixel visibility.',
    'One PC staged performance is not an A/B improvement; first-room slow frames remain.',
    'Large choice panels, carrying repetition, other major spaces, guardians, notebook and ending art remain.'
  ],
  normalization: 'non-vendor LF text, vendor/binary exact', reports,
  sourceHashes: Object.fromEntries(files.map(file => [file, hash(file)]))
};
fs.writeFileSync(path.join(OUT, 'verification-index.json'), JSON.stringify(index, null, 2));
console.log('PASS balance receipt: 12 native, 36 contacts, 15 input, 8 regression groups, 7 designated faults, 358 runtime hashes; whole Goal incomplete');
