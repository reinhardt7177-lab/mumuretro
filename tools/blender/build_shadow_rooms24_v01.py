"""Shadow shrine v01: static architecture for room 2 (shade court) and the sanctum.

Blender 5.2, background:
  blender --background --factory-startup --python tools/blender/build_shadow_rooms24_v01.py -- [--export] [--render [room2] [sanctum]]
No arguments: export both files, then rebuild both and render the previews.
Writes art/engine-transfer/model-data/ShadowTemple/shadow-room2-v01.json, shadow-sanctum-v01.json
and art/shadow-temple/v01/arch-room2.png, arch-sanctum.png.
Game metres through vec(): x right, y up (walkable floor top 0), z forward. Every part is a closed solid.
"""
import bpy, sys, os, math, random
bpy.ops.wm.read_factory_settings(use_empty=True)
sys.dont_write_bytecode = True
sys.path.insert(0, r'D:\mumumetro\tools\blender')
import shadow_temple_common as c  # noqa: E402
from mathutils import Vector  # noqa: E402

S, SL, SH = 'Shadow sandstone', 'Shadow sandstone light', 'Shadow sandstone shade'
B, BL, D, IR, GD = 'Shadow brass', 'Shadow brass light', 'Shadow bronze dark', 'Shadow iron dark', 'Shadow gold'
ZONE = None  # keep-clear box (x0, x1, z0, z1); procedural leaves that would enter it are dropped
BOX = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (0, 4, 7, 3)]


class Geo:
    """Closed solids collected per (group, material); one mesh object per key."""
    def __init__(self):
        self.parts = {}

    def add(self, g, m, verts, faces):
        v, f = self.parts.setdefault((g, m), ([], []))
        o = len(v)
        v.extend(tuple(p) for p in verts)
        f.extend(tuple(i + o for i in face) for face in faces)

    def build(self):
        objs = [c.mesh(f'{g} {m}', v, f, c.mat(m)) for (g, m), (v, f) in self.parts.items()]
        self.parts = {}
        return objs


G = Geo()


def in_zone(p):
    return ZONE is not None and p[1] > .02 and ZONE[0] <= p[0] <= ZONE[1] and ZONE[2] <= p[2] <= ZONE[3]


def abox(g, m, x0, x1, y0, y1, z0, z1):
    """Axis-aligned box from game-coordinate extents (x and z may be given in any order)."""
    x0, x1, z0, z1 = min(x0, x1), max(x0, x1), min(z0, z1), max(z0, z1)
    G.add(g, m, [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                 (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], BOX)


def obox(g, m, ctr, u, w, hu, hy, hw):
    """Box centred at ctr with horizontal unit axes u, w given as (x, z) and half sizes hu, hy, hw."""
    v = []
    for sw in (-1, 1):
        for su, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            v.append((ctr[0] + su * hu * u[0] + sw * hw * w[0], ctr[1] + sy * hy,
                      ctr[2] + su * hu * u[1] + sw * hw * w[1]))
    G.add(g, m, v, BOX)


def frustum(g, m, cx, cz, y0, y1, w0, w1):
    """Square frustum: half width w0 at y0 to w1 at y1."""
    G.add(g, m, [(cx - w0, y0, cz - w0), (cx + w0, y0, cz - w0), (cx + w1, y1, cz - w1), (cx - w1, y1, cz - w1),
                 (cx - w0, y0, cz + w0), (cx + w0, y0, cz + w0), (cx + w1, y1, cz + w1), (cx - w1, y1, cz + w1)], BOX)


def to3(axis, uv, a):
    """Plane point (u, v) at depth a. axis 'x': plane (z, y); 'z': plane (x, y); 'y': plane (x, z)."""
    u, v = uv
    return (a, v, u) if axis == 'x' else (u, v, a) if axis == 'z' else (u, a, v)


def prism(g, m, pts, axis, a0, a1):
    n = len(pts)
    v = [to3(axis, p, a0) for p in pts] + [to3(axis, p, a1) for p in pts]
    G.add(g, m, v, [tuple(range(n))[::-1], tuple(range(n, 2 * n))] +
          [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)])


def strip(g, m, P, Q, axis, a0, a1, closed=False):
    """Bent box between point rows P and Q (quads P_i P_i+1 Q_i+1 Q_i), extruded from depth a0 to a1."""
    n = len(P)
    v = [to3(axis, p, a) for a in (a0, a1) for p in list(P) + list(Q)]
    pf, qf, pb, qb = 0, n, 2 * n, 3 * n
    f = []
    for i in range(n if closed else n - 1):
        j = (i + 1) % n
        f += [(pf + i, pf + j, qf + j, qf + i), (pb + i, qb + i, qb + j, pb + j),
              (pf + i, pb + i, pb + j, pf + j), (qf + i, qf + j, qb + j, qb + i)]
    if not closed:
        f += [(pf, qf, qb, pb), (pf + n - 1, pb + n - 1, qb + n - 1, qf + n - 1)]
    G.add(g, m, v, f)


