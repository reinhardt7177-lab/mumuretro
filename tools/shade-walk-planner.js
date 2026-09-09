// Browser test helper only. Time-expanded grid search, with no changes to game state or hidden waypoints in the product.
export async function planShade(g, speed = 3.6) {
  const { projectShade, insideShade } = await import('/src/shrine/ShadeProjection.js');
  const spacing = 0.3, frames = Math.round(spacing / speed * 60), step = speed * frames / 60;
  const cols = 43, rows = 46, count = cols * rows, start = Math.floor(cols / 2), horizon = 420;
  const xs = Array.from({ length: cols }, (_, i) => (i - Math.floor(cols / 2)) * step);
  const zs = Array.from({ length: rows }, (_, i) => g.seg.z1 - 1 - i * step);
  const legal = (x, z) => x >= g.seg.x0 + 0.55 && x <= g.seg.x1 - 0.55
    && z >= g.seg.z0 + 0.55 && g.pillars.every(p => Math.hypot(x - p.x, z - p.z) >= 1.15);
  const edges = Array.from({ length: count }, () => []);
  for (let i = 0; i < count; i++) {
    const col = i % cols, row = Math.floor(i / cols); if (!legal(xs[col], zs[row])) continue;
    for (const [dc, dr] of [[0, 1], [-1, 0], [1, 0], [0, 0], [0, -1]]) {
      const c = col + dc, r = row + dr; if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      if (!legal(xs[c], zs[r]) || !legal((xs[c] + xs[col]) / 2, (zs[r] + zs[row]) / 2)) continue;
      edges[i].push(r * cols + c);
    }
  }
  let previous = new Float32Array(count).fill(Infinity); previous[start] = 0;
  const parents = [], safetyMargin = 0.12;
  for (let tick = 1; tick <= horizon; tick++) {
    const lamps = Array.from({ length: frames }, (_, f) => g.court.lampAt(g.a + ((tick - 1) * frames + f + 1) / 60 * g.speed));
    const shadows = lamps.map(lamp => g.pillars.map(p => projectShade(p, lamp, g.court.bounds)));
    const next = new Float32Array(count).fill(Infinity), parent = new Int32Array(count).fill(-1); parents.push(parent);
    for (let i = 0; i < count; i++) {
      if (!Number.isFinite(previous[i])) continue;
      const x = xs[i % cols], z = zs[Math.floor(i / cols)];
      for (const j of edges[i]) {
        const nx = xs[j % cols], nz = zs[Math.floor(j / cols)]; let exposure = previous[i], valid = true;
        for (let f = 0; f < frames; f++) {
          const t = (f + 1) / frames, px = x + (nx - x) * t, pz = z + (nz - z) * t;
          const safe = pz >= g.safeIn || pz <= g.safeOut || shadows[f].some(p => insideShade(px, pz, p));
          exposure = safe ? Math.max(0, exposure - 2.2 / 60) : exposure + 1 / 60;
          if (exposure >= g.exposeMax - safetyMargin) { valid = false; break; }
        }
        if (valid && exposure < next[j]) { next[j] = exposure; parent[j] = i; }
      }
    }
    const goal = next.findIndex((value, i) => Number.isFinite(value) && zs[Math.floor(i / cols)] < g.safeOut - 0.2);
    if (goal >= 0) {
      const path = []; let cursor = goal;
      for (let t = tick - 1; t >= 0; t--) { path.push(cursor); cursor = parents[t][cursor]; }
      path.reverse(); return { frames, speed, path: path.map(i => ({ x: xs[i % cols], z: zs[Math.floor(i / cols)] })), seconds: tick * frames / 60 };
    }
    previous = next;
  }
  throw Error(`No walking route at angle ${g.a}, speed ${g.speed}, exposure ${g.exposeMax}`);
}
