// 행성 표면 위에 서고 걷는 모든 것의 베이스(플레이어/주민/유령 공용).
// mesh(외부 그룹)는 구면 변환을 담고, body(키드 등)는 자식으로 footOffset+bob 만큼 up 방향으로 떠 있음.
import * as THREE from 'three';
import { moveOnSphere, turnHeading, orthonormalizeHeading, orientationFromFrame } from '../world/SurfaceTransform.js';

const _q = new THREE.Quaternion();

export class SurfaceActor {
  constructor(planet, body) {
    this.planet = planet;
    this.mesh = new THREE.Group();           // 표면 위치 + 정렬 캐리어
    this.body = body || null;                // 시각 모델(발끝 로컬 0 기준)
    this.footOffset = 0;
    if (body) {
      const box = new THREE.Box3().setFromObject(body);
      this.footOffset = -box.min.y;           // 발끝이 표면에 닿도록 보정
      body.position.y = this.footOffset;
      this.mesh.add(body);
    }
    this.position = new THREE.Vector3(0, planet.R, 0); // 표면점(|·|=R)
    this.heading = new THREE.Vector3(0, 0, 1);          // 접선 정면
    this.up = new THREE.Vector3(0, 1, 0);
    this.speed = 5;
    this.runMul = 1.7;
    this.turnRate = 10;            // rad/s
    this.moving = false;
    this.running = false;
    this.lastAxis = new THREE.Vector3(0, 1, 0);
    this.lastArc = 0;
    this._initFrame();
    this.syncMesh();
  }

  // 시각 모델 교체(커스터마이즈). 발끝 보정 재계산 후 현재 자세로 동기화.
  setBody(body) {
    if (this.body) this.mesh.remove(this.body);
    this.body = body;
    const box = new THREE.Box3().setFromObject(body);
    this.footOffset = -box.min.y;
    body.position.y = this.footOffset;
    this.mesh.add(body);
    this.syncMesh();
  }

  _initFrame() {
    this.up.copy(this.position).normalize();
    orthonormalizeHeading(this.heading, this.up);
    if (this.heading.lengthSq() < 1e-6) {
      this.heading.set(1, 0, 0);
      orthonormalizeHeading(this.heading, this.up);
    }
  }

  setLatLon(latDeg, lonDeg) {
    this.position.copy(this.planet.latLonToPos(latDeg, lonDeg)).setLength(this.planet.R);
    this._initFrame();
    this.syncMesh();
    return this;
  }

  // moveDir: 접선 단위벡터(월드). 이동 후 heading을 moveDir로 회전.
  move(moveDir, dt) {
    const dist = (this.running ? this.speed * this.runMul : this.speed) * dt;
    this.up.copy(this.position).normalize();
    moveOnSphere(this.position, this.heading, moveDir, dist, this.planet.R, this);
    this.up.copy(this.position).normalize();
    turnHeading(this.heading, moveDir, this.up, this.turnRate * dt);
  }

  syncMesh() {
    this.up.copy(this.position).normalize();
    orthonormalizeHeading(this.heading, this.up);
    this.mesh.position.copy(this.position);
    orientationFromFrame(this.up, this.heading, _q);
    this.mesh.quaternion.copy(_q);
    if (this.body && this.body.userData) {
      this.body.position.y = this.footOffset + (this.body.userData.bob || 0);
    }
  }
}
