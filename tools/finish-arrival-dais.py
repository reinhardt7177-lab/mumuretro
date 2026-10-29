"""An original fitted-stone arrival dais, with editable pieces and four web meshes."""
import bpy, bmesh, json, math, random
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/arrival-dais/v01'; OUT=ART/'exports'; OUT.mkdir(parents=True,exist_ok=True)
SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf-8'))
SOURCE=ART/'arrival-dais-v03.blend'
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
texture_rng=np.random.default_rng(20261026)
def noise(f):
    grid=texture_rng.random((f+1,f+1));gx=xx*f;gy=yy*f;ix=gx.astype(int);iy=gy.astype(int);u=gx-ix;v=gy-iy;u=u*u*(3-2*u);v=v*v*(3-2*v)
    return (grid[iy,ix]*(1-u)+grid[iy,ix+1]*u)*(1-v)+(grid[iy+1,ix]*(1-u)+grid[iy+1,ix+1]*u)*v
grain=noise(5)*.55+noise(22)*.27+noise(94)*.13+noise(250)*.05
first=np.full((n,n),1e6);second=first.copy()
for px,py in texture_rng.random((26,2)):
    dist=(xx-px)**2+(yy-py)**2;lower=dist<first;second=np.where(lower,first,np.minimum(second,dist));first=np.minimum(first,dist)
