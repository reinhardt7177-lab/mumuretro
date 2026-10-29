"""Original stone workshop/guardian. y-up game -> Blender x/-z/y.
Reference PDF informs value hierarchy only; no reference pixels become assets.
"""
import bpy,bmesh,math,json,hashlib,subprocess
from pathlib import Path
from mathutils import Vector
import numpy as np
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/sift-architecture/v01';OUT=ROOT/'assets/models/adventure';SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf8'))
before=json.loads((ROOT/'reports/2026-10-22/evidence/sift-architecture/before/report.json').read_text(encoding='utf8'))
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Workshop design sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.32,.43,.48,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
def V(p):return Vector((p[0],-p[2],p[1]))
def image(name,data,normal=False):
 h,w,_=data.shape;im=bpy.data.images.new(name,width=w,height=h,alpha=True);im.colorspace_settings.name='Non-Color' if normal else 'sRGB';im.pixels.foreach_set(data.astype(np.float32).ravel());im.filepath_raw=str(ART/(name+'.png'));im.file_format='PNG';im.save();return im
n=SPEC['textures']['size'];rng=np.random.default_rng(20261022);v,u=np.mgrid[0:n,0:n]/n
grain=.030*rng.normal(size=(n,n))+.030*np.sin(u*17)*np.sin(v*23)+.018*np.sin(v*37)*np.sin(u*31)+.006*np.sin(u*301-v*177)
stone=np.clip(.88+grain,.65,1);joint=np.minimum.reduce([u,1-u,v,1-v]);floor=stone*(.42+.58*np.clip(joint/.014,0,1))
rgba=lambda a:np.dstack([a,a,a,np.ones_like(a)])
stoneImage=image('stone-albedo',rgba(stone));floorImage=image('floor-albedo',rgba(floor))
def normal(a):
 dy,dx=np.gradient(a);vec=np.dstack([-dx*2,-dy*2,np.ones_like(dx)]);vec/=np.linalg.norm(vec,axis=2)[:,:,None];return np.dstack([vec*.5+.5,np.ones_like(dx)])
stoneNormal=image('stone-normal',normal(stone),True);floorNormal=image('floor-normal',normal(floor),True)
M={}
for name,color in SPEC['palette'].items():
 m=bpy.data.materials.new('Atelier '+name);m.diffuse_color=(*color,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=m.diffuse_color;bs.inputs['Metallic'].default_value=.68 if name=='brass' else 0;bs.inputs['Roughness'].default_value=.38 if name=='brass' else .86
 if name!='brass':
  # glTF exports these image nodes, unlike unbaked procedural Blender textures.
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=floorImage if name=='floor' else stoneImage
  mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[1].default_value=(*color,1);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[2]);m.node_tree.links.new(mix.outputs['Color'],bs.inputs['Base Color'])
  norm=m.node_tree.nodes.new('ShaderNodeTexImage');norm.image=floorNormal if name=='floor' else stoneNormal;nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.35;m.node_tree.links.new(norm.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
 M[name]=m
parts={}
def begin(name):
 p=bpy.data.objects.new(name,None);scene.collection.objects.link(p);parts[name]=p;return p
def uv(o,floor=False):
 if o.type!='MESH':return
 layer=o.data.uv_layers.new(name='CraftedUV')
 for f in o.data.polygons:
  axis=max(range(3),key=lambda k:abs(f.normal[k]));axes=[k for k in range(3) if k!=axis]
  for i in f.loop_indices:
   p=o.matrix_world@o.data.vertices[o.data.loops[i].vertex_index].co;layer.data[i].uv=(p[axes[0]]/1.5,p[axes[1]]/1.5)
def finish(o,name,key,parent):o.name=name;o.data.materials.append(M[key]);o.parent=parent;uv(o);return o
def box(name,pos,size,key,parent,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=V(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  b=o.modifiers.new('Carved edges','BEVEL');b.width=bevel;b.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
 return finish(o,name,key,parent)
def poly(name,vertices,faces,key,parent):
 me=bpy.data.meshes.new(name);me.from_pydata([V(p) for p in vertices],[],faces);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free();o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);return finish(o,name,key,parent)
def rod(name,a,b,r,key,parent,vertices=12,r2=None):
 start,end=V(a),V(b);d=end-start;bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(start+end)/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,key,parent)
def orb(name,pos,size,key,parent,segments=20,rings=12):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=V(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,key,parent)
def ring(name,pos,r,thick,key,parent,normal=(0,0,1)):
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=thick,major_segments=48,minor_segments=8,location=V(pos));o=bpy.context.object;o.rotation_euler=V(normal).to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,key,parent)
def arch(name,rx,ry,y0,z,depth,key,parent,count=24,thick=.22):
 for i in range(count):
  a=i*math.pi/count+.003;b=(i+1)*math.pi/count-.003;vertices=[]
  for dz in [-depth/2,depth/2]:
   for ax,ay in [(rx,ry),(rx+thick,ry+thick)]:
    for t in [a,b]:vertices.append((ax*math.cos(t),y0+ay*math.sin(t),z+dz))
  poly(name,vertices,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],key,parent)
