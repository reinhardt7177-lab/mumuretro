// 커리큘럼 데이터 검증 — 로드 시 1회 실행되어 콘솔에 문제를 알린다.
//
// 문제 데이터는 그냥 텍스트가 아니라 "집 대문 팻말에 걸려 정답 판정에 쓰이는 값"이라
// 지켜야 할 제약이 있다. 어기면 조용히 깨지므로(두 집이 동시에 정답이 되는 등) 여기서 잡는다.

// 정답은 팻말 텍스처 폭을 결정한다. 길면 팻말이 집보다 넓어져 화면을 가린다.
// 실측: 60px bold 기준 6글자 ≈ 팻말 폭 4.5u(집 한 채 폭). 그 이상은 곤란.
export const MAX_ANSWER_LEN = 7;
export const MIN_DISTRACTORS = 3;   // 후보 집 4채 = 정답 1 + 오답 3

export function validateCurriculum(c) {
  const errors = [], warnings = [];
  const seen = new Set();

  if (!c || !Array.isArray(c.questions)) {
    return { ok: false, errors: ['questions 배열이 없습니다'], warnings };
  }

  for (const q of c.questions) {
    const at = `[${c.id}/${q.id ?? '?'}]`;

    if (!q.id) errors.push(`${at} id 없음`);
    else if (seen.has(q.id)) errors.push(`${at} id 중복`);
    else seen.add(q.id);

    if (!q.q) errors.push(`${at} 문제(q) 비어 있음`);
    if (!q.a) errors.push(`${at} 정답(a) 비어 있음`);

    if (q.a && [...q.a].length > MAX_ANSWER_LEN) {
      errors.push(`${at} 정답이 너무 김 ("${q.a}" ${[...q.a].length}자 > ${MAX_ANSWER_LEN}) — 팻말이 집보다 넓어짐`);
    }

    const d = Array.isArray(q.d) ? q.d : [];
    if (d.length < MIN_DISTRACTORS) {
      errors.push(`${at} 오답이 ${d.length}개 (최소 ${MIN_DISTRACTORS}개) — 후보 집을 못 채움`);
    }

    // ★ 가장 위험한 실수: 오답 목록에 정답과 같은 값이 있으면 두 집이 동시에 정답이 된다.
    if (q.a && d.includes(q.a)) {
      errors.push(`${at} 오답에 정답과 같은 값("${q.a}")이 있음 — 두 집이 정답이 됨`);
    }
    const dup = d.filter((x, i) => d.indexOf(x) !== i);
    if (dup.length) warnings.push(`${at} 오답 중복: ${[...new Set(dup)].join(', ')}`);

    for (const x of d) {
      if (x && [...x].length > MAX_ANSWER_LEN) {
        warnings.push(`${at} 오답이 김 ("${x}") — 팻말이 넓어짐`);
      }
    }

    if (!q.hint) warnings.push(`${at} 힌트 없음 — 오답 2회 후 보여줄 게 없음`);
  }

  return { ok: errors.length === 0, errors, warnings, count: c.questions.length };
}

// 콘솔 출력 헬퍼.
export function reportCurriculum(c) {
  const r = validateCurriculum(c);
  const tag = `[curriculum:${c.id}]`;
  if (r.errors.length) console.error(`${tag} ❌ 오류 ${r.errors.length}\n` + r.errors.join('\n'));
  if (r.warnings.length) console.warn(`${tag} ⚠️ 경고 ${r.warnings.length}\n` + r.warnings.join('\n'));
  if (r.ok && !r.warnings.length) console.log(`${tag} ✅ 문제 ${r.count}개 검증 통과`);
  return r;
}
