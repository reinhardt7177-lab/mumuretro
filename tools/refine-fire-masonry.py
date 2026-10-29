"""Rebuild only authored wall courses. Preserve source files, dynamic parts and manifests."""
import bpy,bmesh,math,json,random,re,struct,hashlib
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent;A=R/'art/fire-masonry/v01';A.mkdir(parents=True,exist_ok=True)
report={}

def bounds(o):
    p=[o.matrix_world@Vector(v) for v in o.bound_box]
    return [min(v[i] for v in p) for i in range(3)],[max(v[i] for v in p) for i in range(3)]

def signatures(objects):
    return {o.name:hashlib.sha256(json.dumps({'matrix':list(v for row in o.matrix_world for v in row),'vertices':[list(v.co) for v in o.data.vertices] if o.type=='MESH' else str(o.data.splines[:]),'materials':[m.name for m in o.data.materials]},sort_keys=True).encode()).hexdigest() for o in objects if o.type=='MESH'}

def open_static(kind):
    if kind=='fracture':
        bpy.ops.wm.open_mainfile(filepath=str(R/'art/fire-paving/v01/fracture-static-v02.blend'))
        file=R/'tools/blender/export_fire_fracture_v01.py';s=file.read_text()
        scope={'bpy':bpy,'math':math,'Vector':Vector};exec(s[s.index('def bounds(o):'):s.index('# A tangent')],scope)
        return scope['pieces']['static']
    if kind=='sanctum':
        bpy.ops.wm.open_mainfile(filepath=str(R/'art/fire-paving/v01/sanctum-static-v02.blend'))
        return [o for o in bpy.context.scene.objects if o.type in ['MESH','CURVE'] and -(sum((o.matrix_world@Vector(v)).y for v in o.bound_box)/8)<-40]
    file=R/('tools/blender/build_fire_'+kind+'_v01.py');s=file.read_text();scope={'__file__':str(file)}
    # Collect the established part membership, then use the saved editable objects.
    exec(compile(s[:s.index("scene['reference']")],str(file),'exec'),scope)
    names=[o.name for o in scope['parts']['static']]
    bpy.ops.wm.open_mainfile(filepath=str(R/('art/fire-temple/'+kind+'-v01/'+kind+'-v01.blend')))
    assert all(n in bpy.data.objects for n in names)
    return [bpy.data.objects[n] for n in names]

