"""Small, deterministic helpers for versioned asset refinement in Blender 4.5.

Coordinates are game metres (Y up), except the authored navigator props.
Never resets an existing scene. Save editable geometry before export batching.
"""
import bpy, math, os, json
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
NATIVE = False

def vec(p):
    return Vector(p if NATIVE else (p[0], -p[2], p[1]))

def material(name, rgb, metal=0, roughness=.55):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = roughness
    return m

def finish(o, name, mat, parent=None):
    o.name = name
    o.data.materials.append(mat)
    o.parent = parent
    return o

def box(name, pos, size, mat, parent=None, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=vec(pos))
    o = bpy.context.object
    o.scale = size if NATIVE else (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('Soft crafted edges', 'BEVEL')
        mod.width = min(bevel, min(size)*.3)
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o, name, mat, parent)

def rod(name, a, b, r, mat, parent=None, vertices=12):
    av, bv = vec(a), vec(b)
    d = bv-av
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=r, depth=d.length, location=(av+bv)/2)
    o = bpy.context.object
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return finish(o, name, mat, parent)

def mesh(name, verts, faces, mat, parent=None):
    d = bpy.data.meshes.new(name)
    d.from_pydata([vec(p) for p in verts], [], faces)
    d.update()
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    return finish(o, name, mat, parent)

def line(name, points, r, mat, parent=None):
    d = bpy.data.curves.new(name, 'CURVE')
    d.dimensions = '3D'
    d.bevel_depth = r
    d.bevel_resolution = 1
    s = d.splines.new('POLY')
    s.points.add(len(points)-1)
    for q, p in zip(s.points, points): q.co = (*vec(p), 1)
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    return finish(o, name, mat, parent)

def ring(name, pos, radius, tube, mat, parent=None, plane='xz', segments=32):
    axes = {'xz': (0,2), 'xy': (0,1), 'yz': (1,2)}[plane]
    points = []
    for i in range(segments+1):
        p = list(pos)
        p[axes[0]] += math.cos(i*math.tau/segments)*radius
        p[axes[1]] += math.sin(i*math.tau/segments)*radius
        points.append(p)
    return line(name, points, tube, mat, parent)

def export(blend, glb, protected=()):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, blend))
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if o.type in {'MESH', 'CURVE'}: o.select_set(True)
    bpy.context.view_layer.objects.active = next(o for o in bpy.context.selected_objects)
    bpy.ops.object.convert(target='MESH')
    buckets = {}
    for o in list(bpy.context.scene.objects):
        # Parent meshes, e.g. the book cover, are animation attachment points.
        if o.type != 'MESH' or o.children or o.name in protected: continue
        key = (o.parent, tuple(o.data.materials))
        buckets.setdefault(key, []).append(o)
    for (parent, mats), objects in buckets.items():
        if len(objects) < 2: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = (parent.name+'_' if parent else '') + mats[0].name
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, glb), export_format='GLB', export_yup=True)
    print('DETAIL_EXPORT', glb, os.path.getsize(os.path.join(ROOT, glb)), 'bytes')
