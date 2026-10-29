"""Current-web water apparatus; same physical water/lift endpoints, editable source."""
import bpy,bmesh,math,json,ast,sys,shutil,struct
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import export_parts
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/water-devices/v01';ART.mkdir(parents=True,exist_ok=True);BEFORE=json.loads((ROOT/'reports/2026-10-23/evidence/water-devices/before/report.json').read_text());C=BEFORE['contract'];V=lambda p:Vector((p[0],-p[2],p[1]))
palette={'stone':[.27,.34,.36],'pale':[.56,.59,.53],'recess':[.075,.13,.17],'brass':[.48,.32,.12],'enamel':[.035,.23,.28],'glass':[.30,.62,.66]}
SPEC={'model':'assets/models/adventure/water-devices-v01.glb','palette':palette,'parts':{},'contract':C,'referenceGameExecuted':False,'budgets':{'triangles':45000,'bytes':3000000}}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;M={};parts={};solids=[];images={}
for name in ['stone-albedo','stone-normal']:
    shutil.copyfile(ROOT/'art/water-courts/v01'/f'{name}.png',ART/f'{name}.png');image=bpy.data.images.load(str(ART/f'{name}.png'));image.colorspace_settings.name='Non-Color' if name.endswith('normal') else 'sRGB';images[name]=image
for name,color in palette.items():
    material=bpy.data.materials.new('Water devices '+name);material.use_nodes=True;bs=material.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.35 if name=='brass' else .8;bs.inputs['Metallic'].default_value=.65 if name=='brass' else 0
    if name=='glass':bs.inputs['Alpha'].default_value=.16;bs.inputs['Roughness'].default_value=.2;material.surface_render_method='DITHERED'
    if name in ['stone','pale','recess']:
        tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=images['stone-albedo'];mix=material.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1);material.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);material.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color']);tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=images['stone-normal'];nm=material.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.22;material.node_tree.links.new(tex.outputs['Color'],nm.inputs['Color']);material.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    M[name]=material
tree=ast.parse((ROOT/'tools/build-moon-courts.py').read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['group','finish','box','poly']],type_ignores=[]),'<shared masonry authoring>','exec'))
def begin(name,datum=0):
    global solids;solids=[];root=group(name);SPEC['parts'][name]={'solids':solids,'datum':datum};return root
def ring(name,p,inner,outer,height,key,parent,n=24):
    points=[(p[0]+r*math.cos(2*math.pi*i/n),p[1]+dy,p[2]+r*math.sin(2*math.pi*i/n)) for dy in [-height/2,height/2] for r in [inner,outer] for i in range(n)];faces=[]
    for i in range(n):
        j=(i+1)%n;faces.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    return poly(name,points,faces,key,parent)
def drop(parent,p,size=.16,side=1):
    outline=[(0,1),(.65,.15),(.58,-.5),(0,-.8),(-.58,-.5),(-.65,.15)];points=[(p[0]+u*size,p[1]+v*size,p[2]+side*d) for d in [0,.018] for u,v in outline];n=len(outline);return poly('Raised water emblem',points,[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],'brass',parent)
def wave(parent,z,side):
    objects=[]
    for row in range(2):
        points=[]
        for i in range(33):
            x=-.82+1.64*i/32;y=.27+row*.13+.035*math.sin(i*math.pi/4);points.extend([(x,y-.010,z),(x,y+.010,z)])
        objects.append(poly('Continuous bronze water relief',points,[(i*2,i*2+2,i*2+3,i*2+1) for i in range(32)],'brass',parent))
    return objects
p=begin('WaterBasin');box('Embedded basin foundation',[0,-.05,0],[2.14,.10,2.14],'recess',p,.008)
for side in [-1,1]:
    box('Basin side wall',[side, .32,0],[.14,.64,2.14],'stone',p,.012,True);box('Basin end wall',[0,.32,side],[1.86,.64,.14],'stone',p,.012,True)
    box('Polished basin rim',[side,.60,0],[.145,.08,2.14],'pale',p,.012);box('Polished basin end rim',[0,.60,side],[1.86,.08,.145],'pale',p,.012)
    box('Enamel water frieze',[0,.33,side*1.076],[1.79,.31,.012],'enamel',p,.006);wave(p,side*1.085,side);drop(p,[0,.34,side*1.096],.16,side)
    box('Side enamel water frieze',[side*1.076,.33,0],[.012,.31,1.79],'enamel',p,.006)
    for obj in [*wave(p,side*1.085,side),drop(p,[0,.34,side*1.096],.16,side)]:obj.rotation_euler.z=math.pi/2
    for z in [-1,1]:
        box('Fitted basin corner clamp',[side,.61,z],[.18,.06,.18],'brass',p,.008,True);ring('Basin flush corner fastener',[side,.639,z],.013,.029,.002,'recess',p,12)
