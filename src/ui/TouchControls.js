// 터치 조작 — 화면 버튼.
//
// ★ 재설계 전에는 모바일 버튼이 있었는데 다시 세우면서 빠졌고, Input에
//   requestJump()/setHoldJump()만 껍데기로 남아 있었다. 그래서 터치 기기에서는
//   걷고 둘러보는 것까지만 되고 **사당에 들어갈 수조차 없었다**(점검에서 확인).
//
// 아트 바이블 「상시 표시는 다섯뿐」과 부딪히지 않는 방법:
//   · 터치 기기에서만 나타난다(포인터가 굵을 때, 또는 실제로 화면을 만졌을 때)
//   · E 버튼은 **할 수 있는 일이 있을 때만** 뜬다. 프롬프트가 'E —'로 시작하면
//     그게 곧 "지금 누를 것이 있다"는 신호다. 늘 떠 있는 버튼이 아니다
//   · 지도와 점프만 상주하고, 둘 다 작다
//
// 자리: 오른쪽 아래. 왼쪽 절반은 이동 조이스틱이고 오른쪽 절반은 시점 드래그인데,
// 버튼은 캔버스의 형제 요소라 버튼을 누른 손가락은 캔버스로 내려가지 않는다.
const CSS = `
#touchUI{position:fixed;right:calc(14px + env(safe-area-inset-right));
  bottom:calc(18px + env(safe-area-inset-bottom));z-index:30;
  display:none;flex-direction:column;align-items:flex-end;gap:12px;
  font-family:system-ui,'Malgun Gothic',sans-serif;-webkit-user-select:none;user-select:none;
  touch-action:none}
#touchUI.on{display:flex}
#touchUI button{
  -webkit-tap-highlight-color:transparent;appearance:none;cursor:pointer;
  display:grid;place-items:center;border-radius:999px;
  background:rgba(14,22,26,.62);border:1px solid rgba(180,214,220,.34);
  color:#dfe9ea;backdrop-filter:blur(4px);transition:transform .08s ease,background .12s ease}
#touchUI button:active{transform:scale(.92);background:rgba(111,227,210,.28)}
#tcAct{width:78px;height:78px;font-size:15px;font-weight:600;letter-spacing:.02em;
  border-color:rgba(111,227,210,.72);background:rgba(20,46,46,.72)}
#tcAct[hidden]{display:none}
#tcJump{width:60px;height:60px;font-size:12px}
#tcMap[hidden],#tcNote[hidden]{display:none}
#tcMap,#tcNote{width:46px;height:46px;font-size:18px;position:fixed;
  right:calc(14px + env(safe-area-inset-right))}
#tcMap{top:calc(14px + env(safe-area-inset-top))}
#tcNote{top:calc(68px + env(safe-area-inset-top))}
@media (max-height:520px){#tcAct{width:64px;height:64px;font-size:13px}
  #tcJump{width:52px;height:52px}}`;

export function buildTouchControls(input, mapPage, notebook) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'touchUI';
  el.innerHTML = `
    <button id="tcMap" aria-label="지도">🗺</button>
    <button id="tcNote" aria-label="탐사 수첩">📓</button>
    <button id="tcJump" aria-label="점프">점프</button>
    <button id="tcAct" aria-label="상호작용" hidden>E</button>`;
  document.body.appendChild(el);

  const bAct = el.querySelector('#tcAct');
  const bJump = el.querySelector('#tcJump');
  const bMap = el.querySelector('#tcMap');
  const bNote = el.querySelector('#tcNote');

  // 버튼을 누른 손가락이 시점 드래그로도 새지 않게 막는다.
  const tap = (btn, down, up) => {
    const start = (e) => { e.preventDefault(); e.stopPropagation(); down(); };
    const end = (e) => { e.preventDefault(); e.stopPropagation(); if (up) up(); };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('touchcancel', end, { passive: false });
    btn.addEventListener('mousedown', start);
    addEventListener('mouseup', () => { if (up) up(); });
  };

  tap(bAct, () => input.requestAction());
  // 누르고 있으면 계속 뜬다 — Input이 이미 활공을 받아 준다.
  tap(bJump, () => { input.requestJump(); input.setHoldJump(true); },
    () => input.setHoldJump(false));
  // ★ 지도는 수첩의 한 면이 됐다. 버튼은 그 면을 연다 — 화면을 둘로 안 나눈다.
  tap(bMap, () => { const n = notebook(); if (n) { if (n.isOpen && n.tab === 'star') n.setOpen(false);
    else { n.go('star'); n.setOpen(true); } } });
  tap(bNote, () => { const n = notebook(); if (n) n.setOpen(!n.isOpen); });

  // ── 언제 보이는가 ────────────────────────────────────────────────────
  let on = false;
  let onShow = null;
  // ★ 여기서 #hint를 직접 쓰지 않는다. 안내에 "N 수첩"을 적을지 말지는
  //   **수첩을 가졌는지**에 달렸고, 그건 이 파일이 알 일이 아니다.
  const show = () => {
    if (on) return;
    on = true;
    el.classList.add('on');
    if (onShow) onShow();
  };
  if (matchMedia('(pointer: coarse)').matches) show();
  addEventListener('touchstart', show, { once: true, passive: true });

  // ── E 버튼은 할 수 있는 일이 있을 때만 ───────────────────────────────
  // 프롬프트가 'E —'로 시작하면 그게 곧 "지금 누를 것이 있다"는 신호다.
  // 별도 상태를 만들지 않는다 — 만들면 프롬프트와 버튼이 어긋나는 날이 온다.
  const promptEl = document.getElementById('prompt');
  const sync = () => {
    const t = promptEl && promptEl.classList.contains('show') ? promptEl.textContent : '';
    bAct.hidden = !/^E\s/.test(t.trim());
  };
  if (promptEl) {
    new MutationObserver(sync).observe(promptEl,
      { childList: true, characterData: true, subtree: true, attributes: true });
  }
  sync();

  // 지도가 열려 있으면 버튼은 가린다(지도 자체가 탭하면 닫힌다)
  const hideWhileMap = () => {
    const n = notebook();
    el.style.visibility = (n && n.isOpen) ? 'hidden' : '';
    // ★ 눌러도 아무 일 없는 버튼이 가장 나쁘다. 오프닝에서는 수첩도 지도도
    //   아직 손에 없다 — 그 동안은 버튼 자체가 없어야 한다.
    bMap.hidden = !mapPage.has;
    bNote.hidden = !(n && n.has);
  };

  return {
    update: hideWhileMap,
    get visible() { return on; },
    onShow(fn) { onShow = fn; if (on) fn(); },
    show,                       // 검증용
    get actionVisible() { return !bAct.hidden; },
  };
}
