"""Independent inspection of saved editable source and raw exported GLB."""
import bpy, json, math, struct, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; ART=ROOT/'art/world-horizon/v01'; B=ROOT/'reports/2026-10-26/evidence/world-horizon'
bpy.ops.wm.open_mainfile(filepath=str(ART/'world-horizon-v03.blend'))
checks=[]
def check(name,condition,details=None):
    checks.append({'name':name,'pass':bool(condition),'details':details})
    if not condition: raise AssertionError(name)
try:
    pieces=list(bpy.data.collections['EDITABLE_MASSIFS'].objects); exports=list(bpy.data.collections['WEB_EXPORT'].objects)
    check('18 separate editable cliff volumes and three merged game meshes exist',len(pieces)==18 and len(exports)==3,{'editable':len(pieces),'export':len(exports)})
    floors=[min(v.co.z for v in o.data.vertices) for o in pieces]
    check('every editable massif has local floor zero and finite coordinates',all(abs(y)<1e-6 for y in floors) and all(math.isfinite(v) for o in pieces for p in o.data.vertices for v in p.co),floors)
    blob=(ART/'exports/world-horizon-v03.glb').read_bytes(); length,kind=struct.unpack_from('<II',blob,12); doc=json.loads(blob[20:20+length]); rows=json.loads((ART/'exports/world-horizon-v03.json').read_text())['meshes']
    primitives=[p for m in doc['meshes'] for p in m['primitives']]
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for p in primitives)
    check('web GLB has exactly three meshes, one material and the recorded triangles',len(doc['meshes'])==3 and len(doc['materials'])==1 and triangles==sum(r['triangles'] for r in rows),{'meshes':len(doc['meshes']),'materials':len(doc['materials']),'triangles':triangles,'bytes':len(blob)})
    check('every web surface exports normals and vertex tone',all('NORMAL' in p['attributes'] and 'COLOR_0' in p['attributes'] for p in primitives))
    check('source merged mesh triangle counts match web output',sum(len(o.data.loop_triangles) or (o.data.calc_loop_triangles() or len(o.data.loop_triangles)) for o in exports)==triangles)
    check('no backdrop geometry is a walking or camera collider',json.loads((ART/'exports/world-horizon-v03.json').read_text())['collisionMeshes']==0)
    result={'pass':True,'checks':checks,'source':str(ART/'world-horizon-v03.blend'),'sha256':hashlib.sha256(blob).hexdigest()}
except Exception as error:
    result={'pass':False,'checks':checks,'error':repr(error)}
    raise
finally:
    (B/'blender-audit.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
