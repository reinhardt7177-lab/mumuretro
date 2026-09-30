"""Refine the preserved v02 Blender sources into enclosed, weathered interiors."""
import bpy,bmesh,math,os,sys,json,random,ast
from mathutils import Vector,noise
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,vec,material,mesh,box,rod,ring,line
ART=os.path.join(ROOT,'art/glacier-water-temple/interior/v03');OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/WaterInterior')
os.makedirs(ART,exist_ok=True)
# Reuse the tested mesh exporter without running the v02 authoring script.
source=open(os.path.join(ROOT,'tools/blender/build_water_interior_v02.py'),encoding='utf-8-sig').read()
node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='export')
exec(compile(ast.Module(body=[node],type_ignores=[]),'<mesh-export>','exec'))
rng=random.Random(9324)

def vault(width,z0,z1,spring):
    # Short masonry barrels with one intentional skylight; arches remain the structural ribs.
    rows=7;segments=24
    dz=(z1-z0)/rows
    for j in range(rows):
        za=z0+j*dz;zb=za+dz-.028
        for i in range(segments):
            # Roof oculus lets daylight enter above the working route.
            if j==4 and 8<=i<=15:continue
            a=i*math.pi/segments+.002;b=(i+1)*math.pi/segments-.002
            v=[(r*math.cos(t),spring+r*math.sin(t),z) for z in [za,zb] for r,t in [(width,a),(width+.24,a),(width+.24,b),(width,b)]]
            mesh('Vault dressed stone coffer',v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],stone)

def glacier(side,width,z0,z1):
    # Continuous stepped fracture face. Broad shelves alternate with smaller inset planes.
    nx=38;ny=20;v=[]
    for j in range(ny+1):
        y=-4+j*.75
        for i in range(nx+1):
            z=z0+(z1-z0)*i/nx
            profile=.20*math.sin(z*1.7)+.27*math.sin(y*1.4+z*.45)+rng.uniform(-.18,.18)
            depth=width+profile+.15*(j%3)
            v.append((side*depth,y+rng.uniform(-.1,.1),z+rng.uniform(-.12,.12)))
    f=[]
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;b=a+1;c=a+nx+1;d=c+1
            f.extend([(a,c,b),(b,c,d)] if (i+j)%2 else [(a,c,d),(a,d,b)])
    o=mesh('Continuous fractured glacier face',v,f,ice)
    o.data.materials.append(frost)
    for p in o.data.polygons:
        if rng.random()<.20:p.material_index=1
    # Pale fissures interrupt the planes in narrow branching strands.
    for k in range(13):
        z=z0+(z1-z0)*(k+.5)/13;pts=[]
        for j in range(10):
            y=j*.8;zz=z+.18*math.sin(j*.9+k)
            x=side*(width-.36)
            pts.append((x,y,zz))
        line('Glacier compression vein',pts,.014,frost)

def weather_existing():
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH' or not o.data.materials:continue
        if any(k in o.name for k in ['flagstone','ashlar','masonry','pedestal','Column','column','arch','Arch']):
            # Millimetre-scale wear preserves floor heights and recognizable carved profiles.
            for v in o.data.vertices:
                w=o.matrix_world@v.co
                amount=noise.noise_vector(w*5.5)*.008
                if 'flagstone' in o.name:amount.z=min(0,amount.z)
                v.co+=amount
            o.data.update()
        if 'flagstone' in o.name and rng.random()<.28:
            x=o.location.x;z=-o.location.y;y=o.location.z+.088
            pts=[(x-.35,y,z-.10),(x-.12,y,z+.04),(x+.03,y,z+.09),(x+.22,y,z+.28)]
            line('Fine stone hairline',pts,.004,dark)

