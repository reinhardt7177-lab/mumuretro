"""Independently inspect saved editable Blender data, not builder counters."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;A=ROOT/'art/chronicle-guardian/v02';B=ROOT/'reports/2026-10-24/evidence/chronicle-guardian-v02';B.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(A/'chronicle-guardian-v02.blend'))
checks=[]
def check(name,ok,detail):
 checks.append(dict(name=name,pass_=bool(ok),detail=detail));assert ok,(name,detail)
try:
 visible=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render]
 feet=[o for o in bpy.context.scene.objects if o.name.startswith('Unified carved foot')]
 drapes=[o for o in bpy.context.scene.objects if o.name.startswith('Continuous sleeve-to-dais drape')]
 check('two unified carved feet and two continuous editable drapes',len(feet)==2 and len(drapes)==2,[o.name for o in feet+drapes])
 foot_bounds=[]
 for o in feet:
  ps=[o.matrix_world@v.co for v in o.data.vertices];foot_bounds.append(dict(bottom=min(p.z for p in ps),top=max(p.z for p in ps),maxRadius=max((p.x*p.x+p.y*p.y)**.5 for p in ps)))
 check('feet contact dais and stay inside its solid top',all(abs(r['bottom']-.98)<.0001 and r['maxRadius']<4.86 for r in foot_bounds),foot_bounds)
 drape_bottom=min((o.matrix_world@v.co).z for o in drapes for v in o.data.vertices);gap=drape_bottom-max(r['top'] for r in foot_bounds)
 check('sculpted foot stays below raised hem',gap>.07,dict(gap=gap,drapeBottom=drape_bottom,footTop=max(r['top'] for r in foot_bounds)))
 images=[dict(name=i.name,size=list(i.size),packed=bool(i.packed_file))for i in bpy.data.images if i.type=='IMAGE']
 check('portable Blender contains both packed stone textures',len(images)==2 and all(i['packed'] and i['size']==[512,512] for i in images),images)
 triangles=0
 for o in visible:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
 check('visible exported sculpture retains nineteen draw meshes',len(visible)==19 and 100000<triangles<165000,dict(meshes=len(visible),triangles=triangles))
 ps=[o.matrix_world@Vector(p)for o in visible for p in o.bound_box];bounds=dict(base=min(p.z for p in ps),top=max(p.z for p in ps),width=max(p.x for p in ps)-min(p.x for p in ps))
 check('full sculpture remains grounded and within existing body radius',abs(bounds['base'])<.0001 and 14<bounds['top']<14.1 and bounds['width']<11,bounds)
 passed=True
finally:
 hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()for p in [ROOT/'tools/blender/build_chronicle_guardian_v01.py',ROOT/'art/chronicle-temple/v01/chronicle-guardian-v01.blend',ROOT/'assets/models/chronicle-temple/guardian-v01.glb']}
 (B/'source-audit.json').write_text(json.dumps(dict(pass_=len(checks)==6 and all(c['pass_']for c in checks),checks=checks,preservedSourceHashes=hashes),indent=2),encoding='utf-8')
print('SOURCE_AUDIT',len(checks),flush=True)
