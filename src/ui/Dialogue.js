// 대사창 — 화면 아래에 한 줄씩.
//
// 규칙 넷을 코드로 못 박는다. 스토리보드에 적어 놓고 안 지키면 그건 적어 둔 게 아니다.
//   조작을 뺏지 않는다      대사 중에도 걷고 돌아본다. 멈춰 세우면 읽는 게 아니라 기다리는 게 된다
//   자동으로 안 넘어간다    E·탭으로만. 읽는 속도는 아이마다 다르고 놓친 줄은 못 되돌린다
//   언제든 건너뛴다         Esc 한 번이면 뭉치가 통째로 끝난다
//   한 번 본 것은 안 나온다 같은 대사를 두 번째 판에 또 읽히면 그건 벌이다
//
// ★ E는 대사창이 먼저 가져간다. 대사 중에 E가 상호작용으로도 가면
//   "넘기려다 뭘 집었다"가 되고, 그건 조작을 뺏는 것보다 나쁘다.
//
// ★ 그런데 그 E를 **여기서 keydown으로 받으면 안 된다.** 그러면 키보드로는 넘어가는데
//   터치 기기의 E 버튼(input.requestAction)으로는 안 넘어간다 —
//   모바일에서 대사가 열리는 순간 갇힌다. 넘기는 신호는 boot이 intent.action에서
//   한 번만 읽어 next()로 보낸다. **조작 경로를 둘로 나누면 한쪽만 고쳐지는 날이 온다.**
import { sfx } from '../core/Audio.js';

const CSS = `
#dlg{position:fixed;left:50%;bottom:96px;transform:translateX(-50%) translateY(8px);
  z-index:35;width:min(90vw,640px);display:none;opacity:0;
  transition:opacity .16s ease,transform .16s ease;
  font-family:"Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif}
#dlg.show{display:block;opacity:1;transform:translateX(-50%) translateY(0)}
#dlg .box{background:rgba(12,18,21,.93);border:1px solid rgba(160,200,205,.30);
  border-radius:4px;padding:15px 18px 13px;backdrop-filter:blur(3px);
  box-shadow:0 16px 44px -22px #000}
#dlg .who{font-size:12px;letter-spacing:.06em;color:#6fe3d2;margin-bottom:6px}
#dlg .line{font-size:17px;line-height:1.66;color:#eef4f5;word-break:keep-all}
#dlg .foot{display:flex;align-items:center;gap:12px;margin-top:9px;
  font-size:11.5px;color:#7d8f95}
#dlg .next{margin-left:auto;color:#cfe0e3;animation:dlgb 1.1s ease-in-out infinite}
@keyframes dlgb{0%,100%{opacity:.35}50%{opacity:1}}
@media (max-width:640px){#dlg{bottom:150px}#dlg .line{font-size:15.5px}}
/* 낮고 넓은 창(가로로 붙여 놓은 미리보기 패널 등)에서는 대사창이 화면의 4분의 1을
   차지하면서 캐릭터를 통째로 가린다. 높이가 좁으면 낮게, 작게. */
@media (max-height:520px){#dlg{bottom:52px}#dlg .box{padding:10px 14px 9px}
  #dlg .line{font-size:15px;line-height:1.5}#dlg .who{margin-bottom:3px}
  #dlg .foot{margin-top:6px}}
@media (prefers-reduced-motion:reduce){#dlg .next{animation:none;opacity:.8}}`;

export function buildDialogue(input) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'dlg';
  el.innerHTML = `<div class="box">
    <div class="who" id="dlgWho"></div>
    <div class="line" id="dlgLine"></div>
    <div class="foot"><span id="dlgSkip">Esc — 건너뛰기</span><span class="next">▸ E</span></div>
  </div>`;
  document.body.appendChild(el);
  const elWho = el.querySelector('#dlgWho');
  const elLine = el.querySelector('#dlgLine');

  const seen = new Set();
  let lines = [], i = 0, who = '', onDone = null;

  const render = () => {
    elWho.textContent = who || '';
    elWho.style.display = who ? '' : 'none';
    elLine.textContent = lines[i] || '';
  };
  const close = () => {
    lines = []; i = 0;
    el.classList.remove('show');
    const cb = onDone; onDone = null;
    if (cb) cb();
  };
  const next = () => {
    if (!lines.length) return;
    sfx('dlg_page');
    i++;
    if (i >= lines.length) close(); else render();
  };

  // Esc(건너뛰기)만 여기서 받는다. 넘기기는 boot이 intent.action으로 보낸다.
  addEventListener('keydown', (e) => {
    if (!lines.length || e.repeat) return;
    if (e.code === 'Escape') { close(); e.preventDefault(); }
  });
  el.addEventListener('click', (e) => { e.stopPropagation(); next(); });
  el.addEventListener('touchstart', (e) => { e.stopPropagation(); e.preventDefault(); next(); },
    { passive: false });

  return {
    // id가 이미 나온 적 있으면 조용히 넘어간다. done은 그래도 불린다 —
    // 부르는 쪽이 "대사 끝나고 할 일"을 매번 분기하지 않게.
    play(id, who_, text, done) {
      if (seen.has(id)) { if (done) done(); return false; }
      seen.add(id);
      who = who_ || '';
      lines = Array.isArray(text) ? text.slice(0, 4) : [text];
      i = 0; onDone = done || null;
      render();
      el.classList.add('show');
      return true;
    },
    next,
    get active() { return lines.length > 0; },
    // 이미 본 대사인가 — 수첩에서 다시 읽히려고
    hasSeen(id) { return seen.has(id); },
    close,
  };
}
