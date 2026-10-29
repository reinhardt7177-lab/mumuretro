"""Rebuild a preserved v01 design recipe into independent editable v02 sculpture."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parent.parent
A=ROOT/'art/chronicle-guardian/v02';A.mkdir(parents=True,exist_ok=True)
for name,source in [('stone-albedo.png','art/strata-inlays/v01/limestone-albedo.png'),('stone-normal.png','art/moon-courts/v01/stone-normal.png')]:shutil.copyfile(ROOT/source,A/name)
source=(ROOT/'tools/blender/build_chronicle_guardian_v01.py').read_text(encoding='utf-8-sig')
def change(old,new):
 global source
 assert old in source,old[:100]
 source=source.replace(old,new)
change("ROOT=Path(__file__).resolve().parents[2];ART=ROOT/'art/chronicle-temple/v01';OUT=ROOT/'assets/models/chronicle-temple'","ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/chronicle-guardian/v02';OUT=ART")
change("(.105,.09,.135),.08,.77","(.135,.145,.18),.04,.88")
change("(.036,.044,.064),.1,.72","(.046,.061,.075),.04,.90")
change("(.19,.16,.16),.15,.68","(.19,.18,.165),.04,.86")
change("(.39,.245,.10),.72,.36","(.39,.285,.15),.65,.52")
change("(.61,.41,.19),.7,.37","(.55,.39,.21),.65,.48")
change("m.node_tree.links.new(a.outputs['Color'],p.inputs['Base Color'])","""tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ART/'stone-albedo.png'),check_existing=True)
  mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;m.node_tree.links.new(a.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[2]);m.node_tree.links.new(mix.outputs[0],p.inputs['Base Color'])
  norm=m.node_tree.nodes.new('ShaderNodeTexImage');norm.image=bpy.data.images.load(str(ART/'stone-normal.png'),check_existing=True);norm.image.colorspace_settings.name='Non-Color';nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.20;m.node_tree.links.new(norm.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])""")
change('bmesh.ops.recalc_face_normals(b,faces=b.faces);b.to_mesh(d);','bmesh.ops.remove_doubles(b,verts=list(b.verts),dist=.00001);bmesh.ops.recalc_face_normals(b,faces=b.faces);b.to_mesh(d);')
change('def ell(n,p,s,m):\n bpy.ops.mesh.primitive_uv_sphere_add',"""def ell(n,p,s,m):
 if n=='Inset quiet constellation':
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=V(p));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return add(o,n,m)
 bpy.ops.mesh.primitive_uv_sphere_add""")
change('d.bevel_resolution=2','d.bevel_resolution=1')
old=""" ell('Carved resting foot',(side*2.1,1.15,3.08),(.7,.18,1.0),stone)
 for j in range(4):tube('Stone toe separation',[(side*2.1+(j-1.5)*.17,1.27,3.5),(side*2.1+(j-1.5)*.17,1.22,3.91)],.012,dark)"""
new=""" foot_parts=[ell('Sculpted foot instep',(side*2.1,1.20,3.30),(.64,.22,.75),stone)]
 for j in range(5):
  x=side*2.1+side*(j-2)*.225;z=4.00-.035*j
  foot_parts.append(ell('Separated carved toe '+str(j),(x,1.16,z),(.145-.008*j,.17-.008*j,.27-.018*j),stone))
 bpy.ops.object.select_all(action='DESELECT')
 for o in foot_parts:o.select_set(True);parts[group].remove(o)
 foot=foot_parts[0];bpy.context.view_layer.objects.active=foot;bpy.ops.object.join();foot.name='Unified carved foot';parts[group].append(foot)
 remesh=foot.modifiers.new('Joined instep and toes','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.035;bpy.ops.object.modifier_apply(modifier=remesh.name)
 soften=foot.modifiers.new('Sculpted transitions','SMOOTH');soften.factor=.5;soften.iterations=3;bpy.ops.object.modifier_apply(modifier=soften.name)
 decimate=foot.modifiers.new('Web foot reduction','DECIMATE');decimate.ratio=.32;bpy.ops.object.modifier_apply(modifier=decimate.name);smooth(foot)
 # Ground the unified carving on the unchanged dais top, after remeshing.
 lowest=min((foot.matrix_world@v.co).z for v in foot.data.vertices);foot.location.z+=.98-lowest"""
change(old,new)
start=source.index('def interp(');end=source.index('def robe(',start)
source=source[:start]+"""def interp(t,values):
 x=t*(len(values)-1);i=min(len(values)-2,int(x));u=x-i;p0=values[max(0,i-1)];p1=values[i];p2=values[i+1];p3=values[min(len(values)-1,i+2)]
 m1=(p2-p0)/2 if i else p2-p1;m2=(p3-p1)/2 if i+2<len(values) else p2-p1
 return (2*u**3-3*u*u+1)*p1+(u**3-2*u*u+u)*m1+(-2*u**3+3*u*u)*p2+(u**3-u*u)*m2
"""+source[end:]
change('fold=(.13-.055*t)*math.cos(26*a+.65*t)','fold=(.17-.075*t)*math.cos(12*a+.45*t)+.025*math.cos(25*a-.3*t)')
change("robe,144,72,stone,.075","robe,128,48,stone,.075")
change('for i in range(22):\n a=(i+.5)/22;','for i in range(12):\n a=(i+.5)/12;')
start=source.index(' for j in range(8):');end=source.index('for y,z in [(2.0',start)
source=source[:start]+""" def drape(u,t,side=side):
  span=1.72-.48*t;centre=2.75+.08*math.sin(math.pi*t)
  x=side*(centre+(u-.5)*span);y=1.50+3.40*t+.055*math.sin(math.pi*u)*(1-t)
  z=3.12+.08*math.cos(math.pi*t)+(.12-.03*t)*math.cos(u*math.pi*8)+.06*math.sin(math.pi*t)
  return x,y,z
 surface('Continuous sleeve-to-dais drape',drape,48,36,stone,.055)
 for u in [0,1]:tube('Drape stitched border',[drape(u,k/48)for k in range(49)],.017,bronze)
"""+source[end:]
change('hood,120,40,stone,.13','hood,96,32,stone,.13')
change('),100,20,void)', '),72,16,void)')
change('n=.88+.08*math.sin(p.z*5.4+.9*math.sin(p.x*2))+.035*math.sin(p.x*79+p.y*53+p.z*61)','n=.96+.025*math.sin(p.z*.8+.9*math.sin(p.x*.6))+.012*math.sin(p.x*17+p.y*13+p.z*19)')
change("if d.materials[0].get('stoneTint'):","""if d.materials[0].get('stoneTint'):
   uv=d.uv_layers.active or d.uv_layers.new(name='SculptureStoneUV')
   for face in d.polygons:
    axis=max(range(3),key=lambda k:abs(face.normal[k]));axes=[k for k in range(3)if k!=axis]
    for li in face.loop_indices:
     wp=o.matrix_world@d.vertices[d.loops[li].vertex_index].co;uv.data[li].uv=(wp[axes[0]]/1.7,wp[axes[1]]/1.7)""")
change("OUT/'guardian-v01.glb'","OUT/'preview.glb'")
change("{'version':1,'metrics':metric","{'version':2,'metrics':metric")
change("ART/'chronicle-guardian-v01.blend'","ART/'chronicle-guardian-v02.blend'")
change("scene['reference']='guardian-reference.png'","bpy.ops.file.make_paths_relative();bpy.ops.file.pack_all();scene['reference']='../../chronicle-temple/v01/guardian-reference.png'")
exec(compile(source,str(Path(__file__)),'exec'))
# Blender exports a neutral active color as COLOR_0 and the explicitly named
# multiplied StoneTint as COLOR_1. Three r160 reads COLOR_0. Point that standard
# semantic at the authored color accessor; leave geometry/image buffers intact.
import json,struct,hashlib
file=A/'preview.glb';raw=file.read_bytes();length=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+length]);tail=raw[20+length:];mapped=[]
for mesh in data['meshes']:
 for p in mesh['primitives']:
  mat=data['materials'][p['material']]
  if 'basalt' in mat['name'] or 'strata' in mat['name']:
   assert 'COLOR_1' in p['attributes'] and 'baseColorTexture' in mat['pbrMetallicRoughness'] and 'normalTexture' in mat
   p['attributes']['COLOR_0']=p['attributes'].pop('COLOR_1');mapped.append(mat['name'])
assert len(mapped)==3
encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);file.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
(A/'color-export.json').write_text(json.dumps({'pass':True,'mapped':mapped,'binaryChunkUnchanged':True,'binaryChunkSha256':hashlib.sha256(tail).hexdigest(),'glbBytes':file.stat().st_size},indent=2))