def arcpts(cu, cv, r, t0, t1, n):
    return [(cu + r * math.cos(t0 + (t1 - t0) * i / n), cv + r * math.sin(t0 + (t1 - t0) * i / n)) for i in range(n + 1)]


def circle(cu, cv, r, n):
    return [(cu + r * math.cos(math.tau * i / n), cv + r * math.sin(math.tau * i / n)) for i in range(n)]


def annulus(g, m, axis, cu, cv, r0, r1, a0, a1, n=64):
    strip(g, m, circle(cu, cv, r0, n), circle(cu, cv, r1, n), axis, a0, a1, closed=True)


def arch(g, m, axis, cu, spring, ri, ro, a0, a1, n=11, sub=2, gap=.006, key=None):
    """Semicircular ring of n voussoirs; key = (extra radius, extra depth each side) for the keystone."""
    for k in range(n):
        t0 = math.pi * k / n + (gap if k else 0)
        t1 = math.pi * (k + 1) / n - (gap if k < n - 1 else 0)
        r1, b0, b1 = ro, a0, a1
        if key and k == n // 2:
            r1, b0, b1 = ro + key[0], a0 - key[1], a1 + key[1]
        strip(g, m, arcpts(cu, spring, ri, t0, t1, sub), arcpts(cu, spring, r1, t0, t1, sub), axis, b0, b1)


def arch_fill(g, m, axis, cu, spring, r, u0, u1, top, a0, a1, n=24):
    """Spandrel solid between a semicircular extrados (radius r) and the rectangle [u0, u1] x [spring, top]."""
    h = top - spring
    corners = [math.atan2(h, u1 - cu), math.atan2(h, u0 - cu)]
    angs = sorted([math.pi * i / n for i in range(n + 1)
                   if min(abs(math.pi * i / n - q) for q in corners) > 1e-3] + corners)
    P, Q = [], []
    for t in angs:
        dx, dy = math.cos(t), math.sin(t)
        s = [h / dy] if dy > 1e-9 else []
        s += [(u1 - cu) / dx] if dx > 1e-9 else [(u0 - cu) / dx] if dx < -1e-9 else []
        s = min(s)
        P.append((cu + r * dx, spring + r * dy))
        Q.append((cu + s * dx, spring + s * dy))
    strip(g, m, P, Q, axis, a0, a1)


