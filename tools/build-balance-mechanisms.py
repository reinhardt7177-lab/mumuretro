"""Authored balance mechanisms, native pivots/contact anchors and matched camera goals."""
import bpy, math, json, subprocess, shutil, numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/balance-mechanisms/v01';OUT=ROOT/'assets/models/adventure';ART.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf8'));before=json.loads((ROOT/'reports/2026-10-22/evidence/balance-mechanisms/before/report.json').read_text(encoding='utf8'))
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
V=lambda p:Vector((p[0],-p[2],p[1]));mats={};parts={}
for name in ['stone-albedo','stone-normal']:shutil.copyfile(ROOT/'art/sift-architecture/v01'/f'{name}.png',ART/f'{name}.png')
n=512;yy,xx=np.mgrid[0:n,0:n];rng=np.random.default_rng(20261022);grain=.86+.045*np.sin(xx*.22+np.sin(yy*.035)*1.8)+.018*np.sin(xx*.75+yy*.012)+rng.normal(0,.008,(n,n));grain=np.clip(grain,.65,.99)
for name,values in [('wood-albedo',np.stack([grain]*3,axis=-1)),('wood-normal',np.stack([np.clip(.5-np.gradient(grain,axis=1)*2,0,1),np.clip(.5-np.gradient(grain,axis=0)*2,0,1),np.ones_like(grain)],axis=-1))]:
 im=bpy.data.images.new(name,n,n,alpha=True);rgba=np.concatenate([values,np.ones((n,n,1))],axis=-1).astype(np.float32);im.pixels.foreach_set(rgba.ravel());im.filepath_raw=str(ART/f'{name}.png');im.file_format='PNG';im.save()
images={name:bpy.data.images.load(str(ART/f'{name}.png'),check_existing=True) for name in ['stone-albedo','stone-normal','wood-albedo','wood-normal']}
for name,color in SPEC['palette'].items():
 m=bpy.data.materials.new('Mechanism '+name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=.65 if name=='brass' else .22 if name=='edge' else 0;p.inputs['Roughness'].default_value=.35 if name=='brass' else .74
 if name!='brass':
  texture=m.node_tree.nodes.new('ShaderNodeTexImage');texture.image=images['wood-albedo' if name=='wood' else 'stone-albedo'];mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1);m.node_tree.links.new(texture.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],p.inputs['Base Color'])
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=images['wood-normal' if name=='wood' else 'stone-normal'];tex.image.colorspace_settings.name='Non-Color';normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.22;m.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],p.inputs['Normal'])
 mats[name]=m
