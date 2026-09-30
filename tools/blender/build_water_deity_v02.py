"""Versioned water deity: sculpted profile, layered vestments, smooth-normal export."""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
from asset_detail_helpers import ROOT, vec, material, mesh, line, ring
ART=os.path.join(ROOT,'art/water-sanctuary/v02')
OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/WaterInterior')
os.makedirs(ART,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
skin=material('Deity V02 porcelain',(.63,.69,.68),0,.4)
cloth=material('Deity V02 midnight teal',(.016,.085,.12),.05,.65)
lining=material('Deity V02 glacier silk',(.24,.43,.48),.1,.5)
ivory=material('Deity V02 pearl vestment',(.62,.68,.65),.05,.55)
gold=material('Deity V02 chased gold',(.57,.35,.12),.72,.3)
hair=material('Deity V02 silver hair',(.35,.49,.53),.18,.45)
dark=material('Deity V02 eyelids',(.06,.12,.14),0,.7)
lips=material('Deity V02 lips',(.32,.37,.36),0,.6)
gem=material('Deity V02 aquamarine',(.04,.5,.66),.35,.2)

def smooth(o):
    for p in o.data.polygons:p.use_smooth=True
    return o

def ell(name,p,s,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=vec(p))
    o=bpy.context.object;o.name=name;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat);return smooth(o)

def surf(name,fn,nu,nv,mat,thickness=0):
    v=[fn(i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)]
    f=[]
    for j in range(nv):
        for i in range(nu):
            k=j*(nu+1)+i;f.append((k,k+1,k+nu+2,k+nu+1))
    o=smooth(mesh(name,v,f,mat))
    if thickness:
        m=o.modifiers.new('Fabric thickness','SOLIDIFY');m.thickness=thickness
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
    return o

def curve(name,points,r,mat):
    # Catmull-Rom interpolation: readable continuous hair, hems and fingers.
    p=[Vector(x) for x in points];out=[]
    for i in range(len(p)-1):
        a=p[max(0,i-1)];b=p[i];c=p[i+1];d=p[min(len(p)-1,i+2)]
        steps=3 if len(p)>10 else 8
        for j in range(steps):
            t=j/steps;out.append(tuple(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)))
    out.append(tuple(p[-1]));return line(name,out,r,mat)

def drop(name,p,size,mat):
    def shape(u,v):
        a=u*math.tau;y=v*2-1;r=math.sin(math.pi*v)*(1-.55*v)
        return(p[0]+size*r*math.cos(a),p[1]+size*y,p[2]+size*.48*r*math.sin(a))
    return surf(name,shape,28,24,mat)

# Profile-defined face: chin, jaw, cheekbones, temples and forehead are distinct.
profiles=[(2.57,.025,.065),(2.60,.075,.095),(2.65,.117,.125),(2.73,.155,.145),(2.81,.175,.15),(2.91,.17,.147),(3.02,.162,.14),(3.10,.135,.12),(3.15,.065,.065),(3.16,.001,.001)]
def profile(y):
    for (a,w,d),(b,w2,d2) in zip(profiles,profiles[1:]):
        if a<=y<=b:
            t=(y-a)/(b-a);return(w+(w2-w)*t,d+(d2-d)*t)
    return profiles[-1][1:]
def face(u,v):
    y=2.57+.59*v;w,d=profile(y);a=u*math.tau;x=w*math.sin(a);z=-d*math.cos(a)
    front=max(0,math.cos(a))**8
    # brows/cheeks and eye sockets; smooth displacement on the same skin surface.
    z+=front*(.017*math.exp(-((y-2.88)/.037)**2)-.012*math.exp(-((y-2.79)/.04)**2))
    return(x,y,z)
surf('Sculpted jaw cheeks and forehead',face,64,64,skin)
ell('Slender neck',(0,2.54,.025),(.096,.23,.092),skin)
ell('Upper torso under vestment',(0,2.27,.025),(.245,.30,.14),ivory)
# Tapered nose bridge integrated in front of the profile.
surf('Nose bridge alar contour',lambda u,v:((u*2-1)*(.025+.017*math.sin(v*math.pi)),2.75+.19*v,-.145-(.018+.065*math.sin(v*math.pi)**1.2)*math.sin(u*math.pi)),20,24,skin)
for s in [-1,1]:
    ell('Nose wing',(s*.028,2.765,-.174),(.019,.016,.02),skin)
    ell('Sculpted ear',(s*.169,2.83,.008),(.025,.065,.031),skin)
    curve('Closed eyelid',[(s*.039,2.878,-.142),(s*.078,2.87,-.137),(s*.122,2.882,-.106)],.005,dark)
    curve('Brow ridge',[(s*.036,2.945,-.15),(s*.075,2.952,-.143),(s*.13,2.935,-.112)],.008,hair)
    curve('Upper lip bow',[(0,2.704,-.153),(s*.017,2.709,-.153),(s*.043,2.701,-.14)],.006,lips)
