import bpy,math,json
from pathlib import Path
R=Path(__file__).resolve().parent.parent;A=R/'art/fire-atmosphere/v01';A.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
verts=[(0,0,0)];faces=[];N=96
for rad,h in [(50,0),(100,3),(150,8),(230,15)]:
    for i in range(N):
        a=i*math.tau/N;v=h+(math.sin(a*5+.3)+math.sin(a*9)*.5)*min(h*.12,1.4)
        verts.append((rad*math.cos(a),rad*math.sin(a),v))
for i in range(N):faces.append((0,1+i,1+(i+1)%N))
for row in range(3):
    a=1+row*N;b=a+N
    for i in range(N):j=(i+1)%N;faces.append((a+i,b+i,b+j,a+j))
me=bpy.data.meshes.new('Continuous caldera basin');me.from_pydata(verts,[],faces);me.update()
o=bpy.data.objects.new('Caldera basin grounded local datum',me);bpy.context.collection.objects.link(o)
m=bpy.data.materials.new('Distant cooled basalt');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.10,.13,.15,1);p.inputs['Roughness'].default_value=.95;o.data.materials.append(m)
for f in me.polygons:f.use_smooth=True
bpy.context.view_layer.objects.active=o;o.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(A/'caldera-basin-v01.blend'))
bpy.ops.export_scene.gltf(filepath=str(A/'caldera-basin-v01.glb'),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False)
me.calc_loop_triangles();data={'meshes':1,'materials':1,'triangles':len(me.loop_triangles),'localMinY':min(v[2] for v in verts),'localMaxY':max(v[2] for v in verts),'diameter':460,'runtimeY':-60,'bytes':(A/'caldera-basin-v01.glb').stat().st_size}
assert data['localMinY']==0;(A/'basin-metrics.json').write_text(json.dumps(data,indent=2));print('CALDERA_READY',json.dumps(data))
