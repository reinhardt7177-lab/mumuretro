"""Preserve the reviewed map; export a hinged bridge and local-origin moving lift."""
import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];ART=ROOT/'art/fire-temple/steam-v01';ART.mkdir(parents=True,exist_ok=True);OUT=ROOT/'assets/models/fire-temple'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/fire-temple/v01/fire-temple-v01.blend'))
scene=bpy.context.scene
def v(p):return Vector((p[0],-p[2],p[1]))
def bounds(o):
 p=[o.matrix_world@Vector(q) for q in o.bound_box];return {'min':[min(q.x for q in p),min(q.z for q in p),min(-q.y for q in p)],'max':[max(q.x for q in p),max(q.z for q in p),max(-q.y for q in p)]}
parts={k:[] for k in ['static','bridge','turbine','lift','rail']};camera=[];pillars=[]
for o in list(scene.objects):
 if o.type not in ['MESH','CURVE']:continue
 b=bounds(o);x,y,z=[(a+c)/2 for a,c in zip(b['min'],b['max'])];n=o.name
 keep=(abs(x)<13 and -37.6<z<-16.5) or (abs(x)<3.5 and -17.5<z<-12) or (n.startswith('upper passage') and -41.1<z<-37)
 if not keep or n.startswith(('Latched access bridge','Lift platform','Steam diverter','Valve spoke','Enclosed steam pipe','Upper passage lintel')):bpy.data.objects.remove(o,do_unlink=True);continue
 if n.startswith(('Turbine radial blade','Turbine hub','Turbine rim')):parts['turbine'].append(o);continue
 parts['static'].append(o)
 if n.startswith(('Wing side core','South low parapet core','Upper passage jamb core','Upper passage lintel core','Column shaft')):camera.append(b)
 if n.startswith('Column shaft'):pillars.append({'x':x,'z':z,'r':.91})
basalt=bpy.data.materials['Basalt • charcoal'];edge=bpy.data.materials['Basalt • blue grey bevels'];bronze=bpy.data.materials['Bronze • forged warm'];dark=bpy.data.materials['Bronze • aged recess'];ash=bpy.data.materials['Ash stone • warm trim'];group='static'
def add(o,n,m):o.name=n;o.data.materials.append(m);parts[group].append(o);return o
def box(n,p,s,m=bronze,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=v(p));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);add(o,n,m)
 if bevel:
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.bevel(bm,geom=list(bm.edges),offset=min(bevel,min(s)*.22),segments=2,affect='EDGES');bm.to_mesh(o.data);bm.free()
 return o
def rod(n,a,b,r,m=bronze):
 a,b=v(a),v(b);bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return add(o,n,m)
def tube(n,pts,r=.14,m=bronze):
 d=bpy.data.curves.new(n,'CURVE');d.dimensions='3D';d.bevel_depth=r;d.bevel_resolution=1;s=d.splines.new('POLY');s.points.add(len(pts)-1)
 for q,p in zip(s.points,pts):q.co=(*v(p),1)
 o=bpy.data.objects.new(n,d);scene.collection.objects.link(o);return add(o,n,m)
box('North hub threshold apron',(0,-.21,-11.7),(4.8,.5,2.6),edge)
header=box('Raised upper passage lintel',(0,7.6,-37),(6.4,.8,.7),ash);camera.append(bounds(header))
for x,z in [(-9.5,-19.8),(10,-31.2)]:
 box('Boiler rooted base',(x,.18,z),(1.3,.36,1.2),basalt);rod('Closed pressure vessel',(x,.36,z),(x,2.3,z),.48,dark)
 for y in [.6,1.1,1.7,2.1]:rod('Vessel forged band',(x,y-.055,z),(x,y+.055,z),.51)
tube('Source pressure pipe',[(-9.5,1,-19.8),(-6,1,-19.8),(-6,1,-21)])
tube('Bridge pressure branch',[(-6,1,-21),(-8.5,1,-21),(-8.5,1,-27),(-7,2.4,-27)])
tube('Lift pressure branch',[(-6,1,-21),(-6,-.3,-21),(10,-.3,-21),(10,-.3,-31.2),(10,2,-31.2),(8.8,2,-31.2)])
for x in [5,9]:
 for z in [-33,-29.4]:box('Guide grounded socket',(x,.15,z),(.6,.3,.6),basalt)
 box('Lift front fissure pier',(x,-1.5,-29.4),(.64,3,.64),basalt)
for x in [-8.1,-5.9]:
 box('Turbine fissure footing',(x,-2.85,-27.4),(.9,.3,1.2),basalt);rod('Turbine rooted support',(x,-2.7,-27.4),(x,.7,-27.4),.22,dark)
