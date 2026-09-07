// 화질 단수 — **칠하는 픽셀을 줄인다.**
//
// ★ 렉의 정체는 폴리곤이 아니라 픽셀이었다. 태블릿(1024×768, dpr 2 → 2048×1536)에서
//   한 프레임에 이만큼 칠하고 있었다(실측).
//
//     씬 3.15 · 외곽선 3.15 · 블룸 3.67 · 그레이드 3.15 · 출력 3.15  = 16.25 Mpx
//     그림자맵 2048² = 4.19 Mpx (깊이, PCFSoft)
//
//   화면 한 장이 3.15 Mpx다. 한 프레임에 **화면을 다섯 번 넘게 칠하고 있었다.**
//   같은 프레임의 그리기 호출은 613번, 삼각형은 731,515개였다.
//   그런데 게임 로직(step)은 프레임당 0.16ms다 — CPU는 놀고 GPU만 타고 있었다.
//
// ★ 그래서 손잡이는 해상도다. 픽셀은 배율의 **제곱**으로 는다.
//   dpr 2 → 1.4면 픽셀이 49%가 되고, 위의 다섯 항목이 **전부** 반으로 준다.
//   폴리곤을 한 개도 안 지우고 절반을 버는 유일한 손잡이다.
//
// ★ 기기를 못 믿는다. 학교 태블릿은 성능이 천차만별이고 이름으로는 못 가른다.
//   그래서 **손가락 기기는 한 단 내려서 시작**하고, 그래도 느리면 **스스로 더 내린다**.
//   올리지는 않는다 — 오르내리면 화면이 출렁여서 느린 것보다 나쁘다.

// scale   픽셀비 상한(화면 배율)      bloom  블룸 해상도 배수(0이면 끔)
// outline 외곽선 2차 패스             shadow 그림자맵 한 변(0이면 그림자 끔)
const TIERS = {
  high: { scale: 2.0,  bloom: 1.0, outline: true,  shadow: 2048, soft: true },
  mid:  { scale: 1.4,  bloom: 0.5, outline: true,  shadow: 1024, soft: false },
  low:  { scale: 1.0,  bloom: 0,   outline: true,  shadow: 1024, soft: false },
  min:  { scale: 0.8,  bloom: 0,   outline: false, shadow: 0,    soft: false },
};
export const TIER_NAMES = ['high', 'mid', 'low', 'min'];
// 화면에 내보내는 이름. **해요체를 쓰지 않는다**(검사 K의 규칙 — 이 게임에서
// 해요체로 말하는 사람은 없다). 설정 화면도 같은 규칙을 따른다.
export const TIER_LABELS = { high: '높음', mid: '중간', low: '낮음', min: '가장 낮음' };

// 손가락이 붙어 있는 기기인가. TouchControls와 **같은 판정**을 쓴다 —
// 판정을 둘로 나누면 한쪽만 고쳐지는 날이 온다.
const isTouch = () => (navigator.maxTouchPoints || 0) > 0
  && matchMedia('(any-pointer: coarse)').matches;

// 손으로 고를 수 있어야 한다. 교실에서 한 대만 느릴 때 그 대만 내린다.
//   ?q=low   주소로 한 번   ·   localStorage 'mumu.q'  다음에도 계속
function pinned() {
  try {
    const u = new URLSearchParams(location.search).get('q');
    if (u && TIERS[u]) { localStorage.setItem('mumu.q', u); return u; }
    const s = localStorage.getItem('mumu.q');
    if (s && TIERS[s]) return s;
  } catch (e) { /* 사생활 보호 창에서는 storage가 던진다 — 조용히 넘어간다 */ }
  return null;
}

// 이 기기에 맞는 기본값. '자동'으로 되돌릴 때 여기로 온다.
export const deviceDefault = isTouch() ? 'mid' : 'high';

let name = pinned() || deviceDefault;
let forced = !!pinned();          // 손으로 고른 것은 자동으로 안 내린다
const listeners = [];
const resets = [];                // 자동 판정기의 상태를 비우는 손잡이들

export const quality = {
  get name() { return name; },
  get forced() { return forced; },
  get(k) { return TIERS[name][k]; },
  get all() { return { ...TIERS[name] }; },
  // 화면 배율 — devicePixelRatio를 단수 상한으로 자른다
  get pixelRatio() { return Math.min(devicePixelRatio || 1, TIERS[name].scale); },
  onChange(fn) { listeners.push(fn); },
  set(n) {
    if (!TIERS[n] || n === name) return false;
    name = n;
    for (const fn of listeners) fn(TIERS[name], name);
    return true;
  },
  // 한 단 내린다. 더 내릴 데가 없으면 false.
  stepDown() {
    const i = TIER_NAMES.indexOf(name);
    return i >= 0 && i < TIER_NAMES.length - 1 ? this.set(TIER_NAMES[i + 1]) : false;
  },
  // 손으로 고정(설정 저장). 자동 내림이 멈춘다.
  pin(n) {
    if (!TIERS[n]) return false;
    forced = true;
    try { localStorage.setItem('mumu.q', n); } catch (e) { /* 무시 */ }
    return this.set(n) || n === name;
  },
  // '자동'으로 되돌린다 — 저장을 지우고 기기 기본값으로 가고, 다시 스스로 내려간다.
  // ★ 판정기의 창(窓)도 비운다. 안 비우면 아까 고정하기 전에 모아 둔 느린 프레임이
  //   남아 있다가 자동으로 바꾸자마자 한 단 떨어뜨린다.
  auto() {
    forced = false;
    try { localStorage.removeItem('mumu.q'); } catch (e) { /* 무시 */ }
    for (const r of resets) r();
    this.set(deviceDefault);
    return true;
  },
};

// ── 스스로 내려가기 ─────────────────────────────────────────────────────────
// ★ 한두 프레임 튀는 것으로 내리면 안 된다. 로딩 직후·씬 전환은 원래 튄다.
//   창을 하나 채워서 **중앙값**을 보고, 그게 기준을 넘을 때만 내린다.
//   그리고 내린 뒤에는 한동안 안 본다 — 방금 바꾼 프레임이 또 튀기 때문이다.
const WINDOW = 90;              // 이만큼 모아서 한 번 판단(≈1.5초)
const SLOW_MS = 26;             // 중앙값이 이보다 느리면 내린다(≈38fps 아래)
const COOLDOWN = 120;           // 내린 뒤 이만큼은 안 본다

export function makeAutoQuality(onStep) {
  const buf = [];
  let cool = 60;                // 시작 직후는 건너뛴다(로딩·컴파일로 반드시 튄다)
  resets.push(() => { buf.length = 0; cool = COOLDOWN; });
  return function sample(dtMs) {
    if (forced) return;
    if (cool > 0) { cool--; return; }
    buf.push(dtMs);
    if (buf.length < WINDOW) return;
    buf.sort((a, b) => a - b);
    const med = buf[buf.length >> 1];
    buf.length = 0;
    if (med > SLOW_MS && quality.stepDown()) {
      cool = COOLDOWN;
      if (onStep) onStep(quality.name, +med.toFixed(1));
    }
  };
}
