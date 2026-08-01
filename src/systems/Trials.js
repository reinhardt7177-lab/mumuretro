// 시련소 — 구역마다 하나씩 선 탑. 그 구역 과목으로 5문제 연속 정답이면 클리어.
//
// 왜 별도 화면이 아니라 "그 구역에서 계속 배달"인가:
// 이 게임의 학습은 걸어가는 동안 생각하는 것이다. 시련을 UI 창으로 만들면
// 그냥 문제집이 되고 세계가 사라진다. 그래서 시련은 장소가 아니라 **상태**다.
//
// 벌점은 없다. 틀리면 연속 횟수만 0으로 돌아가고, 개별 문제의 Leitner 진도는 그대로 유지된다.
// 나가고 싶으면 언제든 나갈 수 있다(연속만 초기화).
import * as THREE from 'three';
import { toon } from '../rendering/Toon.js';

export const TRIAL_STREAK = 5;      // 클리어에 필요한 연속 정답
const TOWER_H = 7;
const ENTER_R = 6;                  // 시련 시작 가능 반경(월드)
const LEAVE_R = 42;                 // 이보다 멀어지면 시련 중단

const noOut = (m) => { m.userData.outlineParameters = { visible: false }; return m; };

// 돌탑 + 빛기둥. 빛기둥은 수평선 너머에서도 보여 "저기 뭔가 있다"를 만든다.
function buildTower(cleared) {
  const g = new THREE.Group();
  const stone = toon(cleared ? 0xb8a98c : 0x8d8a86);
  for (let i = 0; i < 4; i++) {
    const r = 1.5 - i * 0.28, h = 1.5;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r, h, 8), stone);
    m.position.y = h * 0.5 + i * h;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  const col = cleared ? 0x9ce8a8 : 0xffd76a;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12),
    noOut(new THREE.MeshBasicMaterial({ color: col })));
  orb.position.y = TOWER_H - 0.6;
  g.add(orb);
  // 빛기둥 — 반투명, 깊이 기록 안 함(멀리서도 보이게)
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 1.0, 26, 10, 1, true),
    noOut(new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide,
    })));
  beam.position.y = 13 + TOWER_H * 0.5;
  g.add(beam);
  return { group: g, orb, beam };
}

export class Trials {
  // spots: [{ regionId, name, emoji, pos, dir }]
  constructor(scene, planet, spots, abilities, opts = {}) {
    this.planet = planet;
    this.abilities = abilities;
    this.onStart = opts.onStart || (() => {});
    this.onProgress = opts.onProgress || (() => {});
    this.onClear = opts.onClear || (() => {});
    this.onAbort = opts.onAbort || (() => {});

    this.active = null;      // { regionId, streak }
    this._t = 0;

    this.towers = spots.map(s => {
      const cleared = abilities.cleared.has(s.regionId);
      const t = buildTower(cleared);
      t.group.position.copy(s.pos);
      t.group.quaternion.copy(planet.frameAt(s.pos, 0).quaternion);
      scene.add(t.group);
      return { ...s, ...t, cleared };
    });
  }

  // 사거리 안이면서 아직 클리어 안 한 탑.
  towerInRange(playerPos) {
    const ang = ENTER_R / this.planet.R;
    for (const t of this.towers) {
      if (playerPos.angleTo(t.pos) < ang) return t;
    }
    return null;
  }

  start(tower) {
    if (!tower || tower.cleared || this.active) return false;
    this.active = { regionId: tower.regionId, streak: 0, tower };
    this.onStart(tower);
    return true;
  }

  abort(reason) {
    if (!this.active) return;
    const a = this.active;
    this.active = null;
    this.onAbort(a, reason);
  }

  // 학습 시스템의 채점 결과를 받아 연속 정답을 센다.
  onAnswer(correct) {
    if (!this.active) return null;
    if (correct) {
      this.active.streak++;
      if (this.active.streak >= TRIAL_STREAK) {
        const t = this.active.tower;
        t.cleared = true;
        // 클리어한 탑은 색이 바뀐다 — 지도에서 "여긴 끝났다"가 한눈에 보인다.
        t.orb.material.color.set(0x9ce8a8);
        t.beam.material.color.set(0x9ce8a8);
        const fresh = this.abilities.clearTrial(t.regionId);
        const done = this.active;
        this.active = null;
        this.onClear(t, fresh);
        return { cleared: true, streak: done.streak, unlocked: fresh };
      }
      this.onProgress(this.active);
      return { cleared: false, streak: this.active.streak };
    }
    // 틀림 — 연속만 0으로. 쫓아내지 않는다(벌점 없음 원칙).
    this.active.streak = 0;
    this.onProgress(this.active);
    return { cleared: false, streak: 0, reset: true };
  }

  // 진행 표시용 ●●●○○
  get streakDots() {
    if (!this.active) return '';
    const s = this.active.streak;
    return '●'.repeat(s) + '○'.repeat(Math.max(0, TRIAL_STREAK - s));
  }

  update(dt, playerPos) {
    this._t += dt;
    // 오브 부유 + 빛기둥 맥동
    for (const t of this.towers) {
      t.orb.position.y = TOWER_H - 0.6 + Math.sin(this._t * 1.6) * 0.22;
      t.beam.material.opacity = 0.2 + Math.sin(this._t * 1.1) * 0.07;
    }
    // 너무 멀어지면 시련 중단
    if (this.active && playerPos.angleTo(this.active.tower.pos) > LEAVE_R / this.planet.R) {
      this.abort('far');
    }
  }
}
