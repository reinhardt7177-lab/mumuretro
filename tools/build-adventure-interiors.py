"""Original science witness reliefs. Blender Z-up -> web Y-up; no licensed game assets."""
import bpy, math, json, numpy as np, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/adventure-interiors/v01'; OUT=ROOT/'assets/models/adventure'
SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf8'))
# Preserve the original design sheet while rebuilding the current reflection
# profile from the later, reviewed lighting palette.
light_palette=ROOT/'art/chronicle-light/v01/palette.json'
if light_palette.exists(): SPEC['profiles']['strata']=json.loads(light_palette.read_text(encoding='utf8'))['reflection']
ART.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12
scene.render.resolution_x=400;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.world.color=(.3,.35,.4)

def mat(name,colour,metal=0,rough=.7):
 m=bpy.data.materials.new(name);m.diffuse_color=(*colour,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=m.diffuse_color
 bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 return m
stone=mat('Witness blue carved limestone',(.20,.28,.31));brass=mat('Witness satin bronze',(.66,.43,.17),.68,.38)
light=mat('Witness enamel',(.35,.72,.68),.05,.3)
size=256;y,x=np.mgrid[:size,:size]/size;grain=.72+.035*np.sin(x*43+y*17)+.022*np.cos(y*71-x*31)
pixels=np.ones((size,size,4),dtype=np.float32);pixels[:,:,:3]=grain[:,:,None]
texture=bpy.data.images.new('Witness limestone 256',width=size,height=size,alpha=True);texture.pixels.foreach_set(pixels.ravel())
texture.filepath_raw=str(ART/'witness-grain.png');texture.file_format='PNG';texture.save();texture.pack()
node=stone.node_tree.nodes.new('ShaderNodeTexImage');node.image=texture
stone.node_tree.links.new(node.outputs['Color'],stone.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
all_objects=[];groups={}
def finish(o,name,m):
 o.name=name;o.data.materials.append(m);all_objects.append(o);groups.setdefault(m.name,[]).append(o);return o
def box(name,p,scale,m,bevel=.012):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=finish(bpy.context.object,name,m);o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Chisel edge','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def rod(name,a,b,r,m):
 a,b=Vector(a),Vector(b);d=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=d.length,location=(a+b)*.5)
 o=finish(bpy.context.object,name,m);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def ring(name,x,z,r,m,y=-.14):
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=.012,major_segments=20,minor_segments=4,location=(x,y,z),rotation=(math.pi/2,0,0))
 return finish(bpy.context.object,name,m)
def line(points,m=light):
 for a,b in zip(points,points[1:]):rod('Carved line',(a[0],-.145,a[1]),(b[0],-.145,b[1]),.013,m)
