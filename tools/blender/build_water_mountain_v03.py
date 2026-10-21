"""Option 1: eroded sandstone strata with a continuous attached climbing route.
Author in game metres, export geometry and traversal anchors together.
"""
import bpy, bmesh, math, os, sys, json, random
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
from asset_detail_helpers import ROOT, vec, material, mesh

ART=os.path.join(ROOT,'art/water-temple-mountain')
OUT=os.path.join(ROOT,'art/engine-transfer/model-data/WaterMountain')
os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng=random.Random(3401)
sand=material('Sandstone warm ochre',(.48,.285,.125),0,.93)
light=material('Sandstone sunlit strata',(.64,.425,.21),0,.91)
edge=material('Sandstone worn hand edges',(.78,.60,.34),0,.92)
dark=material('Sandstone recessed seams',(.27,.155,.075),0,.97)
moss=material('Sandstone olive moss',(.23,.30,.075),0,1)
grass=material('Sandstone grass tips',(.38,.43,.12),0,1)
palette=[sand,light,edge,dark,moss,grass]

H=[(-4.9,1.65,-4.72),(-4.7,2.55,-4.55),(-4.1,3.48,-4.45),
   (-3.05,3.65,-4.65),(-1.85,3.68,-4.75),(-1.28,4.42,-4.6),
   (.35,4.82,-4.45),(1.45,5.45,-4.0),(.4,10.1,4.0),(.2,10.9,4.2)]
P=[(1.8,5.6,-3.5),(3,6.1,-2.2),(4,6.8,0),(2.6,7.6,2),(1,8.6,3.5),(.1,11.3,5)]

def block(name,c,size,mat,bevel=.13):
    # Cut-corner rectangular geology rather than circular rock rings.
    x,y,z=c;w,h,d=size
    outline=[(-.40,-.5),(.34,-.5),(.5,-.34),(.5,.32),(.32,.5),(-.36,.5),(-.5,.31),(-.5,-.30)]
    outline=[(a+rng.uniform(-.045,.045),b+rng.uniform(-.04,.04)) for a,b in outline]
    v=[]
    for row,(dy,scale) in enumerate([(-.5,.94),(-.39,1),(.36,1),(.5,.94)]):
        for a,b in outline:
            v.append((x+a*w*scale+rng.uniform(-bevel,bevel),y+dy*h+rng.uniform(-bevel*.35,bevel*.35),z+b*d*scale+rng.uniform(-bevel,bevel)))
    faces=[tuple(reversed(range(8))),tuple(24+i for i in range(8))]
    for row in range(3):
        for i in range(8):faces.append((row*8+i,row*8+(i+1)%8,(row+1)*8+(i+1)%8,(row+1)*8+i))
    o=mesh(name,v,faces,mat)
    # Consistent outward normals; export flat polygon normals to retain erosion facets.
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
    return o

# Rear bedrock connects every stratum down to the ground. Three offset masses
# retreat behind the route instead of engulfing the walking shelf.
block('Lower continuous bedrock',(-.9,.55,3.0),(11,8.7,11.5),dark,.18)
block('Middle continuous bedrock',(-2.1,5.3,5.6),(6.6,6.0,7.5),dark,.15)
block('Summit continuous bedrock',(.1,9.3,7.1),(3.5,3.9,3.7),dark,.1)

# Irregular courses are broken into broad pieces: staggered vertical joints,
# alternating inset edges and fine secondary layers, all rooted in bedrock.
for zone,(xmin,xmax,zfront,zback,bottom,top) in enumerate([
    (-7.1,5.3,-4.15,10,-3.5,5.18),(-5.9,.4,.9,10,4.8,8.65),(-2.3,2.3,4.42,9.6,8.3,11.28)]):
    y=bottom;row=0
    while y<top-.1:
        height=min(rng.uniform(.85,1.5),top-y)
        depth=zback-zfront
        x=xmin
        while x<xmax-.1:
            width=min(rng.uniform(2.2,4.0),xmax-x)
            # Front skin extends back into the rock so no tile floats.
            front=zfront+rng.uniform(-.24,.14)
            block('Stratum %d %d face'%(zone,row),(x+width/2,y+height/2,front+1.05),(width+.16,height-.035,2.4),rng.choice([sand,light,light]),.19)
            x+=width
        for side in (-1,1):
            sideX=xmin+.28 if side<0 else xmax-.28
            for k in range(max(1,int(depth/2))):
                z=zfront+1.3+k*2.05
                block('Return wall strata',(sideX,y+height/2,z),(1.5,height-.03,2.30),rng.choice([sand,light]),.17)
        y+=height;row+=1

