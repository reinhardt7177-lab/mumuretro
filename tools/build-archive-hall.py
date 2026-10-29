"""Original notebook matching stations and grounded paving; Blender edit source + GLB."""
import bpy,bmesh,math,json,ast,sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import export_parts
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/archive-hall/v01';ART.mkdir(parents=True,exist_ok=True)
BEFORE=json.loads((ROOT/'reports/2026-10-24/evidence/archive-hall/before/report.json').read_text());V=lambda p:Vector((p[0],-p[2],p[1]))
palette={'stone':[.32,.36,.37],'pale':[.60,.57,.49],'dark':[.09,.12,.13],'bronze':[.48,.34,.18]}
SPEC={'model':'art/archive-hall/v01/preview.glb','palette':palette,'parts':{},'contract':BEFORE['contract'],'wheelY':1.12,'wheelZ':.47,'turnDuration':.22,'recordPositions':[[-4.7,0,-41.5],[4.7,0,-41.5]]}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;M={};parts={};solids=[]
for key,c in palette.items():
 m=bpy.data.materials.new('Archive '+key);m.diffuse_color=(*c,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.5 if key=='bronze' else .88;bs.inputs['Metallic'].default_value=.5 if key=='bronze' else 0
 if key!='bronze':
  im=bpy.data.images.load(str(ROOT/'art/strata-inlays/v01/limestone-albedo.png'));tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*c,1);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
 M[key]=m
tree=ast.parse((ROOT/'tools/build-moon-courts.py').read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['group','finish','box','poly']],type_ignores=[]),'<shared masonry>','exec'))
def begin(name):
 global solids
 solids=[];p=group(name);SPEC['parts'][name]={'solids':solids};return p
base=begin('ArchiveStation')
box('Grounded station foot',(0,.10,0),(1.24,.20,.70),'dark',base,.02,True)
box('Stone waist',(0,.59,-.04),(.94,.78,.56),'stone',base,.02,True)
box('Mechanism support',(0,1.05,0),(1.12,.20,.67),'pale',base,.025,True)
box('Back tablet support',(0,1.52,-.14),(.28,1.04,.23),'stone',base,.01,True)
box('Carved mark tablet',(0,1.75,-.07),(1.06,.80,.30),'pale',base,.025,True)
box('Mark recess',(0,1.75,.088),(.88,.64,.035),'dark',base,.01)
for x in[-.44,.44]:box('Inset bronze hinge',(x,1.11,.35),(.10,.18,.09),'bronze',base,.008)
box('Selection name backing',(0,.40,.255),(.84,.28,.035),'dark',base,.008)
wheel=begin('ArchiveWheel');SPEC['parts']['ArchiveWheel']['datum']='rotation axis at origin'
pts=[];faces=[];n=32
for z in[-.045,.045]:
 for r in[.25,.34]:
  for i in range(n):a=2*math.pi*i/n;pts.append((r*math.cos(a),r*math.sin(a),z))
for i in range(n):
 j=(i+1)%n
 for a,b in[(0,n),(2*n,3*n),(0,2*n),(n,3*n)]:faces.append((a+i,a+j,b+j,b+i))
poly('Rotating bronze rim',pts,faces,'bronze',wheel)
for k in range(5):
 a=2*math.pi*k/5;u=(math.cos(a),math.sin(a));v=(-u[1]*.045,u[0]*.045)
 points=[(u[0]*r+v[0]*s,u[1]*r+v[1]*s,z) for z in[-.035,.035] for r,s in[(0,-1),(.28,-1),(.28,1),(0,1)]]
 poly('Five radial spokes',points,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'bronze',wheel)
