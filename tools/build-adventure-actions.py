"""Bake original upper-body actions and palm sockets on the existing 24-bone skin.
The runtime GLB has no duplicate skin/texture. The editable studio retains the skin.
Blender Z-up studio, glTF Y-up web; source files are preserved.
"""
import bpy, json, math, numpy as np, sys, struct
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/adventure-actions/v01';OUT=ROOT/'assets/characters/sky-navigator'
SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf8'));ART.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/SPEC['source']))
scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE')
shapes={b.custom_shape for b in rig.pose.bones if b.custom_shape};meshes=[o for o in scene.objects if o.type=='MESH' and o not in shapes]
rig.animation_data_clear();rig.animation_data_create()
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box];lo=Vector([min(p[i] for p in corners) for i in range(3)]);hi=Vector([max(p[i] for p in corners) for i in range(3)])
holder=bpy.data.objects.new('Action studio · 1.5m ground root',None);scene.collection.objects.link(holder)
for o in list(scene.objects):
 if o!=holder and o.parent is None:o.parent=holder
factor=1.5/(hi.z-lo.z);holder.scale=(factor,)*3;holder.location=(-((lo.x+hi.x)/2)*factor,-((lo.y+hi.y)/2)*factor,-lo.z*factor)
bpy.context.view_layer.update()
def web(p):return Vector((p[0],-p[2],p[1]))
def head(name):return rig.matrix_world@rig.pose.bones[name].head
def world_q(name):return (rig.matrix_world@rig.pose.bones[name].matrix).to_quaternion()
def set_world_q(name,q):
 b=rig.pose.bones[name];m=rig.matrix_world@b.matrix
 b.matrix=rig.matrix_world.inverted()@Matrix.LocRotScale(m.translation,q,m.to_scale());bpy.context.view_layer.update()
def aim(name,child,target):
 direction=(head(child)-head(name)).normalized();wanted=(target-head(name)).normalized()
 set_world_q(name,direction.rotation_difference(wanted)@world_q(name))

# Skin-derived contact frame: +Y is palm normal, +Z follows fingers in glTF.
palms={};metrics={'source':SPEC['source'],'bones':len(rig.pose.bones),'newSkinWeights':False,'sockets':{},'poses':[]}
for side in ['Left','Right']:
 name=side+'Hand';points=[]
 for mesh in meshes:
  vg=mesh.vertex_groups.get(name)
  if vg:
   for v in mesh.data.vertices:
    if any(g.group==vg.index and g.weight>.55 for g in v.groups):points.append(mesh.matrix_world@v.co)
 if len(points)<8:raise RuntimeError('Insufficient actual palm vertices '+side)
 centre=sum(points,Vector())/len(points);coords=np.array([p[:] for p in points]);values,vectors=np.linalg.eigh(np.cov(coords.T));normal=Vector(vectors[:,0]);finger=(centre-head(name)).normalized();finger-=normal*finger.dot(normal);finger.normalize()
 if normal.z<0:normal.negate()
 # Contact lies on the pad, not at the wrist or inside the glove.
 contact=centre+normal*.010
 right=normal.cross(finger).normalized();basis=Matrix((right,normal,finger)).transposed()
 empty=bpy.data.objects.new('Grip'+side,None);scene.collection.objects.link(empty);empty.empty_display_type='ARROWS';empty.empty_display_size=.055
 empty.parent=rig;empty.parent_type='BONE';empty.parent_bone=name
 bpy.context.view_layer.update()
 empty.matrix_world=Matrix.LocRotScale(contact,basis.to_quaternion(),Vector((1,1,1)))
 bpy.context.view_layer.update()
 local=(rig.matrix_world@rig.pose.bones[name].matrix).inverted()@contact
 palm={'offset':local,'normal':normal,'finger':finger,'frame':basis.to_quaternion(),'object':empty}
 palms[side]=palm;metrics['sockets'][side]={'weightedVertices':len(points),'worldContact':list(contact),'boneLocalContact':list(local),'normal':list(normal),'finger':list(finger)}

rest={b.name:b.matrix_basis.copy() for b in rig.pose.bones}
def reset():
 for b in rig.pose.bones:b.matrix_basis=rest[b.name].copy()
 bpy.context.view_layer.update()