curve('Lower lip', [(-.037,2.696,-.144),(0,2.688,-.156),(.037,2.696,-.144)],.007,skin)

# Floor-length pleated underdress and an open-front overcoat; shoulder to waist profile.
def radius(v):return .22+.62*(1-v)**2+.09*math.exp(-((v-.95)/.13)**2)
def robe(u,v):
    a=u*math.tau;r=radius(v)+(.015+.022*(1-v))*math.cos(a*18+.9*v)
    return(r*math.sin(a),.015+2.4*v,-r*.62*math.cos(a))
surf('Pearl pleated underdress',robe,96,52,ivory,.012)
def coat(u,v):
    a=.43+u*(math.tau-.86);r=radius(v)+.065+.035*math.cos(a*12+2*v)
    return(r*math.sin(a),.018+2.4*v,-r*.68*math.cos(a))
surf('Open layered midnight robe',coat,88,48,cloth,.018)
for edge in [0,1]:
    curve('Heavy golden coat border',[coat(edge,i/48) for i in range(49)],.013,gold)
curve('Floor hem gold piping',[coat(i/88,0) for i in range(89)],.012,gold)
# Waist bands and a central front ornamental stole following the dress surface.
for y in [1.94,2.04]:
    v=(y-.015)/2.4;r=radius(v)+.09
    surf('Contoured gold belt',lambda u,w,y=y,r=r:(r*math.sin(u*math.tau),y+w*.025,-r*.7*math.cos(u*math.tau)),64,1,gold)
drop('Waist droplet jewel',(0,1.99,-.25),.105,gem)
for s in [-1,1]:
    curve('Crossed chest braid',[(s*.16,2.5,-.1),(s*.11,2.29,-.18),(s*.03,2.14,-.235),(-s*.14,2.01,-.22)],.016,gold)
    # Engraved large wave motifs follow the open coat edges.
    for i in range(8):
        v=.07+i*.1
        pts=[]
        for j in range(25):
            t=j/24;a=(.46+.12*math.sin(t*math.pi*2))*s;r=radius(v+t*.065)+.077
            pts.append((r*math.sin(a),.018+2.4*(v+t*.065),-r*.68*math.cos(a)-.015))
        curve('Raised coat wave embroidery',pts,.006,gold)

# Anatomical bent arms and curved fingers, with wide draped sleeves underneath.
for s in [-1,1]:
    shoulder=(s*.26,2.38,.015);elbow=(s*.49,2.07,-.11);wrist=(s*.34,1.99,-.49)
    curve('Anatomical upper arm',[shoulder,(s*.37,2.24,-.035),elbow],.082,skin)
    curve('Tapered forearm',[elbow,(s*.43,2.015,-.31),wrist],.059,skin)
    ell('Offering palm',(s*.29,2.00,-.55),(.09,.036,.085),skin)
    for i in range(4):
        x=s*(.238+i*.035);z=-.59
        curve('Articulated finger',[(x,2,z),(x-s*.018,2.018,z-.055),(x-s*.024,2.04,z-.078)],.012,skin)
    curve('Opposed thumb',[(s*.36,2,-.53),(s*.38,2.04,-.58),(s*.35,2.06,-.62)],.016,skin)
    # Wide fabric curtain folds between shoulder and forearm, away from hands.
    def sleeve(u,v,s=s):
        x=s*(.29+.23*u+.11*math.sin(v*math.pi));top=2.37-.34*u
        return(x,top-v*(.7+.43*math.sin(u*math.pi)),.015-.38*u+.035*math.cos(u*math.pi*10)*math.sin(v*math.pi))
    surf('Hanging glacier silk sleeve',sleeve,40,32,lining,.016)
    for edge in [0,1]:curve('Sleeve edge gold',[sleeve(edge,i/32) for i in range(33)],.012,gold)
    curve('Sleeve scalloped lower hem',[sleeve(i/40,1) for i in range(41)],.013,gold)
    def shoulderplate(u,v,s=s):
        a=-.65*math.pi+v*1.3*math.pi
        return(s*(.20+.28*u),2.36+.085*math.cos(a)-.18*u*u,(.135+.075*u)*math.sin(a))
    surf('Curved shoulder mantle',shoulderplate,24,24,cloth,.025)
    curve('Mantle gold outer scallop',[shoulderplate(1,i/32) for i in range(33)],.01,gold)
    for e in [0,1]:curve('Mantle fitted rim',[shoulderplate(i/24,e) for i in range(25)],.008,gold)
    for k in range(3):
        curve('Shoulder engraved waves',[shoulderplate(.20+k*.23+.055*math.sin(i/24*math.tau),i/24) for i in range(25)],.005,gold)

