import bpy,os,math
from mathutils import Vector
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(n,c,metal=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.6;return m
leather=mat('Cognac leather',(.22,.095,.035));gold=mat('Satin brass',(.65,.4,.12),.65);paper=mat('Ivory pages',(.8,.72,.54));glass=mat('Blue lens',(.025,.2,.29),.35)
def group(n):o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);return o
def cube(n,p,s,m,parent):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=n;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);be=o.modifiers.new('Rounded leather edges','BEVEL');be.width=.006;be.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=be.name);o.data.materials.append(m);o.parent=parent;return o
book=group('notebook');cube('Pages',(0,0,0),(.135,.034,.19),paper,book)
for y in [-.024,.024]:cube('Cover',(0,y,0),(.15,.012,.205),leather,book)
cube('Spine',(-.072,0,0),(.012,.06,.205),leather,book);cube('Clasp',(.035,-.034,0),(.027,.013,.065),gold,book)
for x in [-.057,.057]:
 for z in [-.08,.08]:cube('Corner',(x,-.033,z),(.016,.006,.016),gold,book)
for a in range(4):
 o=cube('Star',(-.013,-.034,.02),(.009,.005,.071),gold,book);o.rotation_euler.y=a*math.pi/4
telescope=group('telescope')
for i,(r,h,z,m) in enumerate([(.027,.16,0,leather),(.033,.025,.085,gold),(.034,.022,-.085,gold),(.023,.07,.115,gold),(.021,.006,.152,glass)]):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=h,location=(.4,0,z));o=bpy.context.object;o.name='Telescope section';o.data.materials.append(m);o.parent=telescope
telescope.location.x=-.4
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root,'art/sky-navigator/navigator-props-v01.blend'))
os.makedirs(os.path.join(root,'assets/characters/sky-navigator'),exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(root,'assets/characters/sky-navigator/props-v01.glb'),export_format='GLB')