def group(name,parent=None,pos=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=V(pos);return o
def finish(o,name,key,parent):o.name=name;o.parent=parent;o.data.materials.append(mats[key]);return o
def box(name,pos,size,key,parent,bevel=.018):
 bpy.ops.mesh.primitive_cube_add(size=1,location=V(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:b=o.modifiers.new('Cast and carved edges','BEVEL');b.width=bevel;b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name)
 return finish(o,name,key,parent)
def rod(name,a,b,r,key,parent,vertices=16,r2=None):
 a,b=V(a),V(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,key,parent)
def ring(name,pos,r,thick,key,parent,normal=(0,0,1)):
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=thick,major_segments=40,minor_segments=8,location=V(pos));o=bpy.context.object;o.rotation_euler=V(normal).to_track_quat('Z','Y').to_euler();return finish(o,name,key,parent)
def bolt(pos,parent):rod('Recessed bolt',pos,(pos[0],pos[1],pos[2]+.035),.038,'edge',parent,8)
def base(parent,w,depth):
 box('Stone foot',(0,.14,0),(w,.28,depth),'stone',parent,.035);box('Stepped brass collar',(0,.31,0),(w*.84,.06,depth*.84),'brass',parent,.015)
def stand(parent,y):
 rod('Lower column',(0,.34,0),(0,y-.3,0),.16,'teal',parent,16,.13)
 for z in [-.18,.18]:box('Shaft brass seam',(0,y/2,z),(.035,y-.55,.022),'brass',parent,.004)
 rod('Axle housing',(0,y,-.21),(0,y,.23),.24,'stone',parent,32);ring('Axle rim',(0,y,.24),.19,.035,'brass',parent)
 for x in [-.13,.13]:bolt((x,y,.25),parent)
def beam(parent,arm):
 box('Equal beam',(0,0,0),(arm*2+.42,.14,.22),'brass',parent,.025)
 for side in [-1,1]:
  for i in range(6):box('Beam incised index',(side*(.40+i*(arm-.5)/6),.075,.0),(.017,.015,.17),'edge',parent,.002)
  ring('Pan hanging eye',(side*arm,0,0),.105,.025,'edge',parent)
def order_pan(parent):
 h=SPEC['order']['panFloorOffset'];rod('Pan flat floor',(0,h-.09,0),(0,h,0),.86,'brass',parent,48,.86)
 rod('Pan inset',(0,h+.001,0),(0,h+.006,0),.77,'teal',parent,48,.77)
 ring('Pan cast lip',(0,h+.025,0),.845,.032,'brass',parent,normal=(0,1,0))
 for a in [0,math.tau/3,math.tau*2/3]:
  point=(math.cos(a)*.82,h+.04,math.sin(a)*.82);rod('Pan suspension',(0,0,0),point,.022,'brass',parent,12);ring('Suspension foot',point,.055,.014,'edge',parent)
 group(parent.name+'Rest',parent,(0,h+.006,0))
o=group('OrderScale');parts[o.name]=o;base(o,1.25,1.0);stand(o,SPEC['order']['axisY']);b=group('OrderBeam',o,(0,SPEC['order']['axisY'],0));beam(b,1.9)
for side,name in [(-1,'OrderLeftPan'),(1,'OrderRightPan')]:order_pan(group(name,b,(side*1.9,0,0)))
o=group('TwinScale');parts[o.name]=o;base(o,1.4,1.15);stand(o,SPEC['twin']['axisY']);b=group('TwinBeam',o,(0,SPEC['twin']['axisY'],0));beam(b,3)
for side,name in [(-1,'TwinLeftPan'),(1,'TwinRightPan')]:
 p=group(name,b,(side*3,0,0));h=SPEC['twin']['panFloorOffset'];box('Two-cell tray',(0,h-.07,0),(2.72,.14,1.62),'brass',p,.045)
 for i,x in enumerate([-.6,.6]):
  box('Two-cell deck',(x,h+.006,0),(1.11,.012,1.22),'teal',p,.018);group(name+'Cell'+str(i),p,(x,h+.012,0))
  for z in [-.68,.68]:box('Tray edge',(x,h+.04,z),(1.14,.06,.035),'brass',p,.006)
 for x in [-1.25,1.25]:
  for z in [-.68,.68]:rod('Four suspension rods',(0,0,0),(x,h+.08,z),.024,'brass',p,12)
o=group('LeverAssembly');parts[o.name]=o;rail=group('LeverRail',o)
box('Grounded rail foot',(0,.075,0),(8.9,.15,1.1),'stone',rail,.03)
for z in [-.38,.38]:box('Sliding bronze rail',(0,.19,z),(8.7,.10,.12),'brass',rail,.014)
for i in range(5):
 x=(i-2)*1.4;box('Pivot rail detent',(x,.245,.43),(.06,.045,.16),'edge',rail,.005)
f=group('LeverFulcrum',o)
box('Sliding shoe',(0,.31,0),(1.08,.18,1.0),'teal',f,.035)
rod('Carved tapered support',(0,.4,0),(0,1.16,0),.56,'stone',f,3,.12)
rod('Fulcrum axle',(0,1.2,-.40),(0,1.2,.40),.095,'edge',f,20)
for z in [-.43,.43]:ring('Axle bearing',(0,1.2,z),.135,.025,'brass',f)
b=group('LeverBeam',o,(0,1.2,0));box('Timber beam',(0,0,0),(8.5,.22,.8),'wood',b,.03)
for z in [-.41,.41]:box('Beam side strap',(0,0,z),(8.45,.13,.035),'brass',b,.009)
for i in range(6):
 x=(i-2.5)*1.4;box('Lever cell '+str(i),(x,.145,0),(1.25,.07,.72),'teal',b,.014);group('LeverCell'+str(i),b,(x,.18,0))
 box('Cell number mount',(x,-.11,.47),(.74,.36,.045),'brass',b,.012);group('LeverLabel'+str(i),b,(x,-.11,.50))
 for dx in [-.48,.48]:bolt((x+dx,0,.44),b)
# Only siblings with the same material are joined; all movable groups/anchors survive.
for parent in [p for root in parts.values() for p in [root,*root.children_recursive] if p.type=='EMPTY']:
 buckets={}
 for ob in list(parent.children):
  if ob.type=='MESH':buckets.setdefault(ob.active_material.name,[]).append(ob)
 for key,objects in buckets.items():
  bpy.ops.object.select_all(action='DESELECT')
  for ob in objects:ob.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=parent.name+' '+key
scene.view_settings.view_transform='AgX';scene.world=bpy.data.worlds.new('Mechanism studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.19,.22,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
bpy.context.view_layer.update();metrics={}
for name,p in parts.items():
 meshes=[o for o in p.children_recursive if o.type=='MESH'];points=[];triangles=0
 for ob in meshes:ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles);points.extend(ob.matrix_world@v.co for v in ob.data.vertices)
 metrics[name]={'meshes':len(meshes),'triangles':triangles,'webMin':[min(v.x for v in points),min(v.z for v in points),-max(v.y for v in points)],'webMax':[max(v.x for v in points),max(v.z for v in points),-min(v.y for v in points)]}
bpy.ops.object.select_all(action='DESELECT')
for p in parts.values():
 p.select_set(True)
 for ob in p.children_recursive:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'balance-mechanisms-v01.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
subprocess.run(['node',str(ROOT/'tools/finalize-balance-materials.cjs')],cwd=str(ROOT),check=True);metrics['glbBytes']=(OUT/'balance-mechanisms-v01.glb').stat().st_size;metrics['textures']=[{'name':name,'width':512,'height':512} for name in images];assert sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))<SPEC['budgets']['sourceTrianglesMax'];assert metrics['glbBytes']<SPEC['budgets']['glbBytesMax'];(ART/'model-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8');(OUT/'balance-mechanisms-v01.json').write_text(json.dumps(SPEC,indent=2),encoding='utf8')
for pos,power in [((7,-7,9),1500),((-6,4,6),900)]:
 bpy.ops.object.light_add(type='AREA',location=pos);ob=bpy.context.object;ob.data.energy=power;ob.data.shape='DISK';ob.data.size=6;ob.rotation_euler=(Vector((0,0,1.7))-ob.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=8;scene.render.resolution_x=768;scene.render.resolution_y=540;scene.render.resolution_percentage=100
for name,p in parts.items():
 for ob in p.children_recursive:
  if ob.type=='MESH':ob.hide_render=True
for name,p in parts.items():
 for ob in p.children_recursive:
  if ob.type=='MESH':ob.hide_render=False
 target=Vector((0,0,1.3));distance=7.5 if name=='OrderScale' else 10 if name=='TwinScale' else 11;cam.data.angle=math.radians(48)
 for view,a in [('front',0),('side',math.pi/2),('rear',math.pi)]:
  cam.location=target+Vector((math.sin(a)*math.cos(.25)*distance,-math.cos(a)*math.cos(.25)*distance,math.sin(.25)*distance));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ART/f'{name}-{view}.png');bpy.ops.render.render(write_still=True)
 for ob in p.children_recursive:
  if ob.type=='MESH':ob.hide_render=True
