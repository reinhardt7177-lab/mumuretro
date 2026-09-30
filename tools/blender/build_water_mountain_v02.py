"""Sculpt the v02 water-temple mountain from its authored traversal blueprint.

All input coordinates are game metres (Y up). Preserve the previous v01 work.
Writes an editable .blend, a Blender render, and material-batched Unity geometry.
"""
import bpy, math, os, sys, json, random
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from asset_detail_helpers import ROOT, vec, material, mesh

ART=os.path.join(ROOT,'art/water-temple-mountain')
OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/WaterMountain')
os.makedirs(ART,exist_ok=True);os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng=random.Random(2714)

basalt=material('Cliff dark fractured basalt',(.195,.245,.275),.02,.87)
slate=material('Cliff blue slate strata',(.29,.36,.40),.04,.83)
cut=material('Cliff chipped climbing edges',(.48,.50,.46),.03,.9)
lichen=material('Cliff cold moss and lichen',(.26,.34,.29),0,.94)
recess=material('Cliff deep undercut',(.095,.13,.15),0,1)

def rocky_mass(name,rings,mat,seed):
    """A multi-ring fractured landform, never a smooth cylinder or simple cone."""
    count=23;v=[];faces=[]
    for row,(height,cx,cz,rx,rz) in enumerate(rings):
        for i in range(count):
            a=math.tau*i/count
            jag=1+.12*math.sin(a*5.0+seed+row*.8)+.075*math.sin(a*11.0-seed*.43+row*1.7)
            if i%7==0:jag+=.11
            v.append((cx+math.cos(a)*rx*jag,
                      height+.18*math.sin(a*8+row*1.8+seed),
                      cz+math.sin(a)*rz*jag))
    for row in range(len(rings)-1):
        for i in range(count):
            a=row*count+i;b=row*count+(i+1)%count
            c=(row+1)*count+i;d=(row+1)*count+(i+1)%count
            faces.append((a,c,d,b))
    faces.append(tuple(reversed(range(count))))
    faces.append(tuple((len(rings)-1)*count+i for i in range(count)))
    obj=mesh(name,v,faces,mat)
    if mat in (basalt,slate):
        accents=(slate if mat==basalt else basalt,cut,lichen)
        for accent in accents:obj.data.materials.append(accent)
        for face in obj.data.polygons:
            key=(face.index*17+int(seed*31))%29
            if key in (0,1,2,3):face.material_index=1
            elif key==4:face.material_index=2
            elif key==5 and face.center.z<4:face.material_index=3
    return obj

def chipped_shelf(name,p,radius,depth,mat,seed):
    cx,cy,cz=p;count=11;v=[]
    for level in (0,-depth):
        for i in range(count):
            a=math.tau*i/count;j=1+.10*math.sin(a*7+seed)+.05*math.cos(a*4-seed)
            v.append((cx+math.cos(a)*radius*j,cy+level+.035*math.sin(a*6+seed),
                      cz+math.sin(a)*radius*.78*j))
    faces=[tuple(reversed(range(count))),tuple(count+i for i in range(count))]
    for i in range(count):faces.append((i,(i+1)%count,count+(i+1)%count,count+i))
    return mesh(name,v,faces,mat)

