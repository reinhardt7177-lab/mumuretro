"""Authored lamp stand/housing/control; six matching design renders with proxy optics."""
import bpy,math,json,shutil,struct,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/twin-shadow/v01';OUT=ROOT/'assets/models/adventure';before=json.loads((ROOT/'reports/2026-10-22/evidence/twin-shadow/before/report.json').read_text());D=before['device'];V=lambda p:Vector((p[0],-p[2],p[1]))
palette={'stone':[.42,.44,.43],'brass':[.63,.43,.15],'dark':[.10,.14,.19],'steel':[.52,.58,.60]};SPEC={'model':'assets/models/adventure/twin-shadow-v01.glb','parts':['LampStand','LampHousing','LampWheel'],'palette':palette,'lampY':2.8,'wheel':[1.35,1.05,.35],'wheelGrip':[.24,0,.035],'body':{'position':[1.35,.52,.35],'size':[.42,1.04,.48]},'spreads':[.35,.75,1.15],'budgets':{'triangles':15000,'bytes':3500000}}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;M={};parts={}
for n,c in palette.items():
    m=bpy.data.materials.new('Twin '+n);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Metallic'].default_value=.65 if n in['brass','steel'] else 0;bs.inputs['Roughness'].default_value=.40 if n=='brass' else .72
    if n=='stone':
        for name in['stone-albedo','stone-normal']:
            shutil.copyfile(ROOT/'art/moon-sanctum/v01'/f'{name}.png',ART/f'{name}.png');im=bpy.data.images.load(str(ART/f'{name}.png'));im.colorspace_settings.name='Non-Color' if name.endswith('normal') else 'sRGB';tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
            if name.endswith('normal'):
                nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.22;m.node_tree.links.new(tex.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs[0],bs.inputs['Normal'])
            else:
                mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*c,1);m.node_tree.links.new(tex.outputs[0],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
    M[n]=m
def group(name):
    p=bpy.data.objects.new(name,None);scene.collection.objects.link(p);parts[name]=p;return p
def finish(o,name,key,parent):
    o.name=name;o.parent=parent;o.data.materials.append(M[key]);return o
def box(name,pos,size,key,parent,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=V(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Crafted edge','BEVEL');b.width=bevel;b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name)
    return finish(o,name,key,parent)
def rod(name,a,b,r,key,parent,r2=None):
    a,b=V(a),V(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,key,parent)
def torus(name,pos,r,minor,key,parent):
    bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,location=V(pos),major_radius=r,minor_radius=minor);o=bpy.context.object;o.rotation_euler.x=math.pi/2;return finish(o,name,key,parent)
p=group('LampStand')
rod('Grounded stone drum',(0,0,.16),(0,.22,.16),.60,'stone',p,.54);rod('Base bronze moulding',(0,.22,.16),(0,.28,.16),.54,'brass',p,.48)
rod('Tapered source column',(0,.28,.16),(0,2.50,.16),.15,'dark',p,.11)
for y in[.40,1.10,2.30]:rod('Column collar',(0,y,.16),(0,y+.06,.16),.18,'brass',p)
box('Telescopic head beam',(0,2.48,.16),(2.65,.13,.28),'dark',p)
for x in[-1.25,0,1.25]:box('Beam sleeve',(x,2.48,.16),(.14,.20,.36),'brass',p)
for side in[-1,1]:
    rod('Structural brace',(0,2.05,.16),(side*.80,2.43,.16),.035,'steel',p)
    for x in[.35,.75,1.15]:box('Equal source spacing notch',(side*x,2.56,.16),(.025,.018,.12),'brass',p,.002)
wx,wy,wz=SPEC['wheel'];box('Wheel grounded foot',(wx,.08,wz),(.42,.16,.48),'stone',p,.02);box('Wheel pedestal',(wx,.53,wz),(.14,.74,.18),'dark',p);rod('Wheel shaft',(wx,wy,wz-.14),(wx,wy,wz+.04),.065,'steel',p)
box('Control pointer',(wx,wy+.33,wz),(.055,.11,.07),'brass',p,.006)
p=group('LampHousing')
rod('Opaque rear barrel',(0,0,.025),(0,0,.30),.245,'dark',p,.215)
for z in[.03,.14,.27]:torus('Cast brass barrel band',(0,0,z),.242,.023,'brass',p)
for a in[0,math.pi/2,math.pi,3*math.pi/2]:
    x,y=math.cos(a)*.20,math.sin(a)*.20;rod('Barrel open rib',(x,y,0),(x,y,.28),.022,'brass',p)
torus('Open lens rim',(0,0,-.012),.19,.025,'steel',p);box('Sliding lamp shoe',(0,-.27,.16),(.26,.09,.30),'brass',p)
p=group('LampWheel');torus('Hand polished wheel rim',(0,0,0),.24,.035,'brass',p)
for a in[0,math.pi*2/3,math.pi*4/3]:rod('Wheel spoke',(0,0,0),(math.cos(a)*.22,math.sin(a)*.22,0),.025,'steel',p)
rod('Wheel hub',(0,0,-.07),(0,0,.04),.065,'dark',p)
for a in[math.pi/2,math.pi/2+math.pi*2/3,math.pi/2+math.pi*4/3]:box('Equal dial mark',(math.cos(a)*.17,math.sin(a)*.17,.035),(.03,.03,.012),'brass',p,.002)
bpy.context.view_layer.update();originals={name:list(p.children) for name,p in parts.items()}
scene.view_settings.view_transform='AgX';scene.world=bpy.data.worlds.new('Twin lamp night');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.055,.10,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.3
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=768;scene.render.resolution_y=540;scene.render.resolution_percentage=100
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'twin-shadow-v01.blend'))
metrics={};exports=[]
for name,p in parts.items():
    by={}
    for source in originals[name]:
        o=source.copy();o.data=source.data.copy();scene.collection.objects.link(o);o.parent=p;by.setdefault(o.active_material.name,[]).append(o);source.hide_render=True;source.hide_set(True)
    merged=[]
    for key,objects in by.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name+' '+key;merged.append(o)
    points=[];tris=0;bpy.context.view_layer.update()
    for o in merged:o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles);points.extend(o.matrix_world@v.co for v in o.data.vertices)
    metrics[name]={'meshes':len(merged),'sourcePieces':len(originals[name]),'triangles':tris,'webMin':[min(v.x for v in points),min(v.z for v in points),-max(v.y for v in points)],'webMax':[max(v.x for v in points),max(v.z for v in points),-min(v.y for v in points)]};exports.extend(merged)
