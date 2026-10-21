"""Fire temple V01: reads the same metre-based spec as blueprint.svg.
Editable Blender model + offline GLBs + actual model renders. No runtime edits.
"""
import bpy, bmesh, json, math, random, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'art/fire-temple/v01'
SPEC=json.loads((OUT/'design-spec.json').read_text(encoding='utf-8'))
random.seed(20261020)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene['coordinate_rule']='Web (x,y,z) => Blender (x,-z,y), local floor y=0'
scene['status']='Offline architectural model. New puzzle logic is not connected to game.'
scene['reference']='concept-overview.png, portal-reference.png, design-spec.json'
group='map';objects={'map':[],'portal':[]};floors=[];portal=None
def v(p):return Vector((p[0],-p[2],p[1]))
def rgb(h):
    c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(a/12.92 if a<.04045 else ((a+.055)/1.055)**2.4 for a in c)
def material(name,h,metal=0,rough=.65,emit=0,noise=False):
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb(h),1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if emit:p.inputs['Emission Color'].default_value=m.diffuse_color;p.inputs['Emission Strength'].default_value=emit
    if noise:
        tex=m.node_tree.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=13;tex.inputs['Detail'].default_value=3.5
        bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.19;bump.inputs['Distance'].default_value=.055
        m.node_tree.links.new(tex.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
    return m
basalt=material('Basalt • charcoal','38434c',rough=.84,noise=True)
edge=material('Basalt • blue grey bevels','57636e',rough=.79,noise=True)
ash=material('Ash stone • warm trim','a99b7d',rough=.75,noise=True)
bronze=material('Bronze • forged warm','a27a42',.78,.32,noise=True)
bronze_dark=material('Bronze • aged recess','4d4639',.65,.53)
patina=material('Bronze • oxidised inset','37555a',.45,.63)
dark=material('Recesses and grout','1b242b',rough=.92)
lava=material('Lava • controlled orange','fa7a28',rough=.53,emit=3)
lamp=material('Lamp • amber glass','ffd393',rough=.23,emit=3.5)
stonevars=[material('Floor stone '+str(i),c,rough=.86,noise=True) for i,c in enumerate(['545f64','5b6567','616a6c','4c585f'])]
def register(o,name,mat):
    o.name=name;o.data.materials.append(mat);objects[group].append(o);return o
def mesh(name,verts,faces,mat):
    d=bpy.data.meshes.new(name);d.from_pydata([v(p) for p in verts],[],faces);d.update()
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);return register(o,name,mat)
def box(name,p,s,mat,bevel=.035):
    x,y,z=p;w,h,d=s
    pts=[(x+a*w/2,y+b*h/2,z+c*d/2) for a,b,c in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    o=mesh(name,pts,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],mat)
    if bevel:
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
        bmesh.ops.bevel(bm,geom=list(bm.edges),offset=min(bevel,min(s)*.24),segments=2,affect='EDGES');bm.to_mesh(o.data);bm.free();o.data.update()
    return o
def rod(name,a,b,r,mat,sides=16):
    a,b=v(a),v(b);d=(b-a).normalized();u=d.cross(Vector((0,0,1)))
    if u.length<.01:u=d.cross(Vector((0,1,0)))
    u.normalize();q=d.cross(u).normalized();pts=[]
    for center in [a,b]:
        for i in range(sides):
            p=center+r*(math.cos(i*math.tau/sides)*u+math.sin(i*math.tau/sides)*q);pts.append((p.x,p.z,-p.y))
    faces=[tuple(reversed(range(sides))),tuple(range(sides,sides*2))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    o=mesh(name,pts,faces,mat)
    for p in o.data.polygons:p.use_smooth=p.index>=2
    return o
def curve(name,points,r,mat):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=1;d.bevel_depth=r;d.bevel_resolution=2
    s=d.splines.new('POLY');s.points.add(len(points)-1)
    for q,p in zip(s.points,points):q.co=(*v(p),1)
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);return register(o,name,mat)
def ring(name,p,r,t,mat,plane='xy',arc=math.tau,start=0):
    axes={'xy':(0,1),'xz':(0,2),'yz':(1,2)}[plane];pts=[]
    for i in range(65):
        a=start+arc*i/64;q=list(p);q[axes[0]]+=math.cos(a)*r;q[axes[1]]+=math.sin(a)*r;pts.append(q)
    return curve(name,pts,t,mat)
