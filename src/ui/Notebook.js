// 탐사 수첩 — 앞사람이 남긴 책. 다섯 면으로 접혀 있다.
//
// ★ 왜 다시 지었나. 재 보니 **505px 창에 내용이 1389px**이었다 — 2.75화면.
//   그리고 여기에 지도·편지·레시피를 더할 참이었으니 5화면이 된다.
//   두루마리로는 안 된다. 이 수첩은 이 게임에서 **가장 자주 여는 것**이고,
//   자주 여는 것일수록 "찾는 데 걸리는 시간"이 전부다.
//
//   그래서 성공 기준을 하나로 못 박는다 — **모든 면이 스크롤 없이 한 화면에.**
//   검사 M이 그것 하나만 잰다.
//
// ★ 레퍼런스 둘에서 하나씩 가져왔다.
//   · Outer Wilds 함선 일지 — 탭마다 "여기 아직 더 있다" 점. 어디로 가라고는
//     하지 않고 **아직 남았다는 것만** 말한다. 우리 규칙과 같다.
//   · Return of the Obra Dinn — 확정된 사실이 손글씨에서 인쇄체로 바뀐다.
//     우리는 이미 앞사람의 파란 손글씨가 내 글씨로 바뀌는 구조인데,
//     그 전환을 **보이게** 만든 것이 그쪽의 공이다.
//
// ★ 지킴이가 구슬을 줄 때 한 말이 **어디에도 안 남고 있었다.** 대사로 지나가고
//   끝이었다. 이 게임에서 가장 감정적인 문장들이다 — 편지 면이 그걸 붙잡는다.
//   따로 저장하지 않는다. 깬 사당이 곧 읽을 수 있는 편지다.
import { NOTE_TITLE, NOTES } from '../shrine/dialogue.js';
import { KEEPERS, ENDING, OPENING } from '../shrine/dialogue.js';
import { registerOverlay, soloOpen } from './overlay.js';
import { PORTAL_CODE } from '../world/Lab.js';
import { KINDS as FORAGE_KINDS, LEGEND, LEGEND_NOTE, LEGEND_LOCKED, BEASTS }
  from '../data/forage.js';

