import bpy,bmesh,json
from mathutils import Matrix
from mathutils.bvhtree import BVHTree
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/water-render/v01/water-deity-lod-v01.blend'))
original=bpy.data.objects['Original water deity reference'];original.location.x=0
base=original.data.copy();bm=bmesh.new();bm.from_mesh(base);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bm.to_mesh(base);bm.free();base.update();base.calc_loop_triangles()
neighbors=[set() for _ in base.vertices]
for e in base.edges:
    a,b=e.vertices;neighbors[a].add(b);neighbors[b].add(a)
rows=[]
for ratio in [.28,.16]:
    pins=set()
    for attempt in range(4):
        low=bpy.data.objects.new('probe',base.copy());bpy.context.scene.collection.objects.link(low)
        group=low.vertex_groups.new(name='Allow collapse');group.add(list(range(len(base.vertices))),1,'REPLACE')
        if pins:group.add(list(pins),0,'REPLACE')
        dec=low.modifiers.new('probe','DECIMATE');dec.ratio=ratio;dec.vertex_group=group.name;dec.vertex_group_factor=1000;dec.use_collapse_triangulate=True;bpy.context.view_layer.objects.active=low;bpy.ops.object.modifier_apply(modifier=dec.name)
        low.data.calc_loop_triangles();bvh=BVHTree.FromPolygons([v.co for v in low.data.vertices],[tuple(t.vertices) for t in low.data.loop_triangles],all_triangles=True)
        distances=[bvh.find_nearest(v.co)[3] for v in base.vertices];bad={i for i,d in enumerate(distances) if d>.018}
        row={'ratio':ratio,'attempt':attempt,'pins':len(pins),'triangles':len(low.data.loop_triangles),'maximum':max(distances),'bad':len(bad)};rows.append(row);print(json.dumps(row),flush=True)
        bpy.data.objects.remove(low,do_unlink=True)
        if not bad:break
        for _ in range(3):bad|={j for i in list(bad) for j in neighbors[i]}
        pins|=bad
(ROOT/'reports/2026-10-23/evidence/water-render/lod-probe.json').write_text(json.dumps(rows,indent=2))
