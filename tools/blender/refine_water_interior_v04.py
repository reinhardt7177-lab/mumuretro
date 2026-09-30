"""Grounded masonry and functional-looking bronze apparatus; preserves v03 sources."""
import bpy,bmesh,math,os,sys,json,random,ast
from mathutils import Vector
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,vec,material,mesh,box,rod,ring,line
ART=os.path.join(ROOT,'art/glacier-water-temple/interior/v04')
OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/WaterInterior')
os.makedirs(ART,exist_ok=True)
source=open(os.path.join(ROOT,'tools/blender/build_water_interior_v02.py'),encoding='utf-8-sig').read()
source=source.replace('p=ob.matrix_world@geo.vertices[vi].co;', 'normal=(nm@geo.vertices[vi].normal).normalized() if ob.name.startswith(("Continuous fractured", "Cast bronze")) else (nm@tri.normal).normalized();p=ob.matrix_world@geo.vertices[vi].co;')
tree=ast.parse(source)
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['export','tiles','basin']],type_ignores=[]),'<shared-authoring>','exec'))
rng=random.Random(92404)

def bind():
    global stone,edge,dark,gold,blue,patina
    stone=bpy.data.materials['Interior limestone'];edge=bpy.data.materials['Interior carved edges']
    dark=material('Interior recessed stone',(.12,.20,.23),0,.9);gold=bpy.data.materials['Interior aged bronze'];blue=bpy.data.materials['Interior water enamel']
    patina=material('Interior bronze patina',(.055,.17,.145),.4,.6)

def pipe(points,r=.095):
    # Filleted corners, with collars at joints. The original flow path is preserved.
    p=[Vector(v) for v in points];out=[p[0]]
    for i in range(1,len(p)-1):
        a=p[i]+(p[i-1]-p[i]).normalized()*.28;b=p[i]+(p[i+1]-p[i]).normalized()*.28
        out.append(a)
        for k in range(1,9):
            t=k/8;out.append((1-t)**2*a+2*(1-t)*t*p[i]+t*t*b)
    out.append(p[-1]);line('Cast bronze conduit',out,r,gold)
    for a,b in zip(p[:-1],p[1:]):
        d=b-a
        for t in [.18,.65]:
            c=a+d*t;axis=d.normalized()
            rod('Pipe coupling',c-axis*.07,c+axis*.07,r*1.33,patina,vertices=20)
            for s in [-1,1]:rod('Coupling retaining flange',c+axis*(s*.07-.015),c+axis*(s*.07+.015),r*1.52,gold,vertices=20)

def masonry_front(z,x0,x1,y0,y1,opening=0):
    rows=math.ceil((y1-y0)/.58)
    for j in range(rows):
        for i in range(math.ceil((x1-x0)/1.12)):
            x=x0+(i+.5)*1.12+(j%2)*.32
            if x>x1-.2 or (opening and abs(x)<opening and y0+j*.58<5.8):continue
            box('Dressed rear masonry',(x,y0+(j+.5)*.58,z),(1.095,.554,.36),edge if rng.random()<.15 else stone,bevel=.028)

def medallion(x,y,z,r):
    rod('Recessed water medallion',(x,y,z+.055),(x,y,z),r,blue,vertices=48)
    for rr in [r,r*.82]:ring('Raised medallion bead',(x,y,z-.018),rr,.022,gold,plane='xy',segments=48)
    for j in [-1,0,1]:line('Carved flowing seal',[(x-r*.55+i*r*.055,y+j*r*.24+.04*math.sin(i*.5),z-.042) for i in range(21)],.018,edge)

def finish_surfaces():
    # Tone variation belongs to individual stones, not a high-contrast noise overlay.
    tones=[material('Interior stone tone '+str(i),(.32+i*.022,.36+i*.021,.35+i*.019),0,.8) for i in range(5)]
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH' or not o.data.materials:continue
        if o.name.startswith('Continuous fractured'):
            for polygon in o.data.polygons:polygon.material_index=0
        if any(k in o.name.lower() for k in ['flagstone','masonry','ashlar','paver','voussoir']):
            if rng.random()<.65:o.data.materials[0]=rng.choice(tones)
    # Wet narrow margins follow actual floor banks, never add walkable cover across gaps.