p=begin('WorkHall')
for sd in [-1,1]:
 x=sd*6.35
 for z in [-5.6,0,5.6]:
  box('Pier foot',(x,.18,z),(1,.36,1.04),'edge',p)
  box('Pier bevel base',(x,.44,z),(.83,.16,.85),'pale',p)
  box('Fluted pier',(x,2.40,z),(.62,3.76,.68),'stone',p)
  # Recesses are actual geometry/shadows rather than a solid cuboid silhouette.
  for dz in [-.21,0,.21]:box('Carved upright flute',(x-sd*.327,2.38,z+dz),(.025,3.28,.05),'edge',p,.008)
  box('Crown corbel',(x,4.39,z),(.94,.28,1.0),'pale',p)
  box('Cornice',(x,4.62,z),(1.12,.18,1.12),'edge',p)
  box('Bronze collar',(x,3.86,z),(.66,.045,.74),'brass',p,.006)
 for start,end in [(-5.2,-.4),(.4,5.2)]:
  middle=(start+end)/2;length=end-start
  box('Low plinth',(x,.19,middle),(.64,.38,length),'edge',p)
  box('Raised rail',(x,1.02,middle),(.44,.16,length),'pale',p)
  box('Inlaid rail edge',(x-sd*.225,1.08,middle),(.025,.025,length),'brass',p,.004)
  for z in np.linspace(start+.25,end-.25,6):box('Rail baluster',(x,.66,float(z)),(.24,.64,.16),'stone',p)
 box('Long cornice',(x,4.56,0),(.46,.18,11.9),'pale',p)
for z in [-5.6,0,5.6]:
 arch('Segmented transverse rib',6.13,1.82,4.56,z,.46,'stone',p,32,.22)
 arch('Recessed rib line',6.11,1.80,4.56,z+.235,.035,'edge',p,32,.045)
 for sd in [-1,1]:
  box('Wing capital',(sd*5.98,4.62,z),(1.0,.22,.7),'pale',p)
  for k in range(3):box('Layered corbel',(sd*(6.15-k*.17),4.13+k*.17,z),(.54,.18,.59),'stone',p)
p=begin('HallFloor')
# Flat world floor: image joints/normal relief do not become physics steps.
poly('Stone paving',[(-6.95,0,-6.2),(6.95,0,-6.2),(6.95,0,6.2),(-6.95,0,6.2)],[(0,1,2,3)],'floor',p)
v=[(x,y,z) for y in [-.20,0] for x,z in [(-6.95,-6.2),(6.95,-6.2),(6.95,6.2),(-6.95,6.2)]]
poly('Supported platform',v,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'edge',p)
for sd in [-1,1]:
 box('Brass border',(sd*5.60,.001,0),(.024,.002,11.2),'brass',p,0)
 box('Brass end border',(0,.001,sd*5.60),(11.2,.002,.024),'brass',p,0)
p=begin('ThresholdArch')
box('Supported doorway apron',(0,-.0995,.20),(6.75,.201,1.24),'edge',p,0)
for sd in [-1,1]:
 x=sd*2.80
 box('Portal plinth',(x,.16,0),(.8,.32,.70),'edge',p)
 box('Portal upright',(x,1.82,0),(.72,3.0,.60),'stone',p)
 box('Portal fluted face',(x,1.90,.315),(.4,2.6,.035),'edge',p,.006)
 for dx in [-.17,.17]:box('Portal bronze groove',(x+dx,1.90,.339),(.024,2.5,.012),'brass',p,.003)
 box('Portal capital',(x,3.42,0),(.94,.22,.74),'pale',p)
