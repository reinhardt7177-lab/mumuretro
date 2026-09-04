// 사당 실내 컨트롤러 — 평면 이동 + 3인칭 카메라.
//
// 구면 보행(sphere/)을 실내에 쓰지 않는다. 그건 대원 이동과 평행수송으로 짜여 있어서
// 평평한 방에서는 전부 낭비이고, 무엇보다 **검증된 코드를 건드리게 된다.**
// 실내는 XZ 평면 이동이면 충분하다 — 40줄이면 끝난다.
import * as THREE from 'three';
import { animateLimbs } from '../sphere/Character.js';
import { smoothK } from '../util/math.js';

const SPEED = 3.6, RUN = 6.0, TURN = 12;
// 점프 높이 ≈ v²/2g = 0.9u. 레이저 낮은 줄(0.75u)을 넘고 높은 줄(2.2u)에는 안 닿는다.
const JUMP_V = 4.2, GRAVITY = 9.8;

export class RoomActor {
  // SurfaceActor는 mesh(위치 캐리어)와 body(캐릭터 모델)를 나눠 갖는다.
  // 실내에서도 그 구조를 그대로 쓴다 — body를 따로 만들면 커스터마이즈가 갈라진다.
  //   mesh   씬에 넣고 빼는 대상. 위치·회전을 여기에 건다
  //   body   팔다리 애니메이션 대상. 발끝이 로컬 0이라 footOffset만큼 띄운다
  // rects: [{x0,x1,z0,z1,h,open}] — 걸을 수 있는 영역. 닫힌 문은 open=false다.
  // ★ 처음엔 방 하나를 L자 사각형 둘로 하드코딩했다. 방이 넷이 되면서 못 쓴다.
  //   영역 목록으로 바꾸면 방을 몇 개 잇든 코드가 그대로다.
  constructor(mesh, body, footOffset, rects) {
    this.mesh = mesh;
    this.body = body;
    this.footOffset = footOffset || 0;
    this.rects = rects || [];
    // 점프 — 레이저를 넘으려면 필요하다. 구면의 점프는 up 방향이라 여기선 못 쓴다.
    this.vy = 0; this.grounded = true;
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
    this.vy = 0; this.grounded = true;
    this.heading.set(0, 0, headingZ).normalize();
    this.camYaw = Math.atan2(-this.heading.x, -this.heading.z);
    this._camPlaced = false;
    this.syncMesh();
  }

  // 이 점이 열린 영역 **아무 데나** 들어 있는가(여백 없음).
  _in(x, z) {
    for (const r of this.rects) {
      if (!r.open) continue;
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
    }
    return false;
  }

  // 이 점이 걸을 수 있는가.
  // ★ 처음엔 사각형 하나하나를 여백만큼 **안쪽으로 줄여** 검사했다. 그랬더니
  //   구간들이 맞닿기만 하고 겹치지 않아서(입구 z≥6, r1 z≤6) 이음매마다
  //   폭 1.0u의 **어디에도 속하지 않는 띠**가 생겼고, 아이는 z=6.54에서 벽도 없는데
  //   막혔다. 방 하나가 아니라 문 일곱 개가 전부 이랬다(실사용 확인).
  //   고치는 법: 여백을 사각형이 아니라 **합집합의 경계**에 건다.
  //   내 주변 네 방향이 전부 열린 영역이면 벽에서 떨어져 있는 것이고,
  //   이음매에서는 옆 구간이 그 자리를 메워 주므로 자연히 통과된다.
  _walkable(x, z, m = 0.5) {
    return this._in(x, z)
      && this._in(x + m, z) && this._in(x - m, z)
      && this._in(x, z + m) && this._in(x, z - m);
  }

  // 벽에 부딪히면 멈추지 않고 **미끄러진다.** 정면으로 막히면 옆으로 흐르게 —
  // 안 그러면 좁은 통로 입구에서 걸려 아이가 "못 지나간다"고 느낀다.
  _move(from, dx, dz) {
    if (this._walkable(from.x + dx, from.z + dz)) { from.x += dx; from.z += dz; return; }
    if (this._walkable(from.x + dx, from.z)) { from.x += dx; return; }
    if (this._walkable(from.x, from.z + dz)) { from.z += dz; return; }
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
      this._move(this.position, _move.x * sp * dt, _move.z * sp * dt);
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

    // 점프 — 레이저 관문에서만 쓰지만 어디서든 뛸 수 있어야 한다.
    // 아이가 "뛰어 보는" 행동을 막으면 세계가 죽은 것처럼 느껴진다.
    if (intent.jump && this.grounded) { this.vy = JUMP_V; this.grounded = false; }
    if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.position.y += this.vy * dt;
      if (this.position.y <= 0) { this.position.y = 0; this.vy = 0; this.grounded = true; }
    }

    animateLimbs(this.body, dt, this.moving, this.running);
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.copy(this.position);   // y는 점프 높이를 포함한다
    this.mesh.quaternion.setFromAxisAngle(_Y, Math.atan2(this.heading.x, this.heading.z));
    // 바깥에서는 SurfaceActor가 해 주던 일. 실내에서는 여기서 한다.
    if (this.body) this.body.position.y = this.footOffset + (this.body.userData.bob || 0);
  }

  // 이 점이 방(또는 통로) 안인가. 카메라를 가두는 데 쓴다.
  // 여백을 두는 이유: 벽에 정확히 붙으면 근평면(0.3u)이 벽을 뚫어 벽 너머가 보인다.
  // 닫힌 문도 카메라에겐 통과 가능하다 — 문 너머가 보이는 건 오히려 좋다(다음 목표).
  // 걷기와 같은 이유로 여백은 합집합 경계에 건다. 안 그러면 이음매마다 카메라가 튄다.
  _inAny(x, z, y) {
    for (const r of this.rects) {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && y >= 0.4 && y <= r.h - 0.35) return true;
    }
    return false;
  }

  _inside(p, m = 0.45) {
    return this._inAny(p.x, p.z, p.y)
      && this._inAny(p.x + m, p.z, p.y) && this._inAny(p.x - m, p.z, p.y)
      && this._inAny(p.x, p.z + m, p.y) && this._inAny(p.x, p.z - m, p.y);
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
    const target = _tgt.copy(this.position).setY(this.position.y + 1.25);

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
