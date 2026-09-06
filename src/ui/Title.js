// 시작 화면 — **정지 그림이 아니라 게임 안이다.**
//
// ★ 링크 미리보기(assets/cover.jpg)를 만들면서 알게 된 것: 사당 앞에서 빛기둥을
//   올려다보는 그 한 컷이 이 게임을 가장 잘 말한다. 그런데 표지로만 쓰고
//   정작 게임을 열면 곧장 지하실 침상이었다 — **링크에서 본 것과 화면이 달랐다.**
//   그래서 그 컷을 그대로 시작 화면으로 만든다. 다만 그림을 붙이지 않는다.
//   같은 자리에 실제로 서서 실제로 렌더한다. 풀이 흔들리고 빛기둥이 숨쉬고
//   카메라가 아주 느리게 돈다 — 눌러 보기 전에 이미 살아 있는 화면이어야 한다.
//
// ★ 여기 글씨는 캔버스 위 DOM이다. 3D 텍스트로 만들면 안개·후처리·해상도에
//   전부 끌려다니고, 무엇보다 링크(mumuclass.kr)를 누를 수가 없다.
//
// 규칙
//   · 아무 데나 누르면 시작한다. "시작 버튼을 찾아라"는 문제가 아니다.
//   · 만든 이 링크만 예외다 — 거기서는 시작이 아니라 그 주소로 간다.
//   · 키보드로도 시작한다(아무 키). 터치도 같은 길로 들어온다.
const CSS = `
#title{position:fixed;inset:0;z-index:42;display:none;cursor:pointer;
  font-family:'IBM Plex Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  -webkit-tap-highlight-color:transparent}
#title.on{display:block}
#title.out{opacity:0;transition:opacity .42s ease}

/* 제목 — 표지와 같은 자리(왼쪽 기둥). 하늘이 밝으므로 잉크색이 가장 잘 읽힌다.
   ★ 다만 하늘만 있는 게 아니다. 넓은 화면에서는 왼쪽에 전나무가 올라와서
     부제가 나뭇잎 위에 겹쳐 안 읽혔다. 상자를 깔면 화면이 무거워지므로
     글자에만 흰 번짐을 준다 — 하늘 위에서는 안 보이고 나무 위에서만 산다. */
/* ★ 처음엔 흰 번짐을 넓게 줬는데 오히려 **더 안 읽혔다** — 옅은 회색 글씨에
     넓은 흰 안개를 씌우니 나뭇잎 위에서 글자가 녹아 버렸다. 번짐은 좁게 주고
     글자색을 진하게 내리는 쪽이 맞다. 대비가 먼저고 후광은 거들 뿐이다. */
#title .lock{position:absolute;left:6.2vw;top:6.5vh;max-width:46vw;
  text-shadow:0 1px 0 rgba(255,255,255,.9),0 0 7px rgba(255,255,255,.95)}
#title .t{font-size:clamp(34px,7vw,88px);font-weight:800;letter-spacing:-.01em;
  color:#16242c;line-height:1.05;margin:0}
#title .rule{width:clamp(52px,7vw,96px);height:5px;background:#2fa594;
  margin:clamp(12px,1.8vh,20px) 0 clamp(10px,1.6vh,16px)}
#title .s1{font-size:clamp(14px,2.1vw,27px);font-weight:700;color:#1e3140;margin:0}
#title .s2{font-size:clamp(13px,1.9vw,26px);font-weight:600;color:#2e4a58;margin:6px 0 0}

/* 시작 — 화면 어디를 눌러도 되지만, 어디를 눌러야 하는지는 말해 줘야 한다. */
#title .go{position:absolute;left:50%;bottom:15%;transform:translateX(-50%);
  white-space:nowrap;font-size:clamp(14px,2vw,19px);font-weight:700;letter-spacing:.14em;
  color:#12222a;background:rgba(255,255,255,.66);
  padding:11px 26px 12px;border-radius:99px;
  box-shadow:0 2px 0 rgba(20,40,50,.10),0 10px 26px -16px rgba(10,30,40,.5);
  animation:tGo 2.4s ease-in-out infinite}
@keyframes tGo{0%,100%{opacity:.72;transform:translateX(-50%) translateY(0)}
               50%{opacity:1;transform:translateX(-50%) translateY(-3px)}}

/* 만든 이 — 여기만 시작이 아니라 링크다. */
#title .by{position:absolute;left:50%;bottom:6.5%;transform:translateX(-50%);
  white-space:nowrap;font-size:clamp(11px,1.4vw,13.5px);letter-spacing:.02em;
  color:#2b4653;background:rgba(255,255,255,.52);padding:5px 14px 6px;border-radius:99px}
#title .by a{color:#12655c;font-weight:700;text-decoration:none;
  border-bottom:1px solid rgba(18,101,92,.4);padding-bottom:1px}
#title .by a:hover{border-bottom-color:#12655c}

/* 시작 화면 동안에는 게임 UI를 내린다 — 두 겹이 겹치면 둘 다 안 읽힌다. */
body.titling #hint,body.titling #prompt,body.titling #touchUI{display:none!important}

/* 끝 카드 — 시작 화면과 같은 옷. 같은 자리에서 시작했고 같은 자리에서 끝난다. */
#title.end{cursor:pointer}
/* ★ absolute + left:50%는 상자 폭을 남은 절반으로 줄인다 — 좁은 창에서 제목이 두 줄로 꺾였다.
   내용 폭(max-content)으로 잡고 화면보다 크면 그때만 줄인다. */
#title.end .lock{left:50%;top:38%;transform:translate(-50%,-50%);max-width:92vw;width:max-content;text-align:center}
#title.end .t{white-space:nowrap}
#title.end .rule{margin-left:auto;margin-right:auto}
#title.end .fin{font-size:clamp(13px,1.8vw,22px);color:#2e4a58;margin:10px 0 0;font-weight:600}
#title.end .go{animation:none;opacity:.92}

@media (prefers-reduced-motion:reduce){#title .go{animation:none;opacity:.95}}
@media (max-width:640px){
  #title .lock{left:7vw;top:7vh;max-width:66vw}
  #title .go{bottom:11%}
  #title .by{bottom:4.5%}
}`;

