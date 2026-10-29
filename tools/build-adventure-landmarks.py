"""Blender source + GLB: ridge armillary and branching woodland kit, Y-up metres."""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/adventure-direction/v03'
OUT=ROOT/'assets/models/adventure'
SPEC=json.loads((ART/'design-spec.json').read_text())
O=SPEC['observatory'];P=O['plinth'];A=O['armillary'];TREE=SPEC['trees']
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world.color=(.32,.38,.43);scene.view_settings.view_transform='AgX'

def material(name,rgb,metal=0,rough=.8):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    return m
stone=material('Survey limestone',(.70,.66,.54))
brass=material('Survey satin brass',(.63,.40,.12),.68,.33)
bronze=material('Survey dark bronze',(.17,.12,.07),.63,.48)
lens=material('Survey teal lens',(.045,.32,.31),.32,.20)

def finish(ob,name,mat,parent=None):
    ob.name=name;ob.data.materials.clear();ob.data.materials.append(mat)
    if parent:ob.parent=parent
    return ob
def cylinder(name,radius,depth,z,mat,vertices=24,r2=None,xy=(0,0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=radius if r2 is None else r2,depth=depth,location=(*xy,z))
    return finish(bpy.context.object,name,mat)
def box(name,location,scale,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location);o=finish(bpy.context.object,name,mat);o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o
def rod(name,a,b,r1,r2,mat,vertices=8):
    a,b=Vector(a),Vector(b);d=b-a;o=cylinder(name,r1,d.length,0,mat,vertices,r2)
    o.location=(a+b)*.5;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def torus(name,centre,radius,tube,mat,rotation=(math.pi/2,0,0),segments=48):
    bpy.ops.mesh.primitive_torus_add(major_segments=segments,minor_segments=6,location=centre,major_radius=radius,minor_radius=tube,rotation=rotation)
    return finish(bpy.context.object,name,mat)
def join(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=objects[0];o.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    tri=o.modifiers.new('Web triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
    return o
def export(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/name),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,
      export_extras=True,export_vertex_color='NAME',export_vertex_color_name='Tint',export_all_vertex_colors=False)
def metrics(objects):
    rows=[]
    for o in objects:
        coords=[o.matrix_world@v.co for v in o.data.vertices]
        rows.append({'name':o.name,'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'materials':len(o.data.materials),
         'min':[min(v[i] for v in coords) for i in range(3)],'max':[max(v[i] for v in coords) for i in range(3)]})
    return rows
def add_tint(ob,kind='stone'):
    attr=ob.data.color_attributes.new(name='Tint',type='FLOAT_COLOR',domain='CORNER')
    for p in ob.data.polygons:
        for li in p.loop_indices:
            v=ob.data.vertices[ob.data.loops[li].vertex_index].co
            n=.95+.045*math.sin(v.x*23+v.z*19)+.025*math.sin(v.y*67-v.z*11)
            if kind=='bark':n=.85+.13*math.sin(v.x*43+v.y*31+v.z*.8)**2
            attr.data[li].color=(n,n,n*.97,1)

# All building parts are authored at the local bottom plane.
obs=[]
obs.append(cylinder('Foot plinth',P['radius'],P['height'],P['height']/2,stone,P['sides']))
obs.append(cylinder('Stone foot bevel',.48,.10,.21,stone,12,.39))
obs.append(cylinder('Lower carved shaft',.27,1.02,.77,stone,16,.225))
obs.append(cylinder('Upper carved shaft',.225,1.28,1.92,stone,16,.17))
for z,r in[(.32,.28),(1.30,.245),(2.52,.205),(2.65,.245)]:
    obs.append(cylinder('Limestone collar',r,.075,z,stone,24))
    obs.append(cylinder('Brass collar seam',r+.008,.014,z+.036,brass,24))
obs.append(cylinder('Cradle spindle',.06,.66,2.98,bronze,12))
centre=(0,0,A['centreHeight'])
obs.append(torus('Fixed meridian',centre,A['outerRadius'],A['tube'],brass,segments=A['radialSegments']))
obs.append(torus('Equatorial ring',centre,.63,.021,brass,(0,.15,.10)))
moving=torus('survey_ring',centre,.61,.019,brass,(math.radians(68),math.radians(28),0))
obs.append(torus('Cradle arc',centre,.79,.035,bronze))
# Remove the upper half of the cradle, keeping two side pivots and a U-shaped foot.
cradle=obs[-1];bpy.context.view_layer.objects.active=cradle
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
import bmesh
bm=bmesh.new();bm.from_mesh(cradle.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z>.015],context='VERTS');bm.to_mesh(cradle.data);bm.free()
for x in[-.79,.79]:
    obs.append(rod('Side pivot',(x,-.06,3.30),(x,.06,3.30),.065,.065,brass,12))
obs.append(rod('Lens axle',(-.70,0,3.30),(.70,0,3.30),.017,.017,bronze,10))
for a in range(0,360,10):
    t=math.radians(a);r=.70
    tick=box('Meridian engraved index',(math.sin(t)*r,-.027,3.30+math.cos(t)*r),(.012,.012,.040 if a%30==0 else .023),bronze)
    tick.rotation_euler.y=t;obs.append(tick)
for a in[0,90,180,270]:
    t=math.radians(a);x,z=math.sin(t)*.7279,3.30+math.cos(t)*.7279
    gem=box('Cardinal diamond',(x,-.018,z),(.10,.055,.10),brass);gem.rotation_euler.y=math.pi/4;obs.append(gem)
    inset=box('Cardinal inlay',(x,-.050,z),(.045,.008,.045),bronze);inset.rotation_euler.y=math.pi/4;obs.append(inset)
for k in range(4):
    a=k*math.pi/2
    for z0,z1,off in[(.42,.82,-.034),(.42,.82,.034),(.82,1.0,-.034),(.82,1.0,.034),(1.48,2.3,0)]:
        radius_at=lambda z:(.27+(.225-.27)*(z-.26)/1.02 if z<=1.28 else .225+(.17-.225)*(z-1.28)/1.28)+.001
        p=(math.cos(a)*radius_at(z0),math.sin(a)*radius_at(z0),z0);a1=a+off/.25
        q=(math.cos(a1)*radius_at(z1),math.sin(a1)*radius_at(z1),z1)
        obs.append(rod('Fine carved brass line',p,q,.005,.005,brass,5))
# Flat jewel, rather than an opaque glowing sphere.
gem=cylinder('Teal lens',.105,.045,0,lens,24);gem.location=(0,-.055,3.30);gem.rotation_euler.x=math.pi/2;obs.append(gem)
obs.append(torus('Lens bezel',(0,-.082,3.30),.119,.016,bronze))
obs.append(rod('Top needle',(0,0,O['height']-.1),(0,0,O['height']),.037,0,brass,8))
obs_parts=[]
by_material={mat:[o for o in obs if o.data.materials[0]==mat] for mat in[stone,brass,bronze,lens]}
for mat in[stone,brass,bronze,lens]:
    part=join(by_material[mat],mat.name);add_tint(part);obs_parts.append(part)
moving=join([moving],'survey_ring');add_tint(moving)
# Keep the pivot at the centre for actual runtime animation, not the base.
for v in moving.data.vertices:v.co.z-=3.30
moving.location.z=3.30
obs_parts.append(moving)
export(obs_parts,'observatory-v03.glb')
obs_metrics=metrics(obs_parts)

# Texture atlas of real small leaf sprays, made from native shapes. The alpha
# mask is shared by all cards; shadows use the same mask at runtime.
size=512;rgba=np.zeros((size,size,4),dtype=np.float32)
yy,xx=np.mgrid[0:size,0:size]
for tile in range(16):
    tx,ty=tile%4,tile//4
    rnd=random.Random(900+tile)
    for pair in range(4):
        for side in[-1,1]:
            cx=(tx+.5+side*(.16-.015*pair))*128
            cy=(ty+.20+pair*.18)*128
            length=(.27+rnd.random()*.035)*128;width=length*.26
            angle=side*(.55+pair*.05)
            dx,dy=xx-cx,yy-cy
            u=dx*math.sin(angle)+dy*math.cos(angle)
            v=dx*math.cos(angle)-dy*math.sin(angle)
            t=(u+length*.5)/length
            w=width*np.sin(np.clip(t,0,1)*math.pi)**.8
            alpha=np.clip((w-np.abs(v))*1.4,0,1)*((t>0)&(t<1))
            tone=.74+.20*t+.04*np.cos(v*.7)
            tone-=np.exp(-(v/1.3)**2)*.14
            mask=alpha>rgba[:,:,3]
            for channel,factor in enumerate([1.0,1.0,.92]):rgba[:,:,channel][mask]=(tone*factor)[mask]
            rgba[:,:,3][mask]=alpha[mask]
    # A thin stem joins the visible leaf pairs.
    mask=(np.abs(xx-(tx+.5)*128)<1.2)&(yy>(ty+.1)*128)&(yy<(ty+.88)*128)
    rgba[mask,:3]=(.48,.49,.40);rgba[mask,3]=1
image=bpy.data.images.new('Leaf spray atlas512',width=size,height=size,alpha=True)
image.pixels.foreach_set(rgba.ravel());image.filepath_raw=str(ART/'leaf-sprays.png');image.file_format='PNG';image.save();image.pack()
leaf_mat=material('Leaf spray alpha mask',(1,1,1),0,.9)
nodes=leaf_mat.node_tree.nodes;links=leaf_mat.node_tree.links;bs=nodes.get('Principled BSDF')
tex=nodes.new('ShaderNodeTexImage');tex.image=image
links.new(tex.outputs['Color'],bs.inputs['Base Color'])
clip=nodes.new('ShaderNodeMath');clip.operation='GREATER_THAN';clip.inputs[1].default_value=.45
links.new(tex.outputs['Alpha'],clip.inputs[0]);links.new(clip.outputs[0],bs.inputs['Alpha'])
leaf_mat.surface_render_method='DITHERED';leaf_mat.use_backface_culling=False
bark_mat=material('Neutral bark grain',(.94,.92,.87),0,.95)
grain=.76+.12*np.sin(xx/512*math.pi*34+np.sin(yy/512*9)*.7)+.035*np.sin(xx*.73+yy*.03)
bark_image=bpy.data.images.new('Bark grain512',width=512,height=512)
bark_pixels=np.stack((grain,grain,grain,np.ones_like(grain)),axis=2).astype(np.float32)
bark_image.pixels.foreach_set(bark_pixels.ravel());bark_image.filepath_raw=str(ART/'bark-grain.png');bark_image.file_format='PNG';bark_image.save();bark_image.pack()
bark_tex=bark_mat.node_tree.nodes.new('ShaderNodeTexImage');bark_tex.image=bark_image
bark_mat.node_tree.links.new(bark_tex.outputs['Color'],bark_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

clusters=[]
for i in range(4):
    a=i*math.tau/4+.25;clusters.append((1.15*math.cos(a),1.15*math.sin(a),3.85+.10*math.sin(a)))
for i in range(5):
    a=i*math.tau/5+.6;clusters.append((1.25*math.cos(a),1.25*math.sin(a),4.70+.10*math.sin(a*2)))
for i in range(3):
    a=i*math.tau/3;clusters.append((.64*math.cos(a),.64*math.sin(a),5.48))

# One compatible woody network supports both canopy variants.
wood=[]
points=[(0,0,0),(.04,.015,.8),(-.035,.025,1.6),(.035,-.015,TREE['branchStartHeight']),(.10,.04,3.12),(.02,.08,4.00),(.10,.04,4.8)]
for i,(a,b) in enumerate(zip(points,points[1:])):
    r1=.25*(1-i*.12);r2=.25*(1-(i+1)*.12)
    wood.append(rod('Contoured trunk',a,b,r1,r2,bark_mat,12))
for i,end in enumerate(clusters):
    base=Vector(points[3 if i<4 else 4 if i<9 else 5]);end=Vector(end)
    mid=base.lerp(end,.58)+Vector((.06*math.sin(i),.04*math.cos(i),.16))
    wood.append(rod('Forked limb',base,mid,.09 if i<9 else .055,.045,bark_mat,8))
    wood.append(rod('Tapered twig',mid,end,.045,.009,bark_mat,7))
    for j in range(2):
        tip=end+Vector((math.sin(i+j)*.38,math.cos(i-j)*.34,.24+j*.13))
        wood.append(rod('Fine twig',mid.lerp(end,.8),tip,.018,.003,bark_mat,5))
for i in range(9):
    a=i*math.tau/9
    wood.append(rod('Root bark flute',(.23*math.cos(a),.23*math.sin(a),.03),(.14*math.cos(a),.14*math.sin(a),.58),.025,.014,bark_mat,5))
trunk=join(wood,'trunk');add_tint(trunk,'bark')
bottom=min(v.co.z for v in trunk.data.vertices)
for v in trunk.data.vertices:v.co.z-=bottom
tree_parts=[trunk]
for variant in range(2):
    rnd=random.Random(6100+variant);verts=[];faces=[];uvs=[];tints=[]
    for ci,centre0 in enumerate(clusters):
        centre=Vector(centre0)
        if variant:centre.x*=.82;centre.y*=.85
        for j in range(60):
            az=rnd.random()*math.tau;zz=rnd.uniform(-1,1);rr=math.sqrt(max(0,1-zz*zz));rad=rnd.random()**.4
            offset=Vector((rr*math.cos(az)*.68,rr*math.sin(az)*.60,zz*.48))*rad
            point=centre+offset
            normal=Vector((rnd.uniform(-1,1),rnd.uniform(-1,1),rnd.uniform(.25,1))).normalized()
            x=normal.cross(Vector((0,0,1))).normalized()
            if x.length<.1:x=Vector((1,0,0))
            y=normal.cross(x).normalized()
            angle=rnd.random()*math.tau
            x,y=x*math.cos(angle)+y*math.sin(angle),-x*math.sin(angle)+y*math.cos(angle)
            width=.50+rnd.random()*.18;height=.62+rnd.random()*.15
            tile=(ci*7+j)%16;tx,ty=tile%4,tile//4
            base=len(verts)
            for sx,sy in[(-1,-1),(1,-1),(1,1),(-1,1)]:
                v=point+x*(sx*width*.5)+y*(sy*height*.5);v.z=max(3.12,min(TREE['height'],v.z));verts.append(tuple(v))
                uvs.append(((tx+(sx+1)*.5)*.25,(ty+(sy+1)*.5)*.25))
                tint=.80+rnd.random()*.20;tints.append((tint,tint, .88*tint,1))
            faces.extend([(base,base+1,base+2),(base,base+2,base+3)])
    mesh=bpy.data.meshes.new('SprayCards_'+str(variant));mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new('canopy'+('A' if variant==0 else 'B'),mesh);scene.collection.objects.link(obj);obj.data.materials.append(leaf_mat)
    uv=mesh.uv_layers.new(name='UVMap');col=mesh.color_attributes.new(name='Tint',type='FLOAT_COLOR',domain='CORNER')
    for p in mesh.polygons:
        for li in p.loop_indices:
            vi=mesh.loops[li].vertex_index;uv.data[li].uv=uvs[vi];col.data[li].color=tints[vi]
    obj['leaf_length_m']=[.13,.23];obj['camera_visual_foliage']=True
    tree_parts.append(obj)
export(tree_parts,'woodland-v03.glb')
tree_metrics=metrics(tree_parts)
assert sum(m['triangles'] for m in obs_metrics)<=O['maxTriangles']
assert len(obs_metrics)<=O['maxDrawMeshes']
assert tree_metrics[0]['triangles']<=TREE['trunkTrianglesPerVariantMax']
assert all(m['triangles']<=TREE['leafTrianglesPerVariantMax'] for m in tree_metrics[1:])
(OUT/'landmark-spec-v03.json').write_text(json.dumps({key:SPEC[key] for key in['version','observatory','overlookSite','trees','camera']},indent=2))

# Presentation tints represent runtime instance colours; exported materials stay
# neutral and reusable. The original authored meshes/UVs remain editable.
def preview_tint(material0,tint):
    m=material0.copy();m.name+=' - inspection tint'
    nodes=m.node_tree.nodes;links=m.node_tree.links;bs=nodes.get('Principled BSDF');old=bs.inputs['Base Color'].links[0].from_socket
    mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*tint,1);links.new(old,mix.inputs[1]);links.new(mix.outputs[0],bs.inputs['Base Color']);return m
trunk.data.materials[0]=preview_tint(bark_mat,(.35,.24,.13))
leaf_preview=preview_tint(leaf_mat,(.37,.52,.20))
for o in tree_parts[1:]:o.data.materials[0]=leaf_preview

# Inspection stage: original assets stay at origin in the exports above.
trunk.location.x=4.0;tree_parts[1].location.x=4.0;tree_parts[2].location.x=10.0
preview_trunk=trunk.copy();scene.collection.objects.link(preview_trunk);preview_trunk.location.x=10.0
for o in obs_parts:o.location.x=-2.5
floor=material('Inspection floor',(.22,.26,.22))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02));bpy.context.object.data.materials.append(floor)
for pos,energy,size0 in[((-3,-5,10),2200,6),((3,5,8),1100,5)]:
    bpy.ops.object.light_add(type='AREA',location=pos);bpy.context.object.data.energy=energy;bpy.context.object.data.size=size0
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=18;scene.camera=camera
camera.location=(12,-19,11);camera.rotation_euler=(Vector((3.5,0,2.8))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(ART/'kit-review.png');bpy.ops.wm.save_as_mainfile(filepath=str(ART/'landmarks-v03.blend'));bpy.ops.render.render(write_still=True)
# Exact orthographic object views, separate from AI target concepts.
for o in tree_parts+[preview_trunk]:o.hide_render=True
for name,pos in[('front',(-2.5,-10,2.05)),('side',(7.5,0,2.05)),('back',(-2.5,10,2.05))]:
    camera.location=pos;camera.rotation_euler=(Vector((-2.5,0,2.05))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=5.0
    scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.filepath=str(ART/('observatory-'+name+'.png'));bpy.ops.render.render(write_still=True)
(ART/'model-metrics.json').write_text(json.dumps({'coordinates':'Blender Z-up, exported glTF Y-up','observatory':obs_metrics,'woodland':tree_metrics},indent=2))
print('LANDMARKS_METRICS',json.dumps({'observatory':obs_metrics,'woodland':tree_metrics}))