box('Upper call supported pier',(9.4,1.6,-34.5),(.6,3.2,.6),basalt)
for x in [-3.25,3.25]:box('Future portal jamb',(x,5.1,-40.8),(.65,3.8,.8),basalt)
portal_top=box('Future portal lintel',(0,7.1,-40.8),(7.1,.5,.9),ash);camera.append(bounds(portal_top))
# Safe balcony perimeter, leaving its actual north passage and lift exit open.
for x in [-11.7,11.7]:
 for z in [-36.5,-33.4]:rod('Upper parapet post',(x,3.2,z),(x,4.3,z),.07)
 rod('Upper parapet rail',(x,4.25,-36.7),(x,4.25,-33.3),.055)
for a,b in [((-11.7,4.25,-33.1),(5.05,4.25,-33.1)),((8.95,4.25,-33.1),(11.7,4.25,-33.1))]:rod('Upper front safety rail',a,b,.055)
for x in [-7,0,4.6,10.8]:rod('Upper rail post',(x,3.2,-33.1),(x,4.3,-33.1),.055)
group='bridge'
for i in range(2):
 for j in range(4):box('Hinged basalt paving',(.99+i*1.98,-.24,-2.4+j*1.6),(1.96,.48,1.58),edge,.04)
for z in [-3.15,3.15]:box('Bridge structural edge',(2,-.18,z),(4,.36,.10))
rod('Bridge hinge',(0,-.12,-3.3),(0,-.12,3.3),.12)
group='lift'
box('Lift structural deck',(0,-.32,0),(3.6,.46,3.6),dark)
for x in [-.88,.88]:
 for z in [-.88,.88]:box('Lift paving',(x,-.045,z),(1.73,.09,1.73),edge,.02)
for x in [-1.65,1.65]:
 for z in [-1.65,1.65]:rod('Lift cage post',(x,0,z),(x,1.08,z),.055)
for y in [.45,1.05]:rod('Lift east guard',(1.65,y,-1.65),(1.65,y,1.65),.045);rod('Lift south guard',(-1.65,y,1.65),(1.65,y,1.65),.045)
group='rail'
for y in [.45,1.05]:rod('Sliding boarding guard',(-1.65,y,0),(1.65,y,0),.045)
for x in [-1.1,0,1.1]:rod('Guard upright',(x,.4,0),(x,1.05,0),.035)
origins={'static':[0,0,0],'bridge':[0,0,0],'turbine':[-7,2.4,-26.7],'lift':[0,0,0],'rail':[0,0,0]}
metrics={'bridgeTop':max(bounds(o)['max'][1] for o in parts['bridge'] if o.name.startswith('Hinged basalt')),'liftTop':max(bounds(o)['max'][1] for o in parts['lift'] if o.name.startswith('Lift paving')),'deckUnderPavingTop':max(bounds(o)['max'][1] for o in parts['lift'] if o.name.startswith('Lift structural deck')),'turbineBase':min(bounds(o)['min'][1] for o in parts['static'] if o.name.startswith('Turbine fissure footing')),'liftFrontBase':min(bounds(o)['min'][1] for o in parts['static'] if o.name.startswith('Lift front fissure pier')),'liftSize':3.6,'upperHeight':3.2,'upperOpeningHeight':4.0}
assert abs(metrics['bridgeTop'])<.0001 and abs(metrics['liftTop'])<.0001,metrics
assert abs(metrics['turbineBase']+3)<.0001 and abs(metrics['liftFrontBase']+3)<.0001,metrics
scene['reference']='../v01/concept-overview.png and steam-v01/DESIGN.md';scene['status']='Steam room architecture and separate local-origin moving parts';bpy.ops.wm.save_as_mainfile(filepath=str(ART/'steam-v01.blend'))
deps=bpy.context.evaluated_depsgraph_get()
for key,targets in parts.items():
 batches={}
 for source in targets:
  ev=source.evaluated_get(deps);me=bpy.data.meshes.new_from_object(ev);o=bpy.data.objects.new('Export '+source.name,me);scene.collection.objects.link(o);o.matrix_world=source.matrix_world.copy();o.location-=v(origins[key]);batches.setdefault(o.data.materials[0].name,[]).append(o)
 joined=[]
 for m,items in batches.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in items:o.select_set(True)
  bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();items[0].name='Steam '+m;joined.append(items[0])
 bpy.ops.object.select_all(action='DESELECT')
 for o in joined:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/('steam-'+key+'-v01.glb')),export_format='GLB',use_selection=True,export_lights=False,export_cameras=False)
 for o in joined:bpy.data.objects.remove(o,do_unlink=True)
 print('STEAM_EXPORT',key,len(targets),len(batches),flush=True)
manifest={'version':1,'source':'art/fire-temple/steam-v01/steam-v01.blend','cameraOccluders':camera,'pillars':pillars,'metrics':metrics,'parts':{k:len(a) for k,a in parts.items()}}
(OUT/'steam-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');(ART/'geometry-check.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8');print('STEAM_READY',json.dumps(metrics),flush=True)
