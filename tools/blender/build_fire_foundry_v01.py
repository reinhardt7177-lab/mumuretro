"""Reviewed fire-map architecture + independently rigged foundry kit. Keep originals."""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'art/fire-temple/foundry-v01';ART.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'assets/models/fire-temple';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/fire-temple/v01/fire-temple-v01.blend'))
scene=bpy.context.scene
def v(p):return Vector((p[0],-p[2],p[1]))
def bounds(o):
    pts=[o.matrix_world@Vector(q) for q in o.bound_box]
    return {'min':[min(p.x for p in pts),min(p.z for p in pts),min(-p.y for p in pts)],'max':[max(p.x for p in pts),max(p.z for p in pts),max(-p.y for p in pts)]}
parts={k:[] for k in ['static','rotor','stand','wheel','slab','gate']};camera=[];pillars=[]
for o in list(scene.objects):
    if o.type not in ['MESH','CURVE']:continue
    b=bounds(o);x,y,z=[(a+c)/2 for a,c in zip(b['min'],b['max'])];n=o.name
    keep=(17.5<x<39 and -13<z<15) or (7<x<18.5 and 5.8<z<10.2)
    if not keep or n.startswith(('foundry bridge','Bridge bronze edge','Lava chute','Lava visible','Foundry control','Control axle','Foundry handwheel','Handwheel spoke','Visible control linkage','Far anchor','Caldera','Forged sun ray')):
        bpy.data.objects.remove(o,do_unlink=True);continue
    parts['static'].append(o)
    if n.startswith(('North wall core','Wing side core','Wing entry side core','South low parapet core','Column shaft')):camera.append(b)
    if n.startswith('Column shaft'):pillars.append({'x':x,'z':z,'r':.91})
basalt=bpy.data.materials['Basalt • charcoal'];edge=bpy.data.materials['Basalt • blue grey bevels'];bronze=bpy.data.materials['Bronze • forged warm'];dark=bpy.data.materials['Bronze • aged recess'];ash=bpy.data.materials['Ash stone • warm trim']
group='static'
def add(o,name,mat):o.name=name;o.data.materials.append(mat);parts[group].append(o);return o
def box(name,p,s,mat=bronze,bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=v(p));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);add(o,name,mat)
    if bevel:
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.bevel(bm,geom=list(bm.edges),offset=min(bevel,min(s)*.22),segments=2,affect='EDGES');bm.to_mesh(o.data);bm.free()
    return o
def rod(name,a,b,r,mat=bronze):
    a,b=v(a),v(b);bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return add(o,name,mat)
def ring(name,p,r,t,plane='xz',mat=bronze):
    pts=[]
    for i in range(49):
        a=i*math.tau/48;pts.append((p[0]+math.cos(a)*r,p[1]+(math.sin(a)*r if plane=='xy' else 0),p[2]+(math.sin(a)*r if plane=='xz' else 0)))
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=t;d.bevel_resolution=1;s=d.splines.new('POLY');s.points.add(len(pts)-1)
    for q,p in zip(s.points,pts):q.co=(*v(p),1)
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);return add(o,name,mat)
def trough(a,b):
    x,y,z=[(p+q)/2 for p,q in zip(a,b)];dx=abs(a[0]-b[0]);dz=abs(a[2]-b[2]);box('Forged trough base',(x,y-.12,z),(max(dx,.64),.16,max(dz,.64)),dark)
    if dx>.01:
        for side in [-1,1]:box('Chased trough lip',(x,y+.04,z+side*.30),(dx+.04,.24,.08))
    else:
        for side in [-1,1]:box('Chased trough lip',(x+side*.30,y+.04,z),(.08,.24,dz+.04))
    for k in range(max(1,round((dx+dz)/.75))):
        t=(k+.5)/max(1,round((dx+dz)/.75));xx=a[0]+(b[0]-a[0])*t;zz=a[2]+(b[2]-a[2])*t
        for side in [-1,1]:rod('Trough rivet',(xx+(side*.30 if dz else 0),y+.13,zz+(side*.30 if dx else 0)),(xx+(side*.30 if dz else 0),y+.18,zz+(side*.30 if dx else 0)),.028)

# A closed return pipe carries the far source to the safe near-bank controls.
for a,b in [((35,2.8,-9),(36.1,2.8,-9)),((36.1,2.8,-9),(36.1,2.8,11)),((36.1,2.8,11),(36.1,-.35,11)),((36.1,-.35,11),(20.7,-.35,11)),((20.7,-.35,11),(20.7,-.35,5.8)),((20.7,-.35,5.8),(20.7,2.8,5.8))]:rod('Closed supply pipe',a,b,.20,dark)
for x,z in [(36.1,-9),(36.1,5),(36.1,11),(20.7,5.8)]:
    box('Pipe rooted footing',(x,.14,z),(.65,.28,.65),basalt);rod('Pipe grounded support',(x,.28,z),(x,2.65,z),.10);ring('Pipe support collar',(x,2.7,z),.29,.04)
