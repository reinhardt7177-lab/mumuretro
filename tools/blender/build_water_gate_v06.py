"""Water-temple gate relief in unscaled gate-local metres; preserved as v06."""
import bpy,bmesh,os,sys,math,json,ast
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,material,mesh,box,rod,ring,line
ART=os.path.join(ROOT,'art/glacier-water-temple/interior/v06');OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/WaterInterior')
os.makedirs(ART,exist_ok=True)
tree=ast.parse(open(os.path.join(ROOT,'tools/blender/build_water_interior_v02.py'),encoding='utf-8-sig').read())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='export'],type_ignores=[]),'<export>','exec'))
bpy.ops.wm.read_factory_settings(use_empty=True)
gold=material('Gate antique gold',(.52,.31,.095),.75,.28)
rim=material('Gate pale electrum',(.67,.58,.34),.65,.3)
dark=material('Gate deep enamel',(.012,.047,.062),.25,.28)
jewel=material('Gate turquoise jewel',(.028,.40,.47),.35,.18)
# The gate is 3 x 3 m, with its front at local Z=-.2.
box('Recessed ceremonial panel',(0,0,-.215),(2.76,2.76,.05),dark,bevel=.04)
for x in [-1.40,1.40]:
    box('Outer cast frame',(x,0,-.25),(.09,2.90,.12),gold,bevel=.02)
    line('Fine inset frame',[(x*.92,-1.27,-.285),(x*.92,1.27,-.285)],.013,rim)
for y in [-1.40,1.40]:
    box('Outer cast frame',(0,y,-.25),(2.9,.09,.12),gold,bevel=.02)
    line('Fine inset frame',[(-1.27,y*.92,-.285),(1.27,y*.92,-.285)],.013,rim)
rod('Raised seal backing',(0,.08,-.245),(0,.08,-.29),.79,dark,vertices=64)
for radius,tube,mat in [(.78,.034,gold),(.84,.013,rim),(.97,.023,gold)]:
    ring('Concentric seal molding',(0,.08,-.315),radius,tube,mat,plane='xy',segments=80)
# Large droplet silhouette stays readable from across the ice crossing.
points=[(.27*math.sin(t)*(1-math.cos(t))**.65,.20+.56*math.cos(t),-.37) for t in [i*math.tau/64 for i in range(64)]]
mesh('Faceted water jewel',[(0,.10,-.43)]+points,[(0,i+1,(i+1)%64+1) for i in range(64)],jewel)
line('Droplet gold rim',points+[points[0]],.028,rim)
line('Droplet inner glint',[(-.07,.5,-.405),(-.18,.26,-.405),(-.18,.04,-.405),(-.08,-.10,-.405)],.013,rim)
for row in range(2):
    line('Water beneath the seal',[(-.50+i*.025,-.39-row*.13+.045*math.sin(i*.31),-.35) for i in range(41)],.022,gold)
# Four compass-like currents and twelve restrained radial cuts.
for k in range(12):
    a=k*math.tau/12
    line('Radial inlaid mark',[(r*math.sin(a),.08+r*math.cos(a),-.33) for r in [.865,.927]],.012,rim)
for side in [-1,1]:
    for sy in [-1,1]:
        pts=[(side*.24,sy*1.18,-.31),(side*.63,sy*1.18,-.31),(side*.98,sy*.97,-.31),(side*1.12,sy*.64,-.31),(side*1.12,sy*.34,-.31)]
        line('Flowing corner filigree',pts,.024,gold)
        ring('Corner seal stud',(side*1.17,sy*1.17,-.32),.055,.017,rim,plane='xy',segments=20)
        mesh('Corner enamel diamond',[(side*1.17,sy*1.17,-.355),(side*1.17-.045,sy*1.17,-.325),(side*1.17,sy*1.17+.045,-.325),(side*1.17+.045,sy*1.17,-.325),(side*1.17,sy*1.17-.045,-.325)],[(0,1,2),(0,2,3),(0,3,4),(0,4,1)],jewel)
for y in [-1.17,1.2]:
    mesh('Cardinal diamond',[(0,y+.095,-.33),(.065,y,-.33),(0,y-.095,-.33),(-.065,y,-.33)],[(0,1,2,3)],rim)
export('ice-gate-detail-v06')
