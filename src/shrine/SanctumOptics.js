import { hull, clip, insideShade } from './ShadeProjection.js';

// 광원보다 낮은 볼록 부품의 실제 꼭짓점을 바닥에 투영한다.
// 여러 부품의 합집합이므로 몸·팔·머리의 빈 공간을 임의로 채우지 않는다.
export function projectStatue(parts, lamp, bounds) {
  return parts.map(vertices => {
    let polygon = hull(vertices.map(v => {
      const factor = lamp.y / (lamp.y - v.y);
      return { x: lamp.x + (v.x - lamp.x) * factor, z: lamp.z + (v.z - lamp.z) * factor };
    }));
    for (const [axis, edge, sign] of [['x', bounds.x0, 1], ['x', bounds.x1, -1], ['z', bounds.z0, 1], ['z', bounds.z1, -1]]) polygon = clip(polygon, axis, edge, sign);
    return polygon;
  }).filter(p => p.length >= 3);
}
export const shadowContains = (polygons, x, z) => polygons.some(p => insideShade(x, z, p));
const cross = (x, z, X, Z) => x * Z - z * X;

// 겹친 부품의 안쪽 선을 버려, 바닥 표적에는 석상 그림자의 바깥 윤곽만 남긴다.
export function shadowBoundary(polygons) {
  const edges = polygons.flatMap(p => p.map((a, i) => [a, p[(i + 1) % p.length]])), out = [], seen = new Set();
  for (const [a, b] of edges) {
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz); if (length < 1e-8) continue;
    const cuts = [0, 1];
    for (const [c, d] of edges) {
      const ex = d.x - c.x, ez = d.z - c.z, den = cross(dx, dz, ex, ez), cx = c.x - a.x, cz = c.z - a.z;
      if (Math.abs(den) > 1e-9) {
        const t = cross(cx, cz, ex, ez) / den, u = cross(cx, cz, dx, dz) / den;
        if (t > 1e-8 && t < 1 - 1e-8 && u >= -1e-8 && u <= 1 + 1e-8) cuts.push(t);
      } else if (Math.abs(cross(cx, cz, dx, dz)) < 1e-8) {
        for (const p of [c, d]) { const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / (length * length); if (t > 0 && t < 1) cuts.push(t); }
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const t0 = cuts[i - 1], t1 = cuts[i]; if (t1 - t0 < 1e-7) continue;
      const mid = (t0 + t1) / 2;
      // 반시계 방향 다각형의 오른쪽이 바깥이다. 그곳까지 다른 부품이 덮으면 내부 선이다.
      if (shadowContains(polygons, a.x + dx * mid + dz / length * 1e-4, a.z + dz * mid - dx / length * 1e-4)) continue;
      const p = { x: a.x + dx * t0, z: a.z + dz * t0 }, q = { x: a.x + dx * t1, z: a.z + dz * t1 };
      const key = [p, q].map(v => `${v.x.toFixed(5)},${v.z.toFixed(5)}`).sort().join('/');
      if (!seen.has(key)) { seen.add(key); out.push([p, q]); }
    }
  } return out;
}

export function sanctumProgress(g, legacy) {
  const validFields = f => f && Number.isInteger(f.ai) && f.ai >= 0 && f.ai < 8
    && Number.isInteger(f.hi) && f.hi >= 0 && f.hi < 3 && typeof f.solved === 'boolean'
    && f.solved === (f.ai === g.answer.a && f.hi === g.answer.h)
    && Number.isFinite(f.eyes) && f.eyes >= 0 && f.eyes <= 1;
  return {
    capture: () => ({ version: 2, fields: { ai: g.ai, hi: g.hi, solved: g.solved, eyes: g.eyes.awake } }),
    valid: s => !!(s && validFields(s.fields) && (s.version === 2 || (s.version === undefined && legacy.valid(s)))),
    restore(s) { g.ai = s.fields.ai; g.hi = s.fields.hi; g.sanctum.legacyCompleted = false; g._apply(); g.eyes.restore(s.fields.eyes); g.sanctum.update(); },
  };
}
