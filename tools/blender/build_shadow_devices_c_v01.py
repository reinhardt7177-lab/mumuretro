import sys; sys.dont_write_bytecode=True; sys.path.insert(0,r'D:\mumumetro\tools\blender'); import bpy, bmesh, math; import shadow_temple_common as c; from shadow_temple_common import vec, box, rod, mesh; bpy.ops.wm.read_factory_settings(use_empty=True)
"""Shadow shrine devices C (v01): lamp stand, panel cart, sanctum lamp/hanger/trolley, direction wheel, height grip.

Game metres through vec() (x right, y up, z forward). One device per export, then a preview sheet
art/shadow-temple/v01/devices-c.png. Closed solids only; objects named 'Smooth ...' keep smooth normals.
"""
import os

TAU = math.tau
M = c.mat
AX = {'x': (0, math.pi / 2, 0), 'y': (0, 0, 0), 'z': (math.pi / 2, 0, 0)}  # primitive axis -> Blender rotation


def nrm(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free()
    return o


def sm(o, ang=35):
    """Smooth shading, sharp above ang degrees; the 'Smooth' prefix keeps these normals in c.export."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        e.smooth = e.is_manifold and e.calc_face_angle(9.0) <= math.radians(ang)
    bm.to_mesh(o.data); bm.free()
    if not o.name.startswith('Smooth'):
        o.name = 'Smooth ' + o.name
    return o


def fin(o, name, mat):
    o.name = name
    o.data.materials.append(M(mat))
    return o


def cyl(name, pos, r, h, mat, axis='y', n=24, r2=None):
    """Capped cylinder (frustum when r2 is given, r at the -axis end) centred on pos."""
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=h, location=vec(pos), rotation=AX[axis])
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r, radius2=r2, depth=h, location=vec(pos), rotation=AX[axis])
    return sm(fin(bpy.context.object, name, mat))


def tor(name, pos, R, r, mat, axis='y', n=48, m=10):
    bpy.ops.mesh.primitive_torus_add(major_segments=n, minor_segments=m, major_radius=R, minor_radius=r,
                                     location=vec(pos), rotation=AX[axis])
    return sm(fin(bpy.context.object, name, mat), 60)


def ball(name, pos, r, mat, n=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=n, ring_count=rings, radius=r, location=vec(pos))
    return sm(fin(bpy.context.object, name, mat), 60)


def bar(name, a, b, r, mat, n=12):
    return sm(rod(name, a, b, r, M(mat), vertices=n))


def lathe(name, prof, mat, pos=(0, 0, 0), axis='y', n=32, ang=35):
    """Closed solid of revolution; prof = [(radius, height along axis)], capped at both ends."""
    def p(r, a, h):
        u, w = r * math.cos(a), r * math.sin(a)
        q = {'y': (u, h, w), 'x': (h, u, w), 'z': (u, w, h)}[axis]
        return tuple(pos[i] + q[i] for i in range(3))
    V = [p(r, TAU * s / n, h) for r, h in prof for s in range(n)]
    F = [(j * n + s, j * n + (s + 1) % n, (j + 1) * n + (s + 1) % n, (j + 1) * n + s)
         for j in range(len(prof) - 1) for s in range(n)]
    for j in (0, len(prof) - 1):
        V.append(p(0, 0, prof[j][1]))
        F += [(len(V) - 1, j * n + s, j * n + (s + 1) % n) for s in range(n)]
    return sm(mesh(name, V, F, M(mat)), ang)


def vox(name, xs, ys, zs, fill, mat):
    """Closed surface of the filled cells of a rectilinear grid (grooves and slots without booleans)."""
    nx, ny, nz = len(xs) - 1, len(ys) - 1, len(zs) - 1
    on = lambda i, j, k: 0 <= i < nx and 0 <= j < ny and 0 <= k < nz and fill(i, j, k)
    idx, V, F = {}, [], []

    def v(i, j, k):
        if (i, j, k) not in idx:
            idx[(i, j, k)] = len(V); V.append((xs[i], ys[j], zs[k]))
        return idx[(i, j, k)]
    for i in range(nx):
        for j in range(ny):
            for k in range(nz):
                if not on(i, j, k):
                    continue
                if not on(i - 1, j, k): F.append((v(i, j, k), v(i, j, k + 1), v(i, j + 1, k + 1), v(i, j + 1, k)))
                if not on(i + 1, j, k): F.append((v(i + 1, j, k), v(i + 1, j + 1, k), v(i + 1, j + 1, k + 1), v(i + 1, j, k + 1)))
                if not on(i, j - 1, k): F.append((v(i, j, k), v(i + 1, j, k), v(i + 1, j, k + 1), v(i, j, k + 1)))
                if not on(i, j + 1, k): F.append((v(i, j + 1, k), v(i, j + 1, k + 1), v(i + 1, j + 1, k + 1), v(i + 1, j + 1, k)))
                if not on(i, j, k - 1): F.append((v(i, j, k), v(i, j + 1, k), v(i + 1, j + 1, k), v(i + 1, j, k)))
                if not on(i, j, k + 1): F.append((v(i, j, k + 1), v(i + 1, j, k + 1), v(i + 1, j + 1, k + 1), v(i, j + 1, k + 1)))
    return nrm(mesh(name, V, F, M(mat)))


def bev(o, w, seg=2):
    m = o.modifiers.new('Soft edges', 'BEVEL')
    m.width, m.segments, m.limit_method = w, seg, 'ANGLE'
    return o


def extrude(name, poly, a, b, mat, place):
    """Convex 2D outline extruded between depths a and b; place(p, t) -> game point."""
    n = len(poly)
    V = [place(p, t) for t in (a, b) for p in poly]
    F = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return nrm(mesh(name, V, F, M(mat)))


def prism(name, pts, y0, y1, mat, bevel=0.012):
    """Convex outline [(x, z)] extruded from y0 to y1."""
    return bev(extrude(name, pts, y0, y1, mat, lambda p, t: (p[0], t, p[1])), bevel)


def corbel(name, prof, w, th, mat):
    """Convex (radial u, y) outline, w wide, turned th about +Y (u along (cos th, 0, sin th))."""
    cs, sn = math.cos(th), math.sin(th)
    return extrude(name, prof, -w / 2, w / 2, mat, lambda p, t: (p[0] * cs - t * sn, p[1], p[0] * sn + t * cs))


def rbox(name, pos, size, th, mat, bevel=0.008):
    """box() turned th about +Y (its local x becomes (cos th, 0, sin th))."""
    o = box(name, pos, size, M(mat), bevel=bevel)
    o.rotation_euler = (0, 0, -th)
    return o


# ---------------------------------------------------------------- devices
def lamp_stand():
    """Pivot on the floor under the bulb. Wheels at x=+-0.32 roll along local Z rails; grip at x=+1.35."""
    ball('Bulb', (0, 2.8, 0), 0.18, 'Shadow lamp glow')
    tor('Halo', (0, 2.8, 0), 0.39, 0.03, 'Shadow gold', 'z', 48, 8)
    for s in (-1, 1):
        bar('Halo strut', (0.1 * s, 2.6, 0), (0.336 * s, 2.6, 0), 0.014, 'Shadow gold', 8)
    cyl('Socket', (0, 2.625, 0), 0.12, 0.07, 'Shadow brass light')
    cyl('Post', (0, 1.475, 0), 0.19, 2.25, 'Shadow brass', r2=0.11)
    cyl('Post foot', (0, 0.385, 0), 0.25, 0.07, 'Shadow brass light', n=32)
    cyl('Post band', (0, 0.9, 0), 0.19, 0.08, 'Shadow brass light')
    prism('Deck', [(.35, -.34), (.35, .34), (.28, .4), (-.28, .4), (-.35, .34), (-.35, -.34), (-.28, -.4), (.28, -.4)],
          0.2, 0.35, 'Shadow bronze dark', 0.015)
    prism('Chassis', [(.25, -.3), (.25, .3), (.19, .36), (-.19, .36), (-.25, .3), (-.25, -.3), (-.19, -.36), (.19, -.36)],
          0.05, 0.2, 'Shadow iron dark', 0.01)
    for z in (-0.24, 0.24):
        bar('Axle', (-0.36, 0.1, z), (0.36, 0.1, z), 0.022, 'Shadow iron dark')
        for s in (-1, 1):
            cyl('Wheel', (0.32 * s, 0.1, z), 0.1, 0.05, 'Shadow iron dark', 'x')
            cyl('Wheel hub', (0.353 * s, 0.1, z), 0.045, 0.016, 'Shadow brass light', 'x', 12)
    bar('Handle bar', (0.12, 0.9, 0), (1.35, 0.9, 0), 0.03, 'Shadow brass')
    cyl('Handle grip', (1.35, 0.92, 0), 0.055, 0.34, 'Shadow bronze dark', n=16)
    for y in (0.76, 1.08):
        cyl('Handle cap', (1.35, y, 0), 0.066, 0.02, 'Shadow brass light', n=16)


def panel_cart():
    """Pivot on the floor under the panel front-face centre; the panel front face is the plane z=0."""
    e = [-0.45, -0.41, -0.38, 0.38, 0.41, 0.45]
    groove = lambda i, j: (i in (1, 3) and 1 <= j <= 3) or (j in (1, 3) and 1 <= i <= 3)
    vox('Panel', e, [2.8 + q for q in e], [0.0, 0.004, 0.06], lambda i, j, k: k == 1 or not groove(i, j), 'Shadow panel ink')
    t = [-0.4095, -0.3805, 0.3805, 0.4095]
    vox('Panel trim', t, [2.8 + q for q in t], [0.001, 0.004], lambda i, j, k: not (i == 1 and j == 1), 'Shadow gold')
    box('Panel bracket', (0, 2.6, 0.0755), (0.2, 0.5, 0.03), M('Shadow brass light'), bevel=0.006)
    box('Stem clamp', (0, 2.33, 0.1105), (0.13, 0.12, 0.099), M('Shadow brass light'), bevel=0.01)
    box('Stem', (0, 1.425, 0.105), (0.09, 1.85, 0.09), M('Shadow brass'), bevel=0.01)
    box('Stem foot', (0, 0.54, 0.105), (0.17, 0.08, 0.17), M('Shadow brass light'), bevel=0.012)
    box('Deck', (0, 0.375, 0.105), (0.88, 0.25, 0.65), M('Shadow bronze dark'), bevel=0.02)
    for z in (-0.095, 0.305):
        bar('Axle', (-0.39, 0.16, z), (0.39, 0.16, z), 0.025, 'Shadow iron dark')
        for s in (-1, 1):
            box('Axle hanger', (0.25 * s, 0.2, z), (0.05, 0.12, 0.09), M('Shadow iron dark'), bevel=0.008)
            cyl('Wheel', (0.34 * s, 0.16, z), 0.16, 0.07, 'Shadow iron dark', 'x', 28)
            cyl('Wheel hub', (0.383 * s, 0.16, z), 0.06, 0.016, 'Shadow brass light', 'x', 16)
    box('Handle collar', (0, 0.72, 0.105), (0.13, 0.1, 0.13), M('Shadow brass light'), bevel=0.01)
    bar('Handle bar', (0.05, 0.72, 0.105), (1.35, 0.72, 0.105), 0.03, 'Shadow brass')
    cyl('Handle grip', (1.35, 0.82, 0.105), 0.055, 0.34, 'Shadow bronze dark', n=16)
    for y in (0.66, 0.98):
        cyl('Handle cap', (1.35, y, 0.105), 0.066, 0.02, 'Shadow brass light', n=16)


def sanctum_lamp():
    """Pivot at the light centre; the hanger meets the cap top at y 0.46."""
    ball('Lamp glow', (0, 0, 0), 0.22, 'Shadow lamp glow', 32, 16)
    for y in (0.32, -0.32):
        cyl('Lamp disc', (0, y, 0), 0.34, 0.12, 'Shadow gold', n=40)
    for i in range(8):
        a = TAU * (i + 0.5) / 8
        x, z = 0.29 * math.cos(a), 0.29 * math.sin(a)
        bar('Cage bar', (x, -0.27, z), (x, 0.27, z), 0.018, 'Shadow brass', 8)
    lathe('Lamp cap', [(0.24, 0.37), (0.24, 0.4), (0.12, 0.435), (0.055, 0.44), (0.055, 0.46)], 'Shadow brass light')
    lathe('Lamp foot', [(0.2, -0.37), (0.2, -0.395), (0.07, -0.42)], 'Shadow brass light')


def hanger():
    """Unit rod: scale local Y to the hanging length."""
    bar('Hanger', (0, 0, 0), (0, 1, 0), 0.035, 'Shadow brass', 12)


def trolley():
    """Pivot on the rail centre line (tube r 0.035 along local X, top y 0.035); hook bottom at y -0.08."""
    g = [(0.076, -0.05), (0.076, -0.036), (0.067, -0.03)]
    g += [(0.085 - math.sqrt(0.035 ** 2 - t * t), t) for t in (-0.02, -0.01, 0.0, 0.01, 0.02)]
    g += [(0.067, 0.03), (0.076, 0.036), (0.076, 0.05)]
    for x in (-0.075, 0.075):
        lathe('Grooved wheel', g, 'Shadow bronze dark', (x, 0.085, 0), 'z', 24)
        cyl('Wheel axle', (x, 0.085, 0), 0.012, 0.15, 'Shadow iron dark', 'z', 12)
    for z in (-0.061, 0.061):
        box('Side plate', (0, 0.06, z), (0.28, 0.23, 0.014), M('Shadow brass'), bevel=0.005)
    box('Bridge', (0, 0.192, 0), (0.3, 0.036, 0.16), M('Shadow brass light'), bevel=0.008)
    lathe('Bridge boss', [(0.05, 0.205), (0.05, 0.235), (0.03, 0.25)], 'Shadow brass', n=20)
    box('Yoke', (0, -0.05, 0), (0.1, 0.02, 0.15), M('Shadow brass'), bevel=0.004)
    lathe('Hook socket', [(0.046, -0.08), (0.046, -0.07), (0.024, -0.064), (0.02, -0.045)], 'Shadow brass light', n=24)



def pedestal(top):
    """Stone pedestal r 0.83 -> 0.68 (y 0-0.24) and stem r 0.36 -> 0.24 up to y=top."""
    lathe('Pedestal', [(0.83, 0), (0.83, 0.05), (0.7, 0.225), (0.68, 0.24), (0.36, 0.24), (0.24, top)], 'Shadow sandstone', n=48)
    tor('Pedestal bead', (0, 0.262, 0), 0.36 - 0.12 * 0.022 / (top - 0.24), 0.022, 'Shadow sandstone light', 'y', 40, 6)


def direction_base():
    """Floor centre; the rotor centre sits at y 1.17 above the bearing boss (top y 1.10)."""
    pedestal(0.96)
    cyl('Table collar', (0, 0.99, 0), 0.3, 0.06, 'Shadow sandstone', n=40)
    for i in range(8):
        corbel('Corbel', [(0.22, 0.9), (0.255, 0.9), (0.56, 0.995), (0.56, 1.021), (0.22, 1.021)], 0.07,
               TAU * (i + 0.5) / 8, 'Shadow sandstone')
    cyl('Dial table', (0, 1.0425, 0), 0.82, 0.045, 'Shadow bronze dark', n=64)
    for i in range(8):
        a = TAU * i / 8
        rbox('Tick', (0.77 * math.cos(a), 1.08, 0.77 * math.sin(a)), (0.08, 0.03, 0.05), a, 'Shadow sandstone light', 0.006)
    lathe('Bearing boss', [(0.17, 1.06), (0.17, 1.08), (0.14, 1.1)], 'Shadow brass')


def rotor():
    """Pivot at the rotor centre (world y 1.17 on the base); glowing knob on the rim at -X."""
    tor('Rotor ring', (0, 0, 0), 0.61, 0.08, 'Shadow gold', 'y', 48, 12)
    lathe('Rotor hub', [(0.15, -0.07), (0.15, 0.04), (0.11, 0.075), (0.05, 0.095)], 'Shadow brass light')
    for i in range(8):
        a = TAU * i / 8
        bar('Spoke', (0.12 * math.cos(a), 0, 0.12 * math.sin(a)), (0.57 * math.cos(a), 0, 0.57 * math.sin(a)), 0.026, 'Shadow brass', 10)
    ball('Rotor knob', (-0.58, 0.09, 0), 0.12, 'Shadow lamp glow')


def grip_base():
    """Floor centre; the knob centre rides at z=-0.20 with its tongue in the -Z slot, docking at the rungs."""
    pedestal(0.8)
    box('Rail shoe', (0, 0.83, 0), (0.24, 0.07, 0.26), M('Shadow brass light'), bevel=0.01)
    bev(vox('Slotted rail', [-0.07, -0.025, 0.025, 0.07], [0.795, 0.88, 1.86, 1.945], [-0.08, -0.03, 0.08],
            lambda i, j, k: not (i == 1 and j == 1 and k == 0), 'Shadow brass'), 0.006)
    for y in (0.98, 1.37, 1.76):
        box('Rung', (0, y, -0.115), (0.52, 0.06, 0.19), M('Shadow sandstone light'), bevel=0.01)


def grip_knob():
    """Pivot at the knob centre; rounded (stadium) ends, tongue on +Z (z 0.11-0.165) enters the rail slot."""
    r, cx = 0.07, 0.27
    pts = [(cx + r * math.cos(a), r * math.sin(a)) for a in (-math.pi / 2 + math.pi * k / 10 for k in range(11))]
    pts += [(-x, -y) for x, y in pts]
    sm(bev(extrude('Knob', pts, -0.12, 0.12, 'Shadow gold', lambda p, t: (p[0], p[1], t)), 0.012))
    box('Knob tongue', (0, 0, 0.138), (0.045, 0.1, 0.055), M('Shadow brass'), bevel=0.005)


DEVICES = [('silhouette-lamp-stand-v01', lamp_stand), ('silhouette-panel-cart-v01', panel_cart),
           ('sanctum-lamp-v01', sanctum_lamp), ('sanctum-hanger-v01', hanger), ('sanctum-trolley-v01', trolley),
           ('direction-wheel-base-v01', direction_base), ('direction-wheel-rotor-v01', rotor),
           ('height-grip-base-v01', grip_base), ('height-grip-knob-v01', grip_knob)]


def build(fn, offset=(0, 0, 0)):
    before = set(bpy.data.objects.keys())
    fn()
    new = [o for o in bpy.data.objects if o.name not in before]
    for o in new:
        o.location += vec(offset)
    return new


def bounds(objs):
    deps = bpy.context.evaluated_depsgraph_get()
    lo, hi = [1e9] * 3, [-1e9] * 3
    for o in objs:
        ev = o.evaluated_get(deps); me = ev.to_mesh()
        for v in me.vertices:
            g = c._game(ev.matrix_world @ v.co, (0, 0, 0))
            lo = [min(a, b) for a, b in zip(lo, g)]; hi = [max(a, b) for a, b in zip(hi, g)]
        ev.to_mesh_clear()
    return [round(v, 4) for v in lo], [round(v, 4) for v in hi]


c.clear()
for name, fn in DEVICES:
    objs = build(fn)
    info = ''
    if fn is lamp_stand:
        info = 'radius_without_handle %.4f' % c.max_radius([o for o in objs if 'Handle' not in o.name])
    elif fn is panel_cart:
        info = 'panel %s trim %s' % (bounds([o for o in objs if o.name == 'Panel']), bounds([o for o in objs if 'trim' in o.name]))
    print('SHADOW_CHECK', name, 'objects', len(objs), 'non_manifold', c.non_manifold_edges(objs), info, flush=True)
    c.export(name, save_blend=False, smooth=('Smooth',))
    c.clear()

# Preview sheet: slots 2.2 m apart; rotor and knob mounted on their bases; a preview-only rail under the trolley.
for fn, off in [(lamp_stand, (0, 0, 0)), (panel_cart, (2.2, 0, 0)), (sanctum_lamp, (4.4, 1.5, 0)),
                (hanger, (6.6, 0.9, 0)), (trolley, (8.8, 1.6, 0)), (direction_base, (11.0, 0, 0)),
                (rotor, (11.0, 1.17, 0)), (grip_base, (13.2, 0, 0)), (grip_knob, (13.2, 0.98, -0.2))]:
    build(fn, off)
bar('Preview rail', (8.2, 1.6, 0), (9.4, 1.6, 0), 0.035, 'Shadow iron dark', 16)
# The requested eye (9,3.5,-9) sees only x ~2.9..15.1 at z=0 with a 28 mm lens; eye/target are
# re-centred on the row and pulled back so every slot (x -0.5..14.1) is in frame. Other settings as requested.
c.preview(os.path.join(c.ART, 'devices-c.png'), eye=(6.8, 3.5, -12.5), target=(6.8, 1.4, 0), lens=28, res=(1600, 800),
          samples=16, world=(.03, .04, .07),
          lights=[dict(type='AREA', pos=(5, 6, -5), energy=1100, color=(1, .85, .65), size=3, target=(9, 1, 0)),
                  dict(type='SUN', pos=(10, 20, -5), energy=.5, color=(.75, .82, 1), target=(9, 0, 0))])
print('SHADOW_DONE', flush=True)
