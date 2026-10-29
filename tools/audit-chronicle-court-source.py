"""Independent reopen/source bounds and decoded GLB audit; never saves the source."""
import bpy,json,hashlib,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;A=ROOT/'art/chronicle-court/v01';B=ROOT/'reports/2026-10-23/evidence/chronicle-court';file=A/'chronicle-court-v01.blend';digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();original=digest(file)
metrics=json.loads((A/'model-metrics.json').read_text());report={'rows':[],'textures':[]}
bpy.ops.wm.open_mainfile(filepath=str(file))
for name in ['MemoryArcade','MemoryFloor','OfferingPedestal']:
    root=bpy.data.objects[name];root.location=(0,0,0);bpy.context.view_layer.update();points=[];triangles=0;invalid=[];feet=[];cores=[]
    for o in root.children:
        if o.type!='MESH':continue
        o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
        if not o.data.uv_layers:invalid.append(o.name+' noUV')
        if o.data.validate(verbose=False,clean_customdata=False):invalid.append(o.name+' invalidMesh')
        if o.name.startswith('Grounded pier footing'):feet.append(min((o.matrix_world@v.co).z for v in o.data.vertices))
        if o.name.startswith('Continuous pier mortar core'):cores.append([min((o.matrix_world@v.co).z for v in o.data.vertices),max((o.matrix_world@v.co).z for v in o.data.vertices)])
        for vertex in o.data.vertices:
            p=o.matrix_world@vertex.co;points.append((p.x,p.z,-p.y))
    low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)];expected=metrics[name]
    assert not invalid and len(root.children)==expected['sourcePieces'] and triangles==expected['triangles']
    assert all(abs(v-w)<1e-5 for actual,key in [(low,'webMin'),(high,'webMax')] for v,w in zip(actual,expected[key]))
    if name=='MemoryArcade':assert len(feet)==10 and all(abs(v)<1e-6 for v in feet) and len(cores)==10 and all(v[0]<.46 and v[1]>9.05 for v in cores)
    report['rows'].append({'name':name,'pieces':len(root.children),'triangles':triangles,'bounds':[low,high],'invalid':invalid,'feet':feet,'continuousCores':cores})
for name in ['stone-albedo','stone-normal','floor-albedo','floor-normal']:
    im=next(i for i in bpy.data.images if i.name==name+'.png');assert list(im.size)==[512,512] and im.filepath.startswith('//');report['textures'].append({'name':im.name,'size':list(im.size),'path':im.filepath})
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/adventure/chronicle-court-v01.glb'))
report['decoded']=[]
for name in ['MemoryArcade','MemoryFloor','OfferingPedestal']:
    root=bpy.data.objects[name];bpy.context.view_layer.update();points=[];triangles=0
    for o in root.children:
        o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
        for vertex in o.data.vertices:
            p=o.matrix_world@vertex.co;points.append((p.x,p.z,-p.y))
    low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)];expected=metrics[name]
    assert len(root.children)==expected['meshes'] and triangles==expected['triangles'] and all(abs(v-w)<1e-5 for actual,key in [(low,'webMin'),(high,'webMax')] for v,w in zip(actual,expected[key]))
    report['decoded'].append({'name':name,'meshes':len(root.children),'triangles':triangles,'bounds':[low,high]})
report.update({'pass':True,'sourceSha256':original,'sourceUnchanged':digest(file)==original,'sourcePieces':sum(v['pieces'] for v in report['rows']),'webMeshes':sum(v['meshes'] for v in report['decoded']),'prototypeTriangles':sum(v['triangles'] for v in report['decoded']),'glbBytes':(ROOT/'assets/models/adventure/chronicle-court-v01.glb').stat().st_size})
assert report['sourceUnchanged'];(B/'source-audit.json').write_text(json.dumps(report,indent=2));print('PASS SOURCE '+json.dumps({k:v for k,v in report.items() if k not in ['rows','decoded','textures']}),flush=True)
