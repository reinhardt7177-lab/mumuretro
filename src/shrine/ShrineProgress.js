import { ENTRY_Z } from './layouts.js';
import { deviceProgress } from './DeviceProgress.js';

const number = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
const integer = (v, lo, hi) => Number.isInteger(v) && number(v, lo, hi);
const bool = v => typeof v === 'boolean';
const array = (v, n, test) => Array.isArray(v) && v.length === n && v.every(test);
const hazardKinds = new Set(['shade', 'quake', 'hexlava', 'geyser', 'shaft']);

// 물 사당 v1 기록은 그대로 유지하고, 나머지 다섯 사당은 배치 씨앗과 장치 계약을 묶는다.
export function attachShrineProgress(room) {
  const kinds = room.spec.rooms.filter(r => r.gate).map(r => r.gate);
  const codecs = room.gates.map((g, i) => deviceProgress(g.gate, kinds[i], room.scene));
  const finalCodec = deviceProgress(room.final, room.spec.final, room.scene);
  room.hasProgress = false; room.checkpoint = null; room.legacyCompleted = false;
  const start = () => ({ x: 0, y: 0, z: ENTRY_Z, yaw: 0, resetHazard: -1 });
  room.captureCheckpoint = actor => {
    if (!actor) return;
    const p = actor.position;
    const cp = { x: p.x, y: 0, z: p.z, yaw: actor.camYaw, resetHazard: -1 };
    room.gates.forEach((entry, i) => {
      const g = entry.gate, seg = g.seg;
      if (entry.solved || !hazardKinds.has(kinds[i]) || p.z >= seg.z1 - 1 || p.z <= seg.z0 + 1) return;
      if (kinds[i] === 'hexlava' && g.cur?.state === 'ok' && g._at(p) === g.cur) {
        cp.x = g.cur.x; cp.z = g.cur.z;
      } else {
        cp.x = (seg.x0 + seg.x1) / 2; cp.z = seg.z1 - 1;
        if (kinds[i] === 'hexlava') cp.resetHazard = i;
      }
    });
    room.checkpoint = cp;
  };
  room.resume = actor => {
    const cp = room.checkpoint || start();
    if (cp.resetHazard >= 0) room.gates[cp.resetHazard].gate.restart();
    actor.setAt(cp.x, cp.z, -1, 0); actor.camYaw = cp.yaw;
    // 들고 있던 물건은 안전 지점으로 옮겨진 주인공을 따라온다.
    room.gates.forEach((entry, i) => {
      // 그림자 물체는 update가 정답도 판정한다. 복원 자체가 다음 문제를 풀면 안 된다.
      if (!hazardKinds.has(kinds[i]) && kinds[i] !== 'silhouette') entry.gate.update?.(0, actor, room.scene);
    });
    room.final.update?.(0, actor, room.scene);
  };
  room.finishLegacy = () => {
    room.legacyCompleted = true; room.hasProgress = true;
    room.gates.forEach(g => { g.solved = true; g.gate.restoreSolved?.(true); room.dungeon.openDoor(g.room); });
    room.final.restoreCompleted?.();
    room.prize.taken = true; room.prize.group.visible = false;
  };
  room.exportState = actor => {
    if (!room.hasProgress) return null;
    room.captureCheckpoint(actor);
    return { version: 1, id: room.spec.id, seed: room.seed, tier: room.runTier, legacyCompleted: room.legacyCompleted,
      solved: room.gates.map(g => g.solved), devices: codecs.map(c => c.capture()), final: finalCodec.capture(),
      prize: { taken: room.prize.taken, drop: room.prize.drop, t: room.prize.t },
      hints: Object.fromEntries(Object.entries(room.hints).map(([id, h]) => [id, { level: h.level, t: h.t }])),
      checkpoint: { ...(room.checkpoint || start()) } };
  };
  room.importState = s => {
    // 전부 검사한 뒤 적용한다. 뒤쪽 필드가 손상되어도 앞쪽 장치를 덮어쓰지 않는다.
    if (!s || s.version !== 1 || s.id !== room.spec.id || s.seed !== room.seed || !integer(s.seed, 0, 0xffffffff)
      || !integer(s.tier, 0, 5) || !bool(s.legacyCompleted) || !array(s.solved, codecs.length, bool)
      || !array(s.devices, codecs.length, (v, i) => codecs[i].valid(v)) || !finalCodec.valid(s.final)) return false;
    const prize = s.prize, cp = s.checkpoint;
    const f = s.final.fields, finalSolved = room.spec.final === 'scale' ? f.balanced
      : room.spec.final === 'grand' ? f.lit === 5 && f.awake === 1 : f.solved;
    if (!prize || !bool(prize.taken) || !number(prize.drop, -1, 1) || !number(prize.t, 0, 1e9)
      || ((prize.taken || prize.drop >= 0) && !s.solved.every(Boolean))
      || (s.legacyCompleted && !prize.taken) || (!s.legacyCompleted && (prize.taken || prize.drop >= 0) && !finalSolved)) return false;
    if (s.solved.some((v, i) => v && s.solved.slice(0, i).some(x => !x))) return false;
    if (!s.hints || !Object.entries(room.hints).every(([id, h]) => s.hints[id]
      && integer(s.hints[id].level, 0, h.texts.length) && number(s.hints[id].t, 0, 1e9))) return false;
    if (!cp || cp.y !== 0 || !number(cp.x, -100, 100) || !number(cp.z, room.shrineSeg.z0 + 0.5, 17.5)
      || !number(cp.yaw, -1e9, 1e9) || !integer(cp.resetHazard, -1, codecs.length - 1)) return false;
    const seg = room.spec.rooms.find(r => cp.z >= r.to && cp.z <= r.from);
    if (!seg || Math.abs(cp.x) > seg.w / 2 - 0.49) return false;
    for (let i = 0; i < codecs.length; i++) if (!s.solved[i] && cp.z < room.gates[i].gate.seg.z0 + 0.5) return false;
    if (cp.resetHazard >= 0 && (kinds[cp.resetHazard] !== 'hexlava' || s.solved[cp.resetHazard]
      || cp.z !== room.gates[cp.resetHazard].gate.seg.z1 - 1)) return false;
    room.applyTier(s.tier); room.dungeon.resetDoors();
    codecs.forEach((c, i) => { c.restore(s.devices[i]); room.gates[i].solved = s.solved[i];
      room.gates[i].gate.restoreSolved?.(s.solved[i]);
      if (s.solved[i]) room.dungeon.openDoor(room.gates[i].room); });
    finalCodec.restore(s.final);
    if (s.legacyCompleted) room.final.restoreCompleted?.();
    Object.assign(room.prize, prize); room.prize.group.visible = prize.drop >= 0 && !prize.taken; room.prize.update(0);
    Object.entries(room.hints).forEach(([id, h]) => { Object.assign(h, s.hints[id]);
      h.board.set(h.level ? `힌트 ${h.level}` : '힌트', h.level ? h.texts[h.level - 1] : '아직 잠겨 있다', !h.level); });
    // 옛 거울방 안의 좌표에는 새 받침대가 있을 수 있다. 각도·힌트·문은 보존하고 입구에서 재개한다.
    const mirrorIndex = kinds.indexOf('mirror');
    const migratedMirror = mirrorIndex >= 0 && s.devices[mirrorIndex].version !== 2 && seg.id === room.gates[mirrorIndex].room;
    room.checkpoint = migratedMirror ? { ...cp, x: 0, z: room.gates[mirrorIndex].gate.seg.z1 - 1, resetHazard: -1 } : { ...cp };
    const silhouetteIndex = kinds.indexOf('silhouette');
    if (silhouetteIndex >= 0 && s.devices[silhouetteIndex].version !== 2 && seg.id === room.gates[silhouetteIndex].room) {
      const g = room.gates[silhouetteIndex].gate;
      // 옛 중앙 장치가 왼쪽으로 옮겨졌다. 잡은 손은 새 손잡이 옆에서 같은 거리로 재개한다.
      room.checkpoint = { ...cp, x: g.held ? g.theatre.handle().x : 0,
        z: g.held ? g.objZ : cp.z, resetHazard: -1 };
    }
    // 새 석상이 서는 중앙은 옛 보행 좌표와 겹칠 수 있다. 조작·각성·보상은 보존한다.
    if (room.sanctum && s.final.version !== 2 && seg.id === 'shrine') {
      room.checkpoint = { ...cp, x: 0, z: room.shrineSeg.z1 - 1, resetHazard: -1 };
    }
    room.legacyCompleted = s.legacyCompleted; room.hasProgress = true;
    if (room.siftSanctum && s.final.version !== 2 && seg.id === 'shrine') {
      room.checkpoint = { ...cp, x: 0, z: room.shrineSeg.z1 - 1, resetHazard: -1 };
    }
    if (room.evaporationCourt && s.devices[2].version !== 2 && seg.id === 'r3') {
      room.checkpoint = { ...cp, x: 0, z: room.gates[2].gate.seg.z1 - 1, resetHazard: -1 };
    }
    if (room.sortCourt && s.devices[1].version !== 2 && seg.id === 'r2') {
      room.checkpoint = { ...cp, x: 0, z: room.gates[1].gate.seg.z1 - 1, resetHazard: -1 };
    }
    if (room.sieveCourt && s.devices[0].version !== 2 && seg.id === 'r1') {
      room.checkpoint = { ...cp, x: 0, z: room.gates[0].gate.seg.z1 - 1, resetHazard: -1 };
    }
    return true;
  };
}

