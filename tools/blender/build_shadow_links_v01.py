"""Shadow shrine v01 link pieces for the Unity port (그림자 사당).

Builds four closed-solid JSON meshes through shadow_temple_common:
  shadow-entry-v01          courtyard, low side walls, inner moon gate (day portal), two stone lanterns
  shadow-bridges-v01        three bridge slabs with glowing rails, corbels and the eye / moon / sun gates
  shadow-gate-exterior-v01  planet-side moon gate (LOCAL, front = -Z) with night portal and obelisk lanterns
  shadow-gate-seal-v01      bronze eclipse seal (LOCAL origin = portal centre, decorated face toward -Z)
then rebuilds the geometry and renders arch-entry.png, arch-bridge.png and exterior-gate.png.

Game metres via c.vec(): x right, y up, z forward; walkable tops at y 0.
Run: blender --background --factory-startup --python tools/blender/build_shadow_links_v01.py [-- export entry bridge gate]
(no phase arguments = all phases).
"""
import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)

import bmesh, math, os, random, sys, time
sys.dont_write_bytecode = True
sys.path.insert(0, r'D:\mumumetro\tools\blender')
import shadow_temple_common as c

M = c.mat
TAU = math.tau
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PHASES = set(ARGS) or {'export', 'entry', 'bridge', 'gate'}
RNG_SEED = 3
BUDGET = {'shadow-entry-v01': 22000, 'shadow-bridges-v01': 28000,
          'shadow-gate-exterior-v01': 18000, 'shadow-gate-seal-v01': 6000}
LAMP = (1.0, .78, .5)
MOON = (.75, .82, 1.0)


# ---------------------------------------------------------------- closed-solid helpers (game coordinates)

def blk(name, lo, hi, m, bevel=0.012, seg=1):
    """Axis-aligned block between game corners lo/hi; 1-segment chamfer or 2-segment round edge."""
    size = [hi[i] - lo[i] for i in range(3)]
    pos = [(hi[i] + lo[i]) / 2 for i in range(3)]
    o = c.box(name, pos, size, M(m), bevel=0)
    if bevel:
        mod = o.modifiers.new('Soft crafted edges', 'BEVEL')
        mod.width = min(bevel, min(size) * .3)
        mod.segments = seg
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def rod(name, a, b, r, m, n=16):
    return c.rod(name, a, b, r, M(m), vertices=n)


def disc_z(name, cx, cy, z0, z1, r, m, n=48):
    """Closed cylinder with its axis along game Z."""
    return c.rod(name, (cx, cy, z0), (cx, cy, z1), r, M(m), vertices=n)


def prism_xy(name, pts, z0, z1, m):
    """Simple polygon (game x,y) extruded along game Z between z0 and z1."""
    n = len(pts)
    verts = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return c.mesh(name, verts, faces, M(m))


def annulus(name, cx, cy, r0, r1, z0, z1, m, seg=48, a0=0.0, a1=None):
    """Rectangular-section ring (or ring sector a0..a1) around a game-Z axis."""
    full = a1 is None
    span = TAU if full else a1 - a0
    rings = seg if full else seg + 1
    verts = []
    for k in range(rings):
        a = a0 + span * k / seg
        ca, sa = math.cos(a), math.sin(a)
        verts += [(cx + ca * r0, cy + sa * r0, z0), (cx + ca * r1, cy + sa * r1, z0),
                  (cx + ca * r0, cy + sa * r0, z1), (cx + ca * r1, cy + sa * r1, z1)]
    faces = []
    for k in range(seg):
        i, j = 4 * k, 4 * ((k + 1) % rings)
        faces += [(i, j, j + 1, i + 1), (i + 2, i + 3, j + 3, j + 2),
                  (i, i + 2, j + 2, j), (i + 1, j + 1, j + 3, i + 3)]
    if not full:
        e = 4 * (rings - 1)
        faces += [(0, 1, 3, 2), (e, e + 2, e + 3, e + 1)]
    return c.mesh(name, verts, faces, M(m))


def plate_hole(name, x0, x1, y0, y1, cx, cy, r, z0, z1, m, seg=64):
    """Rectangular plate (x0..x1, y0..y1) with a round through-hole, thickness z0..z1 (closed)."""
    angs = {round((TAU * i / seg) % TAU, 9) for i in range(seg)}
    for qx, qy in ((x1, y1), (x0, y1), (x0, y0), (x1, y0)):
        angs.add(round(math.atan2(qy - cy, qx - cx) % TAU, 9))
    angs = sorted(angs)
    inner, outer = [], []
    for a in angs:
        dx, dy = math.cos(a), math.sin(a)
        ts = []
        if dx > 1e-9:
            ts.append((x1 - cx) / dx)
        if dx < -1e-9:
            ts.append((x0 - cx) / dx)
        if dy > 1e-9:
            ts.append((y1 - cy) / dy)
        if dy < -1e-9:
            ts.append((y0 - cy) / dy)
        t = min(ts)
        outer.append((cx + dx * t, cy + dy * t))
        inner.append((cx + dx * r, cy + dy * r))
    n = len(angs)
    verts = ([(x, y, z0) for x, y in inner] + [(x, y, z1) for x, y in inner] +
             [(x, y, z0) for x, y in outer] + [(x, y, z1) for x, y in outer])
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces += [(i, j, 2 * n + j, 2 * n + i), (n + i, 3 * n + i, 3 * n + j, n + j),
                  (i, n + i, n + j, j), (2 * n + i, 2 * n + j, 3 * n + j, 3 * n + i)]
    return c.mesh(name, verts, faces, M(m))


