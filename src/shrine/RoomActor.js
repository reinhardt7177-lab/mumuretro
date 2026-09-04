// 사당 실내 컨트롤러 — 평면 이동 + 3인칭 카메라.
//
// 구면 보행(sphere/)을 실내에 쓰지 않는다. 그건 대원 이동과 평행수송으로 짜여 있어서
// 평평한 방에서는 전부 낭비이고, 무엇보다 **검증된 코드를 건드리게 된다.**
// 실내는 XZ 평면 이동이면 충분하다 — 40줄이면 끝난다.
import * as THREE from 'three';
import { animateLimbs } from '../sphere/Character.js';
import { smoothK } from '../util/math.js';

const SPEED = 3.6, RUN = 6.0, TURN = 12;

export class RoomActor {
  // SurfaceActor는 mesh(위치 캐리어)와 body(캐릭터 모델)를 나눠 갖는다.
  // 실내에서도 그 구조를 그대로 쓴다 — body를 따로 만들면 커스터마이즈가 갈라진다.
  //   mesh   씬에 넣고 빼는 대상. 위치·회전을 여기에 건다
  //   body   팔다리 애니메이션 대상. 발끝이 로컬 0이라 footOffset만큼 띄운다
  // bounds: {W, D, H, CORR_W, CORR_D} — 벽을 뚫고 나가지 않게 가둔다
  constructor(mesh, body, footOffset, bounds) {
    this.mesh = mesh;
    this.body = body;
    this.footOffset = footOffset || 0;
    this.b = bounds;
    this.position = new THREE.Vector3();
    this.heading = new THREE.Vector3(0, 0, -1);
    this.moving = false; this.running = false;
    // 카메라 자체 방위. 바깥과 달리 up이 항상 +Y라 각도 하나면 된다.
    this.camYaw = Math.PI;
    this._camPlaced = false;
    // 방 안 장애물(석상 등). 원기둥 하나면 충분하다 — 실내엔 몇 개 없다.
    this.obstacles = [];
  }

  setAt(x, z, headingZ = -1) {
    this.position.set(x, 0, z);
    this.heading.set(0, 0, headingZ).normalize();
    this.camYaw = Math.atan2(-this.heading.x, -this.heading.z);
    this._camPlaced = false;
    this.syncMesh();
  }

  // 방과 통로를 합친 L자 영역에 가둔다. 두 사각형 중 하나에는 들어 있어야 한다.
  _clamp(p) {
    const { W, D, CORR_W, CORR_D } = this.b;
    const hw = W / 2 - 0.55, hd = D / 2 - 0.55, chw = CORR_W / 2 - 0.45;
    const inRoom = Math.abs(p.x) <= hw && p.z <= hd;
    if (inRoom) { p.z = Math.max(p.z, -hd); return; }
    // 통로 영역
    const corrEnd = D / 2 + CORR_D + 0.6;
    if (p.z > hd) {
      p.x = Math.max(-chw, Math.min(chw, p.x));
      p.z = Math.min(p.z, corrEnd);
      return;
    }
    p.x = Math.max(-hw, Math.min(hw, p.x));
    p.z = Math.max(p.z, -hd);
  }

