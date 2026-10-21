"""Render the authored Blender leaves without modifying the source .blend."""
import bpy, os
from mathutils import Vector
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.wm.open_mainfile(filepath=os.path.join(root,'art/meadow-leaves/meadow-leaves-v01.blend'))
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE_NEXT'
scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Meadow inspection world')
scene.world.color=(.18,.18,.18)
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
bpy.ops.object.camera_add(location=(.65,-2.8,1.4))
camera=bpy.context.object;camera.name='Leaf inspection camera';camera.data.type='ORTHO';camera.data.ortho_scale=1.75
camera.rotation_euler=(Vector((0,.14,.44))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
for location,power,size in [((-2,-3,4),500,4),((2,1,2),250,3)]:
    bpy.ops.object.light_add(type='AREA',location=location)
    light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(Vector((0,0,.4))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02))
floor=bpy.context.object
mat=bpy.data.materials.new('Studio grey');mat.diffuse_color=(.14,.17,.16,1);floor.data.materials.append(mat)
scene.render.filepath=os.path.join(root,'art/meadow-leaves/blender-preview.png')
bpy.ops.render.render(write_still=True)
