// 유령 메신저 — 가짜 다른 플레이어. PresenceSource의 원격 상태로 부드럽게 보간(넷코드 보간과 동일 경로).
// 반투명 + 그림자 없음으로 몽환 톤 + 주민과 구분.
import * as THREE from 'three';
import { SurfaceActor } from './SurfaceActor.js';
import { buildKid, animateLimbs } from './Character.js';
import { orthonormalizeHeading } from '../world/SurfaceTransform.js';

const GHOST_COLORS = { skin: 0xbfcfe0, jacket: 0x7a8bb5, pants: 0x5a6a8a, hair: 0x3a4258, cap: 0x6a7aa5, pack: 0x8a95b5, shoe: 0x4a5268 };

export class GhostMessenger extends SurfaceActor {
  constructor(planet, name) {
    super(planet, buildKid(GHOST_COLORS));
    this.name = name;
    this.body.traverse(o => {
      if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.6; o.castShadow = false; }
    });
  }

  // 원격 스냅샷으로 보간. (낮은 틱의 네트워크 소스로 교체해도 같은 lerp로 동작)
  applyState(state, dt) {
    const k = Math.min(1, dt * 6);
    this.position.lerp(state.position, k).setLength(this.planet.R);
    this.heading.lerp(state.heading, k);
    this.up.copy(this.position).normalize();
    orthonormalizeHeading(this.heading, this.up);
    if (this.heading.lengthSq() < 1e-6) this.heading.copy(state.heading);
    this.moving = !!state.moving;
    this.syncMesh();
    animateLimbs(this.body, dt, this.moving, false);
  }
}
