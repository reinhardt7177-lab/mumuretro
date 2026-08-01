// 행성 표면 위에 서고 걷는 모든 것의 베이스(플레이어/주민/유령 공용).
// mesh(외부 그룹)는 구면 변환을 담고, body(키드 등)는 자식으로 footOffset+bob 만큼 up 방향으로 떠 있음.
import * as THREE from 'three';
import { moveOnSphere, turnHeading, orthonormalizeHeading, orientationFromFrame, projectTangent } from '../world/SurfaceTransform.js';

const _q = new THREE.Quaternion();
// 등반 판정용 임시값(후보 이동을 실제로 굴려보고 되돌린다)
const _try = new THREE.Vector3(), _tryH = new THREE.Vector3();
const _sideA = new THREE.Vector3(), _sideB = new THREE.Vector3(), _push = new THREE.Vector3();
const _scratch = { lastAxis: new THREE.Vector3(), lastArc: 0 };

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
    this.position = planet.surfaceAt(new THREE.Vector3(0, 1, 0)); // 지형 표면점(|·| = R + 높이)
    this.heading = new THREE.Vector3(0, 0, 1);          // 접선 정면
    this.up = new THREE.Vector3(0, 1, 0);
    this.speed = 5;
    this.runMul = 1.7;
    this.turnRate = 10;            // rad/s
    this.moving = false;
    this.running = false;

    // ── 점프 ──────────────────────────────────────────────────────────────
    // position은 항상 "지면 위 점"으로 유지하고, 점프 높이는 별도로 들고 간다.
    // 이렇게 하면 배달 사거리·구역 판정·수평선 컬링 등 각도 기반 로직이 점프에 흔들리지 않고,
    // 시각적으로만 body가 up 방향으로 떠오른다(카메라도 따라 튀지 않아 3인칭에서 자연스럽다).
    this.jumpH = 0;                // 지면 위 높이(월드 단위)
    this.vy = 0;                   // 반지름 방향 속도
    this.jumpSpeed = 8.2;          // 도약 초속 → 최고점 ≈ vy²/(2g) ≈ 1.5u(플레이어 키만큼)
    this.gravity = 22;             // 낙하 가속도
    this.maxJumps = 1;             // 이단 점프 해금 시 2
    this.jumpsLeft = 1;

    // ── 등반 제한 ──────────────────────────────────────────────────────────
    // 기본은 Infinity(제한 없음) — NPC가 절벽에 끼어 멈추면 그게 더 이상하다.
    // Player만 실제 값을 걸어서 "못 가는 곳"을 만든다. 이게 있어야 벽 오르기 해금이 의미를 갖는다.
    this.maxClimbTan = Infinity;
    this.canClimb = false;         // 벽 오르기 해금 시 true → 제한 무시
    this.canGlide = false;         // 활공 해금
    this.gliding = false;

    // 건물 충돌 — [{pos, r}]. boot이 근처 것만 주기적으로 채운다(전체 검사는 낭비).
    this.colliders = [];
    this.blockedBySlope = false;   // 이번 프레임에 경사로 막혔는가(boot이 읽고 리셋)
    this.blockedByProp = false;    // 건물에 막혔는가(같은 방식)
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
    this.position.copy(this.planet.latLonToPos(latDeg, lonDeg));
    this.planet.projectToSurface(this.position);
    this._initFrame();
    this.syncMesh();
    return this;
  }

  // 후보 이동의 상승 기울기(=올라가는 정도). 내리막은 음수.
  _climbOf(moveDir, dist) {
    _try.copy(this.position); _tryH.copy(this.heading);
    moveOnSphere(_try, _tryH, moveDir, dist, this.planet, _scratch);
    return (_try.length() - this.position.length()) / dist;
  }

  // moveDir: 접선 단위벡터(월드). 이동 후 heading을 moveDir로 회전.
  move(moveDir, dt) {
    const dist = (this.running ? this.speed * this.runMul : this.speed) * dt;
    this.up.copy(this.position).normalize();

    let dir = moveDir;
    if (!this.canClimb && Number.isFinite(this.maxClimbTan) && this.grounded) {
      if (this._climbOf(moveDir, dist) > this.maxClimbTan) {
        // 정면이 너무 가파르다 → 등고선(좌/우 90°) 쪽으로 미끄러뜨린다.
        // 그냥 막으면 벽에 붙어 얼어붙어서 고장난 것처럼 느껴진다.
        _sideA.copy(moveDir).applyAxisAngle(this.up, Math.PI / 2);
        _sideB.copy(moveDir).applyAxisAngle(this.up, -Math.PI / 2);
        const ca = this._climbOf(_sideA, dist), cb = this._climbOf(_sideB, dist);
        const best = ca < cb ? _sideA : _sideB;
        this.blockedBySlope = true;    // 안내 문구 트리거(막혔는데 아무 말이 없으면 고장으로 느껴진다)
        if (Math.min(ca, cb) > this.maxClimbTan) { this.lastArc = 0; return; }   // 사방이 절벽
        dir = best;
      }
    }

    moveOnSphere(this.position, this.heading, dir, dist, this.planet, this);
    this.up.copy(this.position).normalize();
    this.resolveCollisions();
    turnHeading(this.heading, dir, this.up, this.turnRate * dt);
  }

  // 건물 밖으로 밀어내기. 벽을 따라 자연스럽게 미끄러진다(막고 멈추면 끼인 느낌이 난다).
  // 원형 콜라이더라 네모난 집의 모서리는 살짝 여유가 생기는데, 뚫고 지나가는 것보다는 낫다.
  resolveCollisions() {
    if (!this.colliders.length) return;
    for (const c of this.colliders) {
      const d = this.position.distanceTo(c.pos);
      if (d >= c.r || d < 1e-6) continue;
      _push.copy(this.position).sub(c.pos);
      projectTangent(_push, this.up);
      if (_push.lengthSq() < 1e-9) continue;      // 정확히 중심 — 밀 방향이 없다
      _push.normalize();
      this.blockedByProp = true;
      this.position.copy(c.pos).addScaledVector(_push, c.r);
      this.planet.projectToSurface(this.position);
      this.up.copy(this.position).normalize();
    }
  }

  // 도약. 남은 점프 횟수가 있으면 공중에서도 가능(이단 점프).
  // true면 실제로 뛰었다는 뜻(효과음·이펙트 트리거용).
  jump() {
    if (this.jumpsLeft <= 0) return false;
    this.jumpsLeft--;
    this.vy = this.jumpSpeed;
    this.gliding = false;         // 점프하면 활공 해제
    return true;
  }

  get grounded() { return this.jumpH <= 1e-4 && this.vy <= 0; }
  get airborne() { return !this.grounded; }

  // 활공 — 떨어지는 중에 점프 버튼을 누르고 있으면 천천히 내려온다.
  setGlide(on) {
    this.gliding = !!(on && this.canGlide && this.airborne && this.vy < 0);
  }

  // 중력 적분. 매 프레임 update에서 호출.
  updateVertical(dt) {
    if (this.grounded && this.vy === 0) { this.jumpsLeft = this.maxJumps; this.gliding = false; return; }
    // 활공 중에는 중력을 크게 줄이고 하강 속도에 상한을 둔다.
    const g = this.gliding ? this.gravity * 0.12 : this.gravity;
    this.vy -= g * dt;
    if (this.gliding && this.vy < -2.2) this.vy = -2.2;
    this.jumpH += this.vy * dt;
    if (this.jumpH <= 0) {
      this.jumpH = 0; this.vy = 0;
      this.jumpsLeft = this.maxJumps;    // 착지 시 점프 회복
      this.gliding = false;
    }
  }

  syncMesh() {
    this.up.copy(this.position).normalize();
    orthonormalizeHeading(this.heading, this.up);
    this.mesh.position.copy(this.position);
    orientationFromFrame(this.up, this.heading, _q);
    this.mesh.quaternion.copy(_q);
    if (this.body && this.body.userData) {
      // mesh의 로컬 +Y가 곧 up이므로 점프 높이를 여기에 더하면 반지름 방향으로 떠오른다.
      this.body.position.y = this.footOffset + (this.body.userData.bob || 0) + this.jumpH;
    }
  }
}
