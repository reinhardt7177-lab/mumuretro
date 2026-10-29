import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;rows=[]
for folder,file,expected in [('art/twin-shadow/v01','twin-shadow-v01.blend',2),('art/moon-courts/v02','moon-courts-v02.blend',4)]:
    art=ROOT/folder;source=art/file;digest=hashlib.sha256(source.read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(source));metrics=json.loads((art/'model-metrics.json').read_text());parts={}
    for name,m in metrics.items():
        if not isinstance(m,dict):continue
        children=[o for o in bpy.data.objects[name].children if o.type=='MESH'];assert len(children)==m['sourcePieces'];parts[name]={'sourcePieces':len(children)}
    textures=[]
    for im in bpy.data.images:
        if im.source!='FILE':continue
        r={'name':im.name,'path':im.filepath,'size':list(im.size),'exists':Path(bpy.path.abspath(im.filepath)).is_file()};assert r['exists'] and r['path'].startswith('//') and r['size']==[512,512];textures.append(r)
    assert len(textures)==expected;assert digest==hashlib.sha256(source.read_bytes()).hexdigest()
    report={'pass':True,'parts':parts,'textures':textures,'sourceSha256':digest,'sourceModified':False};(art/'source-open.json').write_text(json.dumps(report,indent=2));rows.append({'folder':folder,'parts':parts,'images':len(textures)})
print('PASS editable sources '+json.dumps(rows))
