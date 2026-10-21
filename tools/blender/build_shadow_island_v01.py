"""Shadow shrine v01: faceted floating-island rock under the walkable footprints + distant horizon ring.

Writes (through shadow_temple_common.export):
  art/engine-transfer/model-data/ShadowTemple/shadow-island-v01.json   (<= 40k triangles)
  art/engine-transfer/model-data/ShadowTemple/shadow-horizon-v01.json  (<= 25k triangles)
then rebuilds both and renders art/shadow-temple/v01/island-overview.png.

Game metres through c.vec(): x right, y up, z forward. Every piece is a closed convex hull
(faceted low-poly). Island rock stays inside the footprint prisms with its top at y <= -0.22,
hidden under the floor tiles; the floating rocks sit at least 3 m outside the footprints.
Run: blender --background --factory-startup --python tools/blender/build_shadow_island_v01.py
"""
import bpy, bmesh, json, math, os, random, sys

bpy.ops.wm.read_factory_settings(use_empty=True)
sys.path.insert(0, r'D:\mumumetro\tools\blender')
import shadow_temple_common as c  # noqa: E402
from mathutils import Vector  # noqa: E402

bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backups beside the art files
c.PALETTE['Shadow arch crystal glow'] = ('7fb6ff', 0, .3, 1.5)

TAU = math.tau
ROCK, DARK, GLOW = 'Shadow rock', 'Shadow rock dark', 'Shadow arch crystal glow'
MOUNTAIN, WINDOW = 'Shadow horizon mountain', 'Shadow window glow'

# Walkable footprints in game metres: (x0, x1, z0, z1).
ROOMS = {
    'entry': (-3.5, 3.5, -15.0, -8.0),
    'room1': (-7.5, 7.5, -8.3, 11.3),
    'room2': (-9.6, 9.6, 16.7, 31.3),
    'room3': (-7.5, 7.5, 36.8, 49.3),
    'sanctum': (-11.5, 11.5, 54.8, 71.5),
}
BRIDGES = {
    'bridge1': (-2.1, 2.1, 11.0, 17.0),
    'bridge2': (-2.1, 2.1, 31.0, 37.0),
    'bridge3': (-2.1, 2.1, 49.0, 55.0),
}
FOOTPRINTS = dict(ROOMS, **BRIDGES)
CORE_DEPTH = {'entry': 3.6, 'room1': 6.1, 'room2': 6.6, 'room3': 5.6, 'sanctum': 7.2}  # roots hang further
CRYSTAL_SITES = {'entry': (), 'room1': ('edge', 'core'), 'room2': ('edge', 'core'),
                 'room3': ('edge',), 'sanctum': ('edge', 'core')}
TOP = -0.22       # highest island rock vertex (floor tiles cover y > -0.2)
DEEPEST = -9.0    # lowest root tip
CENTRE = (0.0, 28.0)  # horizon ring centre (game x, z)
# Floating rocks: game (x, y, z) and overall size in metres.
FLOATERS = ((7.5, 1.6, -19.5, 2.0), (-12.8, 1.0, 1.5, 2.6), (14.2, -1.6, 13.8, 2.9),
            (-15.2, -2.6, 25.0, 2.2), (13.0, 0.4, 44.0, 1.7), (-4.0, -2.2, 77.5, 2.4))
TOWER_AZIMUTHS = (30, 78, 112, 146, 190, 232, 270, 312, 350)


class Shells:
    """Closed convex-hull shells gathered per (object name, palette material)."""

    def __init__(self):
        self.bms = {}

    def hull(self, obj, material, pts):
        bm = self.bms.get((obj, material))
        if bm is None:
            bm = self.bms[(obj, material)] = bmesh.new()
        verts = [bm.verts.new(c.vec(p)) for p in pts]
        bmesh.ops.convex_hull(bm, input=verts, use_existing_faces=False)
        loose = [v for v in verts if v.is_valid and not v.link_faces]
        if loose:
            bmesh.ops.delete(bm, geom=loose, context='VERTS')

    def build(self):
        made = []
        for (obj, material), bm in self.bms.items():
            me = bpy.data.meshes.new(obj)
            bm.to_mesh(me)
            bm.free()
            me.materials.append(c.mat(material))
            ob = bpy.data.objects.new(obj, me)
            bpy.context.scene.collection.objects.link(ob)
            made.append(ob)
        self.bms = {}
        return made