const CSS_BASE = `
#nb{position:fixed;inset:0;z-index:40;display:none;place-items:center;
  background:rgba(8,10,9,.93);backdrop-filter:blur(3px);
  font-family:"Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif;color:#23272a}
#nb.show{display:grid}
#nb .page{width:min(94vw,700px);height:min(88vh,660px);display:flex;flex-direction:column;
  container-type:size;container-name:pg;
  background:#f3f2ec;border-radius:3px;box-shadow:0 24px 60px -28px #000;overflow:hidden;
  background-image:
    linear-gradient(rgba(90,110,120,.10) 1px,transparent 1px),
    linear-gradient(90deg,rgba(90,110,120,.10) 1px,transparent 1px);
  background-size:22px 22px,22px 22px}

/* 색인 탭 — 진짜 수첩처럼 위에 붙는다 */
#nb .tabs{display:flex;gap:3px;padding:8px 10px 0;background:rgba(35,39,42,.05);
  border-bottom:2px solid #23272a;flex:0 0 auto}
#nb .tab{position:relative;appearance:none;border:0;cursor:pointer;
  padding:7px 13px 8px;border-radius:4px 4px 0 0;font:600 13px/1 inherit;
  color:#7d878c;background:rgba(255,255,255,.35)}
#nb .tab:hover{color:#3d474c;background:rgba(255,255,255,.7)}
#nb .tab.on{color:#23272a;background:#f3f2ec;box-shadow:0 1px 0 0 #f3f2ec}
#nb .tab .k{opacity:.5;font-size:11px;margin-right:4px}
/* ★ "여기 아직 더 있다" — 어디로 가라가 아니라, 볼 게 생겼다는 것만 */
#nb .tab .dot{position:absolute;top:4px;right:5px;width:6px;height:6px;border-radius:99px;
  background:#c0653a;box-shadow:0 0 0 2px #f3f2ec}
#nb .tab .dot[hidden]{display:none}
/* ★ 닫는 길이 **N 키 하나뿐**이었다. 태블릿에는 N이 없다 —
   실제로 아이가 수첩을 열고 못 닫았다(뒤에 깔린 터치 버튼은 z-index가 낮아
   수첩에 덮인다). 바닥글에는 "N 닫기"라고 적혀 있었으니 화면이 거짓말을 한 것이다.
   닫기는 **보이는 자리에** 있어야 한다. */
#nb .x{margin-left:auto;appearance:none;border:0;cursor:pointer;background:transparent;
  color:#7d878c;font:600 20px/1 inherit;width:40px;height:36px;border-radius:6px 6px 0 0}
#nb .x:hover{color:#23272a;background:rgba(255,255,255,.7)}
@media (any-pointer:coarse){#nb .x{width:52px;height:44px;font-size:23px}
  /* 손가락으로 여는 기기에는 1~5 키가 없다. 없는 키를 탭에 적어 두지 않는다. */
  #nb .tab .k{display:none}
  #nb .tab{padding:8px 14px 9px}}

#nb .hd{display:flex;align-items:baseline;gap:12px;padding:13px 22px 9px;flex:0 0 auto}
#nb .hd .t{font-size:17px;font-weight:700;letter-spacing:.02em}
#nb .hd .n{margin-left:auto;font-size:12px;color:#7d878c;font-variant-numeric:tabular-nums}
/* ★ overflow:hidden이었다. 화면이 짧으면(가로로 든 폰: 92vh = 359px) 물음 여섯 중
   **넷이 그냥 잘려 나갔다** — 없어진 줄 모르게. 잘리는 것보다는 굴러가는 게 낫다.
   설계 목표는 여전히 "스크롤 없음"이고 검사 M이 440·540·660에서 그걸 지킨다.
   이 스크롤은 그 아래 높이에서의 **예비**지 기본이 아니다. */
#nb .body{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding:0 22px;
  -webkit-overflow-scrolling:touch;overscroll-behavior:contain}
#nb .ft{padding:9px 22px 12px;display:flex;gap:14px;align-items:center;flex:0 0 auto;
  font-size:11.5px;color:#7d878c;border-top:1px solid #dfe1da}
#nb .ft .close{margin-left:auto}
#nb .ft .lg{display:inline-flex;align-items:center;gap:5px}
#nb .ft .lg i{width:6px;height:6px;border-radius:99px;background:#c0653a;display:block}

/* 앞사람 글씨 — 화자를 가르는 장치다. 장식이 아니다. */
.hw{font-family:"Nanum Pen Script","Gowun Batang","Malgun Gothic",cursive;color:#2f5490}

/* ── 물음 ── */
#nb .qrow{display:grid;grid-template-columns:26px 1fr;gap:0 10px;
  padding:8px 0;border-bottom:1px dashed #d8dad2}
#nb .qrow:last-child{border-bottom:0}
#nb .qno{font-size:11px;color:#9aa3a7;padding-top:5px;font-variant-numeric:tabular-nums}
#nb .qq{font-size:19px;line-height:1.3}
#nb .qa{font-size:13px;line-height:1.5;color:#3d474c;margin-top:1px}
#nb .qa.blank{color:#a6aeb2;font-style:italic;font-size:12.5px}
#nb .qa b{font-weight:600}

/* ── 들 ── */
#nb .frow{display:grid;grid-template-columns:12px 1fr;gap:0 9px;padding:6px 0;
  border-bottom:1px dotted #e0e2da}
#nb .frow:last-child{border-bottom:0}
#nb .fdot{width:10px;height:10px;border-radius:2px;margin-top:5px;background:#cfd2c8;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
#nb .fnm{font-size:13px;font-weight:600;color:#3d474c}
#nb .fnm.todo{color:#a6aeb2;font-weight:400}
#nb .frule{font-size:16px;line-height:1.3;margin-top:1px}
#nb .fsaid{font-size:12px;line-height:1.45;color:#5c666b;margin-top:1px}
#nb .beasts{font-size:11.5px;color:#8b9399;margin-top:2px}

/* ── 편지 ── */
/* ★ 편지는 쌓인다. 한 줄로 이으면 862px이 넘쳤다(소포 + 지킴이 여섯 + 마지막 장
   + 엔딩 셋 = 열한 통). 그런데 여기는 **가장 많이 다시 읽는 면**이므로
   "찾는 데 걸리는 시간"이 전부다 — 보낸 사람 조각을 위에 늘어놓고 하나를 편다.
   Outer Wilds 함선 일지가 목록 → 본문인 것과 같은 이유다. */
#nb .mail{display:flex;flex-direction:column;gap:8px;height:100%}
#nb .chips{display:flex;flex-wrap:wrap;gap:4px;flex:0 0 auto}
#nb .chip{appearance:none;border:1px solid #d5d8ce;cursor:pointer;border-radius:99px;
  padding:3px 10px;font:500 11.5px/1.5 inherit;color:#6b757a;background:#fbfaf5}
#nb .chip:hover{border-color:#b9bfb2;color:#3d474c}
#nb .chip.on{background:#23272a;border-color:#23272a;color:#f3f2ec}
#nb .letter{flex:1 1 auto;min-height:0;overflow:auto;padding:9px 2px 0;
  border-top:1px dashed #d8dad2}
#nb .who{font-size:11px;letter-spacing:.05em;color:#7d878c;margin-bottom:5px}
#nb .said{font-size:14.5px;line-height:1.75;color:#2c3438}
#nb .sealed{font-size:17px;line-height:1.5;color:#9aa3a7}

/* ── 별(지도) ── */
#nb .mapwrap{display:flex;flex-direction:column;gap:8px;height:100%}
#nb .mapstats{display:flex;gap:18px;align-items:baseline;font-size:11.5px;color:#7d878c}
#nb .mapstats b{font-size:15px;color:#3d474c;font-variant-numeric:tabular-nums}
#nb .mapframe{flex:1 1 auto;min-height:0;border:1px solid #c9ccc2;border-radius:2px;
  overflow:hidden;background:#0b0f11;display:grid;place-items:center}
#nb .mapframe canvas{display:block;max-width:100%;max-height:100%;image-rendering:pixelated}
#nb .mapkey{display:flex;gap:13px;font-size:11px;color:#8b9399;align-items:center}
#nb .mapkey i{width:8px;height:8px;display:inline-block;transform:rotate(45deg);margin-right:4px}

/* ── 부엌 ── */
#nb .soon{display:grid;place-items:center;height:100%;text-align:center;gap:8px}
#nb .soon .big{font-size:19px;color:#a6aeb2}

/* ── 새로 적힌 줄 ────────────────────────────────────────────────────────
   ★ Obra Dinn이 확정된 사실을 손글씨 → 인쇄체로 바꿔 보여 주는 이유는
     "내가 알아냈다"가 **눈에 보여야** 보상이 되기 때문이다. 우리는 이미
     앞사람의 파란 글씨가 내 글씨로 바뀌는 구조인데, 바뀌는 **순간**을
     아무도 못 봤다 — 수첩을 닫아 둔 사이에 조용히 바뀌어 있었다.
     그래서 한 번만 반짝인다. 두 번째 열 때는 그냥 내 글씨다. */
@keyframes nbNew{
  0%{background:rgba(192,101,58,.26)}
  60%{background:rgba(192,101,58,.26)}
  100%{background:rgba(192,101,58,0)}
}
#nb .nu{animation:nbNew 1.6s ease-out 1;border-radius:3px}
/* 편지 조각은 알약 모양이라 왼쪽 막대가 곡선에 먹힌다. 여긴 테두리로 말한다 —
   그리고 이 테두리는 그 회차 동안 남아 "안 읽은 편지"를 계속 가리킨다. */
#nb .chip.nu{border-color:#c0653a}
#nb .chip.nu.on{animation:none}
@media (prefers-reduced-motion:reduce){
  #nb .nu{animation:none;box-shadow:inset 3px 0 0 #c0653a}
  #nb .chip.nu{box-shadow:none;background:rgba(192,101,58,.16)}
  #nb .chip.nu.on{background:#23272a}
}

@media (max-width:640px){
  #nb .page{width:96vw;height:92vh}
  #nb .tab{padding:6px 9px 7px;font-size:12px}
  #nb .tab .k{display:none}
  #nb .qq{font-size:17px}
}`;

