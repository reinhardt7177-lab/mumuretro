"""Authored lunar guardian with retained convex optical pieces and merged render geometry."""
import bpy,bmesh,math,json,shutil,struct,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/moon-sanctum/v01';OUT=ROOT/'assets/models/adventure'
SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf8'));SPEC['guardian']['casters']=[];SPEC['hall']['solids']=[]
SPEC['hall'].update({'supportWidth':23.2,'supportLength':17.6,'frontNotchWidth':5.2})
before=json.loads((ROOT/'reports/2026-10-22/evidence/moon-sanctum/before/report.json').read_text(encoding='utf8'))
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;V=lambda p:Vector((p[0],-p[2],p[1]));M={};parts={}
images={}
for name in ['stone-albedo','stone-normal','floor-albedo','floor-normal']:
    shutil.copyfile(ROOT/'art/sift-architecture/v01'/f'{name}.png',ART/f'{name}.png');images[name]=bpy.data.images.load(str(ART/f'{name}.png'));images[name].colorspace_settings.name='Non-Color' if name.endswith('normal') else 'sRGB'
for name,color in SPEC['palette'].items():
    m=bpy.data.materials.new('Lunar '+name);m.use_nodes=True;m.use_backface_culling=False;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=.68 if name=='brass' else 0;bs.inputs['Roughness'].default_value=.35 if name=='brass' else .82
    if name!='brass':
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=images['floor-albedo' if name=='floor' else 'stone-albedo'];mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
        norm=m.node_tree.nodes.new('ShaderNodeTexImage');norm.image=images['floor-normal' if name=='floor' else 'stone-normal'];nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.28;m.node_tree.links.new(norm.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    M[name]=m
def group(name):
    p=bpy.data.objects.new(name,None);scene.collection.objects.link(p);parts[name]=p;return p
def finish(o,name,key,parent):
    o.name=name;o.parent=parent;o.data.materials.append(M[key]);bpy.context.view_layer.update();layer=o.data.uv_layers.new(name='CraftedUV')
    for f in o.data.polygons:
        axis=max(range(3),key=lambda k:abs(f.normal[k]));axes=[k for k in range(3) if k!=axis]
        for i in f.loop_indices:
            q=o.matrix_world@o.data.vertices[o.data.loops[i].vertex_index].co;layer.data[i].uv=(q[axes[0]]/1.5,q[axes[1]]/1.5)
    return o
def box(name,pos,size,key,parent,bevel=.015,solid=False):
    bpy.ops.mesh.primitive_cube_add(size=1,location=V(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Stone arris','BEVEL');b.width=bevel;b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name)
    if solid:SPEC['hall']['solids'].append({'name':name,'position':list(pos),'size':list(size)})
    return finish(o,name,key,parent)
def rod(name,a,b,r,key,parent,sides=16,r2=None):
    a,b=V(a),V(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=sides,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,key,parent)
def orb(name,pos,size,key,parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=V(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,key,parent)
def poly(name,points,faces,key,parent):
    me=bpy.data.meshes.new(name);me.from_pydata([V(p) for p in points],[],faces);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free();o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);return finish(o,name,key,parent)
def arc(name,rx,ry,y0,z,depth,key,parent,start=0,end=math.pi,count=24,thick=.20,sideX=None):
    for i in range(count):
        a=start+(end-start)*i/count+.002;b=start+(end-start)*(i+1)/count-.002;points=[]
        for dz in [-depth/2,depth/2]:
            for rX,rY in [(rx,ry),(rx+thick,ry+thick)]:
                for t in[a,b]:
                    xx=rX*math.cos(t);yy=y0+rY*math.sin(t);points.append((xx,yy,z+dz) if sideX is None else(sideX+dz,yy,z+xx))
        poly(name,points,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],key,parent)

p=group('MoonGuardian')
rod('Octagonal foundation',(0,0,0),(0,.20,0),1.42,'recess',p,12,1.35)
rod('Carved base crown',(0,.20,0),(0,.32,0),1.35,'pale',p,12,1.24)
rod('Robed body',(0,.32,0),(0,1.62,0),1.13,'stone',p,24,.70)
for i in range(16):
    a=i*math.tau/16;rod('Sculpted robe pleat',(math.cos(a)*1.10,.36,math.sin(a)*1.10),(math.cos(a)*.70,1.58,math.sin(a)*.70),.060,'pale' if i%3==0 else 'stone',p,10,.045)
rod('Shoulder mantle',(0,1.59,0),(0,1.77,0),.78,'pale',p,20,.70)
rod('Collar',(0,1.77,0),(0,1.92,0),.27,'recess',p,16,.24)
orb('Hooded head',(0,2.24,-.10),(.50,.40,.36),'recess',p)
for side in[-1,1]:
    orb('Shoulder cap',(side*.79,1.62,.02),(.26,.25,.25),'stone',p)
    rod('Sleeve upper',(side*.80,1.58,.04),(side*1.02,1.22,.26),.21,'stone',p,16,.17)
    rod('Sleeve forward',(side*1.02,1.22,.26),(side*.77,1.25,.74),.17,'pale',p,16,.12)
    orb('Supporting palm',(side*.70,1.27,.78),(.14,.13,.13),'stone',p)
    for k in range(4):rod('Carved finger',(side*(.72+k*.018),1.16+k*.065,.82),(side*.60,1.18+k*.065,.92),.029,'pale',p,8,.023)
    rod('Thumb',(side*.72,1.43,.77),(side*.61,1.39,.91),.044,'pale',p,10,.035)
    line=[]
    for j in range(6):
        y=.39+j*.23;x=side*(.49-j*.035);radius=1.13+(.70-1.13)*(y-.32)/1.30;line.append((x,y,math.sqrt(radius*radius-x*x)+.012))
    for a,b in zip(line,line[1:]):rod('Stole seam',a,b,.018,'brass',p,10)
    for j in range(3):box('Stole lunar incision',(side*.48,.57+j*.23,.97-j*.07),(.12,.018,.018),'recess',p,.003)
# Mask pieces leave real slots for the original eyes instead of covering them.
xs=[-.42,-.355,-.085,.085,.355,.42];ys=[1.94,2.215,2.325,2.54];scales=[.60,1,.95,.72]
for j in range(3):
    for i in range(5):
        if j==1 and i in[1,3]:continue
        front=.55+.012*(1-abs((xs[i]+xs[i+1])/2)/.42);points=[]
        for z in[front-.08,front]:
            points.extend([(xs[i]*scales[j],ys[j],z),(xs[i+1]*scales[j],ys[j],z),(xs[i+1]*scales[j+1],ys[j+1],z),(xs[i]*scales[j+1],ys[j+1],z)])
        poly('Tapered carved mask facet',points,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'face',p)
poly('Mask nose',[(-.065,2.25,.57),(.065,2.25,.57),(.055,2.08,.57),(-.055,2.08,.57),(0,2.13,.67)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)],'pale',p)
rod('Quiet mouth',(-.13,2.035,.582),(0,2.015,.585),.008,'recess',p,8)
rod('Quiet mouth',(0,2.015,.585),(.13,2.035,.582),.008,'recess',p,8)
for side in[-1,1]:
    rod('Mask brow',(side*.085,2.35,.58),(side*.35,2.38,.575),.018,'pale',p,10)
    rod('Hood carved rim',(side*.46,2.05,.35),(side*.44,2.48,.30),.065,'stone',p,12,.055)
    rod('Hood carved crown',(side*.44,2.48,.30),(0,2.65,.14),.055,'pale',p,12,.04)
# Separate convex crown voussoirs preserve the opening in the projected shadow.
arc('Open lunar crown',.45,.45,2.24,-.35,.065,'brass',p,start=math.pi/6,end=11*math.pi/6,count=28,thick=.06)
rod('Round lunar shield',(0,1.25,.79),(0,1.25,.91),.55,'recess',p,32)
arc('Shield bronze rim',.52,.52,1.25,.92,.035,'brass',p,start=0,end=math.tau,count=32,thick=.03)
arc('Shield crescent',.23,.23,1.29,.95,.018,'pale',p,start=math.pi*.30,end=math.pi*1.70,count=16,thick=.04)
for a in[0,math.pi/2,math.pi,math.pi*1.5]:orb('Shield rivet',(math.cos(a)*.43,1.25+math.sin(a)*.43,.95),(.027,.027,.027),'brass',p)

p=group('LunarArcade')
piers=set()
def pier(x,z,side=False):
    key=(round(x,5),round(z,5))
    if key in piers:return
    piers.add(key)
    w,d=(.70,.85) if side else(.85,.70)
    box('Pier grounded foot',(x,.14,z),(w,.28,d),'recess',p,.025,True)
    box('Pier moulding',(x,.34,z),(w*.87,.12,d*.87),'pale',p,.018,True)
    box('Fluted pier',(x,1.79,z),(.52,2.78,.48),'stone',p,.022,True)
    for offset in[-.14,.14]:box('Pier carved channel',(x+offset,1.75,z+.25),(.035,2.5,.025),'recess',p,.005)
    box('Leafless layered capital',(x,3.15,z),(.84,.24,.77),'pale',p,.02)
    box('Capital brass lip',(x,3.29,z),(.87,.035,.80),'brass',p,.005)
for side in[-1,1]:
    box('Low perimeter plinth',(side*11.2,.35,0),(.50,.70,16.0),'stone',p,.025,True)
    box('Perimeter moulding',(side*11.2,.76,0),(.62,.12,16.1),'pale',p,.018,True)
    for z in SPEC['hall']['sideArchZ']:
        for dz in[-1.95,1.95]:pier(side*9.5,z+dz,True)
        arc('Side voussoir',1.95,1.95,3.2,z,.50,'stone',p,count=24,thick=.22,sideX=side*9.5)
        arc('Side recessed trim',1.93,1.93,3.2,z,.035,'brass',p,count=24,thick=.035,sideX=side*9.5-side*.27)
for x in SPEC['hall']['rearArchX']:
    for dx in[-1.9,1.9]:pier(x+dx,-8.22)
    # Generate at origin then offset only the new back-arch pieces.
    old=set(p.children);arc('Rear voussoir',1.95,1.95,3.2,-8.22,.50,'stone',p,count=24,thick=.22)
    arc('Rear recessed trim',1.93,1.93,3.2,-7.95,.035,'brass',p,count=24,thick=.035)
    for ob in set(p.children)-old:ob.location.x+=x
p=group('LunarFloor')
box('Supported foundation',(0,-.115,0),(23.2,.17,17.6),'recess',p,0)
for x0,x1,z0,z1 in[(-11.6,11.6,-8,8),(-11.6,11.6,-8.8,-8),(-11.6,-2.6,8,8.8),(2.6,11.6,8,8.8)]:
    poly('Planar paving',[(x0,0,z0),(x1,0,z0),(x1,0,z1),(x0,0,z1)],[(3,2,1,0)],'floor',p)
# Save the actual convex sources for the artist before making export-only copies.
bpy.context.view_layer.update();pieces=[]
for o in parts['MoonGuardian'].children:
    points=[o.matrix_world@v.co for v in o.data.vertices]
    # A convex-part projection is exact only if every face supports the whole piece.
    for face in o.data.polygons:
        normal=o.matrix_world.to_3x3().inverted().transposed()@face.normal;normal.normalize();origin=o.matrix_world@o.data.vertices[face.vertices[0]].co
        dots=[(v-origin).dot(normal) for v in points]
        assert max(dots)<2e-5 or min(dots)>-2e-5,(o.name,min(dots),max(dots))
    vertices=[[float(struct.unpack('<f',struct.pack('<f',v))[0]) for v in(q.x,q.z,-q.y)] for q in points]
    pieces.append({'name':o.name,'vertices':vertices})
SPEC['guardian']['casters']=pieces
scene.view_settings.view_transform='AgX';scene.world=bpy.data.worlds.new('Moon court night');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.04,.065,.12,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
for pos,power,size in[((3,-5,8),1400,6),((-6,4,5),800,5)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,1.4))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=768;scene.render.resolution_y=540;scene.render.resolution_percentage=100
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'moon-sanctum-v01.blend'))
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
assert metrics['MoonGuardian']['webMax'][1]<=2.751 and abs(metrics['MoonGuardian']['webMin'][1])<1e-5
assert sum(v['triangles'] for v in metrics.values())<=SPEC['budgets']['trianglesMax']
bpy.ops.object.select_all(action='DESELECT')
for p in parts.values():p.select_set(True)
for o in exports:o.select_set(True)
glb=OUT/'moon-sanctum-v01.glb';bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
raw=glb.read_bytes();size=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+size]);tail=raw[20+size:]
for m in data['materials']:m.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=[*SPEC['palette'][m['name'].replace('Lunar ','')],1];m['doubleSided']=True
encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);glb.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
assert glb.stat().st_size<=SPEC['budgets']['glbBytesMax'];metrics['glbBytes']=glb.stat().st_size;metrics['convexPieces']=len(pieces);metrics['textures']=[{'name':k,'width':512,'height':512} for k in images]
(ART/'model-metrics.json').write_text(json.dumps(metrics,indent=2));(ART/'material-export.json').write_text(json.dumps({'pass':True,'geometryAndImageChunkUnchanged':True,'binaryChunkSha256':hashlib.sha256(tail).hexdigest(),'materials':[m['name'] for m in data['materials']]},indent=2));(ART/'design-spec.json').write_text(json.dumps(SPEC,separators=(',',':')));(OUT/'moon-sanctum-v01.json').write_text(json.dumps(SPEC,separators=(',',':')))
for name,p in parts.items():
    for o in exports:o.hide_render=o.parent!=p
    target=Vector((0,0,1.4 if name=='MoonGuardian' else 2.4 if name=='LunarArcade' else 0));distance=6.5 if name=='MoonGuardian' else 28
    for view,a in[('front',0),('side',math.pi/2),('rear',math.pi)]:
        cam.location=target+Vector((math.sin(a)*math.cos(.25)*distance,-math.cos(a)*math.cos(.25)*distance,math.sin(.25)*distance));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(48);scene.render.filepath=str(ART/f'{name}-{view}.png');bpy.ops.render.render(write_still=True)
cz=(before['segment']['z0']+before['segment']['z1'])/2
for p in parts.values():p.location=V((0,0,cz))
for o in scene.objects:
    if o.type=='LIGHT':o.location+=V((0,0,cz))
for o in exports:o.hide_render=False
for shot in before['shots']:
    cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
print('MOON_SANCTUM '+json.dumps(metrics))
