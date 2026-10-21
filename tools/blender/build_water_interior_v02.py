"""Reference-led water interior v02. Authored in game metres, floor datum Y=0."""
import bpy,bmesh,math,os,sys,json,random
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,vec,material,mesh,box,rod,ring,line
ART=os.path.join(ROOT,'art/glacier-water-temple/interior/v02')
OUT=os.path.join(ROOT,'art/engine-transfer/model-data/WaterInterior')
os.makedirs(ART,exist_ok=True);os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng=random.Random(924)
stone=material('Interior limestone',(.38,.43,.44),0,.85)
edge=material('Interior carved edges',(.59,.59,.52),0,.75)
dark=material('Interior recessed stone',(.12,.20,.23),0,.9)
gold=material('Interior aged bronze',(.40,.25,.10),.7,.35)
blue=material('Interior water enamel',(.025,.28,.34),.3,.3)
ice=material('Interior glacial blue',(.19,.46,.60),.1,.3)
frost=material('Interior frost edge',(.46,.70,.77),.1,.4)

def arch(x,y,z,r,depth,side=False):
    def point(a,b,c):return (x+c,y+b,z+a) if side else (x+a,y+b,z+c)
    for i in range(17):
        a=i*math.pi/17+.008;b=(i+1)*math.pi/17-.008
        v=[point(rr*math.cos(t),rr*math.sin(t),d) for d in [-depth/2,depth/2] for rr,t in [(r,a),(r+.34,a),(r+.34,b),(r,b)]]
        mesh('Radial arch voussoir',v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],edge)
    line('Arch bronze molding',[point((r-.04)*math.cos(i*math.pi/40),(r-.04)*math.sin(i*math.pi/40),-depth/2-.015) for i in range(41)],.025,gold)

def column(x,z,base=0,height=5.1):
    for y,w,h in [(.14,1.05,.28),(.37,.84,.18),(height-.25,.84,.20),(height,.99,.28)]:
        box('Stepped column pedestal',(x,base+y,z),(w,h,w),edge,bevel=.035)
    rod('Stone column',(x,base+.46,z),(x,base+height-.35,z),.33,stone,vertices=20)
    for k in range(12):
        a=k*math.tau/12
        rod('Carved fluting',(x+.32*math.cos(a),base+.6,z+.32*math.sin(a)),(x+.32*math.cos(a),base+height-.5,z+.32*math.sin(a)),.026,edge,vertices=6)
    for y in [.52,height-.40]:ring('Column bronze collar',(x,base+y,z),.36,.025,gold)
    # A supported enamel panel on the pillar's front face, with wave emblem.
    box('Water inscription panel',(x,base+height*.54,z-.342),(.34,1.1,.05),blue,bevel=.018)
    for row in range(3):line('Engraved water wave',[(x-.14+i*.028,base+height*.5+row*.13+.035*math.sin(i*.63),z-.377) for i in range(11)],.012,gold)

def tiles(xlo,xhi,zlo,zhi,y):
    nx=round((xhi-xlo)/1.25);nz=round((zhi-zlo)/1.15)
    for i in range(nx):
        for j in range(nz):
            w=(xhi-xlo)/nx;d=(zhi-zlo)/nz
            box('Bevelled flagstone',(xlo+(i+.5)*w,y-.09,zlo+(j+.5)*d),(w-.024,.18,d-.024),edge if rng.random()<.23 else stone,bevel=.025)

def shard(x,y,z,w,h):
    n=6;verts=[]
    for level in range(3):
        scale=[1,1.04,.82][level]
        for k in range(n):
            a=k*math.tau/n;verts.append((x+w*scale*math.cos(a),y+h*level/2+(rng.random()-.5)*(.75 if level==2 else .12),z+w*scale*math.sin(a)))
    faces=[tuple(reversed(range(n))),tuple(range(12,18))]
    for l in range(2):
        for k in range(n):faces.append((l*n+k,l*n+(k+1)%n,(l+1)*n+(k+1)%n,(l+1)*n+k))
    mesh('Angular glacial buttress',verts,faces,ice if rng.random()<.65 else frost)

