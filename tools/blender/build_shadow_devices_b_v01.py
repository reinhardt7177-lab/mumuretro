import sys; sys.dont_write_bytecode=True; sys.path.insert(0,r'D:\mumumetro\tools\blender'); import bpy, bmesh, math; import shadow_temple_common as c; from shadow_temple_common import vec, box, rod, mesh; bpy.ops.wm.read_factory_settings(use_empty=True)
"""Shadow shrine devices B (v01): mirror pedestal/heads/cart/rail/lever, light emitter, receiver.

Game metres through vec() (x right, y up, z forward). One device per export, then a side-by-side preview.
Objects named '~...' are curved closed solids exported with interpolated normals (sharp caps kept).
"""
import os

SAND, SANDL, BRASS, BRASSL = 'Shadow sandstone', 'Shadow sandstone light', 'Shadow brass', 'Shadow brass light'
GOLD, BRONZE, GLASS, CRYSTAL, GLOW = 'Shadow gold', 'Shadow bronze dark', 'Shadow mirror glass', 'Shadow receiver crystal', 'Shadow lamp glow'
M = c.mat


def smooth(o, angle=40):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if not e.is_manifold or e.calc_face_angle(0) > math.radians(angle):
            e.smooth = False
    bm.to_mesh(o.data)
    bm.free()
    o.name = '~' + o.name
    return o


def cyl(name, a, b, r0, r1=None, m=BRASS, n=32, sm=True):
    """Capped cylinder/frustum from a (radius r0) to b (radius r1), game coordinates."""
    av, bv = vec(a), vec(b)
    d = bv - av
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=1, depth=d.length, location=(av + bv) / 2, end_fill_type='NGON')
    o = bpy.context.object
    r1 = r0 if r1 is None else r1
    for v in o.data.vertices:
        s = r1 if v.co.z > 0 else r0
        v.co.x *= s
        v.co.y *= s
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    o.name = name
    o.data.materials.append(M(m))
    return smooth(o) if sm else o


def torus(name, ctr, R, r, m, axis='y', seg=48, mseg=12):
    """Closed torus; axis = game axis of the ring ('z' stands it in the XY plane)."""
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=mseg, location=vec(ctr))
    o = bpy.context.object
    o.rotation_euler = {'y': (0, 0, 0), 'z': (math.pi / 2, 0, 0), 'x': (0, math.pi / 2, 0)}[axis]
    o.name = name
    o.data.materials.append(M(m))
    return smooth(o)


def bx(name, pos, size, m, bevel=.015, yaw=0):
    """Bevelled box; yaw turns local +X toward game (cos yaw, 0, sin yaw)."""
    o = box(name, pos, size, M(m), bevel=bevel)
    o.rotation_euler = (0, 0, -yaw)
    return o


def prism(name, pts, y0, y1, m):
    """Closed vertical prism over an (x, z) outline."""
    n = len(pts)
    verts = [(x, y0, z) for x, z in pts] + [(x, y1, z) for x, z in pts]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return mesh(name, verts, faces, M(m))


def octa(name, ctr, r, m):
    x, y, z = ctr
    v = [(x + r, y, z), (x - r, y, z), (x, y + r, z), (x, y - r, z), (x, y, z + r), (x, y, z - r)]
    f = [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]
    return mesh(name, v, f, M(m))


# ---------------------------------------------------------------- devices (local pivots)
def pedestal(stem_top=.72, cap=True):
    """Floor centre. Stone base 0.7->0.6, stem 0.29->0.21, brass cap r0.4 (0.72-0.80) with 8 rim ticks."""
    cyl('Pedestal base', (0, 0, 0), (0, .24, 0), .7, .6, SAND, 48)
    cyl('Pedestal base collar', (0, .235, 0), (0, .285, 0), .34, .32, SANDL, 32)
    cyl('Pedestal stem', (0, .24, 0), (0, stem_top, 0), .29, .21, SAND, 32)
    cyl('Pedestal stem collar', (0, stem_top - .05, 0), (0, stem_top + .005, 0), .25, .26, SANDL, 32)
    if cap:
        cyl('Pedestal cap', (0, .72, 0), (0, .80, 0), .4, .4, BRASS, 48)
        for i in range(8):
            a = i * math.pi / 4
            big = i % 2 == 0
            bx('Pedestal tick', (.4 * math.cos(a), .76, .4 * math.sin(a)), (.05, .056 if big else .04, .03 if big else .022),
               BRONZE, bevel=.004, yaw=a)


