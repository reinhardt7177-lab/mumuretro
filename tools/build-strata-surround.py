"""Editable, deterministic eroded mesa silhouettes for the distant time temple."""
import bpy, math, json, sys, numpy as np
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import export_parts
ROOT=Path(__file__).resolve().parent.parent
A=ROOT/'art/strata-surround/v01';A.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
palette={'rock':[.345,.424,.443],'face':[.40,.46,.46],'top':[.58,.61,.56]}
materials={}
n=256;yy,xx=np.mgrid[0:n,0:n];field=np.zeros((n,n),dtype=np.float32)
for k in range(1,15):
    a=k*2.39996;f=2**(k%5+1)*2*math.pi/n
    field+=np.sin(xx*math.cos(a)*f+yy*math.sin(a)*f+k*.73)/(1+k%5)
field/=field.std();rgba=np.ones((n,n,4),dtype=np.float32);rgba[:,:,:3]=np.clip(.87+field[:,:,None]*.045,.65,1)
images={}
for name in ['rock-grain','rock-normal']:
    if name=='rock-normal':
        gy,gx=np.gradient(field);normal=np.stack([-gx*.34,-gy*.34,np.ones_like(gx)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True);rgba[:,:,:3]=normal*.5+.5
    im=bpy.data.images.new(name,n,n)
    if name=='rock-normal':im.colorspace_settings.name='Non-Color'
    im.pixels.foreach_set(rgba.ravel());im.filepath_raw=str(A/(name+'.png'));im.file_format='PNG';im.save();images[name]=im
for name,color in palette.items():
    m=bpy.data.materials.new('Surround '+name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.95;materials[name]=m
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=images['rock-grain'];mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
    nt=m.node_tree.nodes.new('ShaderNodeTexImage');nt.image=images['rock-normal'];nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.45;m.node_tree.links.new(nt.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
def web(p):return (p[0],-p[2],p[1])
parts=[]
def cliff(name,seed,width,depth,height,offset,parent):
    n=96;vertices=[];faces=[]
    # Closely spaced changes create real ledges, never painted floating bands.
    profile=[(0,.20),(.14,.46),(.31,.70),(.46,.84),(.59,.86),(.73,.92),(.87,.96),(1,.83)]
    for j,(y,r) in enumerate(profile):
        for i in range(n):
            a=2*math.pi*i/n
            broad=1+.12*math.sin(3*a+seed)+.07*math.cos(5*a-seed*.6)
            fissure=.045*math.sin(13*a+seed)+.035*math.cos(19*a+seed*.5)
            taper=r*(broad+fissure*(.7+.3*math.sin(j*.8))+.045*math.sin(a*7+j*.72+seed))
            yy=y*height+(0 if j==0 else .65*math.sin(a*3+seed+j*.17)+.35*math.sin(a*7+seed)+.14*math.sin(a*13+j*.5))
            vertices.append(web((offset[0]+math.cos(a)*width*.5*taper,offset[1]+yy,offset[2]+math.sin(a)*depth*.5*taper)))
    for j in range(len(profile)-1):
        for i in range(n):
            q=j*n+i;next=j*n+(i+1)%n;faces.extend([(q,next,next+n),(q,next+n,q+n)])
    faces.append(tuple(reversed(range(n))))
    # Slightly broken top rather than a separate geometric cap hovering above.
    vertices.append(web((offset[0],offset[1]+height-.12,offset[2])));center=len(vertices)-1
    for i in range(n):faces.append(((len(profile)-1)*n+i,(len(profile)-1)*n+(i+1)%n,center))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(o);o.parent=parent
    uv=mesh.uv_layers.new(name='Rock surface')
    for face in mesh.polygons:
        ids=[mesh.loops[li].vertex_index for li in face.loop_indices];wrap=any(i%n==0 for i in ids) and any(i%n==n-1 for i in ids)
        for li in face.loop_indices:
            vi=mesh.loops[li].vertex_index;u=(vi%n)/n
            if wrap and u==0:u=1
            uv.data[li].uv=(u*2, (vi//n)/(len(profile)-1)*2)
    for m in materials.values():mesh.materials.append(m)
    for p in mesh.polygons:
        p.material_index=2 if p.index>=2*n*(len(profile)-1)+1 else (1 if (p.index//2)%n in [4,5,19,20,32,33] else 0)
    for p in mesh.polygons:p.use_smooth=True
    edge=o.modifiers.new("Keep cliff creases","EDGE_SPLIT");edge.split_angle=math.radians(38);edge.use_edge_angle=True
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=edge.name)
    return o
for i in range(3):
    name='ErodedMesa'+str(i+1);root=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(root);parts.append(name)
    h=[14,18,11][i];cliff('Continuous eroded mass',i*2.7+1, [26,18,32][i],[18,23,17][i],h,[0,0,0],root)
    # Attached weathered blocks, embedded in the top surface.
    # The irregular top is part of the same mass; no miniature repeated mesas.
placements=[
 {'part':parts[0],'position':[-62,-24,2],'scale':1.35,'yaw':.4},
 {'part':parts[1],'position':[66,-28,-12],'scale':1.35,'yaw':-.5},
 {'part':parts[2],'position':[-65,-18,-53],'scale':1.8,'yaw':.8},
 {'part':parts[0],'position':[66,-20,-66],'scale':1.65,'yaw':-1.1},
 {'part':parts[1],'position':[-48,-24,-115],'scale':1.65,'yaw':.2},
 {'part':parts[2],'position':[62,-18,-130],'scale':1.65,'yaw':-.3},
 {'part':parts[0],'position':[-62,-28,72],'scale':1.6,'yaw':1.2},
 {'part':parts[2],'position':[68,-23,65],'scale':1.5,'yaw':-.6}]
spec={'model':'art/strata-surround/v01/preview.glb','palette':palette,'parts':parts,'placements':placements,'railColor':0x927244,'minimumPlayableGap':20,'note':'Unreachable background geometry, local base y=0; no traversable ledges or added shadows.'}
editable={name:list(bpy.data.objects[name].children) for name in parts}
metrics=export_parts(parts,spec,A,'strata-surround-v01','Surround ')
assert metrics['glbBytes']<1000000
for name in parts:assert abs(metrics[name]['webMin'][1])<.001
print(json.dumps(metrics))

# Keep the saved editing scene legible: three independent, grounded variants.
# Runtime export above remains local-origin geometry; these are editing offsets.
for i,name in enumerate(parts):
    root=bpy.data.objects[name]
    for child in list(root.children):
        if child not in editable[name]:bpy.data.objects.remove(child,do_unlink=True)
    for child in editable[name]:child.hide_set(False);child.hide_render=False
    root.location.x=(i-1)*40
bpy.ops.object.camera_add(location=(70,-120,70));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,8))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=130;bpy.context.scene.camera=camera
bpy.ops.object.light_add(type='AREA',location=(10,-30,70));light=bpy.context.object;light.data.energy=2800;light.data.shape='DISK';light.data.size=70;light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.context.scene.world=bpy.data.worlds.new('Editing studio');bpy.context.scene.world.color=(.3,.3,.3)
bpy.ops.wm.save_as_mainfile(filepath=str(A/'strata-surround-v01.blend'))
