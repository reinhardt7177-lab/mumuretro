// 플레이어 — 입력 intent를 카메라 접선 프레임에 투영해 구면 이동.
import * as THREE from 'three';
import { SurfaceActor } from './SurfaceActor.js';
import { buildKid, animateLimbs, DEFAULT_LOADOUT } from './Character.js';
import { buildNavigator } from './Navigator.js';
import { projectTangent } from './SurfaceTransform.js';
import { GroundMotion } from './GroundMotion.js';

const _moveDir = new THREE.Vector3();
const _actual = new THREE.Vector3();
function playerBody(loadout){const fallback=buildKid(loadout);return buildNavigator(fallback.userData.glider)||fallback;}

export class Player extends SurfaceActor {
  constructor(planet, loadout = DEFAULT_LOADOUT) {
    super(planet, playerBody(loadout));
    this.loadout = { ...DEFAULT_LOADOUT, ...loadout };
    this.speed = 3.6;
    this.runMul = 6 / this.speed;
    this.turnRate = 12;
    this._jumpBuffer = 0;
    this.groundMotion = new GroundMotion();
    this.travelSpeed = 0;
    this.motionStart = new THREE.Vector3();
  }

  // 커스터마이즈 적용 — 몸 통째로 재생성 후 교체(라이브 프리뷰).
  setLoadout(loadout) {
    this.loadout = { ...this.loadout, ...loadout };
    this.setBody(playerBody(this.loadout));
    return this.loadout;
  }

  resetTraversal() {
    super.resetTraversal();
    this.groundMotion?.reset();this.travelSpeed=0;
    // 다음 장면이 대사 때문에 곧바로 멈추더라도 활공하던 팔이 남지 않는다.
    if (this.body) { animateLimbs(this.body, 1, false, false); this.syncMesh(); }
    return this;
  }

  // intent {x:strafe, y:forward, run}; camForward/camRight: 카메라 접선 프레임(Engine 제공).
  update(dt, intent, camForward, camRight, deferAnimation=false) {
    _moveDir.set(0, 0, 0)
      .addScaledVector(camRight, intent.x)
      .addScaledVector(camForward, intent.y);
    this.up.copy(this.position).normalize();
    projectTangent(_moveDir, this.up);
    this.running = !!intent.run;
    // 착지 직전 누른 입력도 0.14초 동안 받아준다. 누르고 있기만 해서는 재도약하지 않는다.
    this._jumpBuffer = intent.jump ? 0.14 : Math.max(0, this._jumpBuffer - dt);
    if (this._jumpBuffer > 0 && this.jump()) this._jumpBuffer = 0;
    this.setGlide(intent.jumpHeld);   // 떨어지는 중 점프 유지 = 활공
    this.updateVertical(dt);
    const len = _moveDir.length();
    if(len>1e-3)_moveDir.divideScalar(len);else _moveDir.set(0,0,0);
    this.motionStart.copy(this.position);
    const velocity=this.gliding?null:this.groundMotion.update(dt,_moveDir,len,this.speed*(this.running?this.runMul:1),this.up,this.grounded);
    const speed=this.gliding?this.glideSpeed:velocity.length();
    this.moving = speed > .01;
    if (this.moving) {
      // 활공막이 열리면 전진을 유지한다. 방향 입력은 직접 선회로 이어진다.
      if(this.gliding){if(len<=1e-3)_moveDir.copy(this.heading);this.groundMotion.reset();}
      else _moveDir.copy(velocity).divideScalar(speed);
      this.move(_moveDir, dt,speed);
    } else {
      this.lastArc = 0;
    }
    if(!deferAnimation)this.finishMotion(dt);
  }

  finishMotion(dt){
    _actual.subVectors(this.position,this.motionStart);projectTangent(_actual,this.up);
    this.travelSpeed=dt>0?_actual.length()/dt:0;
    animateLimbs(this.body, dt, this.moving && this.grounded, this.running, {
      airborne: this.airborne, gliding: this.gliding, vy: this.vy, landing: this.landingImpact, traveling: this.moving,
      speed:this.travelSpeed,runBlend:THREE.MathUtils.smoothstep(this.travelSpeed,1.8,3.4),
    });
    this.syncMesh();
  }
}
