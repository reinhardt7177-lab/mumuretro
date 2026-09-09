import { TEMPS } from './WaterGates.js';
import { ENTRY_Z } from './layouts.js';
import { WATER_COURT as C } from '../data/waterCourt.js';
import { SHRINE } from '../data/lighting.js';

const number = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
const integer = (v, lo, hi) => Number.isInteger(v) && number(v, lo, hi);
const bool = v => typeof v === 'boolean';
const array = (v, n, check) => Array.isArray(v) && v.length === n && v.every(check);
const states = ['ice', 'water', 'steam'];

// 물 사당만의 저장 계약. 검증을 마친 뒤에만 메시·문·퍼즐을 함께 바꾼다.
export function attachWaterProgress(room) {
  const [freeze, slide, steam] = room.gates.map(g => g.gate), god = room.final;
  room.hasProgress = false; room.checkpoint = null;
  room.captureCheckpoint = actor => {
    if (!actor) return;
    const p = actor.position;
    let x = p.x, z = p.z, y = actor.floorAt(x, z);
    if (!room.gates[0].solved) {
      const b = freeze.bands.find(b => z >= b.z0 - 0.5 && z <= b.z1 + 0.5);
      if (b) { x = b.lever.x; z = b.lever.z; y = 0; }
    }
    if (!room.gates[1].solved && z < slide.zIn && z > slide.zOut) {
      x = 0; z = slide.seg.z1 - 1.4; y = 0;
    }
    room.checkpoint = { x, y, z, yaw: actor.camYaw };
  };
  room.resume = actor => {
    const p = room.checkpoint || { x: 0, y: 0, z: ENTRY_Z, yaw: 0 };
    actor.setAt(p.x, p.z, -1, p.y); actor.camYaw = p.yaw;
  };
  room.finishWater = () => {
    room.hasProgress = true;
    for (const g of room.gates) { g.solved = true; g.gate.complete?.(); room.dungeon.openDoor(g.room); }
    steam.valves.forEach(v => { v.filled = true; }); steam._paint();
    god.got = 3; room.court.setBridgeProgress(1);
    room.prize.taken = true; room.prize.group.visible = false;
    room.court.update(0, steam.valves, true);
  };
  room.exportState = actor => {
    if (!room.hasProgress) return null;
    room.captureCheckpoint(actor);
    return {
      version: 1, tier: room.runTier, solved: room.gates.map(g => g.solved),
      freeze: freeze.bands.map(b => ({ base: b.base, phase: b.phase, t: b.t })),
      holes: slide.holes.map(({ x, z, r }) => ({ x, z, r })),
      steam: { ti: steam.ti, wants: steam.valves.map(v => v.want), filled: steam.valves.map(v => v.filled), bridge: room.court.bridgeProgress },
      final: { si: god.si, got: god.got, want: god.want, flash: Math.max(0, god.flash) },
      prize: { taken: room.prize.taken, drop: room.prize.drop, t: room.prize.t },
      hints: Object.fromEntries(Object.entries(room.hints).map(([id, h]) => [id, { level: h.level, t: h.t }])),
      checkpoint: room.checkpoint || { x: 0, y: 0, z: ENTRY_Z, yaw: 0 },
    };
  };
  room.importState = s => {
    if (!s || s.version !== 1 || !integer(s.tier, 0, 5) || !array(s.solved, 3, bool)) return false;
    if (!array(s.freeze, 3, b => b && number(b.base, 3, 5.7) && ['water', 'freezing', 'ice'].includes(b.phase)
      && number(b.t, 0, b.phase === 'freezing' ? 1.2 : b.base))) return false;
    if (!array(s.holes, 4, h => h && number(Math.abs(h.x), 1.5, 2.9) && number(h.z, slide.seg.z0 - 1, slide.zIn)
      && number(h.r, 1.3, 1.75))) return false;
    const v = s.steam, f = s.final, prize = s.prize, p = s.checkpoint;
    if (!v || !integer(v.ti, 0, 2) || !array(v.wants, 3, w => states.includes(w)) || new Set(v.wants).size !== 3
      || !array(v.filled, 3, bool) || !number(v.bridge, 0, 1) || (v.bridge > 0 && !v.filled.some(Boolean))) return false;
    if (!f || !integer(f.si, 0, 2) || !integer(f.want, 0, 2) || !integer(f.got, 0, 3) || !number(f.flash, 0, 0.8)) return false;
    if (!prize || !bool(prize.taken) || !number(prize.drop, -1, 1) || !number(prize.t, 0, 1e9)
      || ((prize.taken || prize.drop >= 0) && f.got !== 3)) return false;
    if ((s.solved[1] && !s.solved[0]) || (s.solved[2] && (!s.solved[1] || !v.filled.every(Boolean)))
      || (f.got > 0 && !s.solved[2])) return false;
    if (!s.hints || !Object.entries(room.hints).every(([id, h]) => s.hints[id]
      && integer(s.hints[id].level, 0, h.texts.length) && number(s.hints[id].t, 0, 1e9))) return false;
    if (!p || !number(p.x, -12.5, 12.5) || !number(p.y, 0, 3) || !number(p.yaw, -1e9, 1e9)
      || !number(p.z, room.shrineSeg.z0 + 0.5, 17.5)) return false;
    const seg = room.spec.rooms.find(r => p.z >= r.to && p.z <= r.from);
    if (!seg || Math.abs(p.x) > seg.w / 2 - 0.49) return false;
    if (!s.solved[0] && freeze.bands.some(b => p.z > b.z0 && p.z < b.z1)) return false;
    // 아직 닫힌 문을 넘어선 저장 위치는 받아들이지 않는다.
    for (let i = 0; i < 3; i++) if (!s.solved[i] && p.z < room.gates[i].gate.seg.z0 + 0.5) return false;
    const cseg = steam.seg, back = cseg.z1 - p.z, ax = Math.abs(p.x);
    let floor = 0;
    if (seg.id === 'r3') {
      if (ax >= C.wingInner && ax <= C.wingOuter && back >= C.rampFront && back <= C.terraceBack)
        floor = C.height * Math.min(1, (back - C.rampFront) / (C.rampBack - C.rampFront));
      else if (ax < C.wingInner && back >= C.bridgeFront && back <= C.bridgeBack && p.y > C.height - 0.35 && v.bridge === 1) floor = C.height;
    }
    if (Math.abs(p.y - floor) > 0.05) return false;
    // 여기까지는 읽기만 했다. 손상된 마지막 필드도 앞선 장치를 바꾸지 못한다.
    room.restart(); room.applyTier(s.tier);
    s.freeze.forEach((b, i) => {
      const live = freeze.bands[i]; Object.assign(live, b); live.solid = b.base * (1 - s.tier * 0.055);
      live.rect.open = b.phase === 'ice'; live.mat.opacity = b.phase === 'ice' ? 0.9 : b.phase === 'freezing' ? b.t / 1.2 * 0.9 : 0;
    });
    s.holes.forEach((h, i) => {
      const live = slide.holes[i]; Object.assign(live, h);
      live.mesh.position.set(h.x, 0.11, h.z); live.rim.position.set(h.x, 0.13, h.z);
      live.mesh.scale.setScalar(h.r / live.initialR); live.rim.scale.setScalar(h.r / live.initialR);
    });
    steam.ti = v.ti; steam.valves.forEach((live, i) => { live.want = v.wants[i]; live.filled = v.filled[i]; }); steam._paint();
    room.gates.forEach((g, i) => { g.solved = s.solved[i]; if (g.solved) { g.gate.complete?.(); room.dungeon.openDoor(g.room); } });
    god._setTemp(f.si); god.got = f.got; god.want = f.want; god.flash = f.flash;
    god.signMat.color.set(TEMPS[f.want].color); god.pips.forEach((m, i) => { if (i < f.got) m.material.color.set(SHRINE.gold); });
    Object.assign(room.prize, prize); room.prize.group.visible = prize.drop >= 0 && !prize.taken; room.prize.update(0);
    Object.entries(room.hints).forEach(([id, live]) => { const h = s.hints[id];
      live.level = h.level; live.t = h.t; live.board.set(h.level ? `힌트 ${h.level}` : '힌트',
        h.level ? live.texts[h.level - 1] : '아직 잠겨 있다', !h.level); });
    room.court.setBridgeProgress(v.bridge); room.court.update(0, steam.valves, prize.taken);
    room.checkpoint = { ...p }; room.hasProgress = true; return true;
  };
}
