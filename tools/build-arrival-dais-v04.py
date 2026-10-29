"""v04 derivative of the preserved v03 Blender source; never writes v03/Root."""
import bpy,bmesh,math,json,random,hashlib,sys
from pathlib import Path
import numpy as np
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'art/arrival-dais/v04';O=A/'exports';O.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'art/arrival-dais/v01/arrival-dais-v03.blend';TARGET=A/'arrival-dais-v04.blend'
if TARGET.exists() and '--owned-refine' not in sys.argv:raise RuntimeError('Preserve existing revision; use another output version')
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.preferences.filepaths.temporary_directory=str(ROOT/'tmp/blender-validation')
editable=bpy.data.collections['EDITABLE_FITTED_PARTS'];web=bpy.data.collections['WEB_EXPORT_4_MESHES'];editable.hide_viewport=False;editable.hide_render=False
for ob in list(web.objects):bpy.data.objects.remove(ob,do_unlink=True)
remove=('Recessed circular turquoise segment','Bronze inlay lip','Outer bronze inlay lip','Seated radial energy link','Bronze divider arris','Navigator centre medallion','Compass recessed dark border','Compass point','Flush bronze lens collar','Flush recessed lens','Curved seated glass lens')
for ob in list(editable.objects):
    if ob.name.startswith(remove):bpy.data.objects.remove(ob,do_unlink=True)
stone=bpy.data.materials['Weathered warm limestone'];edge=bpy.data.materials['Recessed slate and old moss'];brass=bpy.data.materials['Aged navigator bronze'];glass=bpy.data.materials['Seated turquoise glass'];materials=[stone,edge,brass,glass]
def colour(mat,rgb,metal,rough):
    p=mat.node_tree.nodes.get('Principled BSDF');mat.diffuse_color=(*rgb,1);p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
colour(brass,(.70,.48,.20),.52,.40);colour(glass,(.12,.56,.60),.08,.27)
gp=glass.node_tree.nodes.get('Principled BSDF');gp.inputs['Emission Color'].default_value=(.12,.56,.60,1);gp.inputs['Emission Strength'].default_value=.20
# Retain mineral scale while adding a little broad, warm stone separation.
old=bpy.data.images['Arrival limestone mineral v02'];image=old.copy();image.name='Arrival limestone v04';pixels=np.asarray(old.pixels[:],dtype=np.float32).reshape(512,512,4)
pixels[:,:,:3]=np.clip(pixels[:,:,:3]*.99+np.array([.065,.060,.045],np.float32),0,1)
# Shallow fractures are stone wear, not extra navigation lines. A few broken
# mineral seams interrupt the uniform fine grain; they are not continuous rings.
rng=np.random.default_rng(2026102704)
for k in range(13):
    x,y=rng.integers(12,500,2);angle=float(rng.uniform(0,math.tau));length=int(rng.integers(24,80))
    for step in range(length):
        angle+=float(rng.normal(0,.12));x+=math.cos(angle);y+=math.sin(angle);ix=int(x)%512;iy=int(y)%512
        pixels[iy,ix,:3]*=.78
image.pixels.foreach_set(pixels.ravel());image.filepath_raw=str(A/'limestone-v04-512.png');image.file_format='PNG';image.save();image.pack()
for n in stone.node_tree.nodes:
    if n.type=='TEX_IMAGE' and n.image==old:n.image=image
for n in stone.node_tree.nodes:
    if n.type=='VERTEX_COLOR':n.layer_name='StoneTone'
# All original parts remain individually editable in the new source.
for i,ob in enumerate(list(editable.objects)):
    if not ob.name.startswith('Outer keyed limestone rim'):continue
    p=ob.data.vertices;angles=[math.atan2(v.co.y,v.co.x) for v in p];mid=math.atan2(sum(math.sin(a) for a in angles),sum(math.cos(a) for a in angles))
    r=random.Random(2710+i);radial=r.uniform(-.080,.016);lift=r.uniform(.002,.010);tilt=r.uniform(-.002,.002);trim=r.uniform(.015,.040)
    for v in p:
        x,y,z=v.co;radius=math.hypot(x,y);angle=math.atan2(y,x);delta=(angle-mid+math.pi)%math.tau-math.pi
        # Trim end corners and vary the outer perimeter while preserving the
        # buried foundation's original maximum footprint 2.64m.
        outer=max(0,min(1,(radius-2.54)/.07));end=max(0,min(1,(abs(delta)-.085)/.045))
        radius+=radial*outer-trim*outer*end;angle-=math.copysign(trim*.18*outer*end,delta)
        v.co.x=radius*math.cos(angle);v.co.y=radius*math.sin(angle)
        if z>.17:v.co.z+=lift+tilt*delta/.13-.009*outer*end
    ob.data.update()
