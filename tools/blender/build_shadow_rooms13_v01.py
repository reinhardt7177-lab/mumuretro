"""Unity shadow shrine v01 - static architecture of room 1 (shade court) and room 3 (silhouette court).

Writes art/engine-transfer/model-data/ShadowTemple/shadow-room1-v01.json, shadow-room3-v01.json
(+ art/shadow-temple/v01/<name>.blend) and the previews art/shadow-temple/v01/arch-room1.png, arch-room3.png.

  blender --background --factory-startup --python tools/blender/build_shadow_rooms13_v01.py
      export both rooms, then rebuild and render both previews
  ... -- --export                    export only
  ... -- --render [room1] [room3]    previews only

Game metres through vec(): x right, y up, z forward; walkable floor top at y 0. Every part is a closed solid.
Keep-clear volumes are verified before export (SHADOW_CLEAR lines must report 0).
"""
import bpy
import sys

bpy.ops.wm.read_factory_settings(use_empty=True)
sys.path.insert(0, r'D:\mumumetro\tools\blender')
sys.dont_write_bytecode = True

import math  # noqa: E402
import os  # noqa: E402
import random  # noqa: E402
import time  # noqa: E402
from mathutils import Vector  # noqa: E402
import shadow_temple_common as c  # noqa: E402

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SMOOTH = ('Tower rail',)
LEAF = ((0, 1), (.5, .45), (.42, -.08), (0, -.25), (-.42, -.08), (-.5, .45))


# ---------- closed-solid primitives: each returns (vertices, faces) in game metres ----------

def slab_vf(x0, x1, y0, y1, z0, z1, ch=0.0):
    """Axis-aligned box from extents; ch chamfers the four top edges (20 tris)."""
    if ch <= 0:
        v = [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
             (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)]
        return v, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    ym = y1 - ch
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
         (x0, ym, z0), (x1, ym, z0), (x1, ym, z1), (x0, ym, z1),
         (x0 + ch, y1, z0 + ch), (x1 - ch, y1, z0 + ch), (x1 - ch, y1, z1 - ch), (x0 + ch, y1, z1 - ch)]
    f = [(0, 3, 2, 1), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
         (4, 5, 9, 8), (5, 6, 10, 9), (6, 7, 11, 10), (7, 4, 8, 11), (8, 9, 10, 11)]
    return v, f


def xs(s, a, b):
    """Extents between |x| a and b on side s (-1 left, +1 right)."""
    return min(s * a, s * b), max(s * a, s * b)


def prism_vf(pts, off):
    n = len(pts)
    v = [tuple(p) for p in pts] + [(p[0] + off[0], p[1] + off[1], p[2] + off[2]) for p in pts]
    f = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    f += [(k, (k + 1) % n, n + (k + 1) % n, n + k) for k in range(n)]
    return v, f


def ring_vf(outer, inner, off):
    """Closed band between two matching planar loops, extruded by off (washer, frame, trim)."""
    n = len(outer)
    v = []
    for o, i in zip(outer, inner):
        v += [tuple(i), tuple(o), (o[0] + off[0], o[1] + off[1], o[2] + off[2]),
              (i[0] + off[0], i[1] + off[1], i[2] + off[2])]
    f = []
    for k in range(n):
        a, b = 4 * k, 4 * ((k + 1) % n)
        f += [(a + j, b + j, b + (j + 1) % 4, a + (j + 1) % 4) for j in range(4)]
    return v, f


def washer_vf(cx, cz, r0, r1, y0, y1, n=64):
    def circ(r):
        return [(cx + r * math.cos(math.tau * k / n), y0, cz + r * math.sin(math.tau * k / n)) for k in range(n)]
    return ring_vf(circ(r1), circ(r0), (0, y1 - y0, 0))


def cyl_vf(a, b, r, n=8):
    a, b = Vector(a), Vector(b)
    t = (b - a).normalized()
    u = t.cross(Vector((0, 1, 0)) if abs(t.y) < .9 else Vector((1, 0, 0))).normalized()
    w = t.cross(u)
    v = [tuple(p + (u * math.cos(math.tau * k / n) + w * math.sin(math.tau * k / n)) * r) for p in (a, b) for k in range(n)]
    f = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    f += [(k, (k + 1) % n, n + (k + 1) % n, n + k) for k in range(n)]
    return v, f


