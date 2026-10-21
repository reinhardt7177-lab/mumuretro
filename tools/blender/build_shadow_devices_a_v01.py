import sys; sys.dont_write_bytecode=True; sys.path.insert(0,r'D:\mumumetro\tools\blender'); import bpy, bmesh, math; import shadow_temple_common as c; from shadow_temple_common import vec, box, rod, mesh; bpy.ops.wm.read_factory_settings(use_empty=True)
"""Shadow shrine devices A (v01): shade pillar, practice pillar, armillary lamp, hint post.

Game metres through vec() (x right, y up, z forward). Each device is built alone in the empty scene,
exported with shadow_temple_common.export, cleared; then all four are rebuilt side by side for the preview.
Closed solids only (lofted prisms with fan caps, bevelled boxes, primitive cylinders/cones/spheres/tori).
"""
import os
from mathutils import Matrix

M, TAU = c.mat, math.tau
LIGHT, STONE, BRASS = 'Shadow sandstone light', 'Shadow sandstone', 'Shadow brass'
FLUTE = ((.28, 0), (.38, .8), (.5, 1), (.62, .8), (.72, 0))  # (fraction along face, share of flute depth)


def loft(name, rings, mat):
    """Closed solid through equal-count rings of game points (bottom to top); both ends fanned to the centroid."""
    n, k = len(rings[0]), len(rings)
    verts = [p for r in rings for p in r]
    verts += [tuple(sum(p[i] for p in r) / n for i in range(3)) for r in (rings[0], rings[-1])]
    b, t, top = k * n, k * n + 1, (k - 1) * n
    faces = [(a * n + i, a * n + (i + 1) % n, (a + 1) * n + (i + 1) % n, (a + 1) * n + i)
             for a in range(k - 1) for i in range(n)]
    faces += [(b, (i + 1) % n, i) for i in range(n)] + [(t, top + i, top + (i + 1) % n) for i in range(n)]
    return mesh(name, verts, faces, M(mat))


def section(R, y, f=None, depth=.025, plain=(), cut=None, ox=0.0):
    """16-gon ring, vertex i at i*22.5 deg from +Z toward +X (x=R sin, z=R cos).
    f: flute depth share (None = plain 16 points); plain: faces without flutes; cut: keep z >= cut."""
    pts = []
    for i in range(16):
        a0, a1 = i * TAU / 16, (i + 1) * TAU / 16
        p0, p1 = (R * math.sin(a0), R * math.cos(a0)), (R * math.sin(a1), R * math.cos(a1))
        pts.append(p0)
        if f is None or i in plain:
            continue
        nx, nz = math.sin(a0 + TAU / 32), math.cos(a0 + TAU / 32)  # outward face normal
        for t, d in FLUTE:  # points lie on the face chord, flutes pushed inward only
            pts.append((p0[0] + (p1[0] - p0[0]) * t - nx * d * depth * f,
                        p0[1] + (p1[1] - p0[1]) * t - nz * d * depth * f))
    if cut is not None:
        out = []
        for i, p in enumerate(pts):
            q = pts[(i + 1) % len(pts)]
            if p[1] >= cut:
                out.append(p)
            if (p[1] >= cut) != (q[1] >= cut):
                s = (cut - p[1]) / (q[1] - p[1])
                out.append((p[0] + (q[0] - p[0]) * s, cut))
        pts = out
    return [(ox + x, y, z) for x, z in pts]


def pillar(pre, R, H, ox=0.0, depth=.025, plain=(), cut=None):
    """Stack of closed 16-gon solids, every vertex within radius R: bands, inset brass rings, fluted shaft, top cap."""
    s = R / .76
    g, ch = .018 * s, .015 * s  # brass ring inset, groove chamfer
    u = lambda v: v * s          # height from the floor
    d = lambda v: H - v * s      # height from the top
    parts = []

    def lathe(nm, prof, mat):
        parts.append(loft(pre + nm, [section(r, y, ox=ox) for r, y in prof], mat))
    lathe(' base band', [(R, 0), (R, u(.20))], LIGHT)
    lathe(' base brass', [(R - g, u(.20)), (R - g, u(.25))], BRASS)
    lathe(' base band upper', [(R, u(.25)), (R, u(.39)), (R - ch, u(.405))], LIGHT)
    lathe(' shaft foot', [(R - ch, u(.405)), (R, u(.42)), (R, u(.50))], STONE)
    parts.append(loft(pre + ' shaft', [section(R, y, f, depth, plain, cut, ox) for y, f in
                                       ((u(.50), 0), (u(.58), 1), (d(.57), 1), (d(.49), 0))], STONE))
    lathe(' shaft neck', [(R, d(.49)), (R, d(.41)), (R - ch, d(.395))], STONE)
    lathe(' capital band lower', [(R - ch, d(.395)), (R, d(.38)), (R, d(.25))], LIGHT)
    lathe(' capital brass', [(R - g, d(.25)), (R - g, d(.20))], BRASS)
    lathe(' capital band', [(R, d(.20)), (R, d(.075)), (R - ch, d(.06))], LIGHT)
    lathe(' top cap', [(R - .025 * s, d(.06)), (R - .025 * s, d(.035)), (R * .5, H)], STONE)
    return parts


