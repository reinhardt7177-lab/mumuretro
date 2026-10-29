"""Correct the preserved initial v05 foundation; no new faces or renders."""
import bpy,math,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'art/arrival-dais/v05'
assert (A/'initial-contact-failure/arrival-dais-v05.blend').exists(),'Preserve failed source before patching'
bpy.ops.wm.open_mainfile(filepath=str(A/'arrival-dais-v05.blend'))
changed={}
for collection,name in [('EDITABLE_FITTED_PARTS','Buried slate foundation'),('WEB_EXPORT_4_MESHES','Arrival_Recessed')]:
    ob=next(o for o in bpy.data.collections[collection].objects if o.name.startswith(name));count=0
    for v in ob.data.vertices:
        radius=math.hypot(v.co.x,v.co.y);target=2.60 if abs(radius-2.4108333333)<.0001 else 2.58 if abs(radius-2.1936666667)<.0001 else None
        if target and abs(v.co.z-.202)<.0001:v.co.x*=target/radius;v.co.y*=target/radius;count+=1
    ob.data.update();changed[ob.name]=count
assert all(n==130 for n in changed.values()),changed
bpy.ops.object.select_all(action='DESELECT')
meshes=list(bpy.data.collections['WEB_EXPORT_4_MESHES'].objects)
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.export_scene.gltf(filepath=str(A/'exports/arrival-dais-v05.glb'),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT')
bpy.ops.wm.save_as_mainfile(filepath=str(A/'arrival-dais-v05.blend'))
meta=json.loads((A/'exports/arrival-dais-v05.json').read_text(encoding='utf-8'));meta['nativeSupport']['foundationTopRingRadii']=[2.58,2.60];meta['contactCorrection']='Redistributed two existing buried foundation rings; no additional triangles'
(A/'exports/arrival-dais-v05.json').write_text(json.dumps(meta,indent=2),encoding='utf-8');print('V05_FOUNDATION_FIXED '+json.dumps(changed))