def frieze(side,x,z0,z1,y):
    box('Supported carved frieze beam',(side*(x+.18),y+.04,(z0+z1)/2),(.4,.65,z1-z0),edge,bevel=.025)
    for yy in [y,y+.27]:
        line('Continuous wave frieze',[(side*x,yy+.055*math.sin(i*.35),z0+i*(z1-z0)/180) for i in range(181)],.026,gold)
    for i in range(28):box('Cornice dentil',(side*x,y-.18,z0+(i+.5)*(z1-z0)/28),(.18,.18,.22),edge,bevel=.018)

def bind():
    global stone,edge,dark,gold,blue,ice,frost
    stone=bpy.data.materials['Interior limestone'];edge=bpy.data.materials['Interior carved edges'];dark=bpy.data.materials['Interior recessed stone'];gold=bpy.data.materials['Interior aged bronze'];blue=bpy.data.materials['Interior water enamel'];ice=bpy.data.materials['Interior glacial blue'];frost=bpy.data.materials['Interior frost edge']

bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art/glacier-water-temple/interior/v02/ice-hall-v02.blend'));bind()
for o in list(bpy.context.scene.objects):
    if o.name.startswith('Angular glacial buttress'):bpy.data.objects.remove(o,do_unlink=True)
weather_existing();vault(6.38,-7,11.2,5)
for side in [-1,1]:
    glacier(side,7.3,-7.4,12.4);frieze(side,6.8,-6.5,10,3.15)
    # Bank retaining masonry descends to the pool bottom, preserving the true floor datum.
    for z in [-.18,5.18]:
        for row in range(4):
            for k in range(6):
                x=side*(1.95+k*.78)
                box('Bank retaining stone',(x,-.48-row*.65,z),(.75,.62,.40),dark,bevel=.04)
# Back window is a continuous glacial mass, not a row of poles.
for j in range(6):
    for i in range(9):box('Back glacial fracture',(-5.6+i*1.4,1+j*1.3,12.5+rng.random()*.45),(1.5,1.5,.7),ice if (i+j)%3 else frost,bevel=.13)
# Basins receive molded aprons and inset water glyphs.
for x,z,w in [(-3,-1.7,1.6),(-5,-3.7,1.3)]:
    for row in range(3):line('Basin engraved waves',[(x-w*.42+i*w*.084,.39+row*.10+.035*math.sin(i*.7),z-w*.5-.09) for i in range(11)],.012,gold)
export('ice-hall-v03')

bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art/glacier-water-temple/interior/v02/collection-hall-v02.blend'));bind();weather_existing()
vault(8.85,-7,14,6)
for side in [-1,1]:
    frieze(side,8.65,-6,13,5.5)
    glacier(side,9.2,-7,14)
# Fine gallery floor tiles; the top remains exactly 2.4m.
for i in range(10):
    for j in range(4):box('Gallery fitted paver',(-6.5+i,2.345,2.61+j*.99),(.975,.11,.965),stone,bevel=.012)
# Matching treads follow the existing 16 steps rather than changing navigation.
for i in range(16):box('Fixed stair dressed tread',(-6,(i+1)*.15-.045,-3+(i+.5)*.32),(1.98,.09,.31),edge,bevel=.012)
for side in [-1,1]:
    for j in range(16):rod('Stair baluster',(-6+side*.98,(j+1)*.15,-3+(j+.5)*.32),(-6+side*.98,(j+1)*.15+.8,-3+(j+.5)*.32),.024,gold,vertices=8)
    line('Stair continuous handrail',[(-6+side*.98,.95,-2.84),(-6+side*.98,3.2,1.96)],.04,gold)
# Vessel insignia, unions and wall-anchored pipe clamps.
for x in [1,4]:
    for k in range(3):line('Vessel wave etching',[(x-.30+j*.03,.28+k*.11+.022*math.sin(j*.65),-3.04) for j in range(21)],.009,gold)
for z in [-2.2,2,5.1]:
    ring('Pipe union',(7,4.9,z),.14,.035,gold,plane='xy',segments=20)
export('collection-hall-v03')