def make_materials():
    rng=random.Random(242026);im=bpy.data.images.new('Fire masonry basalt grain',256,256);pixels=[]
    def h(x,y):return ((x*374761393+y*668265263+12345)^((x+y)*1274126177))%65536/65535-.5
    def noise(x,y,s):
        x/=s;y/=s;ix=math.floor(x);iy=math.floor(y);a=x-ix;b=y-iy;a=a*a*(3-2*a);b=b*b*(3-2*b)
        return (h(ix,iy)*(1-a)+h(ix+1,iy)*a)*(1-b)+(h(ix,iy+1)*(1-a)+h(ix+1,iy+1)*a)*b
    for y in range(256):
        for x in range(256):
            q=.47+noise(x,y,43)*.035+noise(x,y,10)*.022+rng.uniform(-.009,.009);pixels.extend([q*.92,q*.98,q*1.03,1])
    im.pixels=pixels;im.filepath_raw=str(A/'basalt-wall-grain.png');im.file_format='PNG';im.save();im.pack()
    m=bpy.data.materials.new('Fire coursed basalt');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.9
    t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    # Vertex colours provide slight stone-to-stone value changes with one material.
    c=m.node_tree.nodes.new('ShaderNodeVertexColor');c.layer_name='Color';mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
    m.node_tree.links.new(t.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(c.outputs['Color'],mix.inputs[2]);m.node_tree.links.new(mix.outputs[0],p.inputs['Base Color'])
    mortar=bpy.data.materials.new('Fire recessed mortar');mortar.use_nodes=True;q=mortar.node_tree.nodes.get('Principled BSDF');q.inputs['Base Color'].default_value=(.075,.092,.105,1);q.inputs['Roughness'].default_value=.94
    return m,mortar

def stone(name,lo,hi,mat,shade,axis):
    verts=[(x,y,z) for x in [lo[0],hi[0]] for y in [lo[1],hi[1]] for z in [lo[2],hi[2]]]
    faces=[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bmesh.ops.bevel(bm,geom=list(bm.edges),offset=.018,segments=2,affect='EDGES');bm.to_mesh(me);bm.free();me.update()
    uv=me.uv_layers.new();colour=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for loop in me.loops:
        v=me.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(v[axis]*.38+shade*4,v.z*.38);colour.data[loop.index].color=(shade,shade,shade,1)
    me.color_attributes.active_color=colour;me.color_attributes.render_color_index=0
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(mat);return o

def rebuild(kind,targets):
    bpy.context.view_layer.update();stoneMat,mortar=make_materials();rng=random.Random(242026)
    cores=[o for o in targets if re.search(r' core(?:\.\d+)?$',o.name)]
    original=[o for o in targets if ' ashlar' in o.name];expected=len(original);groups=[];assigned=set();created=[]
    for core in cores:
        lo,hi=bounds(core);axis=0 if hi[0]-lo[0]>hi[1]-lo[1] else 1;th=1-axis;prefix=core.name.split(' core')[0];old=[]
        for o in original:
            if o.name in assigned or not o.name.startswith(prefix+' ashlar'):continue
            a,b=bounds(o);c=[(u+v)/2 for u,v in zip(a,b)]
            if all(lo[i]-.001<=c[i]<=hi[i]+.001 for i in range(3)):old.append(o);assigned.add(o.name)
        if not old:continue
        levels=sorted(set(round((bounds(o)[0][2]+bounds(o)[1][2])/2,4) for o in old));courses=len(levels)
        length=hi[axis]-lo[axis];height=hi[2]-lo[2];count=round(length/2.8);count=max(1,count);step=length/count;ch=height/courses
        inner=(lo[th]+hi[th])/2;thickness=hi[th]-lo[th];assert thickness>.12
        # Preserve height, length and collision extent; back only the internal core.
        inv=core.matrix_world.inverted()
        for v in core.data.vertices:
            q=core.matrix_world@v.co;q[th]=inner+(q[th]-inner)*(thickness-.12)/thickness;v.co=inv@q
        core.data.materials.clear();core.data.materials.append(mortar)
        oldNames=[o.name for o in old];new=[]
        for j in range(courses):
            cuts=[lo[axis]]+[lo[axis]+(i+(.5 if j%2 else 0))*step for i in range(0 if j%2 else 1,count+1) if lo[axis]+.001<lo[axis]+(i+(.5 if j%2 else 0))*step<hi[axis]-.001]+[hi[axis]]
            cuts=sorted(set(cuts))
            for i,(start,end) in enumerate(zip(cuts,cuts[1:])):
                a=lo.copy();b=hi.copy();a[axis]=start+.012;b[axis]=end-.012;a[2]=lo[2]+j*ch+.0125;b[2]=lo[2]+(j+1)*ch-.0125;a[th]=lo[th]-.015;b[th]=hi[th]+.015
                o=stone('Masonry '+core.name+' course '+str(j)+' stone '+str(i),a,b,stoneMat,rng.uniform(.88,1.03),axis);targets.append(o);created.append(o);new.append(o.name)
        for o in old:targets.remove(o);original.remove(o);bpy.data.objects.remove(o,do_unlink=True)
        groups.append({'core':core.name,'axis':axis,'thicknessAxis':th,'originalMin':lo,'originalMax':hi,'coreRecess':.06,'bevel':.018,'verticalJoint':.024,'horizontalJoint':.025,'courses':courses,'step':step,'removed':oldNames,'stones':new})
    assert groups and len(assigned)==expected and not original,(kind,len(assigned),expected)
    return groups,created

def export(kind,targets,groups):
    bpy.context.view_layer.update();stem=kind+'-static-v03';bpy.ops.wm.save_as_mainfile(filepath=str(A/(stem+'.blend')))
    deps=bpy.context.evaluated_depsgraph_get();batches={};tris=0
    for source in targets:
        ev=source.evaluated_get(deps);me=bpy.data.meshes.new_from_object(ev);o=bpy.data.objects.new('Export '+source.name,me);bpy.context.collection.objects.link(o);o.matrix_world=source.matrix_world.copy();batches.setdefault(o.active_material.name,[]).append(o)
    merged=[]
    for mat,items in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in items:o.select_set(True)
        bpy.context.view_layer.objects.active=items[0]
        if len(items)>1:bpy.ops.object.join()
        o=items[0];o.name=stem+' '+mat;o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles);merged.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in merged:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(A/(stem+'.glb')),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False)
    # Blender's exporter creates a white generic COLOR_0 while the authored
    # multiplication colour lands in COLOR_1. Bind the actual data to glTF's
    # supported primary colour without changing any geometry/image buffer.
    output=A/(stem+'.glb');raw=output.read_bytes();length=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+length]);tail=raw[20+length:];fixed=0
    for mesh in j['meshes']:
        for p in mesh['primitives']:
            if j['materials'][p['material']]['name']=='Fire coursed basalt':
                assert 'COLOR_1' in p['attributes'];p['attributes']['COLOR_0']=p['attributes'].pop('COLOR_1');fixed+=1
    encoded=json.dumps(j,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);output.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
    assert fixed==1
    return {'walls':len(groups),'sourcePieces':len(targets),'meshes':len(merged),'triangles':tris,'bytes':output.stat().st_size,'primaryColorBindingsFixed':fixed,'geometryImageChunkSha256':hashlib.sha256(tail).hexdigest(),'groups':groups}

for kind in ['fracture','foundry','steam','sanctum']:
    targets=open_static(kind);before=signatures(targets);groups,created=rebuild(kind,targets);changed=set(n for g in groups for n in [g['core'],*g['removed']]);untouched={n:h for n,h in before.items() if n not in changed};after=signatures(targets);assert all(after[n]==h for n,h in untouched.items())
    report[kind]=export(kind,targets,groups);report[kind]['unchangedGeometry']={'count':len(untouched),'sha256':hashlib.sha256(json.dumps(untouched,sort_keys=True).encode()).hexdigest(),'pass':True};print('MASONRY_EXPORT',kind,len(groups),len(created),flush=True)
(A/'metrics.json').write_text(json.dumps(report,indent=2));print('MASONRY_READY',flush=True)
