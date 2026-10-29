"""Preserve originals; rebuild only static paving, with independent editable source."""
import bpy,bmesh,math,json,random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'art/fire-paving/v01';OUT.mkdir(parents=True,exist_ok=True)
metrics={}

def export_static(targets,stem):
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(stem+'.blend')))
    deps=bpy.context.evaluated_depsgraph_get();batches={};tris=0
    for source in targets:
        ev=source.evaluated_get(deps);me=bpy.data.meshes.new_from_object(ev)
        o=bpy.data.objects.new('Export '+source.name,me);bpy.context.collection.objects.link(o);o.matrix_world=source.matrix_world.copy()
        batches.setdefault(o.active_material.name,[]).append(o)
    merged=[]
    for name,items in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in items:o.select_set(True)
        bpy.context.view_layer.objects.active=items[0]
        if len(items)>1:bpy.ops.object.join()
        o=items[0];o.name=stem+' '+name;o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles);merged.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in merged:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(stem+'.glb')),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False)
    metrics[stem]={'pieces':len(targets),'meshes':len(merged),'triangles':tris,'bytes':(OUT/(stem+'.glb')).stat().st_size}

# Reuse the reviewed exporter selection and threshold apron. It makes no writes
# before the original export loop; original dynamic assets/manifest stay intact.
file=ROOT/'tools/blender/export_fire_fracture_v01.py'
scope={'__file__':str(file)}
exec(compile(file.read_text().split('for name,targets in pieces.items():')[0],str(file),'exec'),scope)
targets=scope['pieces']['static'];removed=[]
for o in list(targets):
    if o.name.startswith(('Hub inlay','Hub radial joint')):
        removed.append(o.name);targets.remove(o);bpy.data.objects.remove(o,do_unlink=True)
foundation=bpy.data.objects.get('Circular hub foundation');assert foundation
# Lower top without moving bottom; rod mesh uses a world transform.
inv=foundation.matrix_world.inverted()
for v in foundation.data.vertices:
    q=foundation.matrix_world@v.co;q.z=-.62+(q.z+.62)*(.58/.62);v.co=inv@q

rng=random.Random(20261024);image=bpy.data.images.new('Fire basalt subtle grain',256,256)
pixels=[]
def noise(x,y,scale):
    x/=scale;y/=scale;ix=math.floor(x);iy=math.floor(y);fx=x-ix;fy=y-iy
    fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy)
    def h(a,b):return ((a*374761393+b*668265263+12345)^((a+b)*1274126177))%65536/65535-.5
    return (h(ix,iy)*(1-fx)+h(ix+1,iy)*fx)*(1-fy)+(h(ix,iy+1)*(1-fx)+h(ix+1,iy+1)*fx)*fy
for y in range(256):
    for x in range(256):
        grain=.35+.035*noise(x,y,33)+.018*noise(x,y,9)+rng.uniform(-.009,.009)
        pixels.extend([grain*.91,grain*.96,grain,1])
image.pixels=pixels;image.filepath_raw=str(OUT/'basalt-grain.png');image.file_format='PNG';image.save();image.pack()
mats=[]
for i,f in enumerate([.90]):
    m=bpy.data.materials.new('Quiet basalt '+str(i));m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Roughness'].default_value=.88;t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=image
    m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color']);m.diffuse_color=(f*.24,f*.26,f*.28,1);mats.append(m)

# Convex polygon clipping makes the paving follow the actual 96-sided hub edge.
def clip(poly,nx,ny,d):
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da=nx*a[0]+ny*a[1]-d;db=nx*b[0]+ny*b[1]-d
        if da<=0:out.append(a)
        if (da<0)!=(db<0):
            t=da/(da-db);out.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
    return out
tiles=[]
for row in range(-7,7):
    for col in range(-6,6):
        x=col*2.4+(1.2 if row%2 else 0);z=row*1.8
        poly=[(x+.01,z+.01),(x+2.39,z+.01),(x+2.39,z+1.79),(x+.01,z+1.79)]
        for k in range(96):
            a=(k+.5)*math.tau/96;poly=clip(poly,math.cos(a),math.sin(a),11.99*math.cos(math.pi/96))
            if len(poly)<3:break
        if len(poly)<3:continue
        n=len(poly);verts=[(a,-b,h) for h in [-.09,0] for a,b in poly]
        faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        me=bpy.data.meshes.new('Hub cut basalt');me.from_pydata(verts,[],faces);me.update()
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
        o=bpy.data.objects.new('Hub cut basalt',me);bpy.context.collection.objects.link(o);o.data.materials.append(mats[0])
        # Explicit world UVs keep texture scale constant on clipped boundary stones.
        uv=me.uv_layers.new()
        for loop in me.loops:
            v=me.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(v.x*.4,v.y*.4)
        mod=o.modifiers.new('Grounded worn edge','BEVEL');mod.width=.008;mod.segments=1
        targets.append(o);tiles.append(o)
assert len(removed)==28 and len(tiles)>90
metrics['hub']={'removed':removed,'tiles':len(tiles),'walkY':0,'foundationBottom':-.62,'foundationTop':-.04,'radius':12}
export_static(targets,'fracture-static-v02')

bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/fire-temple/sanctum-v01/sanctum-v01.blend'))
targets=[];removed=[]
for o in list(bpy.context.scene.objects):
    if o.type not in ['MESH','CURVE']:continue
    if o.name.startswith(('Sanctum radial floor inlay','Floor radial engraving')):
        removed.append(o.name);bpy.data.objects.remove(o,do_unlink=True);continue
    points=[o.matrix_world@Vector(v) for v in o.bound_box]
    z=-sum(v.y for v in points)/len(points)
    if z<-40:targets.append(o)
assert len(removed)==27
metrics['sanctum']={'removed':removed,'walkY':3.2}
export_static(targets,'sanctum-static-v02')
(OUT/'metrics.json').write_text(json.dumps(metrics,indent=2))
print('FIRE_PAVING_READY',json.dumps(metrics),flush=True)
