"""Author a weight-sanctuary facade, preserving existing interior sources.

Unity uses evaluated, material-batched mesh data in game metres (Y up).
The editable Blender scene and FBX interchange asset are also retained.
"""
import bpy, os, sys, math, json
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
from asset_detail_helpers import box, rod, ring, line, mesh, material, vec, ROOT

ART=os.path.join(ROOT,'art/temple-exterior')
OUT=os.path.join(ROOT,'art/engine-transfer/model-data/TempleExterior')
os.makedirs(ART,exist_ok=True);os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
stone=material('Sanctuary limestone',(.51,.46,.33),0,.82)
pale=material('Sanctuary cut edges',(.72,.65,.48),0,.7)
dark=material('Sanctuary dark inlay',(.027,.072,.075),.05,.7)
gold=material('Sanctuary aged gold',(.57,.33,.082),.65,.35)
glow=material('Sanctuary turquoise',(.04,.43,.36),.15,.32)
portal=material('Sanctuary doorway',(.013,.095,.102),.15,.5)
for mat,strength in [(glow,2.5),(portal,.7)]:
    bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Emission Color'].default_value=mat.diffuse_color;bsdf.inputs['Emission Strength'].default_value=strength

# Foundations extend below the terrain. The walk-in centre remains open at ground level.
for side in [-1,1]:
    x=side*2.5
    for y,w,d,z in [(-.25,2.3,3.9,1.25),(.07,2.05,3.3,1.45),(.3,1.75,2.85,1.55)]:
        box('Stepped side foundation',(x,y,z),(w,.3,d),stone,bevel=.06)
    for row in range(5):
        box('Dressed pier course',(x,.85+row*.75,1.6),(1.45,.71,2.65),stone,bevel=.045)
    box('Recessed pier tablet',(x,2.42,.245),(1.15,2.85,.11),dark,bevel=.04)
    for dx in [-.45,.45]:rod('Tablet border',(x+dx,1.03,.17),(x+dx,3.8,.17),.025,gold)
    for h in [1.03,3.8]:rod('Tablet border',(x-.45,h,.17),(x+.45,h,.17),.025,gold)
    # Fluted front column, segmented collars, capital and ornamental torches.
    cx=side*3.06
    rod('Round fluted column',(cx,.5,-.04),(cx,4.24,-.04),.22,pale,vertices=16)
    for i in range(8):
        a=i*math.tau/8
        rod('Inset column flute',(cx+.217*math.cos(a),.83,-.04+.217*math.sin(a)),(cx+.217*math.cos(a),3.94,-.04+.217*math.sin(a)),.018,dark,vertices=6)
    for y in [.58,.76,3.98,4.17]:ring('Gilded column collar',(cx,y,-.04),.245,.035,gold,segments=24)
    for y in [.4,4.36]:box('Carved column capital',(cx,y,-.04),(.75,.22,.7),pale,bevel=.035)
    box('Torch wall bracket',(x,1.57,-.06),(.58,.14,.75),gold)
    box('Luminous torch',(x,1.99,-.28),(.28,.68,.28),glow,bevel=.035)
    for y in [1.64,2.35]:box('Torch crown',(x,y,-.28),(.44,.12,.44),gold)
    for dx in [-.18,.18]:
        for dz in [-.18,.18]:rod('Torch cage',(x+dx,1.69,-.28+dz),(x+dx,2.29,-.28+dz),.018,gold,vertices=6)
    # A short side wing makes the entrance read as architecture from oblique views.
    box('Rear side buttress',(side*3.2,1.9,3.05),(.85,4.4,1),stone,bevel=.06)

box('Sanctuary rear wall',(0,2.2,3.18),(5.9,4.9,.55),stone,bevel=.04)
box('Door shadow recess',(0,1.95,1.9),(2.95,3.95,.2),dark,bevel=.03)
box('Teal portal surface',(0,1.94,1.76),(2.64,3.68,.06),portal,bevel=.02)
for side in [-1,1]:
    box('Carved inner jamb',(side*1.51,2,1.52),(.27,4.0,.62),pale,bevel=.035)
    box('Portal vertical light',(side*1.32,1.95,1.48),(.048,3.73,.055),glow,bevel=.008)
    for y in [.45,1.2,1.95,2.7,3.45]:
        box('Jamb gold inset',(side*1.52,y,1.192),(.12,.27,.025),gold,bevel=.008)
for y in [.1,3.8]:box('Portal light lintel',(0,y,1.48),(2.68,.045,.055),glow,bevel=.008)
# Restrained thin lines instead of a heavy particle system.
for x in [-.72,-.36,0,.36,.72]:
    box('Doorway vertical etching',(x,1.94,1.713),(.012,2.9 if x else 3.35,.012),glow,bevel=0)
ring('Door constellation',(0,2,1.68),.78,.024,gold,plane='xy',segments=48)
ring('Door constellation inner',(0,2,1.675),.6,.013,glow,plane='xy',segments=32)
for a in [math.pi/4+i*math.pi/2 for i in range(4)]:
    x=.78*math.cos(a);y=2+.78*math.sin(a)
    box('Door rune',(x,y,1.64),(.11,.11,.035),glow,bevel=.02)

