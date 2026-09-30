"""Glacier water sanctuary v03: editable Blender source and material-batched Unity assets."""
import bpy,bmesh,math,os,sys,json,random
from mathutils import Vector,noise
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,vec,material,mesh,box,rod,ring,line
ART=os.path.join(ROOT,'art/glacier-water-temple/v03');OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/WaterMountain');rng=random.Random(930)
os.makedirs(ART,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
stone=material('Glacier temple limestone',(.57,.55,.46),0,.86)
light=material('Glacier temple worn edges',(.72,.70,.60),0,.78)
bronze=material('Glacier temple bronze',(.30,.18,.075),.65,.36)
inlay=material('Glacier temple turquoise',(.025,.25,.25),.25,.38)
ice=material('Glacier deep blue ice',(.09,.39,.52),.12,.22)
frost=material('Glacier pale frost',(.43,.74,.80),.05,.32)
deep=material('Glacier temple recess',(.025,.055,.068),0,.95)
sealmat=material('Glacier thawable seal',(.25,.61,.72),.12,.25)
# 7.2m facade, 4.8m depth; thresholds and true curved doorway follow the plan.
box('Stone foundation',(0,.55,1.925),(7.2,1.1,5.75),stone,bevel=.10)
for i in range(3):box('Approach stair %d'%i,(0,(i+1)*.275/2,-2.4+i*.6),(2.4,(i+1)*.275,.64),light,bevel=.045)
box('Portal threshold',(0,1.1,-.10),(3.8,.14,.7),light,bevel=.035)
for side in [-1,1]:
    box('Sanctuary side wall',(side*2.95,3.35,2.4),(1.3,4.5,4.8),stone,bevel=.08)
box('Inner shadow wall',(0,3.3,4.65),(5.7,4.3,.3),deep,bevel=.04)
# Columns: bevelled foot/capital tiers, separate fine vertical flutes.
for x,z in [(-3.12,-.35),(-2.5,-.48),(2.5,-.48),(3.12,-.35)]:
    for y,r,h in [(1.23,.47,.22),(1.43,.38,.16),(4.88,.38,.16),(5.10,.47,.32)]:
        rod('Column stone collar',(x,y-h/2,z),(x,y+h/2,z),r,light,vertices=32)
    rod('Fluted column shaft',(x,1.51,z),(x,4.80,z),.29,stone,vertices=32)
    for k in range(14):
        a=k*math.tau/14;rod('Raised column fluting',(x+math.cos(a)*.291,1.65,z+math.sin(a)*.291),(x+math.cos(a)*.291,4.65,z+math.sin(a)*.291),.024,light,vertices=8)
    for y in [1.52,4.78,5.18]:ring('Bronze column band',(x,y,z),.35,.019,bronze,segments=48)
    for k in range(8):
        a=k*math.tau/8;box('Turquoise capital inset',(x+math.cos(a)*.36,4.98,z+math.sin(a)*.36),(.065,.13,.065),inlay,bevel=.018)
# Arched voussoirs and continuous bronze trim; clear radius 1.675, arch spring 3.545.
r=1.675;spring=3.545
for side in [-1,1]:
    for k in range(6):box('Carved arch jamb',(side*1.875,1.32+k*.38,-.12),(.40,.36,.54),light,bevel=.025)
for i in range(17):
    a=i*math.pi/17+.012;b=(i+1)*math.pi/17-.012
    verts=[]
    for z in [-.42,.12]:
        for rr,ang in [(r,a),(r+.39,a),(r+.39,b),(r,b)]:verts.append((math.cos(ang)*rr,spring+math.sin(ang)*rr,z))
    mesh('Arch carved wedge',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],light)
line('Arched bronze inner molding',[(-r,1.12,-.44),(-r,spring,-.44)]+[(math.cos(math.pi-i*math.pi/64)*r,spring+math.sin(math.pi-i*math.pi/64)*r,-.44) for i in range(65)]+[(r,1.12,-.44)],.024,bronze)
for y,w,h in [(5.37,7.2,.24),(5.60,7.5,.18),(5.77,7.7,.16)]:box('Layered carved cornice',(0,y,1.95),(w,h,5.85),light,bevel=.05)
# Wave frieze across the facade, echoed on both side walls.
for row in range(2):
    pts=[(-3.3+i*.055,5.31+row*.16+.06*math.sin(i*.22),-1.01) for i in range(121)]
    line('Wave frieze inlay',pts,.023,inlay)
