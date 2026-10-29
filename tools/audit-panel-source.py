import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/panel-workshop/v01'
source=ART/'panel-workshop-v01.blend';before=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
spec=json.loads((ART/'design-spec.json').read_text());metrics=json.loads((ART/'model-metrics.json').read_text());parts={}
assert spec==json.loads((ROOT/'assets/models/adventure/panel-workshop-v01.json').read_text())
for name in spec['parts']:
    p=bpy.data.objects[name];children=[o for o in p.children if o.type=='MESH'];assert len(children)==metrics[name]['sourcePieces'];parts[name]={'sourcePieces':len(children)}
assert sum(p['sourcePieces'] for p in parts.values())==125
textures=[]
for im in bpy.data.images:
    if im.source!='FILE':continue
    r={'name':im.name,'path':im.filepath,'size':list(im.size),'exists':Path(bpy.path.abspath(im.filepath)).is_file()}
    assert r['exists'] and r['path'].startswith('//') and r['size']==[512,512];textures.append(r)
assert len(textures)==2
assert list(bpy.data.objects['PushBar']['leftGrip'])==[-.12,0,.035]
assert list(bpy.data.objects['ObservationPlaque']['labelPosition'])==[0,1.35,.111]
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
report={'pass':True,'parts':parts,'textures':textures,'sourceModified':False,'sourceSha256':before,'placementSpecMatchesRuntime':True}
(ART/'source-open.json').write_text(json.dumps(report,indent=2));print('PASS editable125pieces,fiveparts,two relative512px textures,and preserved source')
