// 광원에서 기둥의 밑면·윗면 꼭짓점을 지면에 투영한 볼록 다각형.
// 같은 다각형을 실제 바닥 메시와 안전 판정에 사용한다. GPU 그림자 맵과 무관하다.
const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
export function hull(points) {
  points.sort((a, b) => a.x - b.x || a.z - b.z);
  const half = list => {
    const out = [];
    for (const p of list) { while (out.length > 1 && cross(out.at(-2), out.at(-1), p) <= 1e-9) out.pop(); out.push(p); }
    out.pop(); return out;
  };
  return [...half(points), ...half([...points].reverse())];
}
export function clip(points, axis, edge, sign) {
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = (a[axis] - edge) * sign, db = (b[axis] - edge) * sign;
    if (da >= 0) result.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db); result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  } return result;
}
export function projectShade(pillar, lamp, bounds) {
  const points = [], factor = lamp.y / (lamp.y - pillar.height);
  for (let i = 0; i < pillar.sides; i++) {
    // THREE.CylinderGeometry의 첫 꼭짓점은 +Z이며, 양쪽 원의 반경이 같다.
    const a = i * Math.PI * 2 / pillar.sides;
    const p = { x: pillar.x + Math.sin(a) * pillar.r, z: pillar.z + Math.cos(a) * pillar.r };
    points.push(p, { x: lamp.x + (p.x - lamp.x) * factor, z: lamp.z + (p.z - lamp.z) * factor });
  }
  let polygon = hull(points);
  for (const [axis, edge, sign] of [['x', bounds.x0, 1], ['x', bounds.x1, -1], ['z', bounds.z0, 1], ['z', bounds.z1, -1]]) polygon = clip(polygon, axis, edge, sign);
  return polygon;
}
export function insideShade(x, z, polygon) {
  if (polygon.length < 3) return false;
  const p = { x, z };
  return polygon.every((a, i) => cross(a, polygon[(i + 1) % polygon.length], p) >= -1e-6);
}

export function shadeProgress(g, legacy) {
  const validFields = s => s?.fields && Number.isFinite(s.fields.a) && s.fields.a >= 0 && s.fields.a <= 1e9
    && Number.isFinite(s.fields.expose) && s.fields.expose >= 0 && s.fields.expose <= 2;
  return {
    capture: () => ({ version: 2, fields: { a: g.a, expose: g.expose } }),
    valid: s => !!(validFields(s) && (s.version === 2 || (s.version === undefined && legacy.valid(s)))),
    restore(s) { g.a = s.fields.a; g.expose = s.fields.expose; g.court.updateVisual(g._lampPos()); g.eyeMat.opacity = Math.min(1, g.expose / g.exposeMax) * 0.95; },
  };
}
