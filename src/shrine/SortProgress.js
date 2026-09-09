// 소유권과 관찰 시간을 저장하고 옛 노드를 새 방으로 되돌리지 않는다.
export function sortProgress(g, legacy, crits) {
  const ix = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
  function valid(f) {
    if (!f || Object.keys(f).length !== 14 || !Array.isArray(f.crits) || f.crits.length !== 3
      || new Set(f.crits).size !== 3 || !f.crits.every(n => ix(n, 0, 2)) || f.crits[2] !== 2
      || !ix(f.held, -1, 5) || !ix(f.testItem, -1, 5) || !Number.isFinite(f.testT) || f.testT < 0 || f.testT > 1
      || !ix(f.round, 0, 3) || typeof f.solved !== 'boolean' || f.solved !== (f.round === 3)) return false;
    const lists = [f['got.0'], f['got.1']];
    if (!lists.every(a => Array.isArray(a) && a.length <= 6 && a.every(n => ix(n, 0, 5)))) return false;
    const owners = [f.held, f.testItem, ...lists.flat()].filter(n => n >= 0);
    return new Set(owners).size === owners.length && g.items.every((_, i) =>
      f[`bin.${i}`] === (lists[0].includes(i) ? 0 : lists[1].includes(i) ? 1 : -1));
  }
  return {
    capture() {
      const fields = { crits: g.crits.map(c => crits.findIndex(p => p.yes === c.yes)), held: g.items.indexOf(g.held),
        testItem: g.items.indexOf(g.testItem), testT: g.testT, round: g.round, solved: g.solved };
      g.items.forEach((it, i) => { fields[`bin.${i}`] = g.bins.indexOf(it.bin); });
      g.bins.forEach((b, i) => { fields[`got.${i}`] = b.got.map(it => g.items.indexOf(it)); });
      return { version: 2, fields };
    },
    valid: s => !!(s && valid(s.fields) && (s.version === 2 || (s.version === undefined && legacy.valid(s)))),
    restore({ fields: f }) {
      g.crits = f.crits.map(i => crits[i]); g.held = g.items[f.held] || null; g.testItem = g.items[f.testItem] || null;
      g.testT = f.testT; g.round = f.round; g.solved = f.solved;
      g.items.forEach((it, i) => { it.bin = g.bins[f[`bin.${i}`]] || null; it.jig = 0; it.mesh.rotation.set(0, 0, 0); });
      g.bins.forEach((b, i) => { b.got = f[`got.${i}`].map(n => g.items[n]); });
      g._paint(); g.workshop.sync(true);
    },
  };
}

