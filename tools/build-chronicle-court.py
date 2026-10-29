"""Editable memory court around the unchanged web guardian and offering positions."""
import bpy,bmesh,math,json,ast,shutil,sys,hashlib
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import export_parts
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/chronicle-court/v01';ART.mkdir(parents=True,exist_ok=True)
BEFORE=json.loads((ROOT/'reports/2026-10-23/evidence/chronicle-court/before/report.json').read_text());C=BEFORE['contract'];S=C['seg'];V=lambda p:Vector((p[0],-p[2],p[1]))
palette={'stone':[.23,.23,.28],'pale':[.53,.49,.44],'recess':[.075,.075,.105],'brass':[.49,.34,.16],'floor':[.32,.31,.34]}
SPEC={'model':'assets/models/adventure/chronicle-court-v01.glb','palette':palette,'parts':{},'contract':C,'foundationBottom':-.2,'originalRuntimeExecuted':False,'budget':{'triangles':45000,'bytes':4000000}}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;M={};parts={};solids=[];images={}
for name in ['stone-albedo','stone-normal','floor-albedo','floor-normal']:
    shutil.copyfile(ROOT/'art/water-courts/v01'/f'{name}.png',ART/f'{name}.png');im=bpy.data.images.load(str(ART/f'{name}.png'));im.colorspace_settings.name='Non-Color' if name.endswith('normal') else 'sRGB';images[name]=im
for name,color in palette.items():
    m=bpy.data.materials.new('Chronicle court '+name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=.6 if name=='brass' else 0;bs.inputs['Roughness'].default_value=.4 if name=='brass' else .84
    if name!='brass':
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=images['floor-albedo' if name=='floor' else 'stone-albedo'];mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color']);normal=m.node_tree.nodes.new('ShaderNodeTexImage');normal.image=images['floor-normal' if name=='floor' else 'stone-normal'];nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.23;m.node_tree.links.new(normal.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    M[name]=m
shared=(ROOT/'tools/build-moon-courts.py').read_text(encoding='utf-8-sig');tree=ast.parse(shared);exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['group','finish','box','poly']],type_ignores=[]),'<shared masonry>','exec'))
arc_source=ast.get_source_segment(shared,next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='arc')).replace('r+.30','r+.50');exec(compile(arc_source,'<thicker supported memory arches>','exec'))
def begin(name):
    global solids
    solids=[];p=group(name);SPEC['parts'][name]={'solids':solids};return p
def cylinder(name,p,radius,height,key,parent,n=16,radius_top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=radius,radius2=radius if radius_top is None else radius_top,depth=height,location=V(p));return finish(bpy.context.object,name,key,parent)
def ring(name,x,z,r,y,width,key,parent,n=96):
    points=[(x+radius*math.cos(i*2*math.pi/n),y,z+radius*math.sin(i*2*math.pi/n)) for radius in [r-width/2,r+width/2] for i in range(n)]
    return poly(name,points,[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)],key,parent)
def pier(x,z,p,height=9.2):
    box('Grounded pier footing',[x,.15,z],[1.12,.30,1.12],'recess',p,.022,True)
    box('Layered pier plinth',[x,.38,z],[.99,.16,.99],'pale',p,.018,True)
    # Recessed mortar is continuous behind the18mm joints and overlaps the
    # plinth/capital. Existing outer collision courses already enclose it.
    box('Continuous pier mortar core',[x,(height+.44)/2,z],[.76,height-.44,.76],'recess',p,0)
    for row in range(7):box('Dressed pier course',[x,.46+(row+.5)*(height-.65)/7,z],[.80,(height-.65)/7-.018,.80],'stone',p,.014,True)
    for dx in [-.23,0,.23]:box('Carved vertical channel',[x+dx,height/2+.12,z+.404],[.022,height-1.0,.012],'recess',p,.002)
    box('Supported capital',[x,height-.02,z],[1.14,.26,1.14],'pale',p,.022,True)
    box('Restrained bronze abacus',[x,height+.13,z],[1.16,.035,1.16],'brass',p,.004)
    # An attached narrow plaque is decorative; no offering mark/answer colour.
    box('Recessed celestial plaque',[x,.62+height*.42,z+.412],[.44,2.1,.020],'recess',p,.006)
    for dx in [-.245,.245]:box('Inset plaque frame',[x+dx,.62+height*.42,z+.427],[.022,2.18,.022],'brass',p,.002)

p=begin('MemoryArcade')
for side in [-1,1]:
    x=side*9.3
    for z in [-5.6,1.1,7.8,14.5]:pier(x,z,p)
    for z in [-2.25,4.45,11.15]:arc('Segmented side arch',x,z,2.96,9.2,.8,p,True)
for x in [-7.8,7.8]:pier(x,-5.7,p)
arc('Great open memory arch',0,-5.7,7.23,9.2,.85,p)
for side in [-1,1]:
    # Rear corner sill closes the two structural rhythms; no roof is added.
    box('Rear corner tie',[side*8.55,8.93,-5.7],[1.6,.25,.82],'stone',p,.018)
