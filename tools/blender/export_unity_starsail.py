"""Export the preserved Starsail v02 source as a small Unity-ready static FBX."""
import bpy
import json
import os

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
output = os.path.join(root, 'unity/MumuPlanet/Assets/Mumu/Models/Starsail')
os.makedirs(output, exist_ok=True)

for obj in list(bpy.data.objects):
    if obj.type not in {'MESH', 'CURVE'}:
        bpy.data.objects.remove(obj, do_unlink=True)

# Keep the editable .blend untouched. Curves become export meshes only in memory.
for obj in list(bpy.data.objects):
    if obj.type == 'CURVE':
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')

palette = {}
groups = {}
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    material = obj.data.materials[0] if obj.data.materials else None
    if material is None:
        continue
    name = material.name
    groups.setdefault(name, []).append(obj)
    palette[name] = {
        'color': [round(c, 6) for c in material.diffuse_color[:3]],
        'metal': float(material.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value)
        if material.use_nodes else 0,
        'emission': 'glass' in name.lower(),
    }

for name, objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = name

bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        obj.select_set(True)
bpy.context.view_layer.objects.active = next(obj for obj in bpy.data.objects if obj.type == 'MESH')
bpy.ops.export_scene.fbx(
    filepath=os.path.join(output, 'starsail-v02.fbx'),
    use_selection=True,
    object_types={'MESH'},
    axis_forward='-Z',
    axis_up='Y',
    bake_anim=False,
    path_mode='STRIP',
)
with open(os.path.join(output, 'palette.json'), 'w', encoding='utf-8') as f:
    json.dump({'materials': [{'name': k, **v} for k, v in palette.items()]}, f, ensure_ascii=False, indent=2)
print('STARSAIL_UNITY_EXPORT', len(groups), 'material batches')
