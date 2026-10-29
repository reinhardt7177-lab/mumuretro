"""Blender 5.2: authored fractured granite kit. Originals stay in art/.

Run: blender --background --python tools/build-adventure-rocks.py
No external service, reference assets or add-ons. Coordinates exported as glTF Y-up.
"""
import bpy, json, math, random
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/adventure-direction/v02/rocks'
OUT = ROOT / 'assets/models/adventure'
ART.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.world.color = (.32, .38, .45)

# Periodic granite grain and sparse feldspar/lichen. Image pixels are exported,
# rather than relying on Blender procedural nodes unsupported by glTF.
size = 512
rng = np.random.default_rng(221022)
yy, xx = np.mgrid[0:size, 0:size] / size
def noise_grid(n):
    grid = rng.random((n, n))
    x, y = xx*n, yy*n
    ix, iy = x.astype(int), y.astype(int)
    sx, sy = x-ix, y-iy
    sx, sy = sx*sx*(3-2*sx), sy*sy*(3-2*sy)
    return (grid[iy % n, ix % n]*(1-sx)*(1-sy) + grid[iy % n, (ix+1) % n]*sx*(1-sy)
            + grid[(iy+1) % n, ix % n]*(1-sx)*sy + grid[(iy+1) % n, (ix+1) % n]*sx*sy)
coarse = noise_grid(12)
grain = noise_grid(180)
fine = rng.random((size, size))
rgb = np.clip(.58 + (coarse-.5)*.19 + (grain-.5)*.22 + (fine-.5)*.10, 0, 1)[..., None] * np.array([1.01, 1, .94])
quartz = grain > .85
rgb[quartz] = rgb[quartz]*.5 + np.array([.85, .85, .78])*.5
lichen = (noise_grid(27) > .76) & (coarse > .54)
rgb[lichen] = rgb[lichen]*.4 + np.array([.44, .49, .28])*.6
pixels = np.concatenate((rgb, np.ones((size, size, 1))), axis=2).astype(np.float32)
image = bpy.data.images.new('Granite_Albedo_512', width=size, height=size)
image.pixels.foreach_set(pixels.ravel())
image.filepath_raw = str(ART / 'granite-albedo.png')
image.file_format = 'PNG'
image.save()
image.pack()
mat = bpy.data.materials.new('Fractured_granite')
mat.use_nodes = True
nodes = mat.node_tree.nodes
bsdf = nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .92
tex = nodes.new('ShaderNodeTexImage'); tex.image = image
vc = nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'MineralTint'
mix = nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1
mat.node_tree.links.new(tex.outputs['Color'], mix.inputs[1])
mat.node_tree.links.new(vc.outputs['Color'], mix.inputs[2])
mat.node_tree.links.new(mix.outputs[0], bsdf.inputs['Base Color'])

