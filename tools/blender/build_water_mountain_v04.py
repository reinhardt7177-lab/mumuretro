"""Versioned sculptural cliff and solar instrument; preserve v03 traversal anchors."""
import bpy, bmesh, math, os, sys, json, random
from mathutils import Vector, noise
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,vec,material,mesh,ring,rod,box
ART=os.path.join(ROOT,'art/water-temple-mountain')
OUT=os.path.join(ROOT,'art/engine-transfer/model-data/WaterMountain')
bpy.ops.wm.open_mainfile(filepath=os.path.join(ART,'water-mountain-v03.blend'))
rng=random.Random(404)
# Keep the authored contact surfaces and walking shelves, replace the block-built geology.
keep=('Worn grip','Subtle foothold','Resting shelf','Attached eroded','Sparse terrace grass')
for o in list(bpy.data.objects):
    if o.type in {'MESH','CURVE'} and not o.name.startswith(keep):bpy.data.objects.remove(o,do_unlink=True)
    elif o.type in {'CAMERA','LIGHT'}:bpy.data.objects.remove(o,do_unlink=True)
stone=[]
for i,c in enumerate([(.39,.235,.12),(.49,.31,.17),(.58,.39,.23),(.66,.47,.29),(.53,.345,.185)]):
    stone.append(material('V04 weathered sandstone %d'%i,c,0,.88))
bronze=material('V04 aged bronze',(.23,.105,.04),.78,.32)
gold=material('V04 engraved warm brass',(.64,.39,.12),.74,.29)
ivory=material('V04 altar limestone',(.68,.59,.42),0,.78)
reflect=material('V04 polished silver gold',(.72,.79,.74),.92,.13)
turquoise=material('V04 turquoise enamel',(.025,.28,.26),.42,.26)
moss=material('V04 crevice moss',(.16,.215,.075),0,.96)
# Rounded, lobed continuous strata. No separate rectangular wall tiles.
def massif(name,cx,cz,rx,rz,bottom,top,front):
    vs=[];faces=[];N=96;rows=int((top-bottom)/.12)
    for j in range(rows+1):
        y=bottom+(top-bottom)*j/rows
        wave=.022*math.sin(y*8)+.015*math.sin(y*21)+.09*math.sin(y*1.7)
        for i in range(N):
            a=i*math.tau/N;co=math.cos(a);si=math.sin(a)
            sx=math.copysign(abs(co)**.55,co);sz=math.copysign(abs(si)**.55,si)
            fissure=.22*math.sin(a*9+y*.10)+.12*math.sin(a*17-y*.12)+.11*noise.noise(Vector((co*4,si*4,y*.6)))
            x=cx+sx*(rx+wave+fissure)
            z=cz+sz*(rz+wave+fissure)
            # Maintain a close visual skin behind existing lower hand contacts.
            if sz<-.85:z=max(front-.08,z)
            height=y+.11*math.sin(a*7+y*.7)+.06*math.sin(a*19)
            vs.append((x,height,z))
    for j in range(rows):
        for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
    faces.extend([tuple(reversed(range(N))),tuple(rows*N+i for i in range(N))])
    ob=mesh(name,vs,faces,stone[0])
    for mat in stone[1:]:ob.data.materials.append(mat)
    for p in ob.data.polygons:
        y=sum(ob.data.vertices[v].co.z for v in p.vertices)/len(p.vertices)
        p.material_index=[1,2,2,3,2,1,4,2][int((y+.15*math.sin(p.index*.03))*2.2)%8]
        p.use_smooth=True
    return ob
massif('Sculpted continuous lower sandstone',-.9,2.7,6.35,6.82,-3.7,5.18,-4.15)
massif('Sculpted retreating upper sandstone',-2.7,5.5,3.30,4.52,4.55,8.62,.98)
massif('Sculpted summit crown',.05,6.95,2.32,2.56,8.2,11.27,4.39)
for i,(x,y,z) in enumerate([(1.8,5.6,-3.5),(3,6.1,-2.2),(4,6.8,0),(2.6,7.6,2),(1,8.6,3.5)]):
    massif('Natural supporting rock spur '+str(i),x-.45,z+.7,.90,1.15,-.3,y-.35,z-.4)
# Smooth worn retained shelves, foot seams and hand edges.
for o in list(bpy.context.scene.objects):
    if o.type=='MESH' and o.name.startswith(('Worn grip','Subtle foothold','Resting shelf')):
        mod=o.modifiers.new('Eroded grip edges','BEVEL');mod.width=.035;mod.segments=2
        o.data.materials.clear();o.data.materials.append(stone[3])
