// 전면 화면은 한 번에 하나만.
//
// ★ 지도와 수첩은 둘 다 화면을 덮는 같은 층(z-index 40)이다. M으로 지도를 열어 둔 채
//   N을 누르면 수첩이 그 위에 겹치는데, **아래 깔린 지도는 자기가 열려 있다고 생각한다.**
//   그 상태에서 M을 누르면 지도는 "닫힘"이 되지만 보이는 건 수첩이라 아무 일도 안 일어난 것처럼
//   보이고, 다시 M을 눌러야 열린다. 눌렀는데 반응이 없는 것만큼 그만두게 만드는 건 없다.
//
// 각자 keydown을 자기 안에서 받으므로(그게 맞다 — 열고 닫는 책임은 그 화면 것이다)
// 밖에서 감싸는 걸로는 못 막는다. 여는 쪽이 먼저 물어보게 한다.
const panels = [];

export function registerOverlay(p) { panels.push(p); return p; }

// 나를 열기 직전에 부른다 — 다른 전면 화면은 전부 닫힌다.
export function soloOpen(self) {
  for (const p of panels) if (p !== self && p.isOpen) p.close();
}