for a,b in [((20.7,2.8,5.8),(22.6,2.8,5.8)),((24,2.8,4.4),(24,2.8,3.6)),((24,2.8,3.6),(29.6,2.8,3.6)),((31,2.8,2.2),(31,2.8,1.5)),((31,2.8,1.5),(30.45,2.8,1.5))]:trough(a,b)
# The end pours down a vertical, enclosed spout into the bridge mould.
for side in [-1,1]:box('Spout cheek',(30.45+side*.32,1.5,1.5),(.10,2.6,.65),dark)
box('Spout rear',(30.45,1.5,1.82),(.65,2.6,.10),dark)
for x in [23.4,31.6]:
    box('Rotor bearing foot',(x,.14,5 if x<28 else 3.6),(.8,.28,.8),basalt);rod('Rotor headroom support',(x,.28,5 if x<28 else 3.6),(x,2.6,5 if x<28 else 3.6),.09)
for x in [25.94,30.06]:
    box('Mould bronze rim',(x,-.03,0),(.18,.20,6.5));box('Mould side',(x,-.42,0),(.24,.65,6.5),dark)
for z in [-3.18,3.18]:box('Mould end frame',(28,-.06,z),(4.3,.15,.12))
box('Empty mould bottom',(28,-.66,0),(4.05,.12,6.4),dark)
for x in [26.3,29.7]:
    for z in [-2.7,2.7]:box('Mould foundation pier',(x,-1.8,z),(.6,2.4,.65),basalt)
for x in [21.5,34.5]:
    box('Foundry carved plinth',(x,.65,-10),(1.3,1.3,.8),basalt);ring('Foundry sun relief',(x,1.1,-9.56),.46,.045,plane='xy')
group='rotor'
trough((-1.4,0,0),(0,0,0));trough((0,0,0),(0,0,-1.4));rod('Rotor spindle',(0,-1.55,0),(0,-.15,0),.10);ring('Rotor chased bearing',(0,-.20,0),.40,.045)
group='stand'
box('Handwheel pedestal',(0,.46,0),(.95,.92,.72),basalt);box('Handwheel trim',(0,.93,0),(1.02,.12,.80));rod('Handwheel socket',(0,1.25,-.12),(0,1.25,.28),.13,dark)
group='wheel'
ring('Cast handwheel',(0,0,0),.43,.065,plane='xy')
for i in range(6):
    a=i*math.tau/6;rod('Handwheel spoke',(0,0,0),(math.cos(a)*.40,math.sin(a)*.40,0),.029)
rod('Handwheel hub',(0,0,-.08),(0,0,.10),.10)
group='slab'
for i in range(2):
    for j in range(4):box('New basalt paving',(-.98+i*1.96,-.25,-2.39+j*1.59),(1.94,.5,1.57),edge,.055)
group='gate'
for z in [-1.6,-.8,0,.8,1.6]:box('Gate vertical bronze',(.0,1.7,z),(.16,3.4,.12))
for y in [.2,1.6,3.2]:box('Gate horizontal frame',(0,y,0),(.2,.14,3.9))

origins={k:[0,0,0] for k in parts}
deps=bpy.context.evaluated_depsgraph_get()
metrics={'floorTop':max(bounds(o)['max'][1] for o in parts['slab']),'rotorBottom':min(bounds(o)['min'][1]+2.8 for o in parts['rotor'] if not o.name.startswith('Rotor spindle')),'spoutMinX':min(bounds(o)['min'][0] for o in parts['static'] if o.name.startswith('Spout')),'parts':{k:len(a) for k,a in parts.items()}}
assert abs(metrics['floorTop'])<.0001,metrics
assert metrics['spoutMinX']>30,metrics
scene['reference']='../v01/concept-overview.png + foundry-v01/DESIGN.md'
scene['status']='Foundry architecture and local-origin dynamic kit. Lava and cooling are web shaders.'
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'foundry-v01.blend'))
for key,targets in parts.items():
    batches={}
    for source in targets:
        ev=source.evaluated_get(deps);me=bpy.data.meshes.new_from_object(ev);o=bpy.data.objects.new('Export '+source.name,me);scene.collection.objects.link(o);o.matrix_world=source.matrix_world.copy();batches.setdefault(o.data.materials[0].name,[]).append(o)
    joined=[]
    for mat,items in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in items:o.select_set(True)
        bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();items[0].name='Foundry '+mat;joined.append(items[0])
    bpy.ops.object.select_all(action='DESELECT')
    for o in joined:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/('foundry-'+key+'-v01.glb')),export_format='GLB',use_selection=True,export_lights=False,export_cameras=False)
    for o in joined:bpy.data.objects.remove(o,do_unlink=True)
    print('FOUNDRY_EXPORT',key,len(targets),len(batches),flush=True)
solids=[]
for o in parts['static']:
    if not o.name.startswith(('Pipe rooted footing','Rotor bearing foot','Spout')):continue
    b=bounds(o);solids.append({'x':(b['min'][0]+b['max'][0])/2,'z':(b['min'][2]+b['max'][2])/2,'r':max(b['max'][0]-b['min'][0],b['max'][2]-b['min'][2])/2})
manifest={'version':1,'source':'art/fire-temple/foundry-v01/foundry-v01.blend','cameraOccluders':camera,'pillars':pillars,'solids':solids,'metrics':metrics,'controls':[[24,7],[31,7]],'rotors':[[24,2.8,5.8],[31,2.8,3.6]],'valve':[35,9],'anchor':[28,-8],'bridge':{'x':28,'z0':-3,'z1':3,'width':4,'top':0}}
(OUT/'foundry-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');(ART/'geometry-check.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
print('FOUNDRY_READY',json.dumps(metrics),flush=True)
