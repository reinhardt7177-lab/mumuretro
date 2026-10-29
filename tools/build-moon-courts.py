"""Editable masonry courts; render-only copies merge by material for the web."""
import bpy,bmesh,math,json,shutil,struct,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/moon-courts/v01';OUT=ROOT/'assets/models/adventure';ART.mkdir(parents=True,exist_ok=True)
before=json.loads((ROOT/'reports/2026-10-22/evidence/moon-courts/before/report.json').read_text())
palette={'stone':[.31,.34,.36],'pale':[.66,.63,.52],'recess':[.12,.17,.22],'brass':[.57,.39,.13],'floor':[.40,.43,.43]}
SPEC={'model':'assets/models/adventure/moon-courts-v01.glb','palette':palette,'rooms':[],'budgets':{'triangles':90000,'bytes':9000000},'originalRuntimeExecuted':False}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;V=lambda p:Vector((p[0],-p[2],p[1]));M={};parts={};images={};solids=[]
for name in ['stone-albedo','stone-normal','floor-albedo','floor-normal']:
    shutil.copyfile(ROOT/'art/moon-sanctum/v01'/f'{name}.png',ART/f'{name}.png');im=bpy.data.images.load(str(ART/f'{name}.png'));im.colorspace_settings.name='Non-Color' if name.endswith('normal') else 'sRGB';images[name]=im
for name,color in palette.items():
    m=bpy.data.materials.new('Courts '+name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=.60 if name=='brass' else 0;bs.inputs['Roughness'].default_value=.42 if name=='brass' else .86
    if name!='brass':
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=images['floor-albedo' if name=='floor' else 'stone-albedo'];mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
        normal=m.node_tree.nodes.new('ShaderNodeTexImage');normal.image=images['floor-normal' if name=='floor' else 'stone-normal'];nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.23;m.node_tree.links.new(normal.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    M[name]=m
def group(name):
    p=bpy.data.objects.new(name,None);scene.collection.objects.link(p);parts[name]=p;return p
def finish(o,name,key,parent):
    o.name=name;o.parent=parent;o.data.materials.append(M[key]);bpy.context.view_layer.update();uv=o.data.uv_layers.new(name='MasonryUV')
    for f in o.data.polygons:
        axis=max(range(3),key=lambda k:abs(f.normal[k]));axes=[k for k in range(3) if k!=axis]
        for i in f.loop_indices:
            q=o.matrix_world@o.data.vertices[o.data.loops[i].vertex_index].co;uv.data[i].uv=(q[axes[0]]/1.5,q[axes[1]]/1.5)
    return o
def box(name,p,size,key,parent,bevel=.014,solid=False):
    bpy.ops.mesh.primitive_cube_add(size=1,location=V(p));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Stone edge','BEVEL');b.width=bevel;b.segments=1;bpy.ops.object.modifier_apply(modifier=b.name)
    if solid:solids.append({'name':name,'position':p,'size':size})
    return finish(o,name,key,parent)
def poly(name,points,faces,key,parent):
    me=bpy.data.meshes.new(name);me.from_pydata([V(p) for p in points],[],faces);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free();o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);return finish(o,name,key,parent)
def arc(name,x,z,r,spring,depth,parent,side=False):
    for i in range(22):
        a=math.pi*i/22+.002;b=math.pi*(i+1)/22-.002;pts=[]
        for dz in[-depth/2,depth/2]:
            for radius in[r,r+.30]:
                for t in[a,b]:
                    q=radius*math.cos(t);y=spring+radius*math.sin(t);pts.append((x+dz,y,z+q) if side else(x+q,y,z+dz))
        poly(name,pts,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],'pale' if i in[0,10,11,21] else 'stone',parent)
    # A thin recessed ribbon follows the inner arch, not a glowing safe route.
    for i in range(16):
        a=math.pi*i/16;b=math.pi*(i+1)/16;pts=[]
        for dz in[-depth/2-.018,-depth/2-.038]:
            for radius in[r+.05,r+.085]:
                for t in[a,b]:
                    q=radius*math.cos(t);y=spring+radius*math.sin(t);pts.append((x+dz,y,z+q) if side else(x+q,y,z+dz))
        poly('Recessed brass arch',pts,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],'brass',parent)