def rod(g, m, a, b, r, n=8):
    """Capped cylinder between game points a and b."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    u = d.cross(Vector((0, 1, 0)) if abs(d.y) < .9 else Vector((1, 0, 0))).normalized()
    w = d.cross(u)
    ring = [u * (r * math.cos(math.tau * i / n)) + w * (r * math.sin(math.tau * i / n)) for i in range(n)]
    v = [tuple(a + q) for q in ring] + [tuple(b + q) for q in ring]
    G.add(g, m, v, [tuple(range(n))[::-1], tuple(range(n, 2 * n))] +
          [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)])


def sphere(g, m, ctr, r, seg=10, rings=6):
    cx, cy, cz = ctr
    v = [(cx, cy + r, cz)]
    for i in range(1, rings):
        ph = math.pi * i / rings
        v += [(cx + r * math.sin(ph) * math.cos(math.tau * j / seg), cy + r * math.cos(ph),
               cz + r * math.sin(ph) * math.sin(math.tau * j / seg)) for j in range(seg)]
    v.append((cx, cy - r, cz))
    last, bot = 1 + (rings - 2) * seg, len(v) - 1
    f = [(0, 1 + (j + 1) % seg, 1 + j) for j in range(seg)]
    for i in range(rings - 2):
        a0, a1 = 1 + i * seg, 1 + (i + 1) * seg
        f += [(a0 + j, a0 + (j + 1) % seg, a1 + (j + 1) % seg, a1 + j) for j in range(seg)]
    f += [(last + j, last + (j + 1) % seg, bot) for j in range(seg)]
    G.add(g, m, v, f)


def leaf(g, p, n, d, L, W, T=.012):
    """Closed diamond ivy leaf (5 vertices, 6 triangles): base p, tip along d, face normal n."""
    p, n, d = Vector(p), Vector(n).normalized(), Vector(d)
    d = d - n * d.dot(n)
    if d.length < 1e-4:
        return
    d.normalize()
    sd = n.cross(d)
    mid = p + d * (L * .45)
    v = [tuple(q) for q in (p, mid + sd * (W / 2), p + d * L, mid - sd * (W / 2), mid + n * T)]
    if any(in_zone(q) for q in v):
        return
    G.add(g, 'Shadow ivy', v, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (0, 3, 2, 1)])


def torus(name, m, ctr, R, r, maj=128, mnr=8):
    """Closed brass torus lying in the horizontal plane."""
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=maj, minor_segments=mnr,
                                     location=c.vec(ctr))
    o = bpy.context.object
    o.name = name
    o.data.materials.append(c.mat(m))
    bpy.ops.object.shade_smooth()
    return o



# ---------------------------------------------------------------- decoration
def crescent(g, m, axis, cu, cv, R, a0, a1, k=.42, n=12):
    """Bowl crescent (thick side down); the inner edge is the half-ellipse terminator."""
    ts = [-math.pi / 2 + .14 + (math.pi - .28) * i / n for i in range(n + 1)]
    strip(g, m, [(cu + R * math.sin(t), cv - k * R * math.cos(t)) for t in ts],
          [(cu + R * math.sin(t), cv - R * math.cos(t)) for t in ts], axis, a0, a1)


def sun(g, m, axis, cu, cv, r, a0, a1, rays=12):
    prism(g, m, circle(cu, cv, r, 16), axis, a0, a1)
    for i in range(rays):
        t, hw = math.tau * i / rays + math.pi / 2, math.pi / rays * .55
        L = r * (2.1 if i % 2 == 0 else 1.6)
        prism(g, m, [(cu + r * .85 * math.cos(t - hw), cv + r * .85 * math.sin(t - hw)),
                     (cu + L * math.cos(t), cv + L * math.sin(t)),
                     (cu + r * .85 * math.cos(t + hw), cv + r * .85 * math.sin(t + hw))], axis, a0 + .002, a1 - .002)


def banner(g, axis, cu, top, w, length, a, sgn, back):
    """Navy banner with gold crescent and sun on a brass rod.
    a = room-facing plane of the cloth, sgn = direction away from the room, back = wall face behind the rod."""
    def sp(d0, d1):
        return sorted((a + sgn * d0, a + sgn * d1))
    E = 'Shadow banner emblem'
    bot, tip = top - length, .22 * w + .12
    prism(g, 'Shadow banner cloth', [(cu - w / 2, top), (cu + w / 2, top), (cu + w / 2, bot + tip), (cu, bot),
                                     (cu - w / 2, bot + tip)], axis, *sp(0, .02))
    em = sp(-.014, .004)
    i = w / 2 - .035
    prism(g, E, [(cu - i, top - .14), (cu + i, top - .14), (cu + i, top - .1), (cu - i, top - .1)], axis, *em)
    for sx in (-1, 1):
        prism(g, E, [(cu + sx * i, bot + tip + .05), (cu, bot + .06), (cu, bot + .095), (cu + sx * i, bot + tip + .085)],
              axis, em[0] + (.002 if sx > 0 else 0), em[1] - (.002 if sx > 0 else 0))
    crescent(g, E, axis, cu, top - .2 * length - .05, .28 * w, *em)
    sun(g, E, axis, cu, top - .5 * length, .14 * w, *em)
    yd = bot + tip + .32
    prism(g, E, [(cu, yd - .09), (cu + .06, yd), (cu, yd + .09), (cu - .06, yd)], axis, *em)
    ra, yr = a + sgn * .01, top + .03
    rod(g, B, to3(axis, (cu - w / 2 - .07, yr), ra), to3(axis, (cu + w / 2 + .07, yr), ra), .02)
    for sx in (-1, 1):
        sphere(g, BL, to3(axis, (cu + sx * (w / 2 + .09), yr), ra), .035, 8, 5)
        uu = cu + sx * (w / 2 + .02)
        pa, pb = to3(axis, (uu - .015, yr - .015), ra), to3(axis, (uu + .015, yr + .015), back + sgn * .01)
        abox(g, D, pa[0], pb[0], pa[1], pb[1], pa[2], pb[2])


def lantern(g, cx, cy, cz, s=1.0):
    """Hanging lantern centred at (cx, cy, cz): +-0.12 s horizontally, -0.19 s .. +0.36 s vertically."""
    def q(h, y0, y1, m, ox=0, oz=0):
        abox(g, m, cx + (ox - h) * s, cx + (ox + h) * s, cy + y0 * s, cy + y1 * s, cz + (oz - h) * s, cz + (oz + h) * s)
    q(.1, -.19, -.16, D)
    q(.08, -.16, -.13, B)
    q(.065, -.13, .13, 'Shadow lamp glow')
    for ox in (-.085, .085):
        for oz in (-.085, .085):
            q(.012, -.16, .13, B, ox, oz)
    q(.11, .13, .16, B)
    frustum(g, D, cx, cz, cy + .16 * s, cy + .3 * s, .12 * s, .02 * s)
    sphere(g, B, (cx, cy + .33 * s, cz), .03 * s, 8, 5)


def ashlar(rng, courses, u0, u1, put, skip=None):
    """Running-bond blocks between u0 and u1; put(a, b, y0, y1) builds one block."""
    for y0, y1 in courses:
        u = u0 - rng.uniform(0, .7)
        while u < u1:
            L = rng.uniform(.8, 1.5)
            a, b = max(u, u0), min(u + L, u1)
            u += L + .025
            pieces = [(a, b)]
            if skip and a < skip[1] and b > skip[0]:
                pieces = [(a, min(b, skip[0])), (max(a, skip[1]), b)]
            for pa, pb in pieces:
                if pb - pa > .12:
                    put(pa, pb, y0, y1)


def ivy_strand(g, rng, axis, u, top, length, face, sgn):
    """Hanging ivy in front of a wall; face(y) = room-facing surface depth, sgn = direction away from the room."""
    steps, ph = max(3, int(length / .055)), rng.random() * math.tau
    for i in range(steps):
        uu, y = u + .08 * math.sin(ph + i * .23), top - i * .055
        spread = .04 + .12 * min(1, i / 6) * (1 - .6 * i / steps)
        for _ in range(2):
            ou, oy = uu + rng.uniform(-spread, spread), y + rng.uniform(-.03, .03)
            p = to3(axis, (ou, oy), face(oy) - sgn * rng.uniform(.02, .055))
            n = to3(axis, (rng.uniform(-.4, .4), rng.uniform(-.1, .6)), -sgn)
            d = to3(axis, (rng.uniform(-.9, .9), rng.uniform(-1, .3)), 0)
            L = rng.uniform(.065, .11)
            leaf(g, p, n, d, L, L * .72)


def ivy_clump(g, rng, cx, cy, cz, r, count):
    """Leaves lying on a horizontal wall cap."""
    for _ in range(count):
        a, rr, b = rng.uniform(0, math.tau), r * math.sqrt(rng.random()), rng.uniform(0, math.tau)
        L = rng.uniform(.06, .1)
        leaf(g, (cx + rr * math.cos(a), cy + rng.uniform(.004, .03), cz + rr * math.sin(a)),
             (rng.uniform(-.3, .3), 1, rng.uniform(-.3, .3)), (math.cos(b), 0, math.sin(b)), L, L * .72)



# ---------------------------------------------------------------- room 2
def build_room2():
    """shadow-room2-v01: slate court x[-9, 9] z[17, 31]; tall arcades stand on the 1.75 m side walls."""
    global ZONE
    ZONE = (-8.95, 8.95, 17.35, 30.65)
    rng = random.Random(11)
    gf, gw, ga, gd, gi = 'Room2 floor', 'Room2 wall', 'Room2 arcade', 'Room2 decor', 'Room2 ivy'
    abox(gf, 'Shadow grout', -9, 9, -.4, -.012, 17, 31)
    for i in range(9):
        for j in range(7):
            x0, z0 = -9 + 2 * i, 17 + 2 * j
            m = 'Shadow floor slate alt' if rng.random() < .45 else 'Shadow floor slate'
            abox(gf, m, x0 + .02, x0 + 1.98, -.09, 0, z0 + .02, z0 + 1.98)
    courses = [(0, .57), (.59, 1.16), (1.18, 1.75)]
    # side walls x = +-9.3 (0.6 thick, 1.75 tall): core, dark joint backer, proud ashlar, cap
    for s in (-1, 1):
        for z0, z1 in ([(17, 31)] if s > 0 else [(17, 23.55), (24.45, 31)]):
            abox(gw, S, s * 9.04, s * 9.6, -.4, 1.75, z0, z1)
            abox(gw, SH, s * 9.02, s * 9.04, -.4, 1.75, z0, z1)
        abox(gw, SL, s * 8.965, s * 9.64, 1.75, 1.87, 16.67, 31.33)
        ashlar(rng, courses, 17.3, 30.7, lambda a, b, y0, y1, s=s: abox(gw, S, s * 8.995, s * 9.1, y0, y1, a, b),
               skip=(23.4, 24.6) if s < 0 else None)
    # end walls z = 17.0 / 31.0 spanning |x| 2.65..9.6, with door jambs
    for zc, inner, sg in ((17.0, 17.3, -1), (31.0, 30.7, 1)):
        for s in (-1, 1):
            abox(gw, S, s * 2.7, s * 9.6, -.4, 1.75, inner + sg * .04, zc + sg * .3)
            abox(gw, SH, s * 3.2, s * 9.02, -.4, 1.75, inner + sg * .02, inner + sg * .04)
            abox(gw, SL, s * 2.7, s * 9.64, 1.75, 1.87, zc - .33, zc + .33)
            ashlar(rng, courses, 3.2, 9.0,
                   lambda a, b, y0, y1, s=s, inner=inner, sg=sg: abox(gw, S, s * a, s * b, y0, y1, inner - sg * .01, inner + sg * .1))
            abox(gw, S, s * 2.65, s * 3.2, -.4, 2.62, zc - .28, zc + .28)
            abox(gw, SL, s * 2.61, s * 3.24, 2.62, 2.76, zc - .32, zc + .32)
            frustum(gw, SL, s * 2.925, zc, 2.76, 2.98, .25, .04)
            sphere(gw, B, (s * 2.925, 3.03, zc), .06, 8, 5)
    # arcades: piers on the wall caps, voussoir arches (springing 3.15, r 1.55..1.85), lintel 5.1, crown moulding
    piers = [(16.7, 17.45), (20.55, 21.45), (24.55, 25.45), (28.55, 31.3)]
    spans = {19: (16.7, 21), 23: (21, 25), 27: (25, 28.9)}
    for s in (-1, 1):
        def X(a, b, s=s):
            return sorted((s * a, s * b))
        for z0, z1 in piers:
            abox(ga, SL, *X(9.18, 9.76), 1.87, 2.0, z0 - .05, z1 + .05)
            abox(ga, S, *X(9.22, 9.72), 2.0, 3.0, z0, z1)
            abox(ga, SL, *X(9.17, 9.77), 3.0, 3.15, z0 - .06, z1 + .06)
        abox(ga, S, *X(9.22, 9.72), 3.15, 5.1, 28.55, 31.3)
        for zc, (u0, u1) in spans.items():
            arch(ga, SL, 'x', zc, 3.15, 1.55, 1.85, *X(9.16, 9.68), key=(.1, .04))
            arch_fill(ga, S, 'x', zc, 3.15, 1.84, u0, u1, 5.1, *X(9.26, 9.6))
        abox(ga, SL, *X(9.12, 9.74), 5.1, 5.4, 16.7, 31.3)
        for k in range(66):
            abox(ga, SL, *X(9.06, 9.12), 5.3, 5.4, 16.8 + .22 * k, 16.9 + .22 * k)
        abox(ga, SL, *X(9.0, 9.84), 5.4, 5.56, 16.64, 31.36)
        abox(ga, S, *X(9.04, 9.8), 5.56, 5.66, 16.66, 31.34)
    # stone niche in the west wall at z = 24
    abox(gw, SH, -9.6, -9.32, -.4, 1.75, 23.55, 24.45)
    abox(gw, S, -9.32, -9.04, -.4, .34, 23.55, 24.45)
    abox(gw, SL, -9.33, -8.98, .34, .42, 23.45, 24.55)
    arch_fill(gw, S, 'x', 24, 1.05, .45, 23.4, 24.6, 1.75, -9.32, -9.04, n=12)
    arch(gw, SL, 'x', 24, 1.05, .45, .58, -9.06, -8.975, n=7)
    for z0, z1 in ((23.42, 23.55), (24.45, 24.58)):
        abox(gw, SL, -9.06, -8.975, .42, 1.05, z0, z1)
    sun(gd, 'Shadow banner emblem', 'x', 24, 1.02, .09, -9.325, -9.305)
    rod(gd, B, (-9.17, .42, 24), (-9.17, .47, 24), .06, 10)
    rod(gd, B, (-9.17, .47, 24), (-9.17, .53, 24), .12, 12)
    # banners on the z=21 piers and the end blocks, wall lanterns on the z=25 piers
    for s in (-1, 1):
        banner(gd, 'x', 21, 5.14, .62, 2.55, s * 9.06, s, s * 9.12)
        banner(gd, 'x', 29.6, 5.14, .86, 2.85, s * 9.06, s, s * 9.12)
        lantern(gd, s * 9.09, 2.52, 25)
        abox(gd, D, s * 9.09, s * 9.222, 2.88, 2.93, 24.985, 25.015)
        abox(gd, D, s * 9.195, s * 9.222, 2.7, 2.98, 24.93, 25.07)
        rod(gd, D, (s * 9.2, 2.74, 25), (s * 9.13, 2.885, 25), .012, 6)
    # ivy hanging under the crown moulding and lying on the wall caps
    for s in (-1, 1):
        for k in range(9):
            z = rng.uniform(16.9, 31.1)
            if min(abs(z - q) for q in (21, 25, 29.6)) < .55:
                continue
            ivy_strand(gi, rng, 'x', z, 5.36, min(rng.uniform(.7, 2.6), 3.2),
                       lambda y, s=s: s * (9.12 if y > 5.1 else 9.16), s)
        for k in range(4):
            ivy_clump(gi, rng, s * 9.3, 1.87, rng.uniform(17.8, 30.2), .3, 26)
    for x in (-6.2, 4.8):
        ivy_clump(gi, rng, x, 1.87, 31.0, .28, 24)



# ---------------------------------------------------------------- sanctum
def build_sanctum():
    """shadow-sanctum-v01: x[-11, 11] z[55, 71]; floor disc, side and rear arcades, rear posts, lamp orbit rail."""
    global ZONE
    ZONE = (-10.95, 10.95, 55.25, 70.95)
    rng = random.Random(11)
    gf, gw, ga, gd, gi = 'Sanctum floor', 'Sanctum wall', 'Sanctum arcade', 'Sanctum decor', 'Sanctum ivy'
    gp, gr = 'Sanctum rear post', 'Sanctum rail'
    R, A = 'Shadow floor sanctum rim', 'Shadow floor sanctum'
    abox(gf, 'Shadow grout', -11, 11, -.4, -.012, 55, 71)
    for i in range(11):
        for j in range(8):
            x0, z0 = -11 + 2 * i, 55 + 2 * j
            if all(math.hypot(x, z - 63) < 7.2 for x in (x0, x0 + 2) for z in (z0, z0 + 2)):
                continue  # fully under the disc
            accent = ((i in (0, 10) or j in (0, 7)) and (i + j) % 2 == 0) or (i == 5 and j == 0)
            abox(gf, A if accent else R, x0 + .02, x0 + 1.98, -.09, 0, z0 + .02, z0 + 1.98)
    prism(gf, A, circle(0, 63, 7.25, 64), 'y', -.05, .004)          # one 64-sided disc slab
    annulus(gf, B, 'y', 0, 63, 7.25, 7.32, -.05, .004, 64)          # flush brass ring
    for k in range(8):
        t = math.tau * k / 8
        obox(gf, B, (6.92 * math.cos(t), .01, 63 + 6.92 * math.sin(t)), (math.cos(t), math.sin(t)),
             (-math.sin(t), math.cos(t)), .19, .006, .0325)
    annulus(gf, B, 'y', 0, 59.8, .70, .78, -.03, .0048, 48)         # flush ring (0.8 mm lift avoids z-fighting)
    # walls: side x = +-11.25 (0.5 x 0.9), entry z = 55.0 (|x| 2.65..11.5), rear z = 71.25 full width
    c2 = [(0, .44), (.46, .9)]
    for s in (-1, 1):
        abox(gw, S, s * 11.04, s * 11.5, -.4, .9, 55, 71)
        abox(gw, SH, s * 11.02, s * 11.04, -.4, .9, 55.2, 71)
        abox(gw, SL, s * 10.97, s * 11.54, .9, 1.0, 54.72, 72.24)
        ashlar(rng, c2, 55.24, 71.0, lambda a, b, y0, y1, s=s: abox(gw, S, s * 10.985, s * 11.08, y0, y1, a, b))
        abox(gw, S, s * 2.7, s * 11.5, -.4, .9, 54.75, 55.2)
        abox(gw, SH, s * 3.15, s * 11.02, -.4, .9, 55.2, 55.22)
        abox(gw, SL, s * 2.7, s * 11.54, .9, 1.0, 54.71, 55.245)
        ashlar(rng, c2, 3.15, 11.0, lambda a, b, y0, y1, s=s: abox(gw, S, s * a, s * b, y0, y1, 55.14, 55.24))
        abox(gw, S, s * 2.65, s * 3.15, -.4, 2.2, 54.77, 55.23)
        abox(gw, SL, s * 2.61, s * 3.19, 2.2, 2.34, 54.76, 55.24)
        frustum(gw, SL, s * 2.9, 55.0, 2.34, 2.54, .23, .04)
        sphere(gw, B, (s * 2.9, 2.59, 55.0), .06, 8, 5)
    abox(gw, S, -11.5, 11.5, -.4, .9, 71.04, 71.5)
    abox(gw, SH, -11.02, 11.02, -.4, .9, 71.02, 71.04)
    abox(gw, S, -11.7, 11.7, -.4, .9, 71.5, 72.2)                   # plinth carrying the rear arches
    abox(gw, SL, -11.76, 11.76, .9, 1.0, 70.965, 72.24)
    ashlar(rng, c2, -11.0, 11.0, lambda a, b, y0, y1: abox(gw, S, a, b, y0, y1, 70.96, 71.06))
    # side arcades (springing 3.2, r 1.62..1.95) at z = 57.2, 61.1, 65.0, 68.9
    piers = [(54.75, 55.58), (58.82, 59.48), (62.72, 63.38), (66.62, 67.28), (70.52, 72.2)]
    spans = {57.2: (54.75, 59.15), 61.1: (59.15, 63.05), 65.0: (63.05, 66.95), 68.9: (66.95, 72.2)}
    for s in (-1, 1):
        def X(a, b, s=s):
            return sorted((s * a, s * b))
        for z0, z1 in piers:
            abox(ga, SL, *X(11.06, 11.66), 1.0, 1.12, z0 - .05, z1 + .05)
            abox(ga, S, *X(11.1, 11.62), 1.12, 3.05, z0, z1)
            abox(ga, SL, *X(11.05, 11.68), 3.05, 3.2, z0 - .06, z1 + .06)
        for zc, (u0, u1) in spans.items():
            arch(ga, SL, 'x', zc, 3.2, 1.62, 1.95, *X(11.05, 11.66), key=(.1, .04))
            arch_fill(ga, S, 'x', zc, 3.2, 1.93, u0, u1, 5.25, *X(11.14, 11.58))
        abox(ga, SL, *X(11.04, 11.68), 5.25, 5.55, 54.72, 72.2)
        for k in range(79):
            abox(ga, SL, *X(10.985, 11.04), 5.45, 5.55, 54.8 + .22 * k, 54.9 + .22 * k)
        abox(ga, SL, *X(10.97, 11.76), 5.55, 5.72, 54.66, 72.28)
        abox(ga, S, *X(11.0, 11.72), 5.72, 5.82, 54.68, 72.26)
    # rear arches behind the rear wall
    for x0, x1 in ((-11.7, -9.42), (-6.18, -5.52), (-2.28, -1.62), (1.62, 2.28), (5.52, 6.18), (9.42, 11.7)):
        abox(ga, SL, x0 - .05, x1 + .05, 1.0, 1.12, 71.57, 72.19)
        abox(ga, S, x0, x1, 1.12, 3.05, 71.62, 72.14)
        abox(ga, SL, x0 - .06, x1 + .06, 3.05, 3.2, 71.56, 72.2)
    for xc, u0, u1 in ((-7.8, -11.7, -5.85), (-3.9, -5.85, -1.95), (0, -1.95, 1.95), (3.9, 1.95, 5.85), (7.8, 5.85, 11.7)):
        arch(ga, SL, 'z', xc, 3.2, 1.62, 1.95, 71.57, 72.18, key=(.1, .04))
        arch_fill(ga, S, 'z', xc, 3.2, 1.93, u0, u1, 5.25, 71.66, 72.1)
    abox(ga, SL, -11.7, 11.7, 5.25, 5.55, 71.55, 72.2)
    for k in range(106):
        abox(ga, SL, -11.65 + .22 * k, -11.55 + .22 * k, 5.45, 5.55, 71.49, 71.55)
    abox(ga, SL, -11.76, 11.76, 5.55, 5.72, 71.48, 72.28)
    abox(ga, S, -11.72, 11.72, 5.72, 5.82, 71.5, 72.26)
    # banners on side piers and rear corner blocks
    for s in (-1, 1):
        for zc in (59.15, 66.95):
            banner(gd, 'x', zc, 5.3, .5, 2.5, s * 10.99, s, s * 11.04)
        banner(gd, 'z', s * 10.26, 5.3, .8, 2.9, 71.5, 1, 71.55)
    # rear posts 0.7 x 7.2 x 0.7 at (+-8, 69.9): bands, gold caps, lanterns on the inner faces
    for s in (-1, 1):
        x, z = s * 8, 69.9
        abox(gp, SH, x - .41, x + .41, 0, .26, z - .41, z + .41)
        abox(gp, SL, x - .38, x + .38, .26, .34, z - .38, z + .38)
        abox(gp, S, x - .35, x + .35, 0, 7.2, z - .35, z + .35)
        for y in (2.2, 5.0):
            abox(gp, SL, x - .38, x + .38, y, y + .12, z - .38, z + .38)
        abox(gp, B, x - .37, x + .37, 6.96, 7.02, z - .37, z + .37)
        abox(gp, GD, x - .41, x + .41, 7.2, 7.32, z - .41, z + .41)
        frustum(gp, GD, x, z, 7.32, 7.62, .34, .05)
        sphere(gp, GD, (x, 7.72, z), .1, 10, 6)
        lx = x - s * .73
        lantern(gp, lx, 4.24, z, 1.4)
        abox(gp, D, lx, x - s * .35, 4.745, 4.8, z - .02, z + .02)
        abox(gp, D, x - s * .38, x - s * .35, 4.45, 4.95, z - .1, z + .1)
        rod(gp, D, (x - s * .37, 4.5, z), (x - s * .6, 4.76, z), .014, 6)
    # lamp orbit rail: torus r 5 at y 7.8, cross bar along X, 4 support posts with brackets
    abox(gr, B, -8, 8, 7.755, 7.845, 62.955, 63.045)
    for x in (-8, 8):
        sphere(gr, BL, (x, 7.8, 63), .07, 10, 6)
    sphere(gr, BL, (0, 7.8, 63), .12, 12, 8)
    for px, pz in ((-6.3, 56.7), (6.3, 56.7), (-6.3, 69.3), (6.3, 69.3)):
        abox(gr, SH, px - .34, px + .34, 0, .22, pz - .34, pz + .34)
        abox(gr, IR, px - .25, px + .25, 0, 7.8, pz - .25, pz + .25)
        for y in (.22, 3.9, 7.46):
            abox(gr, B, px - .27, px + .27, y, y + .07, pz - .27, pz + .27)
        abox(gr, B, px - .3, px + .3, 7.8, 7.92, pz - .3, pz + .3)
        frustum(gr, B, px, pz, 7.92, 8.04, .22, .04)
        L = math.hypot(px, 63 - pz)
        ux, uz = -px / L, (63 - pz) / L
        reach = L - 5
        obox(gr, B, (px + ux * reach / 2, 7.8, pz + uz * reach / 2), (ux, uz), (-uz, ux), reach / 2 + .02, .05, .04)
        sphere(gr, BL, (px + ux * reach, 7.8, pz + uz * reach), .06, 10, 6)
        rod(gr, D, (px + ux * .25, 6.7, pz + uz * .25), (px + ux * 1.35, 7.75, pz + uz * 1.35), .03, 8)
    torus('Sanctum rail ring', B, (0, 7.8, 63), 5, .035)
    # ivy on the arcades and wall caps
    for s in (-1, 1):
        for k in range(8):
            z = rng.uniform(54.9, 72.0)
            if min(abs(z - q) for q in (59.15, 66.95)) < .45:
                continue
            ivy_strand(gi, rng, 'x', z, 5.4, rng.uniform(.8, 3.8), lambda y, s=s: s * (11.04 if y > 5.25 else 11.05), s)
        for k in range(4):
            ivy_clump(gi, rng, s * 11.25, 1.0, rng.uniform(56, 70.5), .24, 22)
    for k in range(9):
        x = rng.uniform(-11.2, 11.2)
        if abs(abs(x) - 10.26) < .5:
            continue
        ivy_strand(gi, rng, 'z', x, 5.4, rng.uniform(.8, 3.8), lambda y: 71.55 if y > 5.25 else 71.57, 1)
    for x in (-5.0, 3.1, 8.8):
        ivy_clump(gi, rng, x, 1.0, 71.3, .25, 22)



# ---------------------------------------------------------------- driver
FILES = {
    'room2': dict(name='shadow-room2-v01', build=build_room2, zone=(-8.95, 8.95, 17.35, 30.65), exempt=(), limit=55000,
                  png='arch-room2.png', eye=(0, 3.2, 15.5), target=(0, 1.6, 25), lamp=(-6.3, 1.7, 24)),
    'sanctum': dict(name='shadow-sanctum-v01', build=build_sanctum, zone=(-10.95, 10.95, 55.25, 70.95),
                    exempt=('Sanctum rail', 'Sanctum rear post'), limit=65000,
                    png='arch-sanctum.png', eye=(0, 4, 52.5), target=(0, 2, 64), lamp=(-5, 4.16, 63)),
}


def rebuild(key):
    c.clear()
    FILES[key]['build']()
    G.build()
    bpy.context.view_layer.update()
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']


def keep_clear(name, zone, exempt):
    """Count vertices with y > 0.02 inside the keep-clear box (inclusive), skipping exempt object groups."""
    x0, x1, z0, z1 = zone
    bad, ex, sample = 0, 0, []
    for ob in bpy.context.scene.objects:
        if ob.type != 'MESH':
            continue
        free = bool(exempt) and ob.name.startswith(tuple(exempt))
        mw = ob.matrix_world
        for v in ob.data.vertices:
            p = mw @ v.co
            x, y, z = p.x, p.z, -p.y
            if y > .02 and x0 <= x <= x1 and z0 <= z <= z1:
                if free:
                    ex += 1
                else:
                    bad += 1
                    if len(sample) < 6:
                        sample.append((ob.name, round(x, 3), round(y, 3), round(z, 3)))
    note = f'(exempt {"/".join(exempt)}: {ex} vertices)' if exempt else ''
    print('SHADOW_CLEAR', name, bad, note, sample if sample else '', flush=True)
    return bad


args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
do_export = not args or '--export' in args
render = list(FILES) if not args else ([a for a in args if a in FILES] or list(FILES)) if '--render' in args else []
if do_export:
    for key, f in FILES.items():
        objs = rebuild(key)
        keep_clear(f['name'], f['zone'], f['exempt'])
        print('SHADOW_MANIFOLD', f['name'], c.non_manifold_edges(objs), 'non-manifold edges', flush=True)
        tris = c.export(f['name'], smooth=('Sanctum rail ring',))[0]
        print('SHADOW_BUDGET', f['name'], tris, '/', f['limit'], 'OK' if tris <= f['limit'] else 'OVER', flush=True)


def opt(flag, cast, default):
    """Optional check-render override, e.g. --lens 16 --eye 0,6,15 --target 0,2,25 --out D:/tmp/x.png."""
    return cast(args[args.index(flag) + 1]) if flag in args else default


def triple(s):
    return tuple(float(v) for v in s.split(','))


for key in render:
    f = FILES[key]
    rebuild(key)
    c.preview(opt('--out', str, os.path.join(c.ART, f['png'])), opt('--eye', triple, f['eye']),
              opt('--target', triple, f['target']), lens=opt('--lens', float, 28), res=(1400, 875), samples=16, lights=[
        dict(type='SUN', energy=.6, color=(.75, .82, 1), pos=(20, 40, -10), target=(0, 0, 40)),
        dict(type='POINT', energy=300, color=(1, .85, .6), pos=f['lamp'])])