# Scattered irregular boulders at base and rear summit, rather than cubic moss tiles.
for i in range(38):
    a=rng.uniform(0,math.tau);x=-.9+math.cos(a)*rng.uniform(6,7.8);z=2.7+math.sin(a)*rng.uniform(6.6,8)
    if z< -3.9 and x< -3:continue
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=vec((x,-.1,z)))
    ob=bpy.context.object;ob.name='Weathered talus';ob.scale=(rng.uniform(.4,1),rng.uniform(.35,.85),rng.uniform(.3,.65));ob.data.materials.append(stone[i%5])
    for v in ob.data.vertices:v.co*=rng.uniform(.87,1.12)
for level,cx,cz,rx,rz in [(5.20,-.9,2.7,5.8,5.5),(8.65,-2.7,5.5,2.8,3.8),(11.29,.05,6.95,1.9,2)]:
    for i in range(24):
        x=cx+rng.uniform(-rx,rx);z=cz+rng.uniform(-rz,rz)
        if x>0 and z<5.8:continue
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=vec((x,level,z)))
        ob=bpy.context.object;ob.name='Fractured terrace outcrop';ob.scale=(rng.uniform(.25,.8),rng.uniform(.25,.8),rng.uniform(.12,.55));ob.data.materials.append(stone[i%5] if i%3 else moss)
        for v in ob.data.vertices:v.co*=rng.uniform(.85,1.15)
# All instrument parts use a separate export group for the existing rotating pivot.
cliff_objects=set(bpy.context.scene.objects)
base=(1.35,11.3,5.2)
def add(a,b):return tuple(a[i]+b[i] for i in range(3))
for radius,y in [(1.1,.10),(.91,.22),(.76,.31)]:
    rod('Carved altar tier',add(base,(0,y-.08,0)),add(base,(0,y+.08,0)),radius,ivory,vertices=64)
    ring('Inset altar bronze edge',add(base,(0,y+.08,0)),radius*.97,.018,gold,segments=64)
for i in range(3):
    a=i*math.tau/3+.5;dx=math.cos(a);dz=math.sin(a)
    rod('Tripod bronze foot',add(base,(dx*.66,.32,dz*.66)),add(base,(dx*.30,1.3,dz*.30)),.09,bronze,vertices=12)
    rod('Tripod upper yoke',add(base,(dx*.30,1.3,dz*.30)),add(base,(dx*.56,1.75,dz*.56)),.065,gold,vertices=12)
rod('Faceted carved altar shaft',add(base,(0,.30,0)),add(base,(0,1.33,0)),.27,ivory,vertices=12)
for y in [.38,.52,1.13,1.27]:ring('Pedestal decorative collar',add(base,(0,y,0)),.285,.026,gold)
for i in range(12):
    a=i*math.tau/12
    rod('Pedestal flute',add(base,(math.cos(a)*.275,.58,math.sin(a)*.275)),add(base,(math.cos(a)*.275,1.04,math.sin(a)*.275)),.014,bronze,vertices=6)
base_objects=set(bpy.context.scene.objects)-cliff_objects
# Face is authored flat in XZ, +Y reflective normal, for mirrorFace.up aiming.
for r,t,y,mat in [(1.01,.055,0,bronze),(.94,.027,.04,gold),(.84,.023,.055,gold),(1.08,.022,0,gold)]:ring('Solar concentric engraved rim',(0,y,0),r,t,mat,segments=96)
rod('Polished reflecting disc',(0,-.018,0),(0,.035,0),.815,reflect,vertices=96)
for i in range(24):
    a=i*math.tau/24;co=math.cos(a);si=math.sin(a)
    rod('Radial rim engraving',(co*.85,.066,si*.85),(co*.92,.066,si*.92),.008,bronze,vertices=6)
    if i%2==0:
        pts=[(co*1.02,0,si*1.02),(co*1.26,.015,si*1.26),(math.cos(a+.07)*1.08,.035,math.sin(a+.07)*1.08),(math.cos(a-.07)*1.08,.035,math.sin(a-.07)*1.08)]
        mesh('Tapered sun crown',pts,[(0,2,1),(0,1,3),(0,3,2),(1,2,3)],gold)
    if i%3==0:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.055,location=vec((co*.975,.055,si*.975)))
        ob=bpy.context.object;ob.name='Turquoise rim stud';ob.data.materials.append(turquoise)
