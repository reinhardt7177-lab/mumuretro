"""Original separation kit. Game coordinates x/y-up/z -> Blender x/-z/y."""
import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/separation-journey/v01';OUT=ROOT/'assets/models/adventure';SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf8'))
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Workshop goal world');scene.world.color=(.28,.27,.23)
def vec(p):return Vector((p[0],-p[2],p[1]))
def mat(name,c,metal=0,rough=.7):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=m.diffuse_color;n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough;return m
M={key:mat('Workshop '+key,c,.68 if key in ['brass','pole'] else 0,.36 if key in ['brass','pole'] else .8) for key,c in SPEC['palette'].items()}
parts={}
def begin(name):
 p=bpy.data.objects.new(name,None);scene.collection.objects.link(p);parts[name]=p;return p
def finish(o,name,m,p):o.name=name;o.data.materials.append(M[m]);o.parent=p;return o
def box(name,pos,size,m,p,bevel=.01):
 bpy.ops.mesh.primitive_cube_add(size=1,location=vec(pos));o=finish(bpy.context.object,name,m,p);o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Soft crafted edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def poly(name,vertices,faces,m,p):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([vec(v) for v in vertices],[],faces);mesh.update();bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free();o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);return finish(o,name,m,p)
p=begin('WorkTable');outline=[]
for cx,a0 in [(.1,-math.pi/2),(-.1,math.pi/2)]:
 for i in range(17):
  a=a0+i*math.pi/16;outline.append((cx+.925*math.cos(a),.925*math.sin(a)))
n=len(outline);verts=[(x,y,z) for y in [.645,.795] for x,z in outline];faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
poly('Rounded work surface',verts,faces,'wood',p)
for x in [-.72,.72]:
 for z in [-.52,.52]:
  box('Timber leg',(x,.35,z),(.14,.70,.14),'edge',p);box('Brass foot',(x,.055,z),(.155,.11,.155),'brass',p,.007)
box('Cross brace',(0,.25,0),(1.5,.10,.10),'wood',p)
for x in [-.4,0,.4]:box('Plank seam',(x,.796,0),(.009,.002,1.45),'edge',p,0)
p=begin('FilterFunnel')
for i in range(48):
 a=i*math.tau/48;b=(i+1)*math.tau/48;r0=.82 if i%2==0 else .80;r1=.82 if (i+1)%2==0 else .80
 v=[]
 for radius,y in [(r0,1.73),(.12,1.29),(r0-.008,1.73),(.112,1.29)]:
  other={r0:r1,.12:.12,r0-.008:r1-.008,.112:.112}[radius]
  v.extend([(radius*math.cos(a),y,radius*math.sin(a)),(other*math.cos(b),y,other*math.sin(b))])
 poly('Folded filter paper',v,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],'paper',p)
p=begin('InspectionMagnet');V=[];F=[];steps=32;tubes=8
for i in range(steps+1):
 a=math.pi+i*math.pi/steps
 for j in range(tubes):
  f=j*math.tau/tubes;radius=.18+.055*math.cos(f);V.append((radius*math.cos(a),.055*math.sin(f),.26+radius*math.sin(a)))
for i in range(steps):
 for j in range(tubes):F.append((i*tubes+j,i*tubes+(j+1)%tubes,(i+1)*tubes+(j+1)%tubes,(i+1)*tubes+j))
F.extend([tuple(range(tubes-1,-1,-1)),tuple(steps*tubes+j for j in range(tubes))]);poly('U magnetic body',V,F,'magnet',p)
for x in [-.18,.18]:
 box('Magnet limb',(x,0,.355),(.11,.11,.20),'magnet',p,.007);box('Polished pole',(x,0,.495),(.11,.11,.10),'pole',p,.004)
bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.035,depth=.21,location=vec((0,.035,0)),rotation=(math.pi/2,0,0));o=finish(bpy.context.object,'Palm handle','wood',p)
box('Handle ferrule',(0,.04,.095),(.085,.08,.03),'brass',p,.007)
# Join within material per part, bake each local transform.
metrics={}
for name,p in parts.items():
 by={}
 for o in list(p.children):by.setdefault(o.data.materials[0].name,[]).append(o)
 for key,objects in by.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name+' '+key
 for o in p.children:o.data.calc_loop_triangles()
 bpy.context.view_layer.update();v=[o.matrix_world@c.co for o in p.children for c in o.data.vertices]
 metrics[name]={'meshes':len(p.children),'triangles':sum(len(o.data.loop_triangles) for o in p.children),'webMin':[min(c.x for c in v),min(c.z for c in v),-max(c.y for c in v)],'webMax':[max(c.x for c in v),max(c.z for c in v),-min(c.y for c in v)]}
bpy.ops.object.select_all(action='SELECT');OUT.mkdir(parents=True,exist_ok=True);bpy.ops.export_scene.gltf(filepath=str(OUT/'separation-tools-v01.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_apply=True)
metrics['glbBytes']=(OUT/'separation-tools-v01.glb').stat().st_size;assert metrics['glbBytes']<SPEC['budgets']['glbBytesMax'];assert sum(m['triangles'] for m in metrics.values() if isinstance(m,dict))<SPEC['budgets']['trianglesMax']
(ART/'model-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8');(OUT/'separation-tools-v01.json').write_text(json.dumps(SPEC,indent=2),encoding='utf8')
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=1000;scene.render.resolution_y=800
for p in parts.values():
 for o in p.children:o.hide_render=True
bpy.ops.mesh.primitive_plane_add(size=30);floor=bpy.context.object;floor.location.z=-.02;floor.data.materials.append(mat('Goal floor',(.12,.10,.07)))
for pos,power in [((3,-4,5),650),((-3,2,5),450)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=4;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.sensor_fit='VERTICAL';camera.data.lens_unit='FOV';camera.data.angle=math.radians(45)
for name in parts:
 for o in parts[name].children:o.hide_render=False
 distance,height=(4.3,.55) if name=='WorkTable' else (3.8,1.7) if name=='FilterFunnel' else (1.5,0)
 floor.location.z=-.08 if name=='InspectionMagnet' else -.02
 target=Vector((0,0,height))
 for view,a in [('front',0),('side',math.pi/2),('rear',math.pi)]:
  camera.location=target+Vector((math.sin(a)*math.cos(.3)*distance,-math.cos(a)*math.cos(.3)*distance,math.sin(.3)*distance));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ART/(name+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
 for o in parts[name].children:o.hide_render=True
for name,p in parts.items():
 for o in p.children:o.hide_set(name!='WorkTable');o.hide_render=name!='WorkTable'
floor.location.z=-.02;camera.location=(0,-4.1,2);camera.rotation_euler=(Vector((0,0,.5))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'separation-tools-v01.blend'));print('SEPARATION_RESULT '+json.dumps(metrics))
