"""Original sculpted distant massifs. Blender source and a three-mesh web GLB."""
import bpy, bmesh, json, math, random
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/world-horizon/v01'; OUT=ART/'exports'; OUT.mkdir(parents=True,exist_ok=True)
SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf-8'))
REVISION='v03'
SOURCE=ART/('world-horizon-'+REVISION+'.blend')
if SOURCE.exists(): raise RuntimeError('Preserve existing Blender original')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.temporary_directory=str(ROOT/'tmp/blender-validation')
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=16; scene.cycles.device='CPU'
scene.render.resolution_x=1280; scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.world.color=(.36,.46,.51)
editable=bpy.data.collections.new('EDITABLE_MASSIFS'); scene.collection.children.link(editable)
game=bpy.data.collections.new('WEB_EXPORT'); scene.collection.children.link(game)
material=bpy.data.materials.new('HorizonNeutral_VertexTone'); material.use_nodes=True; material.diffuse_color=(.72,.75,.76,1)
bs=material.node_tree.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=.96
colour=material.node_tree.nodes.new('ShaderNodeVertexColor'); colour.layer_name='CliffTone'; material.node_tree.links.new(colour.outputs['Color'],bs.inputs['Base Color'])
source_objects=[]; exports=[]; metrics=[]
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a))); return t*t*(3-2*t)
for layer_index,layer in enumerate(SPEC['backdrop']['layers']):
    pieces=[]
    for k in range(layer['count']):
        rng=random.Random(2026102600+layer_index*101+k)
        centre=math.radians(layer['offsetDegrees']+k*360/layer['count']+rng.uniform(-7,7))
        width=math.radians(rng.uniform(31,48) if layer_index else rng.uniform(27,41))
        width_metres=width*layer['radius']
        skew=math.radians(rng.choice([-1,1])*rng.uniform(24,61))
        radial_axis=Vector((math.cos(centre),-math.sin(centre),0))
        tangent_axis=Vector((-math.sin(centre),-math.cos(centre),0))
        right=tangent_axis*math.cos(skew)+radial_axis*math.sin(skew)
        deep=radial_axis*math.cos(skew)-tangent_axis*math.sin(skew)
        origin=radial_axis*layer['radius']
        peak=layer['height']*rng.uniform(.76,1)
        vertices=[]; faces=[]; tones=[]
        N=SPEC['backdrop']['angularSamples']; M=SPEC['backdrop']['radialSamples']
        radial=[0,.10,.17,.23,.29,.36,.44,.54,.66,.78,.88,.95,1]
        heights=[0,.12,.42,.62,.84,.94,1,.91,.77,.53,.26,.08,0]
        for i in range(N):
            u=-1+2*i/(N-1); a=centre+u*width/2
            envelope=(1-smooth(.45,.99,abs(u)))*(1+.07*math.sin(u*6+k*.8)+.045*math.sin(u*17+k*1.1))
            if k%3==1: envelope=max(0,1-abs(u))**.48*(.89+.10*math.sin(u*7+k))
            if k%3==2: envelope*=.70+.27*(math.exp(-((u+.36)/.29)**2)+.78*math.exp(-((u-.38)/.24)**2))
            # A broad cliff cap, unequal shoulders and occasional cleft. No cone row.
            notch=1-(.20*math.exp(-((u-.13)/.18)**2) if k%3==0 else 0)
            for j,v in enumerate(radial):
                gully=math.sin(u*14+k)*2.5+math.sin(u*27-k)*.65
                point=origin+right*(u*width_metres*.5)+deep*((v-.5)*layer['depth']+gully*math.sin(math.pi*v)**.7)
                radial_height=heights[j]
                if k%3==1: radial_height=[0,.14,.32,.5,.7,.82,1,.93,.77,.54,.32,.12,0][j]
                if k%3==2: radial_height=[0,.1,.3,.53,.71,.85,.92,1,.9,.68,.42,.18,0][j]
                z=peak*radial_height*envelope*notch
                if i in (0,N-1) or j in (0,M-1): z=0
                elif z>0: z+=.30*math.sin(u*17+j*1.4+k)*math.sin(math.pi*v)*envelope
                vertices.append((point.x,point.y,z))
                tones.append(.83+.13*j/(M-1)+rng.uniform(-.025,.025))
        top_count=len(vertices)
        vertices += [(x,y,0) for x,y,z in vertices]
        tones += [.80]*top_count
        for i in range(N-1):
            for j in range(M-1):
                a=i*M+j; b=(i+1)*M+j; c=b+1; d=a+1
                faces.extend([(a,b,c),(a,c,d),(a+top_count,c+top_count,b+top_count),(a+top_count,d+top_count,c+top_count)])
        mesh=bpy.data.meshes.new(layer['name']+'_cliff_'+str(k)); mesh.from_pydata(vertices,[],faces); mesh.update()
        obj=bpy.data.objects.new(layer['name']+'_Editable_'+str(k),mesh); editable.objects.link(obj); pieces.append(obj); source_objects.append(obj)
        mesh.materials.append(material)
        # Weld the shared base and remove zero-area border triangles.
        bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
        bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-8],context='FACES')
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free(); mesh.update()
        colors=mesh.color_attributes.new(name='CliffTone',type='FLOAT_COLOR',domain='CORNER')
        for polygon in mesh.polygons:
            polygon.use_smooth=False
            centre_point=sum((mesh.vertices[index].co for index in polygon.vertices),Vector())/len(polygon.vertices)
            along=(centre_point-origin).dot(right)/(width_metres*.5)
            shade=.69+.19*max(0,centre_point.z)/max(1,peak)+.10*math.sin(along*14+k)
            for li in polygon.loop_indices: colors.data[li].color=(shade,shade,shade,1)
        obj['local_floor']=0; obj['purpose']='Editable original distant cliff; not a walkable game surface'
    bpy.ops.object.select_all(action='DESELECT')
    copies=[]
    for source in pieces:
        copy=source.copy(); copy.data=source.data.copy(); game.objects.link(copy); copy.select_set(True); copies.append(copy)
    bpy.context.view_layer.objects.active=copies[0]; bpy.ops.object.join(); merged=bpy.context.object; merged.name=layer['name']; exports.append(merged)
    merged.data.calc_loop_triangles()
    z_values=[v.co.z for v in merged.data.vertices]
    metrics.append({'name':merged.name,'editablePieces':len(pieces),'vertices':len(merged.data.vertices),'triangles':len(merged.data.loop_triangles),'minimumY':min(z_values),'maximumY':max(z_values),'radius':layer['radius'],'haze':layer['haze']})