arch('Door arch',2.40,1.38,3.30,0,.70,'stone',p,24,.34)
arch('Door arch trim',2.38,1.36,3.30,.36,.025,'brass',p,24,.055)
p=begin('SiftGuardian')
# Base and pleated robe remain inside the existing 2.2m protected radius.
rod('Octagonal base',(0,0,0),(0,.32,0),1.72,'edge',p,12,1.59)
rod('Base moulding',(0,.32,0),(0,.46,0),1.58,'pale',p,12,1.52)
verts=[];rows=22;cols=64
for j in range(rows):
 t=j/(rows-1);yy=.45+t*3.05;base=1.32*(1-t)+.88*t
 for i in range(cols):
  a=i*math.tau/cols;rr=base*(1+.075*math.cos(a*14)*(1-.35*t)+.018*math.sin(a*29));verts.append((math.cos(a)*rr,yy,math.sin(a)*rr*.64))
poly('Carved pleated robe',verts,[(j*cols+i,j*cols+(i+1)%cols,(j+1)*cols+(i+1)%cols,(j+1)*cols+i) for j in range(rows-1) for i in range(cols)],'cloth',p)
for sd in [-1,1]:
 # A layered stole follows the carved robe, with a tangible bronze seam.
 poly('Stone shoulder stole',[(sd*.28,3.62,.62),(sd*1.20,3.40,.40),(sd*1.35,.64,.74),(sd*.66,.58,.94)],[(0,1,2,3)],'pale',p)
 rod('Stole seam',(sd*.63,.62,.965),(sd*.29,3.56,.655),.026,'brass',p)
 orb('Carved shoulder',(sd*1.12,3.40,.0),(.46,.36,.45),'stone',p)
 rod('Upper sleeve',(sd*1.20,3.35,.08),(sd*1.43,2.89,.55),.31,'stone',p,16,.25)
 rod('Forward sleeve',(sd*1.43,2.89,.55),(sd*1.12,2.80,1.04),.25,'pale',p,16,.19)
 orb('Supporting palm',(sd*1.04,2.79,1.13),(.19,.18,.16),'stone',p)
 for k in range(4):
  yy=2.66+k*.09;xx=sd*(1.07+.035*math.sin(k))
  rod('Carved finger',(xx,yy,1.19),(sd*.94,yy+.02,1.25),.043,'pale',p,10,.034)
  orb('Knuckle',(xx,yy,1.18),(.049,.05,.05),'stone',p,12,8)
 rod('Thumb',(sd*1.10,2.98,1.10),(sd*.98,2.94,1.22),.062,'pale',p,12,.045)
# Broad hood behind the mask; a full forward sphere would cover the eyes.
orb('Hood crown',(0,4.44,-.22),(1.04,.98,.72),'edge',p,32,20)
hood=[(-.75,3.95,.48),(-.96,4.35,.49),(-.84,4.97,.48),(-.45,5.30,.37),(0,5.45,.26),(.45,5.30,.37),(.84,4.97,.48),(.96,4.35,.49),(.75,3.95,.48)]
for a,b in zip(hood,hood[1:]):rod('Carved hood rim',a,b,.10,'pale',p,16)
for sd in [-1,1]:
 orb('Hood shoulder',(sd*.73,3.91,.14),(.37,.30,.46),'stone',p)
xs=[-.73,-.59,-.27,-.12,.12,.27,.59,.73];ys=[4.0,4.34,4.44,4.66,4.94]
for j in range(len(ys)-1):
 for i in range(len(xs)-1):
  xx=(xs[i]+xs[i+1])/2;yy=(ys[j]+ys[j+1])/2
  if j==2 and .27<abs(xx)<.59:continue
  def face_point(x,y):
   scale={4.0:.64,4.34:.90,4.44:1,4.66:1,4.94:.80}[y];return(x*scale,y,.895+.035*(1-(x/.73)**2)-.025*abs(y-4.55))
  poly('Open eye mask',[face_point(x,y) for x,y in [(xs[i],ys[j]),(xs[i+1],ys[j]),(xs[i+1],ys[j+1]),(xs[i],ys[j+1])]],[(0,1,2,3)],'face',p)