# ---------------------------------------------------------------- island helpers
def inset_at(y):
    """Inset from the footprint edge that grows with depth, so every mass tapers downward."""
    return 0.1 + 0.3 * max(0.0, -y - 0.2)


def keep_in(fp, x, z, y, R):
    """Clamp (x, z) inside the tapered footprint prism; clamped points get a small extra inset."""
    x0, x1, z0, z1 = fp
    mx = min(inset_at(y), (x1 - x0) / 2 - .3)
    mz = min(inset_at(y), (z1 - z0) / 2 - .3)
    if x < x0 + mx:
        x = x0 + mx + R.uniform(.02, .25)
    elif x > x1 - mx:
        x = x1 - mx - R.uniform(.02, .25)
    if z < z0 + mz:
        z = z0 + mz + R.uniform(.02, .25)
    elif z > z1 - mz:
        z = z1 - mz - R.uniform(.02, .25)
    return x, z


def squircle(a, p):
    ca, sa = math.cos(a), math.sin(a)
    return math.copysign(abs(ca) ** p, ca), math.copysign(abs(sa) ** p, sa)


def rim(fp, inset, step, R, chamfer=0.0, jitter=0.0, slide=.3):
    """Points along the (inset) rectangle, counter-clockwise; jitter pushes them inward only."""
    x0, x1, z0, z1 = fp
    x0, x1, z0, z1 = x0 + inset, x1 - inset, z0 + inset, z1 - inset
    corners = ((x0, z0), (x1, z0), (x1, z1), (x0, z1))
    out = []
    for i in range(4):
        (ax, az), (bx, bz) = corners[i], corners[(i + 1) % 4]
        L = math.hypot(bx - ax, bz - az)
        nx, nz = -(bz - az) / L, (bx - ax) / L
        n = max(2, round(L / step))
        for k in range(n):
            d = (k + (R.uniform(-slide, slide) if k else 0)) * L / n
            d = min(max(d, chamfer), L - chamfer)
            j = R.uniform(0, jitter)
            out.append((ax + (bx - ax) * d / L + nx * j, az + (bz - az) * d / L + nz * j))
    return out


def stalactite(R, sh, obj, mat, x, y, z, r, length, lean=(0.0, 0.0)):
    length = min(length, y - DEEPEST)
    pts = []
    for f, s, n in ((0, 1, 5), (.42, .55, 5), (.75, .25, 3)):
        a0 = R.uniform(0, TAU)
        for k in range(n):
            a = a0 + TAU * (k + R.uniform(-.2, .2)) / n
            rr = r * s * R.uniform(.85, 1.15)
            pts.append((x + lean[0] * f * length + math.cos(a) * rr, y - f * length,
                        z + lean[1] * f * length + math.sin(a) * rr))
    pts.append((x + lean[0] * length, y - length, z + lean[1] * length))
    sh.hull(obj, mat, pts)


def crystal(R, sh, obj, base, direction, length, radius):
    d = Vector(direction).normalized()
    up = Vector((0, 1, 0)) if abs(d.y) < .95 else Vector((1, 0, 0))
    u = d.cross(up).normalized()
    v = d.cross(u).normalized()
    b = Vector(base)
    tw = R.uniform(0, TAU)
    pts = []
    for k in range(6):
        a = tw + TAU * k / 6
        off = u * math.cos(a) + v * math.sin(a)
        pts.append(tuple(b + off * radius))
        pts.append(tuple(b + d * (length * .72) + off * (radius * .9)))
    pts.append(tuple(b + d * length))
    sh.hull(obj, GLOW, pts)


def cluster(R, sh, site, out, n):
    ox, oz = out
    for _ in range(n):
        base = (site[0] + R.uniform(-.35, .35), site[1] + R.uniform(-.2, .2), site[2] + R.uniform(-.35, .35))
        dirv = (ox * .75 + R.uniform(-.35, .35), -1.0, oz * .75 + R.uniform(-.35, .35))
        crystal(R, sh, 'Shadow island crystals', base, dirv, R.uniform(1.0, 2.2), R.uniform(.13, .26))


