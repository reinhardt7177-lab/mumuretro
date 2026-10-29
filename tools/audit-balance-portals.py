"""Independent reopening of editable sources, including UVs, sealed cuts and packed images."""
import bpy,json,hashlib,bmesh
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent;A=R/'art/balance-portals/v01';B=R/'reports/2026-10-25/evidence/balance-portals';layout=json.loads((A/'layout.json').read_text());checks=[]
def check(name,ok,details=None):checks.append({'name':name,'pass':bool(ok),'details':details});print(('PASS 'if ok else'FAIL ')+name,flush=True)
def snapshot(file):
 bpy.ops.wm.open_mainfile(filepath=str(file));objects={}
 for o in bpy.context.scene.objects:
  if o.type not in ['MESH','CURVE']:continue
  points=[tuple(v.co)for v in o.data.vertices]if o.type=='MESH'else[[tuple(p.co)for p in s.points]for s in o.data.splines]
  uv=[[tuple(p.uv)for p in l.data]for l in o.data.uv_layers]if o.type=='MESH'else[]
  objects[o.name]=hashlib.sha256(repr((tuple(tuple(row)for row in o.matrix_world),points,uv,[m.name for m in o.data.materials])).encode()).hexdigest()
 images={i.name:hashlib.sha256(i.packed_file.data).hexdigest()for i in bpy.data.images if i.packed_file}
 return objects,images
old,old_images=snapshot(R/'art/balance-walls/v01/balance-temple-v06.blend');now,images=snapshot(A/'balance-temple-v07.blend');changed=set(layout['trimmed']+layout['removed']);protected={n:v for n,v in old.items()if n not in changed}
check('all unrelated source objects preserve world coordinates, UVs and materials',len(protected)==3049 and all(now.get(n)==v for n,v in protected.items()),{'count':len(protected)})
check('all previous packed images remain byte-identical',all(images.get(n)==v for n,v in old_images.items()),{'count':len(old_images)})
paving=[n for n in old if n.startswith('Balance paving hall_')];check('all324 paving pieces retain the original zero surface and UVs',len(paving)==324 and all(now.get(n)==old[n]for n in paving),len(paving))
cuts=[]
for n in layout['trimmed']:
 o=bpy.data.objects[n];points=[o.matrix_world@v.co for v in o.data.vertices];bm=bmesh.new();bm.from_mesh(o.data);boundary=sum(1 for e in bm.edges if e.is_boundary);bm.free();cuts.append({'name':n,'maxGameZ':max(-p.y for p in points),'boundaryEdges':boundary})
check('all18 corridor cuts meet the portal back and remain closed solids',len(cuts)==18 and all(c['maxGameZ']<=.72001 and c['boundaryEdges']==0 for c in cuts),cuts)
measures=[]
for name,spec in layout['parts'].items():
 points=[o.matrix_world@Vector(p)for o in bpy.data.objects[name].children_recursive if o.type=='MESH'for p in o.bound_box];lo=[min(p[i]for p in points)for i in range(3)];hi=[max(p[i]for p in points)for i in range(3)];measures.append({'name':name,'min':lo,'max':hi,'expected':spec})
check('both complete portals have grounded feet and the designed width/height',all(abs(m['min'][2])<.00001 and abs(m['max'][2]-m['expected']['height'])<.00001 and abs(m['max'][0]-m['min'][0]-m['expected']['width'])<.00001 for m in measures),measures)
out={'checks':checks,'pass':all(c['pass']for c in checks)};(B/'source.json').write_text(json.dumps(out,indent=2));assert out['pass']
