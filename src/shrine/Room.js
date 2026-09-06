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
import { QuakeGate, HexLavaGate, GeyserGate, FireGod } from './FireGates.js';
import { ShaftGate, FiveDoorsGate, GrandGod } from './StrataGates.js';
import { StrataOrderGate } from './StrataOrder.js';
import { BalanceScale } from './Scale.js';
import { Prize } from './Prize.js';
import { toon } from '../render/Toon.js';
import { addBoard } from './Signboard.js';

const GATES = {
  tile: TileGate, laser: LaserGate, plate: PlateGate,          // 01 균형
  shade: ShadeGate, mirror: MirrorGate, silhouette: SilhouetteGate,  // 02 그림자
  sieve: SieveGate, magnet: MagnetGate, evaporate: EvaporateGate,    // 03 분리
  freeze: FreezeGate, slide: SlideGate, steam: SteamGate,            // 04 물
  quake: QuakeGate, hexlava: HexLavaGate, geyser: GeyserGate,        // 05 화산
  strataOrder: StrataOrderGate, shaft: ShaftGate, fiveDoors: FiveDoorsGate,  // 06 지층
};

const FINALS = {
  mirrorGod: MirrorGod, siftGod: SiftGod, waterGod: WaterGod,
  fireGod: FireGod, grand: GrandGod,
};

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
  prompt() { return `🚧 ${this.kind} — 아직 만드는 중이다, 그냥 지나가라`; }
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
  prompt(p) {
    if (this.solved) return null;
    return this._near(p) ? `E — 제단 (🚧 ${this.kind})` : `🚧 ${this.kind} — 제단으로 가면 구슬이 나온다`;
  }
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

  // 왼쪽 벽에 목표, 오른쪽 벽에 힌트.
  // 프롬프트는 가까이 갔을 때 무엇을 누를지만 알려 준다 — 그건 조작 안내지 목표가 아니다.
  //
  // 힌트 판은 꺼진 채로 걸린다. 헤맨 시간이 쌓여야 켜지고 더 헤매면 한 단계 더 밝아진다.
  // **답은 주지 않는다** — 어디를 봐야 하는지만 말한다. 답을 주면 그 순간
  // 이 방은 문제가 아니라 버튼이 된다.
  const goals = {};
  const hints = {};
  for (const r of spec.rooms) {
    if (!r.goal) continue;
    const seg = dungeon.rectOf(r.id);
    goals[r.id] = r.goal;
    addBoard(scene, seg, -1, r.name, r.goal, spec.theme.glow);
    if (!r.hints) continue;
    const board = addBoard(scene, seg, 1, '힌트', '아직 잠겨 있다', spec.theme.glow, true);
    hints[r.id] = { board, texts: r.hints, level: 0, t: 0 };
  }

  const shrineSeg = dungeon.rectOf('shrine');
  const final = makeFinal(spec.final, scene, shrineSeg, spec.theme);
  const prize = new Prize(scene, final.prizePos);

  // ── 가림막 — 카메라와 나 사이에 낀 판은 흐려진다 ─────────────────────────
  // ★ 카메라가 낮은 천장에서 각도를 낮춰 제대로 물러나게 되자, 예전엔 갈 수
  //   없던 자리까지 가게 됐다 — 닫힌 문과 타일방 가림막 **너머**다. 그러면
  //   화면 아래 절반이 초록 반투명 판으로 덮이고 그 뒤로 내 캐릭터가 비친다.
  //   카메라를 다시 가두면 어렵게 얻은 거리를 도로 잃으므로, 가두는 대신
  //   **낀 판을 흐린다.** 판은 전부 Z에 수직이라 "사이에 있나"는 곱셈 한 번이다.
  const veils = [];
  scene.traverse((o) => {
    if (o.isMesh && o.userData.veil && o.material && o.material.transparent) {
      veils.push({ mesh: o, base: o.material.opacity, cur: o.material.opacity });
    }
  });
  const fadeVeils = (camZ, actorZ, dt) => {
    for (const v of veils) {
      if (!v.mesh.visible) continue;
      const pz = v.mesh.position.z;
      const between = (camZ - pz) * (pz - actorZ) > 0;
      const want = between ? v.base * 0.10 : v.base;
      // 툭 꺼지면 그것대로 눈에 띈다. 지나가면서 스르르 사라져야 한다.
      v.cur += (want - v.cur) * Math.min(1, dt * 9);
      v.mesh.material.opacity = v.cur;
    }
  };

  return {
    fadeVeils, veils,
    spec, scene, dungeon, gates, final, prize, goals, hints,
    // 헤맨 시간이 쌓이면 힌트가 한 단계씩 켜진다. 실패는 시간을 크게 밀어 준다 —
    // 가만히 서 있는 것과 부딪히며 애쓰는 것은 다르게 대접해야 한다.
    // 켜졌으면 그 문구를 돌려준다(배너로 한 번 알리려고).
    nudge(id, dt) {
      const h = hints[id];
      if (!h || h.level >= h.texts.length) return null;
      h.t += dt;
      const need = h.level === 0 ? 45 : 90;
      if (h.t < need) return null;
      h.board.set(`힌트 ${h.level + 1}`, h.texts[h.level], false);
      h.level++;
      return h.texts[h.level - 1];
    },
    obstacles: final.obstacles || [],
    shrineSeg,
    // 난이도 — **사당 번호가 아니라 지금까지 깬 개수**로 오른다(0~5).
    // 어느 순서로 돌든 점점 어려워지고, 같은 사당을 다시 와도 그동안 실력이
    // 붙었으면 그만큼 올라와 있다. 몸으로 푸는 관문만 반응한다.
    applyTier(t) {
      for (const g of gates) if (g.gate.setTier) g.gate.setTier(t);
      if (final.setTier) final.setTier(t);
    },
    // 같은 사당을 다시 도전할 때. 다른 사당으로 갈 때는 부를 일이 없다 — 씬이 다르다.
    restart() {
      // ★ restart만 부르고 있었다. PlateGate처럼 reset만 가진 관문은 되돌아가지 않아
      //   같은 사당을 다시 들어가면 압력판이 이미 풀려 있었다(전수 조사에서 잡힘).
      //   둘 중 있는 것을 부른다 — 계약에 없는 이름을 강요하지 않는다.
      for (const g of gates) {
        g.solved = false;
        if (g.gate.restart) g.gate.restart();
        else if (g.gate.reset) g.gate.reset();
      }
      // 힌트도 처음으로. 한 번 본 힌트가 다음 판까지 켜져 있으면
      // 그 방은 두 번째부터 문제가 아니다.
      for (const id in hints) {
        const h = hints[id];
        h.level = 0; h.t = 0;
        h.board.set('힌트', '아직 잠겨 있다', true);
      }
      dungeon.resetDoors();
      if (final.restart) final.restart();
      if (final.reset) final.reset();
      prize.reset();
    },
  };
}