// ── 좁은 화면에서 접는다 ──────────────────────────────────────────────────
// ★ 창 높이 500px에서 물음 면이 **60px 넘쳤다**(필요 371 / 자리 311).
//   검사 M은 그때 열려 있던 창(574px) 하나에서만 재고 있어서 그냥 통과했다.
//   **크기 하나만 보는 검사는 통과해도 아무것도 보장하지 않는다.**
//
//   글씨를 통째로 줄이면 4학년이 읽기 어려워진다. 그러니 좁을 때만 접는다.
//   컨테이너 질의를 쓴 것은 **검사가 창을 못 줄이기 때문**이다 — 수첩 높이만
//   바꿔 놓고 재면 실제로 접힌 모습을 잴 수 있다(검사 M이 셋을 잰다).
//   미디어 질의는 컨테이너 질의를 모르는 브라우저용 예비다.
const TIGHT = `
  #nb .hd{padding:9px 18px 5px}
  #nb .hd .t{font-size:15px}
  #nb .body{padding:0 18px}
  #nb .ft{padding:6px 18px 8px;font-size:11px}
  #nb .qrow{padding:4px 0}
  #nb .qq{font-size:16.5px;line-height:1.2}
  #nb .qa{font-size:12.5px;line-height:1.34}
  #nb .frow{padding:3px 0}
  /* ★ 손글씨 웹폰트(Nanum Pen Script)가 안 실리면 대체 글꼴이 더 넓어 들 면이
     440px에서 47px 넘쳤다. 학교 망은 폰트 CDN을 막는 곳이 있다 — 그 상태가
     기본이라고 보고 접는다. 검사 M은 폰트가 없는 창에서도 통과해야 한다. */
  #nb .frule{font-size:13.5px;line-height:1.18}
  #nb .fsaid{font-size:11.5px;line-height:1.35}
  #nb .said{font-size:13.5px;line-height:1.6}
`;
// 더 낮은 창(가로로 든 폰 등) — 한 단 더 접는다. 그래도 안 들어가면 굴러간다.
const TIGHTER = `
  #nb .tabs{padding:5px 8px 0}
  #nb .tab{padding:5px 10px 6px;font-size:12px}
  #nb .hd{padding:6px 16px 3px}
  #nb .hd .t{font-size:14px}
  #nb .body{padding:0 16px}
  #nb .ft{padding:4px 16px 6px;font-size:10.5px}
  #nb .qrow{padding:3px 0}
  #nb .qq{font-size:15px;line-height:1.18}
  #nb .qa{font-size:11.5px;line-height:1.32}
  #nb .frow{padding:3px 0}
  #nb .frule{font-size:13px;line-height:1.2}
`;
const CSS = CSS_BASE
  + `@container pg (max-height:545px){${TIGHT}}`
  + `@media (max-height:620px){${TIGHT}}`
  + `@container pg (max-height:430px){${TIGHTER}}`
  + `@media (max-height:470px){${TIGHTER}}`
  // 낮고 넓은 창에서는 수첩이 더 넓고 더 높아도 된다 — 남는 건 가로다.
  + `@media (max-height:520px){#nb .page{width:min(96vw,780px);height:95vh}}`;

