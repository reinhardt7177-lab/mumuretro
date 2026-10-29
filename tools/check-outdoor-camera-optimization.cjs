// Offline differential check against the preserved implementation. No browser,
// renderer, game boot, storage, or external package is used.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const baseline = path.join(root, 'reports/2026-10-29/evidence/runtime-optimization/before/src/world/PlanetCameraOcclusion.js');
const current = path.join(root, 'src/world/PlanetCameraOcclusion.js');
const fault = process.argv.includes('--fault') || process.argv.includes('--fault=drop-first');
const report = { scope: 'Pinned Three r160, preserved source oracle, synthetic fixtures only; no personal save or FPS claim.', fault: fault ? 'drop-first' : null, checks: [], queries: 0, rays: 0, hits: 0, misses: 0 };
function check(name, details) {
  report.checks.push({ name, pass: true, ...details });
  console.log('PASS ' + name);
}

(async () => {
  assert(fs.existsSync(baseline), 'preserved baseline must exist before this check runs');
  assert(vm.SourceTextModule, 'run with node --experimental-vm-modules');
  const T = await import(pathToFileURL(path.join(root, 'vendor/three/build/three.module.js')).href);
  assert.equal(T.REVISION, '160', 'use the project-pinned Three revision');
  const context = vm.createContext({ console });
  const three = new vm.SyntheticModule(Object.keys(T), function () {
    for (const [key, value] of Object.entries(T)) this.setExport(key, value);
  }, { context });
  async function load(file) {
    const module = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { context, identifier: file });
    await module.link(specifier => {
      assert.equal(specifier, 'three', 'this isolated module only imports pinned Three');
      return three;
    });
    await module.evaluate();
    return module.namespace.buildPlanetCameraOcclusion;
  }
  const before = await load(baseline), after = await load(current);
  const main = new T.Group(), movingParent = new T.Group(), nested = new T.Group();
  main.add(nested, movingParent);
  const opaque = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const transparent = new T.MeshBasicMaterial({ transparent: true, opacity: .5, side: T.DoubleSide });
  const noDepth = new T.MeshBasicMaterial({ depthWrite: false, side: T.DoubleSide });
  function mesh(name, material = opaque, size = 2) {
    const value = new T.Mesh(new T.BoxGeometry(size, size, size), material);
    value.name = name;
    return value;
  }
  const ordinary = mesh('ordinary'), moving = mesh('moving-child');
  ordinary.position.set(-2, 0, -2); moving.position.set(3, 0, -3);
  nested.add(ordinary); movingParent.add(moving);
  const instances = new T.InstancedMesh(new T.BoxGeometry(.9, 1.4, .8), opaque, 96);
  instances.name = 'many-instances'; nested.add(instances);
  const matrix = new T.Matrix4(), quaternion = new T.Quaternion(), scale = new T.Vector3(1, 1, 1);
  for (let i = 0; i < 96; i++) {
    quaternion.setFromAxisAngle(new T.Vector3(0, 1, 0), (i % 5) * .17);
    instances.setMatrixAt(i, matrix.compose(new T.Vector3((i % 12 - 5.5) * 2, Math.floor(i / 48) * 2, -Math.floor(i / 12) * 2), quaternion, scale));
  }
  const excluded = mesh('camera-excluded'); excluded.userData.cameraOccluder = false;
  const transparentOnly = mesh('transparent-only', transparent), depthOff = mesh('depth-write-off', noDepth);
  const tiny = mesh('too-small', opaque, .1);
  const mixed = mesh('mixed-materials', [transparent, opaque, transparent, opaque, transparent, opaque]);
  mixed.position.set(6, 0, -3);
  main.add(excluded, transparentOnly, depthOff, tiny, mixed);
  const roots = [main, instances, ordinary, mixed, null]; // duplicate roots must not duplicate sources
  const expected = before(roots), actual = after(roots);
  const canonical = api => new Map(api.entries.map(e => [e.proxy || e.source, [e.source.id, e.index ?? -1]]));
  const expectedIds = canonical(expected), actualIds = canonical(actual);
  const key = (ids, value) => { assert(ids.has(value), 'returned mesh must have an original source entry'); return ids.get(value); };
  const excludedIds = new Set([excluded.id, transparentOnly.id, depthOff.id, tiny.id]);
  assert.equal(expected.count, 99, '96 original instances plus three qualifying ordinary sources');
  assert.equal(actual.count, expected.count);
  assert(actual.entries.every(e => !excludedIds.has(e.source.id)));
  assert(actual.entries.some(e => e.source === mixed));
  check('build filters, duplicate roots, mixed materials and instance source identities', { entries: actual.count, instances: 96 });

  function snapshot(api, selected, ids) {
    return {
      count: api.count,
      order: selected.map(value => key(ids, value)),
      entries: api.entries.map(e => ({
        source: e.source.id, index: e.index ?? -1,
        sphere: [...e.sphere.center.toArray(), e.sphere.radius],
        matrixWorld: Array.from((e.proxy || e.source).matrixWorld.elements),
        geometry: (e.proxy || e.source).geometry.id,
        material: Array.isArray((e.proxy || e.source).material) ? (e.proxy || e.source).material.map(m => m.id) : (e.proxy || e.source).material.id,
      })),
    };
  }
  const caster = new T.Raycaster();
  function hitSnapshot(selected, ids, from, to, far) {
    caster.set(from, to.clone().sub(from).normalize()); caster.near = 0; caster.far = far;
    return caster.intersectObjects(selected, false).map(hit => ({
      source: key(ids, hit.object), instanceId: hit.instanceId ?? -1, face: hit.faceIndex,
      distance: hit.distance, point: hit.point.toArray(), uv: hit.uv?.toArray(),
    }));
  }
  function compare(label, position, distance) {
    // Capture the candidate first: the oracle must not refresh a stale shared
    // source matrix and accidentally hide a candidate invalidation bug.
    const got = Array.from(actual.query(position, distance));
    if (fault && report.queries === 0) { assert(got.length, 'drop-first fault fixture must contain a result'); got.shift(); }
    const gotSnapshot = snapshot(actual, got, actualIds);
    const want = Array.from(expected.query(position, distance));
    assert.deepEqual(gotSnapshot, snapshot(expected, want, expectedIds), label + ': ordered original sources, matrices and spheres match preserved source');
    const targets = [[-12, 0, -6], [0, 0, -6], [12, 2, -6], [80, 0, -6]].map(v => new T.Vector3(...v));
    for (const value of want.slice(0, 6)) targets.push(value.geometry.boundingSphere.center.clone().applyMatrix4(value.matrixWorld));
    for (const [i, target] of targets.entries()) {
      const from = target.clone().add(new T.Vector3(i % 2 ? 1.13 : 0, .37, 18));
      const far = i === 3 ? 3 : 40;
      const wantedHits = hitSnapshot(want, expectedIds, from, target, far);
      assert.deepEqual(hitSnapshot(got, actualIds, from, target, far), wantedHits, label + ': exact pinned-Three triangle hits and order');
      report.rays++; report.hits += wantedHits.length; report.misses += Number(wantedHits.length === 0);
    }
    report.queries++;
  }
  function sweep(label) {
    for (const [p, d] of [[[0, 0, 0], 5], [[8, 2, -8], 12], [[-40, 0, 0], 1], [[0, 0, -4], 80], [[4, 0, -3], 0]]) compare(label, new T.Vector3(...p), d);
  }
  sweep('initial'); check('near, far, zero-distance and empty queries preserve ordering and real ray hits');
  nested.visible = false; sweep('ancestor hidden'); nested.visible = true; sweep('ancestor restored');
  instances.visible = false; sweep('source hidden'); instances.visible = true; sweep('source restored');
  main.visible = false; sweep('root hidden'); main.visible = true; sweep('root restored');
  check('ancestor, root and source visibility restore on the next query');
  instances.count = 17; sweep('count reduced'); instances.count = 96; sweep('count restored');
  check('instance count reduction and restoration preserve original source/index membership');
  moving.position.set(-9, 1, -7); moving.rotation.set(.3, .7, .2); moving.scale.set(-1.3, .7, 1.2);
  sweep('ordinary transform changed without manual world update');
  movingParent.position.set(11, -.5, -2); movingParent.rotation.set(.1, -.6, .2);
  sweep('parent transform changed without manual world update');
  check('ordinary and parent movement immediately refresh matrices, bounds and ray hits');
  ordinary.geometry.boundingSphere = new T.Sphere(new T.Vector3(4, 0, 0), 5);
  sweep('explicit ordinary local bounding sphere replaced');
  check('query reads changed local geometry bounding spheres');
  const replacement = new T.MeshBasicMaterial({ side: T.DoubleSide, color: 0x7bb899 });
  instances.material = replacement; sweep('instanced source material replaced');
  check('instance proxies keep current source material identity');
  assert(report.hits > 0 && report.misses > 0 && report.rays > 100, 'ray oracle must exercise hits and misses');
  report.pass = true;
})().catch(error => {
  report.pass = false; report.failure = error.message; console.error('FAIL ' + error.message); process.exitCode = 1;
}).finally(() => console.log(JSON.stringify(report)));
