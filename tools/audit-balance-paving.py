"""Reopen both editable files independently and measure actual mesh vertices."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent;A=R/'art/balance-paving/v01';out={'checks':[]}
def check(name,passed,details):out['checks'].append({'name':name,'pass':bool(passed),'details':details});assert passed,(name,details)
def fingerprints():
    result={}
    for o in bpy.context.scene.objects:
        if o.type not in ['MESH','CURVE']:continue
        coords=[tuple(v.co) for v in o.data.vertices] if o.type=='MESH' else [[tuple(p.co) for p in s.points] for s in o.data.splines]
        result[o.name]=hashlib.sha256(repr((tuple(tuple(row) for row in o.matrix_world),coords,[m.name for m in o.data.materials])).encode()).hexdigest()
    return result
bpy.ops.wm.open_mainfile(filepath=str(R/'art/balance-temple/balance-temple-v04.blend'));old=fingerprints()
bpy.ops.wm.open_mainfile(filepath=str(A/'balance-temple-v05.blend'));current=fingerprints();removed=set(json.loads((A/'metrics.json').read_text())['removedNames'])
check('all non-floor editable geometry and materials match original',all(current.get(n)==sha for n,sha in old.items() if n not in removed),{'objects':len(old)-len(removed)})
check('old floor tiles and64 decorative objects are absent',len(removed)==331 and all(n not in bpy.data.objects for n in removed),{'removed':len(removed)})
tiles=[o for o in bpy.context.scene.objects if o.name.startswith('Balance paving hall_')];heights=[]
for o in tiles:
    points=[o.matrix_world@v.co for v in o.data.vertices];heights.append({'name':o.name,'top':max(v.z for v in points),'bottom':min(v.z for v in points)})
check('324 actual stone meshes have top0 and bottom minus0.09',len(tiles)==324 and all(abs(v['top'])<1e-5 and abs(v['bottom']+.09)<1e-5 for v in heights),{'tiles':len(tiles),'top':max(v['top'] for v in heights),'bottom':min(v['bottom'] for v in heights)})
foundations=[o for o in bpy.context.scene.objects if o.name.startswith('Paving foundation ')];bounds=[]
for o in foundations:
    p=[o.matrix_world@v.co for v in o.data.vertices];bounds.append({'name':o.name,'top':max(v.z for v in p),'bottom':min(v.z for v in p)})
check('five foundations stay below the visible floor',len(foundations)==5 and all(abs(v['top']+.045)<1e-5 and abs(v['bottom']+.3)<1e-5 for v in bounds),bounds)
corridor=[o for o in tiles if o.parent.name=='hall_corridor'];p=[o.matrix_world@v.co for o in corridor for v in o.data.vertices]
check('corridor slabs cover the full5 metre width',abs(min(v.x for v in p)+2.49)<1e-5 and abs(max(v.x for v in p)-2.49)<1e-5,{'minX':min(v.x for v in p),'maxX':max(v.x for v in p)})
image=bpy.data.images.get('Balance paving fine limestone');check('floor grain image is packed at256px',image is not None and list(image.size)==[256,256] and image.packed_file is not None,{'size':list(image.size) if image else None})
out['pass']=all(v['pass'] for v in out['checks']);(A/'source-audit.json').write_text(json.dumps(out,indent=2));print('BALANCE_SOURCE_AUDIT',json.dumps({'pass':out['pass'],'checks':len(out['checks'])}))
