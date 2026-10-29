import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/moon-courts/v01'
bpy.ops.wm.open_mainfile(filepath=str(ART/'moon-courts-v01.blend'))
metrics=json.loads((ART/'model-metrics.json').read_text());parts={}
for name in ['ShadeCourt','ShadeFloor','MirrorCourt','MirrorFloor','PanelCourt','PanelFloor']:
    p=bpy.data.objects[name];children=[o for o in p.children if o.type=='MESH'];assert len(children)==metrics[name]['sourcePieces'];parts[name]={'sourcePieces':len(children)}
textures=[]
for im in bpy.data.images:
    if im.source!='FILE':continue
    r={'name':im.name,'path':im.filepath,'size':list(im.size),'exists':Path(bpy.path.abspath(im.filepath)).is_file()};assert r['exists'] and r['path'].startswith('//') and r['size']==[512,512];textures.append(r)
assert len(textures)==4
report={'pass':True,'parts':parts,'textures':textures,'sourceModified':False,'sourceSha256':hashlib.sha256((ART/'moon-courts-v01.blend').read_bytes()).hexdigest()}
(ART/'source-open.json').write_text(json.dumps(report,indent=2));print('PASS editable source parts and four relative512px textures')