box('Graspable crank',(0,.29,.13),(.12,.13,.20),'dark',wheel,.02)
shapes=[('MarkBar',[(-.34,0),(.34,0),(.34,.10),(-.34,.10)]),('MarkCircle',[(.29*math.cos(i*math.tau/32),.29+.29*math.sin(i*math.tau/32)) for i in range(32)]),('MarkDisc',[(.34*math.cos(i*math.tau/32),.13+.13*math.sin(i*math.tau/32)) for i in range(32)]),('MarkDiamond',[(0,0),(.27,.30),(0,.60),(-.27,.30)]),('MarkTriangle',[(-.29,0),(.29,0),(0,.58)])]
for name,points in shapes:
 p=begin(name);n=len(points);verts=[(x,y,z)for z in[-.025,.025]for x,y in points];faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)];poly('Neutral carved notebook mark',verts,faces,'pale',p)
floor=begin('ArchiveFloor')
for iz in range(7):
 for ix in range(6):box('Grounded room paving',((ix-2.5)*2,.06,-7+(iz+.5)*2),(1.97,.12,1.97),'pale' if (ix+iz)%9==0 else 'stone',floor,.008)
bridge=begin('ArchiveBridge')
for iz in range(4):
 for ix in range(3):box('Bridge paving',((ix-1)*1.40,.06,-3+(iz+.5)*1.5),(1.37,.12,1.47),'stone',bridge,.008)
originals=[o for p in parts.values() for o in p.children];metrics=export_parts(list(parts),SPEC,ART,'archive-hall-v01','Archive ');exports=[o for p in parts.values() for o in p.children if o not in originals]
for p in parts.values():
 for o in p.children:o.hide_render=True
instances=[]
def instance(part,pos,scale=1):
 p=bpy.data.objects.new('Goal '+part.name,None);scene.collection.objects.link(p);p.location=V(pos);p.scale=(scale,)*3;instances.append(p)
 for o in part.children:
  if part not in parts.values() or o in exports:c=o.copy();c.data=o.data;scene.collection.objects.link(c);c.parent=p;c.hide_render=False
 return p
for lever in BEFORE['contract']['levers']:
 x,z=lever['x'],lever['z'];instance(base,[x,0,z]);instance(wheel,[x,SPEC['wheelY'],z+SPEC['wheelZ']]);name=shapes[lever['si']][0];h=metrics[name]['webMax'][1];instance(parts[name],[x,1.75-h/2,z+.135])
instance(floor,[0,-.12,-47]);instance(bridge,[0,-.12,-37]);instance(bridge,[0,-.12,-57])
imported=set()
for file in['panel-workshop-v01','shaft-entry-v01']:
 old=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/f'assets/models/adventure/{file}.glb'));new=set(bpy.data.objects)-old;imported|=new
 for o in new:o.hide_render=True
plaque=next(o for o in imported if o.name.startswith('ObservationPlaque'))
for pos in SPEC['recordPositions']:instance(plaque,pos,.65)
for name,pos in[('ShaftExitFrame',[0,0,-54.1]),('ShaftExitFoundation',[0,-.75,-54.1]),('ShaftExitLeaf',[-1.05,0,-54.1]),('ShaftExitLeaf',[1.05,0,-54.1])]:instance(next(o for o in imported if o.name.startswith(name)),pos)
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
for pos,power in[([0,10,-44],2600),([7,7,-55],1800),([-7,7,-48],1800)]:
 bpy.ops.object.light_add(type='AREA',location=V(pos));o=bpy.context.object;o.data.energy=power;o.data.size=8;o.rotation_euler=(V([0,1,-50])-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=10;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.view_settings.view_transform='AgX'
for shot in BEFORE['shots']:
 cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
(ART/'goal-cameras.json').write_text(json.dumps({'scope':'Blender stations and reused door/plaques; no live text or game surroundings','shots':[{k:s[k]for k in['id','camera','target','fov','aspect']}for s in BEFORE['shots']]},indent=2))
for p in instances:
 for o in list(p.children):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.objects.remove(p,do_unlink=True)
for o in list(imported)+exports:
 if o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
for i,p in enumerate(parts.values()):
 p.location=V([i*15,0,0])
 for o in p.children:o.hide_set(False);o.hide_render=False
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'archive-hall-v01.blend'));print('PASS',metrics)
