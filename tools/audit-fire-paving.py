import bpy,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent;A=R/'art/fire-paving/v01';out={}
for kind in ['fracture','sanctum']:
    bpy.ops.wm.open_mainfile(filepath=str(A/(kind+'-static-v02.blend')))
    deps=bpy.context.evaluated_depsgraph_get()
    def bounds(o):
        e=o.evaluated_get(deps);m=e.to_mesh();p=[e.matrix_world@v.co for v in m.vertices];e.to_mesh_clear()
        return {'bottom':min(v.z for v in p),'top':max(v.z for v in p)}
    bad=[o.name for o in bpy.context.scene.objects if o.name.startswith(('Hub inlay','Hub radial joint') if kind=='fracture' else ('Sanctum radial floor inlay','Floor radial engraving'))]
    assert not bad,bad
    if kind=='fracture':
        tiles=[o for o in bpy.context.scene.objects if o.name.startswith('Hub cut basalt')]
        assert len(tiles)==125
        tb=[bounds(o) for o in tiles];assert all(abs(b['top'])<1e-6 and abs(b['bottom']+.09)<1e-5 for b in tb)
        foundation=bounds(bpy.data.objects['Circular hub foundation']);assert abs(foundation['top']+.04)<1e-5 and abs(foundation['bottom']+.62)<1e-5,foundation
        out[kind]={'tiles':len(tiles),'tileTop':max(b['top'] for b in tb),'tileBottom':min(b['bottom'] for b in tb),'foundation':foundation,'removedNamesRemaining':bad}
    else:
        tiles=[o for o in bpy.context.scene.objects if o.name.startswith('sanctum paving')]
        assert tiles;bs=[bounds(o) for o in tiles];assert all(abs(b['top']-3.2)<1e-5 for b in bs)
        out[kind]={'tiles':len(tiles),'tileTop':max(b['top'] for b in bs),'removedNamesRemaining':bad}
out['pass']=True;(A/'source-audit.json').write_text(json.dumps(out,indent=2));print('SOURCE_AUDIT',json.dumps(out))