assert sum(v['triangles'] for v in metrics.values())<=SPEC['budgets']['triangles']
bpy.ops.object.select_all(action='DESELECT')
for p in parts.values():p.select_set(True)
for o in exports:o.select_set(True)
glb=OUT/'twin-shadow-v01.glb';bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
raw=glb.read_bytes();length=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+length]);tail=raw[20+length:]
for m in data['materials']:m.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=[*palette[m['name'].replace('Twin ','')],1];m['doubleSided']=True
encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);glb.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
assert glb.stat().st_size<=SPEC['budgets']['bytes'];metrics['glbBytes']=glb.stat().st_size
(ART/'model-metrics.json').write_text(json.dumps(metrics,indent=2));(ART/'design-spec.json').write_text(json.dumps(SPEC,indent=2));(OUT/'twin-shadow-v01.json').write_text(json.dumps(SPEC,separators=(',',':')));(ART/'material-export.json').write_text(json.dumps({'pass':True,'geometryAndImageChunkUnchanged':True,'binaryChunkSha256':hashlib.sha256(tail).hexdigest(),'materials':[m['name'] for m in data['materials']]},indent=2))
# Proxy surfaces are design context only, absent from the exported asset/source.
proxy=group('ReferenceOnly');M['screen']=bpy.data.materials.new('Reference screen');M['screen'].diffuse_color=(.70,.68,.59,1);M['panel']=bpy.data.materials.new('Reference panel');M['panel'].diffuse_color=(.06,.08,.11,1);M['line']=bpy.data.materials.new('Reference target');M['line'].diffuse_color=(.8,.52,.13,1)
sx,ly,lz,wz=D['axisX'],D['beamY'],D['lampZ'],D['wallZ'];screen=box('Reference screen',(sx,ly,wz-.10),(4.3,4.3,.18),'screen',proxy,0);floor=box('Reference floor',(0,-.10,(lz+wz)/2),(14,.20,12),'stone',proxy,0);panel=box('Reference panel',(sx,ly,lz-5.2),(.9,.9,.06),'panel',proxy,0)
stem=box('Reference panel stem',(sx,1.425,lz-5.2),(.09,1.85,.06),'brass',proxy,0);cart=box('Reference grounded cart',(sx,.25,lz-5.32),(.88,.50,.65),'dark',proxy,0)
for side in[-1,1]:box('Reference screen support',(sx+side*1.8,.5,wz-.1),(.26,1,.42),'stone',proxy,0)
target_lines=[[box('Reference target line',(0,0,0),(1,1,1),'line',proxy,0) for j in range(4)] for i in range(2)]
far=next(z for z in D['answers'] if 8-1e-7<=lz-z<=9.2+1e-7);mid=next(z for z in D['answers'] if 5.6-1e-7<=lz-z<=7+1e-7);near=next(z for z in D['answers'] if 2.8-1e-7<=lz-z<=3.8+1e-7);answer_span=round((lz-near)*1000)%3;default_span=SPEC['spreads'][(answer_span+1)%3]
holders=[]
for i in range(2):
    holder=bpy.data.objects.new('Reference housing placement',None);scene.collection.objects.link(holder)
    for source in exports:
        if source.parent.name!='LampHousing':continue
        o=source.copy();o.data=source.data;scene.collection.objects.link(o);o.parent=holder
    bpy.ops.object.light_add(type='POINT');light=bpy.context.object;light.data.energy=180;light.data.shadow_soft_size=.025;holders.append((holder,light))
