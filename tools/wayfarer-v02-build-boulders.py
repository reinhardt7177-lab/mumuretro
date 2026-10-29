"""Two new layer-cut limestone boulders. Blender Z up exports to glTF Y up.
Keeps field-boulders-v01 and all existing placement transforms untouched.
"""
import bpy,bmesh,math,json
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
A=ROOT/'art/wayfarer-terraces/v02';OUT=A/'exports'
SPEC=json.loads((A/'design-spec.json').read_text(encoding='utf8'))['boulders']
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20
scene.render.resolution_x=1200;scene.render.resolution_y=780;scene.render.resolution_percentage=100
scene.world.color=(.45,.51,.58);scene.view_settings.view_transform='AgX'
n=512;yy,xx=np.mgrid[0:n,0:n].astype(np.float32)/n
grain=.028*np.sin(xx*311+yy*173)+.021*np.cos(xx*79-yy*139)+.022*np.sin(xx*32+np.sin(yy*43))
layers=.036*np.sin(yy*math.pi*24+np.sin(xx*17)*.12)
cracks=np.exp(-((np.sin(xx*36+np.sin(yy*15)*1.4))/.055)**2)*.085
px=np.empty((n,n,4),dtype=np.float32)
for k,base in enumerate((.68,.655,.555)):px[:,:,k]=np.clip(base+grain+layers-cracks,.1,.95)
px[:,:,3]=1
image=bpy.data.images.new('Wayfarer warm limestone grain 512',width=n,height=n,alpha=True)
image.pixels.foreach_set(px.ravel());image.filepath_raw=str(OUT/'limestone-grain-v02.png');image.file_format='PNG';image.save();image.pack()
material=bpy.data.materials.new('Wayfarer limestone mineral');material.use_nodes=True
bs=material.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.91
tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;material.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
objects=[];audits=[]
levels=[0,.07,.21,.24,.44,.47,.69,.87,1]
profiles=[.80,.94,.98,.94,.99,.94,.92,.82,.68]
for variant,height in enumerate(SPEC['heights']):
    vertices=[];faces=[];N=20;phase=variant*1.31
    for j,t in enumerate(levels):
        for i in range(N):
            angle=2*math.pi*i/N
            fracture=1+.07*math.sin(angle*3+phase)+.045*math.cos(angle*7-phase)
            r=profiles[j]*fracture
            # Upper rings shift along a natural bedding plane, never above radius .5.
            x=r*math.cos(angle)+.045*t*math.sin(phase)
            y=r*math.sin(angle)*(.90 if variant else 1)+.04*t
            z=t*height
            if j not in(0,8):z+=.008*math.sin(angle*3+phase)
            if j==8:z-=.018*(.5+.5*math.sin(angle+phase))
            vertices.append((x,y,z))
    scale=.5/max(math.hypot(x,y) for x,y,z in vertices)
    vertices=[(x*scale,y*scale,z) for x,y,z in vertices]
    # At least one top vertex attains the declared height exactly.
    top=max(range(8*N,9*N),key=lambda k:vertices[k][2]);x,y,z=vertices[top];vertices[top]=(x,y,height)
    for j in range(8):
        for i in range(N):
            a=j*N+i;b=j*N+(i+1)%N;c=b+N;d=a+N
            faces.extend([(a,b,c),(a,c,d)])
    vertices.extend([(0,0,0),(0,0,height-.009)])
    for i in range(N):faces.extend([(9*N,(i+1)%N,i),(9*N+1,8*N+i,8*N+(i+1)%N)])
    mesh=bpy.data.meshes.new('Wayfarer stratified rock mesh '+str(variant));mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    uv=mesh.uv_layers.new(name='Bedding UV')
    for poly in mesh.polygons:
        indices=list(poly.vertices);angles=[math.atan2(vertices[k][1],vertices[k][0])/(2*math.pi)+.5 for k in indices]
        if max(angles)-min(angles)>.5:angles=[a+1 if a<.5 else a for a in angles]
        for li,k,u in zip(poly.loop_indices,indices,angles):
            uv.data[li].uv=(vertices[k][0]+.5,vertices[k][1]+.5) if abs(poly.normal.z)>.65 else (u,vertices[k][2]/height)
    obj=bpy.data.objects.new('field_rock_'+str(variant),mesh);scene.collection.objects.link(obj);obj.data.materials.append(material);objects.append(obj)
    audits.append({'name':obj.name,'triangles':len(mesh.polygons),'materials':len(mesh.materials),'floor':min(v[2] for v in vertices),'height':max(v[2] for v in vertices),'radius':max(math.hypot(v[0],v[1])for v in vertices),'vertices':len(vertices),'closed':True})
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'field-boulders-v02.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
# Presentation layout is only for Blender source/render; exported model origins stay 0.
for i,obj in enumerate(objects):obj.location.x=(i-.5)*1.3
bpy.ops.object.light_add(type='AREA',location=(2,-3,5));light=bpy.context.object;light.data.energy=550;light.data.shape='DISK';light.data.size=4
bpy.ops.object.camera_add(location=(2.1,-3.2,2.15));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.3))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=3.1;scene.camera=camera
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(A/'blender-boulders.png')
bpy.ops.wm.save_as_mainfile(filepath=str(A/'wayfarer-boulders-v02.blend'));bpy.ops.render.render(write_still=True)
(OUT/'field-boulders-v02.json').write_text(json.dumps({'role':'Blender-exported assets; actual bounds, not gameplay completion','version':2,'variants':audits,'texture':[512,512],'sourceAxis':'Blender Z up; glTF Y up','preserved':'field-boulders-v01.glb','sharedMaterials':1},indent=2),encoding='utf8')
for a in audits:
    assert a['triangles']<=SPEC['maxTrianglesPerVariant']
    assert abs(a['floor'])<1e-7 and abs(a['radius']-.5)<1e-7
print(json.dumps(audits))
