"""Measure the saved Blender asset, not the requested target values."""
import bpy,os,json,math
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
ART=os.path.join(ROOT,'art/water-sanctuary/v03')
native='water-deity-v03-final.blend' if os.path.exists(os.path.join(ART,'water-deity-v03-final.blend')) else 'water-deity-v03.blend'
bpy.ops.wm.open_mainfile(filepath=os.path.join(ART,native))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)]
textures={n.image for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image}
report=dict(blender_minimum=low,blender_maximum=high,measured_height=high[2]-low[2],triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),mesh_count=len(objects),vertex_count=len(points),all_coordinates_finite=all(math.isfinite(x) for p in points for x in p),all_meshes_have_uv=all(o.data.uv_layers.active is not None for o in objects),textures=[dict(name=i.name,size=list(i.size),packed=bool(i.packed_file)) for i in textures])
report['passed']=abs(low[2])<.002 and abs(report['measured_height']-3.3)<.002 and report['all_coordinates_finite'] and report['all_meshes_have_uv'] and len(textures)>=3 and all(min(i.size)>0 and i.packed_file for i in textures)
report['native_file']=native
with open(os.path.join(ART,'asset-qc.json'),'w') as f:json.dump(report,f,indent=2)
print('ASSET_QC',json.dumps(report),flush=True)
if not report['passed']:raise RuntimeError('Native asset QC failed')
