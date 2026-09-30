"""Export preserved Blender temple parts for the three Unity puzzle rooms."""
import bpy, os, json, sys
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
out=os.path.join(root,'unity/MumuPlanet/Assets/Mumu/Models/Balance')
os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(root,'assets/models/balance-temple-v04.glb'))
parts=['hall_lever','lever','fulcrum','guardian']
if '--audience-only' in sys.argv:parts=['guardian']
elif '--lever-only' not in sys.argv:parts=['hall_order','hall_twin','hall_corridor','crate','plinth','scale','twin_scale','door_leaf']+parts
for name in parts:
    obj=bpy.data.objects[name]
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    for child in obj.children_recursive:child.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.export_scene.fbx(filepath=os.path.join(out,name+'.fbx'),use_selection=True,
        object_types={'EMPTY','MESH'},axis_forward='-Z',axis_up='Y',bake_anim=False,path_mode='STRIP')
materials=[]
for mat in bpy.data.materials:
    node=mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
    materials.append({'name':mat.name,'color':list(node.inputs['Base Color'].default_value if node else mat.diffuse_color),
        'metal':node.inputs['Metallic'].default_value if node else 0})
with open(os.path.join(out,'materials.json'),'w',encoding='utf8') as f:json.dump({'materials':materials},f,indent=2)
print('UNITY_BALANCE_EXPORT',parts)