ring('Water crest bronze rim',(0,5.42,-1.05),.34,.035,bronze,plane='xy',segments=64)
for row in range(3):line('Water crest wave',[(-.23+i*.023,5.30+row*.11+.027*math.sin(i*.45),-1.06) for i in range(21)],.016,inlay)
# Carved cornice teeth, stone joint courses and water insignia.
for k in range(27):box('Cornice carved dentil',(-3.38+k*.26,5.19,-.69),(.13,.17,.36),stone,bevel=.018)
for side in [-1,1]:
    for y in [.30,.61,.91]:box('Foundation stone course',(side*2.65,y,-.953),(1.82,.022,.024),bronze,bevel=.004)
    for k in range(3):
        x=side*(2.04+k*.065)
        line('Water arch side scroll',[(x+side*.07*math.sin(i*.21),1.65+i*.065,-.44) for i in range(37)],.012,bronze)
rod('Crest enamel backing',(0,5.42,-1.035),(0,5.42,-1.065),.31,inlay,vertices=64)
line('Water crest trident stem',[(0,5.18,-1.095),(0,5.65,-1.095)],.018,bronze)
for side in [-1,1]:
    line('Water crest trident branch',[(0,5.38,-1.095),(side*.15,5.42,-1.095),(side*.18,5.61,-1.095)],.017,bronze)
stone_objs=set(bpy.context.scene.objects)
# Angular fractured slabs rise from a shared ground datum: no spheres/remeshing.
# Each slab is a sheared polygonal solid, with ledges and uneven fracture planes.
def slab(name,cx,cz,w,d,h,lean=.12):
    outline=[(-.48,-.5),(.12,-.55),(.48,-.33),(.52,.22),(.29,.5),(-.22,.53),(-.51,.29),(-.55,-.15)]
    verts=[];heights=[-.12,h*.17,h*.36,h*.56,h*.76,h*.91,h]
    offsets=[0,.015,-.055,.025,-.035,.06,lean]
    for level,y in enumerate(heights):
        for k,(x,z) in enumerate(outline):
            shift=(rng.random()-.5)*.11 if level else 0
            yy=y+(rng.uniform(-.25,.25) if level==6 else 0)
            verts.append((cx+(x+offsets[level]+shift)*w,yy,cz+(z+shift)*d))
    faces=[tuple(range(7,-1,-1))]
    for j in range(6):
        for k in range(8):faces.append((j*8+k,j*8+(k+1)%8,(j+1)*8+(k+1)%8,(j+1)*8+k))
    faces.append(tuple(range(48,56)))
    ob=mesh(name,verts,faces,ice);ob.data.materials.append(frost)
    for p in ob.data.polygons:p.material_index=1 if p.index==len(faces)-1 else 0
    # Chip the broad fracture planes at a second scale while retaining the block silhouette.
    bm=bmesh.new();bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=2,use_grid_fill=True)
    bm.normal_update()
    for v in bm.verts:
        if v.co.z>.08:
            amount=noise.noise_vector(v.co*2.7)[0]*.042+noise.noise_vector(v.co*8.1)[1]*.012
            v.co+=v.normal*amount
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    return ob
for side in [-1,1]:
    for k in range(4):
        slab('Sheared glacial wall',side*(4.4+[.05,-.28,.12,-.16][k]),.25+k*1.65,2.35,2.22,5.7+[.35,1.4,.05,.95][k],side*.05)
    for k in range(3):
        slab('Grounded broken ice ledge',side*(4.15+k*.65),-1.10+k*.45,1.65,2.3,1.2+k*.46,side*.13)
# Back wall and roof crevasses: irregular broad slabs with flat broken tops.
for k in range(4):slab('Rear glacier fracture',-3+k*2.05,6.2,2.45,2.4,6.2+[.5,1.15,.2,.8][k],.07)
for k in range(5):
    before=set(bpy.context.scene.objects)
    ob=slab('Roof overhanging ice shelf',-3.2+k*1.6,1.9+(.45 if k%2 else 0),1.95,4.8,.6+(.28 if k%2 else 0),.12)
    # Move slab plus its newly-created fracture curves together.
    for added in set(bpy.context.scene.objects)-before:added.location.z+=5.85
