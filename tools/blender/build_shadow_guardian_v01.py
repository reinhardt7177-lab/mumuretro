"""Shadow shrine guardian statue v01 - '거울의 지킴이' (the mirror keeper).

A seated owl-like guardian of pale carved stone on a 12-sided plinth. It holds a round
mirror-shield before its chest and wears a crescent-moon crest between two ear tufts.

Every shadow caster is an exact convex hull, so the statue is a union of convex parts
(parts may overlap). Visual-only details sit flush on caster faces (<= 3 mm proud).
Game metres via vec(): x right, y up, z forward. Local pivot = centre of the base on the
floor. The statue faces -Z.

Writes art/engine-transfer/model-data/ShadowTemple/
  guardian-casters-v01.json   convex caster parts (evaluated vertices, game coordinates)
  guardian-v01.json           visual statue (casters + flush details)
  guardian-anchors-v01.json   eye centres and size, height, footprint
and art/shadow-temple/v01/guardian-{front,three-quarter,shadow}.png (+ guardian-v01.blend).

Run: blender --background --factory-startup --python tools/blender/build_shadow_guardian_v01.py
"""
import sys
sys.dont_write_bytecode = True
import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
sys.path.insert(0, r'D:\mumumetro\tools\blender')

import bmesh, json, math, os
from mathutils import Vector
import shadow_temple_common as c
from shadow_temple_common import vec

TAU = math.tau
PALE, STONE, RECESS = 'Shadow statue pale', 'Shadow statue stone', 'Shadow statue recess'
MIRROR, GOLD = 'Shadow guardian mirror', 'Shadow gold'
MAX_HEIGHT, MAX_RADIUS, MAX_PARTS, MAX_TRIS = 2.30, 1.35, 24, 20000

HEAD_C, HEAD_R, FACE_Z = (0.0, 1.66, -0.02), (0.43, 0.36, 0.39), -0.31
BODY_ZC, BODY_CUT_Z = 0.04, -0.60
SHIELD_Y, SHIELD_R, SHIELD_BACK, SHIELD_FRONT = 1.02, 0.54, -0.59, -0.69
EYE_X, EYE_Y, EYE_R, PROUD = 0.135, 1.73, 0.08, 0.003

casters, details = [], []


# ------------------------------------------------------------------ convex hull parts
def _hull_bm(coords):
    """bmesh holding exactly the convex hull of Blender-space coords, outward normals."""
    bm = bmesh.new()
    for co in coords:
        bm.verts.new(co)
    ret = bmesh.ops.convex_hull(bm, input=bm.verts[:], use_existing_faces=False)
    kill = {g for g in ret['geom_interior'] + ret['geom_unused'] if isinstance(g, bmesh.types.BMVert)}
    kill |= {v for v in bm.verts if not v.link_faces}
    if kill:
        bmesh.ops.delete(bm, geom=list(kill), context='VERTS')
    # Coplanar cut points can leave zero-area slivers with meaningless normals.
    bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=bm.edges[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()
    return bm


def _clip(coords, co, no):
    """Exact intersection of hull(coords) with the half-space (p - co) . no <= 0 (Blender space)."""
    bm = _hull_bm(coords)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-7,
                           plane_co=co, plane_no=no, clear_outer=True)
    out = [v.co.copy() for v in bm.verts]
    bm.free()
    return out


def hull_part(name, pts, material, cuts=(), smooth=False, sharp=32.0):
    """Object = convex hull of game points, clipped by game half-spaces (point, outward normal)."""
    coords = [vec(p) for p in pts]
    for co, no in cuts:
        coords = _clip(coords, vec(co), vec(no).normalized())
    bm = _hull_bm(coords)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.02), use_dissolve_boundaries=False,
                             verts=[], edges=bm.edges[:], delimit=set())
    bm.normal_update()
    for f in bm.faces:
        f.smooth = smooth
    if smooth:
        limit = math.radians(sharp)
        for e in bm.edges:
            e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0.0) > limit)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(c.mat(material))
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def caster(name, pts, material, **kw):
    ob = hull_part(name, pts, material, **kw)
    casters.append(ob)
    return ob


