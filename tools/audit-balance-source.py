"""Read the saved editable kit again; no source or game geometry mutation."""
import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent;art=root/'art/balance-mechanisms/v01'
bpy.ops.wm.open_mainfile(filepath=str(art/'balance-mechanisms-v01.blend'))
parts={}
for name in ['OrderScale','TwinScale','LeverAssembly']:
 p=bpy.data.objects[name];m=[o for o in p.children_recursive if o.type=='MESH'];parts[name]={'meshes':len(m),'visibleOnOpen':any(not o.hide_get() for o in m)}
textures=[{'name':im.name,'path':im.filepath,'size':list(im.size),'exists':Path(bpy.path.abspath(im.filepath)).is_file()} for im in bpy.data.images if im.source=='FILE']
assert len(textures)==4 and all(t['exists'] and t['path'].startswith('//') and t['size']==[512,512] for t in textures)
assert sum(p['meshes'] for p in parts.values())==33 and parts['OrderScale']['visibleOnOpen'] and not parts['TwinScale']['visibleOnOpen']
(art/'source-open.json').write_text(json.dumps({'pass':True,'parts':parts,'textures':textures,'sourceModified':False},indent=2),encoding='utf8');print('PASS saved33-mesh kit and4 relative512px images reopen')
