// 도깨비 — 안개 골짜기에서 편지를 훔쳐 달아나는 장난꾸러기.
//
// 전투가 아니라 술래잡기다. 무기도 체력도 없다. 대신 전투의 재미 요소(추격·회피·타이밍)는 그대로 가져온다.
// 학습 앱에 무기와 체력바를 넣으면 그 얘기만 나오고, 무엇보다 전투가 재밌으면
// 아이는 전투만 하고 문제를 안 푼다. 부수 시스템이 주 루프보다 재밌으면 그게 실패다.
//
// 이동은 SurfaceActor를 그대로 쓴다(구면 대원 이동 + 지형 접지). 도망 로직만 얹었다.
import * as THREE from 'three';
import { SurfaceActor } from './SurfaceActor.js';
import { toon } from '../rendering/Toon.js';
import { projectTangent } from '../world/SurfaceTransform.js';

const _away = new THREE.Vector3();
const _side = new THREE.Vector3();

// 뿔 달린 작은 몸통. 저폴리 톤에 맞춰 단순하게.
function buildDokkaebi() {
  const g = new THREE.Group();
  const skin = toon(0x8d5fa8), horn = toon(0xf0d98a), cloth = toon(0x54407a);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.86, 0.56), skin);
  body.position.y = 0.62; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.58, 0.6), skin);
  head.position.y = 1.34; head.castShadow = true; g.add(head);
  for (const s of [-1, 1]) {
    const hn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 6), horn);
    hn.position.set(s * 0.2, 1.78, 0); hn.castShadow = true; g.add(hn);
  }
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.34, 0.62), cloth);
  skirt.position.y = 0.2; g.add(skirt);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), skin);
    arm.position.set(s * 0.47, 0.72, 0); arm.castShadow = true; g.add(arm);
  }
  return g;
}

export class Dokkaebi extends SurfaceActor {
  constructor(planet, opts = {}) {
    super(planet, buildDokkaebi());
    this.speed = opts.speed ?? 5.6;        // 플레이어 걷기 5.0, 달리기 8.5 → 달리면 잡힌다
    this.turnRate = 8;
    this.fleeRange = opts.fleeRange ?? 26; // 이 안에 들어오면 도망친다
    this.catchRange = opts.catchRange ?? 2.6;
    this.homeDir = opts.homeDir.clone();   // 골짜기 중심 — 너무 멀리 못 가게 묶어둔다
    this.homeAng = opts.homeAng ?? 0.12;
    this.caught = false;
    this._zig = 0;                          // 지그재그 위상
    this._bob = 0;
    this.mesh.visible = false;
  }

  spawnAt(pos) {
    this.position.copy(pos);
    this.planet.projectToSurface(this.position);
    this._initFrame();
    this.caught = false;
    this.mesh.visible = true;
    this.syncMesh();
    return this;
  }

  // 플레이어 반대 방향으로 도망치되, 골짜기 밖으로는 나가지 않는다.
  update(dt, playerPos) {
    if (this.caught || !this.mesh.visible) return null;
    this._bob += dt;
    this.up.copy(this.position).normalize();

    const dist = this.position.angleTo(playerPos) * this.planet.R;
    if (dist < this.catchRange) { this.catch(); return 'caught'; }

    if (dist < this.fleeRange) {
      // 플레이어에서 멀어지는 접선 방향 + 지그재그(직선으로만 도망치면 너무 쉽다)
      _away.copy(this.position).sub(playerPos);
      projectTangent(_away, this.up);
      if (_away.lengthSq() < 1e-8) _away.copy(this.heading);
      _away.normalize();
      this._zig += dt * 2.2;
      _side.crossVectors(this.up, _away).multiplyScalar(Math.sin(this._zig) * 0.55);
      _away.add(_side).normalize();

      // 골짜기 경계에 닿으면 안쪽으로 꺾는다 — 절벽을 넘어 도망가면 잡을 수가 없다
      const homeD = this.position.angleTo(this.homeDir);
      if (homeD > this.homeAng) {
        const back = this.homeDir.clone();
        projectTangent(back, this.up);
        if (back.lengthSq() > 1e-8) {
          back.normalize();
          const t = Math.min(1, (homeD - this.homeAng) / (this.homeAng * 0.5));
          _away.lerp(back, t).normalize();
        }
      }
      this.running = true;
      this.move(_away, dt);
    } else {
      this.running = false;
      this.lastArc = 0;
    }
    this.syncMesh();
    // 둥실둥실 — 도깨비다운 부유감
    if (this.body) this.body.position.y = this.footOffset + Math.sin(this._bob * 3.4) * 0.12;
    return null;
  }

  catch() {
    this.caught = true;
    this.mesh.visible = false;
  }
}
