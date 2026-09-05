// 조사 — 받침이 있으면 을·이·은·과·으로, 없으면 를·가·는·와·로.
//
// ★ 화면에 "얼음**를** 원해요"가 떠 있었다. 이름을 문자열로 끼워 넣고 조사를
//   손으로 붙여 놨기 때문이다. 이름이 하나뿐이면 안 틀리는데, 이 게임은
//   얼음·물·수증기, 암모나이트·삼엽충, 쇠구슬·모래처럼 **받침이 섞인 이름**을
//   같은 문장에 넣는다. 그러면 반드시 하나는 틀린다.
//   4학년이 읽는 앱에서 조사가 틀리는 건 오타가 아니라 **가르치는 내용이 틀린 것**이다.
//
// 숫자도 받는다. "5과 3을"이 아니라 "5와 3을"이어야 하고, 그건 숫자의 **소리**가
// 정한다(오·삼). 그래서 마지막 자리 숫자로 받침을 판단한다.

// 숫자 한 자리를 읽었을 때 받침이 있는가 — 영ㅇ 일ㄹ 이 삼ㅁ 사 오 육ㄱ 칠ㄹ 팔ㄹ 구
const DIGIT_BATCHIM = [true, true, false, true, false, false, true, true, true, false];

function batchimOf(word) {
  const s = String(word).trim();
  if (!s) return { has: false, rieul: false };
  const last = s[s.length - 1];
  const c = last.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) {           // 한글 음절
    const t = (c - 0xac00) % 28;
    return { has: t !== 0, rieul: t === 8 };
  }
  if (last >= '0' && last <= '9') {
    const d = +last;
    return { has: DIGIT_BATCHIM[d], rieul: d === 1 || d === 7 || d === 8 };
  }
  return { has: false, rieul: false };        // 영문·기호는 없는 쪽으로
}

// [받침 있을 때, 없을 때]
const PAIRS = [['을', '를'], ['이', '가'], ['은', '는'], ['과', '와'], ['으로', '로']];

// josa('얼음', '을') → '얼음을' · josa('수증기', '을') → '수증기를'
// josa(5, '과') → '5와' · josa(3, '과') → '3과'
export function josa(word, particle) {
  const s = String(word);
  const pair = PAIRS.find((p) => p[0] === particle || p[1] === particle);
  if (!pair) return s + particle;
  const b = batchimOf(s);
  // 으로/로만 예외 — ㄹ 받침은 '로'를 쓴다(연필로, 물로)
  if (pair[0] === '으로') return s + (b.has && !b.rieul ? '으로' : '로');
  return s + (b.has ? pair[0] : pair[1]);
}
