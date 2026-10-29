"""Editable grounded stone hoist, moving layer wall and counterweights."""
import bpy,bmesh,math,json,ast,sys,shutil
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import export_parts
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/chronicle-portal/v01';ART.mkdir(parents=True,exist_ok=True);V=lambda p:Vector((p[0],-p[2],p[1]))
BEFORE=json.loads((ROOT/'reports/2026-10-24/evidence/chronicle-portal/before/report.json').read_text());C=BEFORE['contract']
palette={'stone':[.29,.31,.33],'pale':[.57,.54,.46],'recess':[.075,.095,.11],'brass':[.49,.34,.16],'layer0':[.17,.19,.21],'layer1':[.24,.26,.28],'layer2':[.34,.35,.35],'layer3':[.46,.45,.41]}
SPEC={'model':'assets/models/adventure/chronicle-portal-v01.glb','palette':palette,'parts':{},'contract':C,'motion':{'travel':3.45,'duration':1.35,'clearance':2.70,'height':4.96,'halfWidth':4.4,'halfDepth':.34,'pulleyY':8.30,'anchorY':4.70,'weightBase':6.30,'weightHeight':1.35,'cableX':4.28,'frontZ':.30,'backZ':-.50},'budget':{'triangles':35000,'bytes':4000000},'scope':'Own stone lifting mechanism, not reconstructed Nintendo geometry or timing'}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;M={};parts={};solids=[];images={}
for name in ['stone-albedo','stone-normal']:
 shutil.copyfile(ROOT/'art/water-courts/v01'/f'{name}.png',ART/f'{name}.png');im=bpy.data.images.load(str(ART/f'{name}.png'));im.colorspace_settings.name='Non-Color' if name.endswith('normal') else 'sRGB';images[name]=im
for key,c in palette.items():
 m=bpy.data.materials.new('Portal '+key);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.4 if key=='brass' else .84;bs.inputs['Metallic'].default_value=.6 if key=='brass' else 0
 if key!='brass':
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=images['stone-albedo'];mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*c,1);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color']);nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.2;nt=m.node_tree.nodes.new('ShaderNodeTexImage');nt.image=images['stone-normal'];m.node_tree.links.new(nt.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
 M[key]=m
tree=ast.parse((ROOT/'tools/build-moon-courts.py').read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['group','finish','box','poly']],type_ignores=[]),'<masonry helpers>','exec'))
def begin(name):
 global solids
 solids=[];p=group(name);SPEC['parts'][name]={'solids':solids};return p
def cylinder(name,pos,r,h,key,parent,n=16):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=h,location=V(pos));return finish(bpy.context.object,name,key,parent)
def wheel(name,pos,r,parent):
 bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=6,location=V(pos),major_radius=r-.04,minor_radius=.04);o=bpy.context.object;o.rotation_euler.y=math.pi/2;return finish(o,name,'brass',parent)
p=begin('PortalFrame')
for side in[-1,1]:
 x=side*4.64
 box('Grounded hoist footing',[x,.14,0],[.62,.28,.92],'recess',p,.022,True)
 box('Hoist plinth',[x,.36,0],[.59,.16,.86],'pale',p,.016,True)
 box('Continuous pier core',[x,4.45,0],[.48,8.02,.68],'recess',p,0,True)
 for i in range(12):box('Dressed pier course',[x,.44+(i+.5)*8.02/12,0],[.52,8.02/12-.018,.74],'stone' if i%4 else 'pale',p,.015)
 for dx in[-.12,.12]:box('Attached carved vertical flute',[x+dx,4.45,.379],[.025,7.75,.014],'recess',p,.002)
 box('Supported capital',[x,8.52,0],[.70,.22,.96],'pale',p,.018,True)
 box('Capital bronze lip',[x,8.65,0],[.72,.035,.98],'brass',p,.004)
 for z in[-.26,.26]:box('Continuous bronze guide',[side*4.43,4.27,z],[.07,8.34,.055],'brass',p,.006)
 box('Guide foot bracket',[side*4.38,.14,.30],[.17,.20,.12],'brass',p,.008)
 box('Pulley axle support',[side*4.38,8.30,-.1],[.60,.13,.13],'brass',p,.012)
 wheel('Hoist pulley',(side*4.28,8.30,-.10),.40,p)
 for angle in range(8):
  a=angle*math.pi/4;y=8.30+.18*math.sin(a);z=-.1+.18*math.cos(a);o=box('Pulley spoke',[side*4.28,y,z],[.05,.04,.36],'brass',p,.004);o.rotation_euler.x=a
box('Stone lintel',[0,8.75,0],[9.94,.20,.86],'stone',p,.024,True)
box('Lintel cornice',[0,8.90,0],[10.02,.10,.92],'pale',p,.018)
box('Inset epoch plaque',[0,8.76,.45],[1.20,.14,.04],'brass',p,.01)
SPEC['parts']['PortalFrame']['datum']=0
p=begin('LayerWall')
box('Continuous solid carrier',[0,2.48,0],[8.8,4.96,.30],'recess',p,0)
box('Grounded lower sill',[0,.195,.01],[8.8,.39,.34],'stone',p,.015)
for i in range(4):
 y=.95+i*1.15
 box('Sedimentary layer '+str(i),[0,y,.18],[8.8,1.12,.06],'layer'+str(i),p,.012)
 for row in range(4):
  for start,end in[(-4.25,-.66),(.66,4.25)]:
   pts=[]
   for k in range(31):
    x=start+(end-start)*k/30;h=y-.40+row*.23+.035*math.sin(x*2.0+i*1.7+row)+.012*math.cos(x*5.3+row)
    pts.extend([(x,h,.215),(x,h+.018,.215)])
   poly('Carved sediment ribbon',pts,[(k*2,k*2+1,k*2+3,k*2+2) for k in range(30)],'recess' if row%2 else 'pale',p)
 for x in[-4.18,4.18]:
  box('Layer keeper bracket',[x,y,.226],[.11,.24,.035],'brass',p,.006)
  for dy in[-.07,.07]:
   o=cylinder('Layer fastening pin',[x,y+dy,.255],.025,.025,'recess',p,10);o.rotation_euler.x=math.pi/2
