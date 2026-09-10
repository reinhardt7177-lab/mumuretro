"""Import actual generated skin, inspect its binding, save editable source and renders."""
import bpy,os,json,math,struct
from mathutils import Vector
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));out=os.path.join(root,'art/sky-navigator');source=os.path.join(out,'source')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
path=os.path.join(source,'navigator-rigged-v01.glb')
with open(path,'rb') as f:data=f.read()
length=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+length]);image_view=gltf['bufferViews'][gltf['images'][0]['bufferView']];start=28+length+image_view.get('byteOffset',0)
with open(os.path.join(source,'rig-texture-check.png'),'wb') as f:f.write(data[start:start+image_view['byteLength']])
bpy.ops.import_scene.gltf(filepath=path)
objects=list(bpy.context.scene.objects);rigs=[o for o in objects if o.type=='ARMATURE'];shapes={b.custom_shape for r in rigs for b in r.pose.bones if b.custom_shape};meshes=[o for o in objects if o.type=='MESH' and o not in shapes]
if not meshes or not rigs:raise RuntimeError('Expected actual mesh and armature from Meshy.')
corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
lo=Vector(tuple(min(p[i] for p in corners) for i in range(3)));hi=Vector(tuple(max(p[i] for p in corners) for i in range(3)));height=hi.z-lo.z
holder=bpy.data.objects.new('Navigator scale root',None);bpy.context.collection.objects.link(holder)
for o in objects:
 if o.parent is None:o.parent=holder
holder.scale=(1.5/height,)*3;holder.location=(-((lo.x+hi.x)/2)*1.5/height,-((lo.y+hi.y)/2)*1.5/height,-lo.z*1.5/height)
for m in meshes:
 for p in m.data.polygons:p.use_smooth=True
 # Explicitly bind the embedded PNG extracted for interchange verification.
 texture=bpy.data.images.load(os.path.join(source,'rig-texture-check.png'),check_existing=True);texture.pack()
 for mat in m.data.materials:
  if not mat or not mat.use_nodes:continue
  for node in mat.node_tree.nodes:
   if node.type=='TEX_IMAGE':node.image=texture
   if node.type=='BSDF_PRINCIPLED':
    node.inputs['Emission Strength'].default_value=0
    node.inputs['Metallic'].default_value=.05;node.inputs['Roughness'].default_value=.72
report={'source':'Meshy rigged output','mesh_count':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),'armatures':len(rigs),'bones':[b.name for b in rigs[0].data.bones],'vertex_groups':{m.name:len(m.vertex_groups) for m in meshes},'unweighted_vertices':sum(sum(not any(g.weight>0 for g in v.groups) for v in m.data.vertices) for m in meshes),'height_before':height,'normalized_height':1.5,'actions':[a.name for a in bpy.data.actions],'game_integrated':False}
with open(os.path.join(out,'model-review.json'),'w',encoding='utf8') as f:json.dump(report,f,indent=2)
for im in bpy.data.images:
 if im.source=='FILE':
  try:im.pack()
  except:pass
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=768;scene.render.resolution_y=1024;scene.render.resolution_percentage=100
scene.world.color=(.18,.18,.18)
def area(name,pos,power,size,color):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
area('Warm key',(2,-3,4),350,4,(1,.89,.74));area('Soft fill',(-3,-1,2),230,3,(.77,.86,1));area('Rim',(1,3,3),400,3,(.7,.85,1))
bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='Studio floor';ground.location.z=-.01
mat=bpy.data.materials.new('Studio slate');mat.diffuse_color=(.095,.13,.16,1);ground.data.materials.append(mat)
camdata=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',camdata);bpy.context.collection.objects.link(cam);scene.camera=cam;camdata.type='ORTHO';camdata.ortho_scale=1.95
cam.location=(.9,-3,1.05);cam.rotation_euler=(Vector((0,0,.76))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'sky-navigator-rigged-v01.blend'))
for name,pos in [('front',(0,-3,.95)),('rear',(0,3,.95))]:
 cam.location=pos;cam.rotation_euler=(Vector((0,0,.76))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=os.path.join(out,'render-'+name+'-v01.png');bpy.ops.render.render(write_still=True)
print(json.dumps(report))