kit = []
metrics = []
for index, (height, width, depth) in enumerate([(.7, 1.55, 1.10), (1.3, 2.15, 1.60), (2.1, 2.75, 2.05)]):
    rnd = random.Random(3200 + index*31)
    count = 16
    # Continuous vertex columns keep fractures watertight. Each layer is offset
    # along a slanted fault, without disconnected piled rings.
    levels = [(0,.80),(.12,1),(.36,.98),(.39,.91),(.64,.87),(.68,.82),(.94,.67),(1,.55)]
    angles = [(j/count*math.tau+rnd.uniform(-.045,.045)) for j in range(count)]
    radii = [rnd.uniform(.88,1.12) for _ in range(count)]
    vertices, faces = [], []
    for k, (z, radius) in enumerate(levels):
        for j, a in enumerate(angles):
            # Superellipse faces make broad chisel planes, not smooth spheres.
            c, s = math.cos(a), math.sin(a)
            x = math.copysign(abs(c)**.73, c)*width*.5*radius*radii[j]
            y = math.copysign(abs(s)**.78, s)*depth*.5*radius*radii[j]
            x += (z-.4)*width*.13 + math.sin(z*6+index)*.035
            y += z*depth*.09
            zz = z*height
            if k not in [0, len(levels)-1]: zz += math.sin(a*2.0+index)*height*.025
            vertices.append((x,y,zz))
    for k in range(len(levels)-1):
        for j in range(count):
            a=k*count+j; b=k*count+(j+1)%count
            faces.append((a,b,b+count,a+count))
    faces.append(tuple(reversed(range(count))))
    faces.append(tuple((len(levels)-1)*count+j for j in range(count)))
    mesh = bpy.data.meshes.new('FractureMesh_'+str(index))
    mesh.from_pydata(vertices, [], faces); mesh.update()
    ob = bpy.data.objects.new('granite_'+str(index), mesh)
    scene.collection.objects.link(ob); kit.append(ob)
    ob.data.materials.append(mat)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bevel = ob.modifiers.new('Small chipped edges', 'BEVEL')
    bevel.width = .012 * (height/.7)**.35
    bevel.segments = 1; bevel.limit_method = 'ANGLE'; bevel.angle_limit = .42
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    # Triangulate before measurements so the exported budget is exact.
    tri = ob.modifiers.new('Web triangles', 'TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=tri.name)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.05, island_margin=.025)
    bpy.ops.object.mode_set(mode='OBJECT')
    color = ob.data.color_attributes.new(name='MineralTint', type='FLOAT_COLOR', domain='CORNER')
    for polygon in ob.data.polygons:
        for li in polygon.loop_indices:
            p = ob.data.vertices[ob.data.loops[li].vertex_index].co
            band = .96 + .08*math.sin(p.z*20/height + p.x*1.7)
            tint = band * (.87 + .13*(p.z/height))
            color.data[li].color = (tint, tint, tint*.98, 1)
    # Origin is kept on the bottom plane; no runtime normalization scale needed.
    coords = [v.co for v in ob.data.vertices]
    bottom = min(v.z for v in coords)
    for v in ob.data.vertices: v.co.z -= bottom
    dims = [max(v[i] for v in coords)-min(v[i] for v in coords) for i in range(3)]
    # Bevel changes height slightly. Normalize exactly to authored height.
    for v in ob.data.vertices: v.co.z *= height / dims[2]
    ob['authored_height_m'] = height
    ob['ground_axis_blender'] = 'Z=0, glTF Y=0'
    metrics.append({'name': ob.name, 'height': height, 'bottom': min(v.co.z for v in ob.data.vertices),
                    'width': dims[0], 'depth': dims[1], 'triangles': len(ob.data.polygons),
                    'materials': len(ob.data.materials), 'vertices': len(ob.data.vertices)})
    ob.select_set(False)

# Kit exports at its real ground origin. Presentation translation is Blender-only.
for ob in kit: ob.select_set(True)
bpy.context.view_layer.objects.active=kit[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'granite-kit-v02.glb'), export_format='GLB', use_selection=True,
    export_apply=True, export_yup=True, export_extras=True, export_normals=True,
    export_vertex_color='NAME', export_vertex_color_name='MineralTint', export_all_vertex_colors=False, export_materials='EXPORT')
for i, ob in enumerate(kit): ob.select_set(False); ob.location.x = (i-1)*3.7

floor_mat=bpy.data.materials.new('Inspection floor'); floor_mat.diffuse_color=(.20,.24,.21,1)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.008))
bpy.context.object.name='Inspection floor only'; bpy.context.object.data.materials.append(floor_mat)
bpy.ops.object.light_add(type='AREA', location=(1,-5,9)); bpy.context.object.data.energy=1800; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=6
bpy.ops.object.light_add(type='AREA', location=(-4,3,6)); bpy.context.object.data.energy=750; bpy.context.object.data.size=5
bpy.ops.object.camera_add(location=(7,-11,6.3)); camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,.8))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=13.5; scene.camera=camera
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(ART/'kit-review.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'granite-kit-v02.blend'))
bpy.ops.render.render(write_still=True)
(ART/'metrics.json').write_text(json.dumps({'units':'metres','export':'assets/models/adventure/granite-kit-v02.glb','texture':{'size':[512,512],'embedded':True},'parts':metrics},indent=2))
print('ADVENTURE_KIT',json.dumps(metrics))
