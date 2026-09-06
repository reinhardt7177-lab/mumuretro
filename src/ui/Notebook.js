// 탐사 수첩 — 앞사람이 남긴 질문 여섯. 답은 손으로 해 봐야 채워진다.
//
// ★ 이 화면이 곧 할 일 목록이다. 무엇을 알아내야 하는지는 말해 주지만
//   **어디로 가라고는 하지 않는다.** 지도가 다녀온 것만 기록하는 것과 같은 규칙 —
//   화살표가 답을 알려주기 시작하면 그 순간 이 게임은 문제가 아니라 심부름이 된다.
//
// 앞사람 글씨만 손글씨체다. 장식이 아니라 **화자를 가르는 장치**다 —
// 질문은 남이 쓴 것이고 답은 내가 쓴 것이라는 게 글씨만 봐도 읽혀야 한다.
import { NOTE_TITLE, NOTES } from '../shrine/dialogue.js';
import { registerOverlay, soloOpen } from './overlay.js';
import { PORTAL_CODE } from '../world/Lab.js';
import { KINDS as FORAGE_KINDS, LEGEND, LEGEND_NOTE, LEGEND_LOCKED, BEASTS } from '../data/forage.js';

const CSS = `
#nb{position:fixed;inset:0;z-index:40;display:none;place-items:center;
  background:rgba(8,10,9,.93);backdrop-filter:blur(3px);
  font-family:"Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif;color:#23272a}
#nb.show{display:grid}
#nb .page{width:min(92vw,660px);max-height:88vh;overflow:auto;
  background:#f3f2ec;border-radius:3px;box-shadow:0 24px 60px -28px #000;
  background-image:
    linear-gradient(rgba(90,110,120,.10) 1px,transparent 1px),
    linear-gradient(90deg,rgba(90,110,120,.10) 1px,transparent 1px);
  background-size:22px 22px,22px 22px}
#nb .hd{display:flex;align-items:baseline;gap:12px;padding:18px 24px 14px;
  border-bottom:2px solid #23272a}
#nb .hd .t{font-size:19px;font-weight:700;letter-spacing:.02em}
#nb .hd .n{margin-left:auto;font-size:12px;color:#7d878c;
  font-variant-numeric:tabular-nums}
#nb .row{display:grid;grid-template-columns:30px 1fr;gap:0 12px;
  padding:13px 24px;border-bottom:1px dashed #d8dad2}
#nb .row:last-of-type{border-bottom:0}
#nb .no{font-size:12px;color:#9aa3a7;padding-top:6px;font-variant-numeric:tabular-nums}
#nb .q{font-family:"Nanum Pen Script","Gowun Batang","Malgun Gothic",cursive;
  font-size:23px;line-height:1.45;color:#2f5490}
#nb .a{font-size:14.5px;line-height:1.7;color:#3d474c;margin-top:2px}
#nb .a.blank{color:#a6aeb2;font-style:italic}
#nb .a b{color:#1d6a5e;font-weight:600}
#nb .ft{padding:14px 24px 18px;display:flex;gap:16px;align-items:center;
  font-size:12px;color:#7d878c;border-top:1px solid #dfe1da}
#nb .ft .close{margin-left:auto}
#nb .coord{padding:15px 24px;border-top:1px dashed #d8dad2;
  display:flex;align-items:center;gap:14px;flex-wrap:wrap}
#nb .coord .lab{font-size:12px;color:#7d878c;letter-spacing:.06em}
#nb .coord .num{font-family:"Nanum Pen Script","Gowun Batang",cursive;
  font-size:34px;color:#2f5490;letter-spacing:.16em;line-height:1}
#nb .coord .num i{font-style:normal;color:#a9a294;letter-spacing:0}
#nb .coord .why{font-family:"Nanum Pen Script","Gowun Batang",cursive;
  font-size:19px;color:#2f5490;flex:1;min-width:220px}
#nb .fg{padding:14px 24px;border-top:1px dashed #d8dad2}
#nb .fg h4{margin:0 0 9px;font-size:12px;letter-spacing:.06em;color:#7d878c;font-weight:600}
#nb .fg .row2{display:grid;grid-template-columns:14px 1fr;gap:0 10px;padding:7px 0;
  border-bottom:1px dotted #e0e2da}
#nb .fg .row2:last-child{border-bottom:0}
#nb .fg .dot{width:10px;height:10px;border-radius:2px;margin-top:5px;
  background:#cfd2c8;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
#nb .fg .nm{font-size:13.5px;font-weight:600;color:#3d474c}
#nb .fg .nm.todo{color:#a6aeb2;font-weight:400}
#nb .fg .rule{font-family:"Nanum Pen Script","Gowun Batang",cursive;
  font-size:17px;line-height:1.4;color:#2f5490;margin-top:1px}
#nb .fg .said{font-size:12.5px;color:#5c666b;margin-top:2px}
#nb .lg{padding:14px 24px;border-top:2px solid #23272a;background:
  linear-gradient(180deg,rgba(180,170,140,.13),transparent 60%)}
#nb .lg h4{margin:0 0 8px;font-size:12px;letter-spacing:.06em;color:#7d878c;font-weight:600}
#nb .lg .sealed{font-family:"Nanum Pen Script","Gowun Batang",cursive;
  font-size:19px;color:#9aa3a7;line-height:1.5}
#nb .lg .said2{font-family:"Nanum Pen Script","Gowun Batang",cursive;
  font-size:19px;color:#2f5490;line-height:1.5;margin-bottom:9px}
#nb .lg .row3{display:grid;grid-template-columns:14px 1fr;gap:0 10px;padding:6px 0}
#nb .lg .dot{width:10px;height:10px;border-radius:2px;margin-top:5px;background:#cfd2c8;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
#nb .lg .nm{font-size:13.5px;font-weight:600;color:#3d474c}
#nb .lg .nm.todo{color:#a6aeb2;font-weight:400}
#nb .lg .where{font-size:12.5px;color:#5c666b;margin-top:1px}
#nb .memo{padding:16px 24px;font-family:"Nanum Pen Script","Gowun Batang",cursive;
  font-size:21px;line-height:1.5;color:#2f5490;border-top:1px dashed #d8dad2}
@media (max-width:640px){#nb .q{font-size:20px}#nb .a{font-size:13.5px}}`;

