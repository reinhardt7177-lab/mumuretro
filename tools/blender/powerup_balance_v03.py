import bpy,math,os,json
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/art/balance-temple/balance-temple-v02.blend')
# Reuse construction helpers only; do not run the original destructive build.
src=open(ROOT+'/tools/blender/build_balance_temple.py',encoding='utf8').read()
exec(src[src.index('def vec'):src.index('def chamber')])
door=bpy.data.objects['door_leaf'];plinth=bpy.data.objects['plinth']
for side in [-1,1]:
 for x in [-1.05,1.05]:box('V03 gilded jamb',(x,2.5,side*.23),(.09,4.65,.07),gold,door,.02)
 for y in [.23,4.77]:box('V03 lintel',(0,y,side*.23),(2.12,.09,.07),gold,door,.02)
 for y in [1.25,3.65]:
  box('V03 recessed panel',(0,y,side*.225),(1.62,1.55,.065),dark,door,.07)
  ring('V03 celestial seal',(0,y,side*.29),.52,.027,gold,door,True)
  for angle in range(0,360,60):
   a=math.radians(angle);rod('V03 seal ray',(.30*math.sin(a),y+.30*math.cos(a),side*.3),(.44*math.sin(a),y+.44*math.cos(a),side*.3),.022,gold,door)
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.19,location=vec((0,y,side*.32)));finish(bpy.context.object,'V03 turquoise gem',light,door)
 for x in [-1.05,1.05]:
  for y in [.35,2.5,4.65]:
   bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.065,location=vec((x,y,side*.28)));finish(bpy.context.object,'V03 rivet',gold,door)
for y,r in [(.10,.85),(.29,.80)]:ring('V03 plinth fillet',(0,y,0),r,.025,gold,plinth)
for i in range(8):
 a=i*math.pi/4
 rod('V03 pedestal inlay',(.82*math.cos(a),.12,.82*math.sin(a)),(.77*math.cos(a),.29,.77*math.sin(a)),.022,light,plinth)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/art/balance-temple/balance-temple-v03.blend')
for parent in [o for o in bpy.data.objects if o.type=='EMPTY']:
 buckets={}
 for o in list(parent.children):
  if o.type=='MESH':buckets.setdefault(o.active_material.name,[]).append(o)
 for name,objects in buckets.items():
  if len(objects)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=parent.name+'_'+name
bpy.ops.export_scene.gltf(filepath=ROOT+'/assets/models/balance-temple-v03.glb',export_format='GLB',export_yup=True)
print('V03 BUILD COMPLETE')
