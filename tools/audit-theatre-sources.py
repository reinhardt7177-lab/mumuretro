import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
for folder,stem,images,pieces in [('art/moon-courts/v03','moon-courts-v03',4,1472),('art/twin-shadow/v02','twin-shadow-v02',2,43)]:
    art=ROOT/folder;source=art/(stem+'.blend');digest=hashlib.sha256(source.read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(source));metrics=json.loads((art/'model-metrics.json').read_text());parts={}
    for name,v in metrics.items():
        if not isinstance(v,dict):continue
        count=len([o for o in bpy.data.objects[name].children if o.type=='MESH']);assert count==v['sourcePieces'];parts[name]={'sourcePieces':count}
    textures=[]
    for im in bpy.data.images:
        if im.source!='FILE':continue
        row={'name':im.name,'path':im.filepath,'size':list(im.size),'exists':Path(bpy.path.abspath(im.filepath)).is_file()};assert row['exists'] and row['path'].startswith('//') and row['size']==[512,512];textures.append(row)
    assert len(textures)==images and sum(v['sourcePieces'] for v in parts.values())==pieces and digest==hashlib.sha256(source.read_bytes()).hexdigest()
    (art/'source-open.json').write_text(json.dumps({'pass':True,'parts':parts,'textures':textures,'sourceSha256':digest,'sourceModified':False},indent=2));print('PASS reopened '+folder)
