import bpy,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent;B=R/'reports/2026-10-25/evidence/balance-observatory'
bpy.ops.wm.open_mainfile(filepath=str(R/'art/balance-portals/v01/balance-temple-v07.blend'))
data=[]
for name in ['hall_order','hall_twin','hall_lever','hall_entry','hall_corridor']:
 root=bpy.data.objects[name];ribs=[o for o in root.children_recursive if o.type=='MESH' and o.name.startswith('Vault rib')];points=[o.matrix_world@Vector(p)for o in ribs for p in o.bound_box];data.append({'root':name,'oldRibPieces':len(ribs),'minY':min(p.z for p in points),'maxY':max(p.z for p in points),'ribZ':sorted(set(round(-o.matrix_world.translation.y,3)for o in ribs)),'roofObjects':[o.name for o in root.children_recursive if 'roof' in o.name.lower() or 'ceiling' in o.name.lower()]})
(B/'source-inspection.json').write_text(json.dumps(data,indent=2));print('OBSERVATORY_SOURCE',json.dumps(data),flush=True)
