// 서사 컨트롤러 — 얇게. 문자열은 data/story.js, 표시는 주입받은 toast/오버레이가 한다.
//
// boot.js를 import하지 않는다(순환 방지). 필요한 것은 전부 생성자로 주입받는다.
//
// 절제 원칙:
//  - 유령 16명 전원에게 말을 붙이면 재앙이므로 반경·쿨다운·상황 조건을 전부 AND로 건다
//  - 아이가 헤매는 중(오답 연속)이거나 시련 중이면 글자를 더하지 않는다
//  - 대사는 분기하지 않고 전역 인덱스 하나로 순차 소비 — 누구를 만나든 순서대로 쌓인다
import * as THREE from 'three';
import {
  STORY_KEY, INTRO, GHOST_LINES, TRIAL_BEATS, MIST_ENTER, DOKKAEBI_FIRST, ENDING,
} from '../data/story.js';

const GHOST_TALK_R = 9;      // 대사 반경(월드). 이모지 반경 20.4u보다 훨씬 좁게
const GHOST_LABEL_R = 14;    // 이름표 표시 반경
const TALK_COOLDOWN = 70;    // 전역 쿨다운(초)

export class Story {
  // deps: { toast, planet, scene, makeSign }
  //   makeSign(text, style) → { tex, aspect }  (Learning.js의 signTexture 재사용)
  constructor(deps) {
    this.toast = deps.toast;
    this.planet = deps.planet;
    this.makeSign = deps.makeSign;

    const s = this._load();
    this.introShown = !!s.introShown;
    this.lineIdx = s.lineIdx || 0;          // 다음에 나갈 유령 대사 인덱스
    this.beatsFired = new Set(s.beatsFired || []);
    this.endingShown = !!s.endingShown;

    this.spokenGhosts = new Set();          // 세션 한정 — 같은 유령이 계속 말하지 않게
    this._cool = 12;                        // 시작 직후 바로 말 걸지 않도록 여유

    // 이름표는 공유 스프라이트 1개. 16개를 만들지 않는다.
    this.label = null;
    this._labelFor = null;
    if (deps.scene) {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
      mat.userData.outlineParameters = { visible: false };
      this.label = new THREE.Sprite(mat);
      this.label.visible = false;
      this.label.renderOrder = 5;
      deps.scene.add(this.label);
    }
  }

  _load() { try { return JSON.parse(localStorage.getItem(STORY_KEY) || '{}') || {}; } catch (e) { return {}; } }
  _save() {
    try {
      localStorage.setItem(STORY_KEY, JSON.stringify({
        introShown: this.introShown, lineIdx: this.lineIdx,
        beatsFired: [...this.beatsFired], endingShown: this.endingShown,
      }));
    } catch (e) { /* 무시 */ }
  }

  // 이야기 토스트는 게임 피드백과 색이 달라야 한다 — "이건 문제가 아니라 이야기"
  _say(msg, ms = 3400) { this.toast(msg, ms, 'story'); }

  // ── 인트로 ──────────────────────────────────────────────────────────────
  needsIntro() { return !this.introShown; }
  markIntroShown() { this.introShown = true; this._save(); }

  // ── 유령 ────────────────────────────────────────────────────────────────
  // ghosts: [{ id, name, position }]  (boot의 GhostMessenger Map values)
  // ctx: { trialActive, wrongStreak, camera }
  ghostTick(dt, playerPos, ghosts, ctx = {}) {
    this._cool -= dt;

    // 최근접 유령 찾기
    let near = null, nd = Infinity;
    for (const gm of ghosts) {
      const d = playerPos.angleTo(gm.position) * this.planet.R;
      if (d < nd) { nd = d; near = gm; }
    }

    // 이름표 — 반경 안 최근접 1명만
    if (this.label) {
      if (near && nd < GHOST_LABEL_R) {
        if (this._labelFor !== near) { this._labelFor = near; this._setLabel(near.name); }
        this.label.position.copy(near.position).addScaledVector(near.up, 2.5);
        if (ctx.camera) {
          const s = 1.0;
          this.label.scale.set(s * this._labelAspect, s, 1);
        }
        this.label.visible = true;
      } else {
        this.label.visible = false;
        this._labelFor = null;
      }
    }

    // 대사 — 조건 전부 AND
    if (!near || nd >= GHOST_TALK_R) return null;
    if (this.lineIdx >= GHOST_LINES.length) return null;   // 소진 후 영구 침묵
    if (this.spokenGhosts.has(near.name)) return null;
    if (this._cool > 0) return null;
    if (ctx.trialActive) return null;                      // 시련 중엔 침묵
    if (ctx.wrongStreak > 0) return null;                  // 헤매는 중엔 글자를 더하지 않는다

    const line = GHOST_LINES[this.lineIdx];
    this.lineIdx++;
    this.spokenGhosts.add(near.name);
    this._cool = TALK_COOLDOWN;
    this._save();
    this._say(`🕯️ ${near.name} — "${line}"`, 4000);
    return line;
  }

  _setLabel(name) {
    if (!this.makeSign || !this.label) return;
    const old = this.label.material.map;
    const { tex, aspect } = this.makeSign(`옛 집배원 · ${name}`, {
      bg: '#dfe8f5', border: '#7a8bb5', fontPx: 36,
    });
    this.label.material.map = tex;
    this.label.material.needsUpdate = true;
    this._labelAspect = aspect;
    if (old) old.dispose();
  }

  // ── 진행 비트 ───────────────────────────────────────────────────────────
  onTrialClear(clearedCount) {
    const line = TRIAL_BEATS[clearedCount];
    if (!line || this.beatsFired.has('t' + clearedCount)) return false;
    this.beatsFired.add('t' + clearedCount);
    this._save();
    setTimeout(() => this._say(line), 1200);   // 기존 클리어 토스트 뒤로 흘린다
    return true;
  }

  onValleyEnter() {
    if (this.beatsFired.has('mist')) return false;
    this.beatsFired.add('mist');
    this._save();
    this._say(MIST_ENTER);
    return true;
  }

  // 도깨비 최초 포획에만. 재진입 시 재스폰되므로 호출부에서 count===1 게이트 필수.
  onDokkaebiFirst() {
    if (this.beatsFired.has('dok')) return false;
    this.beatsFired.add('dok');
    this._save();
    DOKKAEBI_FIRST.forEach((l, i) => setTimeout(() => this._say(l), 1200 + i * 2600));
    return true;
  }

  // ── 엔딩 ────────────────────────────────────────────────────────────────
  needsEnding() { return !this.endingShown; }
  markEndingShown() { this.endingShown = true; this._save(); }

  // ── 검증용 ──────────────────────────────────────────────────────────────
  state() {
    return {
      introShown: this.introShown,
      ghostLine: `${this.lineIdx}/${GHOST_LINES.length}`,
      beats: [...this.beatsFired],
      endingShown: this.endingShown,
      cooldown: +Math.max(0, this._cool).toFixed(1),
      labelFor: this._labelFor ? this._labelFor.name : null,
    };
  }
  reset() {
    this.introShown = false; this.lineIdx = 0;
    this.beatsFired.clear(); this.endingShown = false;
    this.spokenGhosts.clear(); this._cool = 0;
    this._save();
    return 'story reset';
  }
}

export { INTRO, ENDING };
