"""Build v05 directly from the orthographic design specification, then render 360 review."""
import bpy,bmesh,math,os,sys,json,random
from mathutils import Vector,noise
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,vec,material,mesh
ART=os.path.join(ROOT,'art/water-temple-mountain');REVIEW=os.path.join(ART,'v05')
OUT=os.path.join(ROOT,'art/engine-transfer/model-data/WaterMountain')
with open(os.path.join(REVIEW,'design-spec.json'),encoding='utf-8-sig') as f:spec=json.load(f)
bpy.ops.wm.open_mainfile(filepath=os.path.join(ART,'water-mountain-v04.blend'))
retained=('Worn grip','Subtle foothold','Resting shelf','Attached eroded','Sparse terrace grass')
geology=('Sculpted','Natural supporting','Weathered talus','Fractured terrace')
for ob in list(bpy.data.objects):
    if ob.name.startswith(geology):bpy.data.objects.remove(ob,do_unlink=True)
    elif ob.type in {'CAMERA','LIGHT'}:bpy.data.objects.remove(ob,do_unlink=True)
# Warm stone values vary subtly, avoiding regular high-contrast striped rings.
stone=[]
for i,c in enumerate([(.43,.28,.16),(.47,.31,.18),(.51,.345,.21),(.455,.30,.175),(.56,.39,.245)]):
    m=material('V05 sandstone mineral '+str(i),c,0,.9);stone.append(m)
    nt=m.node_tree;pr=nt.nodes.get('Principled BSDF')
    tex=nt.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=24;tex.inputs['Detail'].default_value=4
    bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.27;bump.inputs['Distance'].default_value=.065
    nt.links.new(tex.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],pr.inputs['Normal'])
profiles=spec['profiles'];N=144;rows=120;vs=[];fs=[]
def outline(y):
    k=next((i for i in range(len(profiles)-1) if profiles[i]['y']<=y<=profiles[i+1]['y']),len(profiles)-2)
    lo,hi=profiles[k],profiles[k+1];t=(y-lo['y'])/(hi['y']-lo['y'])
    return [(a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t) for a,b in zip(lo['outline'],hi['outline'])]
for row in range(rows+1):
    y=-1+12.3*row/rows;poly=outline(y)
    for i in range(N):
        f=i/N*12;j=int(f);t=f-j;a=poly[j];b=poly[(j+1)%12]
        x=a[0]*(1-t)+b[0]*t;z=a[1]*(1-t)+b[1]*t
        # Local grain, not repeated full-circumference waves. Larger silhouette stays in the plan envelope.
        n=noise.noise(Vector((x*.9,z*.9,y*.8)))
        protected=(z<0 and y<5.6) or (z<4.6 and y>9)
        relief=.10 if protected else .38
        offset=relief*n+.03*math.sin(y*7+x*.55+z*.32)
        for center in [.63,.76,.91]:
            gap=min(abs(i/N-center),1-abs(i/N-center))
            offset-=.72*math.exp(-(gap/.017)**2)*math.sin(math.pi*max(0,min(1,(y+1)/12.3)))
        if not protected:offset+=.15*math.sin(i/N*math.tau*9+y*.12)
        d=Vector((x+.5,z-4.0)).normalized();x+=d.x*offset;z+=d.y*offset
        vs.append((x,y,z))
for row in range(rows):
    for i in range(N):fs.append((row*N+i,row*N+(i+1)%N,(row+1)*N+(i+1)%N,(row+1)*N+i))
fs.extend([tuple(reversed(range(N))),tuple(rows*N+i for i in range(N))])
body=mesh('V05 single connected designed sandstone',vs,fs,stone[0])
for m in stone[1:]:body.data.materials.append(m)
for p in body.data.polygons:
    c=p.center # update below; use vertices for stable material coordinates
    c=sum((body.data.vertices[v].co for v in p.vertices),Vector())/len(p.vertices)
    patch=noise.noise(c*.8)+.16*math.sin(c.z*5+c.x*.4)
    p.material_index=2;p.use_smooth=True
# Unify the visible approach ledges with the rock palette; contact coordinates stay authored.
for ob in bpy.context.scene.objects:
    if ob.type=='MESH' and ob.name.startswith(retained[:-1]):
        ob.data.materials.clear();ob.data.materials.append(stone[4])
        if ob.name.startswith('Resting shelf'):
            for mod in ob.modifiers:
                if mod.type=='BEVEL':mod.width=.10;mod.segments=3