def emblem(p,r=.65):
    x,y,z=p;ring('Caldera rim',p,r,.035,bronze);ring('Caldera inner',p,r*.72,.018,bronze)
    for i in range(12):
        a=i*math.tau/12
        a1=(x+math.cos(a)*r*1.05,y+math.sin(a)*r*1.05,z)
        b1=(x+math.cos(a)*r*1.42,y+math.sin(a)*r*1.42,z)
        rod('Forged sun ray',a1,b1,.034,bronze,8)
def diamond(p,w=.42,h=.72):
    x,y,z=p;curve('Incised diamond',[(x,y+h,z),(x+w,y,z),(x,y-h,z),(x-w,y,z),(x,y+h,z)],.025,bronze)
def lantern(x,y,z):
    box('Lamp base',(x,y+.10,z),(.48,.2,.48),bronze)
    box('Amber glass',(x,y+.48,z),(.27,.58,.27),lamp,.025)
    for dx in [-.19,.19]:
        for dz in [-.19,.19]:rod('Lantern cage',(x+dx,y+.18,z+dz),(x+dx,y+.82,z+dz),.024,bronze,8)
    box('Lamp roof',(x,y+.85,z),(.49,.13,.49),bronze)
def floor(name,x,z,w,d,h=0,tiles=True):
    under=h-.09 if tiles else h
    o=box(name+' datum',(x,under-.31,z),(w,.62,d),dark,.025);floors.append((o,under))
    if tiles:
        nx=max(1,round(w/2.0));nz=max(1,round(d/2.1));tw=w/nx;td=d/nz
        for ix in range(nx):
            for iz in range(nz):
                tile=box(name+' paving',(x-w/2+tw*(ix+.5),h-.045,z-d/2+td*(iz+.5)),(tw-.028,.09,td-.028),random.choice(stonevars),.018)
                if ix==0 and iz==0:floors.append((tile,h))
    return o
def wall(name,x,z,w,d,h=6,base=0):
    box(name+' core',(x,base+h/2,z),(w,h,d),dark)
    alongx=w>d;length=w if alongx else d;count=max(1,round(length/2.8));courses=max(2,round(h/.9));step=length/count;ch=h/courses
    for j in range(courses):
        for i in range(count):
            q=-length/2+step*(i+.5)
            box(name+' ashlar',(x+(q if alongx else 0),base+ch*(j+.5),z+(0 if alongx else q)),((step-.025) if alongx else w+.03,ch-.03,(d+.03) if alongx else step-.025),edge if (i+j)%7==0 else basalt,.04)
    box(name+' coping',(x,base+h+.10,z),(w+.15,.20,d+.15),ash,.045)
def pillar(x,z,h=6.6,base=0):
    for y,s in [(base+.20,(1.25,.4,1.25)),(base+.51,(.99,.22,.99)),(base+h-.10,(1.3,.28,1.3))]:box('Column stepped stone',(x,y,z),s,ash)
    box('Column shaft',(x,base+h/2,z),(.82,h-.7,.82),basalt,.065)
    for dx in [-.32,.32]:box('Column bronze flute',(x+dx,base+h/2,z+.43),(.035,h-1.3,.055),bronze,.009)
    emblem((x,base+h-.95,z+.46),.20);box('Column belt',(x,base+1.3,z),(1.03,.14,1.03),bronze)
def room_shell(r,opening='south'):
    x,z,w,d,h=r['x'],r['z'],r['width'],r['depth'],r['wallHeight'];base=r['floor']
    if r.get('pit'):
        a=r['pit']['z0'];b=r['pit']['z1'];floor(r['id']+' north',x,(z-d/2+a)/2,w,a-(z-d/2),base);floor(r['id']+' south',x,(b+z+d/2)/2,w,z+d/2-b,base)
        floor('Fissure floor',x,(a+b)/2,w,b-a,-3,False)
        for sidez in [a,b]:
            wall('Fissure retaining wall',x,sidez,w,.40,3,-3)
        if r['id']=='fracture':
            for i in range(6):curve('Localized fissure glow',[(x-8+i*3,-2.98,-2.5),(x-7+i*3,-2.98,.5),(x-8+i*3,-2.98,2.6)],.035,lava)
    else:floor(r['id'],x,z,w,d,base)
    if r['id']=='steam':
        for side in [-1,1]:wall('Upper passage jamb',side*7.6,z-d/2,8.8,.7,h,base)
        wall('Upper passage lintel',0,z-d/2,6.4,.7,1.8,base+6.2)
    else:wall('North wall',x,z-d/2,w,.7,h,base)
    for side in [-1,1]:
        # East/west entry is genuinely cut out; no invisible wall across the corridor.
        if (r['id']=='fracture' and side==1) or (r['id']=='foundry' and side==-1):
            for za,zb in [(z-d/2,6),(10,z+d/2)]:wall('Wing entry side',x+side*w/2,(za+zb)/2,.7,zb-za,h,base)
        else:wall('Wing side',x+side*w/2,z,.7,d,h,base)
    # The southern wall is cut low in this roofless modelling view.
    for side in [-1,1]:wall('South low parapet',x+side*(w/4+1.2),z+d/2,w/2-2.4,.7,1.1,base)
    for px in [x-w/2+1.3,x+w/2-1.3]:
        for pz in [z-d/2+1.4,z+d/2-1.4]:pillar(px,pz,h-.2,base);lantern(px,base+.7,pz+.68)
