// 전면 화면 — 세션 요약 · 인트로 · 엔딩.
//
// 셋 다 "게임을 잠깐 멈추고 읽는 화면"이고 CSS도 공유한다. 한곳에 모아 두면
// 문구와 리듬을 같이 손볼 수 있다. boot.js에 있을 때는 배선 코드 사이에 끼어 있어서
// 요약 화면 문구 하나 고치려고 조립 코드를 스크롤해야 했다.
//
// 상태를 만들지 않는다 — session·badges·learning의 현재값을 읽어 그릴 뿐이다.
export function createScreens(deps) {
  const { session, badges, learning, story, curricula, dailyGoal,
          INTRO, ENDING, toast, resumeAudio } = deps;
  const CURRICULA = curricula, DAILY_GOAL = dailyGoal;

  // ── 세션 요약 ────────────────────────────────────────────────────────────
  // 리서치상 아이들이 보상에 집중하는 건 플레이 중이 아니라 "끝나고 보는 화면"이다.
  // 그래서 배지의 진짜 무대는 여기다.
  const summaryEl = document.getElementById('summary');
  function showSummary() {
    if (!summaryEl) return;
    const total = session.correct + session.wrong;
    const acc = total ? Math.round(100 * session.correct / total) : 0;
    document.getElementById('sumSub').textContent =
      `오늘 목표 ${DAILY_GOAL}통을 모두 배달했어요!`;

    const st = (v, k) => `<div class="st"><div class="v">${v}</div><div class="k">${k}</div></div>`;
    document.getElementById('sumStats').innerHTML =
      st(session.correct, '맞힌 문제') + st(acc + '%', '정답률') +
      st(session.comebacks, '다시 도전 성공') + st(badges.count() + '/' + badges.total(), '배지');

    // 이번 세션에 새로 얻은 배지 — 중복 제거
    const seen = new Set(), fresh = [];
    for (const b of session.newBadges) { if (!seen.has(b.id)) { seen.add(b.id); fresh.push(b); } }
    document.getElementById('sumNew').innerHTML = fresh.length
      ? fresh.map((b, i) => `<div class="nb" style="animation-delay:${i * 0.12}s"><div class="e">${b.emoji}</div><div class="n">${b.name}</div></div>`).join('')
      : '';

    // 과목별 진도
    if (learning) {
      document.getElementById('sumSubjects').innerHTML = CURRICULA.map(c => {
        const done = c.questions.filter(q => learning.boxOf(q.id) >= 3).length;
        const pct = Math.round(100 * done / c.questions.length);
        return `${c.emoji} ${c.subject} — ${done}/${c.questions.length} 익힘 (${pct}%)`;
      }).join('<br>');
    }
    summaryEl.classList.add('show');
  }
  // ── 인트로 / 엔딩 오버레이 ───────────────────────────────────────────────
  // #summary와 CSS를 공유한다. 일시정지는 만들지 않는다 — 실패 상태가 없는 게임이라
  // 뒤에서 행성이 돌아도 무방하고, 일시정지는 새 상태기계다.
  function showIntro() {
    const el = document.getElementById('intro'); if (!el) return;
    document.getElementById('introTitle').textContent = INTRO.title;
    document.getElementById('introLines').innerHTML = INTRO.lines.join('<br>');
    document.getElementById('introHint').textContent = INTRO.hint;
    const btn = document.getElementById('introBtn');
    btn.textContent = INTRO.button;
    btn.onclick = () => {
      el.classList.remove('show'); story.markIntroShown(); resumeAudio();
      // 지도가 있다는 걸 인트로 직후 한 번만 알린다. 메뉴는 아무도 먼저 열어 보지 않는다.
      setTimeout(() => toast('🗺️ M을 누르면 지도와 할 일 목록이 열려요', 4200), 2600);
    };
    el.classList.add('show');
  }

  function showEnding() {
    const el = document.getElementById('ending'); if (!el) return;
    document.getElementById('endTitle').textContent = ENDING.title;
    document.getElementById('endLetter').innerHTML = ENDING.letter.join('<br>');
    document.getElementById('endLines').innerHTML = ENDING.lines.join('<br>');
    const btn = document.getElementById('endBtn');
    btn.textContent = ENDING.button;
    btn.onclick = () => el.classList.remove('show');
    story.markEndingShown();
    el.classList.add('show');
  }

  const sumCloseEl = document.getElementById('sumClose');
  if (sumCloseEl) sumCloseEl.addEventListener('click', () => {
    summaryEl.classList.remove('show');
    session.newBadges = [];      // 다음 요약에는 그 이후 것만
  });

  return { showSummary, showIntro, showEnding, summaryEl };
}
