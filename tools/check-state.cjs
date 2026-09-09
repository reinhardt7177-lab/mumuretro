// Run: node --experimental-vm-modules tools/check-state.cjs
// Uses the bundled THREE engine; canvas calls are measured without a browser.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const canvases = [];
global.document = { createElement(type) {
  assert.equal(type, 'canvas');
  const calls = { draws: 0, clears: 0 };
  const ctx = new Proxy({
    createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
    drawImage() { calls.draws++; }, clearRect() { calls.clears++; },
  }, { get(target, key) { return target[key] || (() => {}); } });
  const canvas = { getContext: () => ctx, calls };
  canvases.push(canvas);
  return canvas;
} };
const modules = new Map();
async function moduleAt(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file);
  let source = fs.readFileSync(file, 'utf8');
  if (process.argv.includes('--break-map-restore') && file.endsWith('MapPage.js'))
    source = source.replace('lctx.drawImage(base, x, y, CELL_W, CELL_H, x, y, CELL_W, CELL_H);', '/* mutation: do not rebuild the lit map */');
  const m = new vm.SourceTextModule(source, { identifier: file });
  modules.set(file, m);
  await m.link((specifier, owner) => moduleAt(specifier === 'three'
    ? path.join(root, 'vendor/three/build/three.module.js') : path.resolve(path.dirname(owner.identifier), specifier)));
  return m;
}
async function use(file) { const m = await moduleAt(path.join(root, file)); if (m.status !== 'evaluated') await m.evaluate(); return m.namespace; }
const copy = x => JSON.parse(JSON.stringify(x));
const equalState = (a, b) => assert.deepEqual(copy(a.exportState()), copy(b.exportState()));
(async () => {
  const THREE = await use('vendor/three/build/three.module.js');
  const { buildLab, PORTAL_CODE } = await use('src/world/Lab.js');
  const a = buildLab(), b = buildLab();
  assert.equal(a.interact({ x: 0.4, z: 1.7 }), 'parcel');
  a.markRead();
  for (const d of a.dials) for (let i = 0; i < PORTAL_CODE[d.i]; i++) a.interact({ x: d.x, z: d.z + 1.2 });
  assert.equal(a.state.open, true);
  a.markDone();
  assert.equal(b.importState(copy(a.exportState())), true); equalState(a, b);
  assert.ok(b.dials.every((d, i) => d.value === PORTAL_CODE[i] && d.knob.rotation.z === -(d.value / 10) * Math.PI * 2));
  const lit = b.scene.children.filter(m => m.geometry?.type === 'CylinderGeometry' && m.geometry.parameters.height === 5.2);
  assert.equal(lit[0].visible, true);
  assert.equal(b.importState({ version: 1, dials: [NaN, 5, 8] }), false); equalState(a, b);
  const planet = { R: 68, heightAt: () => 0, slopeDegAt: () => 0,
    surfaceAt(dir) { return dir.clone().multiplyScalar(68); },
    frameAt(pos) { return { position: pos.clone(), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize()) }; },
  };
  const carpet = { liftAt: () => 0 };
  const spots = [
    { kind: 'fruit', idx: 0, seed: 123, dir: new THREE.Vector3(0, 1, 0) },
    { kind: 'mushroom', idx: 0, seed: 456, dir: new THREE.Vector3(1, 0, 0) },
    { kind: 'meat', idx: 0, seed: 789, beast: 'rabbit', dir: new THREE.Vector3(0, 0, 1) },
  ];
  const legend = [{ id: 'icebloom', dir: new THREE.Vector3(-1, 0, 0) }];
  const { buildForage } = await use('src/world/Forage.js');
  const fa = buildForage(new THREE.Scene(), planet, spots, legend, carpet);
  const fb = buildForage(new THREE.Scene(), planet, spots, legend, carpet);
  const fruit = fa.sites[0], ripe = fruit.cands.find(c => c.ok);
  fruit.group.updateMatrixWorld();
  assert.equal(fa.interact(fruit.group.localToWorld(new THREE.Vector3(ripe.x, 0, ripe.z))).ok, true);
  fa.update(76); // 한 번 다시 난 뒤 다른 씨앗까지 저장한다.
  const fruit2 = fa.sites[0], ripe2 = fruit2.cands.find(c => c.ok);
  fruit2.group.updateMatrixWorld();
  fa.interact(fruit2.group.localToWorld(new THREE.Vector3(ripe2.x, 0, ripe2.z)));
  fa.bag.fruit = 5; fa.bag.salt = 2; fa.bag.herb = 3;
  const trap = fa.sites.find(s => s.kind === 'meat');
  trap.group.updateMatrixWorld();
  const dish = trap.dishes.find(d => d.kind === trap.beast.eats);
  fa.interact(trap.group.localToWorld(new THREE.Vector3(dish.x, 0, dish.z)));
  fa.update(26);
  assert.equal(trap.trap.beastG.visible, true);
  assert.equal(fb.importState(copy(fa.exportState())), true); equalState(fa, fb);
  const restoredTrap = fb.sites.find(s => s.kind === 'meat');
  assert.equal(restoredTrap.trap.beastG.visible, true);
  assert.equal(fb.bag.fruit, 4, 'restore does not consume bait again');
  assert.equal(fb.sites[0].seed, fa.sites[0].seed);
  assert.equal(fb.sites[0].cands.find(c => c.ok).grp.visible, false);
  fb.update(5); assert.equal(restoredTrap.trap.caught, true);
  assert.equal(fa.importState(copy(fb.exportState())), true); equalState(fa, fb);
  assert.equal(fa.sites.find(s => s.kind === 'meat').trap.stuck.visible, true);
  const bad = copy(fa.exportState()); bad.bag.fruit = -1; bad.bag.herb = Infinity; bad.bag.hack = 50; bad.found.hack = true;
  assert.equal(fa.importState(bad), true); assert.equal(fa.bag.fruit, 0); assert.equal(fa.bag.herb, 0); assert.equal(fa.bag.hack, undefined);
  const { buildKitchen } = await use('src/world/Kitchen.js');
  const landing = { dir: new THREE.Vector3(0, 0, 1) };
  const ka = buildKitchen(new THREE.Scene(), planet, landing, carpet, fb);
  const kb = buildKitchen(new THREE.Scene(), planet, landing, carpet, fb);
  ka.plates[0].key = 'fruit'; ka.plates[1].key = 'salt'; ka.plates[2].key = 'herb';
  ka.made.add('soup_forest');
  assert.equal(kb.importState(copy(ka.exportState())), true); equalState(ka, kb);
  assert.deepEqual(kb.plates.map(p => p.i), [1, 2, 3]);
  assert.ok(kb.plates.every(p => p.item.visible));
  kb.importState({ version: 1, made: ['hack'], plates: ['toString', 'meat_boar', 'fruit'] });
  assert.equal(kb.made.size, 0); assert.deepEqual(kb.plates.map(p => p.key), [null, null, 'fruit']);
  const { buildMapPage } = await use('src/ui/MapPage.js');
  const player = { position: new THREE.Vector3(68, 0, 0), heading: new THREE.Vector3(0, 0, -1) };
  const ma = buildMapPage(planet, player, { shrines: [] }, [], () => null);
  const before = canvases.length;
  const mb = buildMapPage(planet, player, { shrines: [] }, [], () => null);
  ma.setHas(true); ma.reveal(new THREE.Vector3(1, 0, 0)); ma.reveal(new THREE.Vector3(0, 0, 1));
  const priorMapDraws = canvases[before + 1].calls.draws;
  assert.equal(mb.importState(copy(ma.exportState())), true); equalState(ma, mb);
  assert.deepEqual(copy(ma.stats()), copy(mb.stats()));
  assert.equal(canvases[before + 1].calls.draws - priorMapDraws, ma.stats().seen, 'every restored seen cell is drawn on lit canvas');
  assert.equal(mb.importState({ version: 1, seen: [1] }), false); equalState(ma, mb);
  const wrongSeen = copy(ma.exportState()); wrongSeen.seen[0] = 2;
  assert.equal(mb.importState(wrongSeen), false); equalState(ma, mb);
  const result = { pass: true, modules: ['Lab', 'Forage', 'Kitchen', 'MapPage'],
    checks: ['lab real interaction and portal visuals', 'reseeded harvested site restore', 'bait is not charged twice',
      'approaching and caught trap visuals', 'invalid inventory rejected', 'kitchen plates and made recipes',
      'map 20000-cell roundtrip and canvas reconstruction', 'invalid map remains unchanged'], map: ma.stats() };
  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tmp/state-roundtrip.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
})().catch(e => { console.error(e); process.exitCode = 1; });
