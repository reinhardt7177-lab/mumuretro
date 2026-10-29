import bpy,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent;A=R/'art/balance-paving/v01';A.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(R/'art/balance-temple/balance-temple-v04.blend'))
roots={}
for name in ['hall_order','hall_twin','hall_lever','hall_entry','hall_corridor']:
    root=bpy.data.objects[name];groups={}
    for o in root.children_recursive:
        for prefix in ['Floor tessera','Floor medallion','Path inlay','V04 compass floor index']:
            if o.name.startswith(prefix):
                p=[o.matrix_world@Vector(v) for v in o.bound_box];groups.setdefault(prefix,[]).append({'name':o.name,'type':o.type,'min':[min(v[i] for v in p) for i in range(3)],'max':[max(v[i] for v in p) for i in range(3)]})
    roots[name]=groups
(A/'diagnosis.json').write_text(json.dumps(roots,indent=2));print('BALANCE_FLOOR_SOURCE',json.dumps({n:{p:len(v) for p,v in g.items()} for n,g in roots.items()}))