def make_portal(x,z,base=0):
    global group
    prev=group;group='portal';before=set(o.name for o in objects[group])
    for side in [-1,1]:
        for y,w,h,d in [(.18,2.1,.36,1.4),(.48,1.85,.24,1.25),(3.7,1.55,6.2,1.10),(7.0,1.9,.35,1.35),(7.8,2.05,1.2,1.4)]:box('Portal pier',(x+side*3.75,base+y,z),(w,h,d),basalt,.065)
        for dx in [-.58,.58]:box('Portal gold fillet',(x+side*3.75+dx,base+3.85,z+.565),(.065,5.8,.07),bronze,.015)
        for y in [1.1,6.8]:box('Forged pier band',(x+side*3.75,base+y,z),(1.72,.15,1.22),bronze)
        for y in [2.4,4.7]:diamond((x+side*3.75,base+y,z+.59),.28,.64)
        emblem((x+side*3.75,base+7.5,z+.75),.36)
        lantern(x+side*3.75,base+.7,z+1.0)
        box('Portal jamb',(x+side*2.7,base+1.4,z),(.6,2.8,1.0),ash)
    # Physically cut radial voussoirs; inner radius 2.4 and spring 2.8 give 5.2m clearance.
    for i in range(15):
        a=i*math.pi/15+.008;b=(i+1)*math.pi/15-.008
        pts=[]
        for zz in [z-.54,z+.54]:
            for r,ang in [(2.4,a),(3.08,a),(3.08,b),(2.4,b)]:pts.append((x+math.cos(ang)*r,base+2.8+math.sin(ang)*r,zz))
        o=mesh('Radial arch stone',pts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],edge if i%3==0 else basalt)
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bmesh.ops.bevel(bm,geom=list(bm.edges),offset=.035,segments=2,affect='EDGES');bm.to_mesh(o.data);bm.free()
    for r in [2.45,2.60,2.98]:ring('Arch chased bronze',(x,base+2.8,z+.57),r,.032,bronze,arc=math.pi)
    for side in [-1,1]:
        box('Door lower leaf',(x+side*1.185,base+1.4,z+.07),(2.35,2.8,.25),bronze_dark)
        # Upper leaf follows the semicircle, with no rectangular panel blocking the arch.
        outline=[(x,base+2.8)]+[(x+side*2.35*math.cos(t*math.pi/2/16),base+2.8+2.35*math.sin(t*math.pi/2/16)) for t in range(17)]
        pts=[(xx,yy,zz) for zz in [z-.06,z+.20] for xx,yy in outline];n=len(outline)
        faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
        upper=mesh('Door arch leaf',pts,faces,bronze_dark)
        bm=bmesh.new();bm.from_mesh(upper.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(upper.data);bm.free()
        for dx in [.12,2.24]:box('Vertical door rib',(x+side*dx,base+1.45,z+.24),(.055,2.65,.065),bronze,.012)
        for yy in [.16,.35,2.62]:box('Door horizontal rib',(x+side*1.18,base+yy,z+.24),(2.30,.055,.07),bronze,.012)
        for y in [.95,3.4]:diamond((x+side*1.35,base+y,z+.28),.36,.57)
        for y in [.5,2.45]:
            for dx in [.22,2.12]:rod('Door rivet',(x+side*dx,base+y,z+.24),(x+side*dx,base+y,z+.33),.055,bronze,8)
    emblem((x,base+2.1,z+.38),1.16)
    emblem((x,base+6.25,z+.72),.48)
    box('Arch keystone crest',(x,base+6.15,z+.32),(1.28,1.88,.68),basalt,.08)
    emblem((x,base+6.25,z+.72),.48)
    for side in [-1,1]:curve('Keystone gold border',[(x+side*.55,base+5.32,z+.69),(x+side*.55,base+6.97,z+.69),(x,base+7.18,z+.69)],.032,bronze)
    group=prev
    return [o for o in objects['portal'] if o.name not in before]

print('FIRE_BUILD map foundations',flush=True)
# Entry and all connections have their TOP exactly at the design floor height.
floor('Entry',0,23,8,22)
for c in SPEC['corridors']:floor(c['id']+' passage',c['x'],c['z'],c['width'],c['depth'],c['floor'])
rod('Circular hub foundation',(0,-.62,0),(0,0,0),12,dark,96)
for r in [3,5.5,9.6,11.75]:ring('Hub inlay',(0,.008,0),r,.026,bronze,'xz')
for i in range(24):
    a=i*math.tau/24
    curve('Hub radial joint',[(math.cos(a)*3,.008,math.sin(a)*3),(math.cos(a)*11.7,.008,math.sin(a)*11.7)],.012,ash)
for i in range(16):
    a=i*math.tau/16;x=math.cos(a)*11.6;z=math.sin(a)*11.6
    # Doorways towards east/west passages, north hall and entry remain open.
    if abs(x)<3.3 or 5.5<z<10.7:continue
    pillar(x,z,4.6);lantern(x,.7,z)
for r in SPEC['rooms']:room_shell(r)
# The upper balcony is a distinct floor; it never overlaps a lower ramp.
s=SPEC['rooms'][2];b=s['balcony'];floor('Steam upper balcony',b['x'],b['z'],b['width'],b['depth'],b['floor'])
for x in [-10,10]:rod('Balcony supporting column',(x,0,-35),(x,3.1,-35),.45,basalt,12)
print('FIRE_BUILD puzzle geometry',flush=True)
for r in SPEC['rooms'][:2]:
    b=r['bridge'];floor(r['id']+' bridge',b['x'],b['z'],b['width'],b['depth'],b['floor'])
    for side in [-1,1]:box('Bridge bronze edge',(b['x']+side*(b['width']/2-.10),-.07,0),(.11,.18,6.4),bronze)
    box('Far anchor pedestal',(r['goal'][0],.5,r['goal'][1]),(1.5,1,1.1),basalt)
    emblem((r['goal'][0],1.5,r['goal'][1]+.57),.42)
for x,z in SPEC['rooms'][0]['braces']:
    box('Portable bridge brace',(x,.42,z),(.78,.84,.78),basalt,.08)
    for y in [.14,.7]:box('Brace bronze belt',(x,y,z),(.82,.10,.82),bronze)
    ring('Brace handle',(x,.47,z+.43),.20,.045,bronze)
for x,z in SPEC['rooms'][0]['sockets']:
    box('Brace socket recessed plinth',(x,.22,z),(1.1,.44,1.1),bronze_dark)
    ring('Brace socket face',(x,.75,z+.55),.29,.06,bronze)
    rod('Bridge brace linkage',(x,.38,z-.4),(x,-.18,2.4),.10,bronze)
# Foundry: visible enclosed flow path and separate near-bank controls.
points=[(35,1.4,-9),(35,1.4,-6),(28,1.4,-6),(28,.09,-3)]
for a,b in zip(points,points[1:]):
    rod('Lava chute bronze',(a[0],a[1]-.14,a[2]),(b[0],b[1]-.14,b[2]),.34,bronze_dark,12)
    rod('Lava visible path',a,b,.19,lava,12)
for x,z in SPEC['rooms'][1]['controls']:
    box('Foundry control plinth',(x,.5,z),(1.0,1.0,.8),basalt)
    rod('Control axle',(x,1.25,z-.25),(x,1.25,z+.27),.13,bronze)
    ring('Foundry handwheel',(x,1.25,z+.3),.43,.055,bronze)
    for i in range(6):
        a=i*math.tau/6;rod('Handwheel spoke',(x,1.25,z+.3),(x+math.cos(a)*.40,1.25+math.sin(a)*.40,z+.3),.028,bronze,8)
    curve('Visible control linkage',[(x,.7,z-.4),(x,.7,-5),(28 if x<28 else 35,1.1,-6)],.07,bronze)
# Steam machinery sits outside the route, with no open hot steam through the player.
div=(-6,1.0,-21);rod('Steam diverter pedestal',(-6,0,-21),div,.32,bronze_dark)
ring('Steam diverter wheel',(-6,1.35,-20.7),.55,.065,bronze)
for i in range(8):
    a=i*math.tau/8;rod('Valve spoke',(-6,1.35,-20.7),(-6+math.cos(a)*.5,1.35+math.sin(a)*.5,-20.7),.035,bronze)
for path in [[(-6,.8,-21),(-7,.8,-23),(-7,1.7,-27)],[(-6,.8,-21),(7,.8,-21),(7,.8,-31)]]:curve('Enclosed steam pipe',path,.16,bronze)
rod('Turbine housing',(-7,2.4,-28),(-7,2.4,-26.8),1.8,bronze_dark,48)
ring('Turbine rim',(-7,2.4,-26.76),1.65,.16,bronze);ring('Turbine hub',(-7,2.4,-26.63),.45,.12,bronze)
for i in range(12):
    a=i*math.tau/12;rod('Turbine radial blade',(-7+math.cos(a)*.55,2.4+math.sin(a)*.55,-26.7),(-7+math.cos(a+.18)*1.5,2.4+math.sin(a+.18)*1.5,-26.7),.13,bronze,8)
floor('Latched access bridge',0,-27,8,6.4)
floor('Lift platform',7,-31.2,3.6,3.6)
for x in [5,9]:
    for z in [-33,-29]:rod('Lift guide rail',(x,0,z),(x,6.6,z),.14,bronze)
for x in [5,9]:box('Lift counterweight',(x,4.4,-33.5),(.6,1.8,.7),basalt)
for x in [5,9]:rod('Lift upper crossbar',(x,6.6,-33),(x,6.6,-29),.15,bronze)
# A throne/halo architectural socket, not a finished god character.
floor('Guardian dais',0,-53,8,4,3.2)
box('Throne foundation',(0,3.65,-54),(4.8,.9,2.4),ash)
box('Throne back',(0,6.2,-55),(4.0,4.7,.65),basalt,.12)
ring('Guardian halo socket',(0,8.3,-55.35),1.65,.08,bronze)
for i in range(12):
    a=i*math.tau/12;rod('Halo architectural ray',(math.cos(a)*1.8,8.3+math.sin(a)*1.8,-55.35),(math.cos(a)*2.15,8.3+math.sin(a)*2.15,-55.35),.06,bronze)
for x in [-3,3]:lantern(x,4.1,-52)
print('FIRE_BUILD detailed portal',flush=True)
portal=make_portal(0,18)
# Scale witness is separate from the actual game character and is clearly a mannequin.
rod('1.5m scale witness legs',(-2,0,21),(-2,.72,21),.11,ash,8)
rod('1.5m scale witness torso',(-2,.72,21),(-2,1.28,21),.20,ash,10)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.18,location=v((-2,1.40,21)));register(bpy.context.object,'1.5m scale witness head',ash)