def reach(side,palm_target,orientation_weight=1):
 palm=palms[side];target_frame=Matrix((Vector((1,0,0)),Vector((0,0,1)),Vector((0,-1,0)))).transposed().to_quaternion()
 # Both palms up, fingers toward the character's front (Blender -Y).
 local_frame=world_q(side+'Hand').inverted()@palm['frame']
 desired_hand=world_q(side+'Hand').slerp(target_frame@local_frame.inverted(),orientation_weight)
 world_scale=(rig.matrix_world@rig.pose.bones[side+'Hand'].matrix).to_scale()
 scaled_offset=Vector(tuple(palm['offset'][i]*world_scale[i] for i in range(3)))
 wrist=palm_target-desired_hand@scaled_offset
 a,b,c=head(side+'Arm'),head(side+'ForeArm'),head(side+'Hand');l1=(b-a).length;l2=(c-b).length
 axis=wrist-a;requested=axis.length;d=max(abs(l1-l2)+.001,min(l1+l2-.001,requested));axis.normalize()
 bend=Vector((1 if side=='Left' else -1,.7,-.2));bend-=axis*bend.dot(axis);bend.normalize()
 along=(l1*l1-l2*l2+d*d)/(2*d);elbow=a+axis*along+bend*math.sqrt(max(0,l1*l1-along*along))
 aim(side+'Arm',side+'ForeArm',elbow);aim(side+'ForeArm',side+'Hand',wrist);set_world_q(side+'Hand',desired_hand)
 reached=(rig.matrix_world@rig.pose.bones[side+'Hand'].matrix)@palm['offset']
 return {'side':side,'target':list(palm_target),'reached':list(reached),'error':(reached-palm_target).length,'requestedWristDistance':requested,'armLength':l1+l2}

upper=['Spine','Spine01','Spine02','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand']
actions={}
for name in ['referenceRest','carryOverhead','carryCradle','useRightHandle','useLeftHandle']:
 action=bpy.data.actions.new(name);actions[name]=action;samples=[]
 frames=[0,1] if name=='referenceRest' else list(range(0,37,3)) if name.startswith('carry') else [0,3,6,10,14,18,20]
 for frame in frames:
  rig.animation_data.action=None
  reset();phase=frame/36*math.pi*2
  pose_metrics=[]
  if name.startswith('carry'):
   p=SPEC['profiles']['overhead' if name=='carryOverhead' else 'cradle']
   if name=='carryOverhead':
    for side in ['Left','Right']:aim(side+'Shoulder',side+'Arm',head(side+'Arm')+Vector((0,0,.035)))
   for side,sign in [('Left',1),('Right',-1)]:pose_metrics.append(reach(side,web((sign*p['palmX'],p['palmHeight']+math.sin(phase)*.003,p['palmZ']))))
  elif name.startswith('use'):
   side='Right' if name=='useRightHandle' else 'Left';sign=-1 if side=='Right' else 1
   amount=math.sin(math.pi*min(1,frame/20))**.7
   start=(rig.matrix_world@rig.pose.bones[side+'Hand'].matrix)@palms[side]['offset'];target=start.lerp(web((sign*.22,1.02,.44)),amount)
   pose_metrics.append(reach(side,target,amount))
  samples.append((frame,{bn:rig.pose.bones[bn].rotation_quaternion.copy() for bn in upper}))
  if frame in [0,18]:metrics['poses'].append({'name':name,'frame':frame,'hands':pose_metrics})
 rig.animation_data.action=action
 for frame,pose in samples:
  scene.frame_set(frame)
  for bn,q in pose.items():rig.pose.bones[bn].rotation_quaternion=q
  for bn in upper:rig.pose.bones[bn].keyframe_insert(data_path='rotation_quaternion',frame=frame,group=bn)
 scene.frame_start=0;scene.frame_end=frames[-1]
 if name=='referenceRest':scene.frame_end=1
 rig.animation_data.action=None