editable.hide_render=True; editable.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for obj in exports: obj.select_set(True)
bpy.context.view_layer.objects.active=exports[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/('world-horizon-'+REVISION+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT')
contract={'version':1,'revision':REVISION,'planetRadius':68,'localBottom':0,'anchorBelowGround':SPEC['backdrop']['anchorBelowFoot'],'fadeHeight':SPEC['backdrop']['fadeHeight'],'runtimeScale':SPEC['backdrop'].get('runtimeScale',.9),'meshes':metrics,'editablePieces':len(source_objects),'materials':1,'walkable':False,'collisionMeshes':0,'purpose':'Distant atmosphere; actual explorable terrain remains the planet','source':SOURCE.name}
(OUT/('world-horizon-'+REVISION+'.json')).write_text(json.dumps(contract,indent=2),encoding='utf-8')
light_data=bpy.data.lights.new('StudySun','SUN'); light=bpy.data.objects.new('StudySun',light_data); scene.collection.objects.link(light); light.rotation_euler=(math.radians(30),math.radians(-25),math.radians(-35)); light_data.energy=2
camera_data=bpy.data.cameras.new('MatchedStudyCamera'); camera=bpy.data.objects.new('MatchedStudyCamera',camera_data); scene.collection.objects.link(camera); scene.camera=camera
camera_data.type='PERSP'; camera_data.sensor_fit='VERTICAL'; camera_data.sensor_height=24; camera_data.lens=24/(2*math.tan(math.radians(SPEC['camera']['fov'])/2)); camera_data.clip_end=260
shots=json.loads((ROOT/'reports/2026-10-26/evidence/world-horizon/before.json').read_text())['shots']
for view in ('front','side','rear'):
    shot=next(s for s in shots if s['id']=='landing' and s['view']==view)
    up=Vector(shot['actor']).normalized(); q=Vector((0,1,0)).rotation_difference(up); anchor=Vector(shot['foot'])-up*SPEC['backdrop']['anchorBelowFoot']
    local=q.inverted()@(Vector(shot['camera'])-anchor)
    cq=Quaternion((shot['quaternion'][3],*shot['quaternion'][:3])); conversion=Quaternion((1,0,0),math.pi/2)
    camera.location=conversion@local; camera.rotation_mode='QUATERNION'; camera.rotation_quaternion=conversion@q.inverted()@cq
    scene.render.filepath=str(ART/('reference-'+REVISION+'-clay-'+view+'.png')); bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
(ART/('source-metrics-'+REVISION+'.json')).write_text(json.dumps(contract,indent=2),encoding='utf-8')
print('HORIZON_BUILT '+json.dumps({'pieces':len(source_objects),'meshes':len(exports),'triangles':sum(m['triangles'] for m in metrics),'bytes':(OUT/('world-horizon-'+REVISION+'.glb')).stat().st_size}))
