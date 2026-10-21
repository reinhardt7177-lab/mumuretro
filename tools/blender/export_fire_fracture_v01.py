"""Separate the reviewed architecture from movable pieces, with metre-based sockets.
The design .blend stays untouched. Outputs runtime GLBs and measured wall bounds.
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/fire-temple';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/fire-temple/v01/fire-temple-v01.blend'))
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
def bounds(o):
    p=[o.matrix_world@Vector(v) for v in o.bound_box]
    return {'min':[min(q.x for q in p),min(q.z for q in p),min(-q.y for q in p)],'max':[max(q.x for q in p),max(q.z for q in p),max(-q.y for q in p)]}
def centre(b):return [(a+c)/2 for a,c in zip(b['min'],b['max'])]
def close(x,z,a,b,r):return math.hypot(x-a,z-b)<r
pieces={n:[] for n in ['static','bridge','brace','socket','anchor']};camera=[];pillars=[]
for o in list(bpy.context.scene.objects):
    if o.type not in ['MESH','CURVE']:continue
    b=bounds(o);x,y,z=centre(b);name=o.name
    area=(x<-17.5 and x>-39 and -13<z<15) or math.hypot(x,z)<13 or (-18.5<x<-7 and 5.8<z<10.2) or (abs(x)<5.2 and 12<=z<35)
    if not area:continue
    # The prototype begins with the entrance open. Its portal's two leaves and
    # door-face ornaments must not remain as floating geometry across the arch.
    if 17.2<z<19:
        if name.startswith(('Door lower','Door arch','Vertical door','Door horizontal','Door rivet','1.5m scale')):continue
        if name.startswith('Incised diamond') and abs(x)<2.5:continue
        if name.startswith(('Caldera rim','Caldera inner','Forged sun ray')) and abs(x)<2 and y<3.9:continue
    if x<-18 and (name.startswith('fracture bridge') or name.startswith('Bridge bronze edge')):pieces['bridge'].append(o);continue
    if x<-18 and name.startswith(('Portable bridge brace','Brace bronze belt','Brace handle')):
        if close(x,z,-32,9,1):pieces['brace'].append(o)
        continue
    if x<-18 and name.startswith(('Brace socket','Bridge brace linkage')):
        if abs(x+29.4)<.8:pieces['socket'].append(o)
        continue
    if x<-18 and close(x,z,-28,-8,1) and name.startswith(('Far anchor','Caldera','Forged sun ray')):pieces['anchor'].append(o);continue
    pieces['static'].append(o)
    if name.startswith(('North wall core','Wing side core','Wing entry side core','South low parapet core','Column shaft','Portal pier','Portal jamb')):
        camera.append(b)
    if name.startswith('Column shaft'):pillars.append({'x':x,'z':z,'r':.91})

# A tangent between a circular hub and rectangular entry has zero walkable width.
# The real 4cm threshold apron overlaps both, matching the runtime walking union.
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,-11.7,-.31))
apron=bpy.context.object;apron.name='Entry to hub threshold apron';apron.scale=(8,2.6,.70)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
apron.data.materials.append(bpy.data.materials['Floor stone 1']);pieces['static'].append(apron)
deps=bpy.context.evaluated_depsgraph_get()

def export(name,targets,origin):
    objects=[];batches={}
    for source in targets:
        ev=source.evaluated_get(deps);me=bpy.data.meshes.new_from_object(ev);o=bpy.data.objects.new('Export '+source.name,me);bpy.context.collection.objects.link(o);o.matrix_world=source.matrix_world.copy();o.location-=Vector((origin[0],-origin[2],origin[1]));objects.append(o)
        batches.setdefault(o.data.materials[0].name,[]).append(o)
    merged=[]
    for name_key,items in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in items:o.select_set(True)
        bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();items[0].name='Fracture '+name_key;merged.append(items[0])
    bpy.ops.object.select_all(action='DESELECT')
    for o in merged:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_lights=False,export_cameras=False)
    for o in merged:bpy.data.objects.remove(o,do_unlink=True)
    print('FRACTURE_EXPORT',name,len(targets),len(merged),flush=True)

origins={'static':[0,0,0],'bridge':[-28,0,0],'brace':[-32,0,9],'socket':[-29.4,0,4.3],'anchor':[-28,0,-8]}
for name,targets in pieces.items():
    assert targets,name
    export('fracture-'+name+'-v01',targets,origins[name])
manifest={'version':1,'source':'art/fire-temple/v01/fire-temple-v01.blend','coordinates':'Three.js Y-up; floors y=0','entryApron':{'x0':-4,'x1':4,'z0':10.4,'z1':13,'height':.04},'cameraOccluders':camera,'pillars':pillars,'origins':origins,'parts':{n:len(o) for n,o in pieces.items()}}
(OUT/'fracture-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('FRACTURE_ASSETS_READY',json.dumps(manifest['parts']),flush=True)
