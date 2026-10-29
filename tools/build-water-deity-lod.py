"""Geometry-only detail levels of our approved water deity; original bytes stay intact."""
import bpy,bmesh,json,math,struct,hashlib,random
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/water-render/v01';ART.mkdir(parents=True,exist_ok=True);TEX=ART/'textures';TEX.mkdir(exist_ok=True)
SOURCE=ROOT/'assets/models/heritage/water-deity.glb';raw=SOURCE.read_bytes();source_hash=hashlib.sha256(raw).hexdigest();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);binary=raw[28+length:]
extracted={}
for i,image in enumerate(doc.get('images',[])):
    view=doc['bufferViews'][image['bufferView']];start=view.get('byteOffset',0);suffix='.jpg' if image.get('mimeType')=='image/jpeg' else '.png';file=TEX/(str(i)+suffix);file.write_bytes(binary[start:start+view['byteLength']]);extracted[image.get('name','Image_'+str(i))]=file
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;bpy.ops.import_scene.gltf(filepath=str(SOURCE));objects=[o for o in scene.objects if o.type=='MESH'];assert len(objects)==1
original=objects[0];original.name='Original water deity reference';original.data.transform(original.matrix_world);original.parent=None;original.matrix_world=Matrix.Identity(4)
for material in original.data.materials:
    if not material.use_nodes:continue
    for node in material.node_tree.nodes:
        if node.type!='TEX_IMAGE' or not node.image:continue
        name=node.image.name
        if name not in extracted:raise RuntimeError('Unresolved source image '+name)
        old_space=node.image.colorspace_settings.name;image=bpy.data.images.load(str(extracted[name]),check_existing=True);image.colorspace_settings.name=old_space;assert min(image.size)>0;image.pack();node.image=image
original.data.calc_loop_triangles();original_triangles=len(original.data.loop_triangles);assert original_triangles==147977
bottom=min(v.co.z for v in original.data.vertices);top=max(v.co.z for v in original.data.vertices);assert abs(bottom)<.001 and abs(top-3.3)<.001
original_bvh=BVHTree.FromPolygons([v.co.copy() for v in original.data.vertices],[tuple(t.vertices) for t in original.data.loop_triangles],all_triangles=True)
variants=[]
def sampled_error(a,bvh):
    a.calc_loop_triangles();distances=[];worst=None
    for v in a.vertices:
        found=bvh.find_nearest(v.co);assert found is not None;distance=found[3];distances.append(distance)
        if worst is None or distance>worst[0]:worst=(distance,list(v.co))
    for i,t in enumerate(a.loop_triangles):
        if i%3:continue
        point=sum((a.vertices[k].co for k in t.vertices),Vector())/3;found=bvh.find_nearest(point);distance=found[3];distances.append(distance)
        if distance>worst[0]:worst=(distance,list(point))
    distances.sort();return{'samples':len(distances),'maximum':distances[-1],'p95':distances[int(len(distances)*.95)],'p99':distances[int(len(distances)*.99)],'worstPoint':worst[1]}
base=original.data.copy();bm=bmesh.new();bm.from_mesh(base);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bm.to_mesh(base);bm.free();base.validate(clean_customdata=False);base.update()
neighbors=[set() for _ in base.vertices]
for edge in base.edges:
    a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
for name,ratio,limit,tolerance in [('Medium',.28,160,.018),('Far',.16,64,.04)]:
    pins={v.index for v in base.vertices if v.co.z<.02 or v.co.z>top-.02};attempts=[]
    for attempt in range(5):
        low=original.copy();low.data=base.copy();scene.collection.objects.link(low);low.name='WaterDeity'+name
        group=low.vertex_groups.new(name='Allow collapse outside measured detail');group.add(list(range(len(base.vertices))),1,'REPLACE')
        if pins:group.add(list(pins),0,'REPLACE')
        modifier=low.modifiers.new('Preserved source collapse ratio','DECIMATE');modifier.ratio=ratio;modifier.use_collapse_triangulate=True;modifier.vertex_group=group.name;modifier.vertex_group_factor=1000;bpy.context.view_layer.objects.active=low;bpy.ops.object.modifier_apply(modifier=modifier.name)
        low.data.validate(clean_customdata=False);low.data.update();low.data.calc_loop_triangles();trial_bvh=BVHTree.FromPolygons([v.co for v in low.data.vertices],[tuple(t.vertices) for t in low.data.loop_triangles],all_triangles=True)
        distances=[trial_bvh.find_nearest(v.co)[3] for v in base.vertices];bad={i for i,d in enumerate(distances) if d>tolerance}
        attempts.append({'attempt':attempt,'pins':len(pins),'triangles':len(low.data.loop_triangles),'maxVertexError':max(distances),'badVertices':len(bad)})
        if not bad or attempt==4:break
        for _ in range(3):bad|={j for i in list(bad) for j in neighbors[i]}
        pins|=bad;bpy.data.objects.remove(low,do_unlink=True)
    # Preserve authored bottom/top contacts instead of fitting a new scale per LOD.
    for vertex in low.data.vertices:
        if vertex.co.z<.002:vertex.co.z=0
        elif vertex.co.z>top-.002:vertex.co.z=top
    low.data.update();low.data.calc_loop_triangles();assert low.data.uv_layers.active and len(low.data.loop_triangles)<65000
    assert abs(min(v.co.z for v in low.data.vertices))<1e-6 and abs(max(v.co.z for v in low.data.vertices)-top)<1e-6
    bvh=BVHTree.FromPolygons([v.co.copy() for v in low.data.vertices],[tuple(t.vertices) for t in low.data.loop_triangles],all_triangles=True)
    forward=sampled_error(original.data,bvh);backward=sampled_error(low.data,original_bvh);error=max(forward['maximum'],backward['maximum'])
    # This is a sampled metric with a margin, not a proven Hausdorff bound.
    measured_limit=min(limit,1.25*3.3/max(error,1e-8)/1.21)
    variants.append({'name':low.name,'object':low,'ratio':ratio,'triangles':len(low.data.loop_triangles),'sourceVertices':len(low.data.vertices),'maxPixels':round(measured_limit,3),'requestedMaxPixels':limit,'hysteresis':.1,'sampledErrorSourceUnits':error,'forward':forward,'backward':backward,'preservationAttempts':attempts})
    print('LOD_VARIANT '+json.dumps({k:v for k,v in variants[-1].items() if k!='object'}),flush=True)