def head(big=True):
    """Pivot = turntable axis on the pedestal/cart top. Glass slab centred on plane z=0; local +X = tangent."""
    if big:
        gw, gh, px, ph, bw, by, tr, tip = 1.7, 1.08, .9, 1.28, 1.9, .6, .24, .47
    else:
        gw, gh, px, ph, bw, by, tr, tip = 1.2, .9, .65, 1.1, 1.4, .51, .2, .34
    bx('Mirror glass', (0, .70, 0), (gw, gh, .02), GLASS, bevel=0)
    for s in (-1, 1):
        bx('Mirror post', (s * px, .70, 0), (.1, ph, .15), GOLD)
        bx('Mirror bar', (0, .70 + s * by, 0), (bw, .1, .15), BRASS)
        bx('Mirror post cap', (s * px, .70 + ph / 2 + .015, 0), (.1, .03, .18), BRASSL, bevel=.008)
    cyl('Mirror turntable', (0, 0, 0), (0, .05, 0), tr, tr, BRASS, 40)
    cyl('Mirror hub', (0, .045, 0), (0, .70 - by - .045, 0), .075, .075, BRASSL, 24)
    # yoke arms: front and back struts from the turntable rim to the lower posts
    for s in (-1, 1):
        for f in (-1, 1):
            smooth(rod('Mirror yoke arm', (s * tr * .62, .03, f * .098), (s * px, .70 - ph / 2 + .2, f * .098), .024, M(BRASSL), vertices=12))
    # pointer tab on -Z pointing at the pedestal rim ticks
    w = .045
    prism('Mirror pointer', [(-w, -tr + .07), (w, -tr + .07), (w, -tip + .07), (0, -tip), (-w, -tip + .07)], .02, .045, BRASSL)
    if big:
        bx('Mirror pointer lip', (0, -.012, -tip + .02), (.03, .09, .02), BRASSL, bevel=.004)


def cart():
    """Floor under the cart centre; double-flanged wheels straddle rails along X at z=+-0.25 (rail top 0.06)."""
    bx('Cart body', (0, .315, 0), (.9, .35, .7), SAND, bevel=.03)
    for s in (-1, 1):
        bx('Cart top trim', (0, .475, s * .35), (.94, .045, .045), BRASS, bevel=.01)
        bx('Cart top trim', (s * .45, .475, 0), (.045, .045, .74), BRASS, bevel=.01)
        for f in (-1, 1):
            bx('Cart corner trim', (s * .45, .31, f * .35), (.045, .33, .045), BRASS, bevel=.01)
    bx('Cart foot band', (0, .16, 0), (.925, .04, .725), BRONZE, bevel=.01)
    for x in (-.3, .3):
        cyl('Cart axle', (x, .12, -.31), (x, .12, .31), .022, .022, BRONZE, 12)
        for z in (-.25, .25):
            s = 1 if z > 0 else -1
            cyl('Cart wheel tread', (x, .12, z - .028), (x, .12, z + .028), .06, .06, BRONZE, 24)
            cyl('Cart wheel flange', (x, .12, z - s * .028), (x, .12, z - s * .05), .12, .12, BRONZE, 32)
            cyl('Cart wheel flange', (x, .12, z + s * .028), (x, .12, z + s * .05), .12, .12, BRONZE, 32)
            cyl('Cart wheel hub', (x, .12, z + s * .05), (x, .12, z + s * .066), .05, .04, BRASS, 16)
    cyl('Cart stem collar', (0, .49, 0), (0, .54, 0), .16, .14, BRASSL, 32)
    cyl('Cart stem', (0, .54, 0), (0, .76, 0), .065, .065, BRASS, 20)
    cyl('Cart stem cap', (0, .76, 0), (0, .80, 0), .22, .22, BRASS, 40)


