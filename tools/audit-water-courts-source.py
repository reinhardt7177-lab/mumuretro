"""Read-only audit of the editable water courts, distinct from web runtime tests."""
import bpy,json,math,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/water-courts/v01';OUT=ROOT/'reports/2026-10-23/evidence/water-courts'
source_hash=hashlib.sha256((ART/'water-courts-v01.blend').read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(ART/'water-courts-v01.blend'))
# Hidden source collections may retain unevaluated matrices after reopening.
# Evaluate all pieces in memory; never save these inspection visibility changes.
for collection in bpy.data.collections:collection.hide_viewport=False
for o in bpy.data.objects:o.hide_set(False)
bpy.context.view_layer.update()
spec=json.loads((ART/'design-spec.json').read_text());metrics=json.loads((ART/'model-metrics.json').read_text());rows=[]
for room in spec['rooms']:
    for name in [room['shell'],room['floor'],room['glacier']]:
        p=bpy.data.objects.get(name);assert p and p.type=='EMPTY',name;pieces=[o for o in p.children if o.type=='MESH'];triangles=0
        for o in pieces:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
        assert len(pieces)==metrics[name]['sourcePieces'],name+' editable count';assert triangles==metrics[name]['triangles'],name+' unmerged triangles';assert all(abs(n)<1e-8 for n in p.location),name+' local origin'
        rows.append({'name':name,'editablePieces':len(pieces),'triangles':triangles,'matchesExport':True})
images=[]
for image in bpy.data.images:
    if image.source!='FILE':continue
    path=Path(bpy.path.abspath(image.filepath));assert image.filepath.startswith('//') and path.is_file(),image.filepath;assert tuple(image.size)==(512,512),image.name
    images.append({'name':image.name,'path':image.filepath,'size':list(image.size),'colourSpace':image.colorspace_settings.name})
assert len(images)==4
feet=[]
for o in bpy.data.objects:
    if o.type!='MESH' or not o.name.startswith('Grounded carved pedestal'):continue
    points=[o.matrix_world@v.co for v in o.data.vertices];low=min(v.z for v in points);assert abs(low)<.00001,o.name+' foot datum '+str(low)
    feet.append({'name':o.name,'webFloorY':low})
assert len(feet)==56
assert len([o for o in bpy.data.objects if o.type=='MESH'])==sum(v['editablePieces'] for v in rows),'disposable merged copies removed'
assert len(spec['rooms'])==4 and all(r['portalClearWidth']>=5 for r in spec['rooms'])
assert [v['y'] for v in spec['rooms'][2]['floorAreas']]==[0,0,-5]
assert source_hash==hashlib.sha256((ART/'water-courts-v01.blend').read_bytes()).hexdigest()
report={'pass':True,'readOnly':True,'sourceFileModified':False,'sourceFileSha256':source_hash,'rooms':4,'parts':rows,'editablePieces':sum(v['editablePieces'] for v in rows),'triangles':sum(v['triangles'] for v in rows),'webMeshes':sum(v['meshes'] for v in metrics.values() if isinstance(v,dict)),'glbBytes':metrics['glbBytes'],'images':images,'groundedFeet':feet,'originalRuntimeExecuted':False}
OUT.mkdir(parents=True,exist_ok=True);(OUT/'source-audit.json').write_text(json.dumps(report,indent=2));print('PASS editable water source '+json.dumps({k:report[k] for k in ['editablePieces','triangles','webMeshes','glbBytes']}))