def tube_vf(pts, r, n=5):
    """Capped tube along a polyline with a parallel-transported frame (ivy stems)."""
    pts = [Vector(p) for p in pts]
    v, prev = [], None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        if prev is None:
            nr = t.cross(Vector((0, 1, 0)) if abs(t.y) < .9 else Vector((1, 0, 0))).normalized()
        else:
            nr = (prev - t * prev.dot(t)).normalized()
        prev = nr
        bi = t.cross(nr)
        v += [tuple(p + (nr * math.cos(math.tau * k / n) + bi * math.sin(math.tau * k / n)) * r) for k in range(n)]
    m = len(pts)
    f = [(i * n + k, (i + 1) * n + k, (i + 1) * n + (k + 1) % n, i * n + (k + 1) % n) for i in range(m - 1) for k in range(n)]
    f += [tuple(range(n - 1, -1, -1)), tuple(range((m - 1) * n, m * n))]
    return v, f


def ellipse_vf(cx, cy, cz, rx, rz, r, seg=128, sides=8):
    """Closed horizontal elliptical tube with a true round section (no scaled-torus distortion)."""
    v = []
    for i in range(seg):
        t = math.tau * i / seg
        px, pz = cx + rx * math.cos(t), cz + rz * math.sin(t)
        tx, tz = -rx * math.sin(t), rz * math.cos(t)
        L = math.hypot(tx, tz)
        nx, nz = tz / L, -tx / L
        for j in range(sides):
            a = math.tau * j / sides
            v.append((px + r * math.cos(a) * nx, cy + r * math.sin(a), pz + r * math.cos(a) * nz))
    f = [(i * sides + j, ((i + 1) % seg) * sides + j, ((i + 1) % seg) * sides + (j + 1) % sides, i * sides + (j + 1) % sides)
         for i in range(seg) for j in range(sides)]
    return v, f


def pyramid_vf(cx, y0, cz, h, y1):
    v = [(cx - h, y0, cz - h), (cx + h, y0, cz - h), (cx + h, y0, cz + h), (cx - h, y0, cz + h), (cx, y1, cz)]
    return v, [(3, 2, 1, 0), (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)]


def inset(pts, w):
    """Inset a convex 2D polygon by w (either winding)."""
    n = len(pts)
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
    sg = 1 if area > 0 else -1
    lines = []
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy)
        lines.append(((x0 - dy / L * sg * w, y0 + dx / L * sg * w), (dx, dy)))
    out = []
    for i in range(n):
        (p1, d1), (p2, d2) = lines[i - 1], lines[i]
        den = d1[0] * d2[1] - d1[1] * d2[0]
        t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den
        out.append((p1[0] + t * d1[0], p1[1] + t * d1[1]))
    return out


def crescent_pts(R=.2, r=.18, d=.07, n1=22, n2=18):
    """Crescent with horns up: outer circle minus a circle shifted up by d (simple polygon)."""
    y = (R * R - r * r + d * d) / (2 * d)
    x = math.sqrt(R * R - y * y)
    th = math.atan2(y, x)
    pts = [(R * math.cos(th - (math.pi + 2 * th) * i / n1), R * math.sin(th - (math.pi + 2 * th) * i / n1)) for i in range(n1 + 1)]
    pl, pr = math.atan2(y - d, -x), math.atan2(y - d, x)
    if pr < pl:
        pr += math.tau
    pts += [(r * math.cos(pl + (pr - pl) * i / n2), d + r * math.sin(pl + (pr - pl) * i / n2)) for i in range(1, n2)]
    return pts


def star_pts(cx, cy, r_tip, r_valley, rays=12):
    return [(cx + (r_tip if k % 2 == 0 else r_valley) * math.cos(math.pi / 2 + k * math.pi / rays),
             cy + (r_tip if k % 2 == 0 else r_valley) * math.sin(math.pi / 2 + k * math.pi / rays)) for k in range(2 * rays)]


