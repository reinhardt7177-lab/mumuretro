// 배지 — 우표(문제 1개)보다 큰 단위의 이정표.
//
// 설계 근거: 아이들은 플레이 중에는 보상 시스템을 거의 보지 않고 세션 끝 요약에서 집중해서 본다.
// 그래서 배지는 획득 순간에 조용히 토스트만 띄우고, 진짜 무대는 세션 요약 화면이다.
//
// 가장 중요한 건 '오답 극복' 계열이다. 틀린 것을 다시 맞히는 행위 자체에 보상을 주면
// 아이가 틀리는 걸 두려워하지 않게 된다. 학습 앱에서 이게 핵심이라고 본다.

const KEY = 'mumu_badges_v1';

export const BADGES = [
  // ── 끈기(가장 중요) ──
  { id: 'comeback1',  emoji: '💪', name: '다시 도전!',     desc: '틀렸던 문제를 맞혔어요',        test: s => s.comebacks >= 1 },
  { id: 'comeback5',  emoji: '🔥', name: '포기하지 않아',   desc: '틀렸던 문제 5개를 다시 맞혔어요', test: s => s.comebacks >= 5 },
  { id: 'comeback15', emoji: '🦁', name: '끈기의 집배원',   desc: '틀렸던 문제 15개를 다시 맞혔어요', test: s => s.comebacks >= 15 },

  // ── 배달량 ──
  { id: 'first',  emoji: '🌟', name: '첫 배달',      desc: '첫 문제를 맞혔어요',       test: s => s.totalCorrect >= 1 },
  { id: 'ten',    emoji: '📬', name: '열 통 배달',    desc: '10문제를 맞혔어요',        test: s => s.totalCorrect >= 10 },
  { id: 'fifty',  emoji: '🏤', name: '우체국장',      desc: '50문제를 맞혔어요',        test: s => s.totalCorrect >= 50 },
  { id: 'goal',   emoji: '🎯', name: '오늘의 목표',   desc: '하루 목표를 달성했어요',    test: s => s.goalsMet >= 1 },
  { id: 'goal7',  emoji: '📆', name: '일주일 개근',   desc: '목표를 7번 달성했어요',     test: s => s.goalsMet >= 7 },

  // ── 실력 ──
  { id: 'streak5',  emoji: '✨', name: '연속 5문제',   desc: '연속으로 5문제를 맞혔어요', test: s => s.bestStreak >= 5 },
  { id: 'streak10', emoji: '💫', name: '연속 10문제',  desc: '연속으로 10문제를 맞혔어요', test: s => s.bestStreak >= 10 },
  { id: 'master1',  emoji: '🎓', name: '과목 하나 완성', desc: '한 과목을 모두 익혔어요',  test: s => s.masteredSubjects >= 1 },

  // ── 탐험 ──
  { id: 'explorer', emoji: '🗺️', name: '탐험가',       desc: '7개 구역을 모두 찾았어요',   test: s => s.regionsFound >= 7 },
  { id: 'summit',   emoji: '⛰️', name: '별빛 언덕 정상', desc: '행성에서 가장 높은 곳에 올랐어요', test: s => !!s.summit },
  { id: 'jumper',   emoji: '🦘', name: '깡충깡충',      desc: '100번 점프했어요',          test: s => s.jumps >= 100 },

  // ── 이야기 ──
  // 서사의 유일한 영구 산출물. 도감에 남고 세션 요약에도 자동으로 등장한다.
  { id: 'lastLetter', emoji: '💌', name: '마지막 편지', desc: '잊혀진 우체국에 편지를 전했어요', test: s => !!s.lastLetter },
];

const EMPTY = {
  totalCorrect: 0, totalWrong: 0, comebacks: 0, bestStreak: 0,
  goalsMet: 0, regionsFound: 0, masteredSubjects: 0, summit: false, jumps: 0,
};

export class Badges {
  constructor(opts = {}) {
    this.onEarn = opts.onEarn || (() => {});
    const saved = this._load();
    this.earned = new Set(saved.earned || []);
    this.stats = { ...EMPTY, ...(saved.stats || {}) };
    // 한 번이라도 틀린 적 있는 문제 — '오답 극복' 판정에 쓴다.
    this.everWrong = new Set(saved.everWrong || []);
    this.streak = 0;
  }

  _load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  _save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        earned: [...this.earned], stats: this.stats, everWrong: [...this.everWrong],
      }));
    } catch (e) { /* 무시 */ }
  }

  has(id) { return this.earned.has(id); }
  count() { return this.earned.size; }
  total() { return BADGES.length; }

  // 조건을 만족했는데 아직 없는 배지를 수여. 새로 얻은 것만 반환.
  evaluate() {
    const fresh = [];
    for (const b of BADGES) {
      if (this.earned.has(b.id)) continue;
      let ok = false;
      try { ok = !!b.test(this.stats); } catch (e) { ok = false; }
      if (ok) { this.earned.add(b.id); fresh.push(b); }
    }
    if (fresh.length) { this._save(); for (const b of fresh) this.onEarn(b); }
    return fresh;
  }

  // 문제 채점 결과 반영. comeback = 예전에 틀렸던 문제를 맞힌 경우.
  onAnswer(questionId, correct) {
    let comeback = false;
    if (correct) {
      this.stats.totalCorrect++;
      this.streak++;
      if (this.streak > this.stats.bestStreak) this.stats.bestStreak = this.streak;
      if (this.everWrong.has(questionId)) {
        this.everWrong.delete(questionId);      // 극복했으니 목록에서 뺀다(중복 적립 방지)
        this.stats.comebacks++;
        comeback = true;
      }
    } else {
      this.stats.totalWrong++;
      this.streak = 0;
      this.everWrong.add(questionId);
    }
    this._save();
    return { comeback, fresh: this.evaluate() };
  }

  // 외부에서 갱신되는 지표(구역 발견 수, 마스터한 과목 수, 정상 등정, 점프 수 등).
  setStat(key, value) {
    if (this.stats[key] === value) return [];
    this.stats[key] = value;
    this._save();
    return this.evaluate();
  }
  bumpStat(key, by = 1) { return this.setStat(key, (this.stats[key] || 0) + by); }

  // 도감 옆 배지 탭 렌더.
  renderInto(el) {
    if (!el) return;
    el.innerHTML = '';
    for (const b of BADGES) {
      const got = this.earned.has(b.id);
      const d = document.createElement('div');
      d.className = 'badge' + (got ? ' got' : '');
      d.innerHTML = got
        ? `<div class="bic">${b.emoji}</div><div class="bnm">${b.name}</div><div class="bds">${b.desc}</div>`
        : `<div class="bic">🔒</div><div class="bnm">？？？</div><div class="bds">${b.desc}</div>`;
      el.appendChild(d);
    }
  }
}
