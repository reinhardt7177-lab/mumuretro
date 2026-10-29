"""Original curved meadow tufts; editable Blender source and actual web GLB."""
import bpy, json, math, random
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/field-meadow/v01'; OUT=ART/'exports'; OUT.mkdir(parents=True,exist_ok=True)
SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf-8')); cfg=SPEC['tufts']
if (ART/'meadow-clusters-v01.blend').exists(): raise RuntimeError('Preserve existing Blender source')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24; scene.cycles.device='CPU'
(ROOT/'tmp/blender-validation').mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.temporary_directory=str(ROOT/'tmp/blender-validation')
scene.render.resolution_x=1200; scene.render.resolution_y=600; scene.render.resolution_percentage=100
scene.world.color=(.2,.25,.3)
material=bpy.data.materials.new('MeadowNeutral_InstanceTint'); material.use_nodes=True
nodes=material.node_tree.nodes; bs=nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=.96
colour=nodes.new('ShaderNodeVertexColor'); colour.layer_name='MeadowShade'; material.node_tree.links.new(colour.outputs['Color'],bs.inputs['Base Color'])
material.diffuse_color=(1,1,1,1); material.use_backface_culling=False
objects=[]; metrics=[]
for variant, height in enumerate(cfg['heights']):
    rng=random.Random(20261026+variant); vertices=[]; faces=[]; shades=[]; coords=[]
    for blade in range(cfg['bladesPerVariant']):
        angle=blade*2.399963+variant*.43+rng.uniform(-.20,.20); c=math.cos(angle); s=math.sin(angle)
        lateral=Vector((-s,c,0)); forward=Vector((c,s,0)); base=Vector(((blade%3-1)*.17+rng.uniform(-.035,.035),(blade//3-1)*.17+rng.uniform(-.035,.035),0))
        length=height*(1 if blade==8 else rng.uniform(.64,.97)); lean=rng.uniform(.025,.08)
        width=rng.uniform(*cfg['bladeWidthRange']); start=len(vertices)
        for level in range(cfg['segmentsPerBlade']+1):
            t=level/cfg['segmentsPerBlade']; centre=base+forward*(lean*t*t+.018*math.sin(t*math.pi))
            centre+=lateral*(rng.uniform(-.012,.012)*math.sin(t*math.pi)); centre.z=length*t
            half=max(.0006,width*(.17 if level==0 else math.sin(math.pi*t)**.72)*.5)
            for sign in [-1,1]:
                point=centre+lateral*(half*sign); vertices.append(tuple(point)); coords.append(((sign+1)/2,t)); shades.append(.73+.26*math.sqrt(t))
        for level in range(cfg['segmentsPerBlade']):
            a=start+level*2; faces.extend([(a,a+1,a+3),(a,a+3,a+2)])
    mesh=bpy.data.meshes.new('CurvedMeadow_'+str(variant)); mesh.from_pydata(vertices,[],faces); mesh.update()
    obj=bpy.data.objects.new('MeadowTuft_'+str(variant),mesh); bpy.context.collection.objects.link(obj); obj.location.x=variant
    mesh.materials.append(material); uv=mesh.uv_layers.new(name='BendWeightUV')
    colors=mesh.color_attributes.new(name='MeadowShade',type='FLOAT_COLOR',domain='CORNER')
    for face in mesh.polygons:
        face.use_smooth=True
        for li in face.loop_indices:
            vi=mesh.loops[li].vertex_index; uv.data[li].uv=coords[vi]; v=shades[vi]; colors.data[li].color=(v,v,v,1)
    obj['meadow_variant']=variant; obj['local_bottom']=0; obj['blades']=cfg['bladesPerVariant']; obj['wind_weight']='TEXCOORD_0.y'
    points=[Vector(v) for v in vertices]; radius=max(math.hypot(v.x,v.y) for v in points)
    metric={'name':obj.name,'vertices':len(vertices),'triangles':len(faces),'blades':cfg['bladesPerVariant'],'minimumY':min(v.z for v in points),'height':max(v.z for v in points),'radius':radius}
    assert metric['triangles']==54 and abs(metric['minimumY'])<1e-9 and abs(metric['height']-height)<1e-6 and radius<cfg['maximumRadius'], repr({'actual':metric,'expectedHeight':height})
    metrics.append(metric); objects.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects: obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
options={'filepath':str(OUT/'meadow-clusters-v01.glb'),'export_format':'GLB','use_selection':True,'export_yup':True,'export_extras':True,'export_normals':True,'export_texcoords':True,'export_materials':'EXPORT'}
properties=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
if 'export_all_vertex_colors' in properties: options['export_all_vertex_colors']=True
bpy.ops.export_scene.gltf(**options)
# The source retains neutral game materials; a separate green preview material
# documents the intended runtime instance tint without baking it twice.
preview=material.copy(); preview.name='PreviewOnly_Green_InstanceTint'
mul=preview.node_tree.nodes.new('ShaderNodeMixRGB'); mul.blend_type='MULTIPLY'; mul.inputs[0].default_value=1; mul.inputs[2].default_value=(.28,.47,.16,1)
preview.node_tree.links.new(preview.node_tree.nodes.get(colour.name).outputs['Color'],mul.inputs[1]); preview.node_tree.links.new(mul.outputs[0],preview.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for obj in objects: obj.data.materials[0]=preview
bpy.ops.mesh.primitive_plane_add(size=200,location=(1.5,0,-.004)); floor=bpy.context.object; floor.name='PreviewOnly_Ground'
floor_mat=bpy.data.materials.new('PreviewOnly_Ground'); floor_mat.diffuse_color=(.24,.29,.19,1); floor.data.materials.append(floor_mat)
bpy.ops.object.light_add(type='AREA',location=(0,-3,5)); key=bpy.context.object; key.data.energy=500; key.data.shape='DISK'; key.data.size=4
bpy.ops.object.camera_add(location=(1.5,-3.8,2.2)); camera=bpy.context.object; camera.rotation_euler=(Vector((1.5,0,.18))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=4.25; scene.camera=camera
scene.render.filepath=str(ART/'tuft-reference.png'); bpy.ops.render.render(write_still=True)
for obj in objects: obj.data.materials[0]=material
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'meadow-clusters-v01.blend'))
(ART/'cluster-metrics.json').write_text(json.dumps({'version':1,'coordinateSystem':'Blender Z-up, GLB Y-up; display offsets are rebased by the loader','meshes':len(objects),'materials':1,'variants':metrics,'triangles':sum(m['triangles'] for m in metrics)},indent=2))
print('MEADOW_METRICS',json.dumps(metrics))