# ---------------------------------------------------------------- island parts
def cap(R, sh, name, fp):
    """Flat-topped slab: top rim exactly on the footprint edges, faceted sides tapering to ~-3 m."""
    x0, x1, z0, z1 = fp
    pts = [(x, TOP - R.uniform(0, .1), z) for x, z in rim(fp, 0, 1.8, R)]
    pts += [(x, R.uniform(-1.8, -1.1), z) for x, z in rim(fp, .14, 2.2, R, chamfer=R.uniform(.3, .8), jitter=.35)]
    pts += [(x, R.uniform(-2.7, -2.0), z) for x, z in rim(fp, .9, 3.0, R, chamfer=1.4, jitter=.7)]
    mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
    for _ in range(5):
        pts.append((mx + R.uniform(-.35, .35) * (x1 - x0), R.uniform(-3.3, -2.6), mz + R.uniform(-.35, .35) * (z1 - z0)))
    sh.hull(f'Shadow island {name} rock', ROCK, pts)


def core(R, sh, name, fp, depth):
    """Main inverted mass: squarish under the cap, rounding and narrowing to the deepest tip."""
    x0, x1, z0, z1 = fp
    mx, mz, hx, hz = (x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2
    pts = []
    for y0, s, p, n in ((-1.3, .95, .45, 12), (-.34 * depth, .74, .7, 11), (-.6 * depth, .46, .9, 8),
                        (-.82 * depth, .22, 1.0, 6)):
        a0 = R.uniform(0, TAU)
        for k in range(n):
            a = a0 + TAU * (k + R.uniform(-.3, .3)) / n
            u, v = squircle(a, p)
            y = min(y0 + R.uniform(-.35, .35), TOP - .3)
            x, z = keep_in(fp, mx + u * hx * s * R.uniform(.88, 1.08), mz + v * hz * s * R.uniform(.88, 1.08), y, R)
            pts.append((x, y, z))
    pts.append((mx + R.uniform(-.2, .2) * hx, -depth, mz + R.uniform(-.2, .2) * hz))
    sh.hull(f'Shadow island {name} rock dark', DARK, pts)


def lobes(R, sh, name, fp, depth):
    """Grid of overlapping tapering lobes: shallow at the rim, deep toward the middle."""
    x0, x1, z0, z1 = fp
    W, D = x1 - x0, z1 - z0
    nx, nz = max(2, round(W / 5)), max(2, round(D / 5))
    cw, cd = W / nx, D / nz
    mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
    out = []
    for i in range(nx):
        for j in range(nz):
            cx = x0 + cw * (i + .5 + R.uniform(-.15, .15))
            cz = z0 + cd * (j + .5 + R.uniform(-.15, .15))
            rho = min(1.0, math.hypot((cx - mx) / (W / 2), (cz - mz) / (D / 2)) / 1.25)
            d = 2.1 + (depth * .92 - 2.1) * (1 - rho ** 1.7) + R.uniform(-.5, .4)
            rx, rz = cw * R.uniform(.62, .78), cd * R.uniform(.62, .78)
            ytop = R.uniform(-1.0, -.6)
            pts = []
            for f, s, n in ((0, 1, 8), (.35, .78, 7), (.68, .45, 6), (.9, .18, 4)):
                a0 = R.uniform(0, TAU)
                for k in range(n):
                    a = a0 + TAU * (k + R.uniform(-.3, .3)) / n
                    y = ytop + (-d - ytop) * f + (R.uniform(-.25, .25) if f else 0)
                    rr = s * R.uniform(.85, 1.12)
                    x, z = keep_in(fp, cx + math.cos(a) * rx * rr, cz + math.sin(a) * rz * rr, y, R)
                    pts.append((x, y, z))
            tx, tz = keep_in(fp, cx + R.uniform(-.3, .3), cz + R.uniform(-.3, .3), -d, R)
            pts.append((tx, -d, tz))
            mat = ROCK if R.random() < .55 else DARK
            sh.hull(f'Shadow island {name} rock' + ('' if mat == ROCK else ' dark'), mat, pts)
            out.append(dict(cx=cx, cz=cz, rx=rx, rz=rz, ytop=ytop, d=d, rho=rho))
    return out


def roots(R, sh, name, fp, depth, lobe_list):
    """Stalactite roots: under the core, under some lobes and along the rim."""
    x0, x1, z0, z1 = fp
    mx, mz, hx, hz = (x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2
    obj = f'Shadow island {name} rock dark'
    for _ in range(2 if name == 'entry' else 4):
        y = -.66 * depth
        tip = -depth - R.uniform(.6, 2.2)
        stalactite(R, sh, obj, DARK, mx + R.uniform(-.2, .2) * hx, y, mz + R.uniform(-.2, .2) * hz,
                   R.uniform(.55, .95), y - tip, (R.uniform(-.1, .1), R.uniform(-.1, .1)))
    for lb in lobe_list:
        if R.random() < .55:
            y = lb['ytop'] + (-lb['d'] - lb['ytop']) * .7
            tip = -lb['d'] - R.uniform(.5, 1.8)
            stalactite(R, sh, obj, DARK, lb['cx'] + R.uniform(-.25, .25) * lb['rx'], y,
                       lb['cz'] + R.uniform(-.25, .25) * lb['rz'], R.uniform(.4, .75), y - tip,
                       (R.uniform(-.1, .1), R.uniform(-.1, .1)))
    for x, z in rim(fp, R.uniform(1.0, 1.3), 7.5, R, chamfer=1.2, jitter=.3):
        if R.random() < .6:
            stalactite(R, sh, obj, DARK, x, -1.6, z, R.uniform(.3, .55), R.uniform(1.2, 2.8))


def crystals(R, sh, name, fp, depth, lobe_list):
    x0, x1, z0, z1 = fp
    mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
    for kind in CRYSTAL_SITES[name]:
        if kind == 'edge':
            lb = R.choice([l for l in lobe_list if l['rho'] > .5] or lobe_list)
            ox, oz = lb['cx'] - mx, lb['cz'] - mz
            n = math.hypot(ox, oz) or 1.0
            ox, oz = ox / n, oz / n
            y = lb['ytop'] + (-lb['d'] - lb['ytop']) * .5
            site = (lb['cx'] + ox * lb['rx'] * .5, y, lb['cz'] + oz * lb['rz'] * .5)
            cluster(R, sh, site, (ox, oz), R.choice((3, 4)))
        else:
            site = (mx + R.uniform(-.8, .8), -.72 * depth, mz + R.uniform(-.8, .8))
            cluster(R, sh, site, (R.uniform(-.4, .4), R.uniform(-.4, .4)), R.choice((3, 4)))


def keel(R, sh, name, fp):
    """Thin V keel under a bridge slab; ends tuck 0.6 m into the neighbouring room rock."""
    x0, x1, z0, z1 = fp
    za, zb = z0 - .6, z1 + .6
    obj = f'Shadow island {name} rock dark'
    pts = []
    n = 7
    for k in range(n + 1):
        z = za + (zb - za) * k / n
        half = R.uniform(.85, 1.05)
        for sx in (-1, 1):
            pts.append((sx * half, TOP - R.uniform(0, .08), z))
            pts.append((sx * half * R.uniform(.7, .85), R.uniform(-.75, -.55), min(zb, max(za, z + R.uniform(-.2, .2)))))
    for k in range(6):
        t = (k + .5) / 6
        z = za + .4 + (zb - za - .8) * t
        sag = 1.25 + 1.5 * math.sin(math.pi * t) + R.uniform(-.15, .15)
        for sx in (-1, 1):
            pts.append((sx * R.uniform(.12, .3), -sag, z))
    sh.hull(obj, DARK, pts)
    stalactite(R, sh, obj, DARK, R.uniform(-.2, .2), -2.1, (z0 + z1) / 2 + R.uniform(-.8, .8), .45, R.uniform(1.3, 2.0))


def floater(R, sh, x, y, z, size):
    """Small floating rock: flattened faceted body plus a short tapering root."""
    rx, rz = size * .5 * R.uniform(.85, 1.0), size * .5 * R.uniform(.7, .92)
    pts = []
    for _ in range(16):
        a, h = R.uniform(0, TAU), R.uniform(-1, 1)
        s = math.sqrt(1 - h * h)
        pts.append((x + s * math.cos(a) * rx, y + h * size * (.28 if h > 0 else .3), z + s * math.sin(a) * rz))
    sh.hull('Shadow island floating rock', ROCK, pts)
    stalactite(R, sh, 'Shadow island floating rock dark', DARK, x + R.uniform(-.1, .1) * size, y - .1 * size,
               z + R.uniform(-.1, .1) * size, .32 * size, .52 * size)
    return pts


def build_island():
    R = random.Random(21)
    sh = Shells()
    for name, fp in ROOMS.items():
        depth = CORE_DEPTH[name]
        cap(R, sh, name, fp)
        core(R, sh, name, fp, depth)
        lobe_list = lobes(R, sh, name, fp, depth)
        roots(R, sh, name, fp, depth, lobe_list)
        crystals(R, sh, name, fp, depth, lobe_list)
    for name, fp in BRIDGES.items():
        keel(R, sh, name, fp)
    sizes = []
    for x, y, z, size in FLOATERS:
        body = floater(R, sh, x, y, z, size)
        sizes.append(round(max(max(p[i] for p in body) - min(p[i] for p in body) for i in (0, 2)), 2))
    return sh.build(), sizes


# ---------------------------------------------------------------- horizon
def polar(r, a, y):
    return (CENTRE[0] + r * math.cos(a), y, CENTRE[1] + r * math.sin(a))


def mountain(R, sh, th, hw, r_in, r_out, peak):
    def P(t, s, y):
        return polar(r_in + (r_out - r_in) * s, th + t * hw, y)
    pts = [P(-1, 0, -45), P(1, 0, -45)] + [P(t, 1, -45) for t in (-1, -.5, 0, .5, 1)]
    tp, sp = R.uniform(-.3, .3), R.uniform(.25, .55)
    pts.append(P(tp, sp, peak))
    for side in (-1, 1):
        ts = max(-.95, min(.95, tp + side * R.uniform(.35, .7)))
        pts.append(P(ts, R.uniform(.15, .75), peak * R.uniform(.42, .72)))
    if R.random() < .6:
        ts = max(-.9, min(.9, tp + R.choice((-1, 1)) * R.uniform(.2, .4)))
        pts.append(P(ts, R.uniform(.2, .6), peak * R.uniform(.78, .92)))
    for _ in range(5):
        t, s = R.uniform(-.9, .9), R.uniform(0, 1)
        fall = max(0.0, 1 - abs(t - tp) * .95 - abs(s - sp) * .6)
        pts.append(P(t, s, -43 + (peak + 43) * fall * R.uniform(.72, .96)))
    sh.hull('Shadow horizon mountains', MOUNTAIN, pts)


def ring_pts(cx, cz, y, r, n=8, rot=0.0):
    return [(cx + r * math.cos(rot + TAU * k / n), y, cz + r * math.sin(rot + TAU * k / n)) for k in range(n)]


def window(sh, cx, cz, y, a, apothem, w, h, d=.3):
    nx, nz = math.cos(a), math.sin(a)
    tx, tz = -nz, nx
    ox, oz = cx + nx * (apothem + .02), cz + nz * (apothem + .02)
    pts = [(ox + tx * w / 2 * sw + nx * d / 2 * sd, y + h / 2 * sv, oz + tz * w / 2 * sw + nz * d / 2 * sd)
           for sw in (-1, 1) for sv in (-1, 1) for sd in (-1, 1)]
    sh.hull('Shadow horizon windows', WINDOW, pts)


def tower(R, sh, az, rad, H, r, yb, tiered, turret):
    cx, cz = CENTRE[0] + rad * math.cos(az), CENTRE[1] + rad * math.sin(az)
    rot = R.uniform(0, TAU / 8)
    T = 'Shadow horizon towers'
    # Rock pinnacle the tower stands on (reaches the mountain base level).
    foot = ring_pts(cx, cz, yb + .4, 1.35 * r, 6, R.uniform(0, 1))
    foot += [(x + R.uniform(-.8, .8), y, z + R.uniform(-.8, .8))
             for x, y, z in ring_pts(cx, cz, (yb - 45) / 2, 2.4 * r, 6, R.uniform(0, 1))]
    foot += ring_pts(cx, cz, -45, min(4.2 * r, 8.0), 7, R.uniform(0, 1))
    sh.hull(T, MOUNTAIN, foot)
    y1 = yb + H * (.5 if tiered else .66)
    top = yb + H
    sh.hull(T, MOUNTAIN, ring_pts(cx, cz, yb - .6, 1.06 * r, 8, rot) + ring_pts(cx, cz, y1, .94 * r, 8, rot))
    sh.hull(T, MOUNTAIN, ring_pts(cx, cz, y1 - 1.4, .92 * r, 8, rot) + ring_pts(cx, cz, y1 - .3, 1.28 * r, 8, rot)
            + ring_pts(cx, cz, y1 + 1.3, 1.28 * r, 8, rot))
    y2 = None
    if tiered:
        y2 = yb + .78 * H
        sh.hull(T, MOUNTAIN, ring_pts(cx, cz, y1 + 1.1, .72 * r, 8, rot) + ring_pts(cx, cz, y2, .7 * r, 8, rot))
        sh.hull(T, MOUNTAIN, ring_pts(cx, cz, y2 - .8, .68 * r, 8, rot) + ring_pts(cx, cz, y2, .95 * r, 8, rot)
                + ring_pts(cx, cz, y2 + .9, .95 * r, 8, rot))
        sh.hull(T, MOUNTAIN, ring_pts(cx, cz, y2 + .8, 1.02 * r, 8, rot) + [(cx, top, cz)])
    else:
        sh.hull(T, MOUNTAIN, ring_pts(cx, cz, y1 + 1.2, 1.34 * r, 8, rot) + [(cx, top, cz)])

    def face(k):
        return rot + TAU * (k + .5) / 8
    to_c = math.atan2(CENTRE[1] - cz, CENTRE[0] - cx)
    faces = sorted(range(8), key=lambda k: abs((face(k) - to_c + math.pi) % TAU - math.pi))
    cos8 = math.cos(math.pi / 8)
    w = min(.8, 2 * r * math.sin(math.pi / 8) * .45)
    h = w * 1.8
    count = 0
    for k in faces[:3]:
        for f in (.2, .32, .44, .56):
            y = yb + H * f
            if y + h / 2 > y1 - 1.6 or R.random() < .35:
                continue
            taper = 1.06 + (.94 - 1.06) * (y - yb + .6) / (y1 - yb + .6)
            window(sh, cx, cz, y, face(k), cos8 * r * taper, w, h)
            count += 1
    for k in faces[:2]:
        window(sh, cx, cz, y1 + .5, face(k), cos8 * 1.28 * r, w, h * .8)
        count += 1
    if tiered:
        window(sh, cx, cz, (y1 + 1.1 + y2) / 2, face(faces[0]), cos8 * .71 * r, w * .8, h * .8)
        count += 1
    if turret:
        k = faces[R.choice((3, 4))]
        a = face(k)
        tx, tz = cx + math.cos(a) * (cos8 * r + .35 * r), cz + math.sin(a) * (cos8 * r + .35 * r)
        tr, t0, t1 = .42 * r, yb + .3 * H, yb + .42 * H
        sh.hull(T, MOUNTAIN, ring_pts(tx, tz, t0, tr, 6, rot) + [(tx, t0 - .06 * H, tz)])
        sh.hull(T, MOUNTAIN, ring_pts(tx, tz, t0, tr, 6, rot) + ring_pts(tx, tz, t1, tr, 6, rot))
        sh.hull(T, MOUNTAIN, ring_pts(tx, tz, t1, tr * 1.15, 6, rot) + [(tx, t1 + .09 * H, tz)])
        window(sh, tx, tz, (t0 + t1) / 2, to_c, tr * .8, w * .7, h * .7)
        count += 1
    return dict(radius=round(rad, 1), height=round(H, 1), base=round(yb, 1), windows=count)


def build_horizon():
    R = random.Random(21)
    sh = Shells()
    layers = (  # count, inner radius, outer radius, half-width (deg), peak height
        (30, (174, 184), (196, 214), (6.5, 9.0), (25, 40)),
        (24, (188, 202), (222, 240), (8.5, 12.0), (34, 56)),
        (18, (206, 220), (244, 258), (10.0, 14.5), (48, 70)),
    )
    for n, rin, rout, hwr, pk in layers:
        a0 = R.uniform(0, TAU)
        for i in range(n):
            th = a0 + TAU * (i + R.uniform(-.25, .25)) / n
            hw = math.radians(R.uniform(*hwr))
            r_in = max(R.uniform(*rin), 170.5 / math.cos(hw))
            mountain(R, sh, th, hw, r_in, R.uniform(*rout), R.uniform(*pk))
    towers = []
    for deg in TOWER_AZIMUTHS:
        tiered = R.random() < .4
        towers.append(tower(R, sh, math.radians(deg + R.uniform(-5, 5)), R.uniform(132, 188), R.uniform(20, 45),
                            R.uniform(1.6, 2.7), R.uniform(-3, 6), tiered, (not tiered) and R.random() < .6))
    return sh.build(), towers


# ---------------------------------------------------------------- checks
def game_verts(objs):
    for ob in objs:
        mw = ob.matrix_world
        for v in ob.data.vertices:
            p = mw @ v.co
            yield ob.name, p.x, p.z, -p.y


def inside(x, z, fp, eps=1e-4):
    x0, x1, z0, z1 = fp
    return x0 - eps <= x <= x1 + eps and z0 - eps <= z <= z1 + eps


def rect_dist(x, z, fp):
    x0, x1, z0, z1 = fp
    return math.hypot(max(x0 - x, 0, x - x1), max(z0 - z, 0, z - z1))


def island_report(objs, sizes):
    rows = list(game_verts(objs))
    deep = {}
    reach = {}
    clearance = 1e9
    top_all = -1e9
    for name, x, y, z in rows:
        if 'floating' in name:
            clearance = min(clearance, min(rect_dist(x, z, fp) for fp in FOOTPRINTS.values()))
            continue
        top_all = max(top_all, y)
        part = name.split()[2]
        deep[part] = min(deep.get(part, 0), y)
        if y > -.5 and part in ROOMS:
            b = reach.setdefault(part, [1e9, -1e9, 1e9, -1e9])
            b[0], b[1], b[2], b[3] = min(b[0], x), max(b[1], x), min(b[2], z), max(b[3], z)
    print('SHADOW_ISLAND depth', {k: round(v, 2) for k, v in deep.items()}, flush=True)
    print('SHADOW_ISLAND top-rim bounds', {k: [round(v, 2) for v in b] for k, b in reach.items()}, flush=True)
    print('SHADOW_ISLAND rock max y', round(top_all, 4), 'floater sizes', sizes,
          'floater min clearance', round(clearance, 2), 'non-manifold edges', c.non_manifold_edges(objs), flush=True)


def shadow_top_from_json(path):
    with open(path) as f:
        data = json.load(f)
    best = -1e9
    for m in data['meshes']:
        v = m['vertices']
        for i in range(0, len(v), 3):
            x, y, z = v[i], v[i + 1], v[i + 2]
            if any(inside(x, z, fp) for fp in FOOTPRINTS.values()):
                best = max(best, y)
    return best


def horizon_report(objs, towers):
    stats = {}
    for name, x, y, z in game_verts(objs):
        r = math.hypot(x - CENTRE[0], z - CENTRE[1])
        s = stats.setdefault(name, [1e9, -1e9, 1e9, -1e9])
        s[0], s[1], s[2], s[3] = min(s[0], r), max(s[1], r), min(s[2], y), max(s[3], y)
    for name, s in stats.items():
        print('SHADOW_HORIZON', name, 'radius', round(s[0], 1), round(s[1], 1), 'y', round(s[2], 1), round(s[3], 1), flush=True)
    print('SHADOW_HORIZON towers', towers, 'non-manifold edges', c.non_manifold_edges(objs), flush=True)


# ---------------------------------------------------------------- run
island, sizes = build_island()
island_report(island, sizes)
tris, lo, hi = c.export('shadow-island-v01')
top = shadow_top_from_json(os.path.join(c.OUT, 'shadow-island-v01.json'))
print('SHADOW_TOP', round(top, 4), flush=True)
if top > -0.2 or tris > 40000:
    raise RuntimeError('island check failed: top %.3f tris %d' % (top, tris))

horizon, towers = build_horizon()
horizon_report(horizon, towers)
tris, lo, hi = c.export('shadow-horizon-v01')
if tris > 25000:
    raise RuntimeError('horizon over budget: %d' % tris)

build_island()
build_horizon()
c.preview(os.path.join(c.ART, 'island-overview.png'), eye=(40, 18, -40), target=(0, -2, 28), lens=24,
          res=(1400, 875), samples=16, world=(.012, .018, .045),
          lights=[dict(type='SUN', energy=0.8, color=(.75, .82, 1), pos=(40, 60, -20), target=(0, 0, 28))])
print('SHADOW_DONE', flush=True)
