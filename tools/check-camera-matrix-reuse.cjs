// Real Engine.updateCamera and pinned Three raycasts; no renderer or game boot.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..'), evidence = path.join(root, 'reports/2026-10-29/evidence/runtime-optimization');
const current = path.join(root, 'src/core/Engine.js'), baseline = path.join(evidence, 'before/src/core/Engine.js');
const fault = process.argv.includes('--fault');
const artifact = path.join(evidence, `camera-matrix-reuse-${fault ? 'fault' : 'normal'}-${Date.now()}-${process.pid}.json`);
const report = { scope: 'Offline real Engine.updateCamera, pinned Three r160 triangle raycasts; constructor/rendering/PMREM/storage excluded. Deterministic call counts, no timing or FPS claim.', fault: fault ? 'omit-second-avoid' : null, checks: [], updates: 0, beforeMatrixUpdates: 0, afterMatrixUpdates: 0 };

(async () => {
  assert(fs.existsSync(baseline), 'preserved Engine baseline must exist');
  assert(vm.SourceTextModule, 'run with node --experimental-vm-modules');
  const T = await import(pathToFileURL(path.join(root, 'vendor/three/build/three.module.js')).href);
  assert.equal(T.REVISION, '160');
  const context = vm.createContext({ console }), cache = new Map();
  function synthetic(name, values) {
    const module = new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context, identifier: name });
    cache.set(name, module); return module;
  }
  synthetic('three', T);
  synthetic('three/addons/effects/OutlineEffect.js', { OutlineEffect: class {} });
  synthetic('quality-stub', { quality: {} });
  synthetic('interior-stub', { prepareInteriorScene() {}, syncInteriorScene() {} });
  async function load(file) {
    if (cache.has(file)) return cache.get(file);
    let source = fs.readFileSync(file, 'utf8');
    if (fault && file === current) {
      const marker = 'avoid(this.camera.position);';
      assert(source.includes(marker), 'second obstruction ray fault marker exists');
      source = source.replace(marker, '/* isolated fault: omit interpolation obstruction ray */');
    }
    const module = new vm.SourceTextModule(source, { context, identifier: file }); cache.set(file, module);
    await module.link(specifier => {
      if (cache.has(specifier)) return cache.get(specifier);
      if (specifier.endsWith('/Quality.js')) return cache.get('quality-stub');
      if (specifier.endsWith('/InteriorDirection.js')) return cache.get('interior-stub');
      // Both Engine versions use the identical real math/lighting dependencies.
      const directory = file === baseline ? path.dirname(current) : path.dirname(file);
      return load(path.resolve(directory, specifier));
    });
    return module;
  }
  const oldModule = await load(baseline), newModule = await load(current);
  await oldModule.evaluate(); await newModule.evaluate();
  const Before = oldModule.namespace.Engine, After = newModule.namespace.Engine;
  function fixture(Type, kind) {
    const engine = Object.create(Type.prototype);
    Object.assign(engine, {
      camera: new T.PerspectiveCamera(62, 16 / 9, .3, 300),
      camFwd: new T.Vector3(0, 0, 1), camRight: new T.Vector3(1, 0, 0), camUp: new T.Vector3(0, 1, 0),
      lookHeight: 1.2, camColliders: [], _inited: false,
      sun: new T.DirectionalLight(), fill: new T.DirectionalLight(), hemi: new T.HemisphereLight(),
      _updateOutdoorEnvironment() {},
    });
    const player = {
      position: new T.Vector3(0, 100, 0), up: new T.Vector3(0, 1, 0), heading: new T.Vector3(0, 0, 1),
      lastAxis: new T.Vector3(1, 0, .2).normalize(), lastArc: 0, gliding: false, lift: 0,
      getFootPosition(out) { return out.copy(this.position).addScaledVector(this.up, this.lift); },
      planet: { surfaceAt(direction, out) { return out.copy(direction).multiplyScalar(100 + (kind === 'terrain' ? .4 * Math.sin(direction.x * 8) : 0)); } },
    };
    const parent = new T.Group(), stats = { matrices: 0, rays: [] };
    const count = kind === 'empty' ? 0 : kind === 'moving-parent' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const wall = new T.Mesh(new T.BoxGeometry(i ? 1.5 : 2, 8, .04), new T.MeshBasicMaterial({ side: T.DoubleSide }));
      wall.position.set(i ? 4 : 0, 101.2, i ? -5 : -3); parent.add(wall); engine.camColliders.push(wall);
      const update = wall.updateWorldMatrix;
      wall.updateWorldMatrix = function (...args) { stats.matrices++; return update.apply(this, args); };
      const raycast = wall.raycast;
      wall.raycast = function (ray, hits) {
        const start = hits.length; raycast.call(this, ray, hits);
        stats.rays.push(hits.slice(start).map(hit => [i, hit.faceIndex, hit.distance, ...hit.point.toArray()]));
      };
    }
    parent.updateMatrixWorld(true); stats.matrices = 0;
    if (kind === 'thin-wall') {
      engine._camPlaced = true; engine._cameraLift = 0;
      engine.camera.position.set(0, 101.2, -7);
    }
    return { engine, player, parent, stats };
  }
  function state(f) {
    const e = f.engine, c = e.camera;
    return {
      position: c.position.toArray(), quaternion: c.quaternion.toArray(), up: c.up.toArray(), fov: c.fov,
      projection: Array.from(c.projectionMatrix.elements), forward: e.camFwd.toArray(), right: e.camRight.toArray(),
      cameraUp: e.camUp.toArray(), lift: e._cameraLift,
      matrices: e.camColliders.map(m => Array.from(m.matrixWorld.elements)),
      sun: e.sun.position.toArray(), sunTarget: e.sun.target.position.toArray(), fill: e.fill.position.toArray(),
    };
  }
  function update(f, kind, frame) {
    const { player, parent, stats, engine } = f;
    if (kind === 'terrain') {
      player.up.set(Math.sin(frame * .09) * .05, 1, Math.cos(frame * .11) * .03).normalize();
      player.position.copy(player.up).multiplyScalar(100 + Math.sin(frame * .13) * .3);
      player.heading.set(0, 0, 1).projectOnPlane(player.up).normalize();
      player.lastArc = frame ? .001 : 0; player.lift = .15 + Math.sin(frame * .1) * .3;
      player.gliding = frame >= 8 && frame < 23;
    }
    if (kind === 'moving-parent') {
      parent.position.set(Math.sin(frame * .2), .2 * Math.sin(frame), .4 * Math.cos(frame * .3));
      parent.rotation.y = frame * .03; // intentionally no explicit world update
      engine.camColliders[1].position.x = 3 + Math.sin(frame * .17);
      parent.visible = frame % 7 !== 3;
    }
    stats.matrices = 0; stats.rays = [];
    const input = {
      camPitch: kind === 'thin-wall' ? 0 : .25 + .1 * Math.sin(frame * .19), camDist: 7,
      consumeYaw: () => kind === 'thin-wall' ? Math.PI / 2 : frame ? .025 * Math.sin(frame) : 0,
    };
    engine.updateCamera(player, input, frame % 3 === 0 ? 1 / 30 : 1 / 60);
    return state(f);
  }
  for (const [kind, frames] of [['thin-wall', 1], ['empty', 8], ['wall', 12], ['moving-parent', 24], ['terrain', 32]]) {
    const old = fixture(Before, kind), next = fixture(After, kind);
    for (let frame = 0; frame < frames; frame++) {
      const want = update(old, kind, frame), got = update(next, kind, frame);
      if (kind === 'thin-wall') assert(old.stats.rays.length === 2 && old.stats.rays[0].length === 0 && old.stats.rays[1].length > 0, 'thin wall fixture needs only the interpolated obstruction ray');
      assert.deepEqual(got, want, kind + ': actual camera state and obstruction world matrices match preserved Engine');
      assert.deepEqual(next.stats.rays, old.stats.rays, kind + ': both real Three obstruction rays retain all triangle hits');
      const count = old.engine.camColliders.length;
      assert.equal(old.stats.matrices, count * 2, kind + ': baseline refreshes matrices for both rays');
      assert.equal(next.stats.matrices, count, kind + ': candidate refreshes matrices once before both rays');
      report.updates++; report.beforeMatrixUpdates += old.stats.matrices; report.afterMatrixUpdates += next.stats.matrices;
    }
    report.checks.push({ name: kind, frames, pass: true }); console.log('PASS ' + kind + ' (' + frames + ' updates)');
  }
  assert.equal(report.beforeMatrixUpdates, report.afterMatrixUpdates * 2);
  report.pass = true;
})().catch(error => {
  report.pass = false; report.failure = error.message; console.error('FAIL ' + error.message); process.exitCode = 1;
}).finally(() => {
  fs.mkdirSync(evidence, { recursive: true }); fs.writeFileSync(artifact, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report)); console.log('Artifact: ' + artifact);
});