def disc_pts(cx, cy, r, n=16):
    return [(cx + r * math.cos(math.tau * k / n), cy + r * math.sin(math.tau * k / n)) for k in range(n)]


class Builder:
    """Collects closed solids per (object name, palette material); emits one mesh object per key."""

    def __init__(self):
        self.parts = {}

    def add(self, name, m, v, f):
        vv, ff = self.parts.setdefault((name, m), ([], []))
        o = len(vv)
        vv.extend(v)
        ff.extend(tuple(i + o for i in face) for face in f)

    def emit(self):
        obs = []
        for (name, m), (v, f) in self.parts.items():
            ob = c.mesh(f'{name} - {m}', v, f, c.mat(m))
            if name.startswith(SMOOTH):
                if hasattr(ob.data, 'shade_smooth'):
                    ob.data.shade_smooth()
                else:
                    for p in ob.data.polygons:
                        p.use_smooth = True
            obs.append(ob)
        return obs


# ---------- architecture pieces ----------

def floor(B, x0, x1, z0, z1, m, m_alt):
    B.add('Floor grout', 'Shadow grout', *slab_vf(x0, x1, -.32, -.016, z0, z1))
    g = .022
    for i in range(int(round((x1 - x0) / 2))):
        for j in range(int(math.ceil((z1 - z0) / 2 - 1e-9))):
            a = x0 + 2 * i
            b0, b1 = z0 + 2 * j, min(z0 + 2 * j + 2, z1)
            B.add('Floor tile', m_alt if (i + j) % 4 == 0 else m, *slab_vf(a + g, a + 2 - g, -.12, 0, b0 + g, b1 - g, .012))


def arch(B, cx, cy, cz, r_in, r_out, depth, n, sub=3, gap=.014, key_out=.08, key_depth=.04):
    """Voussoir half-ring in the y-z plane (spans along Z), depth along x; proud light keystone."""
    step = math.pi / n
    for k in range(n):
        key = k == n // 2
        ro = r_out + (key_out if key else 0)
        hd = depth / 2 + (key_depth / 2 if key else 0)
        a0 = 0.0 if k == 0 else k * step + gap / (2 * r_in)
        a1 = math.pi if k == n - 1 else (k + 1) * step - gap / (2 * r_in)
        v, f = [], []
        for s in range(sub + 1):
            a = a0 + (a1 - a0) * s / sub
            for r, x in ((r_in, cx - hd), (ro, cx - hd), (r_in, cx + hd), (ro, cx + hd)):
                v.append((x, cy + r * math.sin(a), cz + r * math.cos(a)))
        for s in range(sub):
            i, j = 4 * s, 4 * (s + 1)
            f += [(i, i + 2, j + 2, j), (i + 1, j + 1, j + 3, i + 3), (i, j, j + 1, i + 1), (i + 2, i + 3, j + 3, j + 2)]
        e = 4 * sub
        f += [(0, 1, 3, 2), (e, e + 2, e + 3, e + 1)]
        B.add('Arcade arch', 'Shadow sandstone light' if key else 'Shadow sandstone', v, f)


def leaf_vf(p, nrm, tip, size, thick=.006):
    nrm = Vector(nrm).normalized()
    tip = Vector(tip)
    tip = tip - nrm * tip.dot(nrm)
    if tip.length < 1e-4:
        tip = nrm.orthogonal()
    tip.normalize()
    side = nrm.cross(tip)
    p = Vector(p)
    return prism_vf([tuple(p + (side * u + tip * w) * size) for u, w in LEAF], tuple(nrm * thick))


def put_ivy(B, name, v, f, side=None):
    """side=(s, lim): shift the piece outward so every vertex keeps s*x >= lim (keep-clear)."""
    if side:
        s, lim = side
        lo = min(s * q[0] for q in v)
        if lo < lim:
            d = s * (lim - lo)
            v = [(q[0] + d, q[1], q[2]) for q in v]
    B.add(name, 'Shadow ivy', v, f)


