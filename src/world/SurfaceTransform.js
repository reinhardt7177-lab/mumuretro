// ★ 구면 보행 코어 — 대원(great-circle) 이동 + 쿼터니언 정렬. 평면 가정을 일절 쓰지 않음.
// 액터는 (position: 반지름 R인 표면점, heading: 접선 단위벡터)로 표현. Euler/lat-lon 누적 금지.
import * as THREE from 'three';
import { signedAngle, clamp } from '../util/math.js';

const _t = new THREE.Vector3();

// v에서 법선 n(단위) 성분 제거 → 접선 평면에 투영. v를 변형하고 반환.
export function projectTangent(v, n) {
  return v.addScaledVector(n, -v.dot(n));
}

// heading을 up에 대해 재직교화(접선 유지) 후 정규화. 길이 0이면 그대로 둠.
export function orthonormalizeHeading(heading, up) {
  heading.addScaledVector(up, -heading.dot(up));
  if (heading.lengthSq() > 1e-12) heading.normalize();
  return heading;
}

const _axis = new THREE.Vector3();
const _up = new THREE.Vector3();
// position(|·|=R)을 접선 방향 moveDir로 distance 만큼 대원 이동. heading도 같은 회전으로 평행수송.
// 적용한 회전을 out.lastAxis/out.lastArc에 기록(카메라 프레임 수송용). 이동 없으면 out.lastArc=0.
export function moveOnSphere(position, heading, moveDir, distance, R, out) {
  _up.copy(position).normalize();
  _axis.crossVectors(_up, moveDir);
  if (_axis.lengthSq() < 1e-12 || distance === 0) { if (out) out.lastArc = 0; return; }
  _axis.normalize();
  const arc = distance / R;
  position.applyAxisAngle(_axis, arc).setLength(R); // 회전은 길이 보존, setLength는 부동소수 드리프트 가드
  heading.applyAxisAngle(_axis, arc);
  if (out) { out.lastAxis.copy(_axis); out.lastArc = arc; }
}

// heading을 target 접선 방향으로 회전(최대 maxRad). up 축 기준 회전이라 롤 없음.
export function turnHeading(heading, target, up, maxRad) {
  orthonormalizeHeading(heading, up);
  const a = signedAngle(heading, target, up);
  heading.applyAxisAngle(up, clamp(a, -maxRad, maxRad));
  return orthonormalizeHeading(heading, up);
}

// up에 접하는 임의의 단위 접선 벡터(랜덤 방위). NPC/유령 배회용.
export function randomTangent(up, rng = Math.random) {
  const v = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5);
  orthonormalizeHeading(v, up);
  if (v.lengthSq() < 1e-6) { v.set(1, 0, 0); orthonormalizeHeading(v, up); }
  return v;
}

const _right = new THREE.Vector3();
const _m = new THREE.Matrix4();
// 모델(+Z=정면, +Y=위)을 (up, heading) 프레임으로 정렬하는 쿼터니언. 우수 좌표계: X = Y × Z.
export function orientationFromFrame(up, heading, outQuat) {
  orthonormalizeHeading(heading, up);
  _right.crossVectors(up, heading).normalize();
  _m.makeBasis(_right, up, heading);
  return outQuat.setFromRotationMatrix(_m);
}
