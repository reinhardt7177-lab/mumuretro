// 방 안내 — **무엇을 하는 곳인지**를 들어서는 순간 한 번.
//
// ★ 베타 테스터의 말: "어떤 방법으로 각 방을 통과하는지 모르겠다."
//   재 보니 방마다 정보는 이미 다 있었다 — 왼쪽 벽에 목표 판, 오른쪽 벽에 힌트 판,
//   그리고 들어설 때 3.6초짜리 알림 한 줄. 그런데 셋 다 같은 구멍이 있었다.
//     · 벽 판은 **옆 벽**에 있다. 카메라는 등 뒤를 따라오므로 앞만 보고 걸으면
//       한 번도 안 본다.
//     · 3.6초 알림은 눈을 깜빡이면 사라지고 다시 못 본다.
//     · 무엇보다 셋 다 **목표만** 말하고 **조작을 말하지 않는다.**
//       "두 판이 주문한 무게를 만들어라"는 무엇을 이루라는 말이지,
//       상자를 E로 든다는 말이 아니다. 테스터가 막힌 건 목표가 아니라 손이었다.
//
// ★ 그래서 답을 주지 않으면서 손만 알려 준다. 규칙(이 방이 무엇인가)과
//   정답(지금 어느 발판이 초록인가)은 다른 것이다. 앞엣것을 모르는 건 난이도가
//   아니라 고장이고, 뒤엣것을 알려 주면 그건 게임이 아니다.
//   여기 적히는 것은 셋뿐이다 — 그림 하나 · 목표 한 줄 · 조작 한 줄.
//
// ★ 조작을 뺏지 않는다(대사창과 같은 규칙). 읽는 동안에도 걷고 돌아본다.
//   틀려서 되돌아왔을 때 다시 뜬다 — 그때가 가장 필요한 때다.
//   벌이 아니라 도움이다.

