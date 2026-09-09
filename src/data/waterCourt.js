// 세 모습의 회랑. z는 방 앞쪽에서 잰 거리이며, 기존 사당의 -Z 진행 방향을 유지한다.
export const WATER_COURT = {
  height: 3, rampFront: 3, rampBack: 11, terraceBack: 19,
  wingInner: 6, wingOuter: 10, bridgeFront: 14, bridgeBack: 18,
  valves: [{ x: -8, back: 16, y: 3 }, { x: 8, back: 16, y: 3 }, { x: 0, back: 22, y: 0 }],
  controls: [{ x: 2.6, back: 3.4, y: 0 }, { x: -8, back: 12, y: 3 }, { x: 8, back: 12, y: 3 }],
  goal: '양쪽 회랑과 아래 수조의 밸브에 원하는 모습을 채워라. 첫 밸브가 회랑 사이 다리를 연다.',
  hints: ['양쪽 비탈길은 같은 높이의 회랑으로 이어진다. 가까운 온도 손잡이를 써라.',
    '위아래 손잡이는 같은 장치를 돌린다. 밸브가 원하는 모습과 지금 상태를 비교해라.',
    '밸브 하나를 채우면 높은 다리가 열린다. 밸브 셋을 채운 뒤 신전으로.'],
};
