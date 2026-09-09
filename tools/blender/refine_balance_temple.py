import bpy,os,math
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/art/balance-temple/balance-temple-v02.blend')
from mathutils import Vector
mat=bpy.data.materials['Aged brass']
def g(name,parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o
root=g('twin_scale')
def rod(name,a,b,r):
 a=Vector((a[0],-a[2],a[1]));b=Vector((b[0],-b[2],b[1]));d=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(mat);o.parent=root
rod('Twin central pillar',(0,0,0),(0,2.7,0),.16);rod('Twin balance crossbar',(-3,2.7,0),(3,2.7,0),.09)
for side in [-1,1]:
 for a in [0,2.094,4.189]:rod('Twin suspension',(side*3,2.7,0),(side*3+math.cos(a)*1.1,.35,math.sin(a)*1.1),.022)
# Remove floor medallions extending outside narrow connector floor.
for name in ['hall_corridor','hall_entry']:
 for o in list(bpy.data.objects[name].children):
  if o.name.startswith('Floor medallion'):bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/art/balance-temple/balance-temple-v02.blend')
for parent in [o for o in bpy.data.objects if o.type=='EMPTY']:
 buckets={}
 for o in list(parent.children):
  if o.type=='MESH':buckets.setdefault(o.active_material.name,[]).append(o)
 for name,objs in buckets.items():
  if len(objs)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();bpy.context.object.name=parent.name+'_'+name
bpy.ops.export_scene.gltf(filepath=ROOT+'/assets/models/balance-temple-v02.glb',export_format='GLB',export_yup=True)
