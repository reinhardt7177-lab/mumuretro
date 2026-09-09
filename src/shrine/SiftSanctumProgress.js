export function siftSanctumProgress(g, legacy) {
  const index = n => Number.isInteger(n) && n >= -1 && n < 4;
  function valid(f) {
    if (!f || Object.keys(f).length !== 11 || !index(f.held) || typeof f.solved !== 'boolean'
      || !Number.isFinite(f.eyes) || f.eyes < 0 || f.eyes > 1) return false;
    for (let i = 0; i < 4; i++) {
      const m = g.mixes[i], done = f[`done.${i}`];
      if (!Array.isArray(done) || done.length > m.need.length || new Set(done).size !== done.length
        || !done.every((id, k) => m.need.includes(id) && (!m.order || id === m.need[k]))) return false;
    }
    if (f.solved !== g.mixes.every((m, i) => f[`done.${i}`].length === m.need.length)) return false;
    return g.tools.every((t, i) => {
      const used = f[`used.${i}`];
      const expected = g.mixes.findIndex((m, j) => f[`done.${j}`].length < m.need.length && f[`done.${j}`].includes(t.id));
      return index(used) && used === expected && (f.held !== i || used === -1);
    });
  }
  return {
    capture() { const fields = { held: g.tools.indexOf(g.held), solved: g.solved };
      g.tools.forEach((t, i) => { fields[`used.${i}`] = g.mixes.indexOf(t.used); });
      g.mixes.forEach((m, i) => { fields[`done.${i}`] = [...m.done]; }); fields.eyes = g.eyes.awake;
      return { version: 2, fields }; },
    valid: s => !!(s && valid(s.fields) && (s.version === 2 || (s.version === undefined && legacy.valid(s)))),
    restore({ fields: f }) {
      g.held = g.tools[f.held] || null; g.solved = f.solved; g.msg = null; g.msgT = 0;
      g.tools.forEach((t, i) => { t.used = g.mixes[f[`used.${i}`]] || null; t.mesh.rotation.set(0, 0, 0); });
      g.mixes.forEach((m, i) => { m.done = [...f[`done.${i}`]]; }); g.eyes.restore(f.eyes); g._check();
    },
  };
}
