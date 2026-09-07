// 화면 설정 — 화질 단수를 손으로 고른다.
//
// ★ 왜 이게 필요한가. 화질은 기기가 정하고 느리면 스스로 내려간다(Quality.js).
//   그런데 교실에는 **한 대만 느린 태블릿**이 있고, 반대로 잘 도는데 뿌옇다고
//   느끼는 아이가 있다. 자동만 두면 그 두 경우에 아무도 할 수 있는 게 없다.
//
// ★ 「상시 표시는 다섯뿐」과 부딪히지 않는다 — 음소거 단추와 같은 논리다.
//   이건 게임 정보가 아니라 **기기 조작**이고, 그래서 수첩·지도·음소거와 같은
//   오른쪽 위 층에 붙는다. 게임이 아이에게 말을 거는 자리가 아니다.
//
// ★ 해요체를 쓰지 않는다. 검사 K가 데이터만 훑어서 여기까지 안 닿지만,
//   규칙은 화면에 나오는 모든 글에 걸린다 — 닿지 않는 곳은 반드시 틀린다.
//
// ★ 기본은 **자동**이다. 아무도 안 건드려도 되는 것이 기본값의 뜻이다.
//   고르면 그 기기에 저장되고(localStorage), 저장된 동안은 스스로 안 내려간다 —
//   손으로 정한 것을 기계가 뒤집으면 그건 설정이 아니다.
import { quality, TIER_NAMES, TIER_LABELS, deviceDefault } from '../render/Quality.js';
import { registerOverlay, soloOpen } from './overlay.js';
import { sfx } from '../core/Audio.js';

const CSS = `
#gfx{position:fixed;top:calc(62px + env(safe-area-inset-top));
  right:calc(14px + env(safe-area-inset-right));z-index:31;
  width:38px;height:38px;border-radius:999px;appearance:none;cursor:pointer;
  display:grid;place-items:center;font-size:16px;line-height:1;
  background:rgba(14,22,26,.5);border:1px solid rgba(180,214,220,.28);color:#dfe9ea;
  backdrop-filter:blur(4px);-webkit-tap-highlight-color:transparent;
  transition:transform .08s ease,background .12s ease}
#gfx:hover{background:rgba(14,22,26,.72)}
#gfx:active{transform:scale(.92)}
/* 손가락 기기 — 지도·수첩·전체화면·음소거 아래로 줄을 잇는다 */
@media (any-pointer:coarse){#gfx{top:calc(230px + env(safe-area-inset-top));
  width:46px;height:46px;font-size:19px}}
@media (any-pointer:coarse) and (min-width:820px) and (min-height:620px){
  #gfx{top:calc(284px + env(safe-area-inset-top));width:58px;height:58px;font-size:22px;
    right:calc(24px + env(safe-area-inset-right))}}
/* 시작 화면·끝 카드에서는 내린다 — 음소거와 같다. 그 화면은 그림이 전부다. */
body.titling #gfx,body.titling #gfxWrap{display:none}

#gfxWrap{position:fixed;inset:0;z-index:41;display:none;place-items:center;
  background:rgba(8,10,9,.72);backdrop-filter:blur(3px);
  font-family:'IBM Plex Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif}
#gfxWrap.show{display:grid}
#gfxWrap .card{width:min(92vw,340px);background:#f3f2ec;color:#23272a;border-radius:6px;
  box-shadow:0 24px 60px -28px #000;padding:16px 18px 14px}
#gfxWrap .hd{display:flex;align-items:center;font-size:15px;font-weight:700;
  letter-spacing:.02em;margin-bottom:12px}
#gfxWrap .x{margin-left:auto;appearance:none;border:0;cursor:pointer;background:transparent;
  color:#7d878c;font:600 20px/1 inherit;width:40px;height:34px;border-radius:6px}
#gfxWrap .x:hover{color:#23272a;background:rgba(0,0,0,.06)}
@media (any-pointer:coarse){#gfxWrap .x{width:52px;height:44px;font-size:23px}}
#gfxWrap .row{display:flex;flex-wrap:wrap;gap:6px}
/* ★ 다섯을 한 줄에 밀어 넣었더니 '가장 낮음'만 다음 줄로 떨어져 어색했다.
   그런데 그건 자리 문제가 아니라 **갈래 문제**다 — '자동'은 나머지 넷과 종류가
   다른 선택이다(기계에 맡기기 / 손으로 정하기). 줄을 나눠 그 차이를 보이게 한다. */
#gfxWrap .row.lv{margin-top:8px;padding-top:10px;border-top:1px dashed #d8dad2}
#gfxWrap .row button{appearance:none;border:1px solid #d5d8ce;cursor:pointer;
  border-radius:99px;padding:8px 14px;font:600 13px/1.2 inherit;color:#4a545a;
  background:#fbfaf5;-webkit-tap-highlight-color:transparent}
#gfxWrap .row button:hover{border-color:#b9bfb2;color:#23272a}
#gfxWrap .row button.on{background:#23272a;border-color:#23272a;color:#f3f2ec}
@media (any-pointer:coarse){#gfxWrap .row button{padding:11px 16px;font-size:14px}}
#gfxWrap .now{margin-top:12px;padding-top:10px;border-top:1px dashed #d8dad2;
  font-size:12px;color:#5c666b;font-variant-numeric:tabular-nums}
#gfxWrap .tip{margin-top:5px;font-size:11.5px;color:#8b9399}`;

