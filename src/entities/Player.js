// 플레이어 — 입력 intent를 카메라 접선 프레임에 투영해 구면 이동.
import * as THREE from 'three';
import { SurfaceActor } from './SurfaceActor.js';
import { buildKid, animateLimbs, DEFAULT_LOADOUT } from './Character.js';
import { projectTangent } from '../world/SurfaceTransform.js';

const _moveDir = new THREE.Vector3();

export class Player extends SurfaceActor {
  constructor(planet, loadout = DEFAULT_LOADOUT) {
    super(planet, buildKid(loadout));
    this.loadout = { ...DEFAULT_LOADOUT, ...loadout };
    this.speed = 5.0;
    this.turnRate = 12;
  }

  // 커스터마이즈 적용 — 몸 통째로 재생성 후 교체(라이브 프리뷰).
  setLoadout(loadout) {
    this.loadout = { ...this.loadout, ...loadout };
    this.setBody(buildKid(this.loadout));
    return this.loadout;
  }

  // intent {x:strafe, y:forward, run}; camForward/camRight: 카메라 접선 프레임(Engine 제공).
  update(dt, intent, camForward, camRight) {
    _moveDir.set(0, 0, 0)
      .addScaledVector(camRight, intent.x)
      .addScaledVector(camForward, intent.y);
    this.up.copy(this.position).normalize();
    projectTangent(_moveDir, this.up);
    this.running = !!intent.run;
    if (intent.jump) this.jump();
    this.setGlide(intent.jumpHeld);   // 떨어지는 중 점프 유지 = 활공
    this.updateVertical(dt);
    const len = _moveDir.length();
    this.moving = len > 1e-3;
    if (this.moving) {
      _moveDir.multiplyScalar(1 / len);
      this.move(_moveDir, dt);
    } else {
      this.lastArc = 0;
    }
    this.syncMesh();
    // 공중에서는 팔다리를 젓지 않는다(달리기 모션이 이어지면 어색하다).
    animateLimbs(this.body, dt, this.moving && this.grounded, this.running);
  }
}