# Attached weathered ribs break broad western/northern faces; centers penetrate the designed body.
ribs=[];rr=random.Random(715)
for k in range(26):
    row=rr.randint(12,102);idx=rr.randint(76,137);p=Vector(vs[row*N+idx]);d=Vector((p.x+.5,0,p.z-4)).normalized()
    center=p-d*.15
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=vec(center))
    ob=bpy.context.object;ob.name='V05 embedded fracture rib';ob.scale=(rr.uniform(.24,.48),rr.uniform(.32,.56),rr.uniform(.5,1.35));ob.data.materials.append(stone[2])
    for v in ob.data.vertices:v.co*=rr.uniform(.88,1.1)
# Grounded rubble stays at the base; no moss balls or floating terrace cubes.
rng=random.Random(505)
for i in range(28):
    a=i*math.tau/28;x=-.8+math.cos(a)*7.1;z=3+math.sin(a)*7
    if z< -3.4 and x< -3:continue
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=vec((x,-.12,z)))
    ob=bpy.context.object;ob.name='V05 grounded talus';ob.scale=(rng.uniform(.25,.65),rng.uniform(.25,.65),rng.uniform(.14,.35));ob.data.materials.append(stone[i%5])
    for v in ob.data.vertices:v.co*=rng.uniform(.88,1.12)
# Inspectable collection of all collision-free visual geology for export.
cliff=[o for o in bpy.context.scene.objects if o.type=='MESH' and (o.name.startswith('V05') or o.name.startswith(retained))]
for ob in cliff:
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(ob.data);bm.free();ob.data.update()
deps=bpy.context.evaluated_depsgraph_get();batches={};mats={}
for ob in cliff:
    ev=ob.evaluated_get(deps);geo=ev.to_mesh();geo.calc_loop_triangles();nm=ev.matrix_world.to_3x3().inverted().transposed()
    for tri in geo.loop_triangles:
        mat=ob.data.materials[geo.polygons[tri.polygon_index].material_index];mats[mat.name]=mat
        b=batches.setdefault(mat.name,dict(material=mat.name,vertices=[],normals=[],triangles=[],uv=[]))
        axis=max(range(3),key=lambda i:abs(tri.normal[i]));axes=[i for i in range(3) if i!=axis]
        for vi in tri.vertices:
            p=ev.matrix_world@geo.vertices[vi].co;n=(nm@(geo.vertices[vi].normal if geo.polygons[tri.polygon_index].use_smooth else tri.normal)).normalized()
            b['triangles'].append(len(b['vertices'])//3);b['vertices'] += [p.x,p.z,-p.y];b['normals'] += [n.x,n.z,-n.y];b['uv'] += [p[axes[0]]*.7,p[axes[1]]*.7]
    ev.to_mesh_clear()
with open(os.path.join(OUT,'water-mountain-v03.json')) as f:anchors=json.load(f)['anchors']
data=dict(materials=[dict(name=m.name,color=list(m.diffuse_color),metal=0) for m in mats.values()],meshes=list(batches.values()),anchors=anchors)
with open(os.path.join(OUT,'water-mountain-v05.json'),'w') as f:json.dump(data,f,separators=(',',':'))
# Dimensional QA: closed body and preserved anchors before any rendering.
bm=bmesh.new();bm.from_mesh(body.data)
nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.free()
assert nonmanifold==0,'Design body must be watertight'
with open(os.path.join(REVIEW,'geometry-check.json'),'w') as f:json.dump(dict(connected_body=True,nonmanifold_edges=nonmanifold,profiles=len(profiles),triangles=sum(len(b['triangles'])//3 for b in batches.values()),anchor_source='v03 unchanged',height=12.3),f,indent=2)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.36,.45,.55,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
for p,power,size in [((-12,23,-15),4000,11),((10,19,14),3200,12),((-12,12,14),1800,9)]:
    bpy.ops.object.light_add(type='AREA',location=vec(p));o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(vec((0,5,3))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=21
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
center=Vector((-.6,5.9,3.0))
def render(name,pos,scale=21):
    cam.location=vec(pos);cam.rotation_euler=(vec(center)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
    scene.render.filepath=os.path.join(REVIEW,name+'.png');bpy.ops.render.render(write_still=True)
cam.location=vec((20,17,-25));cam.rotation_euler=(vec(center)-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,'water-mountain-v05.blend'))
for name,pos in [('front',(-.6,5.9,-32)),('right',(34,5.9,3)),('back',(-.6,5.9,38)),('left',(-35,5.9,3)),('top',(-.6,40,3)),('bottom',(-.6,-35,3))]:render(name,pos)
scene.render.resolution_x=800;scene.render.resolution_y=800;scene.cycles.samples=8
for i in range(12):
    a=i*math.tau/12;render('orbit-%02d'%i,(-.6+math.sin(a)*32,18,3-math.cos(a)*32),23)
print('V05_DESIGN_RENDER_COMPLETE',len(cliff),'objects',sum(len(b['triangles'])//3 for b in batches.values()),'triangles')

