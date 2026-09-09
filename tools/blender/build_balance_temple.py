"""Celestial balance temple v02, editable Blender source and reusable GLB parts."""
import bpy, math, os, json
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def vec(p):return Vector((p[0],-p[2],p[1]))
def material(name,color,metal=0,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.55;p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission;return m
ivory=material('Ivory limestone',(.58,.56,.43));pale=material('Carved limestone',(.74,.70,.56));dark=material('Midnight teal',(.025,.075,.09));gold=material('Aged brass',(.52,.32,.09),.65);wood=material('Walnut',(.25,.13,.05));light=material('Turquoise inlay',(.06,.6,.5),.25,.5)
def group(name,parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o
def finish(o,name,mat,parent):
 o.name=name;o.data.materials.append(mat);o.parent=parent;return o
def box(name,pos,size,mat,parent,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=vec(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Carved edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,name,mat,parent)
def cyl(name,pos,r,depth,mat,parent,vertices=16,r2=None):
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r if r2 is None else r2,radius2=r,depth=depth,location=vec(pos));return finish(bpy.context.object,name,mat,parent)
def rod(name,a,b,r,mat,parent):
 d=vec(b)-vec(a);o=cyl(name,[(a[i]+b[i])/2 for i in range(3)],r,d.length,mat,parent,10);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def ring(name,pos,r,t,mat,parent,vertical=False):
 bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=6,location=vec(pos),major_radius=r,minor_radius=t);o=bpy.context.object
 if vertical:o.rotation_euler.x=math.pi/2
 return finish(o,name,mat,parent)
def star(pos,r,parent):
 x,y,z=pos
 for a in range(8):
  th=a*math.pi/4;rod('Star rays',(x,y,z),(x+math.sin(th)*r,y+math.cos(th)*r,z),.025,gold,parent)
def chamber(name,w,length,h):
 g=group(name)
 for x in range(int(w/2)):
  for z in range(int(length/2)):
   box('Floor tessera',(-w/2+1+x*2,-.15,-length/2+1+z*2),(1.97,.3,1.97),ivory if (x+z)%3 else pale,g,.02)
 for side in [-1,1]:
  x=side*(w/2+.18);box('Recessed wall',(x,h/2,0),(.38,h,length),dark,g)
  for z in [-length/2+1+i*4 for i in range(int((length-2)/4)+1)]:
   for yy,rr,dd,mm in [(.2,.48,.4,pale),(.52,.36,.24,gold),(h/2,.27,h-1.2,ivory),(h-.6,.4,.35,gold),(h-.25,.5,.4,pale)]:cyl('Fluted column',(side*(w/2-.25),yy,z),rr,dd,mm,g)
   # ribs rise above the playable camera clearance
   points=[]
   for k in range(25):
    a=math.pi*k/24;points.append((math.cos(a)*(w/2-.2),h-3+math.sin(a)*2.8,z))
   for a,b in zip(points,points[1:]):rod('Vault rib',a,b,.13,pale,g)
   for k in range(5):
    yy=2+k*1.05;rod('Constellation',(side*(w/2-.03),yy,z+.55),(side*(w/2-.03),yy+.65,z+1.25),.018,gold,g)
   cyl('Lamp bracket',(side*(w/2-.6),2,z),.25,.2,gold,g);cyl('Lantern glass',(side*(w/2-.6),2.25,z),.13,.35,light,g)
  box('Wall cornice',(x,1.1,0),(.55,.13,length),gold,g);box('Upper cornice',(x,h-1,0),(.55,.18,length),gold,g)
 for r in [2.4,2.7]:ring('Floor medallion',(0,.025,0),r,.025,gold,g)
 for side in [-1,1]:box('Path inlay',(side*(w/2-1.3),.025,0),(.045,.035,length),light,g)
 return g
chamber('hall_order',14,18,9);chamber('hall_twin',14,16,9);chamber('hall_lever',18,28,11);chamber('hall_corridor',5,4,8);chamber('hall_entry',6,12,8)
g=group('plinth');cyl('Octagonal plinth',(0,.18,0),.78,.36,ivory,g,8,r2=.88);cyl('Brass lip',(0,.36,0),.82,.07,gold,g,32)
g=group('crate');box('Wooden body',(0,.36,0),(.72,.72,.72),wood,g)
for x in [-.3,.3]:box('Vertical band',(x,.36,0),(.06,.77,.77),gold,g)
for y in [.08,.65]:box('Horizontal band',(0,y,0),(.76,.055,.76),gold,g)
for x in [-.22,.22]:
 for y in [.12,.6]:cyl('Rivet',(x,y,.385),.025,.028,gold,g,8).rotation_euler.x=math.pi/2
g=group('scale');cyl('Scale base',(0,.16,0),.65,.32,ivory,g,8);cyl('Scale shaft',(0,1.03,0),.11,1.7,gold,g);ring('Axis aureole',(0,1.75,0),.25,.035,gold,g,True)
beam=group('scale_beam',g);beam.location=vec((0,1.75,0));box('Equal arm',(0,0,0),(4.2,.12,.2),gold,beam)
for side,name in [(-1,'pan_left'),(1,'pan_right')]:
 p=group(name,beam);p.location=vec((side*1.9,0,0))
 for a in [0,2.094,4.189]:rod('Pan suspension',(0,0,0),(math.cos(a)*.6,-.9,math.sin(a)*.6),.025,gold,p)
 cyl('Weighing pan',(0,-.95,0),.69,.09,gold,p,32,r2=.56);ring('Pan lip',(0,-.9,0),.68,.028,gold,p)
g=group('lever');box('Six-cell beam',(0,0,0),(8.5,.22,.8),gold,g)
for i in range(6):box('Cell '+str(i+1),((i-2.5)*1.4,.15,0),(1.25,.08,.7),dark,g)
g=group('fulcrum');cyl('Sliding fulcrum',(0,.52,0),.06,1.04,gold,g,3,r2=.7);box('Rail shoe',(0,.08,0),(1.2,.16,1.1),pale,g)
g=group('door_leaf');box('Carved door',(0,2.5,0),(2.45,5,.35),ivory,g)
for x in [-1.08,1.08]:box('Door gold border',(x,2.5,.2),(.07,4.75,.06),gold,g)
for y in [.2,4.8]:box('Door gold border',(0,y,.2),(2.2,.07,.06),gold,g)
ring('Door star circle',(0,2.5,.23),.72,.045,gold,g,True);star((0,2.5,.25),.64,g)
g=group('guardian');cyl('Guardian dais',(0,.25,0),1.8,.5,pale,g,12);cyl('Robed body',(0,1.9,0),.65,2.8,ivory,g,12,r2=1.2);cyl('Shoulders',(0,3.1,0),.85,.45,pale,g,12)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.5,location=vec((0,3.9,0)));finish(bpy.context.object,'Serene head',pale,g)
for side in [-1,1]:
 rod('Folded arm',(side*.72,3.1,0),(side*.35,2.7,.8),.2,ivory,g)
 box('Luminous eye',(side*.15,3.95,.46),(.13,.055,.035),light,g,.015)
