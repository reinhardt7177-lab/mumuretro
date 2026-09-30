"""An editable open leather notebook and independently turning paper leaf.
Front faces -Z in Unity; the hinge sits at the book spine, x=0.
"""
import bpy,bmesh,math,os,sys,json
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,vec,material,box,line,ring,mesh
ART=os.path.join(ROOT,'art/explorer-notebook');OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/Notebook')
os.makedirs(ART,exist_ok=True);os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
leather=material('Notebook jade leather',(.035,.10,.082),.12,.65)
gold=material('Notebook gold binding',(.69,.43,.16),.56,.36)
paper=material('Notebook warm paper',(.89,.84,.69),0,.86)
edge=material('Notebook page edges',(.63,.54,.36),0,.9)
ribbon=material('Notebook red bookmark',(.30,.045,.028),.1,.65)
for side in [-1,1]:
    box('Bevelled leather hard cover',(side*2.35,0,.20),(4.65,6.28,.17),leather,bevel=.085)
    # Stitched border and gilded corner guards remain outside the reading area.
    line('Cover gold stitched border',[(side*.15,-3.04,.096),(side*4.56,-3.04,.096),(side*4.56,3.04,.096),(side*.15,3.04,.096)],.018,gold)
    for y in [-2.96,2.96]:
        for j in range(3):
            x=side*(4.48-j*.065)
            line('Corner metal guard',[(x,y-side*0,.075),(x,y-math.copysign(.28+j*.08,y),.075)],.026,gold)
        line('Corner triangular engraving',[(side*4.38,y,.07),(side*4.15,y-math.copysign(.22,y),.07),(side*4.48,y-math.copysign(.38,y),.07)],.018,gold)
    for j in range(12):
        inset=(j%3)*.009
        box('Layered paper edge',(side*2.27,0,.07-j*.010),(4.34-inset,5.84-inset,.013),paper if j%3 else edge,bevel=.012)
    # Gently dipped paper at the spine; most of each page is flat for sharp UI type.
    vertices=[];faces=[]
    for row in range(9):
        y=-2.9+row*5.8/8
        for col in range(25):
            t=col/24;x=side*(.105+4.32*t);z=-.092+.095*math.exp(-t*15)
            vertices.append((x,y,z))
    for row in range(8):
        for col in range(24):
            k=row*25+col;faces.append((k,k+1,k+26,k+25))
    o=mesh('Open ivory reading page',vertices,faces,paper)
    for p in o.data.polygons:p.use_smooth=True
    sol=o.modifiers.new('Paper thickness','SOLIDIFY');sol.thickness=.006
    # Fine ornamental corners, no fake handwriting behind the readable game text.
    for y in [-2.73,2.73]:
        line('Page corner ink-gold rule',[(side*4.23,y,-.105),(side*4.23,y-math.copysign(.20,y),-.105)],.008,gold)
        line('Page corner horizontal rule',[(side*4.23,y,-.105),(side*4.02,y,-.105)],.008,gold)
box('Supple central book spine',(0,0,.075),(.16,6.18,.22),leather,bevel=.05)
for x in [-.075,.075]:line('Spine gold seam',[(x,-3.04,-.045),(x,3.04,-.045)],.008,gold)
bookmark=mesh('Bookmark with cut tail',[(3.55,-2.30,-.106),(3.78,-2.30,-.106),(3.78,-3.42,-.106),(3.665,-3.30,-.106),(3.55,-3.42,-.106)],[(0,1,2,3,4)],ribbon)
sol=bookmark.modifiers.new('Woven ribbon thickness','SOLIDIFY');sol.thickness=.009

# Uniform grid provides predictable deformation during the page-turn animation.
verts=[];faces=[]
for y in range(17):
    for x in range(25):verts.append((.105+4.32*x/24,-2.9+5.8*y/16,-.12))
for y in range(16):
    for x in range(24):
        k=y*25+x;faces.append((k,k+1,k+26,k+25))
leaf=mesh('Animated paper leaf',verts,faces,paper);leaf['part']='Leaf'
for p in leaf.data.polygons:p.use_smooth=True
sol=leaf.modifiers.new('Double sided paper thickness','SOLIDIFY');sol.thickness=.008
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
deps=bpy.context.evaluated_depsgraph_get();batches={}
for o in list(bpy.context.scene.objects):
    if o.type not in {'MESH','CURVE'}:continue
    e=o.evaluated_get(deps);geo=e.to_mesh();geo.calc_loop_triangles()
    mat=o.data.materials[0].name;part=o.get('part','Book');key=part+' '+mat
    batch=batches.setdefault(key,{'name':key,'part':part,'material':mat,'vertices':[],'normals':[],'triangles':[]})
    nm=e.matrix_world.to_3x3().inverted().transposed();lookup={}
    for tri in geo.loop_triangles:
        for li in tri.loops:
            p=e.matrix_world@geo.vertices[geo.loops[li].vertex_index].co;n=(nm@geo.corner_normals[li].vector).normalized()
            values=(p.x,p.z,-p.y,n.x,n.z,-n.y);k=tuple(round(v,6) for v in values)
            if k not in lookup:
                lookup[k]=len(batch['vertices'])//3;batch['vertices'].extend(values[:3]);batch['normals'].extend(values[3:])
            batch['triangles'].append(lookup[k])
    e.to_mesh_clear()
palette=[]
for m in [leather,gold,paper,edge,ribbon]:
    p=m.node_tree.nodes['Principled BSDF'];palette.append({'name':m.name,'color':list(m.diffuse_color),'metal':p.inputs['Metallic'].default_value,'roughness':p.inputs['Roughness'].default_value})
with open(os.path.join(OUT,'notebook-v01.json'),'w',encoding='utf8') as f:json.dump({'materials':palette,'meshes':list(batches.values())},f,separators=(',',':'))
budget={'triangles':sum(len(b['triangles'])//3 for b in batches.values()),'batches':len(batches),'turnVertices':sum(len(b['vertices'])//3 for b in batches.values() if b['part']=='Leaf')}
with open(os.path.join(ART,'mesh-budget.json'),'w') as f:json.dump(budget,f,indent=2)
leaf.hide_render=True;leaf.hide_set(True)
bpy.ops.object.camera_add(location=vec((0,0,-12)));camera=bpy.context.object;camera.rotation_euler=(vec((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=10.1;bpy.context.scene.camera=camera
for location,energy,size in [((-3,5,-6),950,6),((4,0,-4),600,5)]:
    bpy.ops.object.light_add(type='AREA',location=vec(location));light=bpy.context.object;light.data.energy=energy;light.data.size=size;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Notebook studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.05,.07,.06,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1440;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.filepath=os.path.join(ART,'blender-notebook-v01.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,'explorer-notebook-v01.blend'))
if '--skip-render' not in sys.argv:bpy.ops.render.render(write_still=True)
print('NOTEBOOK_EXPORT',budget)