// ── 조작 여섯 ────────────────────────────────────────────────────────────────
// 방은 스물넷이지만 손이 하는 일은 여섯 가지뿐이다. 그림도 여섯 장이면 된다 —
// 방마다 다른 그림을 그리면 그리는 사람만 힘들고 아이는 매번 새로 읽어야 한다.
// 같은 손짓에 같은 그림이 붙어야 두 번째 방부터는 그림만 보고 안다.
const I = '#23272a', T = '#2fa594', W = '#c0653a', G = '#9aa3a7';
const kid = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-5" y="-26" width="10" height="9" rx="2" fill="#f0c9a4"/>
    <rect x="-8" y="-29" width="16" height="4" rx="1.6" fill="#6b5b43"/>
    <rect x="-6" y="-17" width="12" height="13" rx="2" fill="#6b7355"/>
    <rect x="-5.5" y="-16" width="3" height="10" rx="1.4" fill="${W}"/>
    <rect x="-5" y="-4" width="4" height="4" rx="1" fill="#3a3230"/>
    <rect x="1" y="-4" width="4" height="4" rx="1" fill="#3a3230"/>
  </g>`;

const ACTS = {
  // 밟을 자리를 고른다 — 걷는 것 말고는 없다
  stand: {
    key: '걷기', keyTouch: '걷기',
    how: '걸어서 밟을 자리를 고른다. 다른 키는 필요 없다.',
    svg: `<rect x="14" y="60" width="30" height="9" rx="2" fill="${T}"/>
      <rect x="50" y="66" width="30" height="6" rx="2" fill="${W}" opacity=".55"/>
      <rect x="86" y="60" width="30" height="9" rx="2" fill="${T}"/>
      ${kid(29, 60)}
      <path d="M52 78 h26" stroke="${W}" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>
      <path d="M56 82 l20 0" stroke="${W}" stroke-width="2.6" stroke-linecap="round" opacity=".35"/>`,
  },
  // 밟고 + 뛴다 — 빛 타일 방이 이렇다(발판 색 판정 **과** 도는 줄)
  standJump: {
    key: 'Space', keyTouch: '점프 버튼',
    how: '초록 칸으로 걸어가고, 도는 줄은 점프로 넘는다. 둘을 같이 본다.',
    svg: `<rect x="10" y="64" width="34" height="9" rx="2" fill="${T}"/>
      <rect x="50" y="70" width="30" height="6" rx="2" fill="${W}" opacity=".55"/>
      <rect x="86" y="64" width="30" height="9" rx="2" fill="${T}"/>
      <path d="M30 64 q28 -34 56 0" fill="none" stroke="${I}" stroke-width="2.6"
        stroke-dasharray="4 5" stroke-linecap="round" opacity=".55"/>
      <path d="M20 40 q44 26 88 0" fill="none" stroke="${W}" stroke-width="3"
        stroke-linecap="round"/>
      ${kid(30, 64, .9)}`,
  },
  // 미끄러진다 — 멈추는 게 아니라 미리 멈춘다
  slip: {
    key: '미리 멈추기', keyTouch: '미리 멈추기',
    how: '얼음 위에선 손을 떼도 안 멈춘다. 구멍 한참 전에 미리 뗀다.',
    svg: `<rect x="10" y="66" width="110" height="8" rx="2" fill="#bfe4ee"/>
      <circle cx="92" cy="70" r="9" fill="#16242c" opacity=".72"/>
      ${kid(34, 66, .92)}
      <path d="M46 56 h30" stroke="${T}" stroke-width="3" stroke-linecap="round"/>
      <path d="M70 51 l7 5 -7 5" fill="none" stroke="${T}" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M52 62 h10 M58 66 h10" stroke="#fff" stroke-width="2.4"
        stroke-linecap="round" opacity=".9"/>`,
  },
  // 뛴다 — 뛸 것과 안 뛸 것을 가린다
  jump: {
    key: 'Space', keyTouch: '점프 버튼',
    how: '점프로 넘는다. 넘을 것과 안 넘을 것을 가려야 한다.',
    svg: `<rect x="10" y="68" width="110" height="6" rx="2" fill="${I}" opacity=".18"/>
      <path d="M26 68 q26 -40 52 0" fill="none" stroke="${T}" stroke-width="3"
        stroke-dasharray="5 5" stroke-linecap="round"/>
      <rect x="62" y="46" width="4" height="22" rx="2" fill="${W}"/>
      ${kid(26, 68, .92)}`,
  },
  // 든다 — E로 집고, 놓을 자리에서 다시 E
  carry: {
    key: 'E', keyTouch: 'E 버튼',
    how: 'E로 집어 들고, 놓을 자리에서 다시 E를 누른다.',
    svg: `<rect x="12" y="66" width="106" height="6" rx="2" fill="${I}" opacity=".18"/>
      ${kid(34, 66)}
      <rect x="42" y="40" width="16" height="16" rx="3" fill="${W}"/>
      <path d="M64 44 h30" stroke="${T}" stroke-width="3" stroke-linecap="round"/>
      <path d="M88 39 l7 5 -7 5" fill="none" stroke="${T}" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="92" y="56" width="24" height="10" rx="2" fill="${T}" opacity=".35"/>
      <rect x="92" y="56" width="24" height="10" rx="2" fill="none" stroke="${T}" stroke-width="2"/>`,
  },
  // 돌린다 — 손잡이에 붙어 E
  turn: {
    key: 'E', keyTouch: 'E 버튼',
    how: 'E로 손잡이를 돌린다. 한 번에 한 칸씩 바뀐다.',
    svg: `<rect x="12" y="68" width="106" height="6" rx="2" fill="${I}" opacity=".18"/>
      ${kid(34, 68)}
      <circle cx="84" cy="44" r="17" fill="none" stroke="${I}" stroke-width="3.4" opacity=".55"/>
      <path d="M84 27 a17 17 0 1 1 -14 8" fill="none" stroke="${T}" stroke-width="3.6"
        stroke-linecap="round"/>
      <path d="M78 22 l6 5 -6 5" fill="none" stroke="${T}" stroke-width="3.2"
        stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="80" y="44" width="8" height="24" rx="2" fill="${W}"/>`,
  },
  // 때를 본다 — 신호를 보고 지나가거나 누른다
  time: {
    key: '때', keyTouch: '때',
    how: '신호를 보고 때를 맞춘다. 서두르면 반드시 걸린다.',
    svg: `<rect x="12" y="68" width="106" height="6" rx="2" fill="${I}" opacity=".18"/>
      ${kid(28, 68, .92)}
      <circle cx="86" cy="40" r="18" fill="none" stroke="${I}" stroke-width="3" opacity=".5"/>
      <path d="M86 28 v13 l9 6" fill="none" stroke="${T}" stroke-width="3.4"
        stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="56" cy="62" r="3.4" fill="${W}"/>
      <circle cx="68" cy="62" r="3.4" fill="${W}" opacity=".5"/>
      <circle cx="80" cy="62" r="3.4" fill="${W}" opacity=".22"/>`,
  },
  // 피한다 — 먼저 오는 신호가 있다
  avoid: {
    key: '피하기', keyTouch: '피하기',
    how: '먼저 오는 신호가 있다. 그걸 보고 비킨다.',
    svg: `<rect x="12" y="70" width="106" height="6" rx="2" fill="${I}" opacity=".18"/>
      <ellipse cx="78" cy="70" rx="17" ry="5" fill="${W}" opacity=".28"/>
      <path d="M70 16 l16 0 -5 16 -6 0z" fill="${I}" opacity=".55"/>
      <path d="M78 38 v10" stroke="${W}" stroke-width="3" stroke-linecap="round"
        stroke-dasharray="3 5"/>
      ${kid(40, 70)}
      <path d="M56 52 h-14" stroke="${T}" stroke-width="3" stroke-linecap="round"/>
      <path d="M46 47 l-6 5 6 5" fill="none" stroke="${T}" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"/>`,
  },
};

