"""Copy the editable v01 courts, correct the rear portal, preserve all v01 files."""
import bpy,json,shutil,struct,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;OLD=ROOT/'art/moon-courts/v01';ART=ROOT/'art/moon-courts/v02';OUT=ROOT/'assets/models/adventure';ART.mkdir(parents=True,exist_ok=True);V=lambda p:Vector((p[0],-p[2],p[1]))
spec=json.loads((OLD/'design-spec.json').read_text());spec['model']='assets/models/adventure/moon-courts-v02.glb';spec['revision']={'source':'v01','rearPortalShift':-.20,'rearApronExtension':.25,'screenAndOpticsUnchanged':True}
bpy.ops.wm.open_mainfile(filepath=str(OLD/'moon-courts-v01.blend'));bpy.context.view_layer.update();source_sha=hashlib.sha256((OLD/'moon-courts-v01.blend').read_bytes()).hexdigest();shifted=[]
for o in bpy.data.objects['PanelCourt'].children:
    vertices=[o.matrix_world@v.co for v in o.data.vertices];center=sum(vertices,Vector())/len(vertices);x,z=center.x,-center.y
    if z< -5.65 and abs(x)<6.5:o.location+=V((0,0,-.2));shifted.append(o.name)
assert len(shifted)>45 and len(shifted)<90,len(shifted)
for o in bpy.data.objects['PanelFloor'].children:
    matrix=o.matrix_world.copy();inverse=matrix.inverted()
    for v in o.data.vertices:
        p=matrix@v.co;z=-p.y
        if z< -6.00001:p.y+=.25;v.co=inverse@p
count=0
for v in spec['rooms'][2]['solids']:
    if abs(v['position'][2]+6.1)<1e-5:v['position'][2]-=.20;count+=1
assert count==10,count
for im in bpy.data.images:
    if im.source!='FILE':continue
    original=Path(bpy.path.abspath(im.filepath));target=ART/original.name;shutil.copyfile(original,target);im.filepath=str(target)
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'moon-courts-v02.blend'));bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'moon-courts-v02.blend'))
parts={v:bpy.data.objects[v] for r in spec['rooms'] for v in[r['shell'],r['floor']]};originals={k:list(p.children) for k,p in parts.items()};metrics={};exports=[]
for name,p in parts.items():
    by={}
    for source in originals[name]:
        o=source.copy();o.data=source.data.copy();bpy.context.scene.collection.objects.link(o);o.parent=p;by.setdefault(o.active_material.name,[]).append(o);source.hide_set(True);source.hide_render=True
    merged=[]
    for key,objects in by.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.hide_set(False);o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name+' '+key;merged.append(o)
    bpy.context.view_layer.update();points=[];tris=0
    for o in merged:o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles);points.extend(o.matrix_world@v.co for v in o.data.vertices)
    metrics[name]={'meshes':len(merged),'sourcePieces':len(originals[name]),'triangles':tris,'webMin':[min(v.x for v in points),min(v.z for v in points),-max(v.y for v in points)],'webMax':[max(v.x for v in points),max(v.z for v in points),-min(v.y for v in points)]};exports.extend(merged)
assert abs(metrics['PanelFloor']['webMin'][2]+6.9)<1e-4
bpy.ops.object.select_all(action='DESELECT')
for p in parts.values():p.select_set(True)
for o in exports:o.select_set(True)
glb=OUT/'moon-courts-v02.glb';bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
raw=glb.read_bytes();length=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+length]);tail=raw[20+length:]
for m in data['materials']:m.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=[*spec['palette'][m['name'].replace('Courts ','')],1];m['doubleSided']=True
encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);glb.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail);metrics['glbBytes']=glb.stat().st_size
(ART/'design-spec.json').write_text(json.dumps(spec,indent=2));(OUT/'moon-courts-v02.json').write_text(json.dumps(spec,separators=(',',':')));(ART/'model-metrics.json').write_text(json.dumps(metrics,indent=2));(ART/'material-export.json').write_text(json.dumps({'pass':True,'geometryAndImageChunkUnchanged':True,'binaryChunkSha256':hashlib.sha256(tail).hexdigest(),'materials':[m['name'] for m in data['materials']]},indent=2))
assert source_sha==hashlib.sha256((OLD/'moon-courts-v01.blend').read_bytes()).hexdigest()
(ART/'correction.json').write_text(json.dumps({'pass':True,'sourceUnchanged':True,'sourceSha256':source_sha,'shiftedSourceObjects':shifted,'shiftedSolidBoxes':count,'rearPortalShift':-.20,'rearApronExtension':.25},indent=2));print('PASS corrected surround '+json.dumps(metrics))