for name,p in parts.items():
 for ob in p.children_recursive:ob.hide_set(name!='OrderScale');ob.hide_render=name!='OrderScale'
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'balance-mechanisms-v01.blend'));bpy.ops.file.make_paths_relative();bpy.ops.wm.save_mainfile()
# Match the nine recorded web cameras in the preserved v04 rooms.
for p in parts.values():
 for ob in p.children_recursive:ob.hide_render=True;ob.hide_set(False)
existing=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/balance-temple-v04.glb'));reference=[ob for ob in bpy.data.objects if ob not in existing]
for ob in reference:ob.hide_render=True
hallNames={'r1':'hall_order','r2':'hall_twin','shrine':'hall_lever','entry':'hall_entry','c1':'hall_corridor','c2':'hall_corridor'}
for s in before['layout']['rooms']:
 if s['id'] not in hallNames:continue
 source=bpy.data.objects.get(hallNames[s['id']]);copy=source.copy();scene.collection.objects.link(copy);copy.location=V((0,0,(s['z0']+s['z1'])/2));copy.hide_render=False
 def duplicate_children(a,b):
  for child in a.children:
   c=child.copy();scene.collection.objects.link(c);c.parent=b;c.hide_render=False;duplicate_children(child,c)
 duplicate_children(source,copy)
for shot in before['shots']:
 for name,p in parts.items():
  for ob in p.children_recursive:ob.hide_render=True
 name={'order':'OrderScale','twin':'TwinScale','lever':'LeverAssembly'}[shot['kind']];p=parts[name];z=before['layout'][shot['kind']+'Z'];p.location=V((0,0,z))
 for ob in p.children_recursive:ob.hide_render=False
 angle=shot.get('tilt',.048 if shot['kind']=='twin' else 0);
 if name in ['OrderScale','TwinScale']:
  prefix='Order' if name=='OrderScale' else 'Twin';be=bpy.data.objects[prefix+'Beam'];be.rotation_euler[1]=-angle
  for side in ['Left','Right']:bpy.data.objects[prefix+side+'Pan'].rotation_euler[1]=angle
 else:
  px=(shot['pivot']-3)*1.4;be=bpy.data.objects['LeverBeam'];be.location=V((px,1.2,0));be.rotation_euler[1]=-angle;bpy.data.objects['LeverFulcrum'].location=V((px,0,0))
  for child in be.children:child.location.x-=px
 cam.location=V(shot['camera']);target=V((shot['actor'][0],shot['actor'][1]+1.25,shot['actor'][2]));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
 if name=='LeverAssembly':
  for child in be.children:child.location.x+=px
print('BALANCE_MECHANISMS '+json.dumps(metrics))
