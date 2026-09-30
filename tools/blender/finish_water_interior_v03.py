import bpy,bmesh,math,os,sys,json,ast
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,box
ART=os.path.join(ROOT,'art/glacier-water-temple/interior/v03');OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/WaterInterior')
source=open(os.path.join(ROOT,'tools/blender/build_water_interior_v02.py'),encoding='utf-8-sig').read()
node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='export')
exec(compile(ast.Module(body=[node],type_ignores=[]),'<mesh-export>','exec'))
for name,x,z0,z1,y in [('ice-hall-v03',6.8,-6.5,10,3.15),('collection-hall-v03',8.65,-6,13,5.5)]:
    bpy.ops.wm.open_mainfile(filepath=os.path.join(ART,name+'.blend'))
    for ob in list(bpy.context.scene.objects):
        if ob.name.startswith('Supported carved frieze beam'):bpy.data.objects.remove(ob,do_unlink=True)
    edge=bpy.data.materials['Interior carved edges']
    for side in [-1,1]:box('Supported carved frieze beam',(side*(x+.18),y+.04,(z0+z1)/2),(.4,.65,z1-z0),edge,bevel=.025)
    export(name)