for a in range(12):
 t=a*math.pi/6;rod('Halo ray',(math.sin(t)*.78,3.9+math.cos(t)*.78,-.2),(math.sin(t)*.98,3.9+math.cos(t)*.98,-.2),.03,gold,g)
ring('Guardian halo',(0,3.9,-.2),.78,.04,gold,g,True)
for k in range(10):
 a=k*math.pi/5;rod('Robe fold',(math.cos(a)*1.05,.5,math.sin(a)*1.05),(math.cos(a)*.58,3,math.sin(a)*.58),.028,gold,g)
os.makedirs(os.path.join(ROOT,'art/balance-temple'),exist_ok=True);os.makedirs(os.path.join(ROOT,'assets/models'),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art/balance-temple/balance-temple-v02.blend'))
# Batch siblings by material, preserving movable groups and named asset roots.
for parent in [o for o in bpy.data.objects if o.type=='EMPTY']:
 buckets={}
 for o in list(parent.children):
  if o.type=='MESH':buckets.setdefault(o.active_material.name,[]).append(o)
 for name,objects in buckets.items():
  if len(objects)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=parent.name+'_'+name
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'assets/models/balance-temple-v02.glb'),export_format='GLB',export_yup=True)
print('BALANCE TEMPLE EXPORTED')