// 사당 여섯의 색 — 채워진 답에만 쓴다.
const TINT = { balance: '#1d6a5e', shadow: '#6a6650', sift: '#95610f',
  water: '#186a97', fire: '#ac3620', strata: '#63499c' };

export function buildNotebook(shrines, specs, getForage) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'nb';
  el.innerHTML = `<div class="page">
    <div class="hd"><span class="t">${NOTE_TITLE}</span><span class="n" id="nbN"></span></div>
    <div id="nbRows"></div>
    <div class="coord">
      <span class="lab">별의 자리</span>
      <span class="num">${PORTAL_CODE[0]} · ${PORTAL_CODE[1]} · <i>▓</i></span>
      <span class="why">셋째 자리는 잉크가 번졌다.<br>앞의 두 자리를 더한 수라고 적어 뒀는데.</span>
    </div>
    <div class="fg"><h4 id="nbFgN">채집</h4><div id="nbFg"></div></div>
    <div class="lg"><h4 id="nbLgN">마지막 장</h4><div id="nbLg"></div></div>
    <div class="memo" id="nbMemo"></div>
    <div class="ft"><span>앞사람의 글씨는 파란색이에요</span>
      <span class="close">N — 닫기</span></div>
  </div>`;
  document.body.appendChild(el);
  const rows = el.querySelector('#nbRows');
  const elN = el.querySelector('#nbN');
  const elMemo = el.querySelector('#nbMemo');
  const elFg = el.querySelector('#nbFg');
  const elFgN = el.querySelector('#nbFgN');
  const elLg = el.querySelector('#nbLg');
  const elLgN = el.querySelector('#nbLgN');

  let open = false, has = false;
  // 앞사람 글씨는 **화자를 가르는 장치**다. 처음 열 때 받아오면 그 한 번은
  // 폴백 글꼴로 그려졌다가 바뀐다 — 가르는 장치가 첫 장면에서만 안 듣는다.
  if (document.fonts && document.fonts.load) {
    document.fonts.load('23px "Nanum Pen Script"', Object.values(NOTES).map((n) => n.q).join(''))
      .catch(() => {});
  }

  const draw = () => {
    const done = shrines.shrines.filter((s) => s.cleared).length;
    elN.textContent = `${specs.length}면 중 ${done}면 채움`;
    rows.innerHTML = specs.map((sp, i) => {
      const note = NOTES[sp.id] || { q: '?', a: '?' };
      const cleared = shrines.shrines[i] && shrines.shrines[i].cleared;
      const a = cleared
        ? `<div class="a"><b style="color:${TINT[sp.id]}">${note.a}</b></div>`
        : '<div class="a blank">— 아직 비어 있다</div>';
      return `<div class="row"><div class="no">${String(i + 1).padStart(2, '0')}</div>
        <div><div class="q">${note.q}</div>${a}</div></div>`;
    }).join('');
    // ── 채집 장 ────────────────────────────────────────────────────────
    // ★ 아직 못 얻은 것에는 **앞사람이 적어 둔 규칙**이 파란 글씨로 남아 있다.
    //   그게 곧 힌트고, 답은 아니다 — 무엇을 보라고만 한다. 얻고 나면 규칙이
    //   사라지고 내가 알아낸 한 줄이 그 자리에 들어선다. 수첩이 채워진다는 건
    //   남의 글씨가 내 글씨로 바뀐다는 뜻이다.
    const fg = getForage && getForage();
    const fgOn = fg && Object.values(fg.found).some(Boolean);
    elFgN.textContent = fg
      ? `채집 — ${Object.values(fg.found).filter(Boolean).length}/${FORAGE_KINDS.length}`
      : '채집';
    elFg.innerHTML = FORAGE_KINDS.map((k) => {
      const has = fg && fg.found[k.id];
      let body = has
        ? `<div class="said">${k.got}</div>`
        : `<div class="rule">${(fg && fg.RULES[k.id]) || ''}</div>`;
      // ★ 고기는 한 가지가 아니다. 미끼가 무엇이 오는지를 정하므로 넷이다 —
      //   어느 것을 잡아 봤는지 한 줄로 보여 준다(요리가 이걸 볼 것이다).
      let name = k.label;
      if (k.id === 'meat' && fg) {
        const got = BEASTS.filter((b) => fg.caught[b.id] > 0);
        name = `들짐승 고기 — ${got.length}/${BEASTS.length}종`;
        body += `<div class="said" style="color:#7d878c">${
          BEASTS.map((b) => (fg.caught[b.id] > 0
            ? `<b style="color:${k.tint}">${b.meat}</b>` : `<span style="color:#b9c0c3">${b.name}?</span>`))
          .join(' · ')}</div>`;
      }
      return `<div class="row2">
        <div class="dot" style="${has ? `background:${k.tint}` : ''}"></div>
        <div><div class="nm${has ? '' : ' todo'}">${name}</div>${body}</div></div>`;
    }).join('');
    void fgOn;

    // ── 마지막 장 ──────────────────────────────────────────────────────
    // ★ 사당 여섯을 다 깨야 열린다. 열쇠는 구슬이 아니라 **글씨**다 — 앞사람이
    //   끝까지 간 사람에게만 남긴 장이고, 그 장에도 자리는 안 적혀 있다.
    //   "가장 높은 데, 가장 깊은 데, 가장 먼 데" 세 마디가 전부다.
    //   지도는 다녀온 데만 기록하니, 이 셋을 찾으려면 먼저 걸어야 한다 —
    //   그때 비로소 안개 지도가 장식이 아니라 도구가 된다.
    const open6 = done >= specs.length;
    elLgN.textContent = open6
      ? `마지막 장 — ${LEGEND.filter((x) => fg && fg.found[x.id]).length}/${LEGEND.length}`
      : '마지막 장';
    elLg.innerHTML = open6
      ? `<div class="said2">${LEGEND_NOTE.join('<br>')}</div>` + LEGEND.map((x) => {
        const has = fg && fg.found[x.id];
        return `<div class="row3">
          <div class="dot" style="${has ? `background:${x.tint}` : ''}"></div>
          <div><div class="nm${has ? '' : ' todo'}">${has ? x.label : '?'}</div>
          <div class="where">${has ? x.got : x.hint}</div></div></div>`;
      }).join('')
      : `<div class="sealed">${LEGEND_LOCKED}</div>`;

    // 마지막 장 — 여섯을 다 채우기 전에는 앞사람이 무슨 생각이었는지 알 수 없다.
    elMemo.textContent = done >= specs.length
      ? '여섯을 다 채웠다. 답을 지우고 갈까, 두고 갈까.'
      : '(뒷장은 아직 비어 있다)';
  };

  const me = registerOverlay({ get isOpen() { return open; }, close: () => setOpen(false) });
  const setOpen = (v) => {
    // ★ 소포를 열기 전에는 수첩이 **없다.** 없는 걸 N으로 펼 수 있으면
    //   오프닝에서 소포를 열 이유가 사라진다.
    if (v && !has) return;
    if (v) soloOpen(me);            // 전면 화면은 하나만 — overlay.js
    open = v; el.classList.toggle('show', v); if (v) draw();
  };
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyN') { setOpen(!open); e.preventDefault(); }
    else if (e.code === 'Escape' && open) setOpen(false);
  });
  el.addEventListener('click', (e) => { if (e.target === el) setOpen(false); });

  return {
    setOpen, draw,
    get isOpen() { return open; },
    get has() { return has; },
    setHas(v) { has = v; if (!v && open) setOpen(false); },
  };
}