pieces=list(editable.objects);Z=.22;tau=math.tau
def mesh(name,verts,faces,mat):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    ob=bpy.data.objects.new(name,data);editable.objects.link(ob);data.materials.append(mat);pieces.append(ob)
    uv=data.uv_layers.new(name='Stone laid coordinates')
    for poly in data.polygons:
        for li in poly.loop_indices:
            co=data.vertices[data.loops[li].vertex_index].co;uv.data[li].uv=(co.x*.43+.5,co.y*.43+.5)
    return ob
def band(name,ri,ro,zb,zt,a0,a1,mat,segments,bevel=.004,radial=1):
    levels=[(ri,zb),(ro,zb),(ro,zt-bevel),(ro-bevel,zt)]
    for i in range(1,radial+1):levels.append((ro-bevel+(ri+2*bevel-ro)*i/radial,zt))
    levels.append((ri,zt-bevel));verts=[(r*math.cos(a0+(a1-a0)*j/segments),r*math.sin(a0+(a1-a0)*j/segments),z) for r,z in levels for j in range(segments+1)];stride=segments+1;faces=[]
    for k in range(len(levels)):
        for j in range(segments):faces.append((k*stride+j,k*stride+j+1,((k+1)%len(levels))*stride+j+1,((k+1)%len(levels))*stride+j))
    for j in (0,segments):faces.append(tuple(k*stride+j for k in range(len(levels))))
    return mesh(name,verts,faces,mat)
def strip(name,angle,ri,ro,width,zb,zt,mat,offset=0):
    # Constant linear width, including near the medallion; dense longitudinal
    # samples preserve the existing conformed-ground contract.
    co,si=math.cos(angle),math.sin(angle);verts=[];segments=8
    for z in (zb,zt):
        for side in (-1,1):
            for i in range(segments+1):
                radius=ri+(ro-ri)*i/segments;t=side*width/2+offset;verts.append((radius*co-t*si,radius*si+t*co,z))
    n=segments+1;faces=[]
    for i in range(segments):faces.extend([(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),(i,2*n+i,2*n+i+1,i+1),(n+i,n+i+1,3*n+i+1,3*n+i)])
    faces.extend([(0,n,3*n,2*n),(segments,2*n+segments,3*n+segments,n+segments)])
    return mesh(name,verts,faces,mat)
for i in range(8):
    a=i*tau/8;b=(i+1)*tau/8;gap=.008
    band('V04 seated circular turquoise %02d'%i,2.225,2.270,Z-.026,Z-.001,a+gap,b-gap,glass,12,.002,1)
    band('V04 bronze channel inner lip %02d'%i,2.212,2.224,Z-.027,Z+.001,a+gap,b-gap,brass,12,.002,1)
    band('V04 bronze channel outer lip %02d'%i,2.272,2.284,Z-.027,Z+.001,a+gap,b-gap,brass,12,.002,1)
    strip('V04 constant width turquoise %02d'%i,a,.59,2.245,.045,Z-.026,Z-.001,glass)
    for side in (-1,1):strip('V04 bronze radial lip %02d %d'%(i,side),a,.59,2.245,.010,Z-.026,Z+.001,brass,side*.029)
band('V04 compass bronze medallion',.002,.545,Z-.042,Z+.001,0,tau,brass,48,.006,3)
band('V04 compass dark narrow joint',.545,.575,Z-.035,Z-.001,0,tau,edge,48,.003,1)
def star(name,outer,inner,z,mat):
    verts=[(0,0,z)];faces=[]
    for i in range(16):
        a=i*tau/16;radius=(outer if i%4==0 else outer*.78) if i%2==0 else inner;verts.append((radius*math.cos(a),radius*math.sin(a),z))
    for i in range(16):faces.append((0,1+i,1+(i+1)%16))
    return mesh(name,verts,faces,mat)
