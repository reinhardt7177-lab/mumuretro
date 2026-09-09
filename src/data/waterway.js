import { SHRINE_THEMES, LAB } from './lighting.js';

export const WATERWAY = Object.freeze({
  id: 'thawing-waterway', width: 20, depth: 12, reach: 2.1, discoverRadius: 15,
  ice: { x: 0, z: -1, height: 0.85, radius: 1.1 },
  heater: { x: -7, z: 2.8, radius: 4.4, watts: 18000 },
  mirror: { x: 6, z: 2.8, stepDegrees: 15, initialDegrees: 180, watts: 15500 },
  receiverRadius: 1.08, beamLength: 13,
});

export const WATERWAY_COLORS = Object.freeze({
  stone: SHRINE_THEMES.water.stone, dark: SHRINE_THEMES.water.stoneDark,
  pale: SHRINE_THEMES.water.open.cloud, ice: SHRINE_THEMES.water.glow,
  water: SHRINE_THEMES.water.glowDim, warm: SHRINE_THEMES.fire.glow,
  gold: LAB.brass, mirror: SHRINE_THEMES.water.stoneLite, ink: LAB.iron,
});

export const WATERWAY_TEXT = Object.freeze({
  name: '잠든 물길',
  discovered: '얼음이 물길을 막았다. 온열기와 거울이 곁에 남아 있었다.',
  goal: '얼음에 열을 전달해 물길을 열어라.',
  pickup: '온열기를 들었다. 얼음과의 거리가 달라지면 닿는 열도 달라진다.',
  place: '온열기를 내려놓았다. 얼음의 변화를 살펴보자.',
  turn: '거울을 돌렸다. 빛이 닿는 자리가 달라졌다.',
  returnHome: '수로를 벗어나자 온열기가 원래 받침으로 돌아갔다.',
  melting: '얼음과 물이 함께 있다. 온도는 0°C에 머물고 얼음이 줄어든다.',
  solved: '얼음이 녹았다. 물이 흐르자 오래된 유적이 깨어났다.',
  recordHeat: '온열기를 가까이 옮기자 열이 더 잘 닿았다.',
  recordLight: '거울의 빛을 검은 흡수판에 모으자 얼음에 열이 전달됐다.',
  recordBoth: '온열기와 거울빛이 함께 얼음에 열을 전달했다.',
  science: '이 장치는 열 손실을 줄인 얼음 모형이다. 0°C에 도달한 뒤 받은 열은 얼음을 녹이는 데 쓰인다.',
});