outline=[(-.467,4.0),(.467,4.0),(.657,4.34),(.73,4.44),(.73,4.66),(.584,4.94),(-.584,4.94),(-.73,4.66),(-.73,4.44),(-.657,4.34)]
for a,b in zip(outline,outline[1:]+outline[:1]):poly('Mask carved edge',[(a[0],a[1],.88),(b[0],b[1],.88),(b[0],b[1],.72),(a[0],a[1],.72)],[(0,1,2,3)],'stone',p)
poly('Mask back',[(x,y,.72) for x,y in outline],[tuple(range(len(outline)))],'edge',p)
poly('Carved nose',[(-.11,4.47,.90),(.11,4.47,.90),(.09,4.26,.90),(-.09,4.26,.90),(0,4.32,1.06)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'pale',p)
mouth=[(-.20,4.145,.936),(-.10,4.12,.942),(0,4.115,.946),(.10,4.12,.942),(.20,4.145,.936)]
for a,b in zip(mouth,mouth[1:]):rod('Incised mouth',a,b,.009,'edge',p,8)
for sd in [-1,1]:
 box('Brow ridge',(sd*.43,4.72,.915),(.42,.055,.07),'pale',p,.014)
 for yy in [4.43,4.67]:box('Eye socket trim',(sd*.43,yy,.90),(.36,.025,.045),'edge',p,.004)
 ring('Temple medallion',(sd*.91,4.45,.48),.16,.035,'brass',p)
ring('Sieve crown',(0,4.89,-.68),1.33,.075,'brass',p)
ring('Crown inner stone',(0,4.89,-.69),1.14,.055,'pale',p)
for i in range(16):
 a=i*math.tau/16;x=math.cos(a)*1.45;yy=4.89+math.sin(a)*1.45
 o=box('Crown ray',(x,yy,-.68),(.07,.19,.10),'brass',p,.009);o.rotation_euler[1]=-a+math.pi/2
ring('Held sieve rim',(0,2.9,1.13),1.02,.075,'brass',p)
ring('Sieve inner edge',(0,2.9,1.15),.92,.025,'pale',p)
for i in range(-5,6):
 t=i*.16;length=math.sqrt(.89**2-t*t)
 rod('Sieve wire',(t,2.9-length,1.13),(t,2.9+length,1.13),.016,'brass',p,8)
 rod('Sieve wire',(-length,2.9+t,1.13),(length,2.9+t,1.13),.016,'brass',p,8)
# Join each part by material; the game instances all four halls together.
metrics={}
for name,parent in parts.items():
 by={}
 for o in list(parent.children):by.setdefault(o.data.materials[0].name,[]).append(o)
 for key,objects in by.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=name+' '+key
 for o in parent.children:o.data.calc_loop_triangles()
 bpy.context.view_layer.update();points=[o.matrix_world@v.co for o in parent.children for v in o.data.vertices]
 metrics[name]={'meshes':len(parent.children),'triangles':sum(len(o.data.loop_triangles) for o in parent.children),'webMin':[min(v.x for v in points),min(v.z for v in points),-max(v.y for v in points)],'webMax':[max(v.x for v in points),max(v.z for v in points),-min(v.y for v in points)]}
bpy.ops.object.select_all(action='SELECT');OUT.mkdir(parents=True,exist_ok=True);bpy.ops.export_scene.gltf(filepath=str(OUT/'sift-architecture-v01.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_apply=True)
subprocess.run(['node',str(ROOT/'tools/finalize-sift-materials.cjs')],cwd=str(ROOT),check=True)
metrics['glbBytes']=(OUT/'sift-architecture-v01.glb').stat().st_size;assert metrics['glbBytes']<SPEC['budgets']['glbBytesMax'];assert sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))<SPEC['budgets']['trianglesMax']
metrics['textures']=[{'name':im.name,'width':n,'height':n} for im in [stoneImage,floorImage,stoneNormal,floorNormal]]
(ART/'model-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8');(OUT/'sift-architecture-v01.json').write_text(json.dumps(SPEC,indent=2),encoding='utf8')
# Preserve a compact editable kit before adding separate target composition.
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.cycles.diffuse_bounces=2;scene.cycles.glossy_bounces=2;scene.render.threads_mode='FIXED';scene.render.threads=8;scene.render.resolution_x=960;scene.render.resolution_y=675;scene.render.resolution_percentage=100
for pos,power,size in [((8,-8,12),1800,7),((-7,5,7),950,6)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV'
for name,p in parts.items():
 for o in p.children:o.hide_render=True
for name,p in parts.items():
 for o in p.children:o.hide_render=False
 centre=Vector((0,0,3.2 if name in ['WorkHall','SiftGuardian'] else 2.5 if name=='ThresholdArch' else 0));distance=18 if name=='WorkHall' else 12 if name=='ThresholdArch' else 10 if name=='SiftGuardian' else 17
 cam.data.angle=math.radians(48)
 for view,a in [('front',0),('side',math.pi/2),('rear',math.pi)]:
  cam.location=centre+Vector((math.sin(a)*math.cos(.3)*distance,-math.cos(a)*math.cos(.3)*distance,math.sin(.3)*distance));cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ART/(name+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
 for o in p.children:o.hide_render=True
for o in parts['WorkHall'].children:o.hide_render=False
for o in parts['HallFloor'].children:o.hide_render=False
cam.location=(0,-13,4);cam.rotation_euler=(Vector((0,0,2))-cam.location).to_track_quat('-Z','Y').to_euler()
for name,p in parts.items():
 for o in p.children:o.hide_set(name not in ['WorkHall','HallFloor'])
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'sift-architecture-v01.blend'));bpy.ops.file.make_paths_relative();bpy.ops.wm.save_mainfile()
# Architecture massing goals use the exact twelve recorded game cameras.
# Simple devices/hero are explicitly proxies, not final gameplay captures.
for p in parts.values():
 for o in p.children:o.hide_render=True;o.hide_set(False)
goals=[]
def copy_part(name,pos=(0,0,0),sx=1,sz=1):
 source=parts[name];group=bpy.data.objects.new('Goal '+name,None);scene.collection.objects.link(group);group.location=V(pos);group.scale=(sx,sz,1)
 for o in source.children:c=o.copy();c.data=o.data;scene.collection.objects.link(c);c.parent=group;c.hide_render=False
 goals.append(group);return group
for s in before['layout']['rooms']:
 scale=(s['x1']-s['x0'])/12;cz=(s['z0']+s['z1'])/2;copy_part('WorkHall',(0,0,cz),scale,scale);copy_part('HallFloor',(0,0,cz),scale,scale)
for door in before['layout']['doors']:copy_part('ThresholdArch',(0,0,door['rect']['z1']-.45))
gz=before['layout']['guardian']['gz']-3;copy_part('SiftGuardian',(0,0,gz))
proxy=begin('GoalOnlyDevices');parts.pop('GoalOnlyDevices')
for it in before['layout']['samples']:box('Untextured sample proxy',(it['x'],1.06,it['z']),(.64,.64,.64),'pale',proxy,.01)
for k,s in before['layout']['stations'].items():
 box('Worktable proxy',(s['x'],.72,s['z']),(2.05,.15,1.85),'edge',proxy)
 if k!='potHome':orb('Device massing proxy',(s['x'],1.38,s['z']),(.65,.50,.60),'pale',proxy)
frame=before['layout']['frame'];box('Sieve table proxy',(frame['x'],1.45,frame['z']),(3.2,.20,3.2),'edge',proxy)
hero=begin('GoalOnlyHero');parts.pop('GoalOnlyHero');rod('Human scale body',(0,.12,0),(0,1.28,0),.16,'edge',hero);orb('Human scale head',(0,1.39,0),(.13,.13,.13),'pale',hero)
for shot in before['shots']:
 hero.location=V(shot['actor']);cam.location=V(shot['camera']);target=V([shot['actor'][0],shot['actor'][1]+1.25,shot['actor'][2]]);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
print('SIFT_ARCHITECTURE_RESULT '+json.dumps(metrics))