const TINT = { balance: '#1d6a5e', shadow: '#6a6650', sift: '#95610f',
  water: '#186a97', fire: '#ac3620', strata: '#63499c' };

const TABS = [
  { id: 'star', key: '1', name: '별' },
  { id: 'ask', key: '2', name: '물음' },
  { id: 'field', key: '3', name: '들' },
  { id: 'mail', key: '4', name: '편지' },
  { id: 'kitchen', key: '5', name: '부엌' },
];

export function buildNotebook(shrines, specs, getForage, mapPage) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'nb';
  el.innerHTML = `<div class="page">
    <div class="tabs">${TABS.map((t) => `<button class="tab" data-tab="${t.id}">
      <span class="k">${t.key}</span>${t.name}<i class="dot" hidden></i></button>`).join('')}
      <button class="x" id="nbX" aria-label="수첩 닫기">✕</button></div>
    <div class="hd"><span class="t" id="nbT"></span><span class="n" id="nbN"></span></div>
    <div class="body" id="nbBody"></div>
    <div class="ft"><span class="hw" style="font-size:15px">앞사람의 글씨는 파란색</span>
      <span class="lg"><i></i>새로 적힌 것</span>
      <span class="close" id="nbKeys"></span></div>
  </div>`;
  document.body.appendChild(el);
  const elBody = el.querySelector('#nbBody');
  const elT = el.querySelector('#nbT');
  const elN = el.querySelector('#nbN');
  const tabBtns = [...el.querySelectorAll('.tab')];
  // ★ 없는 키를 안내하지 않는다. 손가락으로 여는 기기에 "N 닫기"라고 적으면
  //   그건 안내가 아니라 막다른 길이다(가진 것만 적는다).
  const byTouch = (navigator.maxTouchPoints || 0) > 0
    && matchMedia('(any-pointer: coarse)').matches;
  el.querySelector('#nbKeys').textContent = byTouch ? '탭을 눌러 넘기기' : '1~5 넘기기 · N 닫기';
  el.querySelector('#nbX').addEventListener('click', (e) => { e.stopPropagation(); setOpen(false); });

  let open = false, has = false, tab = 'ask', measuring = false;
  // 몇 번째로 연 것인가. 반짝임은 **한 번 여는 동안** 한 벌이어야 한다.
  let openSeq = 0;
  // ★ 탭마다 "지난번에 본 상태"를 적어 둔다. 달라졌으면 점이 켜진다.
  //   무엇이 달라졌는지는 말하지 않는다 — 볼 게 생겼다는 것만.
  const seen = {};
  // ★ 한 번 반짝인 줄은 다시 안 반짝인다. 줄마다 열쇠를 달아 두고 여기 모은다.
  //   면 단위(seen)로는 "무엇이" 새로 적혔는지를 못 가리킨다 — 그건 점의 몫이고,
  //   반짝임은 **그 줄**을 가리켜야 보상이 된다.
  const lit = new Set();
  let nu = new Set(), nuFor = null;   // 지금 이 면에서 반짝일 줄 / 그게 어느 회차·어느 면인지

  // 자물쇠: 소포를 열기 전에는 수첩이 없다
  const me = registerOverlay({ get isOpen() { return open; }, close: () => setOpen(false) });

  // ── 면마다 무엇을 그리나 ──────────────────────────────────────────────────
  const clearedCount = () => shrines.shrines.filter((s) => s.cleared).length;
  // 사당 하나를 깼는가 — 수첩 문장이 "배운 뒤에만" 달라지려면 이게 필요하다
  const clearedOf = (id) => {
    const i = specs.findIndex((sp) => sp.id === id);
    return i >= 0 && !!(shrines.shrines[i] && shrines.shrines[i].cleared);
  };

  const sigOf = (id) => {
    const fg = getForage && getForage();
    if (id === 'ask') return `${clearedCount()}`;
    if (id === 'field') {
      return fg ? Object.values(fg.found).filter(Boolean).length
        + '/' + BEASTS.filter((b) => fg.caught[b.id] > 0).length : '0';
    }
    if (id === 'mail') return `${clearedCount()}|${has ? 1 : 0}`;
    if (id === 'star') {
      // ★ 예전엔 둘러본 %를 그대로 서명에 넣었다. 그러면 **한 걸음 걸을 때마다**
      //   점이 켜진다 — 늘 켜져 있는 점은 꺼져 있는 점과 똑같이 아무 뜻이 없다.
      //   지도에서 실제로 **몰랐던 것이 생기는** 순간은 셋뿐이다.
      //   사당이 처음 지도에 뜰 때 · 사당을 깰 때 · 둘러본 땅이 10%씩 늘 때.
      if (!mapPage) return '0';
      const found = shrines.shrines.filter((sh) => mapPage.isSeenDir(sh.dir)).length;
      return `${found}|${clearedCount()}|${Math.floor(mapPage.exploredPct() / 10)}`;
    }
    return '0';
  };

  const drawAsk = () => {
    const done = clearedCount();
    elT.textContent = NOTE_TITLE;
    elN.textContent = `${specs.length}면 중 ${done}면 채움`;
    elBody.innerHTML = specs.map((sp, i) => {
      const note = NOTES[sp.id] || { q: '?', a: '?' };
      const cleared = shrines.shrines[i] && shrines.shrines[i].cleared;
      const a = cleared
        ? `<div class="qa"><b style="color:${TINT[sp.id]}">${note.a}</b></div>`
        : '<div class="qa blank">— 아직 비어 있다</div>';
      return `<div class="qrow"${cleared ? ` data-k="ask:${sp.id}"` : ''}>
        <div class="qno">${String(i + 1).padStart(2, '0')}</div>
        <div><div class="qq hw">${note.q}</div>${a}</div></div>`;
    }).join('');
  };

  const drawField = () => {
    const fg = getForage && getForage();
    const got = fg ? Object.values(fg.found).filter(Boolean).length : 0;
    elT.textContent = '들에서 가져온 것';
    elN.textContent = `${FORAGE_KINDS.length}가지 중 ${Math.min(got, FORAGE_KINDS.length)}가지`;
    elBody.innerHTML = FORAGE_KINDS.map((k) => {
      const hasIt = fg && fg.found[k.id];
      let name = k.label;
      // gotWith가 있으면 그 사당을 깬 뒤에만 그 문장을 쓴다(forage.js 머리말)
      const said = (k.gotWith && clearedOf(k.gotWith.shrine)) ? k.gotWith.text : k.got;
      let body = hasIt ? `<div class="fsaid">${said}</div>`
        : `<div class="frule hw">${(fg && fg.RULES[k.id]) || ''}</div>`;
      if (k.id === 'meat' && fg) {
        const n = BEASTS.filter((b) => fg.caught[b.id] > 0).length;
        name = `들짐승 고기 — ${n}/${BEASTS.length}종`;
        body += `<div class="beasts">${BEASTS.map((b) => (fg.caught[b.id] > 0
          ? `<b data-k="bs:${b.id}" style="color:${k.tint}">${b.meat}</b>`
          : `<span style="color:#c0c6c9">${b.name}?</span>`)).join(' · ')}</div>`;
      }
      return `<div class="frow"${hasIt ? ` data-k="fd:${k.id}"` : ''}>
        <div class="fdot" style="${hasIt ? `background:${k.tint}` : ''}"></div>
        <div><div class="fnm${hasIt ? '' : ' todo'}">${name}</div>${body}</div></div>`;
    }).join('');
  };

  // 편지 목록을 먼저 꾸리고, 고른 하나만 편다.
  let mailSel = 0;
  const mailList = () => {
    const fg = getForage && getForage();
    const done = clearedCount();
    // ★ 파란 손글씨는 **앞사람의 글씨**다(발치에 그렇게 적어 뒀다). 그런데 여기서
    //   주인공 본인의 관찰까지 파란 손글씨로 써 놨었다 — 우리가 세운 규칙을
    //   우리가 어긴 것이고, 그러면 그 색이 아무 뜻도 없어진다.
    //   내가 본 것은 내 글씨, 수첩에 적혀 있던 것만 앞사람 글씨.
    const out = [{ tag: '소포', key: 'parcel', who: '보낸 사람 없음',
      html: `<div class="said">${OPENING.parcel[1].join('<br>')}</div>
        <div class="said" style="margin-top:11px;color:#7d878c;font-size:12px">— 수첩 뒷장에 적혀 있던 것 —</div>
        <div class="said" style="margin-top:3px">별의 자리
        <b class="hw" style="font-size:22px;letter-spacing:.14em">${PORTAL_CODE[0]} · ${PORTAL_CODE[1]} · <i style="font-style:normal;color:#a9a294">▓</i></b></div>
        <div class="said hw" style="font-size:19px">셋째 자리는 잉크가 번졌다.<br>앞의 두 자리를 더한 수라고 적어 뒀는데.</div>` }];
    // ★ 지킴이의 말 — 예전엔 대사로 지나가고 **어디에도 안 남았다.**
    //   이 게임에서 가장 감정적인 문장들이다. 깬 사당이 곧 읽을 수 있는 편지다.
    specs.forEach((sp, i) => {
      if (!(shrines.shrines[i] && shrines.shrines[i].cleared)) return;
      const k = KEEPERS[sp.id];
      out.push({ tag: sp.name.replace('의 사당', ''), key: sp.id, who: k.who, tint: TINT[sp.id],
        html: `<div class="said">${k.orb.join('<br>')}</div>` });
    });
    if (done >= specs.length) {
      const n = fg ? LEGEND.filter((x) => fg.found[x.id]).length : 0;
      // ★ 열쇠에 진행도를 넣으면 안 된다. 0/3 → 1/3으로 바뀔 때마다 **다시**
      //   반짝여서, 반짝임이 "새로 적혔다"가 아니라 "숫자가 변했다"가 된다.
      out.push({ tag: `마지막 장 ${n}/${LEGEND.length}`, key: 'last', who: '앞사람',
        html: `<div class="said hw" style="font-size:19px">${LEGEND_NOTE.join('<br>')}</div>
          <div class="said" style="margin-top:9px">${LEGEND.map((x) => (fg && fg.found[x.id]
            ? `<b style="color:${x.tint}">${x.label}</b> <span style="color:#7d878c">${x.got}</span>`
            : `<span style="color:#a6aeb2">? — ${x.hint}</span>`)).join('<br>')}</div>` });
      ENDING.forEach(([, who, lines], i) => out.push({ tag: `끝 ${i + 1}`, key: `end${i}`, who,
        html: `<div class="said">${lines.join('<br>')}</div>` }));
    } else {
      out.push({ tag: '?', key: 'sealed', who: '앞사람',
        html: `<div class="sealed hw">${LEGEND_LOCKED}</div>` });
    }
    return out;
  };

  // ★ 쪽지를 고를 때마다 면을 통째로 다시 그리고 있었다. 조각(chip)까지 새로
  //   만들어지니 눌린 자리가 사라지고, 새로 온 편지의 반짝임도 함께 지워졌다.
  //   조각은 한 번만 짓고, 고를 때는 **펼친 편지만** 갈아 끼운다.
  const drawMail = () => {
    const list = mailList();
    if (mailSel >= list.length) mailSel = list.length - 1;
    elT.textContent = '받은 것 · 들은 것';
    elBody.innerHTML = `<div class="mail">
      <div class="chips">${list.map((x, i) =>
        `<button class="chip" data-i="${i}" data-k="ml:${x.key}">${x.tag}</button>`).join('')}</div>
      <div class="letter"></div></div>`;
    for (const b of elBody.querySelectorAll('.chip')) {
      b.addEventListener('click', (e) => { e.stopPropagation(); showLetter(+b.dataset.i); });
    }
    showLetter(mailSel);
  };

  function showLetter(i) {
    const list = mailList();
    mailSel = Math.max(0, Math.min(i, list.length - 1));
    const m = list[mailSel];
    elN.textContent = `${list.length}통 중 ${mailSel + 1}번째`;
    for (const b of elBody.querySelectorAll('.chip')) {
      b.classList.toggle('on', +b.dataset.i === mailSel);
    }
    const L = elBody.querySelector('.letter');
    if (L) {
      L.innerHTML = `<div class="who" ${m.tint ? `style="color:${m.tint}"` : ''}>${m.who}</div>${m.html}`;
      L.scrollTop = 0;
    }
  }

  const drawStar = () => {
    elT.textContent = '이 별의 지도';
    elN.textContent = mapPage ? `${mapPage.exploredPct()}% 둘러봄` : '';
    elBody.innerHTML = `<div class="mapwrap">
      <div class="mapstats">
        <span><b id="nbMs">0 / 6</b> 사당</span>
        <span><b id="nbMe">0%</b> 둘러본 곳</span>
        <span>가 본 데만 밝아진다</span>
      </div>
      <div class="mapframe" id="nbMap"></div>
      <div class="mapkey">
        <span><i style="background:#fff;border-radius:99px;transform:none"></i>나</span>
        <span><i style="background:#6fe3d2"></i>아직 못 깬 사당</span>
        <span><i style="background:#ffd27a"></i>깬 사당</span>
        <span><i style="background:#7fd8ff"></i>내림판</span>
      </div></div>`;
    if (mapPage) {
      el.querySelector('#nbMap').appendChild(mapPage.canvas);
      mapPage.draw();
      el.querySelector('#nbMs').textContent = `${clearedCount()} / ${shrines.shrines.length}`;
      el.querySelector('#nbMe').textContent = `${mapPage.exploredPct()}%`;
    }
  };

  const drawKitchen = () => {
    elT.textContent = '부엌';
    elN.textContent = '';
    // ★ 여기 두 줄 다 **주인공의 생각**인데 아랫줄이 파란 손글씨(hw)였다.
    //   파란색은 앞사람의 글씨라고 화면 아래에 못 박아 놓고 우리가 어겼다 —
    //   편지 면에서 똑같은 실수를 이미 한 번 잡았는데 여기 남아 있었다.
    //   색이 화자를 가르는 장치인 이상, 한 군데만 어겨도 그 색은 뜻을 잃는다.
    elBody.innerHTML = `<div class="soon">
      <div class="big">아직 아무것도 못 만들어 봤다.</div>
      <div style="font-size:15px;color:#8b9399">불을 피울 데부터 찾아야겠지.</div></div>`;
  };

  const DRAW = { star: drawStar, ask: drawAsk, field: drawField,
    mail: drawMail, kitchen: drawKitchen };

  const syncDots = () => {
    for (const t of TABS) {
      const btn = tabBtns.find((b) => b.dataset.tab === t.id);
      const changed = seen[t.id] !== undefined && seen[t.id] !== sigOf(t.id);
      btn.querySelector('.dot').hidden = !changed;
    }
  };

  // ★ 새로 적힌 줄만 한 번 반짝인다.
  //   검사가 다섯 면을 훑을 때(measuring)는 반짝이지도, 봤다고 적지도 않는다 —
  //   검사가 한 번 지나가고 나면 아이가 볼 반짝임이 **하나도 안 남는다.**
  // ★ 처음엔 "그릴 때마다 아직 안 반짝인 줄을 반짝인다"로 짰다. 그런데 한 번
  //   여는 동안 같은 면이 두 번 그려지면(탭을 누르고 곧바로 열거나, 편지에서
  //   쪽지를 고르면) **두 번째 그림에서 표시가 통째로 사라졌다** — 첫 그림이
  //   이미 다 "봤다"고 적어 버려서다. 실제로 그렇게 사라지는 걸 보고 고쳤다.
  //   그래서 반짝일 줄은 (회차, 면)마다 **한 번만 정하고**, 다시 그려도 그대로 쓴다.
  const flash = () => {
    if (measuring) return;
    const tag = `${openSeq}:${tab}`;
    if (nuFor !== tag) {
      nuFor = tag;
      nu = new Set();
      for (const n of elBody.querySelectorAll('[data-k]')) {
        if (lit.has(n.dataset.k)) continue;
        nu.add(n.dataset.k); lit.add(n.dataset.k);
      }
    }
    for (const n of elBody.querySelectorAll('[data-k]')) {
      if (nu.has(n.dataset.k)) n.classList.add('nu');
    }
  };

  const draw = () => {
    if (!open) { syncDots(); return; }
    for (const b of tabBtns) b.classList.toggle('on', b.dataset.tab === tab);
    // 지도는 캔버스를 옮겨 붙이므로, 다른 면으로 갈 때 떼어 둔다
    if (tab !== 'star' && mapPage && mapPage.canvas.parentElement) {
      mapPage.canvas.remove();
    }
    (DRAW[tab] || drawAsk)();
    flash();
    seen[tab] = sigOf(tab);          // 본 면은 점이 꺼진다
    syncDots();
  };

  const go = (id) => { tab = id; if (open) draw(); };

  const setOpen = (v) => {
    if (v && !has) return;
    if (v) soloOpen(me);
    if (v && !open) openSeq++;
    open = v;
    el.classList.toggle('show', v);
    if (v) draw(); else syncDots();
  };

  for (const b of tabBtns) {
    b.addEventListener('click', (e) => { e.stopPropagation(); go(b.dataset.tab); });
  }
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyN') { setOpen(!open); e.preventDefault(); return; }
    if (e.code === 'KeyM') {                       // ★ M은 이제 수첩의 지도 면이다
      if (!has || !(mapPage && mapPage.has)) return;
      if (open && tab === 'star') setOpen(false); else { tab = 'star'; setOpen(true); }
      e.preventDefault(); return;
    }
    if (!open) return;
    if (e.code === 'Escape') { setOpen(false); e.preventDefault(); return; }
    const t = TABS.find((x) => e.code === `Digit${x.key}`);
    if (t) { go(t.id); e.preventDefault(); }
  });
  el.addEventListener('click', (e) => { if (e.target === el) setOpen(false); });

  return {
    setOpen, draw, go,
    get isOpen() { return open; },
    get tab() { return tab; },
    get has() { return has; },
    setHas(v) {
      has = v;
      if (v) {
        // ★ 점이 켜지는 조건이 `seen[id] !== undefined && 달라짐`이었다. seen은
        //   **그 면을 한 번 그린 뒤에야** 생기므로, 한 번도 안 열어 본 면은
        //   내용이 아무리 채워져도 영영 점이 안 떴다 — 첫 사당을 깨도 물음 탭은
        //   조용했다. 점이 가장 필요한 때가 바로 그때인데.
        //   수첩이 생기는 순간의 상태를 기준으로 못 박는다.
        for (const t of TABS) seen[t.id] = sigOf(t.id);
        // 편지만 예외. 소포 편지는 이 순간 **이미 와 있는, 안 읽은 것**이다.
        // 기준을 비워 두어 처음부터 점이 켜진 채로 시작한다.
        seen.mail = '';
      }
      if (!v && open) setOpen(false);
    },

    // ── 검사용 ──────────────────────────────────────────────────────────
    // 검사 M — 면마다 스크롤이 생기지 않는가. pageH를 주면 그 높이로 접어 놓고 잰다
    // (컨테이너 질의라 실제로 접힌 모습이 나온다).
    pageMetrics(pageH) {
      const was = open, wasTab = tab, wasSel = mailSel;
      const page = el.querySelector('.page');
      const savedH = page.style.height;
      if (pageH) page.style.height = `${pageH}px`;
      measuring = true;
      const out = {};
      if (!open) { open = true; el.classList.add('show'); }
      const put = (id) => {
        out[id] = { need: elBody.scrollHeight, have: elBody.clientHeight };
        // ★ 예전엔 `.letters`를 찾고 있었다 — 그런 클래스는 없다(`.letter`다).
        //   그래서 **편지 면은 아무것도 안 재고** 통과하고 있었다.
        //   면의 뿌리가 height:100%인 면(편지·별·부엌)은 elBody가 절대 안 넘치므로,
        //   그 면들은 안쪽 스크롤러를 봐야 재는 뜻이 있다.
        const L = elBody.querySelector('.letter');
        if (L) out[`${id}:편지`] = { need: L.scrollHeight, have: L.clientHeight };
      };
      for (const t of TABS) {
        tab = t.id; draw();
        if (t.id !== 'mail') { put(t.id); continue; }
        // 편지는 통마다 길이가 다르다. 열한 통을 다 펴 본다.
        const chips = [...elBody.querySelectorAll('.chip')];
        for (let i = 0; i < chips.length; i++) {
          mailSel = i; drawMail();
          put(`mail#${i}`);
        }
      }
      tab = wasTab; mailSel = wasSel;
      page.style.height = savedH;
      measuring = false;
      if (!was) { open = false; el.classList.remove('show'); } else draw();
      return out;
    },
    // 점이 켜져 있는 면 / 이번에 반짝인 줄 — 검사가 눈 대신 본다
    dots: () => TABS.filter((t) => !tabBtns.find((b) => b.dataset.tab === t.id)
      .querySelector('.dot').hidden).map((t) => t.id),
    flashed: () => [...elBody.querySelectorAll('.nu')].map((n) => n.dataset.k),
    // ★ 검사가 수첩을 열면 그때 **반짝임이 한 번 소모된다.** 검사가 지나간 뒤
    //   아이가 볼 것이 없어지면 그건 검사가 게임을 망가뜨린 것이다.
    //   검사가 끝나고 원래대로 돌려놓을 수 있게 열어 둔다.
    _state: () => ({ lit: [...lit], seen: { ...seen } }),
    _restore: (st) => {
      lit.clear(); st.lit.forEach((k) => lit.add(k));
      for (const k in seen) delete seen[k];
      Object.assign(seen, st.seen);
      nuFor = null;
    },
  };
}
