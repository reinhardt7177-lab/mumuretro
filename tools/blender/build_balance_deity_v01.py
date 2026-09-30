"""Author the equilibrium deity from art/balance-deity/concept-v01.png.

Editable layered sculpture first, then evaluated material batches for Unity.
Game metres/Y-up/facing -Z; helpers rotate to Blender without mirroring.
Never opens or overwrites the previous temple guardian source.
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
from asset_detail_helpers import ROOT, vec, material, mesh, rod, ring, line

ART=os.path.join(ROOT,'art/balance-deity')
OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/BalanceDeity')
os.makedirs(ART,exist_ok=True);os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
jade=material('Deity deep jade',(.033,.102,.088),.32,.36)
stone=material('Deity ivory stone',(.63,.62,.49),.12,.46)
shadow=material('Deity recesses',(.009,.022,.022),.18,.5)
gold=material('Deity antique gold',(.67,.40,.115),.74,.3)
bright=material('Deity edge gold',(.88,.64,.25),.62,.27)
teal=material('Deity crystal',(.10,.72,.63),.22,.21)
teal.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(.06,.65,.49,1)
teal.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=1.3

def smooth(o):
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
    return o

def surface(name,fn,nu,nv,mat,thickness=.018):
    vertices=[fn(i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)]
    faces=[]
    for j in range(nv):
        for i in range(nu):
            k=j*(nu+1)+i;faces.append((k,k+1,k+nu+2,k+nu+1))
    o=smooth(mesh(name,vertices,faces,mat))
    # Keep the authored surface editable, with real edge thickness.
    if thickness:
        mod=o.modifiers.new('Carved slab thickness','SOLIDIFY');mod.thickness=thickness
    return o

def lathe(name,profile,mat,n=64):
    verts=[]
    for r,y in profile:
        for i in range(n):
            a=i*math.tau/n;verts.append((r*math.cos(a),y,r*math.sin(a)))
    faces=[]
    for j in range(len(profile)-1):
        for i in range(n):
            k=j*n+i;q=j*n+(i+1)%n;faces.append((k,q,q+n,k+n))
    faces.extend([tuple(reversed(range(n))),tuple((len(profile)-1)*n+i for i in range(n))])
    return smooth(mesh(name,verts,faces,mat))

def ellipsoid(name,p,s,mat):
    tiny=max(s)<.05
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8 if tiny else 20,ring_count=6 if tiny else 12,location=vec(p))
    o=bpy.context.object;o.name=name;o.scale=(s[0],s[2],s[1]);o.data.materials.append(mat);return smooth(o)

def crystal(name,p,rx,ry,depth,mat):
    x,y,z=p
    return mesh(name,[(x,y+ry,z),(x-rx,y,z),(x,y,z-depth),(x+rx,y,z),(x,y,z+depth),(x,y-ry,z)],
        [(0,1,2),(0,2,3),(0,3,4),(0,4,1),(5,2,1),(5,3,2),(5,4,3),(5,1,4)],mat)

def outline(name,pts,r=.012,mat=gold):return line(name,pts,r,mat)

# Graduated round dais with a carved band, decorative rather than new gameplay ground.
lathe('Three stepped basalt dais',[(1.84,0),(1.84,.12),(1.74,.18),(1.74,.29),(1.63,.35),(1.63,.44)],jade)
for radius,y in [(1.84,.09),(1.75,.18),(1.73,.28),(1.62,.43)]:ring('Dais fine gilding',(0,y,0),radius,.016,bright,segments=96)
for i in range(24):
    a=i*math.tau/24
    pts=[((1.756)*math.cos(a+da),.23+dy,1.756*math.sin(a+da)) for da,dy in [(0,.032),(.02,0),(0,-.032),(-.02,0),(0,.032)]]
    outline('Dais cut diamond',pts,.007)

# Curved robe: flared hem, narrow waist and ribbed stone folds (no cone primitive).
def radius(v):return 1.36*(1-v)**3+.43+.06*math.sin(v*math.pi)
def robe(u,v):
    a=u*math.tau;r=radius(v)+(.06+.045*(1-v))*math.cos(a*18+.7*v)
    return (r*math.sin(a),.44+3.18*v,-r*.69*math.cos(a))
surface('Deep continuous pleated robe',robe,84,28,jade,.026)

# Separate flowing panels follow the robe, with scalloped pointed hems and edge inlay.
for index in range(12):
    center=index*math.tau/12
    ivory=index in [1,5,7,11]
    def panel(u,v,c=center):
        angle=c+(u-.5)*(.38+.05*(1-v));r=radius(v)+.072+.03*math.sin(u*math.pi)
        y=.46+3.05*v+.18*math.sin(math.pi*u)*(1-v)**3
        return (r*math.sin(angle),y,-r*.69*math.cos(angle))
    surface('Ivory sweeping fold' if ivory else 'Jade overlapping fold',panel,6,24,stone if ivory else jade,.025)
    for edge in [0,1]:outline('Robe gold seam',[panel(edge,k/38) for k in range(39)],.009,bright if ivory else gold)

# Anatomical torso under the tabard and pauldrons, upper back remains continuous.
def torso(u,v):
    a=u*math.tau;r=.49+.2*math.sin(v*math.pi*.75)
    return (r*math.sin(a),3.02+1.03*v,-r*.64*math.cos(a))
surface('Sculpted armoured torso',torso,48,15,jade,.025)
ellipsoid('Hidden neck',(0,4.15,.015),(.25,.28,.22),shadow)

# Long pointed front vestment: ridged, tapering and entirely modeled.
def tabard(u,v):
    y=.61+3.50*v
    width=.18+.15*math.sin(v*math.pi)+.38*max(0,(v-.82)/.18)
    y+=.22*abs(2*u-1)*(1-v)**3
    x=(u-.5)*2*width
    z=-(radius(min(1,(y-.44)/3.18))*.69+.115)-.035*math.cos((u-.5)*math.pi)
    return(x,y,z)
surface('Ivory pointed ceremonial tabard',tabard,16,48,stone,.035)
for edge in [0,1]:outline('Vestment double gold border',[tabard(edge,k/60) for k in range(61)],.018,bright)
outline('Central vestment spine',[tabard(.5,k/60) for k in range(61)],.009,gold)
for y in [1.05,1.7,2.4,3.12]:
    v=(y-.61)/3.5;x,yy,z=tabard(.5,v)
    outline('Vestment sacred lozenge',[(0,y+.15,z-.025),(.10,y,z-.035),(0,y-.15,z-.035),(-.10,y,z-.035),(0,y+.15,z-.025)],.010)

# Curved shoulder plates and long trailing mantle panels, layered rather than blocky.
for side in [-1,1]:
    for layer in range(3):
        def shoulder(u,v,s=side,l=layer):
            x=s*(.23+u*(.89-.06*l))
            y=4.10-.18*l+.14*math.sin(math.pi*u)-.39*u*u-.31*v
            z=-.18-.40*math.sin(math.pi*v)+.26*u
            return (x,y,z)
        surface('Layered carved shoulder',shoulder,18,10,stone if layer==1 else jade,.05)
        outline('Shoulder rolled gold crest',[shoulder(k/36,0) for k in range(37)],.021,bright)
        outline('Shoulder plated lower edge',[shoulder(k/36,1) for k in range(37)],.014,gold)
    def cape(u,v,s=side):
        x=s*(.79+.47*(1-v)**2+.14*math.sin(math.pi*v)+(u-.5)*(.43+.16*(1-v)))
        y=.56+3.13*v+.32*abs(2*u-1)*(1-v)**3
        z=.12-.10*math.sin(u*math.pi)-.45*v*v
        return(x,y,z)
    surface('Hanging sculpted shoulder mantle',cape,14,40,jade,.055)
    for edge in [0,1]:outline('Mantle gold piping',[cape(edge,k/48) for k in range(49)],.014,bright)
    # Gauntleted arms bend naturally forward to the balance beam.
    shoulder_pos=(side*.72,3.78,-.06);elbow=(side*.91,3.18,-.30);wrist=(side*1.08,3.03,-.86)
    smooth(rod('Upper arm carved sleeve',shoulder_pos,elbow,.17,jade,vertices=20))
    ellipsoid('Elbow joint',elbow,(.18,.18,.18),shadow)
    smooth(rod('Ivory forearm bracer',elbow,wrist,.145,stone,vertices=20))
    direction=Vector(wrist)-Vector(elbow)
    for t in [.12,.28,.75,.91]:
        c=Vector(elbow)+direction*t
        # Oriented fine bracer rings, using a perpendicular basis.
        axis=direction.normalized();a=axis.cross(Vector((0,1,0))).normalized();b=axis.cross(a)
        outline('Bracer engraved collar',[tuple(c+.149*(a*math.cos(k*math.tau/24)+b*math.sin(k*math.tau/24))) for k in range(25)],.011,gold)
    ellipsoid('Ivory gauntlet palm',(side*1.08,3.00,-.96),(.16,.10,.19),stone)
    # Four separated curling fingers and opposing thumb, gripping over the beam.
    for finger in range(4):
        x=side*1.08+(finger-1.5)*.075
        a=(x,3.02,-1.035);b=(x,2.96,-1.145);c=(x,2.84,-1.15)
        smooth(rod('Finger proximal',a,b,.032,stone,vertices=10));smooth(rod('Finger curled tip',b,c,.029,stone,vertices=10))
        ellipsoid('Gilded finger knuckle',b,(.033,.034,.035),gold)
    outline('Opposed gauntlet thumb',[(side*.94,3.00,-.97),(side*.88,2.92,-1.03),(side*.95,2.85,-1.08)],.04,stone)

# Head: dark recessed interior, pointed hood silhouette, a deliberately inhuman mask.
ellipsoid('Shadow within hood',(0,4.63,.015),(.43,.62,.30),shadow)
def hood(u,v):
    a=-2.12+4.24*u # an open arch at the front, not a closed sphere
    y=4.02+1.26*v
    r=.24+.23*math.sin(math.pi*v*.90)
    return(r*math.sin(a),y,.06+r*.86*math.cos(a))
surface('Carved open hood',hood,36,22,jade,.075)
for edge in [0,1]:outline('Hood rim inlaid gold',[hood(edge,k/36) for k in range(37)],.020,bright)
# Double convex half-mask with pointed chin, no nose/mouth/cheeks.
def mask(u,v):
    width=.32*math.sin(math.pi*v*.91)**.60
    x=(2*u-1)*width
    y=4.21+.89*v
    z=-.31-.16*math.sin(math.pi*u)-.045*math.sin(math.pi*v)
    return(x,y,z)
surface('Elongated ivory equilibrium mask',mask,24,28,stone,.03)
outline('Mask central gold incision',[tuple(Vector(mask(.5,k/36))+Vector((0,0,-.018))) for k in range(37)],.008,bright)
for side in [-1,1]:
    outline('Subtle luminous eye slit',[(side*.10,4.82,-.479),(side*.20,4.85,-.452)],.012,teal)
    ring('Temple ear disc',(side*.405,4.76,0),.155,.023,gold,plane='yz',segments=32)
    crystal('Crown side blade',(side*.37,5.30,.08),.065,.57,.052,bright)
    crystal('Crown outer blade',(side*.60,5.16,.13),.065,.36,.05,gold)
crystal('Crown central spire',(0,5.46,.15),.085,.62,.06,bright)
crystal('Heart of equilibrium',(0,3.85,-.57),.13,.21,.07,teal)
outline('Heart gold setting',[(0,4.12,-.55),(.20,3.85,-.57),(0,3.58,-.57),(-.20,3.85,-.57),(0,4.12,-.55)],.026,bright)

# The real, perfectly level balance is the deity's unmistakable symbol.
beam_y=2.87;beam_z=-1.085
smooth(rod('Sacred level balance beam',(-1.34,beam_y,beam_z),(1.34,beam_y,beam_z),.04,gold,vertices=16))
crystal('Balance central gold emblem',(0,beam_y,beam_z),.13,.19,.06,bright)
for side in [-1,1]:
    x=side*1.26
    ring('Balance suspension loop',(x,beam_y-.03,beam_z),.065,.015,bright,plane='xy',segments=20)
    for a in [0,math.tau/3,math.tau*2/3]:
        endpoint=(x+.31*math.cos(a),1.99,beam_z+.31*math.sin(a))
        outline('Scale hanging chain',[(x,2.78,beam_z),endpoint],.009,bright)
        # Bead links read from the dialogue camera without a thousand torus objects.
        for k in range(1,9):
            t=k/9;p=Vector((x,2.78,beam_z)).lerp(Vector(endpoint),t)
            ellipsoid('Chain link',p,(.014,.023,.014),gold)
    dish=lathe('Golden balance dish',[(.035,1.81),(.14,1.84),(.29,1.91),(.35,1.99),(.36,2.01),(.32,1.99),(.25,1.93),(.12,1.89),(.025,1.88)],gold,n=40)
    dish.location=vec((x,0,beam_z));ring('Pan luminous rim',(x,2.005,beam_z),.354,.014,bright,segments=48)
    crystal('Balanced cyan offering',(x,2.21,beam_z),.12,.23,.105,teal)

# Three concentric celestial orbits. Halo geometry belongs to the Blender model.
for r,t in [(1.46,.025),(1.32,.010),(1.02,.012)]:ring('Celestial gilded orbit',(0,4.52,.46),r,t,bright,plane='xy',segments=128)
for i in range(12):
    a=i*math.tau/12
    p=Vector((math.sin(a)*1.46,4.52+math.cos(a)*1.46,.46))
    q=Vector((math.sin(a)*1.58,4.52+math.cos(a)*1.58,.46))
    outline('Halo radial marker',[p,q],.018,gold)
    if i%3==0:
        crystal('Orbit compass ornament',p,.055,.11,.035,bright)
    else:ring('Halo small constellation ring',p,.055,.011,gold,plane='xy',segments=16)
for side in [-1,1]:
    outline('Halo structural arc',[(side*.30,3.82,.43),(side*.7,3.67,.44),(side*1.03,3.47,.46)],.018,gold)

# Recalculate closed-mesh normals. Surface front faces are intentionally -Z-facing.
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
        o['asset']='Equilibrium deity v01'

# Keep sculpture collection editable in the native source; export evaluated meshes.
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get();batches={}
for o in list(bpy.context.scene.objects):
    if o.type not in {'MESH','CURVE'}:continue
    e=o.evaluated_get(deps);geo=e.to_mesh();geo.calc_loop_triangles()
    mat=o.data.materials[0].name;b=batches.setdefault(mat,{'name':mat,'material':mat,'vertices':[],'normals':[],'triangles':[]})
    # Split at polygon corners to preserve explicitly flat crystal/bevel faces.
    normalmat=e.matrix_world.to_3x3().inverted().transposed()
    for tri in geo.loop_triangles:
        for loopindex in tri.loops:
            loop=geo.loops[loopindex];p=e.matrix_world@geo.vertices[loop.vertex_index].co
            n=(normalmat@geo.corner_normals[loopindex].vector).normalized()
            b['triangles'].append(len(b['vertices'])//3);b['vertices'].extend((p.x,p.z,-p.y));b['normals'].extend((n.x,n.z,-n.y))
    e.to_mesh_clear()
palette=[]
for name in batches:
    m=bpy.data.materials[name];p=m.node_tree.nodes['Principled BSDF']
    palette.append({'name':name,'color':list(m.diffuse_color),'metal':p.inputs['Metallic'].default_value,'roughness':p.inputs['Roughness'].default_value,'emission':p.inputs['Emission Strength'].default_value if name==teal.name else 0})
with open(os.path.join(OUT,'deity-v01.json'),'w',encoding='utf8') as f:json.dump({'materials':palette,'meshes':list(batches.values())},f,separators=(',',':'))
triangles=sum(len(b['triangles'])//3 for b in batches.values())
with open(os.path.join(ART,'mesh-budget.json'),'w') as f:json.dump({'triangles':triangles,'materialBatches':len(batches),'sourceObjects':len(bpy.context.scene.objects)},f,indent=2)

# A reproducible Blender studio render proves the modeled result, not the concept art.
bpy.ops.object.camera_add(location=vec((7.6,5.2,-11.8)));camera=bpy.context.object;camera.name='Deity studio camera'
camera.rotation_euler=(vec((0,3.05,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=7.0;bpy.context.scene.camera=camera
for position,energy,size in [((-3,7,-5),1400,5),((4,5,-2),900,4),((0,6,3),1900,3)]:
    bpy.ops.object.light_add(type='AREA',location=vec(position));light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(vec((0,3,0))-light.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.world=bpy.data.worlds.new('Deity studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.045,.075,.078,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.filepath=os.path.join(ART,'blender-sculpture-v01.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,'equilibrium-deity-v01.blend'))
if '--skip-render' not in sys.argv:bpy.ops.render.render(write_still=True)
# FBX is also retained for interchange, while JSON batches retain exact normals in Unity.
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type in {'MESH','CURVE'}:o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in bpy.context.selected_objects)
bpy.ops.object.convert(target='MESH')
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT,'equilibrium-deity-v01.fbx'),use_selection=True,object_types={'MESH'},axis_forward='-Z',axis_up='Y',bake_anim=False,path_mode='STRIP')
print('DEITY_EXPORT',triangles,'triangles',len(batches),'material batches')
