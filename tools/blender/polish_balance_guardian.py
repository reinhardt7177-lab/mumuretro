import bpy,os,math
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/art/balance-temple/balance-temple-v02.blend')
g=bpy.data.objects['guardian'];gold=bpy.data.materials['Aged brass'];pale=bpy.data.materials['Carved limestone'];dark=bpy.data.materials['Midnight teal']
def part(name,pos,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=(pos[0],-pos[2],pos[1]));o=bpy.context.object;o.name=name;o.scale=(scale[0],scale[2],scale[1]);o.data.materials.append(mat);o.parent=g
 for p in o.data.polygons:p.use_smooth=True
 return o
head=next(o for o in g.children if o.name.startswith('Serene head'))
for p in head.data.polygons:p.use_smooth=True
part('Carved nose',(0,3.82,.49),(.07,.12,.1),pale);part('Carved mouth',(0,3.67,.465),(.12,.02,.02),gold)
for side in [-1,1]:
 part('Palm',(side*.32,2.7,.86),(.18,.12,.2),pale)
 part('Golden shoulder',(side*.6,3.14,0),(.29,.18,.45),gold)
 part('Hood side',(side*.45,3.9,-.08),(.13,.6,.43),dark)
part('Hood crest',(0,4.38,-.1),(.5,.19,.42),dark)
# Raised layered robe panels.
for side in [-1,1]:
 for i in range(3):
  o=part('Mantle panel',(side*(.25+i*.19),1.8,.43),(.17,1.25,.15),pale if i%2 else gold);o.rotation_euler.y=side*.15
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
