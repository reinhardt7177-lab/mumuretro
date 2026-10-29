import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import ROOT,V
ART=ROOT/'art/panel-workshop/v01';before=json.loads((ROOT/'reports/2026-10-23/evidence/panel-workshop/before/report.json').read_text());D=before['device'];cz=(D['seg']['z0']+D['seg']['z1'])/2;sx,lz,wz=D['axisX'],D['lampZ'],D['wallZ'];spec=json.loads((ART/'design-spec.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
for asset in['moon-courts-v03','twin-shadow-v02','panel-workshop-v01']:bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/adventure'/(asset+'.glb')))
for name in['ShadeCourt','ShadeFloor','MirrorCourt','MirrorFloor']:
    p=bpy.data.objects[name]
    for o in[p,*p.children_recursive]:o.hide_render=True
for name in['PanelCourt','PanelFloor']:bpy.data.objects[name].location=V((0,0,cz))
bpy.data.objects['LampStand'].location=V((sx,0,lz));bpy.data.objects['LampWheel'].location=V((sx+1.35,1.05,lz+.35));housing=bpy.data.objects['LampHousing'];housing.location=V((sx-.75,2.8,lz));second=housing.copy();bpy.context.scene.collection.objects.link(second);second.location=V((sx+.75,2.8,lz))
for source in housing.children:
    o=source.copy();o.data=source.data.copy();bpy.context.scene.collection.objects.link(o);o.parent=second
railZ=(lz+wz)/2-.12;bpy.data.objects['RailBed'].location=V((sx,0,railZ));cart=bpy.data.objects['PanelCarriage'];arm=bpy.data.objects['Drawbar'];arm.scale.x=1.35;draw=arm.copy();bpy.context.scene.collection.objects.link(draw);draw.scale.x=.25;draw.rotation_euler.z=-math.pi/2
for source in arm.children:
    o=source.copy();o.data=source.data.copy();bpy.context.scene.collection.objects.link(o);o.parent=draw
bar=bpy.data.objects['PushBar'];plaque=bpy.data.objects['ObservationPlaque'];plaque.location=V((-5.5,0,cz+56/15));plaque.rotation_euler.z=.48;other=plaque.copy();bpy.context.scene.collection.objects.link(other);other.location=V((5.5,0,cz+56/15));other.rotation_euler.z=-.48
for source in plaque.children:
    o=source.copy();o.data=source.data.copy();bpy.context.scene.collection.objects.link(o);o.parent=other
def mat(name,color):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*color,1);return m
dark=mat('Reference optical mask',(.06,.09,.12));ivory=mat('Reference screen',(.76,.74,.64));brass=mat('Reference stem',(.56,.4,.16))
def box(name,pos,size,material):
    bpy.ops.mesh.primitive_cube_add(size=1,location=V(pos));o=bpy.context.object;o.name=name;o.scale=(size[0],size[2],size[1]);o.data.materials.append(material);return o
panel=box('Reference mask',(sx,2.8,lz-6.4),(.9,.9,.06),dark);stem=box('Reference optical stem',(sx,1.425,lz-6.43),(.09,1.85,.06),brass);box('Reference screen',(sx,2.8,wz-.1),(4.3,4.3,.18),ivory)
for side in[-1,1]:box('Reference screen support',(sx+side*1.8,.5,wz-.1),(.26,1,.42),ivory)
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Panel studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.055,.1,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
for pos,power in[((2,8,cz+3),1800),((-6,6,cz-3),1100)]:
    bpy.ops.object.light_add(type='AREA',location=V(pos));o=bpy.context.object;o.data.energy=power;o.data.size=7;o.rotation_euler=(V((-3,1,cz))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.view_settings.view_transform='AgX';scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=768;scene.render.resolution_y=540;scene.render.resolution_percentage=100
for shot in before['shots']:
    obj=shot['object'];cart.location=V((sx,0,obj-.12));arm.location=V((sx,.64,obj-.05));draw.location=V((sx+1.35,.64,obj-.05));bar.location=V((sx+1.35,.75,obj+(.135 if shot['place']=='panel' else .2)));panel.location=V((sx,2.8,obj-.03));stem.location=V((sx,1.425,obj-.03));cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
print('PASS6 fixed workshop goals;no character/UI/exact optical rendering')