SPEC['parts'][p.name].update({'innerWidth':1.86,'rimTop':.64,'foundationBottom':-.1})
p=begin('BraceletStand');box('Grounded bracelet plinth',[0,.06,0],[.8,.12,.8],'recess',p,.012,True);box('Carved stand body',[0,.29,0],[.62,.34,.62],'stone',p,.014,True);box('Supported capital',[0,.48,0],[.76,.08,.76],'pale',p,.012,True);box('Inset bracelet resting surface',[0,.519,0],[.59,.002,.59],'enamel',p,.001)
for side in [-1,1]:
    box('Stand bronze lip',[0,.43,side*.33],[.66,.023,.035],'brass',p,.003);drop(p,[0,.28,side*.316],.12,side)
p=begin('ReceiverFrame');box('Receiver floor foundation',[0,.06,0],[1.46,.12,1.16],'recess',p,.01,True)
for x in [-.69,.69]:
    for z in [-.54,.54]:box('Tank corner column',[x,1.4,z],[.08,2.8,.08],'pale',p,.007,True)
for y in [.14,2.76]:
    for z in [-.54,.54]:box('Tank header',[0,y,z],[1.46,.08,.08],'brass',p,.007)
    for x in [-.69,.69]:box('Tank side header',[x,y,0],[.08,.08,1.16],'brass',p,.007)
for x in [-.61,.61]:box('Clear tank side',[x,1.4,0],[.025,2.64,.88],'glass',p,0,True)
box('Clear tank back',[0,1.4,-.445],[1.22,2.64,.025],'glass',p,0,True)
# Front inlet remains visibly open around the real arriving conduit.
for x in [-.44,.44]:box('Clear inlet flank',[x,1.4,.445],[.34,2.64,.025],'glass',p,0,True)
box('Clear inlet upper pane',[0,1.72,.445],[.54,2.0,.025],'glass',p,0,True);box('Clear inlet lower pane',[0,.15,.445],[.54,.14,.025],'glass',p,0,True)
for y in [.5,1,1.5,2,2.5]:
    for side in [-1,1]:box('Neutral tank graduation',[side*.48,y,.466],[.18,.022,.018],'brass',p,.002)
for i in range(9):box('Vented tank safety grille',[-.64+i*.16,2.75,0],[.10,.10,1.08],'brass',p,.005)
# Six-centimetre slots pass steam but cannot admit the traveller's0.56m body.
solids.append({'name':'Tank safety grille envelope','position':[0,2.75,0],'size':[1.46,.10,1.16]})
p=begin('LiftDeck');box('Moving deck structure',[0,.09,0],[3.3,.18,3],'stone',p,.018)
for i in range(5):box('Fitted lift tread',[-1.30+i*.65,.20,0],[.63,.04,2.98],'pale',p,.006)
for side in [-1,1]:
    box('Deck bronze end restraint',[0,.18,side*1.47],[3.3,.035,.05],'brass',p,.004)
    for x in [-1.47,1.47]:ring('Flush deck fastener',[x,.219,side*1.30],.018,.045,.002,'brass',p,12)
SPEC['parts'][p.name]['walkTop']=.22
p=begin('LiftGuides')
for x in [-1.75,1.75]:
    box('Grounded lift guide',[x,1.55,0],[.18,3.1,.20],'pale',p,.008,True);box('Guide dark channel',[x,1.55,.105],[.075,2.9,.014],'recess',p,.002)
    for y in [.1,3.0]:box('Guide brass collar',[x,y,0],[.19,.06,.21],'brass',p,.004)
p=begin('LiftPlunger');ring('Hydraulic plunger',[0,.5,0],.21,.27,1,'brass',p,24);ring('Plunger seal',[0,.985,0],.20,.29,.03,'recess',p,24)
p=begin('LowerPedestal');box('Grounded lower basin footing',[0,.09,0],[1.10,.18,1.1],'recess',p,.012,True);box('Lower basin support pier',[0,1.75,0],[.58,3.14,.58],'stone',p,.014,True);box('Supported basin capital',[0,3.41,0],[1.4,.18,1.4],'pale',p,.012,True)
for y in [.22,3.26]:box('Pier bronze fillet',[0,y,0],[.61,.035,.61],'brass',p,.003)
p=begin('CollectorSupports')
for x in [-.65,.65]:
    box('Grounded collector foot',[x,.055,-1.40],[.18,.11,.14],'pale',p,.008,True);box('Collector support shaft',[x,1.15,-1.40],[.12,2.2,.10],'brass',p,.004,True)
    box('Collector support capital',[x,2.22,-1.40],[.2,.08,.16],'pale',p,.006,True)
    box('Collector supported cantilever',[x,2.18,-1.04],[.14,.12,.88],'brass',p,.006)
