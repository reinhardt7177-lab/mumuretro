// 소리 — 효과음은 신스(0바이트), 배경음악은 파일.
//
// ★ 이 게임은 **완전한 무음**이었다. 이 파일의 옛 신스(beep·chime·pickup)는
//   어디서도 안 불렸고 assets의 mp3는 예전 판의 것이었다. 구슬을 얻어도,
//   신이 눈을 떠도, 요리가 되어도 아무 소리가 안 났다.
//
// 지킬 것
//   1. **없어도 게임은 돈다.** 브라우저가 오디오를 막든, mp3가 404든, 학교 망이
//      끊든 — 조용해질 뿐 한 줄도 던지지 않는다. 폰트 CDN이 막히는 곳이 있었고
//      (검사 M) 소리도 같은 취급을 받아야 한다.
//   2. **첫 제스처 뒤에만 켠다.** 브라우저 정책이고, 마침 시작 화면의
//      "화면을 눌러 시작"이 그 제스처다. 자연스럽게 맞아떨어진다.
//   3. **끌 수 있어야 한다.** 교실에서 스무 대가 동시에 울리면 이건 못 쓴다.
//   4. **한 프레임에 같은 소리가 겹치지 않는다.** cool(ms)로 막는다 — 안 막으면
//      판정이 매 프레임 도는 곳에서 소리가 톱니처럼 쌓인다.
import { SFX } from '../data/sfx.js';
import { SCENE_MUSIC } from '../data/music.js';

let ac = null, master = null, sfxGain = null, bgmGain = null;
export const AUDIO_SETTINGS_KEY = 'mumuplanet.audio.muted.v1';
let muted = false, ready = false;
try { muted = localStorage.getItem(AUDIO_SETTINGS_KEY) === 'true'; } catch (e) { /* 저장이 막혀도 재생 가능 */ }
const last = {};                 // 소리별 마지막 재생 시각(ms)
let bgmTrack = null, bgmUrl = null;
const tracks = new Set();        // 전환 중인 이전 음악도 음소거를 함께 적용한다.

// 첫 제스처에서 부른다. 그 전에는 아무것도 만들지 않는다.
export function startAudio() {
  if (ready) { resume(); retryMusic(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { retryMusic(); return; }
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 1;
    sfxGain = ac.createGain(); sfxGain.gain.value = 0.9;
    bgmGain = ac.createGain(); bgmGain.gain.value = 0.55;
    sfxGain.connect(master); bgmGain.connect(master); master.connect(ac.destination);
    ready = true;
  } catch (e) { /* 오디오 없는 기기 — 조용히 넘어간다 */ }
  resume();
  retryMusic();
}

function resume() {
  if (ac && ac.state === 'suspended') {
    try { ac.resume()?.catch(() => {}); } catch (e) { /* 무시 */ }
  }
}

// ── 잡음 — 종이·모래·물·바위는 전부 여기서 나온다 ──────────────────────────
let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    const n = Math.floor(ac.sampleRate * 1.5);
    noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ac.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  return s;
}

function env(g, t, at, a, d, v) {
  g.gain.setValueAtTime(0.0001, t + at);
  g.gain.linearRampToValueAtTime(Math.max(0.0002, v), t + at + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + at + d);
}

// 효과음 하나. 이름이 표에 없으면 아무 일도 안 한다(오타가 게임을 안 멈춘다).
export function sfx(name, gain = 1) {
  const spec = SFX[name];
  if (!spec || !ready || muted) return;
  const now = performance.now();
  if (last[name] && now - last[name] < (spec.cool || 0)) return;
  last[name] = now;
  resume();
  try {
    const t = ac.currentTime, vol = spec.vol * gain;
    for (const o of spec.osc || []) {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = o.w || 'sine';
      const at = o.at || 0;
      osc.frequency.setValueAtTime(o.f, t + at);
      if (o.f2 && o.f2 !== o.f) osc.frequency.exponentialRampToValueAtTime(o.f2, t + at + o.d);
      env(g, t, at, o.a || 0.005, o.d, vol * (o.v == null ? 1 : o.v));
      osc.connect(g).connect(sfxGain);
      osc.start(t + at); osc.stop(t + at + o.d + 0.03);
    }
    const n = spec.noise;
    if (n) {
      const src = noise(), g = ac.createGain();
      let node = src;
      if (n.hp) { const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = n.hp; node.connect(f); node = f; }
      if (n.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = n.lp; node.connect(f); node = f; }
      const at = n.at || 0;
      env(g, t, at, n.at != null && n.at > 0 ? 0.08 : 0.004, n.d, vol * (n.v == null ? 1 : n.v));
      node.connect(g).connect(sfxGain);
      src.start(t + at); src.stop(t + at + n.d + 0.03);
    }
  } catch (e) { /* 재생 실패는 조용히 */ }
}

