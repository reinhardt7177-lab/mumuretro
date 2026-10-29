"""Re-render selected inspection cameras without rebuilding or saving the frozen source."""
import bpy,json,math,sys,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/chronicle-court/v01';task_source_file=ART/'chronicle-court-v01.blend';task_model_file=ROOT/'assets/models/adventure/chronicle-court-v01.glb';digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();original=[digest(task_source_file),digest(task_model_file)]
BEFORE=json.loads((ROOT/'reports/2026-10-23/evidence/chronicle-court/before/report.json').read_text());C=BEFORE['contract'];S=C['seg'];cz=(S['z0']+S['z1'])/2;V=lambda p:Vector((p[0],-p[2],p[1]));bpy.ops.wm.open_mainfile(filepath=str(task_source_file));scene=bpy.context.scene;cam=scene.camera
parts={name:bpy.data.objects[name] for name in ['MemoryArcade','MemoryFloor','OfferingPedestal']};exports=[]
for root in parts.values():
    root.location=(0,0,0)
    for o in root.children:o.hide_set(False);o.hide_render=True;exports.append(o)
for light,pos in zip([o for o in scene.objects if o.type=='LIGHT'],[[4,14,C['gz']+12],[-10,10,C['gz']-8]]):light.location=V(pos);light.rotation_euler=(V([0,5,C['gz']+3])-light.location).to_track_quat('-Z','Y').to_euler()
only=next((v.split('=',1)[1] for v in sys.argv if v.startswith('--only=')),None)
selected=[s for s in BEFORE['shots'] if not only or s['id'] in only.split(',')];BEFORE={**BEFORE,'shots':selected}
builder=(ROOT/'tools/build-chronicle-court.py').read_text();start=builder.index('instances=[]');end=builder.index('for root in instances:',start);exec(compile(builder[start:end],'<frozen memory court rendering>','exec'))
assert [digest(task_source_file),digest(task_model_file)]==original;(ART/'goals-rerender.json').write_text(json.dumps({'pass':True,'sourceUnchanged':True,'sourceSha256':original[0],'modelSha256':original[1],'shots':selected},indent=2));print('PASS selected goals;frozen source/model hashes unchanged',flush=True)
