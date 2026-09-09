// 좌표·문제 순서만 저장한다. 장식 노드 번호를 새 메시로 옮기지 않는다.
export function silhouetteProgress(g, legacy) {
  const finite = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
  const validFields = (f, modern) => !!f && typeof f.held === 'boolean' && typeof f.solved === 'boolean'
    && Number.isInteger(f.round) && f.round >= 0 && f.round <= 3 && f.solved === (f.round === 3)
    && (!modern || !f.solved || !f.held)
    && Array.isArray(f.answers) && f.answers.length === 3 && new Set(f.answers).size === 3
    && f.answers.every(z => finite(z, g.wallZ + 1.2, g.lampZ - 1.2))
    && finite(f.objZ, g.wallZ + 1.2, g.lampZ - 1.2) && finite(f.holeW, 0.01, 100)
    && Math.abs(f.holeW - g._holeAt(f.answers[Math.min(f.round, 2)])) < 1e-7
    && (!modern || finite(f.dragOffset, -g.REACH, g.REACH));
  return {
    capture: () => ({ version: 2, fields: { held: g.held, solved: g.solved, round: g.round, answers: [...g.answers],
      objZ: g.objZ, holeW: g.holeW, dragOffset: g.dragOffset } }),
    valid: s => !!(s && validFields(s.fields, s.version === 2)
      && (s.version === 2 || (s.version === undefined && legacy.valid(s)))),
    restore(s) {
      const f = s.fields; Object.assign(g, { held: f.held && !f.solved, solved: f.solved, round: f.round,
        answers: [...f.answers], objZ: f.objZ, holeW: f.holeW, dragOffset: f.dragOffset ?? 0 });
      g.theatre.completed = g.solved; g.theatre.resize();
    },
  };
}
