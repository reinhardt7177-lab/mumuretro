// 2차원 수평 광학. 렌더와 저장 검증이 같은 계산을 쓰되, 검사 중 장치를 변경하지 않는다.
const EPS = 1e-6;
export function traceMirrors(g, angles = g.mirrors.map(m => m.a)) {
  const { bounds, direction, receiverRadius } = g.galleryOptics;
  let { x, z } = g.src, dx = direction.x, dz = direction.z, skip = -1;
  const segments = [];
  for (let bounce = 0; bounce < 8; bounce++) {
    const wall = Math.min(
      Math.abs(dx) < EPS ? Infinity : ((dx > 0 ? bounds.x1 : bounds.x0) - x) / dx,
      Math.abs(dz) < EPS ? Infinity : ((dz > 0 ? bounds.z1 : bounds.z0) - z) / dz);
    let distance = Math.max(0, wall), mirror = null;
    g.mirrors.forEach((m, i) => {
      if (i === skip) return;
      const a = angles[i] + g.angleOffset, tx = Math.cos(a), tz = Math.sin(a), nx = -tz, nz = tx;
      const dot = dx * nx + dz * nz;
      if (Math.abs(dot) < EPS) return;
      const t = ((m.x - x) * nx + (m.z - z) * nz) / dot;
      if (t <= 0.0001 || t >= distance) return;
      const hx = x + dx * t, hz = z + dz * t;
      if (Math.abs((hx - m.x) * tx + (hz - m.z) * tz) > m.half + EPS) return;
      distance = t; mirror = { index: i, nx, nz, dot };
    });
    const vx = g.target.x - x, vz = g.target.z - z, proj = vx * dx + vz * dz;
    const hit = proj > EPS && proj < distance && Math.abs(vx * dz - vz * dx) < receiverRadius;
    if (hit) distance = proj;
    const end = { x: x + dx * distance, z: z + dz * distance };
    const segment = { x0: x, z0: z, x1: end.x, z1: end.z, end: hit ? 'receiver' : mirror ? 'mirror' : 'wall' };
    segments.push(segment);
    if (hit) return { hit: true, segments };
    if (!mirror) break;
    segment.mirror = mirror.index; segment.normal = { x: mirror.nx, z: mirror.nz };
    dx -= 2 * mirror.dot * mirror.nx; dz -= 2 * mirror.dot * mirror.nz;
    x = end.x; z = end.z; skip = mirror.index;
  }
  return { hit: false, segments };
}

export function mirrorProgress(g, legacy) {
  const angles = s => g.mirrors.map((_, i) => s.fields[`a.${i}`]);
  const validFields = s => s?.fields && typeof s.fields.hit === 'boolean' && angles(s).every(a =>
    Number.isFinite(a) && a >= 0 && a < Math.PI * 2 && Math.abs(a / (Math.PI / 4) - Math.round(a / (Math.PI / 4))) < 1e-6);
  return {
    capture: () => ({ version: 2, fields: { ...Object.fromEntries(g.mirrors.map((m, i) => [`a.${i}`, m.a])), hit: g.hit } }),
    valid: s => !!(validFields(s) && (s.version === 2 || (s.version === undefined && legacy.valid(s)))
      && traceMirrors(g, angles(s)).hit === s.fields.hit),
    restore(s) {
      g.mirrors.forEach((m, i) => { m.a = angles(s)[i]; m.grp.rotation.y = -(m.a + g.angleOffset); });
      g._trace();
    },
  };
}
