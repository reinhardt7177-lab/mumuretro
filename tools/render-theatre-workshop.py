"""Six fixed-camera architectural goals. Proxies omit hero/UI/game optical rendering."""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import ROOT,V
ART=ROOT/'art/theatre-readability/v01';before=json.loads((ROOT/'reports/2026-10-23/evidence/theatre-readability/before/report.json').read_text());D=before['device'];spec=json.loads((ROOT/'art/twin-shadow/v02/design-spec.json').read_text());cz=(D['seg']['z0']+D['seg']['z1'])/2;sx,lz,wz=D['axisX'],D['lampZ'],D['wallZ']
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/adventure/moon-courts-v03.glb'))
for name in['ShadeCourt','ShadeFloor','MirrorCourt','MirrorFloor']:
    parent=bpy.data.objects[name]
    for o in[parent,*parent.children_recursive]:o.hide_render=True
for name in['PanelCourt','PanelFloor']:bpy.data.objects[name].location=V((0,0,cz))
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/adventure/twin-shadow-v02.glb'))
bpy.data.objects['LampStand'].location=V((sx,0,lz));bpy.data.objects['LampWheel'].location=V((sx+1.35,1.05,lz+.35))
near=next(z for z in D['answers'] if 2.8-1e-7<=lz-z<=3.8+1e-7);index=(math.floor((lz-near)*1000+.5)%3+1)%3;span=spec['spreads'][index]
housing=bpy.data.objects['LampHousing'];housing.location=V((sx-span,2.8,lz));second=housing.copy();bpy.context.scene.collection.objects.link(second);second.location=V((sx+span,2.8,lz))
for source in housing.children:
    o=source.copy();o.data=source.data.copy();bpy.context.scene.collection.objects.link(o);o.parent=second
def mat(name,color,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.7
    if emission:bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
    return m
stone=mat('Proxy screen stone',(.55,.55,.49));screenMat=mat('Proxy screen ivory',(.78,.76,.66));dark=mat('Proxy panel',(.07,.10,.13));gold=mat('Target contour',(.95,.63,.16),1.8)
def box(name,point,size,material):
    bpy.ops.mesh.primitive_cube_add(size=1,location=V(point));o=bpy.context.object;o.name=name;o.scale=(size[0],size[2],size[1]);o.data.materials.append(material);return o
box('Reference screen',(sx,2.8,wz-.10),(4.3,4.3,.18),screenMat)
for side in[-1,1]:box('Reference screen foot',(sx+side*1.8,.5,wz-.1),(.26,1,.42),stone)
panel=box('Reference panel',(sx,2.8,lz-6.4),(.9,.9,.06),dark);stem=box('Reference panel stem',(sx,1.425,lz-6.43),(.09,1.85,.06),stone);cart=box('Reference carriage',(sx,.25,lz-6.52),(.88,.50,.65),dark)
for side in[-1,1]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.175,location=V((sx+side*span,2.8,lz)));bpy.context.object.data.materials.append(gold)
    bpy.ops.object.light_add(type='POINT',location=V((sx+side*span,2.8,lz)));bpy.context.object.data.energy=160;bpy.context.object.data.shadow_soft_size=.025
mid=next(z for z in D['answers'] if 5.6-1e-7<=lz-z<=7+1e-7);factor=(lz-wz)/(lz-mid);size=.9*factor;targetOffset=spec['spreads'][(index+2)%3]*(factor-1)
for side in[-1,1]:
    center=sx+side*targetOffset
    for edge in[-1,1]:box('Reference target horizontal',(center,2.8+edge*size/2,wz+.018),(size+.04,.04,.008),gold);box('Reference target vertical',(center+edge*size/2,2.8,wz+.018),(.04,size,.008),gold)
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Workshop studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.055,.10,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
for pos,power in[((3,9,cz+5),1800),((-6,7,cz-4),1200)]:
    bpy.ops.object.light_add(type='AREA',location=V(pos));o=bpy.context.object;o.data.energy=power;o.data.size=8;o.rotation_euler=(V((-2,1.5,cz))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.view_settings.view_transform='AgX';scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=768;scene.render.resolution_y=540;scene.render.resolution_percentage=100
for shot in before['shots']:
    cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
print('PASS6 fixed-camera native architecture/crank goals')
