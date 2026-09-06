// 사당 표지 — **한 곳에.**
//
// ★ 다섯 색의 문(시간의 사당 r3)과 마지막 신의 제단은 사당을 **모양**으로 가리킨다.
//   막대·원·원반·팔면체·원뿔. 그런데 그 모양이 StrataGates.js 안에 배열 인덱스로만
//   살아 있어서 수첩은 그걸 몰랐다 — 수첩에는 사당 **색**만 적혔다. 표지는 모양,
//   수첩은 색. 단서가 한 단계 비어 있어서 "기억 못 하면 25번 눌러서 푸는 방"이었다.
//
//   여기 한 곳에 두고 셋이 같이 읽는다. 3D(geom)와 수첩(svg)이 같은 표에서 나온다.
//   그래야 수첩이 **도구**가 된다 — 다섯 색의 문 앞에서 수첩을 펴면 답이 있다.
//   답을 흘리는 것이 아니다. 아이가 여섯 사당에서 **직접 적은** 것을 다시 읽는 것이다.
//
// 순서는 StrataGates.SHRINE_COLORS와 같다(균형·그림자·분리·물·화산). 시간은 표지가 없다 —
// 자기 사당 안에서 자기를 가리키는 문은 없다.
export const MARKS = [
  { id: 'balance', name: '균형', label: '막대',
    svg: '<rect x="2" y="11" width="20" height="3" rx="1"/>' },
  { id: 'shadow', name: '그림자', label: '원',
    svg: '<circle cx="12" cy="12" r="8"/>' },
  { id: 'sift', name: '분리', label: '원반',
    svg: '<ellipse cx="12" cy="12" rx="9" ry="3.6"/>' },
  { id: 'water', name: '물', label: '팔면체',
    svg: '<path d="M12 2 L21 12 L12 22 L3 12 Z"/>' },
  { id: 'fire', name: '화산', label: '원뿔',
    svg: '<path d="M12 2 L21 20 L3 20 Z"/>' },
];

export const markOf = (id) => MARKS.find((m) => m.id === id) || null;

// 수첩에 찍는 작은 표지. 색은 그 사당의 잉크색으로 채운다.
export const markSvg = (id, fill, px = 14) => {
  const m = markOf(id);
  if (!m) return '';
  return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="${fill}" `
    + `style="vertical-align:-2px;margin-right:5px" aria-label="${m.label} 표지">${m.svg}</svg>`;
};