def fractured_strip(name,a,b,width,mat,seed):
    """A walkable shelf integrated into the rock, with chipped vertical sides."""
    ax,ay,az=a;bx,by,bz=b
    dx=bx-ax;dz=bz-az;length=math.hypot(dx,dz);sx=-dz/length;sz=dx/length
    v=[];steps=4
    for j in range(steps+1):
        t=j/steps;cx=ax+dx*t;cy=ay+(by-ay)*t;cz=az+dz*t
        for side in (-1,1):
            edge=width*.5*side*(1+.07*math.sin(j*2.7+side+seed))
            v.append((cx+sx*edge,cy+.03*math.sin(j*4+side+seed),cz+sz*edge))
    for j in range(steps+1):
        for side in (-1,1):
            top=v[j*2+(side+1)//2]
            v.append((top[0]+sx*side*.10,top[1]-.35-.06*math.sin(j+seed),top[2]+sz*side*.10))
    faces=[]
    for j in range(steps):
        k=j*2;faces.append((k,k+1,k+3,k+2))
        bottom=(steps+1)*2+j*2
        faces.append((k,k+2,bottom+2,bottom))
        faces.append((k+1,bottom+1,bottom+3,k+3))
    return mesh(name,v,faces,mat)

def cliff_anchor(name,p,depth,seed):
    """A jagged solid wedge joining each walking shelf to the cliff core."""
    x,y,z=p
    v=[(x-.78,y-.07,z-.25),(x+.72,y+.025,z-.20),
       (x-1.32,y+.12,z+depth),(x+1.22,y+.08,z+depth),
       (x-.65,y-.78,z+.04),(x+.62,y-.70,z+.06),
       (x-1.5,y-1.60,z+depth),(x+1.36,y-1.55,z+depth)]
    for i in range(len(v)):
        px,py,pz=v[i];v[i]=(px+.035*math.sin(i*4+seed),py,pz+.07*math.sin(i*3+seed))
    faces=[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]
    return mesh(name,v,faces,slate)

def grip(name,p,scale,seed):
    x,y,z=p
    # Irregular hand/foot contact protrusion, its center equals the gameplay anchor.
    verts=[];faces=[]
    for level,ry in [(-.15,-.15),(.1,.12)]:
        for i in range(7):
            a=math.tau*i/7;j=1+.18*math.sin(a*4+seed)
            verts.append((x+math.cos(a)*scale*j,y+ry*scale,z+math.sin(a)*scale*.55*j))
    for i in range(7):faces.append((i,7+i,7+(i+1)%7,(i+1)%7))
    faces.extend([tuple(reversed(range(7))),tuple(7+i for i in range(7))])
    return mesh(name,verts,faces,cut)

# One broad asymmetrical mountain, sculpted as interlocking buttresses.
rocky_mass('Main jagged cliff spine',[
    (-4,0,6.2,9.0,9.0),(1.7,.2,6.3,7.9,8.7),(3.5,.8,6.5,7.3,8.2),
    (5.3,1.4,6.9,6.9,8.2),(7.4,1.8,7.4,5.8,7.2),(9.4,1.5,7.8,4.8,5.5),
    (11.2,.8,8.0,3.3,3.9),(12.6,.6,8.1,2.6,2.6)],basalt,.7)
rocky_mass('West broken buttress',[
    (-4,-5.1,3.6,4.4,4.5),(2,-5,4.3,4.2,4.2),(4.8,-4.1,5.1,3.6,3.4),
    (6.7,-3.2,5.4,2.8,2.9),(7.8,-2.9,5.7,1.5,1.7)],slate,2.4)
rocky_mass('East split buttress',[
    (-4,5.2,5.7,4.2,5.2),(2.7,5.0,6.1,3.5,4.6),(5.4,4.3,6.8,3.1,3.5),
    (7.6,3.4,7.5,2.4,2.5),(8.6,3.1,8.0,1.2,1.4)],slate,5.3)
rocky_mass('Graspable lower cliff face',[
    (-4.0,-3.0,0,5.9,4.9),(-1.0,-3.1,0,5.4,4.65),
    (1.8,-3.0,0,4.9,4.5),(3.7,-2.5,.1,4.2,4.45),
    (5.2,-1.3,.35,3.4,4.1),(6.2,-.4,.9,2.4,3.3)],basalt,8.3)
rocky_mass('Continuous east climbing rib',[
    (1.0,4.8,5.1,3.7,4.1),(3.5,4.6,4.7,3.2,4.0),
    (5.3,4.0,4.0,2.8,3.7),(6.5,3.6,3.7,2.3,3.3),
    (7.6,2.9,4.2,1.9,2.9),(8.8,1.8,4.8,1.6,2.1),
    (9.7,.8,5.4,1.3,1.3)],basalt,6.9)

# Irregular natural lip instead of a rectangular beam. Its underside reads as
# the roof of the horizontal hanging traverse.
rocky_mass('Massive shadowed overhang',[
    (3.95,-2.25,-3.30,3.65,1.55),
    (4.46,-2.22,-3.35,3.80,1.72),
    (5.05,-2.05,-2.73,3.45,1.55),
    (5.45,-1.95,-2.15,2.80,1.28)],recess,4.2)
for i in range(15):
    x=-5.6+i*.47;z=-5.25+.18*math.sin(i*2.8)
    chipped_shelf('Overhang eroded tooth', (x,4.3+.05*(i%3),z),.32,.24,slate,i)

# Authored contact sequence follows the documented metres exactly.
H=[(-4.9,1.65,-4.72),(-4.7,2.55,-4.55),(-4.1,3.48,-4.45),
   (-3.05,3.65,-4.65),(-1.85,3.68,-4.75),(-1.28,4.42,-4.6),
   (.35,4.82,-4.45),(1.45,5.45,-4.0),(.4,9.65,4.0),(.2,10.65,4.2)]
for i,p in enumerate(H):grip('Reachable handhold %02d'%i,p,.52 if i in (5,6,8) else .38,i*1.7)
for i,p in enumerate(H[:8]):
    x,y,z=p;grip('Foot purchase %02d'%i,(x+(.23 if i%2 else -.24),y-.72,z+.09),.26,17+i)

# Chipped rock shelves continue along the right face. Their tops are the walkable path.
P=[(1.8,5.6,-3.5),(3.0,6.1,-2.2),(4.0,6.8,0),(2.6,7.6,2),
   (1.0,8.6,3.5),(.1,11.3,5.0)]
for i,p in enumerate(P):
    if i<5:
        x,y,z=p
        # Each shelf grows out of one continuous grounded cliff rib. This
        # prevents the authored route from reading as floating platforms.
        rocky_mass('Grounded shelf buttress %02d'%i,[
            (-1.1,x+.6,z+2.2,2.5,3.1),
            (y*.40,x+.35,z+1.8,2.15,2.65),
            (y*.78,x+.15,z+1.25,1.65,2.05),
            (y-.22,x,z+.62,1.18,1.35)],basalt,10.1+i*1.7)
        cliff_anchor('Shelf buried rock root %02d'%i,p,4.2 if i<3 else 3.0,i)
    chipped_shelf('Traversal shelf %02d'%i,p,1.0 if i<5 else 2.3,.35,cut if i in (0,5) else slate,32+i)
for i in range(4):fractured_strip('Cliffside narrow track %02d'%i,P[i],P[i+1],.92,slate,4+i)
chipped_shelf('Upper takeoff shelf',P[4],1.2,.45,slate,78)
rocky_mass('Summit broken plinth',[(9.8,.25,5.6,2.6,2.2),(11.1,.1,5.6,2.3,2.0),(11.35,.1,5.6,2.1,1.8)],cut,8.4)

anchors={'ground':(-5.2,0,-5.4),'holds':H,'walk':P,'mirror':(.1,12.7,5.2)}
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,'water-mountain-v02.blend'))

