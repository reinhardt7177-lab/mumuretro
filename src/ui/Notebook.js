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

const CSS = `
#nb{position:fixed;inset:0;z-index:40;display:none;place-items:center;
  background:rgba(8,10,9,.93);backdrop-filter:blur(3px);
  font-family:"Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif;color:#23272a}
#nb.show{display:grid}
#nb .page{width:min(94vw,700px);height:min(88vh,660px);display:flex;flex-direction:column;
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

#nb .hd{display:flex;align-items:baseline;gap:12px;padding:13px 22px 9px;flex:0 0 auto}
#nb .hd .t{font-size:17px;font-weight:700;letter-spacing:.02em}
#nb .hd .n{margin-left:auto;font-size:12px;color:#7d878c;font-variant-numeric:tabular-nums}
#nb .body{flex:1 1 auto;overflow:hidden;padding:0 22px}
#nb .ft{padding:9px 22px 12px;display:flex;gap:14px;align-items:center;flex:0 0 auto;
  font-size:11.5px;color:#7d878c;border-top:1px solid #dfe1da}
#nb .ft .close{margin-left:auto}

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

@media (max-width:640px){
  #nb .page{width:96vw;height:92vh}
  #nb .tab{padding:6px 9px 7px;font-size:12px}
  #nb .tab .k{display:none}
  #nb .qq{font-size:17px}
}`;

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
      <span class="k">${t.key}</span>${t.name}<i class="dot" hidden></i></button>`).join('')}</div>
    <div class="hd"><span class="t" id="nbT"></span><span class="n" id="nbN"></span></div>
    <div class="body" id="nbBody"></div>
    <div class="ft"><span class="hw" style="font-size:15px">앞사람의 글씨는 파란색</span>
      <span class="close">1~5 넘기기 · N 닫기</span></div>
  </div>`;
  document.body.appendChild(el);
  const elBody = el.querySelector('#nbBody');
  const elT = el.querySelector('#nbT');
  const elN = el.querySelector('#nbN');
  const tabBtns = [...el.querySelectorAll('.tab')];

  let open = false, has = false, tab = 'ask';
  // ★ 탭마다 "지난번에 본 상태"를 적어 둔다. 달라졌으면 점이 켜진다.
  //   무엇이 달라졌는지는 말하지 않는다 — 볼 게 생겼다는 것만.
  const seen = {};

  // 자물쇠: 소포를 열기 전에는 수첩이 없다
  const me = registerOverlay({ get isOpen() { return open; }, close: () => setOpen(false) });

  // ── 면마다 무엇을 그리나 ──────────────────────────────────────────────────
  const clearedCount = () => shrines.shrines.filter((s) => s.cleared).length;

  const sigOf = (id) => {
    const fg = getForage && getForage();
    if (id === 'ask') return `${clearedCount()}`;
    if (id === 'field') {
      return fg ? Object.values(fg.found).filter(Boolean).length
        + '/' + BEASTS.filter((b) => fg.caught[b.id] > 0).length : '0';
    }
    if (id === 'mail') return `${clearedCount()}|${has ? 1 : 0}`;
    if (id === 'star') return mapPage ? `${mapPage.exploredPct()}|${clearedCount()}` : '0';
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
      return `<div class="qrow"><div class="qno">${String(i + 1).padStart(2, '0')}</div>
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
      let body = hasIt ? `<div class="fsaid">${k.got}</div>`
        : `<div class="frule hw">${(fg && fg.RULES[k.id]) || ''}</div>`;
      if (k.id === 'meat' && fg) {
        const n = BEASTS.filter((b) => fg.caught[b.id] > 0).length;
        name = `들짐승 고기 — ${n}/${BEASTS.length}종`;
        body += `<div class="beasts">${BEASTS.map((b) => (fg.caught[b.id] > 0
          ? `<b style="color:${k.tint}">${b.meat}</b>`
          : `<span style="color:#c0c6c9">${b.name}?</span>`)).join(' · ')}</div>`;
      }
      return `<div class="frow">
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
    const out = [{ tag: '소포', who: '보낸 사람 없음',
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
      out.push({ tag: sp.name.replace('의 사당', ''), who: k.who, tint: TINT[sp.id],
        html: `<div class="said">${k.orb.join('<br>')}</div>` });
    });
    if (done >= specs.length) {
      const n = fg ? LEGEND.filter((x) => fg.found[x.id]).length : 0;
      out.push({ tag: `마지막 장 ${n}/${LEGEND.length}`, who: '앞사람',
        html: `<div class="said hw" style="font-size:19px">${LEGEND_NOTE.join('<br>')}</div>
          <div class="said" style="margin-top:9px">${LEGEND.map((x) => (fg && fg.found[x.id]
            ? `<b style="color:${x.tint}">${x.label}</b> <span style="color:#7d878c">${x.got}</span>`
            : `<span style="color:#a6aeb2">? — ${x.hint}</span>`)).join('<br>')}</div>` });
      ENDING.forEach(([, who, lines], i) => out.push({ tag: `끝 ${i + 1}`, who,
        html: `<div class="said">${lines.join('<br>')}</div>` }));
    } else {
      out.push({ tag: '?', who: '앞사람',
        html: `<div class="sealed hw">${LEGEND_LOCKED}</div>` });
    }
    return out;
  };

  const drawMail = () => {
    const list = mailList();
    if (mailSel >= list.length) mailSel = list.length - 1;
    const m = list[mailSel];
    elT.textContent = '받은 것 · 들은 것';
    elN.textContent = `${list.length}통 중 ${mailSel + 1}번째`;
    elBody.innerHTML = `<div class="mail">
      <div class="chips">${list.map((x, i) =>
        `<button class="chip${i === mailSel ? ' on' : ''}" data-i="${i}">${x.tag}</button>`).join('')}</div>
      <div class="letter">
        <div class="who" ${m.tint ? `style="color:${m.tint}"` : ''}>${m.who}</div>
        ${m.html}</div></div>`;
    for (const b of elBody.querySelectorAll('.chip')) {
      b.addEventListener('click', (e) => { e.stopPropagation(); mailSel = +b.dataset.i; drawMail(); });
    }
  };

  const drawStar = () => {
    elT.textContent = '이 별의 지도';
    elN.textContent = mapPage ? `${mapPage.exploredPct()}% 둘러봄` : '';
    elBody.innerHTML = `<div class="mapwrap">
      <div class="mapstats">
        <span><b id="nbMs">0 / 6</b> 사당</span>
        <span><b id="nbMe">0%</b> 둘러본 곳</span>
        <span class="hw" style="font-size:16px">가 본 데만 밝아진다</span>
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
    elBody.innerHTML = `<div class="soon">
      <div class="big">아직 아무것도 못 만들어 봤다.</div>
      <div class="hw" style="font-size:19px">불을 피울 데부터 찾아야겠지.</div></div>`;
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

  const draw = () => {
    if (!open) { syncDots(); return; }
    for (const b of tabBtns) b.classList.toggle('on', b.dataset.tab === tab);
    // 지도는 캔버스를 옮겨 붙이므로, 다른 면으로 갈 때 떼어 둔다
    if (tab !== 'star' && mapPage && mapPage.canvas.parentElement) {
      mapPage.canvas.remove();
    }
    (DRAW[tab] || drawAsk)();
    seen[tab] = sigOf(tab);          // 본 면은 점이 꺼진다
    syncDots();
  };

  const go = (id) => { tab = id; if (open) draw(); };

  const setOpen = (v) => {
    if (v && !has) return;
    if (v) soloOpen(me);
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
    setHas(v) { has = v; if (!v && open) setOpen(false); },
    // 검사 M — 면마다 스크롤이 생기지 않는가
    pageMetrics() {
      const was = open, wasTab = tab;
      const out = {};
      if (!open) { open = true; el.classList.add('show'); }
      for (const t of TABS) {
        tab = t.id; draw();
        const scroller = elBody.querySelector('.letters') || elBody;
        out[t.id] = { need: scroller.scrollHeight, have: scroller.clientHeight };
      }
      tab = wasTab;
      if (!was) { open = false; el.classList.remove('show'); } else draw();
      return out;
    },
  };
}
