// 프레즌스 소스(멀티 seam) — 인터페이스: update(dt) / getRemoteActors() / sendEmote(id).
// 지금은 LocalGhostSource(가짜 유령 시뮬). 이후 WebSocketSource로 렌더/로직 변경 없이 교체.
//   interface PresenceSource { update(dt); getRemoteActors():[{id,name,position,heading,up,moving,emote}]; sendEmote(id?); }
import * as THREE from 'three';
import { moveOnSphere, orthonormalizeHeading, randomTangent } from '../world/SurfaceTransform.js';
import { makeRNG } from '../util/math.js';

const NAMES = ['바람', '구름', '초롱', '노을', '별이', '달이', '소리', '그림자', '안개', '햇살'];
const EMOJIS = ['👋', '😊', '✨', '🎈', '📮', '🎵', '🙂', '🐱', '☀️', '💤', '🌙', '🍙'];
const _out = { lastAxis: new THREE.Vector3(), lastArc: 0 };

// 구면 균일 샘플 후 지형 표면으로 투영.
function randomSurfacePoint(planet, rng) {
  const z = rng() * 2 - 1, th = rng() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return planet.projectToSurface(new THREE.Vector3(r * Math.cos(th), z, r * Math.sin(th)));
}

export class LocalGhostSource {
  constructor(planet, count = 8, seed = 42) {
    this.planet = planet;
    this.rng = makeRNG(seed);
    this.ghosts = [];
    for (let i = 0; i < count; i++) {
      const position = randomSurfacePoint(planet, this.rng);
      const up = position.clone().normalize();
      this.ghosts.push({
        id: 'g' + i, name: NAMES[i % NAMES.length],
        position, up, heading: randomTangent(up, this.rng),
        moving: true, timer: 1 + this.rng() * 3, emote: null, emoteCD: 3 + this.rng() * 7,
      });
    }
  }

  update(dt) {
    const speed = 2.6;
    for (const g of this.ghosts) {
      g.emote = null;
      g.timer -= dt;
      if (g.timer <= 0) {
        if (g.moving && this.rng() < 0.4) { g.moving = false; g.timer = 1 + this.rng() * 2; }
        else { g.moving = true; g.heading = randomTangent(g.up, this.rng); g.timer = 2 + this.rng() * 4; }
      }
      if (g.moving) {
        moveOnSphere(g.position, g.heading, g.heading, speed * dt, this.planet, _out);
        g.up.copy(g.position).normalize();
        orthonormalizeHeading(g.heading, g.up);
      }
      g.emoteCD -= dt;
      if (g.emoteCD <= 0) { g.emote = EMOJIS[Math.floor(this.rng() * EMOJIS.length)]; g.emoteCD = 7 + this.rng() * 11; }
    }
  }

  getRemoteActors() {
    return this.ghosts.map(g => ({ id: g.id, name: g.name, position: g.position, heading: g.heading, up: g.up, moving: g.moving, emote: g.emote }));
  }

  // 플레이어가 이모지를 보내면 가까운 유령 id 반환(boot가 그 유령 위에 손 흔들기 이모지 스폰).
  sendEmote(playerPos, maxAngle = 0.45) {
    let nearest = null, nd = Infinity;
    for (const g of this.ghosts) { const d = g.position.angleTo(playerPos); if (d < nd) { nd = d; nearest = g; } }
    return (nearest && nd < maxAngle) ? nearest.id : null;
  }
}
