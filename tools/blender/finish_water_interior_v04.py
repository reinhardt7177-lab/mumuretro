"""Idempotent cleanup of the first v04 export's overlapping rear masonry course."""
import bpy,bmesh,os,sys,json,ast
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT
ART=os.path.join(ROOT,'art/glacier-water-temple/interior/v04')
OUT=os.path.join(ROOT,'art/engine-transfer/model-data/WaterInterior')
source=open(os.path.join(ROOT,'tools/blender/build_water_interior_v02.py'),encoding='utf-8-sig').read()
source=source.replace('p=ob.matrix_world@geo.vertices[vi].co;', 'normal=(nm@geo.vertices[vi].normal).normalized() if ob.name.startswith(("Continuous fractured", "Cast bronze")) else (nm@tri.normal).normalized();p=ob.matrix_world@geo.vertices[vi].co;')
tree=ast.parse(source)
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='export'],type_ignores=[]),'<export>','exec'))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ART,'collection-hall-v04.blend'))
removed=0
for o in list(bpy.context.scene.objects):
    if not o.name.startswith('Dressed rear masonry'):continue
    row=(o.location.z-6.19)/.58
    if row>=-.01 and abs(row-round(row))<.0001:
        bpy.data.objects.remove(o,do_unlink=True);removed+=1
print('Removed overlapping stones:',removed,flush=True)
export('collection-hall-v04')
for scene in ['ice','collection']:
    bpy.ops.wm.open_mainfile(filepath=os.path.join(ART,scene+'-hall-v04.blend'))
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and o.name.startswith('Continuous fractured'):
            for polygon in o.data.polygons:polygon.material_index=0
    export(scene+'-hall-v04')