p=begin('CollectorApron');box('Grounded service platform',[0,1.25,0],[2.8,2.5,1.5],'stone',p,.018,True);box('Service platform fitted coping',[0,2.46,0],[2.8,.08,1.5],'pale',p,.008)
for side in [-1,1]:box('Service platform restrained bronze lip',[0,2.40,side*.754],[2.65,.025,.025],'brass',p,.002)
p=begin('RearReturnRamp');points=[(x,y,z) for y in [-.08] for z in [-2.2,2.2] for x in [-1.25,1.25]]+[(-1.25,0,-2.2),(1.25,0,-2.2),(-1.25,3.05,2.2),(1.25,3.05,2.2)];poly('Ground-supported return ramp',points,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],'stone',p)
box('Level return landing',[0,1.485,2.45],[2.5,3.13,.5],'stone',p,0)
for i in range(1,12):
    z=-2.2+i*4.4/12;y=i*3.05/12;dz=.025;dy=dz*3.05/4.4;poly('Flush return ramp tread',[(-1.24,y-dy+.001,z-dz),(1.24,y-dy+.001,z-dz),(1.24,y+dy+.001,z+dz),(-1.24,y+dy+.001,z+dz)],[(0,1,2,3)],'brass',p)
SPEC['parts'][p.name].update({'floorDatum':0,'foundationBottom':-.08,'length':4.4,'landing':.5,'height':3.05,'width':2.5})
p=begin('CollectorHood');n=32;radii=[.14,.35,.65,1.05];heights=[.35,.32,.18,-.11];points=[(r*math.cos(i*2*math.pi/n),y,r*.857142857*math.sin(i*2*math.pi/n)) for r,y in zip(radii,heights) for i in range(n)];faces=[(k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i) for k in range(3) for i in range(n)];shell=poly('Curved condensing canopy',points,faces,'enamel',p);solid=shell.modifiers.new('Canopy real thickness','SOLIDIFY');solid.thickness=.035;bpy.context.view_layer.objects.active=shell;bpy.ops.object.modifier_apply(modifier=solid.name)
ring('Canopy crown seal',[0,.35,0],.02,.145,.04,'brass',p,24)
for i in range(8):
    angle=i*math.pi/4;pts=[]
    for r,y in zip(radii,heights):
        for a in [angle-.014,angle+.014]:pts.append((r*math.cos(a),y+.016,r*.857142857*math.sin(a)))
    poly('Attached radial canopy rib',pts,[(k*2,k*2+1,k*2+3,k*2+2) for k in range(3)],'brass',p)
p=begin('ConduitCollar');ring('Open conduit flange',[0,0,0],.207,.29,.08,'brass',p,20);ring('Recessed flange seal',[0,0,0],.208,.255,.085,'recess',p,20)
scene.world=bpy.data.worlds.new('Apparatus studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.07,.13,.18,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
lights=[]
for pos,power in [((4,8,7),2000),((-5,5,-3),1200)]:
    bpy.ops.object.light_add(type='AREA',location=V(pos));obj=bpy.context.object;obj.data.energy=power;obj.data.size=7;lights.append(obj)
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1280;scene.render.resolution_y=900
originals=[o for p in parts.values() for o in p.children];metrics=export_parts(list(parts),SPEC,ART,'water-devices-v01','Water devices ');exports=[o for p in parts.values() for o in p.children if o not in originals]
# The generic masonry helper sets opaque base factors. Retain actual transparent
# glass deliberately, with no physical transmission/refraction extension.
out=ROOT/SPEC['model'];raw=out.read_bytes();size=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+size]);tail=raw[20+size:]
for material in data['materials']:
    if material['name']=='Water devices glass':material['pbrMetallicRoughness']['baseColorFactor'][3]=.16;material['alphaMode']='BLEND'
encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);out.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail);metrics['glbBytes']=out.stat().st_size
assert sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))<45000 and metrics['glbBytes']<3000000;(ART/'model-metrics.json').write_text(json.dumps(metrics,indent=2))
for o in exports:o.hide_render=True
instances=[]
def instance(part,pos,scale,assembly):
    root=bpy.data.objects.new(assembly+' '+part,None);scene.collection.objects.link(root);root.location=V(pos);root.scale=(scale[0],scale[2],scale[1]);instances.append((root,assembly))
    for source in parts[part].children:
        if source not in exports:continue
        obj=source.copy();obj.data=source.data;scene.collection.objects.link(obj);obj.parent=root;obj.hide_render=False
instance('BraceletStand',C['bracelet'],[1,1,1],'bracelet');instance('WaterBasin',C['carrySource'],[1,1,1],'source')
for part,pos,scale in [('WaterBasin',C['flowSource'],[1,1,1]),('WaterBasin',C['feeder'],[1.25,1,1]),('ReceiverFrame',C['receiver'],[1,1,1]),('LiftDeck',C['lift'],[1,1,1]),('LiftGuides',C['lift'],[1,1,1])]:instance(part,pos,scale,'hydraulic')
instance('RearReturnRamp',[5.7,0,C['wall']-2.6],[1,1,1],'hydraulic')
for part,pos,scale in [('WaterBasin',C['lower'],[1.1,1,1.1]),('LowerPedestal',[C['lower'][0],-5,C['lower'][2]],[1,1,1]),('WaterBasin',C['altar'],[1,1,.92]),('CollectorHood',[4,4.8,C['collector'][2]],[1,1,1]),('CollectorSupports',[4,2.5,C['collector'][2]],[1,1,1]),('CollectorApron',[4.2,0,C['collector'][2]],[1,1,1])]:instance(part,pos,scale,'condenser')
# Goal context uses the exact current native paving. It is never included in the
# device export or substituted for the existing runtime room architecture.
before_context=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/adventure/water-courts-v01.glb'));context=list(set(scene.objects)-before_context);floors={}
for assembly,name,index in [('bracelet','CarryFloor',0),('source','CarryFloor',0),('hydraulic','FlowFloor',1),('condenser','CycleFloor',2)]:
    source=bpy.data.objects[name];seg=C['segments'][index];root=source.copy();scene.collection.objects.link(root);root.name='Goal context '+assembly;root.location=V((0,0,(seg['z0']+seg['z1'])/2));floors[assembly]=root
    for child in source.children:
        obj=child.copy();obj.data=child.data;scene.collection.objects.link(obj);obj.parent=root;context.append(obj)
    context.append(root)
for obj in context:obj.hide_render=True
proxies=[]
for assembly,pos,size in [('hydraulic',[-4.7,.775,C['feeder'][2]+.1],[3.7,1.55,2.5]),('condenser',[4.6,1.25,C['altar'][2]+.1],[4.3,2.5,2.8])]:
    pos=list(pos);pos[2]+=floors[assembly].location.y;obj=box('Goal existing platform context',pos,size,'stone',floors[assembly],.008);proxies.append((obj,assembly));context.append(obj)
for shot in BEFORE['shots']:
    only=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--only=')),None)
    if only and shot['assembly'] not in only.split(','):continue
    for obj in context:obj.hide_render=True
    floors[shot['assembly']].hide_render=False
    for obj in floors[shot['assembly']].children:obj.hide_render=False
    for root,assembly in instances:
        for o in root.children:o.hide_render=assembly!=shot['assembly']
    target=V(shot['target']);cam.location=V(shot['camera']);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov'])
    for i,obj in enumerate(lights):obj.location=target+V((4 if i==0 else -5,7 if i==0 else 5,5 if i==0 else -3));obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
for obj in list(set(context)):bpy.data.objects.remove(obj,do_unlink=True)
for root,_ in instances:
    for child in list(root.children):bpy.data.objects.remove(child,do_unlink=True)
    bpy.data.objects.remove(root,do_unlink=True)
for obj in exports:bpy.data.objects.remove(obj,do_unlink=True)
for i,(name,parent) in enumerate(parts.items()):
    parent.location=V(((i%4)*4,0,(i//4)*5))
    for obj in parent.children:obj.hide_set(False);obj.hide_render=False
cam.location=V((12,11,18));cam.rotation_euler=(V((5,1,4))-cam.location).to_track_quat('-Z','Y').to_euler();bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'water-devices-v01.blend'));print('PASS WATER_DEVICES '+json.dumps(metrics),flush=True)
