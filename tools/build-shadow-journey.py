"""Reuse our preserved Blender exports, exact metre anchors, and author a wheel."""
import bpy,bmesh,math,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/shadow-journey/v01';OUT=ROOT/'assets/models/adventure'
SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf8'));OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
parts={};metrics={}
def import_part(name,file,reject=None,offset=0,base_only=False):
 old=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/heritage'/file))
 imported=set(bpy.data.objects)-old;meshes=[];empties=[o for o in imported if o.type!="MESH"];bpy.ops.object.select_all(action="DESELECT")
 for o in list(imported):
  if o.type!='MESH':continue
  if reject and any(reject in m.name for m in o.data.materials):bpy.data.objects.remove(o,do_unlink=True);continue
  world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.select_set(False)
  if base_only:
   bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if max(v.co.z for v in f.verts)>.5001],context='FACES');bm.to_mesh(o.data);bm.free()
   if not o.data.polygons:bpy.data.objects.remove(o,do_unlink=True);continue
  for v in o.data.vertices:v.co.z+=offset
  meshes.append(o)
 for o in empties:bpy.data.objects.remove(o,do_unlink=True)
 parent=bpy.data.objects.new(name,None);scene.collection.objects.link(parent)
 for o in meshes:o.parent=parent
 parts[name]=parent
import_part('MirrorPedestal','mirror-pedestal-v01.glb')
import_part('MirrorFrame','mirror-head-v01.glb','mirror glass',.8)
import_part('ShadeLantern','shade-lamp-v01.glb')
import_part('PanelBase','silhouette-panel-cart-v01.glb',base_only=True)
def material(name,rgb,metal,rough):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=m.diffuse_color;b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough;return m
gold=material('Moon wheel satin gold',SPEC['palette']['gold'],.72,.3)
brass=material('Moon wheel aged brass',SPEC['palette']['brass'],.72,.4)
wheel=bpy.data.objects.new('MirrorWheel',None);scene.collection.objects.link(wheel);parts['MirrorWheel']=wheel;wheel.rotation_euler.x=math.pi/2
bpy.ops.mesh.primitive_torus_add(major_radius=.26,minor_radius=.042,major_segments=32,minor_segments=8);o=bpy.context.object;o.name='Continuous palm rim';o.parent=wheel;o.data.materials.append(gold)
for i in range(4):
 a=i*math.pi/2;v=Vector((math.cos(a)*.21,math.sin(a)*.21,0))
 bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=.014,depth=v.length,location=v/2);o=bpy.context.object;o.name='Wheel spoke';o.rotation_euler=v.to_track_quat('Z','Y').to_euler();o.parent=wheel;o.data.materials.append(brass)
bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.055,depth=.065);o=bpy.context.object;o.parent=wheel;o.data.materials.append(gold)
# Imported GLB materials remain editable, with the common night palette.
for m in bpy.data.materials:
 if not m.use_nodes:continue
 node=m.node_tree.nodes.get('Principled BSDF')
 if not node:continue
 low=m.name.lower()
 if 'sandstone' in low:
  colour=SPEC['palette']['stoneLight' if 'light' in low else 'stone'];m.diffuse_color=(*colour,1);node.inputs['Base Color'].default_value=m.diffuse_color;node.inputs['Roughness'].default_value=.82
 elif 'gold' in low:node.inputs['Base Color'].default_value=(*SPEC['palette']['gold'],1);node.inputs['Metallic'].default_value=.72;node.inputs['Roughness'].default_value=.3
 elif 'lamp glow' in low:
  node.inputs['Base Color'].default_value=(*SPEC['palette']['glow'],1);node.inputs['Emission Color'].default_value=(*SPEC['palette']['glow'],1);node.inputs['Emission Strength'].default_value=2.5