def strand(B, name, rng, anchor, nrm, down, length, leaves, lateral, side=None, tilt=.3):
    anchor, nrm, down = Vector(anchor), Vector(nrm).normalized(), Vector(down).normalized()
    across = nrm.cross(down).normalized()
    steps = max(3, int(length / .1))
    ph = rng.uniform(0, math.tau)

    def wig(t):
        return across * (math.sin(t * 8.5 + ph) * lateral * .45)
    pts = [tuple(anchor + down * (length * i / steps) + wig(i / steps) + nrm * .012) for i in range(steps + 1)]
    put_ivy(B, name, *tube_vf(pts, .01, 5), side=side)
    for _ in range(leaves):
        t = rng.random()
        base = anchor + down * (length * t) + wig(t) + across * (rng.uniform(-lateral, lateral) * .8) + nrm * rng.uniform(.008, .022)
        n2 = nrm + Vector((rng.uniform(-tilt, tilt), rng.uniform(-tilt, tilt), rng.uniform(-tilt, tilt)))
        tip = down * .8 + across * rng.uniform(-1, 1)
        put_ivy(B, name, *leaf_vf(base, n2, tip, rng.uniform(.065, .11) * (1 - .3 * t)), side=side)


def arch_ivy(B, rng, s, cx, cy, cz, r_in, r_out, depth, lim):
    x_in, x_out = abs(cx) - depth / 2, abs(cx) + depth / 2
    side = (s, lim)
    for _ in range(16):
        a = math.pi / 2 + rng.choice((-1, 1)) * rng.uniform(.14, .62)
        r = r_out + .01
        p = (s * rng.uniform(x_in + .03, x_out - .03), cy + r * math.sin(a), cz + r * math.cos(a))
        nrm = (rng.uniform(-.3, .3), math.sin(a), math.cos(a))
        put_ivy(B, 'Arcade ivy', *leaf_vf(p, nrm, (rng.uniform(-1, 1), rng.uniform(-.5, .5), rng.uniform(-1, 1)), rng.uniform(.07, .11)), side=side)
    for _ in range(rng.randint(2, 3)):
        a = math.pi / 2 + rng.uniform(-.6, .6)
        r = rng.uniform(r_in + .04, r_out - .04)
        length = rng.uniform(.6, 1.4)
        strand(B, 'Arcade ivy', rng, (s * x_in, cy + r * math.sin(a), cz + r * math.cos(a)), (-s, 0, 0), (0, -1, 0),
               length, int(length * 20), .07, side, tilt=.15)


def wall_ivy(B, rng, s, z, cap_in, cap_out, cap_top, cap_bottom, wall_in, lim):
    side = (s, lim)
    for _ in range(rng.randint(8, 12)):
        p = (s * rng.uniform(cap_in + .03, cap_out - .04), cap_top + .004, z + rng.uniform(-.5, .5))
        nrm = (rng.uniform(-.25, .25), 1, rng.uniform(-.25, .25))
        put_ivy(B, 'Wall ivy', *leaf_vf(p, nrm, (rng.uniform(-1, 1), 0, rng.uniform(-1, 1)), rng.uniform(.07, .11)), side=side)
    for _ in range(rng.randint(1, 3)):
        length = rng.uniform(.3, cap_bottom - .15)
        strand(B, 'Wall ivy', rng, (s * wall_in, cap_bottom, z + rng.uniform(-.4, .4)), (-s, 0, 0), (0, -1, 0),
               length, max(4, int(length * 18)), .06, side, tilt=.12)


