"""Shared palette, exporter and preview helpers for the Unity shadow shrine (v01).

Author everything in game metres through vec(): Y up, floor datum Y=0, forward +Z
(the player walks toward +Z). Blender renders show the left-right mirror image of Unity.
Design and dimensions: art/shadow-temple/DESIGN-v01.md.
"""
import bpy, bmesh, math, os, json, sys
from mathutils import Vector
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(__file__))
from asset_detail_helpers import ROOT, vec, box, rod, mesh, line, ring  # noqa: F401 (re-exported)

ART = os.path.join(ROOT, 'art/shadow-temple/v01')
OUT = os.path.join(ROOT, 'unity/MumuPlanet/Assets/Mumu/Models/ShadowTemple')

# name: (sRGB hex, metallic, roughness, emission strength). Unity reads the same names.
PALETTE = {
    'Shadow sandstone': ('c7bc9c', 0, .85, 0),
    'Shadow sandstone light': ('e7dab8', 0, .8, 0),
    'Shadow sandstone shade': ('888579', 0, .9, 0),
    'Shadow floor warm': ('b9ae91', 0, .9, 0),
    'Shadow floor warm alt': ('b4a98c', 0, .9, 0),
    'Shadow floor slate': ('555b69', 0, .7, 0),
    'Shadow floor slate alt': ('62697a', 0, .7, 0),
    'Shadow floor mist': ('8f9ba0', 0, .8, 0),
    'Shadow floor mist alt': ('829398', 0, .8, 0),
    'Shadow floor sanctum': ('9ba9ad', 0, .85, 0),
    'Shadow floor sanctum rim': ('728990', 0, .85, 0),
    'Shadow grout': ('333b4c', 0, .95, 0),
    'Shadow brass': ('a68449', .9, .35, 0),
    'Shadow brass light': ('e3bd73', .9, .3, 0),
    'Shadow bronze dark': ('554c40', .6, .5, 0),
    'Shadow gold': ('d3b574', 1, .25, 0),
    'Shadow iron dark': ('293c4b', .5, .55, 0),
    'Shadow mirror glass': ('9bc6de', .35, .05, 0),
    'Shadow receiver crystal': ('626b7c', .2, .15, 0),
    'Shadow banner cloth': ('1b2750', 0, .9, 0),
    'Shadow banner emblem': ('d3b574', .5, .45, 0),
    'Shadow ivy': ('2e4a2c', 0, .8, 0),
    'Shadow rock': ('4a4540', 0, .95, 0),
    'Shadow rock dark': ('2f2c2a', 0, .95, 0),
    'Shadow horizon mountain': ('1a2238', 0, 1, 0),
    'Shadow window glow': ('ffc97a', 0, .6, 3.0),
    'Shadow lamp glow': ('ffe1a0', 0, .5, 4.0),
    'Shadow rail glow': ('e9e3cd', 0, .5, 1.2),
    'Shadow slate': ('1e2733', 0, .7, 0),
    'Shadow panel ink': ('26343f', 0, .7, 0),
    'Shadow screen paper': ('dfd7b8', 0, .95, 0),
    'Shadow statue stone': ('c7c8bc', 0, .8, 0),
    'Shadow statue pale': ('e6e0ce', 0, .75, 0),
    'Shadow statue recess': ('5c7280', 0, .85, 0),
    'Shadow guardian mirror': ('b9d1ce', .8, .2, 0),
    'Shadow portal night': ('0b1430', 0, 1, 0),
    'Shadow portal day': ('9fd0ff', 0, 1, 1.0),
}


def linear(hexv):
    def f(c):
        c /= 255
        return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
    return tuple(f(int(hexv[i:i + 2], 16)) for i in (0, 2, 4))


