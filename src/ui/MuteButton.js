// 음소거 — 언제나 보이는 단추 하나.
//
// ★ 교실에서 스무 대가 동시에 울리면 이 게임은 못 쓴다. 소리를 끄는 길이
//   **언제나 보여야** 하고, 터치 UI 안에 두면 안 된다 — 그건 폰에서만 뜬다.
//   "상시 표시는 다섯뿐"과 부딪히지 않는다: 이건 게임 정보가 아니라 기기 조작이고,
//   수첩·지도처럼 오른쪽 위 같은 층에 붙는다.
import { setMuted, isMuted, startAudio } from '../core/Audio.js';

const CSS = `
#mute{position:fixed;top:calc(14px + env(safe-area-inset-top));
  right:calc(14px + env(safe-area-inset-right));z-index:31;
  width:38px;height:38px;border-radius:999px;appearance:none;cursor:pointer;
  display:grid;place-items:center;font-size:17px;line-height:1;
  background:rgba(14,22,26,.5);border:1px solid rgba(180,214,220,.28);color:#dfe9ea;
  backdrop-filter:blur(4px);-webkit-tap-highlight-color:transparent;
  transition:transform .08s ease,background .12s ease}
#mute:hover{background:rgba(14,22,26,.72)}
#mute:active{transform:scale(.92)}
#mute.off{color:#8b959a}
/* 터치 기기에서는 지도·수첩 단추가 오른쪽 위를 쓴다 — 그 아래로 내려간다. */
@media (any-pointer:coarse){#mute{top:calc(176px + env(safe-area-inset-top));width:46px;height:46px;font-size:19px}}
@media (any-pointer:coarse) and (min-width:820px) and (min-height:620px){
  #mute{top:calc(218px + env(safe-area-inset-top));width:58px;height:58px;font-size:22px;
    right:calc(24px + env(safe-area-inset-right))}}
/* 시작 화면·끝 카드에서는 내린다 — 그 화면은 그림이 전부다. */
body.titling #mute{display:none}`;

export function buildMuteButton() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('button');
  el.id = 'mute';
  el.type = 'button';
  document.body.appendChild(el);

  const paint = () => {
    const m = isMuted();
    el.textContent = m ? '🔇' : '🔊';
    el.classList.toggle('off', m);
    el.setAttribute('aria-label', m ? '소리 켜기' : '소리 끄기');
    el.setAttribute('aria-pressed', String(m));
  };
  paint();

  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();               // 시작 화면의 "아무 데나 눌러 시작"에 안 새게
    startAudio();
    setMuted(!isMuted());
    paint();
    el.blur();
  });

  return { el, paint };
}