def banner(B, cx, ytop, zface):
    """Navy banner on a tower's -z face: pointed hem, gold trim, crescent over sun, brass rod."""
    zf = zface - .05
    W, H, P = .9, 2.2, .42
    outline = [(-W / 2, 0), (W / 2, 0), (W / 2, P - H), (0, -H), (-W / 2, P - H)]

    def at(pts, z):
        return [(cx + u, ytop + w, z) for u, w in pts]
    B.add('Tower banner', 'Shadow banner cloth', *prism_vf(at(outline, zf), (0, 0, .03)))
    B.add('Tower banner trim', 'Shadow banner emblem',
          *ring_vf(at(inset(outline, .012), zf + .002), at(inset(outline, .06), zf + .002), (0, 0, -.008)))
    B.add('Tower banner emblem', 'Shadow banner emblem', *prism_vf(at([(u, w - .62) for u, w in crescent_pts()], zf + .003), (0, 0, -.014)))
    B.add('Tower banner emblem', 'Shadow banner emblem', *prism_vf(at(star_pts(0, -1.3, .2, .125), zf + .003), (0, 0, -.012)))
    B.add('Tower banner emblem', 'Shadow banner emblem', *prism_vf(at(disc_pts(0, -1.3, .085), zf + .003), (0, 0, -.02)))
    B.add('Tower banner rod', 'Shadow brass', *cyl_vf((cx - .52, ytop + .01, zface - .035), (cx + .52, ytop + .01, zface - .035), .022, 8))
    for u in (-.54, .54):
        B.add('Tower banner rod', 'Shadow gold', *slab_vf(cx + u - .03, cx + u + .03, ytop - .02, ytop + .04, zface - .065, zface - .005, .01))
    for u in (-.3, .3):
        B.add('Tower banner rod', 'Shadow brass', *slab_vf(cx + u - .02, cx + u + .02, ytop - .01, ytop + .03, zface - .04, zface + .01))


def tower(B, rng, tx, tz):
    """Corner tower 0.65 x 6.8 x 0.65 with gold cap (0.95 x 0.25, centre y 6.65), finial, banner and ivy."""
    B.add('Tower plinth', 'Shadow sandstone', *slab_vf(tx - .41, tx + .41, -.1, .38, tz - .41, tz + .41, .03))
    ys = [.38 + (6.8 - .38) * k / 12 for k in range(13)]
    for a, b in zip(ys, ys[1:]):
        B.add('Tower shaft', 'Shadow sandstone', *slab_vf(tx - .325, tx + .325, a, b, tz - .325, tz + .325, .015))
    B.add('Tower band', 'Shadow sandstone light', *slab_vf(tx - .365, tx + .365, 3.24, 3.36, tz - .365, tz + .365, .02))
    B.add('Tower cornice', 'Shadow sandstone light', *slab_vf(tx - .39, tx + .39, 6.385, 6.525, tz - .39, tz + .39, .02))
    B.add('Tower cap', 'Shadow gold', *slab_vf(tx - .475, tx + .475, 6.525, 6.775, tz - .475, tz + .475, .03))
    B.add('Tower cap', 'Shadow gold', *slab_vf(tx - .35, tx + .35, 6.775, 6.83, tz - .35, tz + .35))
    B.add('Tower finial', 'Shadow gold', *pyramid_vf(tx, 6.83, tz, .22, 7.3))
    banner(B, tx, 5.95, tz - .325)
    s = 1 if tx > 0 else -1
    strand(B, 'Tower ivy', rng, (tx - s * .325, .38, tz + rng.uniform(-.12, .12)), (-s, 0, 0), (0, 1, 0),
           rng.uniform(2.3, 3.1), 34, .16)
    strand(B, 'Tower ivy', rng, (tx + rng.uniform(-.15, .15), .38, tz - .325), (0, 0, -1), (0, 1, 0),
           rng.uniform(1.6, 2.7), 24, .16)


# ---------- rooms ----------

