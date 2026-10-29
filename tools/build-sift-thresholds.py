"""New closed stone sliding-gate kit; retain and pack the old workshop as reference."""
import bpy,bmesh,math,json,hashlib
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];A=R/'art/sift-thresholds/v01';spec=json.loads((A/'design-spec.json').read_text(encoding='utf8'))
original=R/'art/sift-architecture/v01/sift-architecture-v01.blend';old_sha=hashlib.sha256(original.read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(original));scene=bpy.context.scene
old_objects=[o for o in scene.objects];old_images={im.name:hashlib.sha256(Path(bpy.path.abspath(im.filepath)).read_bytes()).hexdigest() for im in bpy.data.images if im.source=='FILE' and Path(bpy.path.abspath(im.filepath)).is_file()}
for o in old_objects:o.hide_set(True);o.hide_render=True
M={}
for key in ['stone','pale','edge','brass','cloth']:
 m=bpy.data.materials['Atelier '+key].copy();m.name='Sift threshold '+key;M[key]=m
def V(p):return Vector((p[0],-p[2],p[1]))
pieces=[];roots=[]
def root(name):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);roots.append(o);return o
def uv(o):
 if not o.data.uv_layers:o.data.uv_layers.new()
 layer=o.data.uv_layers.active
 for f in o.data.polygons:
  n=f.normal;axes=(0,1)if abs(n.z)>.6 else (0,2)if abs(n.y)>.6 else (1,2)
  for k in f.loop_indices:
   p=o.matrix_world@o.data.vertices[o.data.loops[k].vertex_index].co;layer.data[k].uv=(p[axes[0]]/1.5,p[axes[1]]/1.5)
def finish(o,name,key,parent):
 o.name=name;o.data.materials.clear();o.data.materials.append(M[key]);o.parent=parent;o.hide_set(False);o.hide_render=False;uv(o);o.data.update();bm=bmesh.new();bm.from_mesh(o.data);boundary=sum(e.is_boundary for e in bm.edges);bm.free();assert boundary==0,name
 points=[o.matrix_world@Vector(v) for v in o.bound_box];pieces.append({'name':o.name,'root':parent.name,'material':key,'min':[min(p[i]for p in points)for i in range(3)],'max':[max(p[i]for p in points)for i in range(3)],'boundary':boundary});return o
def box(name,pos,size,key,parent,bevel=.014):
 bpy.ops.mesh.primitive_cube_add(size=1,location=V(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Carved corner','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,name,key,parent)
def prism(name,outline,z0,z1,key,parent):
 count=len(outline);verts=[V((x,y,z))for z in[z0,z1]for x,y in outline];faces=[tuple(range(count-1,-1,-1)),tuple(range(count,count*2))]+[(i,(i+1)%count,(i+1)%count+count,i+count)for i in range(count)]
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free();o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);return finish(o,name,key,parent)
leaf=root('SiftDoorLeaf')
box('Leaf closed stone core',(0,1.65,0),(2.4,3.3,.28),'stone',leaf,.018)
for face in[-1,1]:
 z=face*.153
 box('Recessed jade field',(0,1.65,z),(1.98,2.88,.024),'cloth',leaf,.025)
 for x in[-1.035,1.035]:box('Bronze edge casing',(x,1.65,face*.174),(.055,2.98,.045),'brass',leaf,.006)
 for y in[.17,3.13]:box('Bronze field rail',(0,y,face*.174),(2.12,.055,.045),'brass',leaf,.006)
 # A compact sieve grille, backed by the recessed field; no free-floating graphic.
 box('Grille dark recess',(0,2.05,face*.18),(1.38,.88,.035),'edge',leaf,.018)
 for x in[-.72,.72]:box('Grille side',(x,2.05,face*.21),(.055,.99,.04),'brass',leaf,.006)
 for y in[1.56,2.54]:box('Grille top bottom',(0,y,face*.21),(1.49,.055,.04),'brass',leaf,.006)
 for x in[-.45,-.15,.15,.45]:box('Grille upright',(x,2.05,face*.21),(.025,.94,.04),'brass',leaf,.004)
 for y in[1.78,2.05,2.32]:box('Grille cross member',(0,y,face*.21),(1.42,.025,.04),'brass',leaf,.004)
 for x in[-.82,.82]:
  for y in[.45,2.85]:box('Fastened corner stud',(x,y,face*.195),(.08,.08,.055),'brass',leaf,.015)
 box('Lower stone inset',(0,.9,face*.18),(1.45,.48,.045),'pale',leaf,.023)