# Validate model-space datums before cameras/lighting.
deps=bpy.context.evaluated_depsgraph_get();floor_errors=[]
for o,target in floors:
    ev=o.evaluated_get(deps);geo=ev.to_mesh();top=max((ev.matrix_world@q.co).z for q in geo.vertices);ev.to_mesh_clear();floor_errors.append(abs(top-target))
portal_lo=[float('inf')]*3;portal_hi=[-float('inf')]*3
triangles=0
for o in objects['map']+objects['portal']:
    ev=o.evaluated_get(deps);geo=ev.to_mesh();geo.calc_loop_triangles();triangles+=len(geo.loop_triangles)
    if o in portal:
        for vert in geo.vertices:
            p=ev.matrix_world@vert.co;g=(p.x,p.z,-p.y-18)
            for j in range(3):portal_lo[j]=min(portal_lo[j],g[j]);portal_hi[j]=max(portal_hi[j],g[j])
    ev.to_mesh_clear()
metrics={'status':'offline Blender architecture; not playable','meshObjects':len(objects['map'])+len(objects['portal']),'evaluatedTriangles':triangles,'maxFloorTopError':max(floor_errors),'portalBoundsRelativeToOwnOrigin':{'min':portal_lo,'max':portal_hi},'floorDatumPass':max(floor_errors)<.0001 and abs(portal_lo[1])<.0001,'designSource':'design-spec.json','remaining':['guardian character sculpt','dynamic puzzle state visuals','walk/camera collision','material texture baking and LOD','game integration and real-input playtest']}
(OUT/'geometry-check.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
assert metrics['floorDatumPass'],metrics

# Lights are review-only and excluded from the GLB exports.
world=bpy.data.worlds.new('Cool volcanic skylight');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.20,.28,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55
def area(name,p,target,energy,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.color=color;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=v(p);o.rotation_euler=(v(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
sun_data=bpy.data.lights.new('Warm broad sun','SUN');sun_data.energy=2.6;sun_data.angle=.24;sun_data.color=(1,.83,.61);sun=bpy.data.objects.new('Warm broad sun',sun_data);scene.collection.objects.link(sun);sun.rotation_euler=(.5,-.3,-.5)
area('Facade key',(-7,10,26),(0,3,18),1800,(1,.78,.48),8)
area('Facade cool fill',(7,6,23),(0,3,18),1400,(.48,.72,1),9)
for x,z in [(-28,1),(28,1),(0,-27),(0,-49)]:area('Room warm bounce',(x,6,z+3),(x,0,z),1400,(1,.63,.30),7)
scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True;scene.render.resolution_percentage=100
scene.render.threads_mode='FIXED';scene.render.threads=6
if '--eevee' in sys.argv:
    scene.render.engine='BLENDER_EEVEE'
    if hasattr(scene,'eevee') and hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=64
scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.35
scene.render.image_settings.file_format='PNG'
cam_data=bpy.data.cameras.new('Design camera');cam=bpy.data.objects.new('Design camera',cam_data);scene.collection.objects.link(cam);scene.camera=cam
cam.location=v((76,79,106));cam.rotation_euler=(v((0,1,-12))-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.type='ORTHO';cam_data.ortho_scale=123
def render(name,eye,target,ortho=None,res=(1600,1000),lens=42):
    cam.location=v(eye);cam.rotation_euler=(v(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.type='ORTHO' if ortho else 'PERSP';cam_data.ortho_scale=ortho or 10;cam_data.lens=lens;cam_data.clip_end=500
    scene.render.resolution_x=res[0];scene.render.resolution_y=res[1];scene.render.filepath=str(OUT/name)
    bpy.ops.render.render(write_still=True)

# Save editable unbatched source; export evaluated meshes grouped by material.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'fire-temple-v01.blend'))
def glb(name,targets,origin=(0,0,0)):
    copies=[];bpy.ops.object.select_all(action='DESELECT')
    for o in targets:
        ev=o.evaluated_get(deps);me=bpy.data.meshes.new_from_object(ev);c=bpy.data.objects.new('Export '+o.name,me);scene.collection.objects.link(c);c.matrix_world=o.matrix_world.copy();c.location-=v(origin);copies.append(c)
    batches={}
    for o in copies:batches.setdefault(o.data.materials[0].name,[]).append(o)
    joined=[]
    for mat,items in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in items:o.select_set(True)
        bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();items[0].name='Batch '+mat;joined.append(items[0])
    bpy.ops.object.select_all(action='DESELECT')
    for o in joined:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/name),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False)
    for o in joined:bpy.data.objects.remove(o,do_unlink=True)
    print('FIRE_EXPORT',name,len(joined),'material batches',flush=True)
glb('fire-temple-map-v01.glb',objects['map']+objects['portal'])
glb('fire-portal-v01.glb',portal,origin=(0,0,18))
if '--no-render' not in sys.argv:
    render('blender-overview.png',(76,79,106),(0,1,-12),ortho=123,res=(1800,1350))
    # Isolated door turntable, not the rear rooms seen through the camera.
    for o in objects['map']:o.hide_render=True
    floor('Portal review floor',0,18,16,12,0)
    render('blender-portal-front.png',(0,4.1,34),(0,4.1,18),ortho=12.8,res=(1400,1100))
    render('blender-portal-quarter.png',(10,6.5,31),(0,3.8,18),lens=47,res=(1500,1100))
    for o in objects['map']:o.hide_render=o.name.startswith('Portal review floor')
    render('blender-fracture.png',(-23,3.1,12),(-28,1,-5),lens=32)
    render('blender-foundry.png',(22,3.2,12),(29,1,-4),lens=32)
    render('blender-steam.png',(9,4,-18),(-1,2.1,-31),lens=28)
    render('blender-top.png',(0,125,-12),(0,0,-12),ortho=116,res=(1400,1400))
print('FIRE_COMPLETE',json.dumps(metrics),flush=True)