face_objects=set(bpy.context.scene.objects)-cliff_objects-base_objects
# Texture detail shared with Unity, exported UVs use planar projection per triangle.
W=256;image=bpy.data.images.new('Sandstone mineral grain',W,W);pixels=[]
for y in range(W):
    for x in range(W):
        n=noise.noise_vector(Vector((x/W*12,y/W*12,1.7)))[0]
        q=.73+.12*n+.035*math.sin(y*.64+4*n)
        pixels.extend((q,q*.985,q*.955,1))
image.pixels=pixels;image.filepath_raw=os.path.join(OUT,'sandstone-detail-v04.png');image.file_format='PNG';image.save()
# Curves are converted only in this new version, retaining earlier .blend sources.
for o in list(bpy.context.scene.objects):
    if o.type=='CURVE':
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
for ob in list(bpy.context.scene.objects):
    if ob.type=='MESH':
        bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(ob.data);bm.free();ob.data.update()
def export_group(objects,filename,anchors=None,relative=None):
    deps=bpy.context.evaluated_depsgraph_get();batches={};mats={}
    for ob in objects:
        if ob.type!='MESH':continue
        ev=ob.evaluated_get(deps);geo=ev.to_mesh();geo.calc_loop_triangles();nm=ev.matrix_world.to_3x3().inverted().transposed()
        for tri in geo.loop_triangles:
            mat=ob.data.materials[geo.polygons[tri.polygon_index].material_index];mats[mat.name]=mat
            b=batches.setdefault(mat.name,dict(material=mat.name,vertices=[],normals=[],triangles=[],uv=[]))
            axis=max(range(3),key=lambda i:abs(tri.normal[i]));axes=[i for i in range(3) if i!=axis]
            for vi in tri.vertices:
                p=ev.matrix_world@geo.vertices[vi].co;n=(nm@(geo.vertices[vi].normal if geo.polygons[tri.polygon_index].use_smooth else tri.normal)).normalized()
                g=[p.x,p.z,-p.y]
                if relative:g=[g[i]-relative[i] for i in range(3)]
                b['triangles'].append(len(b['vertices'])//3);b['vertices']+=g;b['normals'] += [n.x,n.z,-n.y];b['uv'] += [p[axes[0]]*.7,p[axes[1]]*.7]
        ev.to_mesh_clear()
    data=dict(materials=[dict(name=m.name,color=list(m.diffuse_color),metal=m.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value) for m in mats.values()],meshes=list(batches.values()),anchors=anchors)
    with open(os.path.join(OUT,filename),'w') as f:json.dump(data,f,separators=(',',':'))
    print(filename,sum(len(b['triangles'])//3 for b in batches.values()),'triangles')
with open(os.path.join(OUT,'water-mountain-v03.json')) as f:anchors=json.load(f)['anchors']
export_group(cliff_objects,'water-mountain-v04.json',anchors)
export_group(base_objects,'solar-altar-v04.json')
export_group(face_objects,'solar-mirror-v04.json')
# Place the movable head for the native production scene and rendered review.
face_parent=bpy.data.objects.new('Solar mirror rotating head',None);bpy.context.collection.objects.link(face_parent)
for ob in face_objects:ob.parent=face_parent
face_parent.location=vec((1.35,13.3,5.2));face_parent.rotation_euler[0]=math.radians(72)
for mat in stone:
    nt=mat.node_tree;p=nt.nodes.get('Principled BSDF');tex=nt.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=15;tex.inputs['Detail'].default_value=3
    bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.055;nt.links.new(tex.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],p.inputs['Normal'])
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.world.color=(.4,.5,.6)
for pos,energy,size in [((-10,21,-12),4200,12),((13,17,6),2400,10)]:
    bpy.ops.object.light_add(type='AREA',location=vec(pos));o=bpy.context.object;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(vec((0,5,2))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=vec((20,18,-27)));cam=bpy.context.object;cam.rotation_euler=(vec((-.5,5,2))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=24;scene.camera=cam
scene.render.resolution_x=1500;scene.render.resolution_y=1300;scene.render.resolution_percentage=100
scene.render.filepath=os.path.join(ART,'water-mountain-blender-v04.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,'water-mountain-v04.blend'))
bpy.ops.render.render(write_still=True)
cam.location=vec((6,15.8,-.2));cam.rotation_euler=(vec((1.35,12.4,5.2))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=5
scene.render.filepath=os.path.join(ART,'solar-altar-blender-v04.png');bpy.ops.render.render(write_still=True)


