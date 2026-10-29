import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/water-devices/v01';file=ART/'water-devices-v01.blend';before=hashlib.sha256(file.read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(file));spec=json.loads((ART/'design-spec.json').read_text());metrics=json.loads((ART/'model-metrics.json').read_text());rows=[];used=set();bpy.context.view_layer.update()
for name in spec['parts']:
    parent=bpy.data.objects[name];points=[];triangles=0;invalid=[];inverse=parent.matrix_world.inverted()
    for obj in parent.children:
        assert obj.type=='MESH';copy=obj.data.copy()
        if copy.validate(clean_customdata=False):invalid.append(obj.name)
        obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles);points.extend(inverse@obj.matrix_world@v.co for v in obj.data.vertices);assert obj.data.uv_layers.active
        for material in obj.data.materials:
            if material.use_nodes:
                for node in material.node_tree.nodes:
                    if node.type=='TEX_IMAGE' and node.image:used.add(node.image.name)
    bounds=[[min(p.x for p in points),min(p.z for p in points),-max(p.y for p in points)],[max(p.x for p in points),max(p.z for p in points),-min(p.y for p in points)]];expected=metrics[name]
    row={'name':name,'pieces':len(parent.children),'triangles':triangles,'bounds':bounds,'invalid':invalid};rows.append(row);assert not invalid and row['pieces']==expected['sourcePieces'] and triangles==expected['triangles'];assert all(abs(bounds[i][j]-expected['webMin' if i==0 else 'webMax'][j])<1e-5 for i in range(2) for j in range(3))
textures=[]
for name in sorted(used):
    image=bpy.data.images[name];assert list(image.size)==[512,512] and image.filepath.startswith('//');textures.append({'name':name,'size':list(image.size),'path':image.filepath})
report={'pass':True,'rows':rows,'textures':textures,'sourceSha256':before,'sourceUnchanged':hashlib.sha256(file.read_bytes()).hexdigest()==before,'prototypeTriangles':sum(r['triangles'] for r in rows),'sourcePieces':sum(r['pieces'] for r in rows),'webMeshes':sum(v['meshes'] for v in metrics.values() if isinstance(v,dict)),'glbBytes':metrics['glbBytes']};assert report['sourceUnchanged'];(ROOT/'reports/2026-10-23/evidence/water-devices/source-audit.json').write_text(json.dumps(report,indent=2));print('PASS editable device source12 templates,ground/UV/geometry/512px texture and source hash unchanged '+json.dumps({'triangles':report['prototypeTriangles'],'pieces':report['sourcePieces'],'meshes':report['webMeshes'],'bytes':report['glbBytes']}))
