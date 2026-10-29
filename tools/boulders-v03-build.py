"""Original fractured limestone: unequal clipping planes, not ring stacks.
Blender Z-up source; GLB Y-up. Preserves all v02 and root assets.
"""
import bpy,bmesh,math,json,itertools
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1];A=ROOT/'art/arrival-coherence/v01/boulders-v03';OUT=A/'exports'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1200;scene.render.resolution_y=780;scene.render.resolution_percentage=100
scene.world.color=(.45,.51,.58);scene.view_settings.view_transform='AgX'
n=512;yy,xx=np.mgrid[0:n,0:n].astype(np.float32)/n
rng=np.random.default_rng(73003)
def noise(scale):
    grid=rng.random((scale+1,scale+1));u=xx*scale;v=yy*scale;i=u.astype(int);j=v.astype(int);a=u-i;b=v-j;a=a*a*(3-2*a);b=b*b*(3-2*b)
    return (grid[j,i]*(1-a)+grid[j,i+1]*a)*(1-b)+(grid[j+1,i]*(1-a)+grid[j+1,i+1]*a)*b
coarse=noise(7);medium=noise(31);fine=noise(111)
grain=(medium-.5)*.055+(fine-.5)*.026+(rng.random((n,n))-.5)*.012
mineral=(coarse-.5)*.033
veins=np.exp(-((coarse-.49)/.018)**2)*.024
px=np.empty((n,n,4),dtype=np.float32)
for k,base in enumerate((.68,.655,.555)):px[:,:,k]=np.clip(base+grain+mineral-veins,.1,.95)
px[:,:,3]=1
image=bpy.data.images.new('Wayfarer fracture mineral 512',width=n,height=n,alpha=True)
image.pixels.foreach_set(px.ravel());image.filepath_raw=str(OUT/'limestone-fracture-v03.png');image.file_format='PNG';image.save();image.pack()
material=bpy.data.materials.new('Wayfarer limestone mineral');material.use_nodes=True
bs=material.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.91
tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;material.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])

def cut_polyhedron(planes):
    vertices=[]
    for indices in itertools.combinations(range(len(planes)),3):
        matrix=np.array([planes[i][0] for i in indices],dtype=float)
        if abs(np.linalg.det(matrix))<1e-9:continue
        point=np.linalg.solve(matrix,np.array([planes[i][1] for i in indices]))
        if any(np.dot(normal,point)>distance+1e-7 for normal,distance in planes):continue
        if not any(np.linalg.norm(point-v)<1e-6 for v in vertices):vertices.append(point)
    faces=[];used=[]
    for plane,(normal,distance) in enumerate(planes):
        ids=[i for i,v in enumerate(vertices) if abs(np.dot(normal,v)-distance)<1e-6]
        if len(ids)<3:continue
        centre=np.mean([vertices[i] for i in ids],axis=0);normal=np.array(normal,dtype=float);normal/=np.linalg.norm(normal)
        axis=np.array((1.,0.,0.)) if abs(normal[0])<.8 else np.array((0.,1.,0.))
        u=np.cross(axis,normal);u/=np.linalg.norm(u);v=np.cross(normal,u)
        ids.sort(key=lambda i:math.atan2(np.dot(vertices[i]-centre,v),np.dot(vertices[i]-centre,u)))
        faces.append(ids);used.append(plane)
    return [tuple(v) for v in vertices],faces,used

