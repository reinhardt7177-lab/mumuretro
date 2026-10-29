"""Own fossil reliefs and grounded observation furniture. Run inside Blender."""
import bpy,bmesh,math,json,ast,sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import export_parts
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/chronicle-evidence/v01';ART.mkdir(parents=True,exist_ok=True)
V=lambda p:Vector((p[0],-p[2],p[1]))
palette={'stone':[.25,.28,.31],'pale':[.66,.60,.46],'recess':[.08,.10,.12],'brass':[.44,.30,.12],'fossil':[.20,.23,.24],'calcite':[.78,.71,.52]}
SPEC={'model':'assets/models/adventure/chronicle-evidence-v01.glb','palette':palette,'parts':{},'fossils':['trilobite','ammonite','fern','shell'],'budget':{'triangles':36000,'bytes':2500000},'scope':'Original stylized reliefs; not species/age reconstruction'}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;M={};parts={};solids=[]
for key,c in palette.items():
 m=bpy.data.materials.new('Evidence '+key);m.diffuse_color=(*c,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.38 if key=='brass' else .82;bs.inputs['Metallic'].default_value=.6 if key=='brass' else 0;M[key]=m
tree=ast.parse((ROOT/'tools/build-moon-courts.py').read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['group','finish','box','poly']],type_ignores=[]),'<shared helpers>','exec'))
def begin(name):
 global solids
 solids=[];p=group(name);SPEC['parts'][name]={'solids':solids};return p
def ellipsoid(name,pos,scale,key,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,location=V(pos));o=bpy.context.object;o.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,key,parent)
def tube(name,points,radius,key,parent,sides=6):
 pts=[]
 for i,p in enumerate(points):
  tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)]);tangent.normalize();u=tangent.cross(Vector((0,0,1)));u.normalize();v=tangent.cross(u);r=radius(i/(len(points)-1)) if callable(radius) else radius
  for k in range(sides):pts.append(Vector(p)+r*(u*math.cos(k*2*math.pi/sides)+v*math.sin(k*2*math.pi/sides)))
 faces=[tuple(reversed(range(sides))),tuple((len(points)-1)*sides+k for k in range(sides))]
 for i in range(len(points)-1):
  for k in range(sides):a=i*sides+k;b=i*sides+(k+1)%sides;faces.append((a,b,b+sides,a+sides))
 return poly(name,pts,faces,key,parent)
def relief(parent,idx,side):
 z=side*.14
 def pt(x,y,depth=0):return(x,y,z+side*depth)
 if idx==0:
  ellipsoid('Trilobite head',pt(0,.44,.035),(.43,.25,.065),'calcite',parent)
  for row in range(9):
   y=.22-row*.10;w=.40*(1-row*.065)
   for sign in[-1,1]:tube('Trilobite segmented pleura',[pt(0,y,.035),pt(sign*w*.55,y-.025,.055),pt(sign*w,y-.09)],.035,'calcite',parent)
   ellipsoid('Trilobite axial ring',pt(0,y,.08),(.095,.047,.035),'pale',parent)
  for sign in[-1,1]:ellipsoid('Trilobite eye',pt(sign*.22,.50,.085),(.055,.055,.025),'recess',parent)
 elif idx==1:
  pts=[]
  for i in range(120):
   t=i/119;theta=t*math.pi*4.7;r=.035+.53*t;pts.append(pt(r*math.cos(theta),r*math.sin(theta),.065))
  tube('Ammonite continuous spiral',pts,lambda t:.027+.058*t,'calcite',parent,8)
  for i in range(22,118,4):
   t=i/119;a=t*math.pi*4.7;r=.035+.53*t;w=.025+.057*t;tube('Ammonite chamber rib',[pt((r-w)*math.cos(a),(r-w)*math.sin(a),.088),pt((r+w)*math.cos(a),(r+w)*math.sin(a),.088)],.015,'pale',parent)
 elif idx==2:
  tube('Fern stem',[pt(-.12,-.71,.035),pt(0,0,.045),pt(.12,.71,.035)],.033,'calcite',parent)
  for i in range(8):
   y=-.52+i*.145;x=y*.17;w=.38*(1-abs(y)*.72)
   for sideX in[-1,1]:
    verts=[pt(x,y,.04),pt(x+sideX*w*.52,y+.13,.07),pt(x+sideX*w,y+.20,.025),pt(x+sideX*w*.55,y+.02,.07)]
    poly('Fern leaflet',verts,[(0,1,2,3)],'calcite',parent)
 elif idx==3:
  # Closed radial fan, with a distinct hinge below the curved shell rim.
  pts=[pt(0,-.55,.02)]
  for i in range(25):a=math.pi*.13+i/24*math.pi*.74;pts.append(pt(.67*math.cos(a),-.55+.97*math.sin(a),.07))
  poly('Shell fan',pts,[(0,i,i+1) for i in range(1,25)],'pale',parent)
  for i in range(13):
   a=math.pi*.13+i/12*math.pi*.74;tube('Shell radiating rib',[pt(0,-.55,.035),pt(.67*.5*math.cos(a),-.55+.97*.5*math.sin(a),.10),pt(.67*math.cos(a),-.55+.97*math.sin(a),.085)],.027,'calcite',parent)
  ellipsoid('Shell hinge',pt(0,-.55,.07),(.15,.08,.035),'calcite',parent)