# Hair uses tapered swept ribbons, rather than a sphere helmet or straight rods.
def scalp(u,v):
    a=u*math.tau;theta=v*math.pi*.53
    return(.176*math.sin(theta)*math.sin(a),2.95+.218*math.cos(theta),.023-.158*math.sin(theta)*math.cos(a))
surf('Fitted swept hair crown',scalp,48,20,hair,.006)
for i in range(17):
    a=-math.pi*.65+i/16*math.pi*1.3
    def strand(u,v,a=a,i=i):
        x=.16*math.sin(a)+(.06+.12*v)*math.sin(v*5+i*.47)*v
        y=3.10-1.90*v;z=.10+.13*v+.10*math.sin(v*4+i*.3)*v
        width=(.045+.02*math.sin(i))*math.sin(math.pi*(.08+.92*v))
        return(x+(u*2-1)*width,y,z-.018*math.sin(u*math.pi))
    surf('Swept silver hair strand',strand,5,40,hair,.01)
for s in [-1,1]:
    for i in range(3):
        curve('Temple swept hair',[(s*.025,3.15,.025),(s*.13,3.105,-.08+i*.035),(s*.197,2.99,.015+i*.04),(s*.21,2.67,.09+i*.03),(s*.33,2.35,.15)],.02,hair)
    curve('Drop earring chain',[(s*.188,2.80,-.01),(s*.195,2.69,-.025)],.005,gold)
    drop('Earring aquamarine',(s*.195,2.65,-.025),.04,gem)

# Crown and engraved shoulder halo.
ring('Crown circlet',(0,3.04,0),.18,.014,gold,segments=64)
for s in [-1,0,1]:
    x=s*.12
    curve('Three stream crown',[(x,3.035,-.14),(x+s*.03,3.16,-.1),(x*.85,3.28,-.045),(x,3.39-.055*abs(s),-.015)],.013,gold)
drop('Forehead jewel',(0,3.005,-.161),.048,gem)
for r in [.64,.68]:ring('Engraved gold halo',(0,2.82,.35),r,.014,gold,plane='xy',segments=128)
for i in range(14):
    a=i*math.tau/14
    pts=[]
    for j in range(25):
        t=j/24;r=.66+.012*math.sin(t*math.tau);ang=a+t*.3
        pts.append((r*math.sin(ang),2.82+r*math.cos(ang),.331))
    curve('Halo wave engraving',pts,.006,gold)
drop('Halo zenith droplet',(0,3.5,.35),.085,gem)
drop('Offering water droplet',(0,2.02,-.57),.14,gem)

# Bake editable curves, preserve smooth corner normals in Unity JSON.
for ob in list(bpy.context.scene.objects):
    if ob.type=='CURVE':
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH');smooth(ob)
    if ob.type=='MESH':
        bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(ob.data);bm.free()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,'water-deity-v02.blend'))
batches={};mats={};bounds=[];indices={}
for ob in bpy.context.scene.objects:
    if ob.type!='MESH':continue
    geo=ob.data;geo.calc_loop_triangles();nm=ob.matrix_world.to_3x3().inverted().transposed()
    for tri in geo.loop_triangles:
        m=geo.materials[tri.material_index];mats[m.name]=m
        b=batches.setdefault(m.name,dict(material=m.name,vertices=[],normals=[],triangles=[],uv=[]))
        for li in tri.loops:
            loop=geo.loops[li];p=ob.matrix_world@geo.vertices[loop.vertex_index].co
            n=(nm@geo.corner_normals[li].vector).normalized();g=[p.x,p.z,-p.y];bounds.append(g)
            normal=[n.x,n.z,-n.y];key=tuple(round(x,6) for x in g+normal)
            lookup=indices.setdefault(m.name,{})
            if key not in lookup:
                lookup[key]=len(b['vertices'])//3;b['vertices']+=list(key[:3]);b['normals']+=list(key[3:]);b['uv']+=[round(g[0],6),round(g[1],6)]
            b['triangles'].append(lookup[key])
data=dict(materials=[dict(name=m.name,color=list(m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value),metal=m.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value) for m in mats.values()],meshes=list(batches.values()))
with open(os.path.join(OUT,'water-deity-v02.json'),'w') as f:json.dump(data,f,separators=(',',':'))
stats=dict(triangles=sum(len(b['triangles'])//3 for b in batches.values()),materials=len(mats),minimum=[min(p[i] for p in bounds) for i in range(3)],maximum=[max(p[i] for p in bounds) for i in range(3)])
with open(os.path.join(ART,'geometry-check.json'),'w') as f:json.dump(stats,f,indent=2)
print('DEITY_V02',stats,flush=True)