for o in exports:
    if o.parent.name=='LampHousing':o.hide_render=True
parts['LampStand'].location=V((sx,0,lz));parts['LampWheel'].location=V((sx+wx,wy,lz+SPEC['wheel'][2]))
bpy.ops.object.light_add(type='AREA',location=V((2,8,lz+1)));fill=bpy.context.object;fill.data.energy=700;fill.data.size=7;fill.rotation_euler=(V((sx,1,lz-3))-fill.location).to_track_quat('-Z','Y').to_euler()
for shot in before['shots']:
    stage=shot['stage'];panel.location=V((sx,ly,shot['object']));stem.location=V((sx,1.425,shot['object']-.03));cart.location=V((sx,.25,shot['object']-.12))
    factor=(lz-wz)/(lz-(mid if stage else far));size=.9*factor;offset=SPEC['spreads'][answer_span]*(factor-1) if stage else 0
    for i,lines in enumerate(target_lines):
        center=sx+([-1,1][i]*offset if stage else 0)
        for j,o in enumerate(lines):
            o.hide_render=not stage and i==1;horizontal=j<2;sign=-1 if j%2==0 else 1;o.location=V((center if horizontal else center+sign*size/2,ly+sign*size/2 if horizontal else ly,wz+.018));o.scale=(size+.025 if horizontal else .025,.01,.025 if horizontal else size)
    for i,(holder,light)in enumerate(holders):
        holder.hide_render=False;position=(sx+([-1,1][i]*default_span if stage else 0),ly,lz);holder.location=V(position);light.location=V(position);light.data.energy=180 if stage or i==0 else 0
        for o in holder.children:o.hide_render=not stage and i==1
    cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
print('TWIN_SHADOW '+json.dumps(metrics))
