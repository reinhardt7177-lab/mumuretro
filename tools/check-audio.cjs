// Run: node tools/check-audio.cjs
// Media and animation time are isolated mocks; no speaker, browser or network is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
let now = 0, next = 0;
const frames = new Map(), elements = [], saved = new Map();
globalThis.performance = { now: () => now };
globalThis.requestAnimationFrame = callback => { const id = ++next; frames.set(id, callback); return id; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
globalThis.window = {};
globalThis.Audio = class {
  constructor(url) { this.src = url; this.paused = true; this.listeners = {}; elements.push(this); }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  removeEventListener(name) { delete this.listeners[name]; }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() {}
};
function at(time) {
  now = time;
  const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn());
}
(async () => {
  const audioUrl = pathToFileURL(path.join(root, 'src/core/Audio.js')).href;
  const A = await import(audioUrl);
  A.bgm('first.mp3', 0.7); at(500);
  assert.equal(elements[0].volume, 0.35 * 500 / 1400);
  A.bgm('second.mp3', 0.4); at(600);
  assert.ok(elements[0].volume > 0 && elements[1].volume > 0, 'both tracks overlap before mute');
  A.setMuted(true);
  assert.ok(elements.every(el => el.volume === 0 && el.muted), 'immediate mute includes previous track');
  at(750); assert.ok(elements.every(el => el.volume === 0), 'fade must not restore sound');
  at(2200); assert.equal(elements[0].paused, true); assert.equal(elements[1].volume, 0);
  A.setMuted(false); assert.equal(elements[1].volume, 0.2, 'restore original custom volume');
  A.bgm('second.mp3', 0.8); assert.equal(elements.length, 2); assert.equal(elements[1].volume, 0.4);
  A.bgm('third.mp3'); at(2300); A.bgm('fourth.mp3'); at(2400); A.bgm(null); at(4000);
  assert.ok(elements.every(el => el.paused), 'rapid transitions release all tracks');
  assert.equal(frames.size, 0, 'no orphan animation callbacks');
  A.setMuted(true);
  const reloaded = await import(audioUrl + '?reload');
  assert.equal(reloaded.isMuted(), true, 'preference survives module reload');
  globalThis.localStorage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const blocked = await import(audioUrl + '?blocked');
  assert.equal(blocked.isMuted(), false); blocked.setMuted(true);
  const { SCENE_MUSIC } = await import(pathToFileURL(path.join(root, 'src/data/music.js')).href);
  assert.equal(Object.keys(SCENE_MUSIC).length, 9);
  assert.ok(Object.values(SCENE_MUSIC).every(file => fs.existsSync(path.join(root, file))), 'all scene assets exist');
  for (const scene of Object.keys(SCENE_MUSIC)) A.sceneBgm(scene);
  A.sceneBgm('toString'); assert.equal(elements.at(-1).src, SCENE_MUSIC.planet, 'unknown scene safely falls back');
  A.bgm(null); at(5600);
  assert.equal(frames.size, 0);
  const result = { pass: true, checks: ['crossfade immediate mute', 'mute throughout fades',
    'custom volume restoration', 'rapid transition cleanup', 'persistent mute',
    'storage-denied fallback', 'nine scene mappings and unknown scene fallback'], pendingFrames: frames.size };
  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tmp/audio-check.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; });