def rail():
    """Rail centre on floor: brass rails along X at z=+-0.25, split sleepers (flange ways), end stops."""
    for z in (-.25, .25):
        bx('Rail', (0, .03, z), (2.9, .06, .05), BRASS, bevel=.01)
        for x in (-1.49, 1.49):
            bx('Rail end stop', (x, .055, z), (.08, .11, .12), BRONZE, bevel=.012)
    for x in (-1, -.5, 0, .5, 1):
        bx('Rail sleeper', (x, .012, 0), (.16, .024, .38), SANDL, bevel=.006)
        for s in (-1, 1):
            bx('Rail sleeper', (x, .012, s * .35), (.16, .024, .08), SANDL, bevel=.006)



def lever():
    """Floor centre: stone base 0.6x0.9x0.5, horizontal brass crank wheel r0.22, arrow plates +X/-X. Top 1.14."""
    bx('Lever base', (0, .45, 0), (.6, .9, .5), SAND, bevel=.03)
    bx('Lever plinth', (0, .05, 0), (.66, .1, .56), SANDL, bevel=.02)
    bx('Lever belt', (0, .81, 0), (.62, .05, .52), SANDL, bevel=.012)
    cz = .04
    cyl('Lever bearing', (0, .895, cz), (0, .95, cz), .085, .07, BRASSL, 24)
    cyl('Lever spindle', (0, .95, cz), (0, 1.0, cz), .035, .035, BRASS, 16)
    torus('Lever crank rim', (0, 1.0, cz), .198, .022, BRASS, 'y', 40, 10)
    cyl('Lever crank hub', (0, .975, cz), (0, 1.035, cz), .06, .055, BRASSL, 24)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        smooth(rod('Lever crank spoke', (0, 1.0, cz), (.19 * math.cos(a), 1.0, cz + .19 * math.sin(a)), .014, M(BRASS), vertices=8))
    a = -math.pi / 2
    hx, hz = .198 * math.cos(a), cz + .198 * math.sin(a)
    cyl('Lever crank handle', (hx, .99, hz), (hx, 1.1, hz), .022, .022, BRONZE, 12)
    cyl('Lever crank knob', (hx, 1.09, hz), (hx, 1.14, hz), .04, .033, BRASSL, 16)
    zc, t0, t1, hw, hh = -.19, .05, .27, .013, .036
    for s in (-1, 1):
        prism('Lever arrow', [(s * t0, zc - hw), (s * .17, zc - hw), (s * .17, zc - hh), (s * t1, zc),
                              (s * .17, zc + hh), (s * .17, zc + hw), (s * t0, zc + hw)], .9, .912, BRASSL)


def emitter():
    """Floor centre: pedestal with stem to 1.1, brass projector along X (r .32 back -> .36 lens), lens faces +X at (0.32,1.5,0)."""
    pedestal(stem_top=1.1, cap=False)
    cyl('Emitter collar', (0, 1.08, 0), (0, 1.12, 0), .27, .26, BRASS, 32)
    bx('Emitter cradle base', (0, 1.13, 0), (.18, .04, .88), BRASS, bevel=.01)
    for s in (-1, 1):
        bx('Emitter cradle arm', (0, 1.36, s * .42), (.18, .5, .04), BRASS, bevel=.012)
        cyl('Emitter pivot', (0, 1.5, s * .32), (0, 1.5, s * .46), .055, .055, BRASSL, 20)
    cyl('Emitter barrel', (-.32, 1.5, 0), (.32, 1.5, 0), .32, .36, BRASS, 40)
    cyl('Emitter back plate', (-.35, 1.5, 0), (-.31, 1.5, 0), .27, .29, BRONZE, 32)
    cyl('Emitter band', (-.2, 1.5, 0), (-.14, 1.5, 0), .345, .35, BRASSL, 40)
    torus('Emitter bezel', (.33, 1.5, 0), .29, .035, BRASSL, 'x', 40, 10)
    cyl('Emitter lens', (.31, 1.5, 0), (.33, 1.5, 0), .245, .245, GLOW, 40, sm=False)


