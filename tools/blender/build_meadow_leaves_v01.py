"""Author curved, folded grass blades in Blender and export the evaluated meshes.

Unity consumes leaf-profiles.json; FBX and .blend remain editable art sources.
Local export basis: Blender (x,y,z) -> Unity (x,z,-y), winding reversed once.
"""
import bpy, json, math, os
from mathutils import Vector

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
ART=os.path.join(ROOT, 'art/meadow-leaves')
OUT=os.path.join(ROOT, 'unity/MumuPlanet/Assets/Mumu/Models/Meadow')
os.makedirs(ART, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

material=bpy.data.materials.new('Soft meadow leaf')
material.diffuse_color=(.14,.29,.055,1)
material.use_nodes=True
bsdf=material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value=material.diffuse_color
bsdf.inputs['Roughness'].default_value=.78

profiles=[]
for index,(lean,droop,twist) in enumerate([(.36,.82,.16),(.48,.69,-.22),(.28,.88,.28),(.42,.75,-.12)]):
    # Six cross sections with a shallow V fold, then a tiny tapered tip.
    # The lateral profile swells gently after the root; never a broad triangle.
    verts=[]; weights=[]; faces=[]
    samples=[0,.18,.37,.57,.76,.91]
    p0=Vector((0,0,0));p1=Vector((0,0,.42));p2=Vector((twist*.08,lean*.3,1.12));p3=Vector((twist*.12,lean,droop))
    for row,t in enumerate(samples):
        centre=(1-t)**3*p0+3*(1-t)**2*t*p1+3*(1-t)*t*t*p2+t**3*p3
        width=.021*(.24+.76*math.sin(math.pi*t)**.72)*(1-t*.7)
        angle=twist*t
        lateral=Vector((math.cos(angle),math.sin(angle),0))
        for side in [-1,0,1]:
            point=centre+lateral*(side*width)
            # centre ridge; smooth normals preserve the fold without harsh facets.
            if side==0:point.y-=width*.23
            verts.append(tuple(point));weights.append(t)
        if row:
            a=(row-1)*3;b=row*3
            faces.extend([(a,a+1,b+1,b),(a+1,a+2,b+2,b+1)])
    verts.append(tuple(p3));weights.append(1)
    last=(len(samples)-1)*3;tip=len(verts)-1
    faces.extend([(last,last+1,tip),(last+1,last+2,tip)])
    mesh=bpy.data.meshes.new('Leaf_profile_%02d'%index)
    mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(mesh.name,mesh);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    for face in mesh.polygons:face.use_smooth=True
    attr=mesh.attributes.new('root_to_tip','FLOAT','POINT')
    for item,value in zip(attr.data,weights):item.value=value
    # Display the variants side by side without baking this layout into exports.
    obj.location.x=(index-1.5)*.35
    mesh.calc_loop_triangles()
    positions=[];normals=[];indices=[]
    for vertex in mesh.vertices:
        p=vertex.co;n=vertex.normal
        positions.extend([p.x,p.z,-p.y]);normals.extend([n.x,n.z,-n.y])
    for triangle in mesh.loop_triangles:indices.extend(reversed(triangle.vertices))
    profiles.append(dict(name=obj.name,positions=positions,normals=normals,weights=weights,indices=indices))

with open(os.path.join(OUT,'leaf-profiles.json'),'w',encoding='utf8') as stream:
    json.dump(dict(version=1,source='art/meadow-leaves/meadow-leaves-v01.blend',profiles=profiles),stream,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,'meadow-leaves-v01.blend'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT,'meadow-leaves-v01.fbx'),use_selection=True,
    object_types={'MESH'},axis_forward='-Z',axis_up='Y',bake_anim=False,path_mode='STRIP')
print('MUMU_BLENDER_LEAVES',len(profiles),'profiles',len(profiles[0]['weights']),'vertices per leaf')