# Export evaluated material batches to Unity's authored local Y-up coordinates.
deps=bpy.context.evaluated_depsgraph_get();batches={}
for obj in list(bpy.context.scene.objects):
    if obj.type not in {'MESH','CURVE'}:continue
    evaluated=obj.evaluated_get(deps);geo=evaluated.to_mesh();geo.calc_loop_triangles()
    normal_matrix=evaluated.matrix_world.to_3x3().inverted().transposed()
    for tri in geo.loop_triangles:
        mat=obj.data.materials[geo.polygons[tri.polygon_index].material_index].name
        batch=batches.setdefault(mat,{'material':mat,'vertices':[],'normals':[],'triangles':[]})
        for index in tri.vertices:
            vertex=geo.vertices[index]
            p=evaluated.matrix_world@vertex.co;n=(normal_matrix@vertex.normal).normalized()
            batch['triangles'].append(len(batch['vertices'])//3)
            batch['vertices'].extend([p.x,p.z,-p.y]);batch['normals'].extend([n.x,n.z,-n.y])
    evaluated.to_mesh_clear()
palette=[]
for mat in (basalt,slate,cut,lichen,recess):
    palette.append({'name':mat.name,'color':list(mat.diffuse_color),'metal':0.02})
with open(os.path.join(OUT,'water-mountain-v02.json'),'w',encoding='utf8') as f:
    json.dump({'materials':palette,'meshes':list(batches.values()),'anchors':anchors},f,separators=(',',':'))

# Orthographic authoring render to compare the real Blender model to the concept.
bpy.ops.object.camera_add(location=vec((18,15,-25)));camera=bpy.context.object
direction=vec((0,6,2))-camera.location;camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=25;bpy.context.scene.camera=camera
for position,energy,size in [((-5,18,-10),2900,11),((12,9,8),1750,8)]:
    bpy.ops.object.light_add(type='AREA',location=vec(position));light=bpy.context.object
    light.data.energy=energy;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(vec((0,5,2))-light.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world=bpy.data.worlds.new('Cold plateau studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.2,.28,.32,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.filepath=os.path.join(ART,'water-mountain-blender-v02.png')
bpy.ops.render.render(write_still=True)
print('WATER_MOUNTAIN_V02',sum(len(b['triangles'])//3 for b in batches.values()),'triangles',len(batches),'materials')