def receiver():
    """Floor centre: slim stem to 0.8, brass fork; gold ring (XY plane), crystal disc, glowing octahedral heart at z -0.05."""
    cyl('Receiver foot', (0, 0, 0), (0, .12, 0), .38, .32, SAND, 40)
    cyl('Receiver foot collar', (0, .115, 0), (0, .165, 0), .2, .18, SANDL, 32)
    cyl('Receiver stem', (0, .12, 0), (0, .80, 0), .13, .10, SAND, 32)
    cyl('Receiver fork collar', (0, .76, 0), (0, .85, 0), .14, .12, BRASS, 32)
    for s in (-1, 1):
        smooth(rod('Receiver fork prong', (s * .05, .82, 0), (s * .40, 1.14, 0), .035, M(BRASS), vertices=12))
        cyl('Receiver fork clamp', (s * .40, 1.14, -.12), (s * .40, 1.14, .12), .05, .05, BRASSL, 16)
    torus('Receiver ring', (0, 1.5, 0), .54, .095, GOLD, 'z', 48, 12)
    cyl('Receiver crystal', (0, 1.5, -.02), (0, 1.5, .02), .46, .46, CRYSTAL, 48)
    octa('Receiver heart', (0, 1.5, -.05), .18, GLOW)


DEVICES = [('mirror-pedestal-v01', pedestal), ('mirror-head-v01', lambda: head(True)),
           ('mirror-head-small-v01', lambda: head(False)), ('mirror-cart-v01', cart), ('mirror-rail-v01', rail),
           ('mirror-lever-v01', lever), ('light-emitter-v01', emitter), ('mirror-receiver-v01', receiver)]

for name, build in DEVICES:
    build()
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    print('SHADOW_CHECK', name, len(objs), 'objects', c.non_manifold_edges(objs), 'non-manifold edges', flush=True)
    tris, lo, hi = c.export(name, save_blend=False, smooth=('~',))
    if tris > 4000:
        print('SHADOW_WARN', name, 'over 4k triangles', flush=True)
    c.clear()


# ---------------------------------------------------------------- side-by-side preview (not exported)
def place(build, off):
    before = {o.name for o in bpy.data.objects}
    build()
    for o in [o for o in bpy.data.objects if o.name not in before]:
        o.location += vec(off)


X = [3.4, 5.7, 8.0, 10.3, 12.6]   # 2.3 spacing, centred on the preview camera (x 8)
place(emitter, (X[0], 0, 0))
place(pedestal, (X[1], 0, 0)); place(lambda: head(True), (X[1], .8, 0))
place(rail, (X[2], 0, 0)); place(cart, (X[2] + .35, 0, 0)); place(lambda: head(False), (X[2] + .35, .8, 0))
place(lever, (X[3], 0, 0))
place(receiver, (X[4], 0, 0))
bx('Preview floor', (8, -.05, 6), (60, .1, 40), 'Shadow floor slate', bevel=0)
c.preview(os.path.join(c.ART, 'devices-b.png'), eye=(8, 3.2, -8.5), target=(8, 1.2, 0), lens=28, res=(1600, 800), samples=16,
          world=(.03, .04, .07),
          lights=[dict(type='AREA', pos=(4, 6, -5), energy=1100, color=(1, .85, .65), size=3, target=(8, 1, 0)),
                  dict(type='SUN', pos=(10, 20, -5), energy=.5, color=(.75, .82, 1), target=(8, 0, 0))])
print('SHADOW_DONE', flush=True)