const SITE = 'https://mumuclass.kr';

export function buildTitle(onStart) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'title';
  el.innerHTML = `
    <div class="lock">
      <h1 class="t">무무 행성</h1>
      <div class="rule"></div>
      <p class="s1">작은 별을 걸어서</p>
      <p class="s2">사당 여섯 · 수첩 한 권</p>
    </div>
    <div class="go">화면을 눌러 시작</div>
    <div class="by">made by <a href="${SITE}" target="_blank" rel="noopener">mumuclass.kr</a></div>`;
  document.body.appendChild(el);

  let live = false, going = false;

  const start = () => {
    if (!live || going) return;
    going = true;
    el.classList.add('out');
    document.body.classList.remove('titling');
    setTimeout(() => { el.classList.remove('on', 'out'); live = false; }, 430);
    onStart();
  };

  // ★ 링크는 시작보다 먼저 가로챈다. 안 그러면 mumuclass.kr을 누른 사람이
  //   새 탭을 열면서 **동시에 게임까지 시작해 놓고** 돌아온다.
  el.querySelector('.by a').addEventListener('click', (e) => e.stopPropagation());
  el.addEventListener('pointerdown', start);
  addEventListener('keydown', (e) => {
    if (!live || e.repeat) return;
    if (e.code === 'F5' || e.code === 'F12' || e.metaKey || e.ctrlKey || e.altKey) return;
    start(); e.preventDefault();
  });

  // ── 끝 카드 ──────────────────────────────────────────────────────────
  // ★ 엔딩이 알림 한 줄로 끝나고 있었다. 끝은 끝이라고 말해야 한다.
  //   누르면 처음으로 — 다시 시작하면 표지의 그 자리다.
  let ending = false;
  const endCard = () => {
    ending = true;
    el.classList.add('on', 'end');
    el.querySelector('.lock').innerHTML = `
      <h1 class="t">무무 행성</h1>
      <div class="rule"></div>
      <p class="s1">끝</p>
      <p class="fin">답은 뜯어내고, 물음만 남긴다 — 다음 사람을 위해.</p>`;
    el.querySelector('.go').textContent = '화면을 눌러 처음으로';
    document.body.classList.add('titling');
    live = false;                         // start()가 안 먹게
  };
  el.addEventListener('pointerdown', (e) => {
    if (!ending) return;
    e.stopPropagation();
    location.reload();
  }, true);

  return {
    endCard,
    get isEnding() { return ending; },
    show() { live = true; el.classList.add('on'); document.body.classList.add('titling'); },
    get isOpen() { return live; },
    start,                      // 검사·디버그가 부를 수 있게
    el,
  };
}
