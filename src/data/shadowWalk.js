// 그림자 밟기: 관찰하고 걸어서 따라갈 수 있는 속도와 폭.
// 다른 사당을 먼저 깼다고 이 방의 조작 여유를 줄이지 않는다.
export const SHADOW_WALK = Object.freeze({
  speed: 0.12,          // rad/s — 한 바퀴 약 52초
  width: 2.4,
  length: 9,
  exposure: 1.8,        // 그림자를 벗어난 뒤 돌아올 여유(초)
  orbitX: 8,
  orbitZ: 12,           // 기둥 가까이를 스치지 않아 그림자가 급회전하지 않는다
  startAngle: Math.PI / 2,
});