for scene in ['ice','collection']:
    bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art/glacier-water-temple/interior/v03/'+scene+'-hall-v03.blend'));bind()
    if scene=='collection':
        tiles(-9,9,-7,6.1,0)
        tiles(-3,3,11.1,14.1,2.4)
        # Gallery gets a load-bearing apron and stair risers down to floor Y=0.
        box('Gallery structural bed',(-2,2.16,4.11),(10,.32,3.98),dark,bevel=.025)
        for j in range(16):
            h=(j+1)*.15-.09
            box('Solid dressed stair riser',(-6,h/2,-3+(j+.5)*.32),(1.97,h,.30),stone,bevel=.012)
        for x in [-6,2]:
            box('Grounded gallery pier',(x,1.06,5.6),(.76,2.12,.76),stone,bevel=.04)
            for y in [.13,1.94]:box('Gallery pier molded plinth',(x,y,5.6),(.94,.25,.94),edge,bevel=.025)
        for z in [2.12,6.1]:
            box('Gallery continuous fascia',(-2,2.21,z),(10,.30,.16),edge,bevel=.022)
            line('Fascia bronze waterline',[(-7,2.25,z-.09),(3,2.25,z-.09)],.018,gold)
            for x in range(-6,3):medallion(x,2.2,z-.11,.085)
        masonry_front(14,-9,9,0,9,opening=2.7)
        # Full-height apparatus with rounded elbows replaces camera-facing ribbon lines.
        pipe([(1,.9,-2.2),(1,4.9,-2.2),(7,4.9,-2.2),(7,4.9,5.1),(-3.6,4.9,5.1)])
        pipe([(-3.3,2.65,5.1),(4,2.65,5.1),(4,.8,-2.2)],.075)
        pipe([(-3.6,4.7,5.1),(2.6,4.7,5.1)],.065)
        for x in [-3.6,2.6]:
            rod('Lathed rail standard',(x,2.4,5.1),(x,4.7,5.1),.075,gold,vertices=16)
            for y in [2.46,3.2,4.55]:ring('Standard turned collar',(x,y,5.1),.105,.025,patina,segments=20)
        # Receiver remains square inside so its water surface and capture logic match.
        basin(1,3.45,5.1,1.40,1.40)
        box('Receiver grounded pedestal',(1,2.65,5.1),(1.5,.5,1.5),stone,bevel=.055)
        for sx in [-1,1]:
            box('Receiver embossed side',(1+sx*.70,3.14,5.1),(.13,.61,1.40),gold,bevel=.03)
        for sz in [-1,1]:
            box('Receiver bronze apron',(1,3.12,5.1+sz*.70),(1.38,.65,.10),gold,bevel=.025)
            box('Receiver enamel insert',(1,3.13,5.1+sz*.765),(1.05,.32,.025),blue,bevel=.012)
        medallion(1,3.14,4.31,.18)
        for i in range(5):box('Receiver gauge graduation',(1.54,2.9+i*.10,4.30),(.10,.018,.025),edge,bevel=0)
        # A real handwheel makes the interaction station read as machinery.
        rod('Handwheel spindle',(-4.6,2.9,4.2),(-4.6,2.9,3.92),.055,gold,vertices=16)
        ring('Collector control wheel',(-4.6,2.9,3.90),.28,.038,gold,plane='xy')
        for a in range(4):
            t=a*math.pi/2;rod('Control wheel spoke',(-4.6,2.9,3.90),(-4.6+.26*math.cos(t),2.9+.26*math.sin(t),3.90),.022,patina)
    else:
        # Layered carved portal face, with grounded shoulders framing the moving gate.
        for side in [-1,1]:
            for y in [.16,.40,2.8,4.7]:
                box('Portal projecting string course',(side*4.35,y,9.63),(3.35,.14,.20),edge,bevel=.025)
            medallion(side*4.3,2.05,9.66,.60)
            for x in [side*3.2,side*5.45]:
                box('Portal relief pilaster',(x,2.0,9.67),(.28,3.2,.15),edge,bevel=.025)
            # Coping emphasizes the chasm, leaving both crossings fully clear.
            for z in [-.13,5.13]:
                box('Bank carved coping',(side*4.75,-.06,z),(4.1,.12,.38),edge,bevel=.025)
        for x,z,w in [(-3,-1.7,1.6),(-5,-3.7,1.3)]:
            box('Reservoir carved pedestal',(x,.28,z),(w+.10,.56,w+.10),stone,bevel=.045)
            medallion(x,.36,z-w*.5-.07,.19)
    finish_surfaces();export(scene+'-hall-v04')