# ------------------------------------------------------------------ point generators (game space)
def ngon(y, rx, rz=None, n=12, zc=0.0, off=0.5):
    """Horizontal n-gon ring at height y; with off=0.5 a flat side faces -Z."""
    rz = rx if rz is None else rz
    return [(rx * math.sin((k + off) * TAU / n), y, zc - rz * math.cos((k + off) * TAU / n)) for k in range(n)]


def circle_z(cx, cy, r, z, n=24, off=0.5):
    """Vertical circle in the plane z = const (a disc facing -Z)."""
    return [(cx + r * math.sin((k + off) * TAU / n), cy + r * math.cos((k + off) * TAU / n), z) for k in range(n)]


def circle_y(r, y, n=48):
    return [(r * math.sin(k * TAU / n), y, -r * math.cos(k * TAU / n)) for k in range(n)]


def ellipsoid(ctr, rad, nu=20, nv=12):
    pts = [(ctr[0], ctr[1] - rad[1], ctr[2]), (ctr[0], ctr[1] + rad[1], ctr[2])]
    for j in range(1, nv):
        phi = -math.pi / 2 + j * math.pi / nv
        for k in range(nu):
            th = (k + 0.5) * TAU / nu
            pts.append((ctr[0] + rad[0] * math.cos(phi) * math.sin(th), ctr[1] + rad[1] * math.sin(phi),
                        ctr[2] - rad[2] * math.cos(phi) * math.cos(th)))
    return pts


def egg(top, tip, out, width, thick, taper=0.3, ns=10, na=14):
    """Tapered ellipsoid from top to tip; 'width' across, 'thick' along the out direction."""
    s0, s1, o = Vector(top), Vector(tip), Vector(out)
    u = (s1 - s0).normalized()
    n = (o - o.dot(u) * u).normalized()
    w = u.cross(n)
    ctr, half = (s0 + s1) / 2, (s1 - s0).length / 2
    pts = [tuple(s0), tuple(s1)]
    for i in range(1, ns):
        s = -math.cos(i * math.pi / ns)
        k = math.sqrt(1 - s * s) * (1 - taper * s)
        for a in range(na):
            ps = a * TAU / na
            pts.append(tuple(ctr + half * s * u + k * (width * math.cos(ps) * w + thick * math.sin(ps) * n)))
    return pts


def mirror_x(pts):
    return [(-x, y, z) for x, y, z in pts]


def tuft(sign):
    """Ear tuft wedge: base ellipse buried in the head, blunt tip up and out."""
    base, tip = Vector((0.27 * sign, 1.87, -0.10)), Vector((0.45 * sign, 2.10, -0.12))
    u = (tip - base).normalized()
    side = Vector((0, 0, 1)).cross(u).normalized()
    pts = [tuple(base + 0.085 * math.cos(a * TAU / 10) * side + Vector((0, 0, 0.065 * math.sin(a * TAU / 10))))
           for a in range(10)]
    pts += [tuple(tip + 0.018 * d * side + Vector((0, 0, 0.016 * e))) for d in (-1, 1) for e in (-1, 1)]
    return pts


def crescent_pieces(n=4):
    """Horns-up crescent (outer circle minus a raised inner circle) split into n convex wedges."""
    R, yc, r, d = 0.23, 2.19, 0.21, 0.10
    yt = yc + (R * R - r * r + d * d) / (2 * d)
    xt = math.sqrt(R * R - (yt - yc) ** 2)
    th = math.atan2(xt, yc - yt) - 0.10      # outer arc half-angle, blunted horn tip
    ph = math.atan2(xt, yc + d - yt) - 0.16  # inner arc half-angle
    zc, hz = -0.02, 0.035
    pieces = []
    for i in range(n):
        pts = []
        for m in range(7):
            t = -th + 2 * th * (i + m / 6) / n
            pts += [(R * math.sin(t), yc - R * math.cos(t), zc + s * hz) for s in (-1, 1)]
        for p in (-ph + 2 * ph * i / n, -ph + 2 * ph * (i + 1) / n):
            pts += [(r * math.sin(p), yc + d - r * math.cos(p), zc + s * hz) for s in (-1, 1)]
        pieces.append(pts)
    return pieces


