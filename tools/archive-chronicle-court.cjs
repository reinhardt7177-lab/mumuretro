// Archive measured source, actual browser assertions and the exact deployed-file build.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const B = 'reports/2026-10-23/evidence/chronicle-court/', A = 'art/chronicle-court/v01/', D = B + 'verified/';
const model = 'assets/models/adventure/chronicle-court-v01.glb';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const sha = b => crypto.createHash('sha256').update(b).digest('hex'), hash = f => sha(fs.readFileSync(f));
const canonical = f => { const b = fs.readFileSync(f); return !f.startsWith('vendor/') && /\.(?:html|js|css|json|svg|txt|md)$/.test(f) ? Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n')) : b; };
const reports = [], files = [], modelTime = fs.statSync(model).mtimeMs;
fs.mkdirSync(D, { recursive: true });
function copy(name, source, fresh = false) {
  if (fresh) assert(fs.statSync(source).mtimeMs >= modelTime, 'stale post-model proof: ' + source);
  const archive = D + name + '.json'; fs.copyFileSync(source, archive);
  reports.push({ name, source, archive, sha256: hash(archive) }); return read(archive);
}
function checked(o, n) { assert(o.pass && !o.failure && !o.errors?.length && o.checks.length === n && o.checks.every(v => v.pass)); }
function tree(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = dir + '/' + e.name; if (f === D.slice(0, -1) || f === B + 'verification-index.json') continue; if (e.isDirectory()) tree(f); else files.push(f); } }
const court = copy('court', B + 'court.json', true), touch = copy('touch', B + 'touch.json', true);
checked(court, 8); checked(touch, 6);
const installed = court.checks[0].details;
assert(installed.loaded && installed.roots === 7 && installed.meshes === 28 && installed.triangles === 23632 && installed.colliders === 105 && installed.camera === 24 && installed.oldBases === 5 && installed.hidden);
const focused = copy('focused', B + 'focused.json', true);
assert(focused.pass && focused.cases.length === 5 && focused.cases.every(c => c.pass && c.code === 1));
for (const c of focused.cases) {
  const f = copy('fault-' + c.fault, B + 'fault-' + c.fault + '.json', true);
  assert(f.pass === false && !f.errors?.length && f.checks.at(-1).pass === false && f.checks.at(-1).name === c.expectedLastFailure);
  if (c.fault === 'model') assert(f.checks[0].pass && f.checks[0].details.metres > 1 && f.checks[0].details.decor.length === 11 && f.checks[0].details.decor.every(Boolean));
}
const touchFault = copy('fault-touch', B + 'fault-touch.json', true);
assert(touchFault.failureInjection && touchFault.pass === false && !touchFault.errors?.length && touchFault.checks.at(-1).pass === false && touchFault.checks.at(-1).name === 'real touch E picks up offering');
assert(fs.statSync(B + 'fault-touch.json').mtimeMs >= fs.statSync(B + 'touch.json').mtimeMs);
const regressions = copy('regressions', B + 'regressions/report.json', true);
assert(regressions.pass && regressions.cases.length === 3 && regressions.cases.every(c => c.pass && c.code === 0) && regressions.cases.reduce((n, c) => n + c.checks, 0) === 28);
for (const [name, stem, n] of [['guardian', 'chronicle-art', 7], ['journey', 'strata-journey', 14], ['save', 'app-progress', 7]]) checked(copy('regression-' + name, B + 'regressions/' + name + '/' + stem + '.json', true), n);
const source = copy('source-audit', B + 'source-audit.json', true);
assert(source.pass && source.sourceUnchanged && source.sourcePieces === 655 && source.webMeshes === 12 && source.prototypeTriangles === 19840 && source.glbBytes === 3452460);
assert(source.rows.length === 3 && source.rows.every(r => !r.invalid.length) && source.decoded.length === 3);
const arcade = source.rows.find(r => r.name === 'MemoryArcade');
assert(arcade.feet.length === 10 && arcade.feet.every(y => Math.abs(y) < 1e-6) && arcade.continuousCores.length === 10 && arcade.continuousCores.every(([lo, hi]) => lo < .46 && hi > 9.05));
assert.equal(hash(A + 'chronicle-court-v01.blend'), source.sourceSha256);
assert(source.textures.length === 4 && source.textures.every(t => t.size[0] === 512 && t.size[1] === 512 && t.path.startsWith('//')));
const bytes = fs.readFileSync(model); assert.equal(bytes.length, 3452460); assert.equal(bytes.readUInt32LE(0), 0x46546c67);
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
assert.equal(gltf.meshes.length, 12); assert.equal(gltf.materials.length, 5);
assert.equal(gltf.meshes.reduce((s, m) => s + m.primitives.reduce((n, p) => n + gltf.accessors[p.indices].count / 3, 0), 0), 19840);
const before = copy('before', B + 'before/report.json'), after = copy('after', B + 'after/report.json', true), goals = copy('goal-cameras', A + 'goal-cameras.json', true);
assert(before.pass && before.baselineReplay && !before.loaded && after.pass && !after.baselineReplay && after.loaded && before.shots.length === 3 && after.shots.length === 3);
assert.deepEqual(before.contract, after.contract);
assert(goals.pass && goals.shots.length === 3 && goals.sourceSha256 === source.sourceSha256 && goals.modelSha256 === hash(model));
for (const old of before.shots) { const next = after.shots.find(s => s.id === old.id), goal = goals.shots.find(s => s.id === old.id); for (const key of ['camera', 'target', 'fov']) { assert.deepEqual(next[key], old[key]); assert.deepEqual(goal[key], old[key]); } }
const comparison = copy('comparison', A + 'comparison-metrics.json', true), ui = copy('review-ui', B + 'review-ui.json', true);
assert(comparison.pass && comparison.fixedTriples === 3 && comparison.images.length === 19 && ui.pass && !ui.errors.length && ui.rows.length === 2 && ui.rows.every(r => r.images === 19 && r.noOverflow));
for (const im of comparison.images) { assert.equal(hash(im.file), im.sha256); files.push(im.file); }
const perf = copy('performance-summary', B + 'performance-summary.json', true), env = copy('performance-environment', B + 'performance-environment.json', true), oldPerf = copy('performance-before', B + 'performance-before.json', true), newPerf = copy('performance-after', B + 'performance-after.json', true);
assert(perf.pass && perf.rows.length === 4 && env.activeAuditProcesses === 0 && oldPerf.pass && newPerf.pass && oldPerf.rows.length === 4 && newPerf.rows.length === 4);
for (const a of oldPerf.rows) { const b = newPerf.rows.find(v => v.tier === a.tier && v.pose === a.pose); for (const k of ['actor', 'camera', 'buffer']) assert.deepEqual(a[k], b[k]); assert(!a.native && b.native && a.gpuBytes === null && b.gpuBytes === null); }
const previous = copy('previous-release', B + 'before-release.json'), release = copy('release', 'dist/assets/release.json', true);
assert.equal(Object.keys(previous.files).length, 395); assert.equal(Object.keys(release.files).length, 398);
const changed = Object.keys(release.files).filter(f => previous.files[f] !== release.files[f]).sort();
assert.deepEqual(changed, ['src/shrine/ChronicleCourt.js', 'src/shrine/Room.js', 'src/shrine/OpenField.js', model, 'assets/models/adventure/chronicle-court-v01.json'].sort());
for (const name of ['Room', 'OpenField']) assert.equal(sha(Buffer.from(fs.readFileSync(B + 'baseline-source/' + name + '.js', 'utf8').replace(/\r\n/g, '\n'))), previous.files['src/shrine/' + name + '.js']);
for (const [f, expected] of Object.entries(release.files)) { assert.equal(sha(canonical(f)), expected, f + ' source'); assert.equal(hash('dist/' + f), expected, f + ' built'); files.push(f); }
for (const name of ['source', 'save', 'audio']) { const f = B + 'basic-' + name + '.log', s = fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''); assert(name === 'audio' ? JSON.parse(s).pass : s.includes('PASS ')); files.push(f); }
assert(fs.readFileSync(B + 'build-web.log', 'utf8').includes('Built 398 runtime files'));
tree(A.slice(0, -1)); tree(B.slice(0, -1));
for (const f of ['README.md', 'SECOND_BRAIN.md', 'tools/TESTING.md', 'reports/2026-10-22/ADVENTURE_RECONSTRUCTION.md', 'reports/2026-10-24/CHRONICLE_COURT.md', 'reports/2026-10-24/CHRONICLE_COURT_HANDOFF.md']) files.push(f);
for (const f of fs.readdirSync('tools').filter(n => /chronicle-court/.test(n))) files.push('tools/' + f);
const index = { pass: true, wholeGoalComplete: false, releaseFiles: 398, changedRuntimeFiles: changed, normalChecks: 42, designatedFaults: 6, galleryImages: 19, performanceConditions: 8, performanceExactPairs: 4, sourcePieces: 655, prototypeTriangles: 19840, installedTriangles: 23632, reports, files: Object.fromEntries([...new Set(files)].map(f => [f, hash(f)])), limitations: ['One PC sequential prepared views,not ABBA/student hardware or proven FPS gain', 'Core vertices compared with design plinth/capital heights;not an engineering structural simulation', 'Final-temple journey starts with earlier orbs/opening prepared;not one fresh whole-app journey', '72 new-surface camera queries do not prove body visibility/HUD readability in every working pose', 'Reference game not run or REA analyzed;visual/material/camera and whole-app work remain', 'No public deployment in this phase'] };
fs.writeFileSync(B + 'verification-index.json', JSON.stringify(index, null, 2));
console.log('PASS398 exact runtime files,42 normal assertions,6 designated faults,19 images,4 exact performance pairs;whole goal remains active');
