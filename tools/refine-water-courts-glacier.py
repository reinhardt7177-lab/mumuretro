"""Refine the inspected flat glacier without rebuilding the 2,700 masonry pieces."""
import bpy,bmesh,math,json,ast,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/water-courts/v01';sys.path.insert(0,str(ROOT/'tools'))
from theatre_asset_utils import export_parts
bpy.ops.wm.open_mainfile(filepath=str(ART/'water-courts-v01.blend'));scene=bpy.context.scene
SPEC=json.loads((ART/'design-spec.json').read_text());BEFORE=json.loads((ROOT/'reports/2026-10-23/evidence/water-courts/before/report.json').read_text());V=lambda p:Vector((p[0],-p[2],p[1]));M={key:bpy.data.materials['Water courts '+key] for key in SPEC['palette']};parts={};solids=[]
for collection in bpy.data.collections:collection.hide_viewport=collection.hide_render=False
for o in scene.objects:o.hide_set(False)
tree=ast.parse((ROOT/'tools/build-moon-courts.py').read_text(encoding='utf-8-sig'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['finish','box','poly']],type_ignores=[]),'<existing-masonry-methods>','exec'))
for room in SPEC['rooms']:
    for name in [room['shell'],room['floor'],room['glacier']]:parts[name]=bpy.data.objects[name]
    # Keep dark grout at the walking datum, rather than a13cm-deep slit.
    # The foundation underside and central basin opening remain unchanged.
    for o in parts[room['floor']].children:
        if not o.name.startswith('Paving continuous foundation'):continue
        lo=min(v.co.z for v in o.data.vertices);hi=max(v.co.z for v in o.data.vertices);scale=.3295/(hi-lo)
        for v in o.data.vertices:v.co.z=lo+(v.co.z-lo)*scale
        o.data.update()
    parent=parts[room['glacier']]
    for o in list(parent.children):bpy.data.objects.remove(o,do_unlink=True)
    half=room['width']/2;length=room['length'];height=room['height'];base=-5.0 if room['index']==2 else 0;steps=max(9,round(length/1.65))
    for side in [-1,1]:
        pts=[];levels=[base,1.15,3.5,5.9,height+.75]
        for row,y in enumerate(levels):
            for j in range(steps+1):
                end=j in [0,steps];z=-length/2-.62+j*(length+1.24)/steps+(0 if end else .30*math.sin(j*.67+row*.9));depth=1.8+.72*math.sin(j*.9+row*.57)+.23*math.sin(j*2.1-row*.4);x=side*(half+depth);yy=y+(.36*math.sin(j*1.12+row*.5) if row else 0);pts.append((x,yy,z))
        count=len(pts);pts.extend([(x+side*.65,y,z) for x,y,z in pts.copy()]);faces=[]
        for row in range(4):
            for j in range(steps):
                a=row*(steps+1)+j;b=a+1;c=a+steps+2;d=a+steps+1;faces.extend([(a,b,c,d),(a+count,d+count,c+count,b+count)])
        for row in range(4):
            for j in [0,steps]:a=row*(steps+1)+j;b=a+steps+1;faces.append((a,b,b+count,a+count))
        for row in [0,4]:
            for j in range(steps):a=row*(steps+1)+j;faces.append((a,a+1,a+1+count,a+count))
        poly('Folded solid glacier wall',pts,faces,'ice',parent)
        for j in range(1,steps,3):
            crack=[]
            for row in range(1,5):
                p=Vector(pts[row*(steps+1)+j]);p.x-=side*.008;crack.extend([tuple(p+Vector((0,0,-.018))),tuple(p+Vector((0,0,.018)))])
            poly('Attached irregular frost vein',crack,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(3)],'frost',parent)
        for j in range(2,steps,3):
            z=-length/2+j*length/steps;ridge=[(side*(half+1.00),base,z-.60),(side*(half+2.65),base,z+.70),(side*(half+1.18),base,z+.90),(side*(half+1.45),height*.72,z+.12),(side*(half+2.20),height*.86,z+.55)]
            poly('Grounded angular ice ridge',ridge,[(0,2,1),(0,1,4,3),(1,2,4),(2,0,3,4)],'ice',parent)
        box('Supported broad glacier footing',[side*(half+1.8),base-.13,0],[3.3,.26,length+1.30],'recess',parent,.01)
    collection=next(iter(parent.users_collection))
    for o in parent.children:
        for old in list(o.users_collection):old.objects.unlink(o)
        collection.objects.link(o)
SPEC['glacierRevision']=2;SPEC['floorGroutOffset']=.0005;SPEC['targetScope']='Four architectural spaces at current world positions;game devices,traveller,corridor kit and runtime lighting are omitted.'
originals=[o for p in parts.values() for o in p.children];metrics=export_parts(list(parts),SPEC,ART,'water-courts-v01','Water courts ')
assert sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))<=SPEC['budgets']['triangles'];assert metrics['glbBytes']<=SPEC['budgets']['bytes']
exports=[o for p in parts.values() for o in p.children if o not in originals];lights=[o for o in scene.objects if o.type=='LIGHT'];cam=scene.camera
for room,seg in zip(SPEC['rooms'],BEFORE['segments']):
    for name in [room['shell'],room['floor'],room['glacier']]:parts[name].location=V((0,0,(seg['z0']+seg['z1'])/2))
for o in exports:o.hide_render=False
for shot in BEFORE['shots']:
    seg=BEFORE['segments'][shot['index']];cz=(seg['z0']+seg['z1'])/2
    for i,o in enumerate(lights):o.location=V((3 if i==0 else -6,10 if i==0 else 7,cz+4 if i==0 else cz-3))
    cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
for o in exports:bpy.data.objects.remove(o,do_unlink=True)
for p in parts.values():p.location=(0,0,0)
for o in originals:o.hide_set(False);o.hide_render=False
for c in bpy.data.collections:
    if c.name.startswith('Water '):c.hide_viewport=c.hide_render=c.name!='Water Carry'
cam.location=V((7,8,11));cam.rotation_euler=(V((0,2,0))-cam.location).to_track_quat('-Z','Y').to_euler()
for i,o in enumerate(lights):o.location=V((3 if i==0 else -6,10 if i==0 else 7,4 if i==0 else -3))
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'water-courts-v01.blend'));print('REFINED_WATER_COURTS '+json.dumps(metrics))
