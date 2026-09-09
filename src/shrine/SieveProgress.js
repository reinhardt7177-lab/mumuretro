// 그림의 노드 번호 대신 주문·소유·혼합물 상태를 저장한다.
export function sieveProgress(g, legacy, orders) {
  const index = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
  const validFields = f => f && Object.keys(f).length === 6
    && Array.isArray(f.orders) && f.orders.length === 3 && new Set(f.orders).size === 3 && f.orders.every(n => index(n, 0, 2))
    && index(f.held, -1, 2) && index(f.fitted, -1, 2) && (f.held < 0 || f.held !== f.fitted)
    && index(f.round, 0, 3) && typeof f.solved === 'boolean' && f.solved === (f.round === 3)
    && Array.isArray(f.mix) && f.mix.length > 0 && f.mix.length <= 3 && new Set(f.mix).size === f.mix.length && f.mix.every(n => index(n, 0, 2));
  return {
    capture: () => ({ version: 2, fields: { orders: g.orders.map(o => orders.findIndex(p => p.keep.join(',') === o.keep.join(','))),
      held: g.held ? g.sieves.indexOf(g.held) : -1, fitted: g.fitted, round: g.round, solved: g.solved, mix: [...g.mix] } }),
    valid: s => !!(s && validFields(s.fields) && (s.version === 2 || (s.version === undefined && legacy.valid(s)))),
    restore(s) { g.workshop.motion?.cancel(); const f = s.fields; g.orders = f.orders.map(i => orders[i]); g.held = g.sieves[f.held] || null;
      g.fitted = f.fitted; g.round = f.round; g.solved = f.solved; g.mix = new Set(f.mix);
      // 복원은 판정을 진행하지 않는다. 표시만 다시 만든다.
      g.workshop.sync(); },
  };
}
