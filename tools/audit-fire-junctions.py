"""Independently reopen editable files: cuts, floor heights and preserved objects."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import closest_point_on_tri
R=Path(__file__).resolve().parent.parent;A=R/'art/fire-junctions/v01'
metrics=json.loads((A/'metrics.json').read_text());out={'checks':[],'models':{}}
def signature(o):
    return hashlib.sha256(json.dumps({'matrix':[v for row in o.matrix_world for v in row],'vertices':[list(v.co) for v in o.data.vertices],'materials':[m.name for m in o.data.materials]},sort_keys=True).encode()).hexdigest()
def check(name,value,details):
    out['checks'].append({'name':name,'pass':bool(value),'details':details});assert value,(name,details)
for kind in ['fracture','foundry']:
    bpy.ops.wm.open_mainfile(filepath=str(R/('art/fire-masonry/v01/'+kind+'-static-v03.blend')))
    prior={o.name:signature(o) for o in bpy.context.scene.objects if o.type=='MESH'}
    bpy.ops.wm.open_mainfile(filepath=str(A/(kind+'-static-v04.blend')))
    changed=set(metrics[kind]['removed'])|{r['name'] for r in metrics[kind]['trimmed']}
    unchanged=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name not in changed and o.name in prior]
    check(kind+' unchanged mesh coordinates and materials',all(signature(o)==prior[o.name] for o in unchanged),{'meshes':len(unchanged)})
    check(kind+' duplicate objects absent',all(n not in bpy.data.objects for n in metrics[kind]['removed']),metrics[kind]['removed'])
    floors=[];min_radius=99;top_error=0;count=0
    for row in metrics[kind]['trimmed']:
        o=bpy.data.objects[row['name']];o.data.calc_loop_triangles();points=[o.matrix_world@v.co for v in o.data.vertices]
        if 'paving' not in o.name:continue
        count+=1;top=max(p.z for p in points);top_error=max(top_error,abs(top))
        for t in o.data.loop_triangles:
            vs=[points[i] for i in t.vertices]
            if not all(abs(p.z)<1e-5 for p in vs):continue
            p=closest_point_on_tri(Vector((0,0,0)),*vs);min_radius=min(min_radius,math.hypot(p.x,p.y))
        floors.append({'name':o.name,'top':top,'bottom':min(p.z for p in points)})
    check(kind+' passage top outside 96-sided hub at zero height',count==10 and top_error<1e-5 and min_radius>=12*math.cos(math.pi/96)-.001,{'tiles':count,'minimumTopRadius':min_radius,'topError':top_error})
    if kind=='fracture':
        tiles=[o for o in bpy.context.scene.objects if o.name.startswith('Hub cut basalt')]
        check('hub 125 original tiles preserved',len(tiles)==125 and all(signature(o)==prior[o.name] for o in tiles),{'tiles':len(tiles)})
    check(kind+' temporary cutter absent','Hub boundary cutting tool' not in bpy.data.objects,None)
    out['models'][kind]={'floors':floors,'minimumTopRadius':min_radius,'unmodifiedSceneMeshes':len(unchanged)}
out['pass']=all(c['pass'] for c in out['checks']);(A/'source-audit.json').write_text(json.dumps(out,indent=2));print('JUNCTION_SOURCE_AUDIT',json.dumps({'pass':out['pass'],'checks':len(out['checks'])}))