vein=np.exp(-((np.sqrt(second)-np.sqrt(first))/.0017)**2)*-.035
pix=np.empty((n,n,4),np.float32)
for k,base in enumerate((.76,.72,.63)):pix[:,:,k]=np.clip(base+(grain-.5)*.39+vein,.1,1)
pix[:,:,3]=1
tex=bpy.data.images.new('Arrival limestone mineral v02',width=n,height=n,alpha=True);tex.pixels.foreach_set(pix.ravel());tex.filepath_raw=str(ART/'limestone-v02-512.png');tex.file_format='PNG';tex.save();tex.pack()
node=stone.node_tree.nodes.new('ShaderNodeTexImage');node.image=tex;stone.node_tree.links.new(node.outputs['Color'],stone.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
heights=noise(44)*.7+noise(160)*.3;dy,dx=np.gradient(heights);normals=np.stack([-dx*6,-dy*6,np.ones_like(dx)],axis=-1);normals/=np.linalg.norm(normals,axis=-1,keepdims=True)
normal_pixels=np.ones((n,n,4),np.float32);normal_pixels[:,:,:3]=normals*.5+.5
normal_tex=bpy.data.images.new('Arrival limestone fine normal',width=n,height=n,alpha=True);normal_tex.colorspace_settings.name='Non-Color';normal_tex.pixels.foreach_set(normal_pixels.ravel());normal_tex.filepath_raw=str(ART/'limestone-v02-normal.png');normal_tex.file_format='PNG';normal_tex.save();normal_tex.pack()
normal_node=stone.node_tree.nodes.new('ShaderNodeTexImage');normal_node.image=normal_tex;normal_map=stone.node_tree.nodes.new('ShaderNodeNormalMap');normal_map.inputs['Strength'].default_value=.32;stone.node_tree.links.new(normal_node.outputs['Color'],normal_map.inputs['Color']);stone.node_tree.links.new(normal_map.outputs['Normal'],stone.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
colour_node=stone.node_tree.nodes.new('ShaderNodeVertexColor');colour_node.layer_name='LaidStoneTone';multiply=stone.node_tree.nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1;stone.node_tree.links.new(node.outputs['Color'],multiply.inputs[1]);stone.node_tree.links.new(colour_node.outputs['Color'],multiply.inputs[2]);stone.node_tree.links.new(multiply.outputs[0],stone.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
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
band('Buried slate foundation',.01,2.64,0,Z-.018,0,tau,edge,64,.012,12)
for i in range(8):
    a=i*tau/8+gap;b=(i+1)*tau/8-gap
    band('Fitted limestone paving sector %02d'%i,.53,2.225,Z-.08,Z,a,b,stone,12,.014,7)
    for sub in range(3):
        sa=i*tau/8+sub*tau/24+.006;sb=i*tau/8+(sub+1)*tau/24-.006
        band('Outer keyed limestone rim %02d.%d'%(i,sub),2.285,2.61,.025,Z-.002,sa,sb,stone,4,.018,6)
    # A thin seated glass channel, separated by real stone joints.
    band('Recessed circular turquoise segment %02d'%i,2.24,2.267,Z-.027,Z-.002,a+.015,b-.015,glass,12,.002,1)
    band('Bronze inlay lip %02d'%i,2.225,2.237,Z-.025,Z+.001,a,b,brass,12,.002,1)
    band('Outer bronze inlay lip %02d'%i,2.269,2.281,Z-.025,Z+.001,a,b,brass,12,.002,1)
    # Navigation channels are physical inlays; none extend beyond the platform.
    ang=i*tau/8
    band('Seated radial energy link %02d'%i,.55,2.23,Z-.028,Z-.002,ang-.005,ang+.005,glass,1,.001,7)
    for delta in (-.009,.009):band('Bronze divider arris',.55,2.23,Z-.026,Z+.001,ang+delta-.0015,ang+delta+.0015,brass,1,.001,7)
band('Navigator centre medallion',.003,.48,Z-.042,Z-.001,0,tau,brass,48,.008,2)
band('Compass recessed dark border',.48,.53,Z-.04,Z-.002,0,tau,edge,48,.003,1)
for i in range(8):
    a=i*tau/8;length=.40 if i%2==0 else .29;w=.042
    verts=[(0,0,Z+.001),(length*math.cos(a),length*math.sin(a),Z+.001),(w*math.cos(a+math.pi/2),w*math.sin(a+math.pi/2),Z+.001),(-w*math.cos(a+math.pi/2),-w*math.sin(a+math.pi/2),Z+.001)]
    mesh('Compass point',verts,[(0,2,1),(0,1,3)],edge)
for i in range(4):
    a=tau*(i+.5)/4;x=2.24*math.cos(a);y=2.24*math.sin(a)
    ob=band('Flush bronze lens collar %d'%i,.105,.18,Z-.06,Z+.003,0,tau,brass,24,.007,1)
    ob.location=(x,y,0)
    ob=band('Flush recessed lens %d'%i,.002,.106,Z-.025,Z-.003,0,tau,glass,24,.002,1);ob.location=(x,y,0)
    verts=[(x,y,Z+.018)];faces=[]
    for ring in range(1,4):
        r=.103*ring/3;h=Z-.002+.020*(1-(r/.103)**2)
        for j in range(24):aa=j*tau/24;verts.append((x+r*math.cos(aa),y+r*math.sin(aa),h))
    for j in range(24):faces.append((0,1+j,1+(j+1)%24))
    for ring in range(2):
        lo=1+ring*24;hi=lo+24
        for j in range(24):faces.append((lo+j,hi+j,hi+(j+1)%24,lo+(j+1)%24))
    mesh('Curved seated glass lens %d'%i,verts,faces,glass)
# Shallow old moss chips occupy the outside foot only, below walking level.
rng=random.Random(20261026)
for i in range(20):
    a=rng.random()*tau;length=rng.uniform(.025,.075)
    band('Weathered outside foot chip',2.60,2.635,.006,.018,a,a+length,edge,2,.002,1)

for i,ob in enumerate(pieces):
    if ob.data.materials[0]!=stone:continue
    tone=.85+.13*random.Random(71+i).random();colors=ob.data.color_attributes.new(name='LaidStoneTone',type='FLOAT_COLOR',domain='CORNER')
    for polygon in ob.data.polygons:
        for li in polygon.loop_indices:colors.data[li].color=(tone,tone*.99,tone*.96,1)
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
if triangles>17000:raise RuntimeError('Triangle budget exceeded '+str(triangles))
editable.hide_render=True;editable.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for obj in exports:obj.select_set(True)
bpy.context.view_layer.objects.active=exports[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'arrival-dais-v03.glb'),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT')
contract={'version':1,'revision':'v03','source':SOURCE.name,'localFloor':0,'walkHeight':Z,'runtimeConform':True,'maximumRadius':2.64,'webMeshes':len(exports),'materials':len(materials),'triangles':triangles,'editablePieces':len(pieces),'meshes':stats,'modelBytes':(OUT/'arrival-dais-v03.glb').stat().st_size}
(OUT/'arrival-dais-v03.json').write_text(json.dumps(contract,indent=2),encoding='utf-8')
ld=bpy.data.lights.new('Soft sun','SUN');sun=bpy.data.objects.new('Soft sun',ld);scene.collection.objects.link(sun);sun.rotation_euler=(math.radians(27),math.radians(-29),math.radians(-32));ld.energy=2.2;ld.angle=.08
cd=bpy.data.cameras.new('Craft detail study');camera=bpy.data.objects.new('Craft detail study',cd);scene.collection.objects.link(camera);scene.camera=camera;cd.lens=44
for name,pos in [('front',(6,-7,5.3)),('side',(7,1,4.8)),('rear',(-6,7,5.3))]:
    camera.location=pos;camera.rotation_euler=(Vector((0,0,.1))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ART/('blender-v03-'+name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
print('ARRIVAL_DAIS_BUILT '+json.dumps(contract))
