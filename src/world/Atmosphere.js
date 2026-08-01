// 시간대(낮/노을/밤) 분위기 시스템 — 키프레임 lerp로 sky/fog/sun/hemi + 글로벌 틴트를 한 번에 구동.
import * as THREE from 'three';
import { TIME_KEYFRAMES } from '../data/palette.js';
import { tintUniforms } from '../rendering/Toon.js';

const _cA = new THREE.Color(), _cB = new THREE.Color();

// ACES 톤매핑을 켜면 중간톤이 눌려 전체가 어두워진다. 키프레임 값은 NoToneMapping 기준으로
// 튜닝돼 있으므로 여기서 한 번에 보정한다(키프레임 20여 개를 다시 손대지 않아도 되게).
const SUN_BOOST = 1.55, HEMI_BOOST = 1.4;

export class Atmosphere {
  constructor(engine, opts = {}) {
    this.engine = engine;
    this.dayLength = opts.dayLength ?? 300;  // 한 바퀴(초). 0이면 정지(수동).
    this.phase = opts.phase ?? 0.28;          // 시작=한낮
    this.kf = TIME_KEYFRAMES.slice().sort((a, b) => a.phase - b.phase);
    this.sky = null;                          // boot에서 주입(setSky)
    this.apply();
  }

  setSky(sky) { this.sky = sky; this.apply(); }
  setPhase(p) { this.phase = ((p % 1) + 1) % 1; this.apply(); }
  get timeName() { return this._name; }

  update(dt) {
    if (this.dayLength > 0) { this.phase = (this.phase + dt / this.dayLength) % 1; this.apply(); }
  }

  // 현재 phase를 감싸는 두 키프레임을 찾아 보간(끝→처음 wrap 포함).
  _bracket(p) {
    const kf = this.kf, n = kf.length;
    for (let i = 0; i < n; i++) {
      const a = kf[i], b = kf[(i + 1) % n];
      const pa = a.phase, pb = (i + 1 === n) ? b.phase + 1 : b.phase;
      const pp = (p < pa && i === 0) ? p + 1 : p;        // wrap 구간(마지막→처음) 처리
      if (pp >= pa && pp < pb) return { a, b, t: (pp - pa) / (pb - pa) };
    }
    return { a: kf[n - 1], b: kf[0], t: 0 };
  }

  apply() {
    const { a, b, t } = this._bracket(this.phase);
    this._name = t < 0.5 ? a.name : b.name;
    const e = this.engine, scene = e.scene;

    _cA.set(a.sky); _cB.set(b.sky); scene.background.copy(_cA.lerp(_cB, t));
    _cA.set(a.fog); _cB.set(b.fog); scene.fog.color.copy(_cA.lerp(_cB, t));
    _cA.set(a.sun); _cB.set(b.sun); e.sun.color.copy(_cA.lerp(_cB, t));
    e.sun.intensity = (a.sunI + (b.sunI - a.sunI) * t) * SUN_BOOST;
    _cA.set(a.hemiSky); _cB.set(b.hemiSky); e.hemi.color.copy(_cA.lerp(_cB, t));
    _cA.set(a.hemiGround); _cB.set(b.hemiGround); e.hemi.groundColor.copy(_cA.lerp(_cB, t));
    e.hemi.intensity = HEMI_BOOST;

    // 글로벌 틴트(전 세계 툰 머티리얼). 공유 유니폼 값만 갱신 → 한 프레임에 재채색.
    _cA.set(a.tint); _cB.set(b.tint); tintUniforms.uTint.value.copy(_cA.lerp(_cB, t));
    tintUniforms.uTintAmt.value = a.tintAmt + (b.tintAmt - a.tintAmt) * t;

    // 하늘(돔·별·구름)도 같은 키프레임으로 구동. Sky는 선택적 — 없으면 단색 배경만 남는다.
    if (this.sky) this.sky.applyPalette(a, b, t);
  }
}