for x in[-4.34,4.34]:box('Moving edge carrier',[x,2.48,.225],[.05,4.90,.03],'brass',p,.005)
for x in[-4.28,4.28]:box('Hoist cable anchor',[x,4.70,.28],[.14,.14,.10],'brass',p,.008)
SPEC['parts']['LayerWall'].update({'datum':0,'height':4.96,'halfWidth':4.4,'halfDepth':.33})
p=begin('CounterWeight');box('Solid counterweight',[0,.675,0],[.42,1.35,.28],'stone',p,.025)
for y in[.12,1.23]:box('Counterweight belt',[0,y,0],[.45,.08,.32],'brass',p,.006)
for x in[-.10,.10]:box('Weight vertical groove',[x,.675,.145],[.02,.95,.012],'recess',p,.002)
SPEC['parts']['CounterWeight'].update({'datum':0,'height':1.35})
p=begin('HoistCable');cylinder('Continuous hoist cable',[0,.5,0],.023,1,'brass',p,8);SPEC['parts']['HoistCable']['datum']=0
scene.world=bpy.data.worlds.new('Strata portal studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.24,.29,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
for pos,power,size in[((-5,11,7),3200,9),((6,8,-8),2500,8)]:
 bpy.ops.object.light_add(type='AREA',location=V(pos));o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(V((0,4,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.render.engine='CYCLES';scene.cycles.samples=10;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.view_settings.view_transform='AgX'
originals=[o for p in parts.values() for o in p.children];metrics=export_parts(list(parts),SPEC,ART,'chronicle-portal-v01','Portal ');exports=[o for p in parts.values() for o in p.children if o not in originals]
assert sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))<SPEC['budget']['triangles'] and metrics['glbBytes']<SPEC['budget']['bytes']
for p in parts.values():
 for o in p.children:o.hide_render=True
instances=[]
def instance(name,pos):
 root=bpy.data.objects.new('Goal '+name,None);scene.collection.objects.link(root);root.location=V(pos);instances.append(root)
 for o in parts[name].children:
  if o in exports:copy=o.copy();copy.data=o.data;scene.collection.objects.link(copy);copy.parent=root;copy.hide_render=False
 return root
frame=instance('PortalFrame',[0,0,C['wallZ']]);wall=instance('LayerWall',[0,0,C['wallZ']]);weights=[instance('CounterWeight',[s*4.28,6.3,C['wallZ']-.5]) for s in[-1,1]];cables=[instance('HoistCable',[s*4.28,4.7,C['wallZ']+.3]) for s in[-1,1]]+[instance('HoistCable',[s*4.28,7.65,C['wallZ']-.5]) for s in[-1,1]]
for light in[o for o in scene.objects if o.type=='LIGHT']:light.location+=V([0,0,C['wallZ']])
# Goal sockets and solved fossils reuse the same authored specimens as the game.
before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/adventure/chronicle-evidence-v01.glb'));context=list(set(scene.objects)-before)
for o in context:
 if o.type=='MESH':o.hide_render=True
fossils=[];rings=[]
for i,slot in enumerate(C['slots']):
 bpy.ops.mesh.primitive_torus_add(major_segments=18,minor_segments=6,major_radius=.5,minor_radius=.10,location=V([0,slot['y'],C['wallZ']+.22]));o=bpy.context.object;o.rotation_euler.x=math.pi/2;o.data.materials.append(M['brass']);rings.append(o)
 root=bpy.data.objects.new('Goal solved fossil',None);scene.collection.objects.link(root);root.location=V([0,slot['y'],C['wallZ']+.3]);root.scale=(C['fossils'][C['order'][i]]['r'],)*3;fossils.append(root)
 source=next(o for o in context if o.name.startswith('Fossil'+str(C['order'][i])))
 for o in source.children:
  copy=o.copy();copy.data=o.data;scene.collection.objects.link(copy);copy.parent=root;copy.hide_render=False
goals=[]
for shot in BEFORE['shots']:
 lift=SPEC['motion']['travel'] if shot['state']=='open' else 0;wall.location.z=lift
 for o in weights:o.location.z=6.3-lift
 for i,o in enumerate(cables):
  base=4.7+lift if i<2 else 7.65-lift;o.location.z=base;o.scale.z=8.3-base
 for i,o in enumerate(rings):o.location.z=C['slots'][i]['y']+lift
 for i,root in enumerate(fossils):
  root.location.z=C['slots'][i]['y']+lift
  for o in root.children:o.hide_render=shot['state']!='open'
 cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True);goals.append({k:shot[k] for k in['id','state','camera','target','fov','aspect']})
(ART/'goal-cameras.json').write_text(json.dumps({'scope':'Blender portal-only design renders, not gameplay; existing room/background absent','shots':goals},indent=2))
for root in instances+fossils:
 for child in list(root.children):bpy.data.objects.remove(child,do_unlink=True)
 bpy.data.objects.remove(root,do_unlink=True)
for o in rings+context+exports:
 if o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
for i,p in enumerate(parts.values()):
 p.location=V([i*18,0,0])
 for o in p.children:o.hide_set(False);o.hide_render=False
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'chronicle-portal-v01.blend'))
print('PASS STRATA_PORTAL '+json.dumps(metrics),flush=True)
