// 전환 섬광 — 씬을 갈아 끼우는 순간을 덮는다.
//
// ★ 연구실에서 별로, 별에서 연구실로 갈 때 예전엔 **한 프레임 만에 화면이 통째로
//   바뀌었다.** 삼 년을 붙든 장치가 처음 작동하는 장면인데 컷이 튀는 것으로만
//   보였다. 씬 전환은 원래 눈에 거슬리는 일이고, 그걸 감추는 가장 싼 방법이
//   한 번 하얗게 덮었다 걷는 것이다.
//
// 3D가 아니라 DOM으로 한다. 씬을 넘나드는 연출이라 어느 씬에도 속하지 않아야 하고,
// 무엇보다 렌더 순서·안개·후처리에 걸리지 않는다.
const CSS = `
#flash{position:fixed;inset:0;z-index:44;pointer-events:none;opacity:0;background:#dff2ff}
#flash.on{opacity:.92}
@media (prefers-reduced-motion:reduce){#flash{display:none}}`;

export function buildFlash() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'flash';
  document.body.appendChild(el);

  return {
    // color: 덮는 색 · fade: 걷히는 데 걸리는 시간(ms)
    play(color = '#dff2ff', fade = 620) {
      el.style.background = color;
      el.style.transition = 'none';
      el.classList.add('on');
      // 한 프레임 뒤에 걷기 시작한다 — 같은 프레임에 지우면 transition이 안 걸린다
      requestAnimationFrame(() => {
        el.style.transition = `opacity ${fade}ms cubic-bezier(.2,.7,.3,1)`;
        el.classList.remove('on');
      });
    },
  };
}
