"""Native selection pedestals/status stand and six pre-implementation composition goals."""
import bpy, math, json, shutil, struct, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
ART=ROOT/'art/balance-onboarding/v01'; OUT=ROOT/'assets/models/adventure'
SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf8'))
before=json.loads((ROOT/'reports/2026-10-22/evidence/balance-onboarding/before/report.json').read_text(encoding='utf8'))
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
V=lambda p:Vector((p[0],-p[2],p[1]))
images={}
for name in ['stone-albedo','stone-normal']:
    shutil.copyfile(ROOT/'art/balance-mechanisms/v01'/f'{name}.png',ART/f'{name}.png')
    images[name]=bpy.data.images.load(str(ART/f'{name}.png'))
images['stone-normal'].colorspace_settings.name='Non-Color'
mats={}
for name,color in SPEC['palette'].items():
    m=bpy.data.materials.new('Onboarding '+name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=.65 if name=='brass' else 0;p.inputs['Roughness'].default_value=.35 if name=='brass' else .74
    if name!='brass':
        texture=m.node_tree.nodes.new('ShaderNodeTexImage');texture.image=images['stone-albedo'];mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1);m.node_tree.links.new(texture.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],p.inputs['Base Color'])
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=images['stone-normal'];normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.22;m.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],p.inputs['Normal'])
    mats[name]=m

def group(name,parent=None,pos=(0,0,0)):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=V(pos);return o
def box(name,pos,size,key,parent,bevel=.018):
    bpy.ops.mesh.primitive_cube_add(size=1,location=V(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Carved edges','BEVEL');b.width=bevel;b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name)
    o.name=name;o.parent=parent;o.data.materials.append(mats[key]);return o
def ring(name,pos,r,thick,key,parent):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=thick,major_segments=32,minor_segments=8,location=V(pos));o=bpy.context.object;o.name=name;o.parent=parent;o.data.materials.append(mats[key]);return o

parts={}
p=group('ChoicePedestal');parts[p.name]=p
box('Grounded stone foot',(0,.08,0),(.92,.16,.64),'stone',p,.025)
box('Incised lower band',(0,.18,0),(.8,.06,.55),'brass',p,.012)
box('Carved body',(0,.53,0),(.70,.64,.48),'stone',p,.03)
box('Recessed front frame',(0,.66,.309),(.64,.64,.05),'brass',p,.015)
box('Inset dark number face',(0,.66,.337),(.54,.54,.006),'teal',p,.005)
group('ChoiceLabel',p,SPEC['choice']['label'])
box('Stepped top',(0,.91,0),(.84,.10,.60),'stone',p,.025)
ring('ChoiceIndicator',(0,1.0,0),.27,.02,'teal',p)
for x in [-.29,.29]:
    box('Body brass incision',(x,.5,.248),(.024,.47,.014),'brass',p,.004)
    for y in [.40,.84]:box('Frame rivet',(x,y,.341),(.035,.035,.012),'brass',p,.005)
p=group('StatusStand');parts[p.name]=p
box('Grounded status foot',(0,.08,0),(2,.16,.7),'stone',p,.03)
for x in [-.76,.76]:
    box('Short fluted leg',(x,.60,0),(.22,.88,.38),'stone',p,.02)
    box('Leg brass channel',(x,.6,.202),(.035,.72,.018),'brass',p,.004)
box('Status back',(0,1.37,.28),(2,.70,.10),'stone',p,.03)
box('Status border',(0,1.37,.34),(1.92,.60,.035),'brass',p,.01)
box('Inset status face',(0,1.37,.363),(1.84,.52,.006),'teal',p,.004)
group('StatusLabel',p,SPEC['status']['label'])
for x in [-.94,.94]:
    for y in [1.08,1.66]:box('Corner inset',(x,y,.364),(.065,.065,.012),'teal',p,.006)
# Merge static materials while keeping label anchors/selection indicator independent.
for p in parts.values():
    for key in mats:
        objects=[o for o in p.children if o.type=='MESH' and o.name!='ChoiceIndicator' and o.active_material==mats[key]]
        if not objects:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=p.name+' '+key
bpy.context.view_layer.update();metrics={}
for name,p in parts.items():
    objects=[o for o in p.children_recursive if o.type=='MESH'];points=[];tris=0
    for o in objects:
        o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles);points.extend(o.matrix_world@v.co for v in o.data.vertices)
    metrics[name]={'meshes':len(objects),'triangles':tris,'webMin':[min(v.x for v in points),min(v.z for v in points),-max(v.y for v in points)],'webMax':[max(v.x for v in points),max(v.z for v in points),-min(v.y for v in points)]}