star('V04 compass recessed eight point silhouette',.475,.17,Z+.002,edge)
star('V04 readable raised bronze compass',.445,.125,Z+.012,brass)
for i in range(4):
    a=tau*(i+.5)/4;x=2.24*math.cos(a);y=2.24*math.sin(a)
    collar=band('V04 bevelled bronze lens collar %d'%i,.145,.235,Z-.048,Z+.006,0,tau,brass,28,.009,2);collar.location=(x,y,0)
    verts=[(x,y,Z+.034)];faces=[];segments=28
    for ring in range(1,5):
        radius=.143*ring/4;h=Z+.003+.031*(1-(radius/.143)**2)
        for j in range(segments):aa=j*tau/segments;verts.append((x+radius*math.cos(aa),y+radius*math.sin(aa),h))
    for j in range(segments):faces.append((0,1+j,1+(j+1)%segments))
    for ring in range(3):
        lo=1+ring*segments;hi=lo+segments
        for j in range(segments):faces.append((lo+j,hi+j,hi+(j+1)%segments,lo+(j+1)%segments))
    mesh('V04 seated turquoise lens dome %d'%i,verts,faces,glass)
# Exactly one colour attribute is exported; v03 had useful stone colour only in
# COLOR_1, which the standard Three r160 material did not consume.
for i,ob in enumerate(pieces):
    for attr in list(ob.data.color_attributes):ob.data.color_attributes.remove(attr)
    if ob.data.materials[0]!=stone:continue
    r=random.Random(4400+i);tone=r.uniform(.85,1.0);attr=ob.data.color_attributes.new(name='StoneTone',type='FLOAT_COLOR',domain='CORNER')
    for poly in ob.data.polygons:
        shade=.92 if poly.normal.z<.3 else 1
        for li in poly.loop_indices:attr.data[li].color=(tone*shade,tone*.99*shade,tone*.955*shade,1)
    ob.data.color_attributes.active_color_index=0;ob.data.color_attributes.render_color_index=0
exports=[];stats=[]
for mat,name in zip(materials,['Arrival_Weathered','Arrival_Recessed','Arrival_Aged','Arrival_Seated']):
    bpy.ops.object.select_all(action='DESELECT');copies=[]
    for original in pieces:
        if original.data.materials[0]!=mat:continue
        ob=original.copy();ob.data=original.data.copy();web.objects.link(ob);ob.select_set(True);copies.append(ob)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();merged=bpy.context.object;merged.name=name;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);merged.data.calc_loop_triangles();exports.append(merged)
    stats.append({'name':name,'triangles':len(merged.data.loop_triangles),'vertices':len(merged.data.vertices),'material':mat.name})
triangles=sum(s['triangles'] for s in stats)
if triangles>20000:raise RuntimeError('Web triangle budget exceeded '+str(triangles))
editable.hide_render=True;editable.hide_viewport=True;bpy.ops.object.select_all(action='DESELECT')
for ob in exports:ob.select_set(True)
bpy.context.view_layer.objects.active=exports[0]
bpy.ops.export_scene.gltf(filepath=str(O/'arrival-dais-v04.glb'),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT')
points=[ob.matrix_world@v.co for ob in exports for v in ob.data.vertices];minimum=min(p.z for p in points);maximum=max(p.z for p in points);radius=max(math.hypot(p.x,p.y) for p in points)
contract={'version':1,'revision':'v04','source':TARGET.name,'derivedFrom':'art/arrival-dais/v01/arrival-dais-v03.blend','sourceFloor':minimum,'sourceWalkHeight':Z,'maximumSourceHeight':maximum,'maximumRadius':radius,'webMeshes':4,'materials':4,'triangles':triangles,'editablePieces':len(pieces),'meshes':stats,'runtimeConform':True,'nativeSupport':{'height':.16,'inner':2.27,'outer':2.64,'changed':False},'radialChannelWidth':.045,'circularChannelWidth':.045,'lensDiameter':.286,'lensCollarDiameter':.47,'stoneColourAttribute':'COLOR_0 only','runtimeMaterialNote':'Keep existing bronze metalness clamp .30 and glass pulse; do not alter support, collision, footing or save keys'}
(O/'arrival-dais-v04.json').write_text(json.dumps(contract,indent=2),encoding='utf-8')
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.device='CPU';scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=100
camera=scene.camera
if not camera:
    cd=bpy.data.cameras.new('V04 study');camera=bpy.data.objects.new('V04 study',cd);scene.collection.objects.link(camera);scene.camera=camera
camera.data.lens=44
for name,pos in [('front',(6,-7,5.3)),('side',(7,1,4.8)),('rear',(-6,7,5.3))]:
    camera.location=pos;camera.rotation_euler=(Vector((0,0,.1))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(A/('blender-'+name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET));print('ARRIVAL_V04 '+json.dumps(contract))