def crescent(name, centre, U, V, N, R, w0, w1, mat, n=14, ri=.82, dd=.36):
    """Closed crescent prism: disc R minus disc ri*R offset dd*R toward +U (opens toward +U),
    bounding box centred on centre along U, extruded from w0 to w1 along N."""
    tx = (1 - ri * ri + dd * dd) / (2 * dd)
    ty = math.sqrt(1 - tx * tx)
    a0, b0 = math.atan2(ty, tx), math.atan2(ty, tx - dd)
    O = [(math.cos(a0 + k / n * (TAU - 2 * a0)), math.sin(a0 + k / n * (TAU - 2 * a0))) for k in range(n + 1)]
    I = [(dd + ri * math.cos(b0 + k / n * (TAU - 2 * b0)), ri * math.sin(b0 + k / n * (TAU - 2 * b0)))
         for k in range(n + 1)]
    loop, sh = O + I[n - 1:0:-1], (1 - tx) / 2
    m = len(loop)
    P = lambda a, b, w: tuple(centre[i] + (a + sh) * R * U[i] + b * R * V[i] + w * N[i] for i in range(3))
    verts = [P(a, b, w0) for a, b in loop] + [P(a, b, w1) for a, b in loop]
    ii = lambda k: k if k in (0, n) else 2 * n - k  # index of inner point k (tips shared)
    faces = []
    for k in range(n):
        q = list(dict.fromkeys((k, k + 1, ii(k + 1), ii(k))))
        faces += [tuple(reversed(q)), tuple(m + x for x in q)]
    faces += [(i, (i + 1) % m, m + (i + 1) % m, m + i) for i in range(m)]
    return mesh(name, verts, faces, M(mat))


def prim(parts, op, name, mat, pos, rot=(0, 0, 0), soft=False, **kw):
    op(location=vec(pos), rotation=rot, **kw)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(M(mat))
    if soft:
        for p in o.data.polygons:
            p.use_smooth = True
    parts.append(o)
    return o


def practice(ox=0.0):
    """R 0.6 x 2.4 pillar; -Z corner of the shaft cut flat at z=-0.565 with an inset crescent plaque (front z=-0.575)."""
    parts = pillar('Practice pillar', .6, 2.4, ox, depth=.02, plain=(7, 8), cut=-.565)
    y = 1.3
    parts.append(rod('Practice plaque backing', (ox, y, -.561), (ox, y, -.569), .115, M('Shadow bronze dark'), vertices=24))
    parts.append(crescent('Practice plaque crescent', (ox, y, -.565), (1, 0, 0), (0, 1, 0), (0, 0, -1),
                          .085, -.002, .010, 'Shadow brass light'))
    return parts


def lamp(ox=0.0, oy=0.0):
    """Armillary lamp, pivot = light centre; hanger to y 1.9 with a trolley block (wheels roll along z)."""
    P = lambda x, y, z: (ox + x, oy + y, z)
    o = []
    prim(o, bpy.ops.mesh.primitive_uv_sphere_add, 'Lamp core', 'Shadow lamp glow', P(0, 0, 0), soft=True,
         segments=24, ring_count=12, radius=.3)
    prim(o, bpy.ops.mesh.primitive_torus_add, 'Lamp ring equator', 'Shadow gold', P(0, 0, 0), soft=True,
         major_segments=36, minor_segments=8, major_radius=.47, minor_radius=.03)
    for k, yaw in enumerate((45, -45)):
        prim(o, bpy.ops.mesh.primitive_torus_add, 'Lamp ring meridian %d' % k, 'Shadow gold', P(0, 0, 0),
             (math.pi / 2, 0, math.radians(yaw)), soft=True, major_segments=36, minor_segments=8,
             major_radius=.445, minor_radius=.03)
    o.append(rod('Lamp axis', P(0, -.47, 0), P(0, .47, 0), .02, M(BRASS), vertices=8))
    for k in range(4):
        sx, sz = math.sin(k * TAU / 4), math.cos(k * TAU / 4)
        o.append(rod('Lamp cage bar upper %d' % k, P(.1 * sx, .47, .1 * sz), P(.47 * sx, 0, .47 * sz), .012, M(BRASS), vertices=8))
        o.append(rod('Lamp cage bar lower %d' % k, P(.47 * sx, 0, .47 * sz), P(.06 * sx, -.47, .06 * sz), .012, M(BRASS), vertices=8))
    prim(o, bpy.ops.mesh.primitive_cylinder_add, 'Lamp cap', BRASS, P(0, .485, 0), vertices=24, radius=.12, depth=.06)
    prim(o, bpy.ops.mesh.primitive_cone_add, 'Lamp cap dome', 'Shadow brass light', P(0, .56, 0),
         vertices=24, radius1=.12, radius2=.035, depth=.09)
    prim(o, bpy.ops.mesh.primitive_cylinder_add, 'Lamp foot hub', BRASS, P(0, -.48, 0), vertices=16, radius=.07, depth=.05)
    prim(o, bpy.ops.mesh.primitive_cone_add, 'Lamp foot finial', 'Shadow brass light', P(0, -.55, 0),
         vertices=16, radius1=.012, radius2=.07, depth=.09)
    prim(o, bpy.ops.mesh.primitive_uv_sphere_add, 'Lamp knob', 'Shadow brass light', P(0, -.605, 0), soft=True,
         segments=12, ring_count=6, radius=.028)
    o.append(rod('Lamp hanger', P(0, .59, 0), P(0, 1.9, 0), .03, M('Shadow bronze dark'), vertices=12))
    o.append(box('Lamp trolley', P(0, 1.95, 0), (.16, .12, .24), M('Shadow bronze dark')))
    for wz in (-.06, .06):
        o.append(rod('Lamp trolley wheel', P(-.025, 2.03, wz), P(.025, 2.03, wz), .045, M(BRASS), vertices=16))
    return o


