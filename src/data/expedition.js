import { LAB, SHRINE_THEMES } from './lighting.js';

// 첫 탐사 구간. 기존 사당·채집 좌표는 유지한다. 단위는 위도/경도(도).
export const TRAIL_COLORS = { stone: LAB.stoneLite, brass: LAB.brassDim,
  wood: LAB.wood, cloth: LAB.paper, gate: SHRINE_THEMES.water.glow };
export const FIRST_TRAIL = {
  overlook: [22, 0], waterway: [9, 14],
  ridge: [[6, -18], [9, -13], [13, -10], [17, -6], [20, -3], [22, 0]],
  descent: [[22, 0], [20, 6], [15, 9], [11, 8], [9, 14]],
  meadow: [[6, -18], [3, -10], [3, -2], [3, 7], [9, 14]],
};
export const TRAIL_TEXT = {
  found: '바람고개에 올랐다. 낮은 들길과 얼음 수로가 내려다보였다.',
  equipped: '접이식 활공막을 챙겼다. 뛰어오른 뒤 점프를 누르고 있으면 내려갈 때 펼쳐진다.',
  water: '얼음이 옛 수로를 막고 있었다. 온열기와 회전 거울이 남아 있었다.',
  restored: '얼음이 녹자 물레가 다시 돌았다. 물의 사당으로 이어지는 문이 열렸다.',
};
