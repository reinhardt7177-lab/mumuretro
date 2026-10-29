import bpy,json,math,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1]; art=root/'art/field-meadow/v01'; out=root/'reports/2026-10-26/evidence/field-meadow'
bpy.ops.wm.open_mainfile(filepath=str(art/'meadow-clusters-v01.blend'))
rows=[]
for i,height in enumerate([.28,.32,.37,.42]):
    obj=bpy.data.objects.get('MeadowTuft_'+str(i)); assert obj is not None
    mesh=obj.data; mesh.calc_loop_triangles(); points=[v.co for v in mesh.vertices]
    remaining=set(range(len(points))); components=0; adjacency=[set() for _ in points]
    for edge in mesh.edges:
        a,b=edge.vertices; adjacency[a].add(b); adjacency[b].add(a)
    while remaining:
        components+=1; stack=[remaining.pop()]
        while stack:
            for v in adjacency[stack.pop()]:
                if v in remaining: remaining.remove(v);stack.append(v)
    floor=min(v.z for v in points); maximum=max(v.z for v in points); radius=max(math.hypot(v.x,v.y) for v in points)
    roots=[loop for loop in mesh.loops if abs(points[loop.vertex_index].z)<1e-6]
    uv=mesh.uv_layers['BendWeightUV'];bad_roots=sum(abs(uv.data[loop.index].uv.y)>1e-6 for loop in roots)
    row={'name':obj.name,'vertices':len(points),'triangles':len(mesh.loop_triangles),'independentLeaves':components,'floor':floor,'height':maximum,'radius':radius,'badRootUVs':bad_roots,'materials':len(mesh.materials)}
    assert len(mesh.loop_triangles)==54 and components==9 and abs(floor)<1e-6 and abs(maximum-height)<1e-6 and radius<.43 and bad_roots==0 and len(mesh.materials)==1,repr(row)
    rows.append(row)
materials={bpy.data.objects['MeadowTuft_'+str(i)].data.materials[0].name for i in range(4)};assert len(materials)==1
data=(art/'exports/meadow-clusters-v01.glb').read_bytes();length=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+length])
assert len(gltf['meshes'])==4 and len(gltf['materials'])==1
triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives']);assert triangles==216
result={'pass':True,'checks':4+2,'source':str(art/'meadow-clusters-v01.blend'),'sourceTuftMeshes':4,'sourcePreviewObjectsExcluded':True,'sharedGameMaterials':len(materials),'exportMeshes':len(gltf['meshes']),'exportMaterials':len(gltf['materials']),'exportTriangles':triangles,'exportBytes':len(data),'variants':rows}
(out/'blender-audit.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print('PASS',json.dumps(result))
