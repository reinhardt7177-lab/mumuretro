"""Real Blender turnaround evidence, never a substitute for Unity validation."""
import bpy,os,math,json
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
ART=os.path.join(ROOT,'art/water-sanctuary/v03')
bpy.ops.wm.open_mainfile(filepath=os.path.join(ART,'water-deity-v03.blend'))
images={n.image for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image}
if any(min(i.size)<=0 or not i.packed_file for i in images):raise ValueError('Review requires valid embedded model textures')
with open(os.path.join(ART,'texture-check.json'),'w') as f:json.dump([dict(name=i.name,width=i.size[0],height=i.size[1],packed=bool(i.packed_file)) for i in images],f,indent=2)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True
scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('Deity studio world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.18,.21,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
def light(name,p,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=p;o.rotation_euler=(Vector((0,0,1.8))-o.location).to_track_quat('-Z','Y').to_euler()
light('Warm key',(-3,4,5),700,4,(1,.88,.73));light('Cool fill',(3,2,3),400,3,(.75,.88,1));light('Rim',(-1,-3,4),850,3,(.75,.87,1))
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Review floor';floor.location.z=-.008
mat=bpy.data.materials.new('Review slate');mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.075,.095,.12,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;floor.data.materials.append(mat)
data=bpy.data.cameras.new('Review camera');camera=bpy.data.objects.new('Review camera',data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=4.1
for name,position in [('front',(0,6,1.9)),('three-quarter',(4,6,2.3)),('side',(6,0,1.9)),('back',(0,-6,1.9))]:
    camera.location=position;camera.rotation_euler=(Vector((0,0,1.65))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=os.path.join(ART,'render-'+name+'.png');bpy.ops.render.render(write_still=True)