  // 장애물 밀어내기 — 석상 안으로 걸어 들어가면 즉시 고장으로 읽힌다.
  _pushOut(p) {
    for (const o of this.obstacles) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < o.r && d > 1e-6) { p.x = o.x + dx / d * o.r; p.z = o.z + dz / d * o.r; }
    }
  }

  update(dt, intent, camera) {
    // 카메라 기준 이동 — 화면에서 위로 밀면 화면 안쪽으로 간다
    const cf = _fwd.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const cr = _right.set(cf.z, 0, -cf.x);
    _move.set(0, 0, 0).addScaledVector(cf, intent.y).addScaledVector(cr, intent.x);
    this.moving = _move.lengthSq() > 1e-6;
    this.running = !!intent.run && this.moving;

    if (this.moving) {
      _move.normalize();
      const sp = this.running ? RUN : SPEED;
      this.position.addScaledVector(_move, sp * dt);
      this._clamp(this.position);
      this._pushOut(this.position);
      // 진행 방향으로 부드럽게 돈다
      const target = Math.atan2(_move.x, _move.z);
      const cur = Math.atan2(this.heading.x, this.heading.z);
      let d = target - cur;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const step = Math.max(-TURN * dt, Math.min(TURN * dt, d));
      const na = cur + step;
      this.heading.set(Math.sin(na), 0, Math.cos(na));
    }

    animateLimbs(this.body, dt, this.moving, this.running);
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.copy(this.position);
    this.mesh.quaternion.setFromAxisAngle(_Y, Math.atan2(this.heading.x, this.heading.z));
    // 바깥에서는 SurfaceActor가 해 주던 일. 실내에서는 여기서 한다.
    if (this.body) this.body.position.y = this.footOffset + (this.body.userData.bob || 0);
  }

  // 이 점이 방(또는 통로) 안인가. 카메라를 가두는 데 쓴다.
  // 여백을 두는 이유: 벽에 정확히 붙으면 근평면(0.3u)이 벽을 뚫어 벽 너머가 보인다.
  _inside(p, m = 0.5) {
    const { W, D, H, CORR_W, CORR_D } = this.b;
    if (p.y < 0.4 || p.y > H - 0.4) return false;
    const inRoom = Math.abs(p.x) <= W / 2 - m && p.z >= -D / 2 + m && p.z <= D / 2 - m;
    if (inRoom) return true;
    const inCorr = Math.abs(p.x) <= CORR_W / 2 - m
      && p.z >= D / 2 - m - 0.6 && p.z <= D / 2 + CORR_D - m;
    return inCorr;
  }

  // 3인칭 카메라.
  // ★ 처음엔 y만 클램프하고 x·z를 놔뒀다. 시점을 돌리면 카메라가 **벽을 통과해** 밖으로
  //   나가서 검은 공간에서 방을 들여다보게 됐다(실사용 확인).
  //   x·z를 잘라 가두면 카메라가 플레이어 안으로 파고든다. 그래서 자르는 게 아니라
  //   **시선표적에서 카메라 쪽으로 나아가다 벽에 닿는 지점에서 멈춘다** — 바깥 카메라가
  //   건물에 raycast를 쏘는 것과 같은 해법이고, 상자 방이라 훨씬 싸게 된다.
  updateCamera(camera, input, dt) {
    this.camYaw += input.consumeYaw();
    const pitch = Math.max(0.12, Math.min(0.7, input.camPitch));
    const dist = Math.max(3.2, Math.min(6.5, input.camDist));
    const dir = _dir.set(Math.sin(this.camYaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.camYaw) * Math.cos(pitch));
    const target = _tgt.copy(this.position).setY(1.25);

    // 벽에 닿기 직전까지만 물러난다. 16단이면 방 크기(16u) 기준 1u 간격이라 충분하다.
    const STEPS = 16;
    let t = 1;
    for (let i = 1; i <= STEPS; i++) {
      const k = i / STEPS;
      _probe.copy(target).addScaledVector(dir, dist * k);
      if (!this._inside(_probe)) { t = (i - 1) / STEPS; break; }
    }
    const camDist = Math.max(1.4, dist * t);      // 너무 붙으면 캐릭터 안이 보인다
    const desired = _des.copy(target).addScaledVector(dir, camDist);

    if (!this._camPlaced) { camera.position.copy(desired); this._camPlaced = true; }
    else camera.position.lerp(desired, smoothK(0.0009, dt));
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
  }
}

const _Y = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _move = new THREE.Vector3();
const _dir = new THREE.Vector3(), _tgt = new THREE.Vector3(), _des = new THREE.Vector3();
const _probe = new THREE.Vector3();