SPEC['parts']['MemoryArcade'].update({'datum':0,'feet':[[side*9.3,0,z] for side in [-1,1] for z in [-5.6,1.1,7.8,14.5]]+[[x,0,-5.7] for x in [-7.8,7.8]]})
p=begin('MemoryFloor');width=S['x1']-S['x0']+1.2;length=S['z1']-S['z0']+.6
box('Embedded continuous foundation',[0,-.103,0],[width,.194,length],'recess',p,0)
nx,nz=12,14
for i in range(nx):
    for j in range(nz):box('Close jointed paving',[-width/2+(i+.5)*width/nx,-.003,-length/2+(j+.5)*length/nz],[width/nx-.018,.006,length/nz-.018],'floor' if (i+j)%7 else 'stone',p,.001)
cz=(S['z0']+S['z1'])/2;pattern_z=C['gz']+9-cz
for r in [1.8,5.4,5.65]:ring('Flush memory floor inlay',0,pattern_z,r,.002,.025,'brass',p)
for i in range(16):
    a=i*math.pi/8;pts=[(r*math.cos(t),.002,pattern_z+r*math.sin(t)) for r in [1.82,5.38] for t in [a-.002,a+.002]];poly('Flush radial inlay',pts,[(0,1,3,2)],'brass',p)
SPEC['parts']['MemoryFloor'].update({'datum':0,'width':width,'length':length,'foundationBottom':-.2,'inlayTop':.002,'jointDepth':.006})
p=begin('OfferingPedestal');cylinder('Grounded offering foot',[0,.10,0],1.05,.20,'recess',p)
cylinder('Sloping offering foot',[0,.28,0],1.00,.16,'pale',p,radius_top=.86)
cylinder('Carved offering drum',[0,.69,0],.86,.66,'stone',p)
cylinder('Supported offering capital',[0,1.09,0],1.00,.14,'pale',p)
cylinder('Inset offering top',[0,1.18,0],.94,.04,'recess',p)
for y in [.38,1.02]:cylinder('Narrow bronze offering belt',[0,y,0],.875,.025,'brass',p)
for i in range(12):
    a=i*math.pi/6;x,z=.852*math.sin(a),.852*math.cos(a);o=box('Attached drum flute',[x,.70,z],[.028,.46,.017],'recess',p,.002);o.rotation_euler.z=-a
SPEC['parts']['OfferingPedestal'].update({'datum':0,'radius':1.05,'top':1.2})

scene.world=bpy.data.worlds.new('Memory court studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.15,.19,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
for pos,energy,size in [((4,14,12),2800,9),((-10,10,-8),2000,10)]:
    bpy.ops.object.light_add(type='AREA',location=V(pos));light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(V((0,5,0))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1280;scene.render.resolution_y=900
originals=[o for p in parts.values() for o in p.children];metrics=export_parts(list(parts),SPEC,ART,'chronicle-court-v01','Chronicle court ');exports=[o for p in parts.values() for o in p.children if o not in originals]
assert sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))<45000 and metrics['glbBytes']<4000000
for o in exports:o.hide_render=True
for light in [o for o in scene.objects if o.type=='LIGHT']:
    light.location+=V([0,0,C['gz']]);light.rotation_euler=(V([0,5,C['gz']+3])-light.location).to_track_quat('-Z','Y').to_euler()
instances=[]
def instance(name,pos):
    root=bpy.data.objects.new('Goal '+name,None);scene.collection.objects.link(root);root.location=V(pos);instances.append(root)
    for obj in parts[name].children:
        if obj not in exports:continue
        child=obj.copy();child.data=obj.data;scene.collection.objects.link(child);child.parent=root;child.hide_render=False
instance('MemoryArcade',[0,0,C['gz']]);instance('MemoryFloor',[0,0,cz])
for altar in C['altars']:instance('OfferingPedestal',[altar['x'],0,altar['z']])
# Unchanged existing guardian is context, never added to the new web export.
before_context=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/chronicle-temple/guardian-v01.glb'));context=list(set(scene.objects)-before_context)
for obj in context:
    if obj.parent is None:obj.location+=V([0,0,C['gz']])
for shot in BEFORE['shots']:
    target=V(shot['target']);cam.location=V(shot['camera']);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
for root in instances:
    for child in list(root.children):bpy.data.objects.remove(child,do_unlink=True)
    bpy.data.objects.remove(root,do_unlink=True)
for obj in context:bpy.data.objects.remove(obj,do_unlink=True)
for obj in exports:bpy.data.objects.remove(obj,do_unlink=True)
for i,p in enumerate(parts.values()):
    p.location=V([i*28,0,0])
    for obj in p.children:obj.hide_set(False);obj.hide_render=False
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'chronicle-court-v01.blend'))
(ART/'goal-cameras.json').write_text(json.dumps({'pass':True,'sourceSha256':hashlib.sha256((ART/'chronicle-court-v01.blend').read_bytes()).hexdigest(),'modelSha256':hashlib.sha256((ROOT/SPEC['model']).read_bytes()).hexdigest(),'shots':BEFORE['shots'],'scope':'Builder goal renders,matched exported geometry/materials;hashes of final editable source and web model'},indent=2))
print('PASS CHRONICLE_COURT '+json.dumps(metrics),flush=True)
