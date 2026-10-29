"""Editable original sliding stone exit; reuse the existing observation plaque."""
import bpy,bmesh,math,json,ast,sys,shutil
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import export_parts
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/shaft-entry/v01';ART.mkdir(parents=True,exist_ok=True)
BEFORE=json.loads((ROOT/'reports/2026-10-24/evidence/shaft-entry/before/report.json').read_text());V=lambda p:Vector((p[0],-p[2],p[1]))
palette={'stone':[.32,.36,.37],'pale':[.60,.57,.49],'dark':[.09,.12,.13],'bronze':[.48,.34,.18]}
SPEC={'model':'art/shaft-entry/v01/preview.glb','palette':palette,'parts':{},'doorZ':-34.1,'halfWidth':1.06,'leafCenter':1.05,'travel':2.2,'duration':1.1,'height':3.5,'recordPositions':[[-2.75,0,-17.3],[2.75,0,-17.3]]}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;M={};parts={};solids=[]
for key,c in palette.items():
 m=bpy.data.materials.new('Entry '+key);m.diffuse_color=(*c,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.5 if key=='bronze' else .88;bs.inputs['Metallic'].default_value=.5 if key=='bronze' else 0
 if key!='bronze':
  im=bpy.data.images.load(str(ROOT/'art/strata-inlays/v01/limestone-albedo.png'));tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*c,1);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
 M[key]=m
tree=ast.parse((ROOT/'tools/build-moon-courts.py').read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['group','finish','box','poly']],type_ignores=[]),'<shared masonry>','exec'))
def begin(name):
 global solids
 solids=[];p=group(name);SPEC['parts'][name]={'solids':solids};return p
frame=begin('ShaftExitFrame')
for side in [-1,1]:
 # Real front/back pocket walls conceal the sliding slab, without a coplanar skin.
 for z in [-.54,.54]:
  box('Solid pocket wall',(side*3.32,1.95,z),(2.38,3.9,.28),'stone',frame,.03,True)
  for row in range(5):box('Pocket facing stone',(side*3.32,.39+row*.73,z+math.copysign(.18,z)),(2.32,.69,.09),'pale' if row in [0,4] else 'stone',frame,.012)
 box('Outer pocket pier',(side*4.55,2,0),(.30,4,1.6),'pale',frame,.025,True)
 box('Grounded pocket plinth',(side*3.35,.12,0),(2.44,.24,1.7),'dark',frame,.015,True)
box('Supported head track',(0,3.88,0),(9.4,.52,1.2),'pale',frame,.025,True)
for side in[-1,1]:box('Recessed bronze rail',(0,3.56,side*.34),(8.8,.07,.07),'bronze',frame,.008)
leaf=begin('ShaftExitLeaf')
box('Sliding solid slab',(0,1.75,0),(2.12,3.5,.48),'stone',leaf,.035,True)
for side in[-1,1]:
 for row in range(3):
  box('Inset carved stone tablet',(0,.63+row*1.12,side*.255),(1.80,1.0,.09),'pale' if row==1 else 'stone',leaf,.025)
 # Three small, physically attached strata facets, rather than luminous line art.
 for row in range(3):
  box('Bronze strata key',(0,1.40+row*.18,side*.32),(.55-row*.10,.08,.07),'bronze',leaf,.009)
 for x in[-.88,.88]:box('Slab bronze edge shoe',(x,.20,side*.27),(.12,.26,.08),'bronze',leaf,.01)
foundation=begin('ShaftExitFoundation')
box('Door landing foundation',(0,.375,0),(9.65,.75,2.0),'stone',foundation,.025,True)
originals=[o for p in parts.values() for o in p.children];metrics=export_parts(list(parts),SPEC,ART,'shaft-entry-v01','Entry ');exports=[o for p in parts.values() for o in p.children if o not in originals]
for p in parts.values():
 for o in p.children:o.hide_render=True
instances=[]
def instance(name,pos):
 p=bpy.data.objects.new('Goal '+name,None);scene.collection.objects.link(p);p.location=V(pos);instances.append(p)
 for o in parts[name].children:
  if o in exports:c=o.copy();c.data=o.data;scene.collection.objects.link(c);c.parent=p;c.hide_render=False
instance('ShaftExitFrame',[0,0,-34.1])
instance('ShaftExitFoundation',[0,-.75,-34.1])
for x in[-1.05,1.05]:instance('ShaftExitLeaf',[x,0,-34.1])
# Existing authored plaque is reused in the goal, not claimed as a new model.
old=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/adventure/panel-workshop-v01.glb'));imported=set(bpy.data.objects)-old
plaque=next(o for o in imported if o.name.startswith('ObservationPlaque'))
for o in imported:o.hide_render=True
for pos in SPEC['recordPositions']:
 p=bpy.data.objects.new('Goal reused plaque',None);scene.collection.objects.link(p);p.location=V(pos);p.scale=(.65,.65,.65);instances.append(p)
 for o in plaque.children:c=o.copy();c.data=o.data;scene.collection.objects.link(c);c.parent=p;c.hide_render=False
floor=box('Goal ground',(0,-.10,-25),(9,.2,28),'stone',None,.01)
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
for pos,power,size in[([0,9,-26],2400,8),([6,6,-39],1800,8),([-5,7,-15],1800,8)]:
 bpy.ops.object.light_add(type='AREA',location=V(pos));o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(V([0,1.8,-30])-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=10;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.view_settings.view_transform='AgX'
for shot in BEFORE['shots']:
 cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
(ART/'goal-cameras.json').write_text(json.dumps({'scope':'Blender door and reused plaques; no game world or text faces','shots':[{k:s[k] for k in ['id','camera','target','fov','aspect']} for s in BEFORE['shots']]},indent=2))
for p in instances:
 for o in list(p.children):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.objects.remove(p,do_unlink=True)
for o in list(imported)+exports+[floor]:
 if o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
for i,p in enumerate(parts.values()):
 p.location=V([i*12,0,0])
 for o in p.children:o.hide_set(False);o.hide_render=False
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'shaft-entry-v01.blend'));print('PASS',metrics)
