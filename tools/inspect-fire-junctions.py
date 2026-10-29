import bpy,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent;A=R/'art/fire-junctions/v01';A.mkdir(parents=True,exist_ok=True);result={}
for kind in ['fracture','foundry','steam']:
    bpy.ops.wm.open_mainfile(filepath=str(R/('art/fire-masonry/v01/'+kind+'-static-v03.blend')));rows=[]
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or not(any(x in o.name.lower() for x in ['passage','entry','hub','datum'])) or 'wall' in o.name.lower() or 'jamb' in o.name.lower():continue
        p=[o.matrix_world@Vector(v) for v in o.bound_box];lo=[min(v.x for v in p),min(v.z for v in p),-max(v.y for v in p)];hi=[max(v.x for v in p),max(v.z for v in p),-min(v.y for v in p)]
        if lo[1]<.1 and hi[1]>-.2 and lo[0]<22 and hi[0]>-22 and lo[2]<20 and hi[2]>-18:rows.append({'name':o.name,'min':lo,'max':hi})
    result[kind]=rows
(A/'diagnosis.json').write_text(json.dumps(result,indent=2));print('JUNCTION_DIAGNOSIS',json.dumps({k:len(v) for k,v in result.items()}))
