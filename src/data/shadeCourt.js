// 그림자 밟기: 사당의 -Z 진행축과 기존 저장 좌표를 유지한다.
export const SHADE_COURT = Object.freeze({
  width: 14, length: 16, lampY: 4.8, trackY: 6.7, orbitX: 5.4, orbitZ: 6.2,
  pillarHeight: 3.6, pillarRadius: 0.76, pillarSides: 16, obstacleRadius: 1.12,
  pillarBands: [1, 0.975, 0.15, 0.125, 0.05, 0],
  shadowY: 0.016, safeDepth: 2.2,
  pillars: [[-2.6, 3.4], [2.4, 0.4], [-2.2, -3.2], [2.8, -6]],
});