// 화면에 나갈 수 있는 글은 **여기 한 곳에** 모은다.
// ★ 검사가 살아 있는 DOM을 읽게 했더니, 검사가 단추를 누르는 순간 paint()가
//   글자를 도로 덮어써서 **일부러 심은 해요체를 못 잡았다.** PASS가 떴다.
//   깨진 것을 못 잡는 검사는 없느니만 못하다 — 검사는 DOM이 아니라 이 표를 본다.
const TEXT = {
  head: '화면',
  auto: '자동',
  tipAuto: '자동 — 느리면 한 단씩 내려간다',
  tipPinned: '골라 둔 것은 이 기기에 남는다',
  now: (label, size) => `지금 ${label}${size}`,
};
// 검사가 훑을 문자열 전부. 상태에 따라 갈리는 것은 갈래마다 하나씩 넣는다.
export const settingsTexts = () => [
  TEXT.head, TEXT.auto, TEXT.tipAuto, TEXT.tipPinned,
  ...TIER_NAMES.map((n) => TIER_LABELS[n]),
  ...TIER_NAMES.map((n) => TEXT.now(TIER_LABELS[n], ' · 1024×768')),
];

// getEngine: 지금 실제로 그리는 크기를 읽으려고. 설정이 화면과 어긋나면 안 된다.
export function buildSettings(getEngine) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'gfx';
  btn.type = 'button';
  btn.textContent = '⚙';
  btn.setAttribute('aria-label', '화면 설정');
  document.body.appendChild(btn);

  const wrap = document.createElement('div');
  wrap.id = 'gfxWrap';
  wrap.innerHTML = `<div class="card">
    <div class="hd">${TEXT.head}<button class="x" id="gfxX" aria-label="닫기">✕</button></div>
    <div class="row" id="gfxRow">
      <button data-q="auto">${TEXT.auto}</button>
    </div>
    <div class="row lv" id="gfxRowLv">
      ${TIER_NAMES.map((n) => `<button data-q="${n}">${TIER_LABELS[n]}</button>`).join('')}
    </div>
    <div class="now" id="gfxNow"></div>
    <div class="tip" id="gfxTip"></div>
  </div>`;
  document.body.appendChild(wrap);

  const nowEl = wrap.querySelector('#gfxNow');
  const tipEl = wrap.querySelector('#gfxTip');
  const btns = [...wrap.querySelectorAll('#gfxRow button, #gfxRowLv button')];

  let open = false;
  const me = registerOverlay({ get isOpen() { return open; }, close: () => setOpen(false) });

  // 지금 무엇으로 그리고 있는가. **고른 것이 아니라 실제로 그리는 것**을 적는다 —
  // 자동으로 내려갔는데 화면이 '자동'만 말하면 그건 아무 정보도 아니다.
  const paint = () => {
    const auto = !quality.forced;
    for (const b of btns) b.classList.toggle('on', b.dataset.q === (auto ? 'auto' : quality.name));
    const e = getEngine && getEngine();
    let size = '';
    if (e && e.renderer) {
      const gl = e.renderer.getContext();
      size = ` · ${gl.drawingBufferWidth}×${gl.drawingBufferHeight}`;
    }
    nowEl.textContent = TEXT.now(TIER_LABELS[quality.name], size);
    tipEl.textContent = auto ? TEXT.tipAuto : TEXT.tipPinned;
  };

  const setOpen = (v) => {
    if (v === open) return;
    if (v) soloOpen(me);
    open = v;
    wrap.classList.toggle('show', v);
    if (v) paint();
  };

  btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); setOpen(!open); btn.blur(); });
  wrap.querySelector('#gfxX').addEventListener('click', (e) => { e.stopPropagation(); setOpen(false); });
  // 카드 바깥을 누르면 닫힌다 — 수첩과 같은 손짓이다.
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) setOpen(false); });
  addEventListener('keydown', (e) => {
    if (!open || e.repeat) return;
    if (e.code === 'Escape') { setOpen(false); e.preventDefault(); }
  });

  for (const b of btns) {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const q = b.dataset.q;
      if (q === 'auto') quality.auto(); else quality.pin(q);
      sfx('ui_tab');
      paint();
    });
  }
  // 스스로 내려갔을 때도 화면이 따라가야 한다(열어 둔 채 내려갈 수 있다).
  quality.onChange(() => { if (open) paint(); });

  return {
    setOpen,
    get isOpen() { return open; },
    // 검사용 — 단추가 실제로 단수를 바꾸는가
    _btns: () => btns.map((b) => b.dataset.q),
    _texts: settingsTexts,
    _click: (q) => { const b = btns.find((x) => x.dataset.q === q); if (b) b.click(); return quality.name; },
    deviceDefault,
  };
}
