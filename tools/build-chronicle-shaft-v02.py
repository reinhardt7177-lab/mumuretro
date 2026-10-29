"""Original excavated gallery, loose stone and chips; run with installed Blender."""
import bpy,bmesh,math,json,ast,sys,shutil
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import export_parts
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/chronicle-shaft/v02';ART.mkdir(parents=True,exist_ok=True)
BEFORE=json.loads((ROOT/'reports/2026-10-24/evidence/chronicle-shaft-v02/before/report.json').read_text());C=BEFORE['contract'];L=C['seg']['z1']-C['seg']['z0'];V=lambda p:Vector((p[0],-p[2],p[1]))
palette={'stone':[.26,.29,.31],'pale':[.56,.53,.45],'recess':[.065,.083,.10],'brass':[.45,.31,.14],'floor':[.36,.39,.39],'floorAlt':[.31,.34,.35],'rock':[.30,.32,.33],'seam':[.49,.46,.38]}
SPEC={'model':'art/chronicle-shaft/v02/preview.glb','palette':palette,'parts':{},'contract':C,'motion':{'sourceY':8.2,'rockRadius':.85,'roofBottom':9.1,'fallDuration':.45,'warningRadius':1},'budget':{'triangles':28000,'bytes':3000000},'scope':'Original excavation gallery. Native puzzle timing and save fields retained.'}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;M={};parts={};solids=[];images={}
for name in ['stone-albedo','stone-normal']:
 shutil.copyfile(ROOT/'art/strata-inlays/v01'/('limestone-albedo.png' if name=='stone-albedo' else 'limestone-normal.png'),ART/f'{name}.png');im=bpy.data.images.load(str(ART/f'{name}.png'));im.colorspace_settings.name='Non-Color' if name.endswith('normal') else 'sRGB';images[name]=im
for key,c in palette.items():
 m=bpy.data.materials.new('Shaft '+key);m.diffuse_color=(*c,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.42 if key=='brass' else .86;bs.inputs['Metallic'].default_value=.6 if key=='brass' else 0
 if key!='brass':
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=images['stone-albedo'];mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*c,1);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color']);normal=m.node_tree.nodes.new('ShaderNodeTexImage');normal.image=images['stone-normal'];nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.18;m.node_tree.links.new(normal.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
 M[key]=m
tree=ast.parse((ROOT/'tools/build-moon-courts.py').read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['group','finish','box','poly']],type_ignores=[]),'<shared masonry>','exec'))
def begin(name,datum):
 global solids
 solids=[];p=group(name);SPEC['parts'][name]={'solids':solids,'datum':datum};return p
frame=begin('ShaftFrame',0)
for z in [-7,0,7]:
 for side in [-1,1]:
  x=side*4.45
  box('Grounded support footing',(x,.15,z),(.86,.3,1.10),'recess',frame,solid=True)
  box('Continuous support body',(x,4.5,z),(.58,8.4,.76),'stone',frame,solid=True)
  for row in range(11):
   box('Editable limestone pier block',(x,.68+row*.70,z),(.64,.65,.84),'pale' if row%4==0 else 'stone',frame)
  box('Load bearing capital',(x,8.78,z),(.96,.30,1.18),'pale',frame,solid=True)
  for y in [1.1,7.8]:box('Bronze pier strap',(x,y,z+.43),(.67,.08,.065),'brass',frame,.008)
 box('Cross gallery supported lintel',(0,8.98,z),(9.85,.24,1.02),'pale',frame,solid=True)
# Continuous source plane behind cracked roof panels. Its underside is the
# source boundary; loose chunks hang just below it during the warning.
# Backing underside 9.60 is recessed above panel underside 9.10.
# Sharing the old 9.10 plane caused visible z-fighting at grazing angles.
box('Cracked roof continuous backing',(0,9.71,0),(9.55,.22,L+.9),'recess',frame,.025,True)
for iz in range(5):
 z=-L/2+(iz+.5)*L/5
 for ix in range(4):
  x=(ix-1.5)*2.35
  box('Editable fractured roof panel',(x,9.36,z),(2.30,.52,L/5-.10),'rock' if (ix+iz)%2 else 'stone',frame,.045)