spec={'model':'assets/models/adventure/water-deity-lod-v01.glb','original':'assets/models/heritage/water-deity.glb','originalSha256':source_hash,'originalTriangles':original_triangles,'sourceHeight':3.3,'gameHeight':4.7,'reuseOriginalPbrMaterial':True,'variants':[{k:v for k,v in x.items() if k!='object'} for x in variants],'originalRuntimeExecuted':False}
# Export disposable copies with a1px placeholder to retain TEXCOORD_0. The web
# binds the original material; no duplicate deity textures are shipped.
dummy=bpy.data.materials.new('Runtime reuses original PBR');dummy.use_nodes=True;white=bpy.data.images.new('UV exporter placeholder',width=1,height=1);white.pixels[:]=[1,1,1,1];tex=dummy.node_tree.nodes.new('ShaderNodeTexImage');tex.image=white;dummy.node_tree.links.new(tex.outputs['Color'],dummy.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
copies=[]
for row in variants:
    obj=row['object'].copy();obj.data=row['object'].data.copy();scene.collection.objects.link(obj);obj.name=row['name']+' export';obj.data.materials.clear();obj.data.materials.append(dummy);copies.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for obj in copies:obj.select_set(True)
out=ROOT/spec['model'];bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_texcoords=True)
packed=out.read_bytes();size=struct.unpack_from('<I',packed,12)[0];data=json.loads(packed[20:20+size]);tail=packed[20+size:]
for i,node in enumerate(data['nodes']):
    for row in variants:
        if node.get('name')==row['name']+' export':node['name']=row['name']
for mesh in data['meshes']:
    for primitive in mesh['primitives']:
        assert 'TEXCOORD_0' in primitive['attributes'] and 'NORMAL' in primitive['attributes'];primitive['material']=0
data['materials']=[{'name':'Runtime reuses original water deity PBR','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1]}}]
for key in ['images','textures','samplers']:data.pop(key,None)
encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);out.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
for obj in copies:bpy.data.objects.remove(obj,do_unlink=True)
spec['glbBytes']=out.stat().st_size;assert spec['glbBytes']<6000000;assert SOURCE.read_bytes()==raw
out.with_suffix('.json').write_text(json.dumps(spec,separators=(',',':')));(ART/'lod-metrics.json').write_text(json.dumps(spec,indent=2))
scene.world=bpy.data.worlds.new('Deity detail study');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.065,.11,.14,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
for pos,power,size in [((4,-6,7),1800,7),((-5,3,5),1000,6)]:
    bpy.ops.object.light_add(type='AREA',location=pos);obj=bpy.context.object;obj.data.energy=power;obj.data.size=size;obj.rotation_euler=(Vector((0,0,1.65))-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';cam.data.angle=math.radians(62);scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1024;scene.render.resolution_y=768
all_models=[original,*[v['object'] for v in variants]]
for view,yaw in [('front',0),('side',math.pi/2),('rear',math.pi)]:
    cam.location=Vector((math.sin(yaw)*15,-math.cos(yaw)*15,2.8));cam.rotation_euler=(Vector((0,0,1.65))-cam.location).to_track_quat('-Z','Y').to_euler()
    for obj in all_models:
        for other in all_models:other.hide_render=other!=obj
        scene.render.filepath=str(ART/('goal-'+view+'-'+('original' if obj==original else obj.name)+'.png'));bpy.ops.render.render(write_still=True)
for i,obj in enumerate(all_models):obj.hide_render=False;obj.location.x=(i-1)*3.5
cam.location=(0,-12,5.5);cam.rotation_euler=(Vector((0,0,1.65))-cam.location).to_track_quat('-Z','Y').to_euler();bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'water-deity-lod-v01.blend'))
print('PASS deity detail geometry,original bytes preserved '+json.dumps({'triangles':[original_triangles,*[x['triangles'] for x in variants]],'bytes':spec['glbBytes']}),flush=True)
