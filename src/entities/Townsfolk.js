// 동네 주민 NPC — 집 근처에서 주로 idle, 가끔 짧게 배회. 일부는 배달 수령인(배달 시 감사 이모지).
import * as THREE from 'three';
import { SurfaceActor } from './SurfaceActor.js';
import { buildKid, animateLimbs } from './Character.js';
import { projectTangent, randomTangent } from '../world/SurfaceTransform.js';

// 주민 색 변주(우체부와 구분되는 평상복 톤)
export const TOWN_COLORS = [
  { skin: 0xeab78f, jacket: 0xb0654a, pants: 0x4a4a55, hair: 0x2a221c, cap: 0x9a5a42, pack: 0x7a6a55, shoe: 0x33302d },
  { skin: 0xd9a06f, jacket: 0x5a8f8a, pants: 0x33414f, hair: 0x322820, cap: 0x4f7a76, pack: 0x6a6a6a, shoe: 0x2a2a2a },
  { skin: 0xf0c39a, jacket: 0xc9a44a, pants: 0x5a4a3a, hair: 0x3a2e26, cap: 0xb08a3a, pack: 0x8a7a5a, shoe: 0x3a322a },
  { skin: 0xe0aa80, jacket: 0x8a6aa0, pants: 0x40384f, hair: 0x281f1a, cap: 0x6a4f80, pack: 0x7a6a8a, shoe: 0x2e2730 },
];
const IDLE_EMOJIS = ['🙂', '💤', '🎵', '☀️', '🍵', '😊', '🐱', '…'];
const THANK_EMOJIS = ['😊', '🙏', '✨', '🌸', '❤️'];
const pick = (a, rng) => a[Math.floor(rng() * a.length)];

export class Townsfolk extends SurfaceActor {
  constructor(planet, posVec, colors, rng = Math.random) {
    super(planet, buildKid(colors));
    this.rng = rng;
    this.speed = 1.5; this.turnRate = 5;
    this.position.copy(posVec);
    planet.projectToSurface(this.position);
    this._initFrame();
    this.home = this.position.clone();
    this.state = 'idle';
    this.timer = 1 + rng() * 3;
    this.moveDir = new THREE.Vector3();
    this.emoteTimer = 4 + rng() * 9;
    this.syncMesh();
  }

  update(dt, emojiLayer) {
    this.timer -= dt;
    if (this.state === 'idle') {
      this.moving = false;
      if (this.timer <= 0) {
        // 집에서 멀면 귀가, 아니면 랜덤 짧은 배회
        if (this.position.angleTo(this.home) > 0.055) {
          this.moveDir.copy(this.home).sub(this.position);
          projectTangent(this.moveDir, this.up);
          if (this.moveDir.lengthSq() > 1e-6) this.moveDir.normalize(); else this.moveDir.copy(randomTangent(this.up, this.rng));
        } else {
          this.moveDir.copy(randomTangent(this.up, this.rng));
        }
        this.state = 'walk'; this.timer = 0.7 + this.rng() * 1.4;
      }
    } else {
      this.moving = true;
      this.move(this.moveDir, dt);
      if (this.timer <= 0) { this.state = 'idle'; this.timer = 2 + this.rng() * 4; }
    }
    this.syncMesh();
    animateLimbs(this.body, dt, this.moving, false);

    this.emoteTimer -= dt;
    if (this.emoteTimer <= 0 && emojiLayer) {
      emojiLayer.spawn(this.position, this.up, pick(IDLE_EMOJIS, this.rng));
      this.emoteTimer = 9 + this.rng() * 12;
    }
  }

  thank(emojiLayer) {
    if (emojiLayer) emojiLayer.spawn(this.position, this.up, pick(THANK_EMOJIS, this.rng), { life: 2.8, size: 1.5 });
  }
}