# Merge each material within a part, preserve smooth normals from the native source.
for name,parent in parts.items():
 bymat={}
 for o in list(parent.children):
  if o.type=='MESH':bymat.setdefault(o.data.materials[0].name,[]).append(o)
 for key,objects in bymat.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name+' '+key
  for p in o.data.polygons:
   if name=='MirrorWheel':p.use_smooth=True
  if name=='MirrorWheel':
   mod=o.modifiers.new('Weighted rim normals','WEIGHTED_NORMAL');mod.keep_sharp=True
 for o in parent.children:
  if o.type=='MESH':o.data.calc_loop_triangles()
 verts=[o.matrix_world@v.co for o in parent.children if o.type=='MESH' for v in o.data.vertices]
 lo=[min(v[i] for v in verts) for i in range(3)];hi=[max(v[i] for v in verts) for i in range(3)]
 metrics[name]={'meshes':len([o for o in parent.children if o.type=='MESH']),'triangles':sum(len(o.data.loop_triangles) for o in parent.children if o.type=='MESH'),'blenderBounds':{'min':lo,'max':hi}}
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'moon-optics-v01.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_apply=True)
metrics['glbBytes']=(OUT/'moon-optics-v01.glb').stat().st_size
assert sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))<SPEC['budgets']['trianglesMax']
assert metrics['glbBytes']<SPEC['budgets']['glbBytesMax']
(ART/'model-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
(OUT/'moon-optics-v01.json').write_text(json.dumps(SPEC,indent=2),encoding='utf8')
# Goal studio, not game captures. All parts except the selected one are hidden.
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=1000;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Moon goal world');scene.world.color=(.23,.28,.34)
for p in parts.values():
 for o in p.children:o.hide_render=True
floorMat=material('Goal studio floor',(.06,.1,.13),0,.8)
bpy.ops.mesh.primitive_plane_add(size=40);floor=bpy.context.object;floor.data.materials.append(floorMat);floor.location.z=-.015
for pos,power in [((3,-4,6),650),((-3,1,5),450)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=5;o.rotation_euler=(Vector((0,0,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='PERSP';camera.data.lens_unit='FOV';camera.data.sensor_fit='VERTICAL';camera.data.angle=math.radians(45)
glassMat=material('Design-only optical surface',(.30,.42,.5),.6,.22)
bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,1.5),rotation=(math.pi/2,0,0));glassGoal=bpy.context.object;glassGoal.name='Design only - runtime supplies the optical plane';glassGoal.scale=(.85,.54,1);glassGoal.data.materials.append(glassMat)
goals={'mirror':['MirrorPedestal','MirrorFrame'],'lantern':['ShadeLantern'],'cart-base':['PanelBase'],'wheel':['MirrorWheel']}
for goal,names in goals.items():
 if '--render-goal' in sys.argv and goal!=sys.argv[sys.argv.index('--render-goal')+1]: continue
 floor.location.z=-.65 if goal=='lantern' else -.35 if goal=='wheel' else -.015;glassGoal.hide_render=goal!='mirror'
 for name in names:
  for o in parts[name].children:o.hide_render=False
 target=Vector((0,0,0 if goal=='wheel' else .8 if goal=='lantern' else 1.35 if goal!='cart-base' else .25));distance=1.6 if goal=='wheel' else 5.4 if goal!='cart-base' else 2.6
 for view,angle in [('front',0),('side',math.pi/2),('rear',math.pi)]:
  camera.location=target+Vector((math.sin(angle)*math.cos(.25)*distance,-math.cos(angle)*math.cos(.25)*distance,math.sin(.25)*distance));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ART/(goal+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
 for name in names:
  for o in parts[name].children:o.hide_render=True
for name in ['MirrorPedestal','MirrorFrame']:
 for o in parts[name].children:o.hide_render=False
for name,parent in parts.items():
 for o in parent.children:o.hide_set(name not in ['MirrorPedestal','MirrorFrame'])
glassGoal.hide_render=False;glassGoal.hide_set(False);floor.location.z=-.015
camera.location=(0,-5.4*math.cos(.25),1.35+5.4*math.sin(.25));camera.rotation_euler=(Vector((0,0,1.35))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'moon-optics-v01.blend'))
print('MOON_RESULT '+json.dumps(metrics))