objects=[];audit=[]
for variant,height in enumerate((.72,.61)):
    angles=([6,54,108,158,214,272,319] if variant==0 else [-13,36,93,144,205,254,308])
    distances=([.43,.39,.46,.425,.40,.455,.41] if variant==0 else [.40,.47,.385,.445,.42,.39,.46])
    lean=([.18,-.13,.17,-.05,-.22,-.10,.11] if variant==0 else [-.16,.11,.19,-.16,-.08,.14,-.10])
    planes=[]
    for angle,d,l in zip(angles,distances,lean):a=math.radians(angle);planes.append(((math.cos(a),math.sin(a),l/height),d))
    # Four unequal structural zones: flat base, one broken lower corner,
    # broad leaning mass, and a two-plane asymmetric fracture roof.
    planes.extend([((0,0,-1),0),((.41,-.23,1),height*.98),((-.27,.38,1),height*.96),((.62,.35,-.75/height),.35)])
    if variant:planes[-3]=((-.43,-.17,1),height*.99);planes[-2]=((.21,.46,1),height*.95);planes[-1]=((-.56,.41,-.72/height),.34)
    vertices,faces,used=cut_polyhedron(planes)
    mesh=bpy.data.meshes.new('Wayfarer fractured planes '+str(variant));mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new('field_rock_'+str(variant),mesh);scene.collection.objects.link(obj);obj.data.materials.append(material)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bevel=obj.modifiers.new('Small broken arris, not a repeated ledge','BEVEL');bevel.width=.009 if variant==0 else .012;bevel.segments=1;bevel.affect='EDGES';bevel.use_clamp_overlap=True
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    floor=min(v.co.z for v in obj.data.vertices);top=max(v.co.z for v in obj.data.vertices)
    scale=.5/max(math.hypot(v.co.x,v.co.y) for v in obj.data.vertices)
    for v in obj.data.vertices:v.co.x*=scale;v.co.y*=scale;v.co.z=(v.co.z-floor)*height/(top-floor)
    obj.data.update();uv=obj.data.uv_layers.new(name='Fracture planar projection')
    for poly in obj.data.polygons:
        normal=poly.normal;axis=max(range(3),key=lambda k:abs(normal[k]))
        for li in poly.loop_indices:
            co=obj.data.vertices[obj.data.loops[li].vertex_index].co
            a,b=(co.y,co.z) if axis==0 else (co.x,co.z) if axis==1 else (co.x,co.y)
            # Different planar faces sample the same grain without circular UV bands.
            uv.data[li].uv=(a*.71+b*.27+.5+variant*.13,b*.82-a*.21+.37+axis*.11)
        poly.use_smooth=False
    obj.data.calc_loop_triangles();bm=bmesh.new();bm.from_mesh(obj.data)
    manifold=all(e.is_manifold for e in bm.edges);bm.free()
    bounds={'floor':min(v.co.z for v in obj.data.vertices),'height':max(v.co.z for v in obj.data.vertices),'radius':max(math.hypot(v.co.x,v.co.y)for v in obj.data.vertices)}
    audit.append({'name':obj.name,**bounds,'triangles':len(obj.data.loop_triangles),'vertices':len(obj.data.vertices),'majorSidePlanes':7,'fractureRoofPlanes':2,'minorLowerCornerCuts':1,'unequalAuthoringSections':[0,.14 if variant==0 else .21,.71 if variant==0 else .63,1],'manifold':manifold,'material':material.name,'materials':1,'horizontalRingStacks':0,'sourcePlanes':planes})
    assert manifold and abs(bounds['floor'])<1e-7 and abs(bounds['height']-height)<1e-6 and abs(bounds['radius']-.5)<1e-6
    objects.append(obj);obj.select_set(False)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'field-boulders-v03.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
# Presentation offsets are applied after the collision/export contract is saved.
for i,o in enumerate(objects):o.location.x=(i-.5)*1.3
bpy.ops.object.light_add(type='AREA',location=(2,-3,5));light=bpy.context.object;light.data.energy=550;light.data.shape='DISK';light.data.size=4
bpy.ops.object.camera_add(location=(2.1,-3.2,2.15));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.3))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=3.1;scene.camera=camera
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(A/'blender-boulders-v03.png')
bpy.ops.wm.save_as_mainfile(filepath=str(A/'wayfarer-boulders-v03.blend'));bpy.ops.render.render(write_still=True)
(OUT/'field-boulders-v03.json').write_text(json.dumps({'version':3,'variants':audit,'geometries':2,'sharedMaterials':1,'texture':[512,512],'materialNameContract':'Wayfarer limestone mineral','role':'Original asymmetric cut-plane limestone; no ring stack; axis Blender Z-up exported glTF Y-up','preserved':['field-boulders-v01.glb','field-boulders-v02.glb','white80 shader candidate']},indent=2),encoding='utf8')
print(json.dumps(audit))
