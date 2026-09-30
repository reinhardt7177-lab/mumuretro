"""Cycle sanctuary art, preserving the gameplay floor Y=0 and gallery Y=2.4."""
import bpy,bmesh,math,os,sys,json,random,ast
from mathutils import Vector
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,material,mesh,box,rod,ring,line
ART=os.path.join(ROOT,'art/glacier-water-temple/interior/v08')
OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/WaterInterior')
os.makedirs(ART,exist_ok=True)
source=open(os.path.join(ROOT,'tools/blender/build_water_interior_v02.py'),encoding='utf-8-sig').read()
tree=ast.parse(source)
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['export','tiles','basin','arch']],type_ignores=[]),'<shared>','exec'))
source=open(os.path.join(ROOT,'tools/blender/refine_water_interior_v04.py'),encoding='utf-8-sig').read()
tree=ast.parse(source)
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['pipe','medallion']],type_ignores=[]),'<details>','exec'))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art/glacier-water-temple/interior/v07/ice-hall-v07.blend'))
stone=bpy.data.materials['Interior limestone'];edge=bpy.data.materials['Interior carved edges']
gold=bpy.data.materials['Interior aged bronze'];blue=bpy.data.materials['Interior water enamel']
dark=material('Interior recessed stone',(.12,.20,.23),0,.9)
patina=material('Interior bronze patina',(.055,.17,.145),.4,.6)
rng=random.Random(92508)
# Gallery paving meets the existing flat floor collider exactly; no tiles bridge the water gap.
tiles(1,4.5,7.2,9.6,2.4);tiles(4.5,6,8.7,9.6,2.4)
box('Cycle gallery fascia',(2.75,2.15,7.22),(3.5,.38,.16),edge,bevel=.035)
line('Cycle gallery gilt edge',[(1,2.22,7.12),(4.5,2.22,7.12)],.023,gold)
for x in [1.4,5.4]:
    box('Cycle grounded pier',(x,1.08,9.3),(.52,2.16,.52),stone,bevel=.035)
    for y in [.14,2.04]:box('Cycle pier base',(x,y,9.3),(.72,.25,.72),edge,bevel=.025)
# Sloped stone skin, not decorative stairs on a ramp.
for i in range(10):
    za=5.7+i*.3;zb=za+.294;ya=i*.24-.012;yb=ya+.2352
    mesh('Cycle fitted ramp paving',[(4.51,ya,za),(5.99,ya,za),(5.99,yb,zb),(4.51,yb,zb)],[(0,3,2,1)],edge if i%3==0 else stone)
    for x in [4.5,6]:
        rod('Cycle ramp handrail',(x,ya+.9,za),(x,yb+.9,zb),.032,gold)
        if i%2==0:rod('Cycle ramp baluster',(x,ya,za),(x,ya+.9,za),.024,gold)
for a,b in [((1,3.28,7.2),(4.5,3.28,7.2)),((1,3.28,9.5),(5.9,3.28,9.5))]:
    line('Cycle gallery railing',[a,b],.04,gold)
    for j in range(8):
        x=a[0]+(b[0]-a[0])*j/7;rod('Cycle gallery baluster',(x,2.4,a[2]),(x,3.28,a[2]),.024,gold)
        ring('Cycle railing collar',(x,2.65,a[2]),.048,.012,gold,segments=12)
# Open-top vessel leaves the live water surface visible.
rod('Cycle boiler shell',(3,.02,-2),(3,.69,-2),.99,gold,vertices=40)
for y in [.12,.58,.74]:ring('Cycle boiler rolled band',(3,y,-2),1.0,.045,gold,segments=48)
for k in range(12):
    a=k*math.tau/12
    rod('Cycle boiler rivet',(3+.98*math.cos(a),.36,-2+.98*math.sin(a)),(3+1.02*math.cos(a),.36,-2+1.02*math.sin(a)),.024,edge,vertices=8)
medallion(3,.39,-3.025,.22)
pipe([(3,.9,-2),(3,3.8,-2),(6.5,3.8,-2),(6.5,3.8,8.6),(3.7,3.8,8.6)])
for z in [-2,3,7,8.6]:
    rod('Cycle conduit standard',(6.5,0,z),(6.5,3.8,z),.075,gold,vertices=12)
    box('Cycle conduit shoe',(6.5,.09,z),(.34,.18,.34),edge)
# Sacred receiver retains its rectangular live surface, with a carved reliquary surround.
box('Cycle sanctuary stepped base',(-3,.16,8.3),(2.7,.32,2.2),edge,bevel=.06)
box('Cycle sanctuary pedestal',(-3,.57,8.3),(2.35,.55,1.85),stone,bevel=.05)
basin(-3,1.5,8.3,2.28,1.8)
box('Cycle sanctuary enamel frieze',(-3,1.13,7.32),(2.1,.42,.06),blue,bevel=.015)
for x in [-3.72,-3,-2.28]:medallion(x,1.13,7.26,.16)
for i in range(5):box('Cycle sanctuary gauge',(-1.94,.8+i*.115,7.25),(.10,.022,.024),gold,bevel=0)
# Two controls are readable wheel mechanisms anchored to their existing pedestals.
for x,y,z in [(2,2.4,8),(.7,0,-2.4)]:
    box('Cycle control footing',(x,y+.1,z),(.65,.2,.65),edge,bevel=.035)
    rod('Cycle valve stem',(x,y+.2,z),(x,y+.85,z),.075,gold,vertices=16)
    rod('Cycle valve axle',(x,y+.82,z),(x,y+.82,z-.22),.055,patina,vertices=16)
    ring('Cycle valve wheel',(x,y+.82,z-.25),.26,.034,gold,plane='xy',segments=32)
    for i in range(5):
        a=i*math.tau/5;rod('Cycle wheel spoke',(x,y+.82,z-.25),(x+.24*math.cos(a),y+.82+.24*math.sin(a),z-.25),.018,gold)
export('cycle-hall-v08')
