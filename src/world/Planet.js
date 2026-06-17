// 행성 — icosphere + 표면 헬퍼(latLonToPos, frameAt). UV 극점 핀칭이 없어 배치/정렬 균일.
import * as THREE from 'three';
import { toon, noOut } from '../rendering/Toon.js';
import { orientationFromFrame, orthonormalizeHeading } from './SurfaceTransform.js';

export const R = 34;            // 행성 반지름. 둘레 2πR≈213u, 보행 5u/s → 직선 한 바퀴 ~43초. 전체 손맛의 핵심 튜닝값.
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export class Planet {
  constructor(scene) {
    this.R = R;
    const geo = new THREE.IcosahedronGeometry(R, 5); // detail 5 ≈ 20k tris
    this.mesh = new THREE.Mesh(geo, toon(0x86b56a));
    this.mesh.receiveShadow = true;
    noOut(this.mesh);             // 행성 본체는 아웃라인 제외(둘레가 굵게 칠해지는 것 방지)
    scene.add(this.mesh);
  }

  // 표면 법선(= 중력 반대 방향).
  normalAt(pos) { return pos.clone().normalize(); }

  // 위도/경도(도) → 반지름 r 표면점.
  latLonToPos(latDeg, lonDeg, r = this.R) {
    const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180;
    return new THREE.Vector3(
      r * Math.cos(lat) * Math.cos(lon),
      r * Math.sin(lat),
      r * Math.cos(lat) * Math.sin(lon)
    );
  }

  // 표면점 + heading(도, up 기준 회전)으로 프롭 배치용 {position, quaternion} 산출.
  // up과 평행하지 않은 기준벡터로 접선 forward를 만든 뒤 headingDeg만큼 회전.
  frameAt(pos, headingDeg = 0, outQuat = new THREE.Quaternion()) {
    const up = pos.clone().normalize();
    const ref = Math.abs(up.dot(Y_AXIS)) > 0.99 ? new THREE.Vector3(1, 0, 0) : Y_AXIS;
    const forward = ref.clone();
    orthonormalizeHeading(forward, up);
    forward.applyAxisAngle(up, headingDeg * Math.PI / 180);
    orientationFromFrame(up, forward, outQuat);
    return { position: pos.clone(), quaternion: outQuat };
  }
}
