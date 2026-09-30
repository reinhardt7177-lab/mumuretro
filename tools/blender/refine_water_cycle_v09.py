"""Cycle art refinement: perimeter steam riser and real sloped stone paving."""
import bpy,bmesh,math,os,sys,json,ast
from mathutils import Vector
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,material,mesh,box,rod,ring,line
ART=os.path.join(ROOT,'art/glacier-water-temple/interior/v09')
OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/WaterInterior')
os.makedirs(ART,exist_ok=True)
for file,names in [('build_water_interior_v02.py',['export']),('refine_water_interior_v04.py',['pipe'])]:
    tree=ast.parse(open(os.path.join(ROOT,'tools/blender',file),encoding='utf-8-sig').read())
    exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'<shared>','exec'))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art/glacier-water-temple/interior/v08/cycle-hall-v08.blend'))
stone=bpy.data.materials['Interior limestone'];edge=bpy.data.materials['Interior carved edges']
gold=bpy.data.materials['Interior aged bronze'];patina=bpy.data.materials['Interior bronze patina']
dark=bpy.data.materials['Interior recessed stone']
for o in list(bpy.context.scene.objects):
    if o.name.startswith(('Cast bronze conduit','Pipe coupling','Coupling retaining flange','Cycle conduit standard','Cycle fitted ramp paving','Cycle ramp handrail')):
        bpy.data.objects.remove(o,do_unlink=True)
# The old tall riser at X=3 crossed the principal entrance sight line.
# Supply exits through a buried connection and rises beside the wall instead.
route=[(3.88,.32,-2),(3.88,-.28,-2),(6.5,-.28,-2),(6.5,4.65,-2),(6.5,4.65,8.6),(3.7,4.65,8.6),(3.7,3.35,8.6)]
pipe(route,.075)
for z in [-2,3,7,8.6]:
    rod('Cycle perimeter pipe standard',(6.5,0,z),(6.5,4.65,z),.065,gold,vertices=16)
    for y in [1,3.8,4.65]:ring('Cycle standard collar',(6.5,y,z),.092,.018,patina,segments=20)
# Closed wedge slabs avoid back-face ambiguity and expose a real bevelled-looking joint.
for row in range(12):
    za=5.7+row*.25+.007;zb=5.7+(row+1)*.25-.007
    ya=(za-5.7)*.8-.004;yb=(zb-5.7)*.8-.004
    for col in range(2):
        xa=4.51+col*.74;xb=xa+.725
        top=[(xa,ya,za),(xb,ya,za),(xb,yb,zb),(xa,yb,zb)]
        verts=top+[(x,y-.10,z) for x,y,z in top]
        mesh('Cycle jointed ramp slab',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],edge if (row+col)%4==0 else stone)
    # Shallow bronze grooves across the ramp keep the incline legible as an incline.
    if row%3==0:line('Cycle ramp inset tread',[(4.58,ya+.004,za+.035),(5.92,ya+.004,za+.035)],.008,patina)
for x in [4.5,6]:
    line('Cycle continuous ramp handrail',[(x,.9,5.7),(x,3.3,8.7)],.038,gold)
    for z in [5.7,8.7]:
        y=(z-5.7)*.8
        rod('Cycle ramp terminal',(x,y,z),(x,y+.96,z),.06,gold,vertices=16)
        ring('Cycle terminal finial',(x,y+.93,z),.09,.025,gold,segments=20)
    # Supporting stone side follows the slope all the way down to the ground.
    mesh('Cycle grounded ramp cheek',[(x-.035,0,5.7),(x+.035,0,5.7),(x+.035,0,8.7),(x-.035,0,8.7),(x-.035,2.36,8.7),(x+.035,2.36,8.7)],[(0,3,2,1),(0,1,5,4),(0,4,3),(1,2,5),(2,3,4,5)],dark)
export('cycle-hall-v09')
with open(os.path.join(ART,'steam-route.json'),'w') as f:json.dump(route,f,indent=2)
