import bpy,json,hashlib,bmesh,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent;A=R/'art/balance-observatory/v01';B=R/'reports/2026-10-25/evidence/balance-observatory';layout=json.loads((A/'layout.json').read_text());checks=[];fault='--fault' in sys.argv
def check(name,ok,details=None):checks.append({'name':name,'pass':bool(ok),'details':details});print(('PASS 'if ok else'FAIL ')+name,flush=True)
def snapshot(file):
 bpy.ops.wm.open_mainfile(filepath=str(file));objects={}
 if fault and file.name=='balance-temple-v08.blend':next(o for o in bpy.context.scene.objects if o.name.startswith('Balance paving hall_order')).data.vertices[0].co.x+=.01
 for o in bpy.context.scene.objects:
  if o.type not in ['MESH','CURVE']:continue
  points=[tuple(v.co)for v in o.data.vertices]if o.type=='MESH'else[[tuple(p.co)for p in s.points]for s in o.data.splines];uv=[[tuple(p.uv)for p in l.data]for l in o.data.uv_layers]if o.type=='MESH'else[]
  objects[o.name]=hashlib.sha256(repr((tuple(tuple(r)for r in o.matrix_world),points,uv,[m.name for m in o.data.materials])).encode()).hexdigest()
 return objects,{i.name:hashlib.sha256(i.packed_file.data).hexdigest()for i in bpy.data.images if i.packed_file}
old,old_images=snapshot(R/'art/balance-portals/v01/balance-temple-v07.blend');now,images=snapshot(A/'balance-temple-v08.blend');removed=set(layout['removedRibObjects']);protected={n:v for n,v in old.items()if n not in removed}
check('all2323 non-rib source objects retain world geometry,UVs and materials',len(protected)==2323 and all(now.get(n)==v for n,v in protected.items()),len(protected))
check('all previous packed images remain byte-identical',all(images.get(n)==v for n,v in old_images.items()),len(old_images))
check('all960 original rib pieces are replaced without leaving duplicates',len(removed)==960 and all(n not in now for n in removed),len(removed))
pieces=[]
for p in layout['pieces']:
 o=bpy.data.objects[p['name']];bm=bmesh.new();bm.from_mesh(o.data);boundary=sum(e.is_boundary for e in bm.edges);bm.free();pieces.append({'name':p['name'],'boundary':boundary})
check('all668 new editable pieces are closed solids',len(pieces)==668 and all(p['boundary']==0 for p in pieces),[p for p in pieces if p['boundary']])
parts=[]
for name in ['GaugeFrame','GaugeCell','TrayPlaqueMount']:
 points=[o.matrix_world@Vector(p)for o in bpy.data.objects[name].children_recursive if o.type=='MESH'for p in o.bound_box];parts.append({'name':name,'min':[min(p[i]for p in points)for i in range(3)],'max':[max(p[i]for p in points)for i in range(3)]})
check('gauge frame and reusable components have native bottom0',all(abs(p['min'][2])<.00001 for p in parts) and abs(parts[0]['max'][2]-2.72)<.00001,parts)
paving=[n for n in old if n.startswith('Balance paving hall_')];check('all324 paving pieces and original wall/portal objects remain unchanged',len(paving)==324 and all(now.get(n)==old[n]for n in paving) and all(now.get(n)==v for n,v in old.items()if n.startswith(('Wall ashlar','Wall backing','portal14','portal18'))),len(paving))
out={'pass':all(c['pass']for c in checks),'checks':checks,'fault':fault};(B/('source-fault.json'if fault else'source.json')).write_text(json.dumps(out,indent=2));assert out['pass']
