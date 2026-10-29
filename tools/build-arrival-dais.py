"""An original fitted-stone arrival dais, with editable pieces and four web meshes."""
import bpy, bmesh, json, math, random
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/arrival-dais/v01'; OUT=ART/'exports'; OUT.mkdir(parents=True,exist_ok=True)
SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf-8'))
SOURCE=ART/'arrival-dais-v01.blend'
if SOURCE.exists(): raise RuntimeError('Preserve Blender source; create a new revision')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.temporary_directory=str(ROOT/'tmp/blender-validation')
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.device='CPU'
scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world.color=(.48,.54,.58)
editable=bpy.data.collections.new('EDITABLE_FITTED_PARTS');scene.collection.children.link(editable)
web=bpy.data.collections.new('WEB_EXPORT_4_MESHES');scene.collection.children.link(web)
def rgb(s):return tuple(int(s[i:i+2],16)/255 for i in (1,3,5))
def material(name,colour,metallic=0,rough=.86,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb(colour),1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metallic
    if emission:p.inputs['Emission Color'].default_value=m.diffuse_color;p.inputs['Emission Strength'].default_value=emission
    return m
stone=material('Weathered warm limestone',SPEC['palette']['stone'])
edge=material('Recessed slate and old moss',SPEC['palette']['shadow'])
brass=material('Aged navigator bronze',SPEC['palette']['brass'],.64,.47)
glass=material('Seated turquoise glass',SPEC['palette']['inlay'],.14,.34,.16)
materials=[stone,edge,brass,glass]
# A packed native colour texture, with fine mineral flecks and restrained seams.
n=512;yy,xx=np.mgrid[0:n,0:n].astype(np.float32)/n
grain=.5+.10*np.sin(xx*21+np.sin(yy*17))+.055*np.sin(yy*93+xx*19)+.022*np.sin(xx*471+yy*389)
vein=np.exp(-(np.sin(xx*11+yy*9+np.sin(xx*7))/.055)**2)*.035
pix=np.empty((n,n,4),np.float32)
for k,base in enumerate((.73,.70,.61)):pix[:,:,k]=np.clip(base+(grain-.5)*.29+vein,.1,1)
pix[:,:,3]=1
tex=bpy.data.images.new('Arrival limestone mineral',width=n,height=n,alpha=True);tex.pixels.foreach_set(pix.ravel());tex.filepath_raw=str(ART/'limestone-512.png');tex.file_format='PNG';tex.save();tex.pack()
node=stone.node_tree.nodes.new('ShaderNodeTexImage');node.image=tex;stone.node_tree.links.new(node.outputs['Color'],stone.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
pieces=[]
def mesh(name,verts,faces,mat):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    ob=bpy.data.objects.new(name,data);editable.objects.link(ob);data.materials.append(mat);pieces.append(ob)
    uv=data.uv_layers.new(name='Stone laid coordinates')
    for poly in data.polygons:
        for li in poly.loop_indices:
            co=data.vertices[data.loops[li].vertex_index].co;uv.data[li].uv=(co.x*.43+.5,co.y*.43+.5)
    return ob
def band(name,ri,ro,zbottom,ztop,a0,a1,mat,segments,bevel=.008,radial=1):
    # Dense broad top surface: it will be conformed to actual curved ground.
    levels=[(ri,zbottom),(ro,zbottom),(ro,ztop-bevel),(ro-bevel,ztop)]
    for i in range(1,radial+1):levels.append((ro-bevel+(ri+bevel-ro+bevel)*i/radial,ztop))
    levels.extend([(ri,ztop-bevel)])
    verts=[]
    for r,z in levels:
        for j in range(segments+1):
            a=a0+(a1-a0)*j/segments;verts.append((r*math.cos(a),r*math.sin(a),z))
    stride=segments+1;faces=[]
    for k in range(len(levels)):
        nxt=(k+1)%len(levels)
        for j in range(segments):faces.append((k*stride+j,k*stride+j+1,nxt*stride+j+1,nxt*stride+j))
    for j in (0,segments):faces.append(tuple(k*stride+j for k in range(len(levels))))
    return mesh(name,verts,faces,mat)

tau=2*math.pi;Z=SPEC['sourceWalkHeight'];gap=.008
band('Buried slate foundation',.01,2.64,0,Z-.018,0,tau,edge,64,.012,1)
for i in range(8):
    a=i*tau/8+gap;b=(i+1)*tau/8-gap
    band('Fitted limestone paving sector %02d'%i,.38,2.225,Z-.08,Z,a,b,stone,12,.009,7)
    band('Outer keyed limestone rim %02d'%i,2.285,2.61,.025,Z-.002,a,b,stone,12,.012,2)
    # A thin seated glass channel, separated by real stone joints.
    band('Recessed circular turquoise segment %02d'%i,2.24,2.267,Z-.027,Z-.009,a+.015,b-.015,glass,12,.002,1)
    band('Bronze inlay lip %02d'%i,2.225,2.237,Z-.025,Z-.004,a,b,brass,12,.002,1)
    band('Outer bronze inlay lip %02d'%i,2.269,2.281,Z-.025,Z-.004,a,b,brass,12,.002,1)
    # Navigation channels are physical inlays; none extend beyond the platform.
    ang=i*tau/8
    band('Seated radial energy link %02d'%i,.41,2.23,Z-.028,Z-.009,ang-.005,ang+.005,glass,1,.001,7)
    for delta in (-.009,.009):band('Bronze divider arris',.41,2.23,Z-.026,Z-.006,ang+delta-.0015,ang+delta+.0015,brass,1,.001,7)
band('Navigator centre medallion',.003,.35,Z-.042,Z-.001,0,tau,brass,48,.008,2)
band('Compass recessed dark border',.35,.383,Z-.04,Z-.005,0,tau,edge,48,.003,1)
for i in range(8):
    a=i*tau/8;length=.29 if i%2==0 else .21;w=.032
    verts=[(0,0,Z+.001),(length*math.cos(a),length*math.sin(a),Z+.001),(w*math.cos(a+math.pi/2),w*math.sin(a+math.pi/2),Z+.001),(-w*math.cos(a+math.pi/2),-w*math.sin(a+math.pi/2),Z+.001)]
    mesh('Compass point',verts,[(0,2,1),(0,1,3)],edge)
for i in range(4):
    a=tau*(i+.5)/4;x=2.24*math.cos(a);y=2.24*math.sin(a)
    ob=band('Flush bronze lens collar %d'%i,.105,.18,Z-.06,Z+.003,0,tau,brass,24,.007,1)
    ob.location=(x,y,0)
    ob=band('Flush recessed lens %d'%i,.002,.106,Z-.025,Z-.003,0,tau,glass,24,.002,1);ob.location=(x,y,0)
# Shallow old moss chips occupy the outside foot only, below walking level.
rng=random.Random(20261026)
for i in range(20):
    a=rng.random()*tau;length=rng.uniform(.025,.075)
    band('Weathered outside foot chip',2.60,2.635,.006,.018,a,a+length,edge,2,.002,1)

exports=[];stats=[]
for mat in materials:
    bpy.ops.object.select_all(action='DESELECT');copies=[]
    for source in pieces:
        if source.data.materials[0]!=mat:continue
        ob=source.copy();ob.data=source.data.copy();web.objects.link(ob);ob.select_set(True);copies.append(ob)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();merged=bpy.context.object;merged.name='Arrival_'+mat.name.split()[0]
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # The solid source floor remains 0; baked global transforms preserve lenses.
    merged.data.calc_loop_triangles();exports.append(merged)
    stats.append({'name':merged.name,'triangles':len(merged.data.loop_triangles),'vertices':len(merged.data.vertices),'material':mat.name})
triangles=sum(m['triangles'] for m in stats)
if triangles>SPEC['budget']['triangles']:raise RuntimeError('Triangle budget exceeded '+str(triangles))
editable.hide_render=True;editable.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for obj in exports:obj.select_set(True)
bpy.context.view_layer.objects.active=exports[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'arrival-dais-v01.glb'),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT')
contract={'version':1,'source':SOURCE.name,'localFloor':0,'walkHeight':Z,'runtimeConform':True,'maximumRadius':2.64,'webMeshes':len(exports),'materials':len(materials),'triangles':triangles,'editablePieces':len(pieces),'meshes':stats,'modelBytes':(OUT/'arrival-dais-v01.glb').stat().st_size}
(OUT/'arrival-dais-v01.json').write_text(json.dumps(contract,indent=2),encoding='utf-8')
ld=bpy.data.lights.new('Soft sun','SUN');sun=bpy.data.objects.new('Soft sun',ld);scene.collection.objects.link(sun);sun.rotation_euler=(math.radians(27),math.radians(-29),math.radians(-32));ld.energy=2.2;ld.angle=.08
cd=bpy.data.cameras.new('Craft detail study');camera=bpy.data.objects.new('Craft detail study',cd);scene.collection.objects.link(camera);scene.camera=camera;cd.lens=44
for name,pos in [('front',(6,-7,5.3)),('side',(7,1,4.8)),('rear',(-6,7,5.3))]:
    camera.location=pos;camera.rotation_euler=(Vector((0,0,.1))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ART/('blender-'+name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
print('ARRIVAL_DAIS_BUILT '+json.dumps(contract))
