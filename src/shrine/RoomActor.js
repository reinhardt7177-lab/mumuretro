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
    // 얼음 바닥 — 0이면 보통 바닥, 1이면 완전히 미끄럽다. 관문이 켜고 끈다.
    // 관성을 액터에 두는 이유: 미끄러짐은 "방의 성질"이 아니라 **걷기의 성질**이다.
    // 관문이 매 프레임 위치를 보정하는 식으로 만들면 카메라가 한 프레임씩 튄다.
    this.slip = 0;
    this.vel = new THREE.Vector2(0, 0);
    // 화면 흔들림 — 화산 사당의 지진. 관문이 매 프레임 값을 써 넣고 여기서 감쇠시킨다.
    // ★ 흔들림은 장식이 아니라 **신호**다. 큰 진동 전에 작은 예진이 먼저 오고,
    //   그걸 알아채는 아이는 안 죽는다. 그래서 세기를 관문이 정확히 통제해야 한다.
    this.shake = 0;
  }

  setAt(x, z, headingZ = -1) {
    this.position.set(x, 0, z);
    this.vy = 0; this.grounded = true;
    if (this.vel) this.vel.set(0, 0);
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

    const sp = this.running ? RUN : SPEED;
    if (this.slip > 0) {
      // 얼음 — 미는 힘은 약하고 멈추는 힘은 더 약하다. 그래서 미리 감속해야 한다.
      const accel = 9.0 * (1 - this.slip * 0.72);
      const drag = 1 - Math.min(1, dt * (7.5 - this.slip * 7.0));
      if (this.moving) { this.vel.x += _move.x * accel * dt; this.vel.y += _move.z * accel * dt; }
      this.vel.multiplyScalar(drag);
      const v = this.vel.length();
      if (v > sp) this.vel.multiplyScalar(sp / v);
      if (v > 0.02) {
        this._move(this.position, this.vel.x * dt, this.vel.y * dt);
        this._pushOut(this.position);
        _move.set(this.vel.x, 0, this.vel.y).normalize();
        this.moving = true;                 // 미끄러지는 중엔 손을 떼도 걷는 자세다
      }
    } else if (this.moving) {
      this.vel.set(0, 0);
      _move.normalize();
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
  // 여기 서 있을 때 천장이 얼마나 낮은가 — 카메라가 물러날 방향 쪽을 본다.
  // 뒤로 갈수록 천장이 달라지므로(복도로 물러나는 경우) **가장 낮은 것**을 쓴다.
  _ceilBehind(target, dirX, dirZ, dist) {
    let lo = Infinity;
    for (let i = 0; i <= 6; i++) {
      const k = (i / 6) * dist;
      const x = target.x + dirX * k, z = target.z + dirZ * k;
      let best = 0;
      for (const r of this.rects) {
        if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && r.h > best) best = r.h;
      }
      if (best > 0 && best < lo) lo = best;
      if (best === 0) break;                      // 밖이면 더 볼 것 없다
    }
    return lo === Infinity ? 0 : lo;
  }

  updateCamera(camera, input, dt) {
    this.camYaw += input.consumeYaw();
    let pitch = Math.max(0.12, Math.min(0.7, input.camPitch));
    const dist = Math.max(3.2, Math.min(6.5, input.camDist));
    const target = _tgt.copy(this.position).setY(this.position.y + 1.25);

    // ★ 천장이 낮으면 **거리를 줄이지 말고 각도를 낮춘다.**
    //
    //   예전엔 뒤로 물러나다 천장에 걸리면 그냥 거리를 잘랐다. 그래서 낮은 데서는
    //   카메라가 뒤통수에 달라붙었다. 재 보니 55칸 중 19칸이 그랬고, 하필 **사당
    //   입구 복도 여섯 곳 전부**가 희망 거리의 38%밖에 못 냈다 — 사당에 들어서는
    //   첫 장면이 가장 눌려 있었던 것이다. 실사용에서 들은 "높이가 낮아서 답답하다"가
    //   이거였다. 복도 폭 3u는 캐릭터 폭의 4.8배라 좁은 적이 없었고, 천장 3.2u도
    //   실척으로 3.8m다. 좁은 게 아니라 **카메라가 천장 위에 서고 싶어 했다**
    //   (희망 높이 1.25 + 6.5·sin28.6° = 4.37u).
    //
    //   각도를 낮추면 카메라가 낮게, 그러나 **멀리** 선다. 복도가 길어 보이고
    //   앞이 뚫린다. 각도를 최저까지 낮춰도 안 될 때만 그때 거리를 줄인다.
    const hx = Math.sin(this.camYaw), hz = Math.cos(this.camYaw);
    const ceil = this._ceilBehind(target, hx, hz, dist);
    if (ceil > 0) {
      const room = ceil - CEIL_PAD - (target.y - this.position.y);
      const maxSin = Math.max(0, room) / dist;
      if (maxSin < Math.sin(pitch)) pitch = Math.max(0.12, Math.asin(Math.min(1, maxSin)));
    }

    const dir = _dir.set(hx * Math.cos(pitch), Math.sin(pitch), hz * Math.cos(pitch));

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

    if (this.shake > 0.001) {
      const a = this.shake;
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a * 0.7;
      camera.position.z += (Math.random() - 0.5) * a;
      this.shake = Math.max(0, this.shake - dt * 2.4);
    }
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
  }
}

// _inAny가 천장에서 잘라내는 여백과 **같아야 한다.** 다르면 각도를 낮춰 놓고도
// 탐침이 또 걸려서 결국 거리가 줄어든다 — 고친 줄 알았는데 안 고쳐지는 종류다.
const CEIL_PAD = 0.35;

const _Y = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _move = new THREE.Vector3();
const _dir = new THREE.Vector3(), _tgt = new THREE.Vector3(), _des = new THREE.Vector3();
const _probe = new THREE.Vector3();
