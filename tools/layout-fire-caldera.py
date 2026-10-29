import bpy,json,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent;A=R/'art/fire-atmosphere/v01'
data=json.loads((R/'reports/2026-10-24/evidence/fire-atmosphere/goal.json').read_text())['shots'][0]['atmosphere']['cliffs']
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(R/'assets/models/adventure/strata-surround-v01.glb'))
originals=list(bpy.context.scene.objects);rows=[]
def duplicate(o,parent=None):
    c=o.copy();bpy.context.collection.objects.link(c);c.parent=parent
    for child in o.children:duplicate(child,c)
    return c
for i,p in enumerate(data):
    root=duplicate(bpy.data.objects[p['part']]);root.name='Fire caldera cliff '+str(i+1)
    root.location=(p['position'][0],-p['position'][2],p['position'][1]);root.scale=(p['scale'],p['scale'],p['verticalScale']);root.rotation_mode='XYZ';root.rotation_euler=(0,0,p['yaw'])
    bpy.context.view_layer.update();points=[]
    def visit(o):
        if o.type=='MESH':points.extend(o.matrix_world@v.co for v in o.data.vertices)
        for c in o.children:visit(c)
    visit(root)
    lo=[min(v.x for v in points),min(v.z for v in points),-max(v.y for v in points)];hi=[max(v.x for v in points),max(v.z for v in points),-min(v.y for v in points)]
    error=max(abs(a-b) for actual,expected in [(lo,p['min']),(hi,p['max'])] for a,b in zip(actual,expected));assert error<.001,(i,error,lo,hi)
    rows.append({'name':root.name,'webMin':lo,'webMax':hi,'runtimeBoundsMaxError':error})
for o in originals:bpy.data.objects.remove(o,do_unlink=True)
old=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(A/'caldera-basin-v01.glb'))
for o in set(bpy.context.scene.objects)-old:
    if o.parent is None:o.location.z-=60
bpy.ops.wm.save_as_mainfile(filepath=str(A/'fire-caldera-layout.blend'))
(A/'layout-metrics.json').write_text(json.dumps({'pass':True,'cliffs':rows,'source':'art/strata-surround/v01/strata-surround-v01.blend','runtimeModel':'assets/models/adventure/strata-surround-v01.glb','basin':'caldera-basin-v01.blend'},indent=2));print('LAYOUT_MATCH',len(rows))
