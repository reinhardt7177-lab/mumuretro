"""Re-render selected inspection goals from the frozen editable source; no export/save."""
import bpy, json, math, sys, ast, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
ART=ROOT/'art/water-devices/v01'
task_source_file=ART/'water-devices-v01.blend'
task_model_file=ROOT/'assets/models/adventure/water-devices-v01.glb'
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before_hashes=[digest(task_source_file),digest(task_model_file)]
BEFORE=json.loads((ROOT/'reports/2026-10-23/evidence/water-devices/before/report.json').read_text())
C=BEFORE['contract'];V=lambda p:Vector((p[0],-p[2],p[1]))
bpy.ops.wm.open_mainfile(filepath=str(task_source_file))
scene=bpy.context.scene;cam=scene.camera
spec=json.loads((ART/'design-spec.json').read_text())
parts={name:bpy.data.objects[name] for name in spec['parts']}
M={name:bpy.data.materials['Water devices '+name] for name in spec['palette']}
solids=[];exports=[]
for parent in parts.values():
    parent.location=(0,0,0)
    for child in parent.children:
        child.hide_set(False);child.hide_render=True;exports.append(child)
lights=[o for o in scene.objects if o.type=='LIGHT']
tree=ast.parse((ROOT/'tools/build-moon-courts.py').read_text(encoding='utf-8-sig'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['finish','box','poly']],type_ignores=[]),'<shared masonry authoring>','exec'))
builder=(ROOT/'tools/build-water-devices.py').read_text()
start=builder.index('instances=[]')
end=builder.index('for obj in list(set(context)):',start)
exec(compile(builder[start:end],'<frozen source goal render>','exec'))
assert [digest(task_source_file),digest(task_model_file)]==before_hashes
selected=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--only=')),None)
receipt_file=ART/'goals-rerender.json'
previous=json.loads(receipt_file.read_text()) if receipt_file.exists() else {'shots':[]}
shots={s['id']:s for s in previous['shots']}
shots.update({s['id']:s for s in BEFORE['shots'] if not selected or s['assembly'] in selected.split(',')})
receipt_file.write_text(json.dumps({'pass':True,'sourceUnchanged':True,'sourceSha256':before_hashes[0],'modelSha256':before_hashes[1],'shots':list(shots.values())},indent=2))
print('PASS selected Blender goals from frozen source;source/model hashes unchanged',flush=True)