# Broad connected upper surfaces. Broken moss mats leave rock exposed.
for c,size in [((-.7,5.20,3),(12, .25,12)),((-2.7,8.65,5.7),(6.4,.25,8)),((.1,11.26,6.8),(4.7,.18,5.4))]:
    block('Weathered terrace cap',c,size,light,.08)
    for i in range(30):
        x=c[0]+rng.uniform(-size[0]*.42,size[0]*.42);z=c[2]+rng.uniform(-size[2]*.40,size[2]*.40)
        block('Broken moss carpet',(x,c[1]+size[1]*.5+.025,z),(rng.uniform(.7,2.0),.045,rng.uniform(.5,1.8)),moss,.10)

def strip(a,b,width):
    ax,ay,az=a;bx,by,bz=b;dx=bx-ax;dz=bz-az;l=math.hypot(dx,dz);sx=-dz/l;sz=dx/l
    # Both sides extend down into a grounded buttress, not suspended boards.
    verts=[]
    for x,y,z in (a,b):
        for side in (-1,1):verts.append((x+sx*width*.5*side,y,z+sz*width*.5*side))
    verts += [(x,y-.48,z) for x,y,z in verts]
    o=mesh('Attached eroded ascending shelf',verts,[(0,2,3,1),(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(4,5,7,6)],light)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()

for i,(x,y,z) in enumerate(P):
    if i<5:
        # Recessed below the player's route, tied into the central geology.
        block('Grounded route buttress %d'%i,(x-.32,(y-1.8)/2,z+1.0),(2.0,y+.2,2.9),sand,.12)
        shelf=block('Resting shelf %d'%i,(x,y-.45,z),((1.65 if i in (0,2) else 1.3),.9,1.45),light,.04)
        if i>0:
            ax,ay,az=P[i-1];dx=x-ax;dz=z-az;length=math.hypot(dx,dz)
            # The approach half is part of the slope, not a flat slab whose
            # vertical lip blocks the player before reaching the end of the ramp.
            for vertex in shelf.data.vertices:
                along=((vertex.co.x-x)*dx+(-vertex.co.y-z)*dz)/length
                vertex.co.z+=min(0,along)*(y-ay)/length
            shelf.data.update()
    if i<4:strip(P[i],P[i+1],.96)

# Hands sit on continuous, irregular horizontal seams, never identical pegs.
for i,(x,y,z) in enumerate(H):
    block('Worn grip seam %02d'%i,(x,y-.06,z+.20),(rng.uniform(.68,1.05),.22,.62),edge,.045)
    if i<8:block('Subtle foothold %02d'%i,(x+.18,y-.77,z+.28),(.44,.14,.44),light,.04)

# Sparse tufts on safe resting islands and summit, baked in the moss batches.
for center in [P[0],P[2],P[5]]:
    for i in range(35):
        a=rng.random()*math.tau;r=rng.uniform(.6,.82 if center!=P[5] else 1.65)
        x=center[0]+math.cos(a)*r;z=center[2]+math.sin(a)*r;y=center[1]+.02
        for j in range(3):
            angle=j*2.1;w=.055;h=rng.uniform(.15,.32)
            mesh('Sparse terrace grass',[(x-math.cos(angle)*w,y,z-math.sin(angle)*w),(x+math.cos(angle)*w,y,z+math.sin(angle)*w),(x+.10*math.cos(angle),y+h,z+.10*math.sin(angle))],[(0,1,2),(2,1,0)],grass)

# Scattered broken talus grounds the base silhouette without hiding the first grip.
for i in range(22):
    x=rng.uniform(-8,6);z=rng.choice([-5.1,10.4])+rng.uniform(-.4,.4)
    if abs(x+5.2)<1.7 and z<0:continue
    block('Ground talus',(x,-.15,z),(rng.uniform(.5,1.1),rng.uniform(.4,1.1),rng.uniform(.5,1.2)),sand,.09)

def point(p):return dict(zip(('x','y','z'),p))
anchors={'ground':point((-5.2,0,-5.4)),'holds':[point(p) for p in H],'walk':[point(p) for p in P],'mirror':point((1.35,13.3,5.2))}
deps=bpy.context.evaluated_depsgraph_get();batches={}
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH':continue
    evaluated=obj.evaluated_get(deps);geo=evaluated.to_mesh();geo.calc_loop_triangles()
    nm=evaluated.matrix_world.to_3x3().inverted().transposed()
    for tri in geo.loop_triangles:
        mat=obj.data.materials[geo.polygons[tri.polygon_index].material_index].name
        batch=batches.setdefault(mat,{'material':mat,'vertices':[],'normals':[],'triangles':[]})
        n=(nm@geo.polygons[tri.polygon_index].normal).normalized()
        for index in tri.vertices:
            p=evaluated.matrix_world@geo.vertices[index].co
            batch['triangles'].append(len(batch['vertices'])//3)
            batch['vertices'].extend([p.x,p.z,-p.y]);batch['normals'].extend([n.x,n.z,-n.y])
    evaluated.to_mesh_clear()
data={'materials':[{'name':m.name,'color':list(m.diffuse_color),'metal':0} for m in palette], 'meshes':list(batches.values()),'anchors':anchors}
with open(os.path.join(OUT,'water-mountain-v03.json'),'w',encoding='utf8') as f:json.dump(data,f,separators=(',',':'))

# Keep the dimensioned traversal drawing on the same source coordinates.
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">',
     '<rect width="1200" height="750" fill="#17252a"/><g font-family="Malgun Gothic,sans-serif" fill="#eee2bc">',
     '<text x="40" y="45" font-size="26">태양 절벽 · 1번 사암 돌산 / 등반 배치도</text>',
     '<text x="40" y="80" font-size="16">H 손잡이 · P 선반 · 점선: 이동 연결 · 초록: 걸을 수 있는 지점</text>']
points=H+P;route=[0,1,2,3,4,5,6,7,10,11,12,13,14,8,9,15]
for axis,offset,title in [(0,310,'정면 · X / 높이 Y'),(2,840,'측면 · 깊이 Z / 높이 Y')]:
    svg.append(f'<text x="{offset-250}" y="130" font-size="20">{title}</text>')
    for a,b in zip(route,route[1:]):
        pa,pb=points[a],points[b]
        svg.append(f'<line x1="{offset+pa[axis]*38}" y1="{655-pa[1]*40}" x2="{offset+pb[axis]*38}" y2="{655-pb[1]*40}" stroke="#bc9b58" stroke-width="2" stroke-dasharray="5 4"/>')
    for i,p in enumerate(points):
        x,y=offset+p[axis]*38,655-p[1]*40;label='H'+str(i) if i<10 else 'P'+str(i-10)
        color='#e1b665' if i<10 else '#a2cf74'
        svg.append(f'<circle cx="{x}" cy="{y}" r="6" fill="{color}"/><text x="{x+9}" y="{y-7}" font-size="14">{label}</text>')
svg.append('<text x="40" y="720" font-size="15">Blender와 Unity 공통 좌표 · 외형 투시도가 아닌 동선 설계도</text></g></svg>')
with open(os.path.join(ART,'traversal-blueprint-v03.svg'),'w',encoding='utf8') as f:f.write('\n'.join(svg))

bpy.ops.object.camera_add(location=vec((19,16,-26)));camera=bpy.context.object
camera.rotation_euler=(vec((-.8,4.8,2.8))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=24;bpy.context.scene.camera=camera
for p,energy,size in [((-8,20,-12),3200,10),((12,15,6),1800,8)]:
    bpy.ops.object.light_add(type='AREA',location=vec(p));o=bpy.context.object;o.data.energy=energy;o.data.shape='DISK';o.data.size=size
    o.rotation_euler=(vec((0,5,2))-o.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world=bpy.data.worlds.new('Sandstone daylight');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.43,.53,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.filepath=os.path.join(ART,'water-mountain-blender-v03.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,'water-mountain-v03.blend'))
bpy.ops.render.render(write_still=True)
print('WATER_MOUNTAIN_V03',sum(len(b['triangles'])//3 for b in batches.values()),'triangles',len(batches),'materials')
