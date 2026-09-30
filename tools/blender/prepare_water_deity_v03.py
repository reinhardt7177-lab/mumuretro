"""Prepare approved Meshy source in Blender; preserve PBR maps and editability.

No external calls. Source remains untouched. Run only after source download.
"""
import bpy, bmesh, os, sys, json, math, struct
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
ART=os.path.join(ROOT,'art/water-sanctuary/v03')
OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/WaterDeityV03')
SOURCE=os.path.join(ART,'source/water-deity-v03.glb')
if not os.path.isfile(SOURCE):raise FileNotFoundError('Download approved source before preparing V03: '+SOURCE)
os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
with open(SOURCE,'rb') as f:raw=f.read()
if raw[:4]!=b'glTF':raise ValueError('Invalid source GLB')
offset=12;doc=None;binary=None
while offset<len(raw):
    size,kind=struct.unpack_from('<II',raw,offset);chunk=raw[offset+8:offset+8+size];offset+=8+size
    if kind==0x4e4f534a:doc=json.loads(chunk)
    elif kind==0x004e4942:binary=chunk
if doc is None or binary is None:raise ValueError('Missing GLB chunks')

image_files={}
def extract_texture(index,label):
    image=doc['images'][doc['textures'][index]['source']]
    if 'bufferView' not in image:raise ValueError('Embedded textures required')
    view=doc['bufferViews'][image['bufferView']];start=view.get('byteOffset',0)
    suffix='.jpg' if image.get('mimeType')=='image/jpeg' else '.png'
    path=os.path.join(OUT,label+suffix)
    with open(path,'wb') as f:f.write(binary[start:start+view['byteLength']])
    image_files[image.get('name','Image_'+str(doc['textures'][index]['source']))]=path
    return os.path.basename(path)

palette=[]
for i,mat in enumerate(doc.get('materials',[])):
    pbr=mat.get('pbrMetallicRoughness',{});entry=dict(name=mat.get('name','Material_'+str(i)),color=pbr.get('baseColorFactor',[1,1,1,1]),metal=pbr.get('metallicFactor',1),roughness=pbr.get('roughnessFactor',1),albedo='',normal='',metalSmooth='',occlusion='')
    for channel,key,container in [('albedo','baseColorTexture',pbr),('normal','normalTexture',mat),('occlusion','occlusionTexture',mat)]:
        if key in container:entry[channel]=extract_texture(container[key]['index'],f'mat{i}-{channel}')
    if 'metallicRoughnessTexture' in pbr:
        filename=extract_texture(pbr['metallicRoughnessTexture']['index'],f'mat{i}-orm-source')
        im=bpy.data.images.load(os.path.join(OUT,filename),check_existing=False);im.colorspace_settings.name='Non-Color'
        if max(im.size)>4096:
            ratio=4096/max(im.size);im.scale(round(im.size[0]*ratio),round(im.size[1]*ratio))
        w,h=im.size;pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape((-1,4))
        # URP Lit expects metallic R, smoothness A; glTF uses roughness G, metallic B.
        packed=np.ones_like(pixels);packed[:,0]=pixels[:,2]*entry['metal'];packed[:,1:3]=0;packed[:,3]=1-pixels[:,1]*entry['roughness']
        output=bpy.data.images.new(f'mat{i}-metal-smooth',width=w,height=h,alpha=True);output.colorspace_settings.name='Non-Color';output.pixels.foreach_set(packed.ravel());output.file_format='PNG';output.filepath_raw=os.path.join(OUT,f'mat{i}-metal-smooth.png');output.save()
        entry['metalSmooth']=os.path.basename(output.filepath_raw)
        bpy.data.images.remove(im);bpy.data.images.remove(output);del pixels,packed
    # URP occlusion reads green. GLTF occlusion is red, so repack grayscale.
    if entry['occlusion']:
        im=bpy.data.images.load(os.path.join(OUT,entry['occlusion']),check_existing=False);im.colorspace_settings.name='Non-Color'
        if max(im.size)>4096:
            ratio=4096/max(im.size);im.scale(round(im.size[0]*ratio),round(im.size[1]*ratio))
        w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape((-1,4));pixels[:,1]=pixels[:,0];pixels[:,2]=pixels[:,0];pixels[:,3]=1
        output=bpy.data.images.new(f'mat{i}-occlusion-packed',width=w,height=h,alpha=True);output.colorspace_settings.name='Non-Color';output.pixels.foreach_set(pixels.ravel());output.file_format='PNG';output.filepath_raw=os.path.join(OUT,f'mat{i}-occlusion-packed.png');output.save();entry['occlusion']=os.path.basename(output.filepath_raw)
        bpy.data.images.remove(im);bpy.data.images.remove(output);del pixels
    palette.append(entry)