def frustum(name, cx, cz, y0, y1, w0, w1, m):
    """Square truncated pyramid standing on game Y (width w0 at y0, w1 at y1)."""
    verts = []
    for y, w in ((y0, w0), (y1, w1)):
        h = w / 2
        verts += [(cx - h, y, cz - h), (cx + h, y, cz - h), (cx + h, y, cz + h), (cx - h, y, cz + h)]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    return c.mesh(name, verts, faces, M(m))


def crescent(name, cx, cy, R, wmax, z0, z1, m, tm=math.radians(125), seg=28, wmin=0.03):
    """Horns-up crescent in the game XY plane (thick at the bottom), extruded along Z."""
    outer, inner = [], []
    for k in range(seg + 1):
        t = -tm + 2 * tm * k / seg
        w = wmin + (wmax - wmin) * math.cos(t / tm * math.pi / 2)
        dx, dy = math.sin(t), -math.cos(t)
        outer.append((cx + dx * R, cy + dy * R))
        inner.append((cx + dx * (R - w), cy + dy * (R - w)))
    return prism_xy(name, outer + inner[::-1], z0, z1, m)


def rays(name, cx, cy, z0, z1, r0, r1, count, half_w, m, phase=math.pi / 2):
    """Triangular sun rays pointing outward from (cx, cy)."""
    for i in range(count):
        a = phase + TAU * i / count
        ca, sa = math.cos(a), math.sin(a)
        px, py = -sa * half_w, ca * half_w
        prism_xy(f'{name} {i:02d}', [(cx + ca * r0 + px, cy + sa * r0 + py), (cx + ca * r1, cy + sa * r1),
                                     (cx + ca * r0 - px, cy + sa * r0 - py)], z0, z1, m)


