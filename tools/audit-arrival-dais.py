import bpy,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/arrival-dais/v01';B=ROOT/'reports/2026-10-26/evidence/arrival-dais'
bpy.ops.wm.open_mainfile(filepath=str(ART/'arrival-dais-v03.blend'))
meshes=[o for o in bpy.data.collections['WEB_EXPORT_4_MESHES'].objects if o.type=='MESH'];points=[];triangles=0;materials=set();bad=0
for ob in meshes:
    ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles);materials.update(m.name for m in ob.data.materials)
    points.extend(ob.matrix_world@v.co for v in ob.data.vertices)
    bad+=sum(t.area<1e-12 for t in ob.data.loop_triangles)
minimum=min(p.z for p in points);maximum=max(p.z for p in points);radius=max(math.hypot(p.x,p.y) for p in points)
checks=[{'name':'four actual web mesh and material parts','pass':len(meshes)==4 and len(materials)==4},{'name':'source floor zero and low lenses','pass':abs(minimum)<1e-6 and .22<=maximum<.26},{'name':'footprint and measured triangle budget','pass':radius<=2.64001 and triangles==16688 and triangles<=17000},{'name':'editable originals retained','pass':len(bpy.data.collections['EDITABLE_FITTED_PARTS'].objects)==123},{'name':'native colour and normal texture packed','pass':sum(bool(im.packed_file) for im in bpy.data.images)>=2}]
out={'pass':all(c['pass'] for c in checks),'checks':checks,'meshes':len(meshes),'materials':len(materials),'triangles':triangles,'minimumY':minimum,'maximumY':maximum,'maximumRadius':radius,'degenerateTriangleCount':bad,'note':'Source Blender Z is exported as glTF local Y; shallow closed-band cap degeneracy is reported, not a gameplay surface claim.'}
(B/'blender-audit.json').write_text(json.dumps(out,indent=2),encoding='utf-8');print(json.dumps(out));assert out['pass']