assert sum(v['triangles'] for v in metrics.values())<=SPEC['budgets']['trianglesMax']
bpy.ops.object.select_all(action='DESELECT')
for p in parts.values():
    p.select_set(True)
    for o in p.children_recursive:o.select_set(True)
glb=OUT/'balance-onboarding-v01.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
raw=glb.read_bytes();length=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+length]);tail=raw[20+length:]
for m in j['materials']:
    key=m['name'].replace('Onboarding ','');m.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=[*SPEC['palette'][key],1]
encoded=json.dumps(j,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
glb.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
assert glb.stat().st_size<=SPEC['budgets']['glbBytesMax']
metrics['glbBytes']=glb.stat().st_size;metrics['textures']=[{'name':k,'width':512,'height':512} for k in images]
(ART/'model-metrics.json').write_text(json.dumps(metrics,indent=2))
(ART/'material-export.json').write_text(json.dumps({'pass':True,'geometryAndImageChunkUnchanged':True,'binaryChunkSha256':hashlib.sha256(tail).hexdigest(),'materials':j['materials']},indent=2))
(OUT/'balance-onboarding-v01.json').write_text(json.dumps(SPEC,separators=(',',':')))
scene.view_settings.view_transform='AgX';scene.world=bpy.data.worlds.new('Onboarding studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.19,.22,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
for pos,power,size in [((2,-4,7),1700,6),((-4,2,4),900,5)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=768;scene.render.resolution_y=540;scene.render.resolution_percentage=100
for name,p in parts.items():
    for root in parts.values():
        for o in root.children_recursive:o.hide_render=root!=p
    for view,a in [('front',0),('side',math.pi/2),('rear',math.pi)]:
        target=Vector((0,0,.82));cam.location=target+Vector((math.sin(a)*3.4,-math.cos(a)*3.4,1.2));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(48);scene.render.filepath=str(ART/f'{name}-{view}.png');bpy.ops.render.render(write_still=True)
for name,p in parts.items():
    for o in p.children_recursive:o.hide_set(name!='ChoicePedestal');o.hide_render=name!='ChoicePedestal'
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'balance-onboarding-v01.blend'))
# Build composition goals only after the editable source/export were saved.
for p in parts.values():
    for o in p.children_recursive:o.hide_set(False);o.hide_render=True
def tree_copy(a,parent=None):
    c=a.copy();scene.collection.objects.link(c);c.parent=parent;c.hide_render=False
    for child in a.children:tree_copy(child,c)
    return c
old=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/balance-temple-v04.glb'));imported=[o for o in bpy.data.objects if o not in old]
for o in imported:o.hide_render=True
layout=json.loads((ROOT/'reports/2026-10-22/evidence/balance-mechanisms/before/report.json').read_text())['layout']['rooms']
names={'r1':'hall_order','r2':'hall_twin','shrine':'hall_lever','entry':'hall_entry','c1':'hall_corridor','c2':'hall_corridor'}
for s in layout:
    if s['id'] in names:c=tree_copy(bpy.data.objects[names[s['id']]]);c.location=V((0,0,(s['z0']+s['z1'])/2))
old=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/adventure/balance-mechanisms-v01.glb'))
for o in bpy.data.objects:
    if o not in old:o.hide_render=True
scale=tree_copy(bpy.data.objects['OrderScale']);scale.location=V((0,0,-3))
font=bpy.data.fonts.load('C:/Windows/Fonts/malgun.ttf');fontmat=bpy.data.materials.new('Goal text');fontmat.diffuse_color=(.95,.91,.76,1)
def text(body,pos,size,parent):
    bpy.ops.object.text_add(location=V(pos));t=bpy.context.object;t.parent=parent;t.rotation_euler=(math.pi/2,0,0);t.data.body=body;t.data.font=font;t.data.size=size;t.data.align_x='CENTER';t.data.align_y='CENTER';t.data.materials.append(fontmat)
for i,x in enumerate(SPEC['choice']['centres']):
    c=tree_copy(parts['ChoicePedestal']);c.location=V((x,0,SPEC['choice']['z']));text(str(i+3)+'개',SPEC['choice']['label'],.26,c)
c=tree_copy(parts['StatusStand']);c.location=V(SPEC['status']['position']);text('3개 도전 · 0/3 배치\n왼쪽부터 가벼운 순서',SPEC['status']['label'],.125,c)
for shot in before['shots']:
    cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
print('BALANCE_ONBOARDING '+json.dumps(metrics))
