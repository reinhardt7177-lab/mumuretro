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
const TOWER_H = 15;                 // 플레이어 키 1.5u의 10배 — 멀리서 랜드마크로 읽히는 크기
const BASE_R = 2.8;                 // 기단 반경(접지 계산·충돌에 쓰임)
// 플레이어를 막을 원형 콜라이더 반경. 기단 최대폭(BASE_R*1.08) + 몸 반경.
// 시련 시작 반경(ENTER_R=7)보다 한참 작아야 탑에 닿아 E를 누를 수 있다.
export const TOWER_HIT_R = BASE_R * 1.08 + 0.35;
const ENTER_R = 7;                  // 시련 시작 가능 반경(월드)
const LEAVE_R = 46;                 // 이보다 멀어지면 시련 중단

const noOut = (m) => { m.userData.outlineParameters = { visible: false }; return m; };

// 돌탑 + 빛기둥. 빛기둥은 수평선 너머에서도 보여 "저기 뭔가 있다"를 만든다.
// 7u 원뿔 하나로는 "탑"으로 안 읽혀서, 기단 → 몸통 → 발코니 → 첨탑으로 실루엣을 나눴다.
function buildTower(cleared) {
  const g = new THREE.Group();
  const stone = toon(cleared ? 0xb9ab90 : 0x918d87);
  const trim = toon(cleared ? 0x8f8168 : 0x6f6b66);
  const col = cleared ? 0x9ce8a8 : 0xffd76a;

  const put = (mesh, y) => { mesh.position.y = y; mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; };

  // 기단 — 넓고 낮은 8각 받침 2단
  put(new THREE.Mesh(new THREE.CylinderGeometry(BASE_R, BASE_R * 1.08, 0.7, 8), trim), 0.35);
  put(new THREE.Mesh(new THREE.CylinderGeometry(BASE_R * 0.82, BASE_R * 0.95, 0.6, 8), stone), 1.0);

  // 몸통 — 위로 갈수록 좁아지는 5단. 단마다 살짝 턱을 줘 그림자가 걸리게.
  let y = 1.3, r = BASE_R * 0.78;
  for (let i = 0; i < 5; i++) {
    const h = 1.9, rTop = r * 0.86;
    put(new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, 8), stone), y + h / 2);
    y += h;
    put(new THREE.Mesh(new THREE.CylinderGeometry(rTop * 1.1, rTop * 1.1, 0.18, 8), trim), y + 0.09);
    y += 0.18;
    r = rTop;
  }

  // 발코니 — 실루엣에 턱 하나. 이게 있어야 '탑'으로 읽힌다.
  put(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.5, r * 1.35, 0.34, 8), trim), y + 0.17);
  y += 0.34;

  // 첨탑
  put(new THREE.Mesh(new THREE.ConeGeometry(r * 1.15, 1.7, 8), stone), y + 0.85);
  y += 1.7;

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12),
    noOut(new THREE.MeshBasicMaterial({ color: col })));
  orb.position.y = y + 0.55;
  g.add(orb);

  // 빛기둥 — 반투명, 깊이 기록 안 함(지형 너머에서도 보이게)
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.5, 40, 10, 1, true),
    noOut(new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide,
    })));
  beam.position.y = y + 20;
  g.add(beam);

  g.userData.orbY = y + 0.55;
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
      // 카메라 충돌용 실물 메시. 빛기둥(40u 반투명 원통)과 오브는 뺀다 —
      // 넣으면 카메라가 빛기둥에 막혀 멀리서부터 확 당겨진다.
      const solid = [];
      t.group.traverse(o => { if (o.isMesh && o !== t.orb && o !== t.beam) solid.push(o); });
      return { ...s, ...t, cleared, solidMeshes: solid, hitR: TOWER_HIT_R };
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
      t.orb.position.y = t.group.userData.orbY + Math.sin(this._t * 1.6) * 0.28;
      t.beam.material.opacity = 0.19 + Math.sin(this._t * 1.1) * 0.06;
    }
    // 너무 멀어지면 시련 중단
    if (this.active && playerPos.angleTo(this.active.tower.pos) > LEAVE_R / this.planet.R) {
      this.abort('far');
    }
  }
}
