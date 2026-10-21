"""Rebake the preserved sculpt against the final UVs and smooth normals.

No external service. The generated source and earlier prepared blend stay intact.
"""
import bpy, os, json, math, time
from mathutils import Vector, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
ART = os.path.join(ROOT, 'art/water-sanctuary/v03')
OUT = os.path.join(ROOT, 'art/engine-transfer/model-data/WaterDeityV03')
bpy.ops.wm.open_mainfile(filepath=os.path.join(ART, 'water-deity-v03.blend'))
targets = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if len(targets) != 1:
    raise RuntimeError('Expected one final UV-mapped body')
target = targets[0]
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(ART, 'source/water-deity-v03-high.glb'))
sources = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
if not sources:
    raise RuntimeError('Missing preserved sculpt')

# Match the original normalization used by the preparer, before local edits.
corners = [o.matrix_world @ Vector(p) for o in sources for p in o.bound_box]
lo = Vector([min(p[i] for p in corners) for i in range(3)])
hi = Vector([max(p[i] for p in corners) for i in range(3)])
center = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
transform = Matrix.Rotation(math.pi, 4, 'Z') @ Matrix.Scale(3.3 / (hi.z - lo.z), 4) @ Matrix.Translation(-center)
for obj in sources:
    obj.data.transform(transform @ obj.matrix_world)
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    for face in obj.data.polygons:
        face.use_smooth = True

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 1
scene.render.bake.use_selected_to_active = True
scene.render.bake.use_clear = True
scene.render.bake.normal_space = 'TANGENT'
scene.render.bake.normal_r = 'POS_X'
scene.render.bake.normal_g = 'POS_Y'
scene.render.bake.normal_b = 'POS_Z'
scene.render.bake.cage_extrusion = .035
scene.render.bake.max_ray_distance = .07
scene.render.bake.margin = 12
scene.render.bake.margin_type = 'EXTEND'
image = bpy.data.images.new('Final sculpt tangent normals', width=2048, height=2048, alpha=False, float_buffer=False)
image.colorspace_settings.name = 'Non-Color'
for material in target.data.materials:
    node = material.node_tree.nodes.new('ShaderNodeTexImage')
    node.name = 'Final sculpt tangent normals'
    node.image = image
    material.node_tree.nodes.active = node
bpy.ops.object.select_all(action='DESELECT')
target.select_set(True)
for obj in sources:
    obj.select_set(True)
bpy.context.view_layer.objects.active = target
print('DEITY_NORMAL_BAKE_START', flush=True)
started = time.time()
bpy.ops.object.bake(type='NORMAL')
image.filepath_raw = os.path.join(OUT, 'mat0-normal-final.png')
image.file_format = 'PNG'
image.save()
image.pack()

# Save an editable final body using the exact normal map destined for Unity.
for material in target.data.materials:
    for node in material.node_tree.nodes:
        if node.type == 'NORMAL_MAP':
            texture_node = material.node_tree.nodes['Final sculpt tangent normals']
            material.node_tree.links.new(texture_node.outputs['Color'], node.inputs['Color'])
for obj in sources:
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART, 'water-deity-v03-final.blend'), compress=True)
report = dict(source='source/water-deity-v03-high.glb', target='water-deity-v03.blend',
              map='mat0-normal-final.png', resolution=list(image.size), space='tangent +X +Y +Z',
              cage_extrusion=.035, max_ray_distance=.07, margin=12, seconds=round(time.time()-started, 2))
with open(os.path.join(ART, 'normal-bake.json'), 'w', encoding='utf-8') as stream:
    json.dump(report, stream, indent=2)
print('DEITY_NORMAL_BAKE_DONE', json.dumps(report), flush=True)