# Export only rig + skin-derived sockets; the character studio is not re-downloaded.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);holder.select_set(True)
for p in palms.values():p['object'].select_set(True)
scene.render.fps=30
rig.animation_data.action=actions['referenceRest'];scene.frame_set(0);bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(OUT/'actions-v01.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_def_bones=False)
# Bone-child interchange frames are made explicit in the exported joint basis.
# Local +Y means measured palm normal, +Z means fingers, in both native and web.
packed=(OUT/'actions-v01.glb').read_bytes();json_len=struct.unpack_from('<I',packed,12)[0];gltf=json.loads(packed[20:20+json_len]);parents={child:i for i,n in enumerate(gltf['nodes']) for child in n.get('children',[])};worlds={}
def node_world(index):
 if index in worlds:return worlds[index]
 n=gltf['nodes'][index]
 if 'matrix' in n:local=Matrix([[n['matrix'][c*4+r] for c in range(4)] for r in range(4)])
 else:
  q=n.get('rotation',[0,0,0,1]);local=Matrix.LocRotScale(Vector(n.get('translation',[0,0,0])),Quaternion((q[3],q[0],q[1],q[2])),Vector(n.get('scale',[1,1,1])))
 worlds[index]=(node_world(parents[index])@local) if index in parents else local;return worlds[index]
conversion=Quaternion((1,0,0),-math.pi/2)
for side,palm in palms.items():
 index=next(i for i,n in enumerate(gltf['nodes']) if n.get('name')=='Grip'+side);parent=node_world(parents[index]);contact=conversion@Vector(metrics['sockets'][side]['worldContact']);local=parent.inverted()@contact;q=parent.to_quaternion().inverted()@(conversion@palm['frame']);node=gltf['nodes'][index];node.pop('matrix',None);node['translation']=list(local);node['rotation']=[q.x,q.y,q.z,q.w];node['scale']=[1,1,1]
text=json.dumps(gltf,separators=(',',':')).encode('utf8');text+=b' '*((-len(text))%4);tail=packed[20+json_len:];(OUT/'actions-v01.glb').write_bytes(struct.pack('<4sII',b'glTF',2,20+len(text)+len(tail))+struct.pack('<II',len(text),0x4E4F534A)+text+tail)

# Original proxy props explain the intended action; they are not new game models.
def material(name,c):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=m.diffuse_color;return m
wood=material('Action proxy wood',SPEC['materialPalette']['wood']);brass=material('Action proxy brass',SPEC['materialPalette']['brass'])
proxies={}
for name,pos,size in [('overhead',(0,-.27,2.0),(.95,.95,.92)),('cradle',(0,-.62,1.21),(.75,.62,.5))]:
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name='Design proxy '+name;o.scale=size;o.data.materials.append(wood);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);mod=o.modifiers.new('Rounded proxy corners','BEVEL');mod.width=.04;mod.segments=2;proxies[name]=o;o.hide_render=True
for side,x in [('Right',-.22),('Left',.22)]:
 bpy.ops.mesh.primitive_torus_add(major_radius=.16,minor_radius=.025,major_segments=24,minor_segments=6,location=(x,-.44,1.02),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name='Design wheel '+side;o.data.materials.append(brass);proxies[side]=o;o.hide_render=True
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=SPEC['referenceCamera']['width'];scene.render.resolution_y=SPEC['referenceCamera']['height'];scene.render.resolution_percentage=100;scene.world.color=(.23,.29,.33)
for pos,power,colour in [((3,-4,5),500,(1,.9,.75)),((-3,-1,3),350,(.7,.82,1))]:
 bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=power;light.data.size=4;light.data.color=colour;light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=30);floor=bpy.context.object;floor.name='Design floor y0';floor.data.materials.append(material('Studio floor',(.10,.15,.18)));floor.location.z=-.005
bpy.ops.object.camera_add();camera=bpy.context.object;camera.name='Matched web design camera';scene.camera=camera;camera.data.type='PERSP';camera.data.lens_unit='FOV';camera.data.sensor_fit='VERTICAL';camera.data.angle=math.radians(SPEC['referenceCamera']['verticalFovDegrees'])
distance=SPEC['referenceCamera']['distance'];pitch=SPEC['referenceCamera']['pitchRadians'];height=SPEC['referenceCamera']['lookHeight'];xy=distance*math.cos(pitch);z=height+distance*math.sin(pitch)
render_names=[] if '--skip-render' in sys.argv else ['carryOverhead','carryCradle','useRightHandle']
if '--render-pose' in sys.argv: render_names=[sys.argv[sys.argv.index('--render-pose')+1]]
for name in render_names:
 rig.animation_data.action=actions[name];scene.frame_set(9);bpy.context.view_layer.update()
 key='overhead' if name=='carryOverhead' else 'cradle' if name=='carryCradle' else 'Right';proxies[key].hide_render=False
 for view,p in [('rear',(0,xy,z)),('side',(-xy,0,z)),('front',(0,-xy,z))]:
  camera.location=p;camera.rotation_euler=(Vector((0,0,height))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ART/(name+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
 proxies[key].hide_render=True
rig.animation_data.action=actions['carryOverhead'];scene.frame_set(0);proxies['overhead'].hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'navigator-actions-v01.blend'))
metrics['glbBytes']=(OUT/'actions-v01.glb').stat().st_size
(ART/'model-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8');(OUT/'action-contract-v01.json').write_text(json.dumps(SPEC,indent=2),encoding='utf8')
assert metrics['glbBytes']<SPEC['budget']['glbBytesMax']
assert max(p['error'] for pose in metrics['poses'] for p in pose['hands'])<SPEC['budget']['surfaceGripErrorMetres']
print('ACTION_RESULT '+json.dumps(metrics))