def pier(x,z,parent,height=3.25,width=.66,depth=.80):
    box('Grounded pier foot',[x,.14,z],[width+.20,.28,depth+.10],'recess',parent,.018,True)
    box('Pier moulding',[x,.34,z],[width+.10,.12,depth],'pale',parent,.012,True)
    box('Fluted pier body',[x,(height+.40)/2,z],[width,height-.40,depth-.18],'stone',parent,.018,True)
    for d in[-.18,0,.18]:box('Pier carved channel',[x+d,(height+.42)/2,z+depth/2-.065],[.025,height-.60,.018],'recess',parent,.002)
    box('Layered capital',[x,height+.03,z],[width+.24,.24,depth+.12],'pale',parent,.016)
    box('Capital brass lip',[x,height+.17,z],[width+.27,.035,depth+.15],'brass',parent,.003)
for index,(name,w,length,bays)in enumerate([('Shade',14,16,4),('Mirror',18,14,3),('Panel',14,12,3)]):
    shell=group(name+'Court');floor=group(name+'Floor');solids=[];half=w/2;sideX=half+.32;span=(length-.8)/bays;radius=(span-.58)/2;centers=[-length/2+.4+span*(i+.5) for i in range(bays)];piers=[]
    for side in[-1,1]:
        x=side*sideX
        # Mortar backing gives seams depth without cracks all the way through.
        box('Perimeter wall backing',[x,.57,0],[.64,1.14,length+.55],'recess',shell,0,True)
        for row in range(3):
            count=bays*2
            for k in range(count):
                z=-length/2+(k+.5)*length/count;box('Coursed sill block',[x,.19+row*.36,z],[.67,.34,length/count-.025],'stone' if (k+row)%3 else 'pale',shell,.014)
        box('Deep window sill',[x,1.20,0],[.82,.14,length+.58],'pale',shell,.016,True)
        for k in range(bays+1):
            z=-length/2+.4+k*span;pier(x,z,shell);piers.append([x,z])
        for z in centers:arc('Masonry window arch',x,z,radius,3.25,.66,shell,True)
    for end in[-1,1]:
        # Ends retain an open, supported centre matching the existing bridge.
        firstFront=index==0 and end==1;center=3.02 if firstFront else 2.65;opening=5.0 if firstFront else 4.2;z=end*(length/2+.10)
        for side in[-1,1]:
            pier(side*center,z,shell,4.05,.70,.82)
            wing=(w-2*center)/2
            box('End wing stone',[side*(center+wing/2),.57,z],[wing-.04,1.14,.65],'stone',shell,.016,True)
            box('End wing sill',[side*(center+wing/2),1.20,z],[wing+.03,.14,.82],'pale',shell,.012,True)
        arc('Threshold carved arch',0,z,center-.35,4.05,.72,shell)
        box('Threshold keystone',[0,4.05+center-.15,z],[.37,.52,.86],'pale',shell,.02)
    SPEC['rooms'].append({'name':name,'index':index,'width':w,'length':length,'shell':shell.name,'floor':floor.name,'piers':piers,'solids':solids,'foundationBottom':-.20,'notches':{'front':5.0 if index==0 else 4.2,'rear':4.2}})
    box('Supported foundation',[0,-.115,0],[w+1.8,.17,length+1.3],'recess',floor,0)
    poly('Planar paving',[(-half-.9,0,-length/2),(half+.9,0,-length/2),(half+.9,0,length/2),(-half-.9,0,length/2)],[(3,2,1,0)],'floor',floor)
    for end in[-1,1]:
        notch=(5.0 if index==0 and end==1 else 4.2)/2;z0,z1=sorted([end*length/2,end*(length/2+.65)])
        for x0,x1 in[(-half-.9,-notch),(notch,half+.9)]:poly('Supported side apron',[(x0,0,z0),(x1,0,z0),(x1,0,z1),(x0,0,z1)],[(3,2,1,0)],'floor',floor)
