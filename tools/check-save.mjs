// Pure storage checks: node tools/check-save.mjs
import assert from 'node:assert/strict';
import { createSaveStore, parseSave, SAVE_KEY, BACKUP_KEY } from '../src/core/SaveGame.js';
const progress = {
  mode: 'planet', position: [136, 0, 0], heading: [0, 0, 1], cleared: ['balance'],
  lab: { version: 1, dials: [3, 5, 8] }, forage: { version: 1 },
  map: { version: 1 }, notebook: { version: 1 }, kitchen: { version: 1 },
};
const data = new Map();
const memory = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
const store = createSaveStore({ storage: () => memory, now: () => 1788796800000 });
assert.equal(store.read(), null); assert.equal(store.status, 'empty');
assert.equal(store.write(progress), true); assert.deepEqual(store.read().progress, progress);
const raw = data.get(SAVE_KEY);
assert.equal(store.archive(), true); assert.equal(data.get(BACKUP_KEY), raw); assert.equal(data.has(SAVE_KEY), false);
for (const broken of ['{', 'null', '{}', JSON.stringify({ ...JSON.parse(raw), version: 500 })]) assert.equal(parseSave(broken), null);
for (const field of ['lab', 'map', 'notebook', 'kitchen', 'forage']) {
  const broken = JSON.parse(raw); broken.progress[field].version = 20;
  assert.equal(parseSave(JSON.stringify(broken)), null);
}
for (const bad of [[NaN, 1, 2], [0, 0, 0], [1, 2], ['136', 0, 0]]) {
  assert.equal(store.write({ ...progress, position: bad }), false);
}
assert.equal(store.write({ ...progress, cleared: ['balance', 'balance'] }), false);
assert.equal(store.write({ ...progress, lab: { version: 1, dials: [1, -1, 8] } }), false);
data.set(SAVE_KEY, raw);
const blockedBackup = createSaveStore({ storage: () => ({ ...memory, setItem: () => { throw Error('quota'); } }) });
assert.equal(blockedBackup.archive(), false); assert.equal(data.get(SAVE_KEY), raw);
assert.equal(blockedBackup.write(progress), false); assert.equal(data.get(SAVE_KEY), raw);
const denied = createSaveStore({ storage: () => { throw Error('disabled'); } });
assert.equal(denied.read(), null); assert.equal(denied.status, 'unavailable');
assert.equal(denied.write(progress), false); assert.equal(denied.archive(), false);
data.set(SAVE_KEY, 'broken'); assert.equal(store.read(), null); assert.equal(store.status, 'invalid');
assert.equal(data.get(SAVE_KEY), 'broken');
console.log('PASS save roundtrip, backup, invalid JSON/version/vector/dials, unavailable storage, quota preserves original');