def build_room1():
    rng = random.Random(7)
    B = Builder()
    floor(B, -7, 7, -8, 11, 'Shadow floor warm', 'Shadow floor warm alt')
    B.add('Floor threshold', 'Shadow sandstone light', *slab_vf(-2.4, 2.4, -.12, 0, -8.3, -8.0, .012))
    B.add('Floor threshold', 'Shadow sandstone light', *slab_vf(-2.9, 2.9, -.12, 0, 11.0, 11.35, .012))
    for zs in (-2.8, 8.8):
        B.add('Floor brass inlay', 'Shadow brass', *slab_vf(-7, 7, -.03, .003, zs - .04, zs + .04))
    B.add('Floor brass inlay', 'Shadow brass', *washer_vf(-3.6, -5.6, .90, .96, -.03, .003, 72))
    ZC = (-2.9, 1.0, 4.9, 8.8)
    for s in (-1, 1):
        B.add('Wall side', 'Shadow sandstone', *slab_vf(*xs(s, 6.995, 7.545), -.2, 1.05, -8.2, 11.2))
        B.add('Wall cap', 'Shadow sandstone light', *slab_vf(*xs(s, 6.965, 7.665), 1.05, 1.21, -8.36, 11.41, .03))
        B.add('Wall end', 'Shadow sandstone', *slab_vf(*xs(s, 2.4, 7.55), -.2, 1.05, -8.3, -7.91))
        B.add('Wall cap', 'Shadow sandstone light', *slab_vf(*xs(s, 2.34, 6.965), 1.05, 1.21, -8.36, -7.91, .03))
        B.add('Wall end', 'Shadow sandstone', *slab_vf(*xs(s, 2.9, 7.55), -.2, 1.05, 10.95, 11.35))
        B.add('Wall cap', 'Shadow sandstone light', *slab_vf(*xs(s, 2.84, 6.965), 1.05, 1.21, 10.91, 11.41, .03))
        for zc in ZC:
            for f in (-1, 1):
                zp = zc + f * 1.68
                B.add('Arcade pier', 'Shadow sandstone', *slab_vf(*xs(s, 6.96, 7.58), -.2, 2.78, zp - .22, zp + .22))
                B.add('Arcade capital', 'Shadow sandstone light', *slab_vf(*xs(s, 6.957, 7.62), 2.78, 2.84, zp - .24, zp + .24))
                B.add('Arcade capital', 'Shadow sandstone light', *slab_vf(*xs(s, 6.955, 7.66), 2.84, 3.0, zp - .26, zp + .26, .02))
            arch(B, s * 7.27, 3.0, zc, 1.53, 1.82, .55, 9)
    for tx in (-6.1, 6.1):
        for tz in (-4.7, 10.7):
            tower(B, rng, tx, tz)
    for s in (-1, 1):
        B.add('Tower beam', 'Shadow bronze dark', *slab_vf(s * 6.1 - .09, s * 6.1 + .09, 6.61, 6.79, -4.7, 10.7))
    B.add('Tower rail', 'Shadow brass light', *ellipse_vf(0, 6.7, 3, 5.4, 6.2, .03, 128, 8))
    for th in (30, -30, 150, 210):
        t = math.radians(th)
        ex, ez = 5.4 * math.cos(t), 3 + 6.2 * math.sin(t)
        s = 1 if ex > 0 else -1
        B.add('Tower strut', 'Shadow brass', *cyl_vf((s * 6.05, 6.7, ez), (ex, 6.7, ez), .022, 8))
        B.add('Tower strut', 'Shadow gold', *slab_vf(ex - .045, ex + .045, 6.655, 6.745, ez - .045, ez + .045))
    for s, zc in rng.sample([(s, zc) for s in (-1, 1) for zc in ZC], 4):
        arch_ivy(B, rng, s, s * 7.27, 3.0, zc, 1.53, 1.82, .55, 6.957)
    for s in (-1, 1):
        for z in rng.sample((-6.3, -1.0, 2.9, 6.8, 10.0), 3):
            wall_ivy(B, rng, s, z + rng.uniform(-.4, .4), 6.965, 7.665, 1.21, 1.05, 6.995, 6.957)
    return B.emit()


