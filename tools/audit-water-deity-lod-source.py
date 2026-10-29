import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;file=ROOT/'art/water-render/v01/water-deity-lod-v01.blend';before=hashlib.sha256(file.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(file));spec=json.loads((ROOT/'art/water-render/v01/lod-metrics.json').read_text());rows=[]
for name in ['Original water deity reference',*[v['name'] for v in spec['variants']]]:
    obj=bpy.data.objects[name];copy=obj.data.copy();changed=copy.validate(verbose=True,clean_customdata=False);obj.data.calc_loop_triangles();areas=[t.area for t in obj.data.loop_triangles]
    row={'name':name,'triangles':len(areas),'vertices':len(obj.data.vertices),'invalidCopy':changed,'zeroArea':sum(v<=1e-15 for v in areas),'minimumArea':min(areas),'uv':bool(obj.data.uv_layers.active),'floor':min(v.co.z for v in obj.data.vertices),'top':max(v.co.z for v in obj.data.vertices)};rows.append(row);print(json.dumps(row),flush=True)
report={'rows':rows,'sourceSha256':before,'sourceUnchanged':hashlib.sha256(file.read_bytes()).hexdigest()==before,'pass':not any(r['invalidCopy'] for r in rows)}
(ROOT/'reports/2026-10-23/evidence/water-render/source-audit.json').write_text(json.dumps(report,indent=2));assert report['pass']