def gem(x,z,r=.035):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=r,location=(x,-.145,z));return finish(bpy.context.object,'Enamel grain',light)
metrics=[];roots=[]
for ident in ['balance','shadow','sift','water','fire','strata']:
 groups={};start=len(all_objects)
 box('Foot',(0,0,.07),(.64,.22,.14),stone)
 box('Shaft',(0,.01,1.175),(.48,.18,2.07),stone)
 box('Crown',(0,0,2.28),(.64,.22,.14),stone)
 box('Front recessed plaque',(0,-.09,1.39),(.39,.045,1.44),stone,.005)
 for sx in [-1,1]:
  box('Bronze edge',(sx*.232,-.10,1.175),(.018,.035,2.08),brass,.003)
  for z in [.22,.45,2.07]:box('Bronze fillet',(0,-.117,z),(.48,.015,.025),brass,.003)
  for z in [.31,.58,2.18]:rod('Chisel chevron',(sx*.15,-.128,z-.035),(sx*.21,-.128,z+.035),.008,brass)
 ring('Outer mechanism ring',0,1.50,.19,brass)
 ring('Inner enamel ring',0,1.50,.165,light)
 if ident=='balance':
  line([(-.14,1.52),(.14,1.52)]);line([(0,1.35),(0,1.63)])
  for sx in [-1,1]:line([(sx*.11,1.52),(sx*.11,1.42)]);ring('Balance bowl',sx*.11,1.41,.035,light)
 elif ident=='shadow':
  ring('Ray sun',-.06,1.55,.045,light)
  for dz in [-.07,0,.07]:line([(-.005,1.55),(.13,1.50+dz)])
  line([(.08,1.37),(.08,1.61)],brass)
 elif ident=='sift':
  line([(-.13,1.55),(.13,1.55)]);line([(-.13,1.49),(.13,1.49)])
  for x0 in [-.08,0,.08]:line([(x0,1.60),(x0,1.46)])
  for x0,z0 in [(-.06,1.40),(.05,1.42),(0,1.65)]:gem(x0,z0,.022)
 elif ident=='water':
  line([(0,1.66),(-.095,1.48),(-.07,1.39),(0,1.36),(.07,1.39),(.095,1.48),(0,1.66)])
  line([(-.055,1.44),(-.04,1.40),(0,1.39)])
 elif ident=='fire':
  line([(0,1.67),(-.09,1.51),(-.07,1.40),(0,1.36),(.09,1.42),(.10,1.52),(.035,1.48),(0,1.67)])
  line([(0,1.52),(-.027,1.43),(.025,1.43),(0,1.52)])
 else:
  for z0 in [1.42,1.50,1.58]:line([(-.13,z0),(-.045,z0+.025),(.04,z0-.022),(.13,z0+.01)])
 for z0 in [.90,1.00,1.10]:gem(0,z0,.018)
 parts=[]
 for index,(name,objs) in enumerate(groups.items()):
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();o=bpy.context.object;o.name=f'witness-{ident}-{["stone","bronze","light"][index]}'
  bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');parts.append(o)
 root=bpy.data.objects.new('witness-'+ident,None);scene.collection.objects.link(root)
 for o in parts:o.parent=root
 roots.append(root)
 tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in parts)
 coords=[o.matrix_world@v.co for o in parts for v in o.data.vertices]
 lo=[min(v[i] for v in coords) for i in range(3)];hi=[max(v[i] for v in coords) for i in range(3)]
 metrics.append({'id':ident,'meshes':len(parts),'triangles':tris,'blenderBounds':{'min':lo,'max':hi},'webDimensions':[hi[0]-lo[0],hi[2]-lo[2],hi[1]-lo[1]],'webFloorY':lo[2]})
 for o in parts:o.hide_render=True

# Export every variant in a shared source, then stage the exact same geometry for the design views.
bpy.ops.object.select_all(action='DESELECT')
for index,r in enumerate(roots):
 r.select_set(True)
 # Common stone/bronze geometry is exported once, six distinct enamel glyphs once each.
 for o in r.children:o.select_set(index==0 or o.name.endswith('-light'))
target=OUT/'interior-witness-v01.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT',export_apply=True)
bpy.ops.object.light_add(type='AREA',location=(3,-4,5));bpy.context.object.data.energy=500;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
bpy.ops.object.camera_add(location=(0,-5,1.2));cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=2.75
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'interior-witness-v01.blend'))
for r in ([] if '--skip-render' in sys.argv else roots):
 for o in r.children:o.hide_render=False
 for name,position in [('front',(0,-5,1.175)),('side',(5,0,1.175)),('back',(0,5,1.175))]:
  cam.location=position;cam.rotation_euler=(Vector((0,0,1.175))-cam.location).to_track_quat('-Z','Y').to_euler()
  scene.render.filepath=str(ART/f'plan-{r.name[8:]}-{name}.png');bpy.ops.render.render(write_still=True)
 for o in r.children:o.hide_render=True
for index,r in enumerate(roots):
 for o in r.children:o.hide_render=index!=0;o.hide_set(index!=0)
cam.location=(0,-5,1.175);cam.rotation_euler=(Vector((0,0,1.175))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'interior-witness-v01.blend'))
assert target.stat().st_size<SPEC['budget']['glbBytesMax']
assert all(m['triangles']<SPEC['budget']['trianglesPerGlyphMax'] and abs(m['webFloorY'])<1e-5 for m in metrics)
(ART/'model-metrics.json').write_text(json.dumps({'bytes':target.stat().st_size,'models':metrics,'designViewsBeforeRuntime':True},indent=2),encoding='utf8')
(OUT/'interior-art-v01.json').write_text(json.dumps(SPEC,indent=2),encoding='utf8')
print('MUMU_INTERIOR_RESULT '+json.dumps({'bytes':target.stat().st_size,'models':metrics}))
