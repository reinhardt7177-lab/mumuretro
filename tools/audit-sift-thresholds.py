"""Reopen editable files independently; never save either inspected source."""
import bpy,bmesh,json,hashlib,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];A=R/'art/sift-thresholds/v01';B=R/'reports/2026-10-25/evidence/sift-thresholds';fault='--fault' in sys.argv;checks=[]
def check(name,ok,details=None):
 checks.append({'name':name,'pass':bool(ok),'details':details});print(('PASS 'if ok else'FAIL ')+name,flush=True)
def snapshot(file):
 bpy.ops.wm.open_mainfile(filepath=str(file))
 if fault and file.name=='sift-thresholds-v01.blend':
  mesh=bpy.data.objects['Leaf closed stone core'].data
  for v in mesh.vertices:v.co.x+=.1
  mesh.update()
 objects={}
 for o in bpy.context.scene.objects:
  state=(tuple(tuple(row)for row in o.matrix_world),[tuple(v.co)for v in o.data.vertices]if o.type=='MESH'else[],[[tuple(v.uv)for v in uv.data]for uv in o.data.uv_layers]if o.type=='MESH'else[],[m.name for m in o.data.materials]if o.type=='MESH'else[])
  objects[o.name]=hashlib.sha256(repr(state).encode()).hexdigest()
 images={}
 for im in bpy.data.images:
  if im.packed_file:raw=im.packed_file.data
  elif im.source=='FILE' and Path(bpy.path.abspath(im.filepath)).is_file():raw=Path(bpy.path.abspath(im.filepath)).read_bytes()
  else:continue
  images[im.name]=hashlib.sha256(raw).hexdigest()
 return objects,images
old,images_old=snapshot(R/'art/sift-architecture/v01/sift-architecture-v01.blend');now,images=snapshot(A/'sift-thresholds-v01.blend');layout=json.loads((A/'layout.json').read_text());spec=json.loads((A/'design-spec.json').read_text())
check('all24 previous source objects preserve world geometry,UVs and materials',len(old)==24 and all(now.get(n)==h for n,h in old.items()),len(old))
check('all source texture images remain byte-identical after packing',bool(images_old) and all(images.get(n)==h for n,h in images_old.items()),len(images_old))
pieces=[];max_error=0
for p in layout['pieces']:
 o=bpy.data.objects[p['name']];bm=bmesh.new();bm.from_mesh(o.data);boundary=sum(e.is_boundary for e in bm.edges);bm.free();pts=[o.matrix_world@v.co for v in o.data.vertices];lo=[min(v[i]for v in pts)for i in range(3)];hi=[max(v[i]for v in pts)for i in range(3)];max_error=max(max_error,max(abs(a-b)for a,b in zip(lo+hi,p['min']+p['max'])));pieces.append({'name':o.name,'boundary':boundary,'uv':bool(o.data.uv_layers)})
check('all97 editable components are closed UV-mapped solids',len(pieces)==97 and all(not p['boundary'] and p['uv']for p in pieces),len(pieces))
check('editable geometry matches the reviewed export bounds',max_error<1e-5,max_error)
parts=[]
for name in spec['parts']:
 pts=[o.matrix_world@v.co for o in bpy.data.objects[name].children_recursive if o.type=='MESH' for v in o.data.vertices];parts.append({'name':name,'min':[min(v[i]for v in pts)for i in range(3)],'max':[max(v[i]for v in pts)for i in range(3)]})
leaf,housing,vent=parts
check('door starts at floor0 and housings use the original foundation level',abs(leaf['min'][2])<1e-5 and abs(leaf['max'][2]-3.3)<1e-5 and abs(leaf['max'][0]-leaf['min'][0]-2.4)<1e-5 and abs(housing['min'][2]+.2)<1e-5 and vent['min'][2]>=3.3-1e-5,parts)
check('old source objects are retained as hidden reference only',all(bpy.data.objects[n].hide_render for n in old))
out={'pass':all(c['pass']for c in checks),'checks':checks,'fault':fault};(B/('source-fault.json'if fault else'source.json')).write_text(json.dumps(out,indent=2));assert out['pass']