box('Sliding runner',(0,.045,0),(2.4,.09,.32),'brass',leaf,.008)
housing=root('SiftDoorHousing')
behind=-spec['leaf']['behindArch']
# Local z=-.5 follows the door behind the old arch; front column is in front of this cavity.
for sign in[-1,1]:
 x=sign*3.725
 for z in[behind-.39,behind+.39]:box('Pocket outer wall',(x,1.7,z),(2.65,3.4,.14),'stone',housing,.018)
 box('Pocket outer end',(sign*5.05,1.7,behind),(.12,3.4,.72),'edge',housing,.012)
 box('Pocket cornice',(x,3.5,behind),(2.79,.22,.98),'pale',housing,.023)
 for z in[behind-.39,behind+.39]:box('Pocket supported foot',(x,.12,z),(2.79,.24,.2),'edge',housing,.018)
 for face in[-1,1]:
  z=behind+face*.47
  box('Pocket recessed facade',(x,1.73,z),(2.18,2.66,.035),'pale',housing,.012)
  for yy in[.38,3.07]:box('Pocket bronze seam',(x,yy,z+face*.025),(2.25,.036,.03),'brass',housing,.004)
 # Extend only beyond the old apron. Centre surfaces never overlap its top.
 x0=3.375;x1=5.12
 box('Supported side wing',(sign*(x0+x1)/2,-.0995,.2),(x1-x0,.201,1.24),'edge',housing,0)
 box('Supported rear wing',(sign*(2.1+x1)/2,-.0995,-.77),(x1-2.1,.201,.7),'edge',housing,0)
vent=root('SiftDoorVent')
# Solid shallow perforated-transom ribs clipped to the existing ellipse.
for x in[-2.2+i*.275 for i in range(17)]:
 top=3.3+1.36*math.sqrt(max(0,1-(x/2.38)**2));box('Arched vent upright',(x,(3.3+top)/2,behind),(.036,top-3.3,.14),'brass',vent,.004)
for y in[3.48,3.74,4.0,4.26,4.5]:
 half=2.38*math.sqrt(max(0,1-((y-3.3)/1.36)**2));box('Arched vent cross rail',(0,y,behind),(half*2,.033,.14),'brass',vent,.004)
box('Transom sill',(0,3.35,behind),(4.8,.07,.2),'edge',vent,.008)
scene['floorReference']='Game y=0; native source Blender z=0. Foundation wings match existing apron at.001; original source retained hidden.'
for im in bpy.data.images:
 if im.source=='FILE' and Path(bpy.path.abspath(im.filepath)).is_file() and not im.packed_file:im.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(A/'sift-thresholds-v01.blend'))
layout={'parts':spec['parts'],'pieces':pieces,'originalObjectsRetained':len(old_objects),'oldSourceSha':old_sha,'oldImages':old_images,'floorReference':0};(A/'layout.json').write_text(json.dumps(layout,indent=2),encoding='utf8')
# Join only the export copy per root/material. The saved .blend remains editable.
for parent in roots:
 buckets={}
 for o in list(parent.children):buckets.setdefault(o.data.materials[0].name,[]).append(o)
 for key,group in buckets.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in group:o.hide_set(False);o.select_set(True)
  bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name=parent.name+' '+key
bpy.ops.object.select_all(action='DESELECT')
for parent in roots:
 parent.select_set(True)
 for o in parent.children:o.select_set(True)
target=A/'sift-thresholds-v01.glb';bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
raw=target.read_bytes();length=int.from_bytes(raw[12:16],'little');gltf=json.loads(raw[20:20+length]);triangles=sum(a['count']//3 for a in gltf.get('accessors',[]) if False)
triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes']for p in m['primitives']);assert hashlib.sha256(original.read_bytes()).hexdigest()==old_sha
metrics={'pass':True,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'meshes':len(gltf['meshes']),'materials':len(gltf['materials']),'triangles':triangles,'editablePieces':len(pieces),'oldObjectsRetained':len(old_objects),'oldSourceUnchanged':True};(A/'metrics.json').write_text(json.dumps(metrics,indent=2));print(json.dumps(metrics),flush=True)
