import bpy,json
from pathlib import Path
R=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(R/'art/balance-walls/v01/balance-temple-v06.blend'))
def bounds(o):
 from mathutils import Vector
 v=[o.matrix_world@Vector(p) for p in o.bound_box]
 return {'min':[min(p[i] for p in v) for i in range(3)],'max':[max(p[i] for p in v) for i in range(3)]}
print('PORTAL_SOURCE',json.dumps({name:[{'name':o.name,'type':o.type,'materials':[m.name for m in o.data.materials] if o.type in ['MESH','CURVE'] else [],'boundsNative':bounds(o) if o.type=='MESH' else None} for o in bpy.data.objects[name].children_recursive] for name in ['hall_corridor','door_leaf']}),flush=True)