def build_room3():
    rng = random.Random(7)
    B = Builder()
    floor(B, -7, 7, 37, 49, 'Shadow floor mist', 'Shadow floor mist alt')
    B.add('Floor threshold', 'Shadow sandstone light', *slab_vf(-2.9, 2.9, -.12, 0, 36.8, 37.0, .012))
    B.add('Floor threshold', 'Shadow sandstone light', *slab_vf(-2.9, 2.9, -.12, 0, 49.0, 49.35, .012))
    ZC = (38.4, 43.0, 47.6)
    for s in (-1, 1):
        B.add('Wall side', 'Shadow sandstone', *slab_vf(*xs(s, 7.0, 7.48), -.2, .85, 36.15, 49.85))
        B.add('Wall cap', 'Shadow sandstone light', *slab_vf(*xs(s, 6.965, 7.55), .85, .99, 36.1, 49.9, .025))
        B.add('Wall end', 'Shadow sandstone', *slab_vf(*xs(s, 2.9, 7.5), -.2, .85, 36.8, 37.2))
        B.add('Wall cap', 'Shadow sandstone light', *slab_vf(*xs(s, 2.86, 6.965), .85, .99, 36.76, 37.24, .025))
        B.add('Wall end', 'Shadow sandstone', *slab_vf(*xs(s, 2.9, 7.5), -.2, .85, 48.95, 49.35))
        B.add('Wall cap', 'Shadow sandstone light', *slab_vf(*xs(s, 2.86, 6.965), .85, .99, 48.91, 49.39, .025))
        for zc in ZC:
            for f in (-1, 1):
                zp = zc + f * 1.995
                B.add('Arcade pier', 'Shadow sandstone', *slab_vf(*xs(s, 6.96, 7.52), -.2, 2.36, zp - .21, zp + .21))
                B.add('Arcade pier cap', 'Shadow gold', *slab_vf(*xs(s, 6.935, 7.56), 2.36, 2.5, zp - .26, zp + .26, .02))
            arch(B, s * 7.24, 2.5, zc, 1.86, 2.13, .5, 11)
    # optical bench: two rails, sleepers, end stops and 15 equal distance ticks
    for dx in (-.32, .32):
        x = -3.4 + dx
        B.add('Bench rail', 'Shadow brass', *slab_vf(x - .0275, x + .0275, -.01, .07, 37.4, 47.5, .008))
        for zc in (37.4, 47.5):
            B.add('Bench rail stop', 'Shadow brass light', *slab_vf(x - .05, x + .05, -.01, .075, zc - .03, zc + .03, .01))
    for k in range(8):
        zt = 37.6 + (47.3 - 37.6) * k / 7
        B.add('Bench tie', 'Shadow bronze dark', *slab_vf(-3.82, -2.98, -.01, .02, zt - .05, zt + .05))
    for k in range(15):
        zt = 38.2 + 1.5 + .5 * k
        B.add('Bench tick', 'Shadow brass light', *slab_vf(-2.82, -2.58, -.005, .018, zt - .0175, zt + .0175))
    # screen structure behind Unity's 4x4 screen face at z 47.8 (moved from 48.2: the backing met the z=49 gate post)
    B.add('Screen backing', 'Shadow sandstone', *slab_vf(-5.55, -1.25, .65, 4.95, 47.90, 48.08))

    def sq(h):
        return [(-3.4 - h, 2.8 - h, 47.8), (-3.4 + h, 2.8 - h, 47.8), (-3.4 + h, 2.8 + h, 47.8), (-3.4 - h, 2.8 + h, 47.8)]
    B.add('Screen frame', 'Shadow gold', *ring_vf(sq(2.22), sq(2.09), (0, 0, .16)))
    for x in (-5.2, -1.6):
        B.add('Screen foot', 'Shadow sandstone', *slab_vf(x - .13, x + .13, -.01, 1.0, 47.66, 48.08, .02))
    half = [(-3.4 + .45 * math.cos(math.pi * k / 16), 4.95 + .45 * math.sin(math.pi * k / 16), 47.90) for k in range(17)]
    B.add('Screen crest', 'Shadow sandstone light', *prism_vf(half, (0, 0, .16)))
    B.add('Screen crest', 'Shadow gold', *prism_vf([(u, w, 47.904) for u, w in star_pts(-3.4, 5.2, .17, .11)], (0, 0, -.014)))
    B.add('Screen crest', 'Shadow gold', *prism_vf([(u, w, 47.904) for u, w in disc_pts(-3.4, 5.2, .075)], (0, 0, -.022)))
    for s, zc in rng.sample([(s, zc) for s in (-1, 1) for zc in ZC], 3):
        arch_ivy(B, rng, s, s * 7.24, 2.5, zc, 1.86, 2.13, .5, 6.91)
    for s in (-1, 1):
        for z in rng.sample((38.0, 41.0, 44.5, 47.0), 2):
            wall_ivy(B, rng, s, z + rng.uniform(-.4, .4), 6.965, 7.55, .99, .85, 7.0, 6.91)
    return B.emit()