def tilt(objs, pivot, deg):
    """Rotate objects about game pivot around the x axis; +deg leans the top toward +Z."""
    bpy.context.view_layer.update()
    pv = vec(pivot)
    R = Matrix.Translation(pv) @ Matrix.Rotation(math.radians(deg), 4, 'X') @ Matrix.Translation(-pv)
    for o in objs:
        o.matrix_world = R @ o.matrix_world
    bpy.context.view_layer.update()
    return R


def hint_post(ox=0.0):
    """Stone post 0.35 x 1.3 x 0.35 with a brass-framed slate board (1.5 x 0.95 x 0.04, centre (0,1.55,-0.12),
    facing -Z, tilted back 10 deg) and a crescent finial. Returns (parts, board front-face centre in game coords)."""
    P = lambda x, y, z: (ox + x, y, z)
    parts = [box('Hint post plinth', P(0, .08, 0), (.35, .16, .35), M(LIGHT)),
             box('Hint post stone', P(0, .73, 0), (.35, 1.14, .35), M(STONE))]
    C = P(0, 1.55, -.12)
    at = lambda x, y, z: (C[0] + x, C[1] + y, C[2] + z)
    board = [box('Hint board slate', C, (1.5, .95, .04), M('Shadow slate'))]
    for nm, pos, size in (('top', (0, .485, 0), (1.57, .05, .052)), ('bottom', (0, -.485, 0), (1.57, .05, .052)),
                          ('left', (-.76, 0, 0), (.05, .92, .052)), ('right', (.76, 0, 0), (.05, .92, .052))):
        board.append(box('Hint board frame ' + nm, at(*pos), size, M(BRASS)))
    board.append(rod('Hint finial knob', at(0, .50, 0), at(0, .55, 0), .028, M(BRASS), vertices=16))
    board.append(crescent('Hint finial crescent', at(0, .54 + .0818, 0), (0, 1, 0), (1, 0, 0), (0, 0, 1),
                          .1, -.012, .012, 'Shadow gold'))
    R = tilt(board, C, 10)
    f = R @ vec(at(0, 0, -.02))
    return parts + board, (f.x - ox, f.z, -f.y)



def ship(name, parts, limit=None, smooth=()):
    """Check radius / closure, export one device (<= 4k triangles), then clear the scene."""
    bpy.context.view_layer.update()
    if limit:
        r = c.max_radius(parts, (0, 0))
        print('SHADOW_RADIUS', name, r, flush=True)
        assert r <= limit, (name, r)
    bad = c.non_manifold_edges(parts)
    tris = c.export(name, save_blend=False, smooth=smooth)[0]
    print('SHADOW_CLOSED', name, bad, 'non-manifold edges', flush=True)
    assert bad == 0 and tris <= 4000, (name, bad, tris)
    c.clear()


LAMP_SMOOTH = ('Lamp core', 'Lamp ring', 'Lamp knob')
c.clear()
ship('shade-pillar-v01', pillar('Pillar', .76, 3.6), .7601)
ship('shade-practice-pillar-v01', practice(), .6001)
ship('shade-lamp-v01', lamp(), .55, LAMP_SMOOTH)
post, front = hint_post()
print('SHADOW_BOARD', *[round(v, 4) for v in front], 10, flush=True)
ship('hint-post-v01', post)

# Preview: the four side by side (lamp light centre raised to y 1.45 so it hangs above the floor).
pillar('Pillar', .76, 3.6, 0.0)
practice(2.5)
lamp(5.0, 1.45)
hint_post(7.5)
box('Preview floor', (3.7, -.05, 0), (14, .1, 8), M('Shadow floor slate'), bevel=0)
c._prepare(list(bpy.context.scene.objects))
c.preview(os.path.join(c.ART, 'devices-a.png'), eye=(3.7, 3, -8), target=(3.7, 1.6, 0), lens=28, res=(1400, 800),
          samples=16, world=(.03, .04, .07),
          lights=[dict(type='AREA', pos=(0, 6, -5), energy=900, color=(1, .85, .65), size=3, target=(3.7, 1, 0)),
                  dict(type='SUN', pos=(10, 20, -5), energy=.5, color=(.75, .82, 1), target=(3.7, 0, 0))])
print('SHADOW_DONE devices-a', flush=True)
