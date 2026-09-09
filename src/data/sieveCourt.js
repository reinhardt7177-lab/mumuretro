// 게임의 mm 판정과 화면 크기를 같은 축척으로 사용한다.
export const SIEVE_COURT = {
  width: 12, length: 12, mmScale: 0.09, radius: 1.25, meshRadius: 1.12, bar: 0.025,
  stockX: -4.15, stockOffsets: [2.2, 5.4, 8.6], stockY: 1.2,
  tableY: 1.2, trayY: 0.16, tableClearance: 1.84, traySpread: 0.3, trayForward: 0.2,
};

// 체질은 표시 연출이다. 시간·흔들림은 판정이나 저장 데이터에 들어가지 않는다.
export const SIEVE_MOTION = {
  duration: 1.4, shakeDuration: 0.65, shakeAmplitude: 0.035, shakeHz: 5,
  alignEnd: 0.22, fallEnd: 0.48, slideEnd: 0.88, stagger: 0.12,
};