scene.view_settings.view_transform='AgX';scene.world=bpy.data.worlds.new('Night studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.04,.065,.12,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
for pos,power,size in[((3,-5,8),2100,7),((-6,4,6),1500,7)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=768;scene.render.resolution_y=540;scene.render.resolution_percentage=100
# Save individual source objects before creating disposable merged export copies.
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'moon-courts-v01.blend'))
originals={name:list(p.children) for name,p in parts.items()};metrics={};exports=[]
for name,p in parts.items():
    by={}
    for source in originals[name]:
        o=source.copy();o.data=source.data.copy();scene.collection.objects.link(o);o.parent=p;by.setdefault(o.active_material.name,[]).append(o);source.hide_render=True;source.hide_set(True)
    merged=[]
    for key,objects in by.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name+' '+key;merged.append(o)
    bpy.context.view_layer.update();points=[];tris=0
    for o in merged:o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles);points.extend(o.matrix_world@v.co for v in o.data.vertices)
    metrics[name]={'meshes':len(merged),'sourcePieces':len(originals[name]),'triangles':tris,'webMin':[min(v.x for v in points),min(v.z for v in points),-max(v.y for v in points)],'webMax':[max(v.x for v in points),max(v.z for v in points),-min(v.y for v in points)]};exports.extend(merged)
assert sum(v['triangles'] for v in metrics.values())<=SPEC['budgets']['triangles']
bpy.ops.object.select_all(action='DESELECT')
for p in parts.values():p.select_set(True)
for o in exports:o.select_set(True)
glb=OUT/'moon-courts-v01.glb';bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
raw=glb.read_bytes();size=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+size]);tail=raw[20+size:]
for m in data['materials']:m.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=[*palette[m['name'].replace('Courts ','')],1];m['doubleSided']=True
encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);glb.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
assert glb.stat().st_size<=SPEC['budgets']['bytes'];metrics['glbBytes']=glb.stat().st_size
(ART/'model-metrics.json').write_text(json.dumps(metrics,indent=2));(ART/'material-export.json').write_text(json.dumps({'pass':True,'binaryChunkSha256':hashlib.sha256(tail).hexdigest(),'geometryAndImageChunkUnchanged':True,'materials':[m['name'] for m in data['materials']]},indent=2));(ART/'design-spec.json').write_text(json.dumps(SPEC,indent=2));(OUT/'moon-courts-v01.json').write_text(json.dumps(SPEC,separators=(',',':')))
for item in SPEC['rooms']:
    for o in exports:o.hide_render=o.parent.name not in[item['shell'],item['floor']]
    for kind in['shell','floor']:
        for o in exports:o.hide_render=o.parent.name!=item[kind]
        target=V((0,2 if kind=='shell' else 0,0));cam.location=target+Vector((11,-18,11));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(62);scene.render.filepath=str(ART/(item[kind]+'.png'));bpy.ops.render.render(write_still=True)
for shot in before['shots']:
    item=SPEC['rooms'][shot['index']];cz=(before['segments'][shot['index']]['z0']+before['segments'][shot['index']]['z1'])/2
    for name,p in parts.items():p.location=V((0,0,cz)) if name in[item['shell'],item['floor']] else Vector((0,0,0))
    for o in exports:o.hide_render=o.parent.name not in[item['shell'],item['floor']]
    for o in scene.objects:
        if o.type=='LIGHT':o.location.y= -cz+(-5 if o.data.energy==2100 else 4)
    cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
print('MOON_COURTS '+json.dumps(metrics))
