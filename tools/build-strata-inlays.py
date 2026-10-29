"""Replace debug-like rings/links with numbered limestone and bronze inlays."""
import bpy,bmesh,math,json,ast,sys,numpy as np
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import export_parts
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/strata-inlays/v01';ART.mkdir(parents=True,exist_ok=True);V=lambda p:Vector((p[0],-p[2],p[1]))
BEFORE=json.loads((ROOT/'reports/2026-10-24/evidence/strata-inlays/before/report.json').read_text());C=BEFORE['contract']
palette={'stone0':[.29,.31,.31],'stone1':[.36,.38,.37],'stone2':[.43,.44,.41],'stone3':[.50,.50,.45],'pale':[.66,.62,.51],'recess':[.10,.13,.14],'brass':[.46,.34,.17],'signal':[.42,.34,.21],'floor':[.46,.46,.41],'floorAlt':[.41,.42,.39],'glyph':[.83,.77,.62]}
SPEC={'model':'assets/models/adventure/strata-inlays-v01.glb','palette':palette,'parts':{},'contract':C,'markerRadius':.93,'markerFloor':.061,'scope':'User-directed removal of purple rings/air links and woodlike wall; same puzzle and lifting dimensions','budget':{'triangles':35000,'bytes':3000000}}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;M={};parts={};solids=[]
# Isotropic fine mottling: no directional grain or painted sediment stripes.
n=512;yy,xx=np.mgrid[0:n,0:n];height=np.zeros((n,n),dtype=np.float32);rng=np.random.default_rng(24)
for k in range(18):
 angle=k*2.399963;f=2**(k%6+1)*2*math.pi/n;phase=rng.random()*6.283;height+=np.sin((xx*math.cos(angle)+yy*math.sin(angle))*f+phase)/(1+k%6)
height=(height-height.mean())/(height.std()+1e-6);height=np.clip(height,-2.2,2.2);tone=.66+height*.035+rng.normal(0,.012,(n,n));rgba=np.ones((n,n,4),dtype=np.float32)
for channel,factor in enumerate([1.0,.995,.97]):rgba[:,:,channel]=np.clip(tone*factor,0,1)
images={}
for name,data in [('limestone-albedo',rgba)]:
 im=bpy.data.images.new(name,n,n);im.pixels.foreach_set(data.ravel());im.filepath_raw=str(ART/(name+'.png'));im.file_format='PNG';im.save();images[name]=im
gy,gx=np.gradient(height);normal=np.stack([-gx*.18,-gy*.18,np.ones_like(gx)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True);rgba[:,:,:3]=normal*.5+.5
im=bpy.data.images.new('limestone-normal',n,n);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(rgba.ravel());im.filepath_raw=str(ART/'limestone-normal.png');im.file_format='PNG';im.save();images['limestone-normal']=im
for key,c in palette.items():
 m=bpy.data.materials.new('Inlay '+key);m.diffuse_color=(*c,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.38 if key in ['brass','signal'] else .88;bs.inputs['Metallic'].default_value=.58 if key in ['brass','signal'] else 0
 if key.startswith('stone') or key in ['floor','floorAlt','pale']:
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=images['limestone-albedo'];mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*c,1);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color']);texn=m.node_tree.nodes.new('ShaderNodeTexImage');texn.image=images['limestone-normal'];nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.18;m.node_tree.links.new(texn.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
 M[key]=m
tree=ast.parse((ROOT/'tools/build-moon-courts.py').read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name in ['group','finish','box','poly']],type_ignores=[]),'<masonry>','exec'))
def begin(name,datum):
 global solids
 solids=[];p=group(name);SPEC['parts'][name]={'datum':datum,'solids':solids};return p
def cylinder(name,pos,r,h,key,parent,vertical=True,n=48):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=h,location=V(pos));o=bpy.context.object
 if not vertical:o.rotation_euler.x=math.pi/2
 bevel=o.modifiers.new('Rounded stone rim','BEVEL');bevel.width=min(.009,h*.22);bevel.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name);return finish(o,name,key,parent)
def torus(name,pos,r,t,key,parent,vertical=True):
 bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=8,major_radius=r,minor_radius=t,location=V(pos));o=bpy.context.object
 if not vertical:o.rotation_euler.x=math.pi/2
 return finish(o,name,key,parent)
font=bpy.data.fonts.load('C:/Windows/Fonts/arialbd.ttf')
def number(value,pos,size,key,parent,wall=False):
 bpy.ops.object.text_add(location=V(pos));o=bpy.context.object;o.data.body=str(value);o.data.font=font;o.data.size=size;o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.resolution_u=4;o.data.extrude=.004;o.data.bevel_depth=.001;o.data.bevel_resolution=1
 if wall:o.rotation_euler.x=math.pi/2
 bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,'Raised layer numeral '+str(value),key,parent)
wall=begin('LayerWall',0)
box('Continuous stone backing',[0,2.48,-.105],[8.8,4.96,.10],'stone0',wall,0)
boundaries=[0,1.525,2.675,3.825,4.96]
for layer in range(4):
 low,high=boundaries[layer:layer+2];y=(low+high)/2
 # Staggered joints away from the central socket; stone relief catches light.
 cuts=[-4.4,-1.6+(layer%2)*.35,1.5-(layer%2)*.25,4.4]
 for j in range(3):box('Broad carved limestone layer',[(cuts[j]+cuts[j+1])/2,y,0],[cuts[j+1]-cuts[j]-.012,high-low-.014,.32],'stone'+str(layer),wall,.022)
 for x in[-4.18,4.18]:
  box('Bronze layer keeper',[x,C['slots'][layer]['y'],.19],[.11,.24,.035],'brass',wall,.007)
  for dy in[-.07,.07]:cylinder('Keeper rivet',[x,C['slots'][layer]['y']+dy,.216],.022,.02,'recess',wall,False,12)