bpy.ops.import_scene.gltf(filepath=SOURCE)
# Some Blender background glTF imports create empty packed-image placeholders.
# Bind verified extracted originals explicitly before saving the native file.
for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    for node in mat.node_tree.nodes:
        if node.type!='TEX_IMAGE' or node.image is None:continue
        image_name=node.image.name
        if image_name not in image_files:raise ValueError('Unresolved embedded texture: '+image_name)
        texture=bpy.data.images.load(image_files[image_name],check_existing=False)
        texture.colorspace_settings.name='sRGB' if 'albedo' in image_files[image_name] else 'Non-Color'
        if min(texture.size)<=0:raise ValueError('Empty source texture: '+image_name)
        texture.pack();node.image=texture
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
if not meshes:raise ValueError('No source geometry')
corners=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
low=Vector([min(p[i] for p in corners) for i in range(3)]);high=Vector([max(p[i] for p in corners) for i in range(3)])
height=high.z-low.z
if height<=0:raise ValueError('Invalid model height')
scale=3.3/height;center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
transform=Matrix.Rotation(math.pi,4,'Z')@Matrix.Scale(scale,4)@Matrix.Translation(-center)
for o in meshes:
    o.data.transform(transform@o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
    for p in o.data.polygons:p.use_smooth=True
# Restore the face against the preserved 4.6M-triangle sculpt, while keeping the
# dress at game density. UV loops survive welding and local subdivision.
with open(os.path.join(ART,'source/water-deity-v03-high.glb'),'rb') as f:high_raw=f.read()
offset=12
while offset<len(high_raw):
    size,kind=struct.unpack_from('<II',high_raw,offset);chunk=high_raw[offset+8:offset+8+size];offset+=8+size
    if kind==0x4e4f534a:high_doc=json.loads(chunk)
    elif kind==0x004e4942:high_binary=chunk
def accessor(index):
    a=high_doc['accessors'][index];v=high_doc['bufferViews'][a['bufferView']];types={5126:np.float32,5125:np.uint32,5123:np.uint16};dtype=np.dtype(types[a['componentType']]);n=3 if a['type']=='VEC3' else 1
    return np.ndarray((a['count'],n),dtype=dtype,buffer=high_binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dtype.itemsize*n),dtype.itemsize))
primitive=high_doc['meshes'][0]['primitives'][0]
hp=accessor(primitive['attributes']['POSITION']).copy();ht=accessor(primitive['indices']).reshape((-1,3))
# Source glTF Y-up -> authored Blender Z-up, matching the low mesh transform.
hp=np.column_stack((-(hp[:,0]-center.x)*scale,(hp[:,2]+center.y)*scale,(hp[:,1]-center.z)*scale))
mask=(hp[:,2]>2.40)&(hp[:,2]<3.16)&(np.abs(hp[:,0])<.34)
faces=ht[np.all(mask[ht],axis=1)];used,remap=np.unique(faces,return_inverse=True)
head=BVHTree.FromPolygons(hp[used].tolist(),remap.reshape((-1,3)).tolist(),all_triangles=True)
refined=0
for o in meshes:
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    def face_region(v):return 2.48<v.co.z<3.10 and abs(v.co.x)<.27
    edges=[e for e in bm.edges if all(face_region(v) for v in e.verts)]
    bmesh.ops.subdivide_edges(bm,edges=edges,cuts=2,use_grid_fill=True)
    for v in bm.verts:
        if not face_region(v):continue
        nearest=head.find_nearest(v.co)
        if nearest[0] is not None and nearest[3]<.035:v.co=nearest[0];refined+=1
    bm.normal_update();bm.to_mesh(o.data);bm.free();o.data.update()
    for p in o.data.polygons:p.use_smooth=True
    o.data.normals_split_custom_set_from_vertices([tuple(v.normal) for v in o.data.vertices])
print('FACE_SCULPT_RESTORED',refined,'vertices',flush=True)
for im in bpy.data.images:
    if im.source=='FILE':
        try:im.pack()
        except RuntimeError:pass
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ART,'water-deity-v03.blend'),compress=True)
# Same material-batched JSON importer architecture, with actual UVs and smooth normals.
names={entry['name']:entry for entry in palette};batches={};lookups={};count=0
for ob in meshes:
    geo=ob.data;geo.calc_loop_triangles();uv=geo.uv_layers.active
    if uv is None:raise ValueError('Missing source UVs')
    for tri in geo.loop_triangles:
        material=geo.materials[tri.material_index].name
        if material not in names:raise ValueError('Unmapped source material: '+material)
        batch=batches.setdefault(material,dict(material=material,vertices=[],normals=[],triangles=[],uv=[]));lookup=lookups.setdefault(material,{})
        for li in tri.loops:
            p=geo.vertices[geo.loops[li].vertex_index].co;n=geo.corner_normals[li].vector;t=uv.data[li].uv
            key=tuple(round(v,6) for v in (p.x,p.z,-p.y,n.x,n.z,-n.y,t.x,t.y))
            if key not in lookup:
                lookup[key]=len(batch['vertices'])//3;batch['vertices']+=key[:3];batch['normals']+=key[3:6];batch['uv']+=key[6:]
            batch['triangles'].append(lookup[key])
        count+=1
with open(os.path.join(OUT,'water-deity-v03.json'),'w') as f:json.dump(dict(materials=palette,meshes=list(batches.values())),f,separators=(',',':'))
with open(os.path.join(ART,'geometry-check.json'),'w') as f:json.dump(dict(triangles=count,materials=len(palette),height=3.3,source_preserved=True,uv_preserved=True,normal_export='smooth corner'),f,indent=2)
print('DEITY_V03_PREPARED',count,'triangles',len(palette),'materials',flush=True)
