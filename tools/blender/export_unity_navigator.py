"""Convert preserved glTF sources to Unity-native FBX, including locomotion clips."""
import bpy, os, json, struct
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
out=os.path.join(root,'unity/MumuPlanet/Assets/Mumu/Models')
os.makedirs(out,exist_ok=True)
report=[]
with open(os.path.join(root,'assets/characters/sky-navigator/navigator-v01.glb'),'rb') as f:data=f.read()
length=struct.unpack_from('<I',data,12)[0]
gltf=json.loads(data[20:20+length])
for index,image in enumerate(gltf.get('images',[])):
    view=gltf['bufferViews'][image['bufferView']]
    begin=28+length+view.get('byteOffset',0)
    with open(os.path.join(out,f'NavigatorTexture{index}.png'),'wb') as f:f.write(data[begin:begin+view['byteLength']])
for name,source in [('Navigator','rigged'),('Walk','walking'),('Run','running')]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(root,f'art/sky-navigator/source/navigator-{source}-v01.glb'))
    arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    # glTF importer creates hidden icospheres as bone handles. They are editor
    # helpers, not character geometry; FBX otherwise exports them as real meshes.
    handles={bone.custom_shape for bone in arm.pose.bones if bone.custom_shape}
    for bone in arm.pose.bones:bone.custom_shape=None
    for handle in handles:bpy.data.objects.remove(handle,do_unlink=True)
    # One identical hierarchy for every clip. Remove horizontal root travel.
    arm.name='NavigatorRig'
    for action in bpy.data.actions:
        action.name=name
        for curve in action.fcurves:
            if curve.data_path=='pose.bones["Hips"].location' and curve.array_index in (0,1):
                if curve.keyframe_points:
                    value=curve.keyframe_points[0].co.y
                    for point in curve.keyframe_points:
                        point.co.y=value;point.handle_left.y=value;point.handle_right.y=value
    bpy.ops.export_scene.fbx(filepath=os.path.join(out,name+'.fbx'),object_types={'ARMATURE','MESH'},
        axis_forward='-Z',axis_up='Y',add_leaf_bones=False,use_armature_deform_only=True,
        bake_anim=True,bake_anim_use_nla_strips=False,bake_anim_use_all_actions=True,
        bake_anim_simplify_factor=0,path_mode='STRIP',embed_textures=False)
    report.append({'name':name,'bones':len(arm.data.bones),'actions':[a.name for a in bpy.data.actions]})
with open(os.path.join(out,'export-report.json'),'w') as f:json.dump(report,f,indent=2)
print('UNITY_EXPORT',json.dumps(report))
