// 최소 오디오 — Web Audio 신스(배달 차임·픽업). 발소리/앰비언트는 M5에서 확장. town.html:324 패턴.
let ac = null;

export function resumeAudio() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { /* 오디오 미지원 무시 */ }
}

export function beep(freq, wave = 'sine', dur = 0.15, vol = 0.2, attack = 0.01) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = wave; o.frequency.value = freq;
  const t = ac.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

// 배달 완료 차임 — 따뜻한 상승 장3화음
export function chime() {
  resumeAudio();
  if (!ac) return;
  const now = ac.currentTime;
  [523.25, 659.25, 783.99].forEach((f, i) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t = now + i * 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + 0.45);
  });
}

// 소포 픽업/배정 — 부드러운 두 음
export function pickup() {
  resumeAudio();
  beep(660, 'triangle', 0.12, 0.12, 0.01);
  setTimeout(() => beep(880, 'triangle', 0.12, 0.12, 0.01), 70);
}

// 발소리 — 부드러운 저음 thud
export function footstep() {
  if (!ac) return;
  beep(86 + Math.random() * 22, 'sine', 0.09, 0.07, 0.004);
}

// ── 배경음악(BGM) — 잔잔하게 루프. 자동재생 정책상 첫 제스처에 start. ──
let bgm = null, bgmVol = 0.32, bgmOn = true;
export function startBGM(url, vol = bgmVol) {
  bgmVol = vol;
  if (!bgm) {
    bgm = new Audio(url);
    bgm.loop = true;
    bgm.volume = 0;          // 부드럽게 페이드 인
    bgm.preload = 'auto';
  }
  if (!bgmOn) return;
  const p = bgm.play();
  if (p && p.catch) p.catch(() => { /* 제스처 전 차단 무시 */ });
  // 0 → bgmVol 페이드 인
  const t0 = performance.now();
  const fade = () => {
    const k = Math.min(1, (performance.now() - t0) / 1500);
    bgm.volume = bgmVol * k;
    if (k < 1 && bgmOn) requestAnimationFrame(fade);
  };
  requestAnimationFrame(fade);
}
export function toggleBGM() {
  bgmOn = !bgmOn;
  if (bgm) { if (bgmOn) { bgm.play().catch(() => {}); bgm.volume = bgmVol; } else { bgm.pause(); } }
  return bgmOn;
}
export function isBGMOn() { return bgmOn; }