def basin(x,y,z,w,d):
    for xx in [-1,1]:box('Carved basin side',(x+xx*w/2,y-.12,z),(.16,.32,d+.2),edge,bevel=.035)
    for zz in [-1,1]:box('Carved basin end',(x,y-.12,z+zz*d/2),(w,.32,.16),edge,bevel=.035)
    for zz in [-1,1]:line('Basin bronze lip',[(x-w/2,y+.04,z+zz*d/2),(x+w/2,y+.04,z+zz*d/2)],.025,gold)

def export(name):
    objects=list(bpy.context.scene.objects)
    for ob in objects:
        if ob.type=='CURVE':
            bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
        if ob.type=='MESH':
            bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(ob.data);bm.free()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,name+'.blend'))
    batches={};mats={}
    for ob in objects:
        if ob.type!='MESH':continue
        geo=ob.data;geo.calc_loop_triangles();nm=ob.matrix_world.to_3x3().inverted().transposed()
        for tri in geo.loop_triangles:
            m=geo.materials[tri.material_index];mats[m.name]=m
            b=batches.setdefault(m.name,dict(material=m.name,vertices=[],normals=[],triangles=[],uv=[]))
            normal=(nm@tri.normal).normalized()
            for vi in tri.vertices:
                p=ob.matrix_world@geo.vertices[vi].co;g=[p.x,p.z,-p.y];n=[normal.x,normal.z,-normal.y]
                b['triangles'].append(len(b['vertices'])//3);b['vertices']+=g;b['normals']+=n
                axis=max(range(3),key=lambda i:abs(n[i]));axes=[i for i in range(3) if i!=axis];b['uv']+=[g[axes[0]],g[axes[1]]]
    data=dict(materials=[dict(name=m.name,color=list(m.diffuse_color),metal=m.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value) for m in mats.values()],meshes=list(batches.values()))
    with open(os.path.join(OUT,name+'.json'),'w') as f:json.dump(data,f,separators=(',',':'))
    print(name, sum(len(b['triangles'])//3 for b in batches.values()),'triangles',flush=True)
    for ob in list(bpy.context.scene.objects):bpy.data.objects.remove(ob,do_unlink=True)

# First room: floor tiles stop precisely at the gameplay gap (Z=0..5).
tiles(-7,7,-7,0,0);tiles(-7,7,5,12,0)
for side in [-1,1]:
    for z in [-5,0,5,9.8]:column(side*6.35,z,base=-.02,height=5.0)
    for z in [-2.5,2.5,7.5]:
        arch(side*6.85,3.3,z,2.1,.38,True)
        for k in range(6):shard(side*(7.35+rng.random()*.4),-3.8,z-1.8+k*.68,.88,7+rng.random()*2)
    for row in range(4):
        for j in range(15):box('Wall masonry',(side*7.05,.4+row*.67,-6.4+j*1.25),(.38,.64,1.20),stone,bevel=.035)
    for z in [-5,0,5,9.8]:
        # Foundations reach the basin floor, not hovering at bank height.
        box('Substructure pier',(side*6.35,-2,z),(.98,4,1.05),dark,bevel=.02)
for z in [-5,0,5,9.8]:arch(0,5.0,z,6.0,.40)
for x in [-2.03,2.03]:column(x,10,height=3.2)
arch(0,3.2,10,1.65,.6)
for side in [-1,1]:
    for row in range(7):
        for j in range(4):box('Portal ashlar',(side*(2.6+j*1.15),.35+row*.65,10.05),(1.1,.61,.65),edge if row==6 else stone,bevel=.035)
basin(-3,.90,-1.7,1.6,1.6);basin(-5,.72,-3.7,1.3,1.3)
# Actual channel banks reveal the path from reservoir to crossing.
for x in [-1.56,1.56]:
    box('Water channel curb',(x,-.16,2.5),(.22,.32,5),edge,bevel=.03)
    for z in [.15,1.7,3.3,4.85]:box('Bronze channel clamp',(x,.015,z),(.28,.07,.18),gold,bevel=.01)
for z in [-.14,5.14]:box('Crossing threshold',(0,-.08,z),(3.25,.16,.26),edge,bevel=.025)
for x in [-3.88,-2.12]:box('Supply channel bank',(x,.12,-.75),(.12,.24,1.2),edge,bevel=.015)
for z in [-.55,-.30]:box('Feed channel edging',(-1.6,.02,z),(3.0,.13,.10),gold,bevel=.015)
# Rear glacial window beyond the exit, backed by frost rather than an empty blue void.
for i in range(9):shard(-3.8+i*.95,0,12.4,.9,6+rng.random()*2)
export('ice-hall-v02')

# Collection machinery: decorative geometry attaches to existing gameplay devices.
# Static lower kettle, supporting pipe elbows and platform fascia.
for x,z in [(1,-2.2),(4,-2.2)]:
    rod('Bronze vessel shell',(x,.08,z),(x,.70,z),.82 if x==1 else .74,gold,vertices=40)
    for y in [.12,.64,.79]:ring('Vessel rolled rim',(x,y,z),.84 if x==1 else .76,.055,gold,segments=40)
    for k in range(12):
        a=k*math.tau/12;rod('Vessel rivet',(x+.82*math.cos(a),.36,z+.82*math.sin(a)),(x+.86*math.cos(a),.36,z+.86*math.sin(a)),.025,edge,vertices=8)
# Architectural screen behind devices; frame the upper activity with real arches.
for x in [-7.8,7.8]:
    for z in [-4,2,8,13]:column(x,z,height=6)
for x in [-6,-2,2]:arch(x,1.0,6.05,1.5,.32)
for side in [-1,1]:
    for z in [-1,5,11]:arch(side*8.8,3.2,z,2.4,.40,True)
for x in [-3,3]:column(x,13.4,base=2.4,height=3.2)
arch(0,5.6,13.4,2.55,.4)
# Gallery edge railing leaves both stairs and exit bridge clear.
for a,b in [((-6.9,3.25,6),(-1.7,3.25,6)),((1.7,3.25,6),(2.9,3.25,6))]:
    line('Gallery handrail',[a,b],.045,gold)
    count=max(2,int(abs(b[0]-a[0])/.6))
    for i in range(count+1):
        x=a[0]+(b[0]-a[0])*i/count;rod('Gallery baluster',(x,2.4,6),(x,3.25,6),.026,gold,vertices=8)
export('collection-hall-v02')
# Collector shell exported locally, follows the existing movable plate.
for x in [-.62,.62]:box('Cooling plate rim',(x,0,0),(.06,.08,1.02),gold,bevel=.012)
for z in [-.49,.49]:box('Cooling plate rim',(0,0,z),(1.24,.08,.06),gold,bevel=.012)
for x in [-.45,-.22,0,.22,.45]:line('Condensation fluting',[(x,.12,-.43),(x,.04,0),(x,-.11,.43)],.018,gold)
export('collector-detail-v02')

# Door details in gate-local space. The whole assembly follows the authored opening motion.
for x in [-1.40,1.40]:box('Gate inset border',(x,0,-.225),(.10,2.85,.08),gold,bevel=.02)
for y in [-1.38,1.38]:box('Gate inset border',(0,y,-.225),(2.8,.10,.08),gold,bevel=.02)
ring('Water gate seal',(0,.05,-.27),.57,.045,gold,plane='xy',segments=48)
for row in range(3):line('Gate wave glyph',[(-.42+i*.042,-.14+row*.18+.055*math.sin(i*.44),-.285) for i in range(21)],.025,gold)
for x in [-.90,.90]:
    for y in [-1.05,-.60,.65,1.1]:box('Gate carved teal tessera',(x,y,-.24),(.16,.20,.04),blue,bevel=.02)
export('ice-gate-detail-v02')
for j in range(7):box('Bridge fitted stone',(0,-.12,-4.65+j*.7),(1.75,.24,.68),stone,bevel=.035)
for x in [-.84,.84]:box('Bridge bronze side beam',(x,-.1,-2.5),(.08,.26,5),gold,bevel=.015)
for z in [-4.7,-.3]:box('Bridge bronze hinge cap',(0,.025,z),(1.8,.06,.18),gold,bevel=.012)
export('return-bridge-detail-v02')
