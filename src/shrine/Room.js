// 사당 하나의 내부 전체 — 씬·던전·관문·신전·구슬을 한 덩어리로 조립한다.
//
// ★ 예전엔 이 전부가 boot.js에 **한 벌만** 있었다. 그래서 사당이 여섯인데
//   내부는 하나였고, 첫 사당을 깨면 두 번째 사당이 이미 다 열린 채로 시작했다.
//   그걸 resetShrineRun()으로 매번 되감고 있었는데, 그건 증상만 누른 것이다.
//   사당마다 자기 씬을 가지면 상태가 자연히 각자 남는다 — 되감을 것이 없다.
//
// ★ 관문 종류는 문자열로 고른다. layouts.js가 `gate:'mirror'`라고 적으면 여기서
//   고른다. 새 사당을 붙이는 데 boot.js를 고쳐야 한다면 그건 아직 데이터가 아니다.
//
// 관문·신전의 계약은 하나뿐이다. 셋 다 지키면 되고, 없는 건 안 불린다.
//   update(dt, actor, scene) → { fail? }
//   prompt(pos)             → string | null
//   solvedBy(actor)         → bool
//   interact(pos)           → bool          (손으로 만지는 것만)
//   restart()                               (사당을 다시 도전할 때)
import * as THREE from 'three';
import { buildDungeon } from './Dungeon.js';
import { TileGate, LaserGate, PlateGate } from './Gates.js';
import { ShadeGate, MirrorGate, SilhouetteGate, MirrorGod } from './ShadowGates.js';
import { SieveGate, MagnetGate, EvaporateGate, SiftGod } from './SiftGates.js';
import { FreezeGate, SlideGate, SteamGate, WaterGod } from './WaterGates.js';
import { BalanceScale } from './Scale.js';
import { Prize } from './Prize.js';
import { toon } from '../render/Toon.js';

const GATES = {
  tile: TileGate, laser: LaserGate, plate: PlateGate,          // 01 균형
  shade: ShadeGate, mirror: MirrorGate, silhouette: SilhouetteGate,  // 02 그림자
  sieve: SieveGate, magnet: MagnetGate, evaporate: EvaporateGate,    // 03 분리
  freeze: FreezeGate, slide: SlideGate, steam: SteamGate,            // 04 물
};

const FINALS = { mirrorGod: MirrorGod, siftGod: SiftGod, waterGod: WaterGod };

// 아직 안 만든 관문 — 방을 막지 않고 지나가게 둔다.
// ★ 여기서 예외를 던지면 사당 하나를 만드는 동안 나머지 다섯이 통째로 죽는다.
//   못 만든 것은 못 만들었다고 말하고 길은 열어 둔다.
class TodoGate {
  constructor(scene, seg, opts) {
    this.seg = seg;
    this.kind = opts.kind;
    console.warn(`[shrine] 관문 '${opts.kind}' 아직 없음 — 통과만 됩니다`);
  }
  update() { return {}; }
  prompt() { return `🚧 ${this.kind} — 만드는 중이에요, 그냥 지나가요`; }
  solvedBy(actor) { return actor.position.z < this.seg.z0 + 1.6; }
  restart() {}
}

// 아직 안 만든 신전 — 제단을 만지면 구슬이 나온다. 사당의 고리는 닫혀 있어야 한다.
class TodoGod {
  constructor(scene, seg, theme, kind) {
    this.solved = false;
    this.kind = kind;
    const cx = (seg.x0 + seg.x1) / 2;
    this.z = seg.z0 + (seg.z1 - seg.z0) * 0.35;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 1.6, 8), toon(theme.stoneLite));
    m.position.set(cx, 0.8, this.z);
    scene.add(m);
    this.x = cx;
    this.obstacles = [{ x: cx, z: this.z, r: 1.9 }];
    this.prizePos = new THREE.Vector3(cx, 0, this.z + 4.2);
    console.warn(`[shrine] 신전 '${kind}' 아직 없음 — 제단으로 대신합니다`);
  }
  update() { return {}; }
  _near(p) { return Math.hypot(p.x - this.x, p.z - this.z) < 2.8; }
  prompt(p) { return this.solved ? null : (this._near(p) ? `E — 제단 (🚧 ${this.kind})` : null); }
  interact(p) { if (!this._near(p)) return false; this.solved = true; return true; }
  solvedBy() { return this.solved; }
  restart() { this.solved = false; }
}

// 신전 — 사당마다 다르다. 저울은 01, 거울의 신은 02.
function makeFinal(kind, scene, seg, theme) {
  if (kind === 'scale') {
    const oz = seg.z0 + (seg.z1 - seg.z0) * 0.47;
    const s = new BalanceScale(scene, { origin: new THREE.Vector3(0, 0, oz) });
    s.obstacles = [{ x: 0, z: oz - 2.4, r: 1.9 }];
    s.prizePos = new THREE.Vector3(0, 0, oz + 2.8);
    return s;
  }
  const Cls = FINALS[kind];
  if (Cls) return new Cls(scene, seg, theme);
  return new TodoGod(scene, seg, theme, kind);
}

export function buildRoom(spec) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(spec.theme.bg);
  const dungeon = buildDungeon(scene, spec.rooms, spec.theme);

  const gates = [];
  for (const r of spec.rooms) {
    if (!r.gate) continue;
    const Cls = GATES[r.gate] || TodoGate;
    gates.push({
      room: r.id, solved: false,
      // dungeon을 넘기는 이유: 얼음 발판처럼 **걸을 수 있는 영역 자체를 만드는**
      // 관문이 있다. 물 위는 못 걷고, 얼면 걸을 수 있어야 한다.
      gate: new Cls(scene, dungeon.rectOf(r.id), {
        theme: spec.theme, kind: r.gate, dungeon, entryRect: dungeon.rectOf('entry'),
      }),
    });
  }

  const shrineSeg = dungeon.rectOf('shrine');
  const final = makeFinal(spec.final, scene, shrineSeg, spec.theme);
  const prize = new Prize(scene, final.prizePos);

  return {
    spec, scene, dungeon, gates, final, prize,
    obstacles: final.obstacles || [],
    shrineSeg,
    // 같은 사당을 다시 도전할 때. 다른 사당으로 갈 때는 부를 일이 없다 — 씬이 다르다.
    restart() {
      for (const g of gates) { g.solved = false; if (g.gate.restart) g.gate.restart(); }
      dungeon.resetDoors();
      if (final.restart) final.restart();
      if (final.reset) final.reset();
      prize.reset();
    },
  };
}