// ── 배경음악 — 파일. 없으면 조용할 뿐이다 ──────────────────────────────────
// ★ <audio>로 스트리밍한다. decodeAudioData로 통째로 받으면 2MB짜리가 다 받아질
//   때까지 소리가 안 나고, 그 사이 시작 화면은 이미 지나간다.
export function bgm(url, vol = 1) {
  const volume = Math.max(0, Math.min(1, Number.isFinite(vol) ? 0.5 * vol : 0.5));
  if (bgmUrl === url && bgmTrack) {
    bgmTrack.volume = volume;
    applyVolume(bgmTrack);
    retryMusic();
    return;
  }
  const old = bgmTrack;
  bgmTrack = null; bgmUrl = null;
  if (old) fade(old, 0, 700);
  if (!url) return;
  try {
    const el = new Audio(url);
    const track = { el, volume, level: 0, frame: 0, onError: null };
    el.loop = true; el.preload = 'auto';
    track.onError = () => release(track);
    el.addEventListener('error', track.onError);
    tracks.add(track);
    bgmTrack = track; bgmUrl = url;
    applyVolume(track);
    play(track);
    fade(track, 1, 1400);
  } catch (e) { /* 오디오 생성 실패도 게임을 막지 않는다. */ }
}

// 파일명을 장면 이름으로 추측하지 않는다. 아직 전용 음악이 없는 사당은 표에서 고른다.
export function sceneBgm(id, vol = 1) {
  const url = Object.hasOwn(SCENE_MUSIC, id) ? SCENE_MUSIC[id] : SCENE_MUSIC.planet;
  bgm(id == null ? null : url, vol);
}

function play(track) {
  try { track.el.play()?.catch(() => {}); } catch (e) { /* 첫 제스처에서 재시도 가능 */ }
}
function retryMusic() {
  if (bgmTrack?.el.paused) play(bgmTrack);
}
function applyVolume(track) {
  try {
    // muted는 브라우저의 실제 차단 장치, volume도 0으로 유지해 상태와 재생을 일치시킨다.
    track.el.muted = muted;
    track.el.volume = muted ? 0 : track.volume * track.level;
  } catch (e) { /* 재생할 수 없는 미디어는 조용히 */ }
}
function release(track) {
  if (track.frame) cancelAnimationFrame(track.frame);
  tracks.delete(track);
  if (bgmTrack === track) { bgmTrack = null; bgmUrl = null; }
  try {
    track.el.removeEventListener('error', track.onError);
    track.el.pause();
    track.el.removeAttribute('src');
    track.el.load();
  } catch (e) { /* 정리 실패는 무시 */ }
}
function fade(track, to, ms) {
  if (track.frame) cancelAnimationFrame(track.frame);
  const from = track.level, t0 = performance.now();
  const step = () => {
    if (!tracks.has(track)) return;
    const k = Math.min(1, (performance.now() - t0) / ms);
    track.level = from + (to - from) * k;
    applyVolume(track);             // 매 프레임 현재 음소거 상태를 적용한다.
    if (k < 1) track.frame = requestAnimationFrame(step);
    else if (to === 0) release(track);
    else track.frame = 0;
  };
  track.frame = requestAnimationFrame(step);
}

export function setMuted(v) {
  muted = !!v;
  if (master) master.gain.value = muted ? 0 : 1;
  for (const track of tracks) applyVolume(track);
  try { localStorage.setItem(AUDIO_SETTINGS_KEY, String(muted)); } catch (e) { /* 현재 세션에서는 적용 */ }
  return muted;
}
export function isMuted() { return muted; }
export function audioReady() { return ready; }