for idx in range(4):
 p=begin('Fossil'+str(idx));pts=[];n=24
 for z in[-.12,.12]:
  for i in range(n):a=i*2*math.pi/n;r=1-.035*math.sin(i*2.1)**2;pts.append((.85*r*math.cos(a),r*math.sin(a),z))
 # Exact lower/upper extrema make existing centre y=r grounded.
 pts[18]=(.0,-1,-.12);pts[6]=(.0,1,-.12);pts[n+18]=(.0,-1,.12);pts[n+6]=(.0,1,.12)
 poly('Weathered specimen stone',pts,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],'fossil',p)
 for side in[-1,1]:relief(p,idx,side)
 SPEC['parts'][p.name].update({'identity':SPEC['fossils'][idx],'bottom':-1,'top':1,'reliefFaces':2})
p=begin('CoreStand')
for x in[-1.5,1.5]:
 box('Grounded stand foot',[x,.08,0],[.68,.16,.84],'recess',p,.018,True)
 box('Stand pier',[x,.43,0],[.46,.54,.60],'stone',p,.016,True)
 box('Stand bronze collar',[x,.64,0],[.49,.06,.64],'brass',p,.008)
 box('Stand capital',[x,.71,0],[.68,.10,.86],'pale',p,.016,True)
box('Continuous tabletop', [0,.81,0],[4.4,.10,.90],'stone',p,.016,True)
for z in[-.44,.44]:box('Tabletop brass trim',[0,.845,z],[4.36,.025,.025],'brass',p,.003)
for x in[-1.5,1.5]:
 for z in[-.29,.29]:box('Core cradle saddle',[x,.88,z],[.22,.16,.16],'brass',p,.01,True)
SPEC['parts']['CoreStand']['top']=.96
p=begin('WallFrame')
for x in[-4.55,4.55]:
 box('Wall foot',[x,.14,0],[.55,.28,.72],'recess',p,.02,True)
 box('Wall plinth',[x,.34,0],[.49,.12,.61],'pale',p,.012,True)
 box('Wall continuous support',[x,2.58,0],[.32,4.36,.44],'stone',p,.015,True)
 for y in[.49,1.64,2.79,3.94,4.79]:box('Layer witness collar',[x,y,0],[.45,.075,.57],'brass',p,.008)
 box('Wall capital',[x,4.90,0],[.58,.22,.67],'pale',p,.02,True)
box('Supported wall lintel',[0,5.10,0],[9.64,.20,.62],'stone',p,.02,True)
box('Lintel bronze seam',[0,5.23,.0],[9.64,.035,.64],'brass',p,.006)
# No opaque sill across the doorway; the existing solution controls the door.
SPEC['parts']['WallFrame']['datum']=0
scene.world=bpy.data.worlds.new('Specimen studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.17,.21,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
for pos,power,size in[((-4,6,6),1900,5),((5,2,-4),1300,4)]:
 bpy.ops.object.light_add(type='AREA',location=V(pos));o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(V((0,.5,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';cam.data.angle=math.radians(45);scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.view_settings.view_transform='AgX'
originals=[o for p in parts.values() for o in p.children];metrics=export_parts(list(parts),SPEC,ART,'chronicle-evidence-v01','Evidence ');exports=[o for p in parts.values() for o in p.children if o not in originals]
assert sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))<SPEC['budget']['triangles'] and metrics['glbBytes']<SPEC['budget']['bytes']
# Studio design targets: exact camera vectors are reused by the Three.js asset review.
for p in parts.values():
 for o in p.children:o.hide_render=True
clones=[]
for i in range(4):
 for o in parts['Fossil'+str(i)].children:
  if o not in exports:continue
  copy=o.copy();copy.data=o.data;scene.collection.objects.link(copy);copy.parent=None;copy.location+=V(((i-1.5)*2.15,1,0));copy.hide_render=False;clones.append(copy)
shots=[{'id':'front','camera':[0,3,13],'target':[0,1,0]},{'id':'side','camera':[10,3,9],'target':[0,1,0]},{'id':'rear','camera':[0,3,-13],'target':[0,1,0]}]
for s in shots:
 cam.location=V(s['camera']);cam.rotation_euler=(V(s['target'])-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ART/('goal-'+s['id']+'.png'));bpy.ops.render.render(write_still=True)
(ART/'goal-cameras.json').write_text(json.dumps({'scope':'Blender design target of four fossil specimens; not actual gameplay','width':1280,'height':720,'fov':45,'shots':shots},indent=2))
for o in clones+exports:bpy.data.objects.remove(o,do_unlink=True)
for i,p in enumerate(parts.values()):
 p.location=V((i*12,0,0))
 for o in p.children:o.hide_set(False);o.hide_render=False
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'chronicle-evidence-v01.blend'))
print('PASS EVIDENCE_MODEL '+json.dumps(metrics),flush=True)