ROOMS = {
    'room1': dict(name='shadow-room1-v01', build=build_room1, budget=55000, clear=(-6.95, 6.95, -7.9, 10.9, .02),
                  exempt=('Tower',), png='arch-room1.png', eye=(0, 3.4, -13), target=(0, 1.8, 4), lamp=(0, 4.8, -3.2)),
    'room3': dict(name='shadow-room3-v01', build=build_room3, budget=45000, clear=(-6.9, 6.9, 37.25, 47.55, .08),
                  exempt=(), png='arch-room3.png', eye=(2.5, 3.2, 35.5), target=(-2, 1.8, 45), lamp=(-3.4, 2.8, 38.2)),
}


def reset():
    c.clear()
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)


def keep_clear(tag, x0, x1, z0, z1, ymax, exempt=()):
    """Count evaluated vertices with y > ymax inside x[x0,x1] z[z0,z1] (inclusive), skipping exempt name prefixes."""
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    total, skipped, bad = 0, 0, {}
    for ob in bpy.context.scene.objects:
        if ob.type != 'MESH':
            continue
        ev = ob.evaluated_get(deps)
        geo = ev.to_mesh()
        mw = ev.matrix_world
        for v in geo.vertices:
            g = c._game(mw @ v.co, (0, 0, 0))
            if g[1] > ymax and x0 <= g[0] <= x1 and z0 <= g[2] <= z1:
                if exempt and ob.name.startswith(exempt):
                    skipped += 1
                else:
                    total += 1
                    bad[ob.name] = bad.get(ob.name, 0) + 1
        ev.to_mesh_clear()
    print('SHADOW_CLEAR', tag, total, flush=True)
    if exempt:
        print('SHADOW_CLEAR_EXEMPT', tag, exempt, skipped, 'vertices (towers with their caps, banners, ivy, beams, rail, struts)', flush=True)
    for k, n in sorted(bad.items()):
        print('  SHADOW_CLEAR_OBJECT', tag, k, n, flush=True)
    return total


def export_room(key):
    r = ROOMS[key]
    reset()
    obs = r['build']()
    tris = 0
    for ob in obs:
        ob.data.calc_loop_triangles()
        tris += len(ob.data.loop_triangles)
    print('SHADOW_TRIS', r['name'], tris, 'budget', r['budget'], flush=True)
    print('SHADOW_MANIFOLD', r['name'], c.non_manifold_edges(obs), 'non-manifold edges', flush=True)
    clear = keep_clear(r['name'], *r['clear'], exempt=r['exempt'])
    if clear or tris > r['budget']:
        raise RuntimeError(f"{r['name']}: keep-clear {clear} / triangles {tris} over budget {r['budget']}")
    c.export(r['name'], smooth=SMOOTH)
    backup = os.path.join(c.ART, r['name'] + '.blend1')
    if os.path.exists(backup):
        os.remove(backup)


def render_room(key):
    r = ROOMS[key]
    reset()
    r['build']()
    c.preview(os.path.join(c.ART, r['png']), r['eye'], r['target'], res=(1400, 875), samples=16,
              lights=[dict(type='SUN', energy=.6, color=(.75, .82, 1), pos=(20, 40, -10), target=(0, 0, 20)),
                      dict(type='POINT', energy=300, color=(1, .85, .6), pos=r['lamp'])])


def main():
    start = time.time()
    mode = ARGS[0] if ARGS else 'all'
    if mode in ('all', '--export'):
        for key in ('room1', 'room3'):
            export_room(key)
    if mode in ('all', '--render'):
        for key in (ARGS[1:] or ['room1', 'room3']):
            render_room(key)
    print('SHADOW_TIME', round(time.time() - start, 1), 's', flush=True)


main()