for x in[-4.34,4.34]:box('Moving carrier edge',[x,2.48,.19],[.05,4.90,.025],'brass',wall,.005)
for x in[-4.28,4.28]:box('Hoist anchor',[x,4.70,.28],[.14,.14,.10],'brass',wall,.008)
# Preserve exact moving-wall bounds and the grounded lower edge.
box('Grounded bottom sill',[0,.04,0],[8.8,.08,.30],'stone0',wall,.008)
box('Wall upper cap',[0,4.93,0],[8.8,.06,.30],'stone3',wall,.008)
socket=begin('WallSocket','centre')
cylinder('Recessed dark socket',[0,0,-.037],.475,.025,'recess',socket,False)
torus('Broad stone socket bevel',[0,0,-.005],.535,.045,'pale',socket,False)
torus('Thin inset bronze lip',[0,0,.026],.485,.013,'brass',socket,False)
for side in[-1,1]:
 for y in[-.36,.36]:cylinder('Collar keeper pin',[side*.36,y,.041],.025,.016,'brass',socket,False,12)
for layer in range(4):
 p=begin('WallBadge'+str(layer+1),'centre');box('Layer number stone plaque',[0,0,0],[.30,.34,.07],'pale',p,.025);number(layer+1,[0,0,.04],.27,'recess',p,True)
 p=begin('FloorMarker'+str(layer+1),0)
 cylinder('Low chamfered marker footing',[0,.021,0],.93,.042,'pale',p,True,32)
 cylinder('Inset slate walking face',[0,.045,0],.835,.032,'recess',p,True,48)
 torus('Fine bronze marker rim',[0,.051,0],.867,.012,'brass',p)
 torus('Narrow state inlay',[0,.062,0],.79,.008,'signal',p)
 number(layer+1,[0,.062,-.04],.70,'glyph',p)
 for sign in[-1,1]:box('Inlaid side rule',[sign*.49,.064,-.04],[.018,.006,.42],'brass',p,.002)
floor=begin('ForecourtFloor','top:0')
length=C['seg']['z1']-C['seg']['z0']
for iz in range(8):
 for ix in range(5):box('Wide limestone paving',[(ix-2)*2,-.06,-length/2+(iz+.5)*length/8],[1.975,.12,length/8-.025],'floorAlt' if (ix*3+iz)%6==0 else 'floor',floor,.007)
SPEC['parts']['LayerWall'].update({'height':4.96,'halfWidth':4.4,'halfDepth':.33})
originals=[o for p in parts.values() for o in p.children];metrics=export_parts(list(parts),SPEC,ART,'strata-inlays-v01','Inlay ');exports=[o for p in parts.values() for o in p.children if o not in originals]
assert metrics['glbBytes']<SPEC['budget']['bytes'] and sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))<SPEC['budget']['triangles']
for p in parts.values():
 for o in p.children:o.hide_render=True
instances=[]
def instance(name,pos):
 root=bpy.data.objects.new('Goal '+name,None);scene.collection.objects.link(root);root.location=V(pos);instances.append(root)
 for o in parts[name].children:
  if o in exports:c=o.copy();c.data=o.data;scene.collection.objects.link(c);c.parent=root;c.hide_render=False
 return root
instance('LayerWall',[0,0,C['wallZ']]);instance('ForecourtFloor',[0,0,(C['seg']['z0']+C['seg']['z1'])/2])
for i,m in enumerate(C['marks']):
 instance('FloorMarker'+str(i+1),[m['x'],0,m['z']]);instance('WallSocket',[0,C['slots'][i]['y'],C['wallZ']+.245]);instance('WallBadge'+str(i+1),[.88,C['slots'][i]['y'],C['wallZ']+.20])
# Reuse the actual hoist frame rather than inventing a different goal frame.
before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/adventure/chronicle-portal-v01.glb'));context=list(set(scene.objects)-before)
for o in context:
 if o.type=='MESH':o.hide_render=True
frame=next(o for o in context if o.name=='PortalFrame');frame.location=V([0,0,C['wallZ']])
for o in frame.children:
 o.hide_render=False
 if o.active_material and 'brass' not in o.active_material.name:o.data.materials.clear();o.data.materials.append(M['stone1'])
scene.world=bpy.data.worlds.new('Limestone inlay studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.25,.28,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
for pos,power,size in[([-5,10,C['wallZ']+8],2600,8),([7,7,C['wallZ']-4],2000,9)]:
 bpy.ops.object.light_add(type='AREA',location=V(pos));o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(V([0,2,C['wallZ']])-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.view_settings.view_transform='AgX'
for shot in BEFORE['shots']:
 cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
(ART/'goal-cameras.json').write_text(json.dumps({'scope':'Blender inlay and floor targets with reused hoist frame; actor/core/background absent, not gameplay','shots':[{k:s[k] for k in ['id','camera','target','fov','aspect']} for s in BEFORE['shots']]},indent=2))
for root in instances:
 for o in list(root.children):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.objects.remove(root,do_unlink=True)
for o in context+exports:
 if o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
for i,p in enumerate(parts.values()):
 p.location=V([i*14,0,0])
 for o in p.children:o.hide_set(False);o.hide_render=False
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'strata-inlays-v01.blend'));print('PASS STRATA_INLAYS',metrics)
