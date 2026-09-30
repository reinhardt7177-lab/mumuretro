"""Final water sanctuary; reference art/water-sanctuary/v01/reference.png."""
import bpy,bmesh,math,os,sys,json,random,ast
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,vec,material,mesh,box,rod,ring,line
ART=os.path.join(ROOT,'art/water-sanctuary/v01');OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/WaterInterior')
os.makedirs(ART,exist_ok=True)
for file,names in [('build_water_interior_v02.py',['export','tiles','arch','column','basin']),('refine_water_glacier_v07.py',['wall'])]:
    tree=ast.parse(open(os.path.join(ROOT,'tools/blender',file),encoding='utf-8-sig').read())
    exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'<shared>','exec'))
bpy.ops.wm.read_factory_settings(use_empty=True)
stone=material('Interior limestone',(.38,.43,.44));edge=material('Interior carved edges',(.59,.59,.52))
gold=material('Interior aged bronze',(.40,.25,.10),.7,.35);blue=material('Interior water enamel',(.025,.28,.34),.3,.3)
ice=material('Interior glacial strata',(.17,.40,.52));deep=material('Interior glacial depths',(.035,.12,.18));frost=material('Interior frost crest',(.45,.69,.75))
rng=random.Random(92510)
tiles(-6,6,0,2,0);tiles(-1.5,1.5,2,10,0);tiles(-6,6,10,14,0)
for s in [-1,1]:
    for z in [1,5,9,13]:column(s*5.3,z,height=5.5)
    for z in [3,7,11]:arch(s*5.9,3.4,z,1.6,.38,True)
    wall('Sanctuary folded glacier',0,14,lambda u,y,d,s=s:(s*(6.15+d),y,u),801+s)
    for x in [s*1.6,s*5.9]:box('Grounded pool curb',(x,-.02,6),(.18,.24,8),edge,bevel=.025)
    box('Pool basin bed',(s*3.75,-.3,6),(4.3,.15,8),blue)
for z in [1,9,13.5]:arch(0,5.5,z,5.0,.42)
wall('Sanctuary glacial window',-6,6,lambda u,y,d:(u,y,14.15+d),810)
for i in range(3):box('Deity dais step',(0,.075*(i+1),10.15+i*.42),(3.8,.15*(i+1),.84),edge,bevel=.028)
box('Deity raised sanctuary',(0,.225,12),(4,.45,3),stone,bevel=.04)
for s in [-1,1]:
    line('Aisle fine bronze border',[(s*1.37,.012,1),(s*1.37,.012,10)],.015,gold)
    for z in [2,9.4]:
        box('Lantern grounded plinth',(s*1.9,.38,z),(.55,.76,.55),stone,bevel=.025)
        ring('Lantern bowl',(s*1.9,.80,z),.30,.035,gold)
ring('Aisle water sigil',(0,.012,5),.70,.028,gold,segments=64)
line('Aisle droplet',[(0,.018,5.55),(-.25,.018,5.03),(-.23,.018,4.82),(0,.018,4.7),(.23,.018,4.82),(.25,.018,5.03),(0,.018,5.55)],.025,blue)
export('water-sanctuary-v01')
# Separate editable deity; proportions, crown and flowing cloak follow the concept.
ivory=material('Water deity ivory',(.65,.64,.53));teal=material('Water deity teal',(.025,.17,.21),.25)
bronze=material('Water deity bronze',(.55,.36,.13),.72);shadow=material('Water deity shadow',(.035,.065,.075));gem=material('Water deity gem',(.13,.64,.73),.3)
def ell(name,p,s,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=vec(p));o=bpy.context.object;o.name=name;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);return o
def surface(name,fn,nu,nv,mat):
    v=[fn(i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)];f=[]
    for j in range(nv):
        for i in range(nu):
            k=j*(nu+1)+i;f.append((k,k+1,k+nu+2,k+nu+1))
    o=mesh(name,v,f,mat);mod=o.modifiers.new('Carved cloth thickness','SOLIDIFY');mod.thickness=.025;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name);return o
def robe(u,v):
    a=u*math.tau;r=.35+.45*(1-v)**2+.035*math.cos(a*20+v)
    return (r*math.sin(a),2.28*v,-r*.66*math.cos(a))
surface('Sculpted flowing robe',robe,72,32,teal)
def panel(u,v):
    w=.18+.18*(1-v);return ((2*u-1)*w,2.26*v+.025,-(.35+.45*(1-v)**2)*.66-.035)
surface('Ivory ceremonial vestment',panel,12,32,ivory)
for e in [0,1]:line('Vestment bronze edge',[panel(e,k/40) for k in range(41)],.012,bronze)
ell('Neck',(0,2.34,0),(.15,.22,.14),ivory)
ell('Carved calm face',(0,2.64,-.035),(.225,.325,.195),ivory)
mesh('Sculpted nose',[(-.027,2.67,-.21),(.027,2.67,-.21),(0,2.58,-.267),(-.03,2.55,-.218),(.03,2.55,-.218)],[(0,2,1),(0,3,2),(1,2,4),(2,3,4)],ivory)
for s in [-1,1]:
    line('Closed peaceful eye',[(s*.055,2.68,-.224),(s*.10,2.665,-.219),(s*.15,2.68,-.197)],.008,shadow)
    line('Swept sculpted hair',[(s*.15,2.93,.02),(s*.26,2.71,.03),(s*.24,2.38,.08),(s*.36,2.15,.10)],.055,bronze)
    a=(s*.32,2.22,0);b=(s*.58,1.93,-.13);c=(s*.9,1.99,-.35)
    rod('Draped upper sleeve',a,b,.145,teal,vertices=24);rod('Ivory forearm',b,c,.095,ivory,vertices=20)
    ell('Open offering palm',(s*.96,2,-.39),(.13,.055,.11),ivory)
    for i in range(4):rod('Extended fingers',(s*.96+(i-1.5)*.043,2,-.44),(s*.98+(i-1.5)*.045,2.025,-.55),.018,ivory,vertices=10)
    def mantle(u,v,s=s):return(s*(.34+.58*(1-v)**2+u*.15),.06+2.20*v,.10+.14*math.sin(u*math.pi))
    surface('Swept layered mantle',mantle,12,32,teal)
    for e in [0,1]:line('Mantle gilded hem',[mantle(e,k/40) for k in range(41)],.014,bronze)
ring('Water halo outer',(0,2.67,.31),.86,.025,bronze,plane='xy',segments=80)
ring('Water halo inner',(0,2.67,.31),.76,.017,bronze,plane='xy',segments=80)
for s in [-1,0,1]:
    line('Three stream crown',[(s*.17+.07*math.sin(k*.28),2.88+k*.029,-.015) for k in range(22)],.027,bronze)
mesh('Crown water droplet',[(0,3.52,-.03),(-.15,3.20,-.03),(0,3.07,-.08),(.15,3.20,-.03),(0,3.24,-.18),(0,3.24,.06)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,5,1),(1,5,2),(2,5,3),(3,5,0)],gem)
ell('Orb of returning water',(0,1.9,-.7),(.17,.17,.17),gem)
export('water-deity-v01')