def torus(name, centre, R, r, m, seg=64, mseg=10):
    """Closed torus whose axis is game Z."""
    bpy.ops.mesh.primitive_torus_add(major_segments=seg, minor_segments=mseg, major_radius=R, minor_radius=r,
                                     location=c.vec(centre), rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object
    o.name = name
    o.data.materials.append(M(m))
    return o


def voussoirs(tag, cx, cy, r0, r1, z0, z1, key_r1, count=17, m='Shadow sandstone light', gap=math.radians(0.55)):
    """Ring of wedge stones, keystone (index 0) at the top with a larger outer radius."""
    step = TAU / count
    for k in range(count):
        a = math.pi / 2 + k * step
        annulus(f'{tag} voussoir {k:02d}', cx, cy, r0, key_r1 if k == 0 else r1, z0, z1, m, seg=4,
                a0=a - step / 2 + gap, a1=a + step / 2 - gap)


def scene_meshes():
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']


_WARNED = []


def tidy():
    """Outward normals everywhere, smooth shading split at edges sharper than 35 degrees."""
    for o in scene_meshes():
        me = o.data
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        try:
            me.shade_smooth()
            me.set_sharp_from_angle(angle=math.radians(35))
        except Exception as exc:  # API missing: fall back to flat faces
            me.polygons.foreach_set('use_smooth', [False] * len(me.polygons))
            if not _WARNED:
                print('SHADOW_WARN auto smooth unavailable, exporting flat:', exc, flush=True)
                _WARNED.append(exc)


# ---------------------------------------------------------------- checks

def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def tri_box(tri, lo, hi):
    """Separating-axis triangle / AABB overlap test (game coordinates)."""
    cen = [(lo[i] + hi[i]) * .5 for i in range(3)]
    h = [(hi[i] - lo[i]) * .5 for i in range(3)]
    v = [_sub(p, cen) for p in tri]
    for i in range(3):
        if min(p[i] for p in v) > h[i] or max(p[i] for p in v) < -h[i]:
            return False
    e = [_sub(v[1], v[0]), _sub(v[2], v[1]), _sub(v[0], v[2])]
    n = _cross(e[0], e[1])
    if abs(_dot(n, v[0])) > h[0] * abs(n[0]) + h[1] * abs(n[1]) + h[2] * abs(n[2]):
        return False
    for ed in e:
        for u in ((1, 0, 0), (0, 1, 0), (0, 0, 1)):
            a = _cross(u, ed)
            p = [_dot(a, q) for q in v]
            r = h[0] * abs(a[0]) + h[1] * abs(a[1]) + h[2] * abs(a[2])
            if min(p) > r or max(p) < -r:
                return False
    return True


def keep_clear(name, lo, hi, exclude=()):
    """Count triangles overlapping the (1 mm shrunk) clearance box; exclude = spec-placed prop name prefixes."""
    eps = 1e-3
    blo = (lo[0] + eps, lo[1], lo[2] + eps)
    bhi = (hi[0] - eps, hi[1], hi[2] - eps)
    hits = {}
    deps = bpy.context.evaluated_depsgraph_get()
    for ob in scene_meshes():
        ev = ob.evaluated_get(deps)
        geo = ev.to_mesh()
        geo.calc_loop_triangles()
        mw = ev.matrix_world
        pts = [(p.x, p.z, -p.y) for p in (mw @ v.co for v in geo.vertices)]
        n = sum(1 for t in geo.loop_triangles if tri_box([pts[i] for i in t.vertices], blo, bhi))
        ev.to_mesh_clear()
        if n:
            hits[ob.name] = n
    main = {k: v for k, v in hits.items() if not (exclude and k.startswith(tuple(exclude)))}
    side = {k: v for k, v in hits.items() if k not in main}
    print('SHADOW_CLEAR', name, sum(main.values()), flush=True)
    if main:
        print('SHADOW_CLEAR_HITS', name, sorted(main.items())[:12], flush=True)
    if side:
        print('SHADOW_CLEAR_NOTE', name, 'spec-placed props inside the box (excluded):',
              sum(side.values()), 'triangles in', len(side), 'objects', sorted({k.split(' ')[0] + ' ' + k.split(' ')[1] + ' ' + k.split(' ')[2] for k in side}), flush=True)


def report(name):
    objs = scene_meshes()
    print('SHADOW_MANIFOLD', name, c.non_manifold_edges(objs), 'non-manifold edges in', len(objs), 'objects', flush=True)


def export(name):
    tris, lo, hi = c.export(name, smooth=('',))
    print('SHADOW_BUDGET', name, tris, '<=', BUDGET[name], 'OK' if tris <= BUDGET[name] else 'OVER', flush=True)


# ---------------------------------------------------------------- shared props

def stone_lantern(tag, x, z):
    """Stone lantern, 0.5 footprint, 2.2 tall, glowing firebox core."""
    blk(f'{tag} base', (x - 0.25, 0.0, z - 0.25), (x + 0.25, 0.16, z + 0.25), 'Shadow sandstone shade', bevel=0.02)
    blk(f'{tag} plinth', (x - 0.19, 0.16, z - 0.19), (x + 0.19, 0.26, z + 0.19), 'Shadow sandstone', bevel=0.015)
    rod(f'{tag} shaft', (x, 0.26, z), (x, 1.18, z), 0.1, 'Shadow sandstone', n=8)
    blk(f'{tag} collar', (x - 0.2, 1.18, z - 0.2), (x + 0.2, 1.26, z + 0.2), 'Shadow sandstone light', bevel=0.015)
    blk(f'{tag} glow core', (x - 0.11, 1.29, z - 0.11), (x + 0.11, 1.67, z + 0.11), 'Shadow lamp glow', bevel=0)
    for i, (dx, dz) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        px, pz = x + dx * 0.17, z + dz * 0.17
        blk(f'{tag} post {i}', (px - 0.035, 1.26, pz - 0.035), (px + 0.035, 1.70, pz + 0.035), 'Shadow sandstone', bevel=0.01)
    for i, (dx, dz) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
        bx, bz = x + dx * 0.125, z + dz * 0.125
        blk(f'{tag} cage bar {i}', (bx - 0.012, 1.26, bz - 0.012), (bx + 0.012, 1.70, bz + 0.012), 'Shadow brass', bevel=0)
    blk(f'{tag} roof slab', (x - 0.25, 1.70, z - 0.25), (x + 0.25, 1.78, z + 0.25), 'Shadow sandstone light', bevel=0.015)
    frustum(f'{tag} roof', x, z, 1.78, 2.04, 0.46, 0.08, 'Shadow sandstone light')
    rod(f'{tag} finial', (x, 2.03, z), (x, 2.13, z), 0.035, 'Shadow brass', n=8)
    frustum(f'{tag} finial tip', x, z, 2.13, 2.2, 0.07, 0.01, 'Shadow brass')


def obelisk_lantern(tag, x, z):
    """Obelisk lantern, 0.6 footprint, 2.6 tall, brass cage around a glowing core."""
    blk(f'{tag} base', (x - 0.3, -0.25, z - 0.3), (x + 0.3, 0.3, z + 0.3), 'Shadow sandstone shade', bevel=0.02, seg=2)
    frustum(f'{tag} shaft', x, z, 0.3, 1.72, 0.42, 0.3, 'Shadow sandstone')
    blk(f'{tag} cage floor', (x - 0.19, 1.72, z - 0.19), (x + 0.19, 1.77, z + 0.19), 'Shadow brass', bevel=0.008)
    blk(f'{tag} glow core', (x - 0.1, 1.79, z - 0.1), (x + 0.1, 2.15, z + 0.1), 'Shadow lamp glow', bevel=0)
    for i, (dx, dz) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        px, pz = x + dx * 0.15, z + dz * 0.15
        blk(f'{tag} cage post {i}', (px - 0.02, 1.77, pz - 0.02), (px + 0.02, 2.17, pz + 0.02), 'Shadow brass', bevel=0)
    for i, (dx, dz) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
        bx, bz = x + dx * 0.115, z + dz * 0.115
        blk(f'{tag} cage bar {i}', (bx - 0.01, 1.77, bz - 0.01), (bx + 0.01, 2.17, bz + 0.01), 'Shadow brass', bevel=0)
    blk(f'{tag} cage roof', (x - 0.2, 2.17, z - 0.2), (x + 0.2, 2.22, z + 0.2), 'Shadow brass', bevel=0.008)
    frustum(f'{tag} pyramidion', x, z, 2.22, 2.6, 0.36, 0.03, 'Shadow sandstone light')


# ---------------------------------------------------------------- shadow-entry-v01

def wall_run(tag, s, z0, z1, rng):
    def xr(a, b):
        return min(s * a, s * b), max(s * a, s * b)
    xa, xb = xr(3.52, 3.88)
    blk(f'{tag} core', (xa, -0.1, z0), (xb, 0.92, z1), 'Shadow sandstone shade', bevel=0)
    fa, fb = xr(3.51, 3.89)
    g = 0.012
    for ci, (y0, y1) in enumerate(((0.0, 0.46), (0.46, 0.9))):
        z, k = z0, 0
        while z < z1 - 1e-6:
            length = rng.uniform(0.9, 1.5) * (0.55 if (k == 0 and ci == 1) else 1.0)
            ze = min(z1, z + length)
            if z1 - ze < 0.35:
                ze = z1
            m = 'Shadow sandstone shade' if rng.random() < 0.15 else 'Shadow sandstone'
            blk(f'{tag} block {ci}-{k:02d}', (fa, y0 + g, z + g), (fb, y1 - g, ze - g), m, bevel=0.02)
            z, k = ze, k + 1
    ca, cb = xr(3.5, 3.9)
    for k in range(4):
        za, zb = z0 + (z1 - z0) * k / 4, z0 + (z1 - z0) * (k + 1) / 4
        blk(f'{tag} coping {k}', (ca, 0.9, za + 0.008), (cb, 1.05, zb - 0.008), 'Shadow sandstone light', bevel=0.02, seg=2)


def build_entry():
    rng = random.Random(RNG_SEED)
    # Courtyard floor: grout bed with flagstones (tops exactly y 0) in front of the gate.
    blk('Entry floor bed', (-3.5, -0.35, -15.0), (3.5, -0.02, -8.0), 'Shadow grout', bevel=0)
    g = 0.014
    z1, row = -8.0, 0
    while z1 > -14.2 + 1e-6:
        z0 = z1 - rng.uniform(0.72, 0.98)
        if z0 < -14.2 + 0.4:
            z0 = -14.2
        x0, col = -3.5, 0
        lead = rng.uniform(0.0, 0.45)
        while x0 < 3.5 - 1e-6:
            w = rng.uniform(0.75, 1.3) - (lead if col == 0 else 0.0)
            x1 = min(3.5, x0 + max(0.45, w))
            if 3.5 - x1 < 0.4:
                x1 = 3.5
            m = 'Shadow floor warm alt' if rng.random() < 0.4 else 'Shadow floor warm'
            blk(f'Entry flagstone {row:02d}-{col}', (x0 + g, -0.08, z0 + g), (x1 - g, 0.0, z1 - g), m)
            x0, col = x1, col + 1
        z1, row = z0, row + 1

    for s in (-1, 1):
        side = 'L' if s < 0 else 'R'

        def xr(a, b):
            return min(s * a, s * b), max(s * a, s * b)
        wall_run(f'Entry wall {side}', s, -15.0, -8.1, rng)
        pa, pb = xr(3.46, 3.94)
        blk(f'Entry wall {side} end pier', (pa, 0.0, -8.45), (pb, 1.2, -8.0), 'Shadow sandstone', bevel=0.02, seg=2)
        qa, qb = xr(3.43, 3.97)
        blk(f'Entry wall {side} end cap', (qa, 1.2, -8.5), (qb, 1.32, -8.0), 'Shadow sandstone light', bevel=0.02, seg=2)
        ba, bb = xr(3.1, 3.5)
        blk(f'Entry gate {side} buttress', (ba, 0.0, -15.0), (bb, 3.2, -14.3), 'Shadow sandstone shade', bevel=0.02, seg=2)
        ta, tb = xr(3.08, 3.52)
        blk(f'Entry gate {side} buttress cap', (ta, 3.2, -15.02), (tb, 3.35, -14.26), 'Shadow sandstone light', bevel=0.02)
        la, lb = xr(2.66, 3.1)
        blk(f'Entry gate {side} pilaster', (la, 0.35, -14.2), (lb, 4.9, -14.13), 'Shadow sandstone light', bevel=0.015)

    # Inner moon gate: body z[-15.0,-14.2], niche on its +Z face (back wall at z -14.28).
    blk('Entry gate core', (-3.1, 0.0, -15.0), (3.1, 5.1, -14.28), 'Shadow sandstone', bevel=0.03, seg=2)
    plate_hole('Entry gate face', -3.1, 3.1, 0.0, 5.1, 0.0, 2.3, 1.86, -14.28, -14.2, 'Shadow sandstone', seg=64)
    blk('Entry gate base course', (-3.1, 0.0, -14.2), (3.1, 0.35, -14.15), 'Shadow sandstone shade', bevel=0.01)
    blk('Entry gate top band', (-3.1, 4.9, -14.2), (3.1, 5.02, -14.13), 'Shadow sandstone light', bevel=0.01)
    blk('Entry gate cornice', (-3.3, 5.02, -15.08), (3.3, 5.2, -14.12), 'Shadow sandstone light', bevel=0.02, seg=2)
    annulus('Entry gate joint ring', 0.0, 2.3, 1.87, 2.48, -14.21, -14.135, 'Shadow grout', seg=64)
    voussoirs('Entry gate', 0.0, 2.3, 1.85, 2.5, -14.21, -14.12, key_r1=2.58)
    disc_z('Entry portal day disc', 0.0, 2.3, -14.265, -14.235, 1.8, 'Shadow portal day', n=64)
    torus('Entry gate brass rim', (0.0, 2.3, -14.2), 1.83, 0.045, 'Shadow brass')
    # Crescent crest y 5.2-6.3.
    blk('Entry crest pedestal', (-0.78, 5.2, -14.82), (0.78, 5.36, -14.38), 'Shadow sandstone light', bevel=0.02, seg=2)
    blk('Entry crest step', (-0.52, 5.36, -14.74), (0.52, 5.44, -14.46), 'Shadow sandstone', bevel=0.015)
    crescent('Entry crest moon', 0.0, 5.98, 0.55, 0.2, -14.72, -14.48, 'Shadow gold')

    for s in (-1, 1):
        stone_lantern(f'Entry lantern {"L" if s < 0 else "R"}', s * 2.6, -13.4)


# ---------------------------------------------------------------- shadow-bridges-v01

def build_bridges():
    rng = random.Random(RNG_SEED)
    for bi, g in enumerate((11.0, 31.0, 49.0)):
        z0, z1 = g, g + 6.0
        tag = f'Bridge {bi + 1}'
        blk(f'{tag} slab', (-2.08, -0.9, z0), (2.08, -0.06, z1), 'Shadow sandstone shade', bevel=0.02, seg=2)
        # Deck flagstones, tops exactly y 0.
        gz = 0.012
        za, r = z0, 0
        while za < z1 - 1e-6:
            zb = min(z1, za + rng.uniform(0.85, 1.15))
            if z1 - zb < 0.45:
                zb = z1
            n = rng.choice((2, 3, 3))
            widths = [rng.uniform(0.8, 1.2) for _ in range(n)]
            scale = 3.68 / sum(widths)
            xa = -1.84
            for k, w in enumerate(widths):
                xb = 1.84 if k == n - 1 else xa + w * scale
                m = 'Shadow floor warm alt' if rng.random() < 0.4 else 'Shadow floor warm'
                blk(f'{tag} deck {r:02d}-{k}', (xa + gz, -0.07, za + gz), (xb - gz, 0.0, zb - gz), m)
                xa = xb
            za, r = zb, r + 1
        posts = [z0 + 0.1 + i * 1.45 for i in range(5)]
        for s in (-1, 1):
            def xr(a, b):
                return min(s * a, s * b), max(s * a, s * b)
            side = 'L' if s < 0 else 'R'
            ca, cb = xr(1.84, 2.1)
            for k in range(4):
                qa, qb = z0 + 1.5 * k, z0 + 1.5 * (k + 1)
                blk(f'{tag} curb {side}{k}', (ca, -0.32, qa + gz), (cb, 0.0, qb - gz), 'Shadow sandstone light', bevel=0.015)
            x = s * 2.0
            blk(f'{tag} rail glow {side}', (x - 0.03, 0.87, z0 + 0.05), (x + 0.03, 0.93, z1 - 0.05), 'Shadow rail glow', bevel=0)
            for k, zp in enumerate(posts):
                blk(f'{tag} rail post {side}{k}', (x - 0.07, 0.0, zp - 0.07), (x + 0.07, 0.9, zp + 0.07), 'Shadow bronze dark', bevel=0.01)
                blk(f'{tag} rail foot {side}{k}', (x - 0.09, 0.0, zp - 0.09), (x + 0.09, 0.05, zp + 0.09), 'Shadow brass', bevel=0.008)
                blk(f'{tag} rail cap {side}{k}', (x - 0.09, 0.93, zp - 0.09), (x + 0.09, 0.97, zp + 0.09), 'Shadow brass', bevel=0.008)
                ka, kb = xr(1.62, 2.1)
                blk(f'{tag} corbel {side}{k} top', (ka, -1.18, zp - 0.22), (kb, -0.9, zp + 0.22), 'Shadow sandstone', bevel=0.015)
                ma, mb = xr(1.74, 2.06)
                blk(f'{tag} corbel {side}{k} mid', (ma, -1.42, zp - 0.16), (mb, -1.18, zp + 0.16), 'Shadow sandstone shade', bevel=0.015)
                frustum(f'{tag} corbel {side}{k} tip', s * 1.9, zp, -1.66, -1.42, 0.06, 0.3, 'Shadow sandstone shade')
        for k, zp in enumerate(posts):
            blk(f'{tag} under rib {k}', (-1.7, -1.1, zp - 0.14), (1.7, -0.9, zp + 0.14), 'Shadow sandstone', bevel=0.015)
        blk(f'{tag} keel', (-0.9, -1.2, z0 + 0.3), (0.9, -0.9, z1 - 0.3), 'Shadow sandstone shade', bevel=0.015)

        # Gate at the bridge start: everything inside |x| < 1.85 stays at z <= g.
        for s in (-1, 1):
            def xr(a, b):
                return min(s * a, s * b), max(s * a, s * b)
            side = 'L' if s < 0 else 'R'
            pa, pb = xr(2.2, 2.9)
            blk(f'{tag} gate post {side}', (pa, 0.0, g - 0.75), (pb, 3.75, g - 0.05), 'Shadow sandstone', bevel=0.03, seg=2)
            fa, fb = xr(2.12, 2.98)
            blk(f'{tag} gate footing {side}', (fa, -1.4, g - 0.83), (fb, 0.22, g + 0.03), 'Shadow sandstone shade', bevel=0.03, seg=2)
            qa, qb = xr(2.14, 2.96)
            blk(f'{tag} gate capital {side}', (qa, 3.55, g - 0.8), (qb, 3.75, g), 'Shadow sandstone light', bevel=0.02)
        blk(f'{tag} gate lintel', (-2.9, 3.75, g - 0.8), (2.9, 4.3, g), 'Shadow sandstone light', bevel=0.03, seg=2)
        blk(f'{tag} gate panel', (-1.7, 3.86, g - 0.83), (1.7, 4.19, g - 0.79), 'Shadow sandstone shade', bevel=0.01)
        blk(f'{tag} crest base', (-1.1, 4.3, g - 0.7), (1.1, 4.5, g - 0.1), 'Shadow sandstone', bevel=0.02)
        if bi == 0:
            # EYE SOCKET: stone ring outer 0.62 / inner 0.45, 0.2 deep, centre (0, 5.1, 10.9), axis Z; open centre.
            annulus(f'{tag} eye socket ring', 0.0, 5.1, 0.45, 0.62, 10.8, 11.0, 'Shadow sandstone light', seg=48)
            annulus(f'{tag} eye frame', 0.0, 5.1, 0.6, 0.82, g - 0.45, g - 0.15, 'Shadow sandstone', seg=48)
            for s in (-1, 1):
                pts = [(s * 0.78, 5.28), (s * 1.34, 5.1), (s * 0.78, 4.92)]
                prism_xy(f'{tag} eye corner {"L" if s < 0 else "R"}', pts, g - 0.4, g - 0.2, 'Shadow sandstone light')
            rays(f'{tag} eye lash', 0.0, 5.1, g - 0.36, g - 0.24, 0.84, 1.04, 5, 0.05, 'Shadow brass', phase=math.radians(50))
            frustum(f'{tag} eye finial', 0.0, g - 0.3, 5.88, 6.2, 0.26, 0.04, 'Shadow sandstone light')
        else:
            disc_z(f'{tag} medallion', 0.0, 5.1, g - 0.55, g - 0.25, 0.72, 'Shadow sandstone light', n=48)
            annulus(f'{tag} medallion rim', 0.0, 5.1, 0.62, 0.74, g - 0.58, g - 0.5, 'Shadow brass', seg=48)
            frustum(f'{tag} medallion finial', 0.0, g - 0.4, 5.76, 6.08, 0.24, 0.04, 'Shadow sandstone light')
            if bi == 1:
                crescent(f'{tag} gold crescent', 0.0, 5.2, 0.44, 0.17, g - 0.62, g - 0.53, 'Shadow gold')
            else:
                disc_z(f'{tag} gold sun', 0.0, 5.1, g - 0.61, g - 0.53, 0.2, 'Shadow gold', n=32)
                rays(f'{tag} gold sun ray', 0.0, 5.1, g - 0.6, g - 0.54, 0.26, 0.55, 12, 0.07, 'Shadow gold')


# ---------------------------------------------------------------- shadow-gate-exterior-v01 (local, front = -Z)

def build_gate():
    blk('Gate plinth lower', (-3.5, -1.0, -1.2), (3.5, 0.15, 1.2), 'Shadow sandstone shade', bevel=0.03, seg=2)
    blk('Gate plinth upper', (-3.3, 0.15, -1.0), (3.3, 0.3, 1.0), 'Shadow sandstone', bevel=0.02)
    # Body x[-3.2,3.2] y[0.3,5.3] z[-0.7,0.7]: framed front (pilasters/top band to z -0.7) around a
    # recessed field at z -0.55 carrying the voussoir ring 0.15 proud; niche back wall at z -0.42.
    blk('Gate core', (-3.2, 0.3, -0.42), (3.2, 5.2, 0.7), 'Shadow sandstone', bevel=0.03, seg=2)
    plate_hole('Gate face', -2.62, 2.62, 0.3, 4.9, 0.0, 2.3, 1.86, -0.55, -0.42, 'Shadow sandstone', seg=64)
    for s in (-1, 1):
        def xr(a, b):
            return min(s * a, s * b), max(s * a, s * b)
        side = 'L' if s < 0 else 'R'
        pa, pb = xr(2.62, 3.2)
        blk(f'Gate pilaster {side}', (pa, 0.62, -0.7), (pb, 4.9, -0.42), 'Shadow sandstone light', bevel=0.02)
        qa, qb = xr(2.58, 3.26)
        blk(f'Gate pilaster {side} base', (qa, 0.3, -0.7), (qb, 0.62, -0.38), 'Shadow sandstone shade', bevel=0.02)
        obelisk_lantern(f'Gate lantern {side}', s * 3.9, -0.9)
    blk('Gate top band', (-3.2, 4.9, -0.7), (3.2, 5.08, -0.42), 'Shadow sandstone light', bevel=0.02)
    blk('Gate cornice', (-3.34, 5.08, -0.7), (3.34, 5.3, 0.82), 'Shadow sandstone light', bevel=0.02, seg=2)
    blk('Gate back base course', (-3.28, 0.3, -0.38), (3.28, 0.62, 0.78), 'Shadow sandstone shade', bevel=0.02)
    annulus('Gate joint ring', 0.0, 2.3, 1.87, 2.53, -0.68, -0.54, 'Shadow grout', seg=64)
    voussoirs('Gate', 0.0, 2.3, 1.85, 2.55, -0.7, -0.54, key_r1=2.6)
    disc_z('Gate portal night disc', 0.0, 2.3, -0.455, -0.425, 1.8, 'Shadow portal night', n=64)
    torus('Gate brass rim', (0.0, 2.3, -0.47), 1.83, 0.045, 'Shadow brass')
    # Crescent-moon crest y 5.0-6.2 (pedestal starts inside the body top).
    blk('Gate crest pedestal', (-0.8, 5.0, -0.32), (0.8, 5.45, 0.32), 'Shadow sandstone light', bevel=0.02, seg=2)
    blk('Gate crest step', (-0.56, 5.45, -0.24), (0.56, 5.5, 0.24), 'Shadow sandstone', bevel=0.01)
    crescent('Gate crest moon', 0.0, 5.986, 0.506, 0.2, -0.13, 0.13, 'Shadow gold', tm=math.radians(115))
    # Solid back with a carved sun medallion (relief toward +Z).
    disc_z('Gate back medallion field', 0.0, 2.8, 0.66, 0.74, 1.36, 'Shadow sandstone shade', n=64)
    annulus('Gate back medallion rim', 0.0, 2.8, 1.22, 1.36, 0.7, 0.8, 'Shadow sandstone light', seg=64)
    disc_z('Gate back sun disc', 0.0, 2.8, 0.7, 0.82, 0.42, 'Shadow sandstone light', n=40)
    annulus('Gate back sun ring', 0.0, 2.8, 0.52, 0.62, 0.7, 0.79, 'Shadow sandstone light', seg=48)
    rays('Gate back sun ray', 0.0, 2.8, 0.7, 0.78, 0.68, 1.14, 12, 0.09, 'Shadow sandstone light')


# ---------------------------------------------------------------- shadow-gate-seal-v01 (local origin = portal centre)

def build_seal():
    disc_z('Seal body', 0.0, 0.0, -0.02, 0.04, 1.86, 'Shadow bronze dark', n=72)
    annulus('Seal outer band', 0.0, 0.0, 1.22, 1.86, -0.04, -0.02, 'Shadow bronze dark', seg=72)
    disc_z('Seal inner field', 0.0, 0.0, -0.04, -0.02, 0.98, 'Shadow bronze dark', n=56)
    # Engraved sun ring: gold inlay 5 mm below the bronze face.
    annulus('Seal sun ring', 0.0, 0.0, 0.98, 1.22, -0.035, -0.02, 'Shadow gold', seg=72)
    rays('Seal sun ray', 0.0, 0.0, -0.043, -0.035, 1.27, 1.7, 16, 0.045, 'Shadow gold')
    # Raised moon disc covering the sun (eclipse).
    disc_z('Seal moon', 0.0, 0.0, -0.1, -0.04, 0.88, 'Shadow bronze dark', n=56)
    annulus('Seal moon edge', 0.0, 0.0, 0.84, 0.9, -0.105, -0.04, 'Shadow gold', seg=56)


# ---------------------------------------------------------------- phases

def export_all():
    t = time.time()
    build_entry()
    tidy()
    report('shadow-entry-v01')
    keep_clear('shadow-entry-v01', (-3.2, 0.02, -14.1), (3.2, 100.0, -8.0), exclude=('Entry lantern',))
    export('shadow-entry-v01')

    build_bridges()
    tidy()
    report('shadow-bridges-v01')
    for g in (11.0, 31.0, 49.0):
        keep_clear(f'shadow-bridges-v01 z[{g:g},{g + 6:g}]', (-1.85, 0.02, g), (1.85, 100.0, g + 6.0))
    keep_clear('shadow-bridges-v01', (-1.85, 0.02, 11.0), (1.85, 100.0, 17.0))
    export('shadow-bridges-v01')

    build_gate()
    tidy()
    report('shadow-gate-exterior-v01')
    keep_clear('shadow-gate-exterior-v01 front (y>0.35, z<-0.7, |x|<3.3)', (-3.3, 0.35, -100.0), (3.3, 100.0, -0.7))
    export('shadow-gate-exterior-v01')

    build_seal()
    tidy()
    report('shadow-gate-seal-v01')
    export('shadow-gate-seal-v01')
    print('SHADOW_TIME export', round(time.time() - t, 1), 's', flush=True)


def render(path, eye, target, lights, world=(.012, .018, .045)):
    t = time.time()
    c.preview(path, eye, target, res=(1400, 875), samples=16, world=world, lights=lights)
    print('SHADOW_TIME render', os.path.basename(path), round(time.time() - t, 1), 's', flush=True)


def render_entry():
    c.clear()
    build_entry()
    tidy()
    lights = [dict(type='SUN', pos=(5, 14, -2), target=(0, 0, -12), energy=0.6, color=MOON)]
    lights += [dict(type='POINT', pos=(s * 2.6, 1.5, -13.0), energy=200, color=LAMP, size=.08) for s in (-1, 1)]
    render(os.path.join(c.ART, 'arch-entry.png'), (0, 3, -4), (0, 2.3, -14.5), lights)


def render_bridge():
    c.clear()
    build_bridges()
    tidy()
    lights = [dict(type='SUN', pos=(6, 12, 2), target=(0, 0, 20), energy=0.6, color=MOON)]
    lights += [dict(type='POINT', pos=(s * 1.9, 2.5, 9.7), energy=200, color=LAMP, size=.08) for s in (-1, 1)]
    render(os.path.join(c.ART, 'arch-bridge.png'), (3.5, 3, 7), (0, 2, 14), lights)


def render_gate():
    c.clear()
    build_gate()
    tidy()
    lights = [dict(type='SUN', pos=(-6, 10, -6), target=(0, 0, 0), energy=0.6, color=MOON),
              dict(type='SUN', pos=(8, 12, -10), target=(0, 0, 0), energy=3.0, color=(1, .95, .85))]
    lights += [dict(type='POINT', pos=(s * 3.9, 1.97, -1.35), energy=200, color=LAMP, size=.08) for s in (-1, 1)]
    render(os.path.join(c.ART, 'exterior-gate.png'), (5, 3.5, -9), (0, 2.5, 0), lights, world=(0.35, 0.45, 0.6))


if 'export' in PHASES:
    export_all()
if 'entry' in PHASES:
    render_entry()
if 'bridge' in PHASES:
    render_bridge()
if 'gate' in PHASES:
    render_gate()
print('SHADOW_DONE', sorted(PHASES), flush=True)
