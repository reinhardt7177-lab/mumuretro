// 세 모습의 회랑. z는 방 앞쪽에서 잰 거리이며, 기존 사당의 -Z 진행 방향을 유지한다.
export const WATER_COURT = {
  height: 3, rampFront: 3, rampBack: 11, terraceBack: 19,
  wingInner: 6, wingOuter: 10, bridgeFront: 14, bridgeBack: 18,
  valves: [{ x: -8, back: 16, y: 3 }, { x: 8, back: 16, y: 3 }, { x: 0, back: 22, y: 0 }],
  controls: [{ x: 2.6, back: 3.4, y: 0 }, { x: -8, back: 12, y: 3 }, { x: 8, back: 12, y: 3 }],
  goal: '얼음 다리와 위쪽 집수판을 복구해, 성소 수조에 물을 모아라.',
  hints: ['아래에서 마개를 녹이고 물을 냉각하면 회랑 사이 다리가 열린다.',
    '왼쪽 회랑은 집수판 냉각, 오른쪽 회랑은 집수판 이동 장치다. 물방울과 물받이를 맞춰라.',
    '아래 가열 방향을 용기로 바꿔라. 위쪽에서 식힌 물이 수조를 채우면 신전 문이 열린다.'],
};
