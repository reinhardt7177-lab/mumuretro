"""Replace only the v01 flat portal with authored, independently hinged doors.

Keep the original native source. Export material batches per moving leaf.
Game coordinates are Y up; Blender conversion (x, z, -y) preserves winding.
"""
import bpy, os, sys, math, json
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
from asset_detail_helpers import box, rod, ring, line, material, vec, ROOT

ART=os.path.join(ROOT,'art/temple-exterior')
OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/TempleExterior')
bpy.ops.wm.open_mainfile(filepath=os.path.join(ART,'weight-sanctuary-v01.blend'))
obsolete=('Teal portal surface','Doorway vertical etching','Door constellation','Door rune')
for obj in list(bpy.context.scene.objects):
    if any(obj.name.startswith(name) for name in obsolete):bpy.data.objects.remove(obj,do_unlink=True)
# A recess at the far wall gives opened leaves room to swing into the vestibule.
bpy.data.objects['Door shadow recess'].location=vec((0,1.95,2.94))
bronze=material('Door brushed bronze',(.39,.205,.053),.72,.32)
teal=material('Door oxidised teal',(.022,.115,.105),.38,.46)
gold=bpy.data.materials['Sanctuary aged gold']
glow=bpy.data.materials['Sanctuary turquoise']
pivots={}
for side,part in [(-1,'Left'),(1,'Right')]:
    before=set(bpy.context.scene.objects)
    cx=side*.645
    box(part+' solid door',(cx,1.94,1.55),(1.25,3.64,.24),teal,bevel=.05)
    # Raised perimeter, inset panels, and thick thresholds catch real light.
    for x in [side*.055,side*1.235]:
        box('Forged stile',(x,1.94,1.386),(.085,3.56,.10),bronze,bevel=.025)
        box('Stile fine inlay',(x,1.94,1.327),(.018,3.42,.022),gold,bevel=.004)
    for y in [.2,.43,3.45,3.7]:
        box('Forged cross rail',(cx,y,1.385),(1.23,.105,.105),bronze,bevel=.026)
    for y,h in [(.92,.77),(2.93,.77)]:
        box('Recess panel surround',(cx,y,1.40),(.94,h,.095),bronze,bevel=.045)
        box('Deep teal inset',(cx,y,1.339),(.79,h-.14,.028),teal,bevel=.03)
        # An engraved diamond, with a luminous central pin.
        line('Diamond filigree',[(cx,y+.22,1.309),(cx+.27,y,1.309),(cx,y-.22,1.309),(cx-.27,y,1.309),(cx,y+.22,1.309)],.012,gold)
        box('Turquoise rivet',(cx,y,1.301),(.055,.085,.027),glow,bevel=.01)
    for y in [.55,1.93,3.33]:
        rod('Hinge barrel',(side*1.28,y-.12,1.55),(side*1.28,y+.12,1.55),.081,bronze,vertices=12)
        for h in [-.115,.115]:ring('Hinge collar',(side*1.28,y+h,1.55),.085,.018,gold,segments=12)
        box('Hinge strap',(side*1.05,y,1.365),(.39,.09,.07),bronze,bevel=.018)
    # The central roundel is split across the seam: no stationary decoration floats.
    start=-math.pi/2 if side==1 else math.pi/2
    for radius,tube,mat,z in [(.69,.045,bronze,1.29),(.61,.018,gold,1.267),(.73,.011,glow,1.283)]:
        points=[(radius*math.cos(start+.025+(math.pi-.05)*i/24),2.03+radius*math.sin(start+.025+(math.pi-.05)*i/24),z) for i in range(25)]
        line('Split balance medallion',points,tube,mat)
    rod('Scale half mast',(side*.025,1.79,1.245),(side*.025,2.46,1.245),.015,gold,vertices=8)
    rod('Scale beam', (side*.024,2.36,1.245),(side*.5,2.36,1.245),.024,gold)
    x=side*.39
    for dx in [-.15,.15]:rod('Scale chain',(x,2.34,1.242),(x+dx,2.09,1.242),.011,gold,vertices=6)
    line('Scale pan',[(x-.18,2.09,1.242),(x-.12,2.01,1.242),(x+.12,2.01,1.242),(x+.18,2.09,1.242)],.022,glow)
    box('Pull backplate',(side*.16,1.52,1.32),(.15,.27,.095),bronze,bevel=.025)
    ring('Heavy pull ring',(side*.16,1.49,1.22),.095,.025,gold,plane='xy',segments=20)
    for x in [side*.1,side*1.19]:
        for y in [.24,3.65]:rod('Raised rivet',(x,y,1.32),(x,y,1.30),.027,gold,vertices=8)
    objects=set(bpy.context.scene.objects)-before
    pivot=Vector((side*1.28,0,1.55));pivots[part]=list(pivot)
    hinge=bpy.data.objects.new(part+' door hinge',None);bpy.context.collection.objects.link(hinge);hinge.location=vec(pivot)
    bpy.context.view_layer.update()
    for obj in objects:
        world=obj.matrix_world.copy();obj.parent=hinge;obj.matrix_world=world;obj['door_part']=part

bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,'weight-sanctuary-v02.blend'))
deps=bpy.context.evaluated_depsgraph_get();batches={}
for obj in list(bpy.context.scene.objects):
    if obj.type not in {'MESH','CURVE'}:continue
    evaluated=obj.evaluated_get(deps);geo=evaluated.to_mesh();geo.calc_loop_triangles()
    mat=obj.data.materials[0].name;part=obj.get('door_part','Static');key=part+' '+mat
    batch=batches.setdefault(key,{'name':key,'part':part,'material':mat,'vertices':[],'normals':[],'triangles':[]})
    offset=len(batch['vertices'])//3;nm=evaluated.matrix_world.to_3x3().inverted().transposed();pivot=Vector(pivots.get(part,(0,0,0)))
    for vertex in geo.vertices:
        p=evaluated.matrix_world@vertex.co;n=(nm@vertex.normal).normalized();v=Vector((p.x,p.z,-p.y))-pivot
        batch['vertices'].extend(v);batch['normals'].extend((n.x,n.z,-n.y))
    for tri in geo.loop_triangles:batch['triangles'].extend(offset+i for i in tri.vertices)
    evaluated.to_mesh_clear()
palette=[]
for name in sorted({b['material'] for b in batches.values()}):
    mat=bpy.data.materials[name];bsdf=mat.node_tree.nodes.get('Principled BSDF')
    emission=bsdf.inputs['Emission Strength'].default_value if any(bsdf.inputs['Emission Color'].default_value[:3]) else 0
    palette.append({'name':name,'color':list(mat.diffuse_color),'metal':bsdf.inputs['Metallic'].default_value,'emission':emission})
with open(os.path.join(OUT,'exterior-v02.json'),'w',encoding='utf8') as f:json.dump({'materials':palette,'meshes':list(batches.values())},f,separators=(',',':'))
bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.ops.object.convert(target='MESH')
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT,'weight-sanctuary-v02.fbx'),object_types={'MESH','EMPTY'},axis_forward='-Z',axis_up='Y',bake_anim=False,path_mode='STRIP')
bpy.ops.object.camera_add(location=vec((4.9,4.1,-7)));camera=bpy.context.object
camera.rotation_euler=(vec((0,2.05,1.5))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=5.9;bpy.context.scene.camera=camera
for position,energy,size in [((1,7,-4),1250,5),((-4,4,-1),800,4)]:
    bpy.ops.object.light_add(type='AREA',location=vec(position));light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(vec((0,2,1))-light.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world=bpy.data.worlds.new('Door studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.16,.18,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.filepath=os.path.join(ART,'weight-door-v02.png')
if '--skip-render' not in sys.argv:bpy.ops.render.render(write_still=True)
print('TEMPLE_DOOR_EXPORT',sum(len(b['triangles'])//3 for b in batches.values()),'triangles',len(batches),'batches')