def crescent_outline(cx, cy, R, r, d, blunt=(0.12, 0.20), n=14):
    yt = cy + (R * R - r * r + d * d) / (2 * d)
    xt = math.sqrt(max(R * R - (yt - cy) ** 2, 0.0))
    th = math.atan2(xt, cy - yt) - blunt[0]
    ph = math.atan2(xt, cy + d - yt) - blunt[1]
    outer = [(cx + R * math.sin(-th + 2 * th * i / n), cy - R * math.cos(-th + 2 * th * i / n)) for i in range(n + 1)]
    inner = [(cx + r * math.sin(ph - 2 * ph * i / n), cy + d - r * math.cos(ph - 2 * ph * i / n)) for i in range(n + 1)]
    return outer + inner


# ------------------------------------------------------------------ visual-only details
def _solid(name, verts, faces, material):
    me = bpy.data.meshes.new(name)
    me.from_pydata([vec(p) for p in verts], [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    me.materials.append(c.mat(material))
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    details.append(ob)
    return ob


def prism(name, loop, z0, z1, material):
    """Simple polygon (x, y) extruded between z0 and z1 (closed)."""
    n = len(loop)
    verts = [(x, y, z0) for x, y in loop] + [(x, y, z1) for x, y in loop]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return _solid(name, verts, faces, material)


def annulus(name, outer_a, outer_b, inner_a, inner_b, material):
    """Closed ring solid from four matching loops: outer/inner at layers a and b."""
    n = len(outer_a)
    verts = list(outer_a) + list(outer_b) + list(inner_a) + list(inner_b)
    oa, ob_, ia, ib = 0, n, 2 * n, 3 * n
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces += [[oa + i, oa + j, ob_ + j, ob_ + i], [ia + i, ib + i, ib + j, ia + j],
                  [oa + i, ia + i, ia + j, oa + j], [ob_ + i, ob_ + j, ib + j, ib + i]]
    return _solid(name, verts, faces, material)


# ------------------------------------------------------------------ build: convex casters
caster('Guardian plinth', ngon(0.0, 1.2) + ngon(0.26, 1.2) + ngon(0.30, 1.14), STONE)

# Tapered 12-sided seated body; concave profile keeps every ring on the hull. Chest flat at z -0.60.
BODY = [(0.28, 0.76, 0.70), (0.46, 0.84, 0.78), (0.72, 0.84, 0.78), (1.00, 0.74, 0.68),
        (1.24, 0.60, 0.56), (1.42, 0.44, 0.42), (1.47, 0.33, 0.32)]
caster('Smooth guardian body', [p for y, rx, rz in BODY for p in ngon(y, rx, rz, zc=BODY_ZC)], PALE,
       cuts=[((0, 0, BODY_CUT_Z), (0, 0, -1))], smooth=True)
BAND = [(1.15, 0.660, 0.612), (1.17, 0.676, 0.626), (1.27, 0.604, 0.563), (1.29, 0.566, 0.530)]
caster('Smooth guardian chest band', [p for y, rx, rz in BAND for p in ngon(y, rx, rz, zc=BODY_ZC)], STONE,
       smooth=True, sharp=50)

head = caster('Smooth guardian head', ellipsoid(HEAD_C, HEAD_R), PALE,
              cuts=[((0, 0, FACE_Z), (0, 0, -1))], smooth=True, sharp=30)
caster('Guardian beak', [(-0.045, 1.695, -0.27), (0.045, 1.695, -0.27), (0.0, 1.595, -0.27),
                         (-0.026, 1.675, -0.355), (0.026, 1.675, -0.355), (0.0, 1.585, -0.395)], STONE)
caster('Smooth guardian tuft L', tuft(-1), PALE, smooth=True, sharp=40)
caster('Smooth guardian tuft R', tuft(1), PALE, smooth=True, sharp=40)
for i, pts in enumerate(crescent_pieces()):
    caster('Smooth guardian crest %d' % (i + 1), pts, GOLD, smooth=True, sharp=40)

WING = egg(top=(0.64, 1.30, -0.02), tip=(0.78, 0.40, 0.46), out=(1.0, 0.25, 0.0), width=0.34, thick=0.14, taper=0.35)
caster('Smooth guardian wing L', mirror_x(WING), PALE, smooth=True, sharp=40)
caster('Smooth guardian wing R', WING, PALE, smooth=True, sharp=40)
# Wing tips reach forward and clasp the shield rim.
GRIP = egg(top=(0.70, 1.05, -0.10), tip=(0.555, 1.01, -0.715), out=(1.0, 0.1, 0.0), width=0.12, thick=0.075,
           taper=0.25, ns=9, na=12)
caster('Smooth guardian wingtip L', mirror_x(GRIP), PALE, smooth=True, sharp=40)
caster('Smooth guardian wingtip R', GRIP, PALE, smooth=True, sharp=40)
caster('Smooth guardian tail', [(-0.20, 0.66, 0.60), (0.20, 0.66, 0.60), (-0.27, 0.29, 0.66), (0.27, 0.29, 0.66),
                                (-0.15, 0.29, 1.02), (0.15, 0.29, 1.02), (-0.13, 0.37, 1.00), (0.13, 0.37, 1.00),
                                (0.0, 0.72, 0.62)], PALE, smooth=True, sharp=40)
for i, x in enumerate((-0.33, -0.13, 0.13, 0.33)):
    pts = egg((x, 0.37, -0.52), (x * 1.08, 0.315, -0.84), (0, 1, 0), 0.055, 0.05, taper=0.4, ns=8, na=10)
    pts.append((x * 1.08, 0.29, -0.885))
    caster('Smooth guardian talon %d' % (i + 1), pts, PALE, cuts=[((0, 0.29, 0), (0, -1, 0))], smooth=True, sharp=40)

# Mirror-shield: 24-sided flat disc facing -Z on a bevelled gold backplate.
caster('Smooth guardian mirror', circle_z(0, SHIELD_Y, SHIELD_R, SHIELD_BACK) + circle_z(0, SHIELD_Y, SHIELD_R, SHIELD_FRONT),
       MIRROR, smooth=True, sharp=40)
caster('Smooth guardian shield rim', circle_z(0, SHIELD_Y, 0.585, -0.575, 32) + circle_z(0, SHIELD_Y, 0.585, -0.645, 32)
       + circle_z(0, SHIELD_Y, 0.555, -0.675, 32), GOLD, smooth=True, sharp=40)

# ------------------------------------------------------------------ build: flush visual details
for sx, tag in ((-1, 'L'), (1, 'R')):
    loop = [(sx * EYE_X + EYE_R * math.sin(k * TAU / 24), EYE_Y + EYE_R * math.cos(k * TAU / 24)) for k in range(24)]
    prism('Guardian eye ' + tag, loop, FACE_Z + 0.010, FACE_Z - PROUD, RECESS)

# Carved groove around the flat facial disc, from the real cut polygon (game z = -blender y).
face = [(v.co.x, v.co.z) for v in head.data.vertices if abs(-v.co.y - FACE_Z) < 1e-5]
fcx, fcy = sum(p[0] for p in face) / len(face), sum(p[1] for p in face) / len(face)
face.sort(key=lambda p: math.atan2(p[1] - fcy, p[0] - fcx))


def face_loop(s, z):
    return [(fcx + s * (x - fcx), fcy + s * (y - fcy), z) for x, y in face]


annulus('Guardian face groove', face_loop(0.97, FACE_Z + 0.010), face_loop(0.97, FACE_Z - 0.0025),
        face_loop(0.915, FACE_Z + 0.010), face_loop(0.915, FACE_Z - 0.0025), RECESS)
annulus('Guardian plinth inlay', circle_y(1.05, 0.298), circle_y(1.05, 0.30 + PROUD),
        circle_y(1.00, 0.298), circle_y(1.00, 0.30 + PROUD), GOLD)
APOTHEM = 1.2 * math.cos(math.pi / 12)
prism('Guardian plinth emblem', crescent_outline(0.0, 0.135, 0.085, 0.075, 0.04), -APOTHEM + 0.004, -APOTHEM - PROUD, GOLD)


# ------------------------------------------------------------------ checks
def convex_report(ob):
    deps = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(deps)
    geo = ev.to_mesh()
    mw = ev.matrix_world.copy()
    pts = [mw @ v.co for v in geo.vertices]
    part = bmesh.new()
    part.from_mesh(geo)
    part.transform(mw)
    open_edges = sum(1 for e in part.edges if not e.is_manifold)
    part_vol = part.calc_volume(signed=False)
    part.free()
    ev.to_mesh_clear()
    hull = _hull_bm([p.copy() for p in pts])
    hull_vol = hull.calc_volume(signed=False)
    planes = [(f.calc_center_median(), f.normal.copy()) for f in hull.faces if f.calc_area() > 1e-9]
    outside = max(max((p - co).dot(no) for co, no in planes) for p in pts)
    hull.free()
    ok = open_edges == 0 and outside <= 1e-4 and abs(hull_vol - part_vol) <= 0.02 * hull_vol
    print('SHADOW_CONVEX', ob.name, 'ok' if ok else 'FAIL', 'volume=%.5f hull=%.5f outside=%.1e verts=%d open=%d'
          % (part_vol, hull_vol, max(outside, 0.0), len(pts), open_edges), flush=True)
    return ok


def extents(objs):
    """(max game y, max horizontal radius, min game y) over evaluated vertices."""
    deps = bpy.context.evaluated_depsgraph_get()
    top, rad, low = -1e9, 0.0, 1e9
    for ob in objs:
        ev = ob.evaluated_get(deps)
        geo = ev.to_mesh()
        mw = ev.matrix_world
        for v in geo.vertices:
            g = mw @ v.co
            top, low, rad = max(top, g.z), min(low, g.z), max(rad, math.hypot(g.x, g.y))
        ev.to_mesh_clear()
    return top, rad, low


convex_ok = [convex_report(o) for o in casters]
visual = casters + details
H, R, low = extents(visual)
Hc, Rc, _ = extents(casters)
rules_ok = all(convex_ok) and H <= MAX_HEIGHT and R <= MAX_RADIUS and len(casters) <= MAX_PARTS
print('SHADOW_GUARDIAN height=%.3f footprint=%.3f parts=%d' % (H, R, len(casters)),
      'casters_height=%.3f casters_footprint=%.3f base=%.3f details=%d' % (Hc, Rc, low, len(details)),
      'ok' if rules_ok else 'FAIL', flush=True)

# ------------------------------------------------------------------ export
c.export_parts('guardian-casters-v01', casters)  # (b) before the visual export
tris, lo, hi = c.export('guardian-v01', objects=visual, smooth=('Smooth',), remove=False)
print('SHADOW_TRIS', tris, 'ok' if tris <= MAX_TRIS else 'FAIL', flush=True)
eye_z = round(FACE_Z - PROUD, 4)  # front surface of the eye sockets on the flat face
anchors = dict(eyes=[[-EYE_X, EYE_Y, eye_z], [EYE_X, EYE_Y, eye_z]], eyeSize=[2 * EYE_R, 2 * EYE_R],
               height=round(H, 4), footprint=round(R, 4))
with open(os.path.join(c.OUT, 'guardian-anchors-v01.json'), 'w') as f:
    json.dump(anchors, f, indent=1)
print('SHADOW_ANCHORS', json.dumps(anchors), flush=True)

# ------------------------------------------------------------------ previews
WORLD = (.03, .04, .07)
KEY = dict(type='AREA', pos=(-2.6, 4.3, -3.9), target=(0, 1.2, 0), energy=520, color=(1.0, .80, .58), size=1.8)
FILL = dict(type='AREA', pos=(3.9, 1.9, -2.6), target=(0, 1.1, 0), energy=150, color=(.55, .68, 1.0), size=2.8)
c.preview(os.path.join(c.ART, 'guardian-front.png'), (0, 1.6, -5), (0, 1.2, 0), lens=50, res=(1100, 1100),
          samples=24, world=WORLD, lights=(KEY, FILL))
c.preview(os.path.join(c.ART, 'guardian-three-quarter.png'), (3.5, 2.2, -3.8), (0, 1.2, 0), lens=50,
          res=(1100, 1100), samples=24, world=WORLD, lights=(KEY, FILL))
floor = hull_part('Shadow preview floor', [(x, y, z) for x in (-6, 6) for y in (-0.2, 0.0) for z in (-6, 6)],
                  'Shadow floor sanctum')
c.preview(os.path.join(c.ART, 'guardian-shadow.png'), (4, 9, -6), (1.5, 0, 1.5), lens=36, res=(1100, 1100),
          samples=24, world=WORLD,
          lights=(dict(type='POINT', pos=(-3.5, 4.2, -3.5), energy=800, color=(1.0, .86, .68), size=.05),))
bpy.data.objects.remove(floor, do_unlink=True)
print('SHADOW_GUARDIAN_DONE', flush=True)