floor=begin('GalleryFloor','top:0')
for iz in range(9):
 for ix in range(5):
  box('Ground level limestone paving',((ix-2)*1.75,-.06,-L/2+(iz+.5)*L/9),(1.72,.12,L/9-.035),'floorAlt' if (ix+iz)%4==0 else 'floor',floor,.008)
for side in[-1,1]:box('Gallery edge coping',(side*4.47,-.07,0),(.16,.14,L),'pale',floor,.009)
rock=begin('FallingStone',0)
# Irregular stratified block with fractured edges, kept within damage radius1m.
verts=[];n=11
for row,(y,radius) in enumerate([(0,.52),(.24,.78),(1.12,.83),(1.7,.51)]):
 for k in range(n):
  a=2*math.pi*k/n+.06*row;rad=radius*(.90+.10*math.sin(k*2.7+row*1.8));verts.append((rad*math.cos(a),y,rad*math.sin(a)))
faces=[tuple(reversed(range(n))),tuple(3*n+k for k in range(n))]
for row in range(3):
 for k in range(n):faces.append((row*n+k,row*n+(k+1)%n,(row+1)*n+(k+1)%n,(row+1)*n+k))
poly('Fractured sediment stone',verts,faces,'rock',rock)
chip=begin('StoneChip',0);poly('Angular stone splinter',[(-.09,0,-.055),(.11,0,-.05),(.035,0,.09),(-.02,.19,.01)],[(0,2,1),(0,1,3),(1,2,3),(2,0,3)],'pale',chip)
originals=[o for p in parts.values() for o in p.children];metrics=export_parts(list(parts),SPEC,ART,'chronicle-shaft-v02','Shaft ');exports=[o for p in parts.values() for o in p.children if o not in originals]
assert metrics['glbBytes']<SPEC['budget']['bytes'] and sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))<SPEC['budget']['triangles']
for p in parts.values():
 for o in p.children:o.hide_render=True
instances=[]
def instance(name,pos):
 p=bpy.data.objects.new('Goal '+name,None);scene.collection.objects.link(p);p.location=V(pos);instances.append(p)
 for o in parts[name].children:
  if o in exports:c=o.copy();c.data=o.data;scene.collection.objects.link(c);c.parent=p;c.hide_render=False
 return p
instance('ShaftFrame',[0,0,C['mid']]);instance('GalleryFloor',[0,0,C['mid']]);instance('FallingStone',[0,8.2-.85,C['mid']])
# Goal warning ring is a design annotation, not an exported floor asset.
bpy.ops.mesh.primitive_circle_add(vertices=64,radius=1,fill_type='NGON',location=V([0,.018,C['mid']]));disc=bpy.context.object;disc.data.materials.append(M['recess']);goalExtras=[disc]
for a0,a1,key in[(0,2*math.pi,'seam'),(0,.35*2*math.pi,'brass')]:
 pts=[];faces=[]
 for j in range(65):
  a=a0+(a1-a0)*j/64
  for r in[.965,1.0]:pts.append((r*math.cos(a),.025,C['mid']+r*math.sin(a)))
 for j in range(64):faces.append((j*2,j*2+1,j*2+3,j*2+2))
 goalExtras.append(poly('Goal warning progress',pts,faces,key,None))
scene.world=bpy.data.worlds.new('Gallery studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.25,.25,.25,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
for pos,power,size in[([1,13,C['mid']+9],2600,10),([-10,9,C['mid']-3],2000,10),([0,6,C['mid']],1100,8)]:
 bpy.ops.object.light_add(type='AREA',location=V(pos));o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(V([0,3.8,C['mid']])-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=10;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.view_settings.view_transform='AgX'
for shot in BEFORE['shots']:
 cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
(ART/'goal-cameras.json').write_text(json.dumps({'scope':'Blender shaft-only targets, not gameplay','shots':[{k:s[k] for k in ['id','camera','target','fov','aspect']} for s in BEFORE['shots']]},indent=2))
for p in instances:
 for o in list(p.children):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.objects.remove(p,do_unlink=True)
for o in goalExtras+exports:
 if o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
for i,p in enumerate(parts.values()):
 p.location=V([i*16,0,0])
 for o in p.children:o.hide_set(False);o.hide_render=False
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'chronicle-shaft-v02.blend'));print('PASS CHRONICLE_SHAFT',metrics)