def mat(name):
    """Get or create a palette material (colour stored linear in diffuse_color, as the exporter reads it)."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    hexv, metal, rough, emit = PALETTE[name]
    rgb = linear(hexv)
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emit > 0:
        p.inputs['Emission Color'].default_value = (*rgb, 1)
        p.inputs['Emission Strength'].default_value = emit
    m['mumu_emission'] = emit
    m['mumu_roughness'] = rough
    return m


def clear():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)


def _prepare(objects):
    """Curves become meshes; every mesh gets outward normals (closed solids required)."""
    for ob in list(objects):
        if ob.type == 'CURVE':
            bpy.ops.object.select_all(action='DESELECT')
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.convert(target='MESH')
    result = [o for o in bpy.context.scene.objects if o.type == 'MESH' and (objects is None or o.name in {x.name for x in objects if x.name in bpy.data.objects})]
    for ob in result:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(ob.data)
        bm.free()
    return result


def _game(p, origin):
    return [p.x - origin[0], p.z - origin[1], -p.y - origin[2]]


def export(name, origin=(0, 0, 0), objects=None, smooth=(), save_blend=True, remove=True):
    """Write OUT/<name>.json: world-baked triangle soup in game coordinates minus origin, one batch per material.

    smooth: object-name prefixes that keep interpolated normals (curved brass, statue curves).
    """
    os.makedirs(ART, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    scene_objects = list(bpy.context.scene.objects) if objects is None else list(objects)
    targets = _prepare(scene_objects)
    if save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART, name + '.blend'))
    deps = bpy.context.evaluated_depsgraph_get()
    batches, mats = {}, {}
    lo = [1e9] * 3
    hi = [-1e9] * 3
    for ob in targets:
        ev = ob.evaluated_get(deps)
        geo = ev.to_mesh()
        geo.calc_loop_triangles()
        mw = ev.matrix_world
        nm = mw.to_3x3().inverted().transposed()
        use_smooth = bool(smooth) and ob.name.startswith(tuple(smooth))
        for tri in geo.loop_triangles:
            m = geo.materials[tri.material_index] if len(geo.materials) else None
            if m is None:
                raise RuntimeError('Object without palette material: ' + ob.name)
            mats[m.name] = m
            b = batches.setdefault(m.name, dict(material=m.name, vertices=[], normals=[], triangles=[], uv=[]))
            flat = (nm @ tri.normal).normalized()
            for corner, vi in zip(tri.loops, tri.vertices):
                normal = (nm @ geo.corner_normals[corner].vector).normalized() if use_smooth else flat
                g = _game(mw @ geo.vertices[vi].co, origin)
                n = [normal.x, normal.z, -normal.y]
                for i in range(3):
                    lo[i] = min(lo[i], g[i])
                    hi[i] = max(hi[i], g[i])
                b['triangles'].append(len(b['vertices']) // 3)
                b['vertices'] += g
                b['normals'] += n
                axis = max(range(3), key=lambda i: abs(n[i]))
                axes = [i for i in range(3) if i != axis]
                b['uv'] += [g[axes[0]], g[axes[1]]]
        ev.to_mesh_clear()
    materials = []
    for m in mats.values():
        p = m.node_tree.nodes.get('Principled BSDF')
        materials.append(dict(name=m.name, color=list(m.diffuse_color), metal=p.inputs['Metallic'].default_value,
                              roughness=float(m.get('mumu_roughness', p.inputs['Roughness'].default_value)),
                              emission=float(m.get('mumu_emission', 0))))
    data = dict(materials=materials, meshes=list(batches.values()))
    with open(os.path.join(OUT, name + '.json'), 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    tris = sum(len(b['triangles']) // 3 for b in batches.values())
    print('SHADOW_EXPORT', name, tris, 'triangles', len(batches), 'batches',
          'bounds', [round(v, 3) for v in lo], [round(v, 3) for v in hi], flush=True)
    if remove:
        for ob in targets:
            if ob.name in bpy.data.objects:
                bpy.data.objects.remove(ob, do_unlink=True)
    return tris, lo, hi


def export_parts(name, objects, origin=(0, 0, 0)):
    """Write OUT/<name>.json = {"parts":[{"name","vertices":[x,y,z,...]}]} (evaluated, game coordinates)."""
    deps = bpy.context.evaluated_depsgraph_get()
    parts = []
    for ob in objects:
        ev = ob.evaluated_get(deps)
        geo = ev.to_mesh()
        mw = ev.matrix_world
        verts = []
        for v in geo.vertices:
            verts += _game(mw @ v.co, origin)
        parts.append(dict(name=ob.name, vertices=verts))
        ev.to_mesh_clear()
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name + '.json'), 'w') as f:
        json.dump(dict(parts=parts), f, separators=(',', ':'))
    print('SHADOW_PARTS', name, len(parts), 'parts', flush=True)


def max_radius(objects, centre=(0, 0)):
    """Largest horizontal distance of any evaluated vertex from centre (game x,z)."""
    deps = bpy.context.evaluated_depsgraph_get()
    worst = 0
    for ob in objects:
        ev = ob.evaluated_get(deps)
        geo = ev.to_mesh()
        mw = ev.matrix_world
        for v in geo.vertices:
            g = _game(mw @ v.co, (0, 0, 0))
            worst = max(worst, math.hypot(g[0] - centre[0], g[2] - centre[1]))
        ev.to_mesh_clear()
    return worst


def non_manifold_edges(objects):
    count = 0
    for ob in objects:
        if ob.type != 'MESH':
            continue
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        count += sum(1 for e in bm.edges if not e.is_manifold)
        bm.free()
    return count


def look(obj, eye, target):
    obj.location = vec(eye)
    obj.rotation_euler = (vec(target) - vec(eye)).to_track_quat('-Z', 'Y').to_euler()


def preview(path, eye, target, lens=28, ortho=None, res=(1600, 1000), samples=24,
            world=(.012, .018, .045), strength=1.0, lights=()):
    """Cycles still. lights: dicts with type POINT/SUN/AREA, pos, energy, color, size, target (game coords)."""
    scene = bpy.context.scene
    made = []
    cam_data = bpy.data.cameras.new('Shadow preview camera')
    cam = bpy.data.objects.new('Shadow preview camera', cam_data)
    scene.collection.objects.link(cam)
    made.append(cam)
    if ortho:
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = ortho
    else:
        cam_data.lens = lens
    cam_data.clip_end = 2000
    look(cam, eye, target)
    scene.camera = cam
    for spec in lights:
        data = bpy.data.lights.new('Shadow preview light', spec.get('type', 'POINT'))
        data.energy = spec.get('energy', 500)
        data.color = spec.get('color', (1, .85, .6))
        if hasattr(data, 'shadow_soft_size'):
            data.shadow_soft_size = spec.get('size', .1)
        if spec.get('type') == 'AREA':
            data.size = spec.get('size', 2)
        if spec.get('type') == 'SUN':
            data.angle = spec.get('angle', .02)
        ob = bpy.data.objects.new('Shadow preview light', data)
        scene.collection.objects.link(ob)
        ob.location = vec(spec['pos'])
        if 'target' in spec:
            look(ob, spec['pos'], spec['target'])
        made.append(ob)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    if scene.world is None:
        scene.world = bpy.data.worlds.new('Shadow night')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (*world, 1)
    bg.inputs[1].default_value = strength
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.filepath = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    for ob in made:
        bpy.data.objects.remove(ob, do_unlink=True)
    print('SHADOW_RENDER', path, flush=True)