export const BRIEF_ACTS = Object.keys(ACTS);

const CSS = `
#rb{position:fixed;left:50%;top:9%;transform:translateX(-50%) translateY(-8px);
  z-index:36;width:min(92vw,470px);display:none;opacity:0;
  transition:opacity .18s ease,transform .18s ease;cursor:pointer;
  font-family:'IBM Plex Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  -webkit-tap-highlight-color:transparent}
#rb.on{display:block;opacity:1;transform:translateX(-50%) translateY(0)}
#rb .card{background:rgba(247,250,250,.95);border:1px solid rgba(35,39,42,.14);
  border-radius:10px;padding:13px 16px 12px;
  box-shadow:0 18px 46px -22px rgba(8,20,24,.75);backdrop-filter:blur(3px)}
#rb .top{display:flex;align-items:center;gap:12px}
#rb svg{flex:0 0 auto;width:104px;height:78px;display:block}
#rb .txt{min-width:0}
#rb .nm{font-size:11px;letter-spacing:.09em;color:#7d878c;margin-bottom:3px}
#rb .goal{font-size:16px;font-weight:700;line-height:1.32;color:#16242c;word-break:keep-all}
#rb .how{margin-top:9px;padding-top:8px;border-top:1px dashed rgba(35,39,42,.18);
  font-size:13px;line-height:1.45;color:#3d474c;word-break:keep-all}
#rb .how b{color:#12655c;font-weight:700}
#rb .ok{margin-top:8px;text-align:right;font-size:11.5px;color:#7d878c}
@media (max-width:640px){
  #rb{top:6%;width:94vw}
  #rb svg{width:84px;height:64px}
  #rb .goal{font-size:14.5px}
  #rb .how{font-size:12px}
}
@media (max-height:430px){#rb{top:4%}#rb .card{padding:9px 12px 8px}
  #rb svg{width:76px;height:58px}#rb .goal{font-size:13.5px}
  #rb .how{margin-top:6px;padding-top:6px;font-size:11.5px}#rb .ok{margin-top:5px}}
@media (prefers-reduced-motion:reduce){#rb{transition:none}}`;

export function buildRoomBrief(isTouch) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'rb';
  el.innerHTML = '<div class="card"><div class="top">'
    + '<svg viewBox="0 0 130 92" aria-hidden="true"></svg>'
    + '<div class="txt"><div class="nm"></div><div class="goal"></div></div></div>'
    + '<div class="how"></div><div class="ok"></div></div>';
  document.body.appendChild(el);
  const elSvg = el.querySelector('svg');
  const elNm = el.querySelector('.nm');
  const elGoal = el.querySelector('.goal');
  const elHow = el.querySelector('.how');
  const elOk = el.querySelector('.ok');

  let open = false;
  const hide = () => { open = false; el.classList.remove('on'); };
  el.addEventListener('pointerdown', (e) => { e.stopPropagation(); hide(); });

  return {
    // name: 방 이름 · goal: 목표 한 줄 · act: 손이 하는 일(ACTS의 열쇠)
    show(name, goal, act) {
      const a = ACTS[act] || ACTS.stand;
      const touch = !!(isTouch && isTouch());
      elSvg.innerHTML = a.svg;
      elNm.textContent = name;
      elGoal.textContent = goal || '';
      elHow.innerHTML = `<b>${touch ? a.keyTouch : a.key}</b> — ${a.how}`;
      elOk.textContent = touch ? '눌러서 닫기' : 'E · 눌러서 닫기';
      open = true;
      el.classList.add('on');
    },
    hide,
    get isOpen() { return open; },
    // 검사용 — 그림·조작 표가 방과 맞는지 본다
    has(act) { return !!ACTS[act]; },
    acts: () => Object.keys(ACTS),
  };
}