# Icicles hang from the roof edge; short, asymmetric, attached at their wide ends.
for k in range(31):
    x=-3.65+k*.24;top=5.91;length=rng.uniform(.16,.72)
    if abs(x)<1.4:length*=.38
    bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=.003,radius2=.045,depth=length,location=vec((x,top-length/2,-.50)))
    bpy.context.object.name='Attached roof icicle';bpy.context.object.data.materials.append(frost)
static_objs=set(bpy.context.scene.objects)
# One curved closed ice plug, not a grid of shrinking cubes. Local UV encodes melt radius.
verts=[];faces=[];NX=40;NY=36
for back in [False,True]:
    for j in range(NY+1):
        t=j/NY
        for i in range(NX+1):
            x=-r+2*r*i/NX;y=1.12+t*(spring+math.sqrt(max(0,r*r-x*x))-1.12)
            z=.18 if back else -.34-.17*math.sin(math.pi*t)*(1-(x/r)**2)
            verts.append((x,y,z))
L=(NX+1)*(NY+1)
for j in range(NY):
    for i in range(NX):
        a=j*(NX+1)+i;b=a+1;c=a+NX+2;dd=a+NX+1;faces += [(a,dd,c,b),(a+L,b+L,c+L,dd+L)]
for i in range(NX):faces += [(i,i+1,i+1+L,i+L),(NY*(NX+1)+i,NY*(NX+1)+i+L,NY*(NX+1)+i+1+L,NY*(NX+1)+i+1)]
for j in range(NY):
    for i in [0,NX]:a=j*(NX+1)+i;b=a+NX+1;faces.append((a,a+L,b+L,b))
seal=mesh('Continuous arched thaw seal',verts,faces,sealmat)
# Convert curves, fix normals, export evaluated geometry consistently.
for ob in list(bpy.context.scene.objects):
    if ob.type=='CURVE':
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
    if ob.type=='MESH':
        bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(ob.data);bm.free()
def export(objects,name,origin=None):
    deps=bpy.context.evaluated_depsgraph_get();batches={};mats={}
    for ob in objects:
        if ob.type!='MESH':continue
        ev=ob.evaluated_get(deps);geo=ev.to_mesh();geo.calc_loop_triangles();nm=ev.matrix_world.to_3x3().inverted().transposed()
        for tri in geo.loop_triangles:
            mat=ob.data.materials[geo.polygons[tri.polygon_index].material_index];mats[mat.name]=mat
            b=batches.setdefault(mat.name,dict(material=mat.name,vertices=[],normals=[],triangles=[],uv=[]))
            for vi in tri.vertices:
                p=ev.matrix_world@geo.vertices[vi].co;n=(nm@tri.normal).normalized();g=[p.x,p.z,-p.y]
                if origin:g=[g[i]-origin[i] for i in range(3)]
                b['triangles'].append(len(b['vertices'])//3);b['vertices']+=g;b['normals'] += [n.x,n.z,-n.y];b['uv'] += [g[0]/r,g[1]/2.05] if origin else [p.x*.5,p.z*.5]
        ev.to_mesh_clear()
    data=dict(materials=[dict(name=m.name,color=list(m.diffuse_color),metal=m.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value) for m in mats.values()],meshes=list(batches.values()))
    with open(os.path.join(OUT,name),'w') as f:json.dump(data,f,separators=(',',':'))
    print(name,sum(len(b['triangles'])//3 for b in batches.values()),'triangles')
export(static_objs,'glacier-temple-v03.json');export([seal],'glacier-seal-v03.json',(0,3.17,-.1))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
scene.world=bpy.data.worlds.new('Glacial blue daylight');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.30,.43,.56,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
for pos,energy,size in [((-8,13,-10),2600,7),((9,10,5),3200,8)]:
    bpy.ops.object.light_add(type='AREA',location=vec(pos));ob=bpy.context.object;ob.data.energy=energy;ob.data.size=size;ob.rotation_euler=(vec((0,3,1))-ob.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=vec((12,9,-16)));cam=bpy.context.object;cam.rotation_euler=(vec((0,3,1.6))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=14;scene.camera=cam
scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,'glacier-water-temple-v03.blend'))
scene.render.filepath=os.path.join(ART,'blender-frozen.png');bpy.ops.render.render(write_still=True)
seal.hide_render=True;scene.render.filepath=os.path.join(ART,'blender-open.png');bpy.ops.render.render(write_still=True)