for y,w,h,d,z,mat in [(4.38,6.9,.24,3.8,1.4,pale),(4.62,6.45,.3,3.3,1.5,stone),(4.83,6.75,.1,3.5,1.5,gold)]:
    box('Entablature',(0,y,z),(w,h,d),mat,bevel=.045)
box('Name tablet',(0,4.62,-.196),(3.9,.42,.12),dark,bevel=.025)
# Solid triangular crown, with a gilded contour.
verts=[(-3.12,4.9,-.04),(3.12,4.9,-.04),(0,6.3,-.04),(-3.12,4.9,2.98),(3.12,4.9,2.98),(0,6.3,2.98)]
mesh('Triangular pediment',verts,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],stone)
line('Golden pediment edge',[(-3.17,4.9,-.09),(0,6.35,-.09),(3.17,4.9,-.09)],.055,gold)
line('Inner pediment edge',[(-2.43,5.03,-.10),(0,6.1,-.10),(2.43,5.03,-.10)],.022,pale)

# The balance emblem is geometry, legible at a distance and independent of font rendering.
ring('Scale halo',(0,5.48,-.145),.52,.035,gold,plane='xy',segments=40)
rod('Scale mast',(0,5.12,-.21),(0,5.78,-.21),.028,gold)
rod('Scale beam',(-.7,5.62,-.21),(.7,5.62,-.21),.031,gold)
rod('Scale foot',(-.25,5.1,-.21),(.25,5.1,-.21),.032,gold)
for side in [-1,1]:
    x=side*.55
    for dx in [-.19,.19]:rod('Scale chain',(x,5.6,-.21),(x+dx,5.26,-.21),.012,gold,vertices=6)
    line('Scale bowl',[(x-.22,5.26,-.22),(x-.14,5.17,-.22),(x+.14,5.17,-.22),(x+.22,5.26,-.22)],.025,glow)

# Small ruined sentinels frame the approach without occupying its centre.
for x,z,h in [(-4.1,-.35,1.25),(4.0,.2,.8)]:
    box('Ruined pillar base',(x,-.03,z),(1,.35,1),stone,bevel=.06)
    rod('Ruined pillar shaft',(x,.05,z),(x+.12,h,z+.05),.29,stone,vertices=10)
    ring('Ruined pillar collar',(x,h*.55,z),.3,.035,gold,segments=20)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,'weight-sanctuary-v01.blend'))
# Export evaluated Blender geometry, batching by material to bound draw calls.
deps=bpy.context.evaluated_depsgraph_get();batches={}
for obj in list(bpy.context.scene.objects):
    if obj.type not in {'MESH','CURVE'}:continue
    evaluated=obj.evaluated_get(deps);geo=evaluated.to_mesh();geo.calc_loop_triangles()
    name=obj.data.materials[0].name
    batch=batches.setdefault(name,{'material':name,'vertices':[],'normals':[],'triangles':[]})
    offset=len(batch['vertices'])//3;normal_matrix=evaluated.matrix_world.to_3x3().inverted().transposed()
    for vertex in geo.vertices:
        v=evaluated.matrix_world@vertex.co;n=(normal_matrix@vertex.normal).normalized()
        batch['vertices'].extend([v.x,v.z,-v.y]);batch['normals'].extend([n.x,n.z,-n.y])
    for tri in geo.loop_triangles:
        # (x,z,-y) is a rotation (positive determinant), so preserve face winding.
        a,b,c=tri.vertices;batch['triangles'].extend([offset+a,offset+b,offset+c])
    evaluated.to_mesh_clear()
palette=[]
for mat in [stone,pale,dark,gold,glow,portal]:
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    palette.append({'name':mat.name,'color':list(mat.diffuse_color),'metal':bsdf.inputs['Metallic'].default_value,'emission':2.5 if mat==glow else .7 if mat==portal else 0})
with open(os.path.join(OUT,'exterior.json'),'w',encoding='utf8') as f:json.dump({'materials':palette,'meshes':list(batches.values())},f,separators=(',',':'))
bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.ops.object.convert(target='MESH')
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT,'weight-sanctuary-v01.fbx'),object_types={'MESH'},axis_forward='-Z',axis_up='Y',bake_anim=False,path_mode='STRIP')

# Actual Blender render for authoring review (not an AI reference).
bpy.ops.object.camera_add(location=vec((10,7,-13)));camera=bpy.context.object
direction=vec((0,2.5,1))-camera.location;camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=12
bpy.context.scene.camera=camera
for position,energy,size in [((2,10,-7),1800,7),((-6,5,2),1000,6)]:
    bpy.ops.object.light_add(type='AREA',location=vec(position));light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(vec((0,2,1))-light.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world=bpy.data.worlds.new('Sanctuary studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.16,.18,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.filepath=os.path.join(ART,'weight-sanctuary-v01.png');bpy.ops.render.render(write_still=True)
print('TEMPLE_EXTERIOR_EXPORT',sum(len(b['triangles'])//3 for b in batches.values()),'triangles',len(batches),'materials')
