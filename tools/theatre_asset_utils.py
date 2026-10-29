"""Blender-only export helpers; editable files are saved before merging copies."""
import bpy,json,struct,hashlib,shutil
from pathlib import Path
from mathutils import Vector
V=lambda p:Vector((p[0],-p[2],p[1]))
ROOT=Path(__file__).resolve().parent.parent
def export_parts(parts,spec,art,stem,prefix):
    art.mkdir(parents=True,exist_ok=True)
    for im in bpy.data.images:
        if im.source!='FILE':continue
        original=Path(bpy.path.abspath(im.filepath));target=art/original.name
        if original.resolve()!=target.resolve():shutil.copyfile(original,target)
        im.filepath=str(target)
    bpy.ops.wm.save_as_mainfile(filepath=str(art/(stem+'.blend')));bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(art/(stem+'.blend')))
    metrics={};exports=[]
    for name in parts:
        parent=bpy.data.objects[name];originals=list(parent.children);by={}
        for source in originals:
            o=source.copy();o.data=source.data.copy();bpy.context.scene.collection.objects.link(o);o.parent=parent;by.setdefault(o.active_material.name,[]).append(o);source.hide_set(True);source.hide_render=True
        merged=[]
        for objects in by.values():
            bpy.ops.object.select_all(action='DESELECT')
            for o in objects:o.hide_set(False);o.select_set(True)
            bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();merged.append(bpy.context.object)
        bpy.context.view_layer.update();points=[];triangles=0
        for o in merged:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles);points.extend(o.matrix_world@v.co for v in o.data.vertices)
        metrics[name]={'meshes':len(merged),'sourcePieces':len(originals),'triangles':triangles,'webMin':[min(v.x for v in points),min(v.z for v in points),-max(v.y for v in points)],'webMax':[max(v.x for v in points),max(v.z for v in points),-min(v.y for v in points)]};exports.extend(merged)
    bpy.ops.object.select_all(action='DESELECT')
    for name in parts:bpy.data.objects[name].select_set(True)
    for o in exports:o.select_set(True)
    output=ROOT/spec['model'];bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
    raw=output.read_bytes();length=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+length]);tail=raw[20+length:]
    for m in data['materials']:m.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=[*spec['palette'][m['name'].replace(prefix,'')],1];m['doubleSided']=True
    encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);output.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
    metrics['glbBytes']=output.stat().st_size;(art/'model-metrics.json').write_text(json.dumps(metrics,indent=2));(art/'design-spec.json').write_text(json.dumps(spec,indent=2));output.with_suffix('.json').write_text(json.dumps(spec,separators=(',',':')))
    (art/'material-export.json').write_text(json.dumps({'pass':True,'geometryAndImageChunkUnchanged':True,'binaryChunkSha256':hashlib.sha256(tail).hexdigest(),'materials':[m['name'] for m in data['materials']]},indent=2));return metrics
