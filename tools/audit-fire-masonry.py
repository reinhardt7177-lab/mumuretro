import bpy,json,re
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent;A=R/'art/fire-masonry/v01';spec=json.loads((A/'metrics.json').read_text());rows=[]
def bounds(o):
    p=[o.matrix_world@Vector(v) for v in o.bound_box]
    return [min(v[i] for v in p) for i in range(3)],[max(v[i] for v in p) for i in range(3)]
for kind,m in spec.items():
    bpy.ops.wm.open_mainfile(filepath=str(A/(kind+'-static-v03.blend')));bpy.context.view_layer.update();count=0;clearances=[];floors=[]
    for g in m['groups']:
        core=bpy.data.objects[g['core']];lo,hi=bounds(core);oldLo=g['originalMin'];oldHi=g['originalMax'];t=g['thicknessAxis'];a=g['axis']
        assert abs(lo[t]-(oldLo[t]+.06))<1e-4 and abs(hi[t]-(oldHi[t]-.06))<1e-4
        for axis in [a,2]:assert abs(lo[axis]-oldLo[axis])<1e-4 and abs(hi[axis]-oldHi[axis])<1e-4
        assert all(name not in bpy.data.objects for name in g['removed'])
        courseRows={}
        for name in g['stones']:
            o=bpy.data.objects[name];l,h=bounds(o);assert abs(l[t]-(oldLo[t]-.015))<1e-4 and abs(h[t]-(oldHi[t]+.015))<1e-4
            clearances.extend([lo[t]-l[t],h[t]-hi[t]]);j=int(re.search(r'course (\d+)',name)[1]);courseRows.setdefault(j,[]).append([l[a],h[a]])
            assert abs(l[2]-(oldLo[2]+j*(oldHi[2]-oldLo[2])/g['courses']+.0125))<1e-4
            assert abs(h[2]-(oldLo[2]+(j+1)*(oldHi[2]-oldLo[2])/g['courses']-.0125))<1e-4
            count+=1
        for values in courseRows.values():
            values.sort()
            for left,right in zip(values,values[1:]):assert abs(right[0]-left[1]-.024)<1e-4
        # First odd-row end stone is half a block long; the next joint shifts.
        first=sorted(courseRows[1])[0];assert abs(first[1]-(oldLo[a]+g['step']/2-.012))<1e-4
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or not(kind=='fracture' and o.name.startswith('Hub cut basalt') or kind=='sanctum' and o.name.startswith('sanctum paving')):continue
        l,h=bounds(o);expected=0 if o.name.startswith('Hub') else 3.2;assert abs(h[2]-expected)<1e-4;floors.append(expected)
    assert all(.0749<x<.0751 for x in clearances)
    rows.append({'kind':kind,'walls':len(m['groups']),'stones':count,'minFaceToCore':min(clearances),'bevel':.018,'minClearanceBeyondBevel':min(clearances)-.018,'floorPieces':len(floors),'unchangedGeometry':m['unchangedGeometry']})
out={'pass':True,'walls':sum(r['walls'] for r in rows),'stones':sum(r['stones'] for r in rows),'rows':rows};(A/'source-audit.json').write_text(json.dumps(out,indent=2));print('MASONRY_SOURCE_AUDIT',json.dumps(out))
