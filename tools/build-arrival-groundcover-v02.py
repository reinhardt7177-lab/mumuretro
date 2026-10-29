"""Four low, varied native meadow clusters. No extra web mesh or triangle count."""
import bpy,json,math,random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/arrival-coherence/v01/groundcover-v02';OUT=ART/'exports'
SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf-8'));SOURCE=ART/'arrival-groundcover-v02.blend'
if SOURCE.exists():raise RuntimeError('Preserve the authored original; create a new revision')
OUT.mkdir(parents=True,exist_ok=True);bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.temporary_directory=str(ROOT/'tmp/blender-validation')
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.device='CPU';scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.world.color=(.28,.32,.25)
mat=bpy.data.materials.new('MeadowNeutral_LeafTint_PetalAccent');mat.use_nodes=True;mat.use_backface_culling=False;mat.diffuse_color=(1,1,1,1)
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.94
vcol=mat.node_tree.nodes.new('ShaderNodeVertexColor');vcol.layer_name='MeadowColour';mat.node_tree.links.new(vcol.outputs['Color'],bs.inputs['Base Color'])
objects=[];metrics=[]
for variant,cfg in enumerate(SPEC['variants']):
    rng=random.Random(2026102700+variant);height=cfg['height'];verts=[];faces=[];colours=[];uvs=[]
    def vertex(point,colour=(1,1,1),accent=False):
        idx=len(verts);verts.append(tuple(point));colours.append((*colour,1));uvs.append((2.5 if accent else .5,max(0,min(1,point[2]/height))));return idx
    def leaf(base,angle,length,width,lean,phase=0):
        lateral=Vector((-math.sin(angle),math.cos(angle),0));forward=Vector((math.cos(angle),math.sin(angle),0));start=len(verts)
        for level in range(6):
            t=level/5;centre=Vector(base)+forward*(lean*t*t+.025*math.sin(t*math.pi));centre.z=length*t
            centre+=lateral*(.008*math.sin(t*math.pi+phase));half=width*[.12,.72,1,.86,.48,.025][level]*.5
            shade=.65+.33*math.sqrt(t)
            for sign in (-1,1):
                vi=vertex(centre+lateral*(half*sign),(shade,shade,shade));uvs[vi]=((sign+1)/2,t*length/height)
        for level in range(5):
            a=start+level*2;faces.extend([(a,a+1,a+3),(a,a+3,a+2)])
    if variant<2:
        for blade in range(9):
            a=blade*2.399963+variant*.53+rng.uniform(-.18,.18)
            base=Vector((rng.uniform(-.04,.04),rng.uniform(-.04,.04),0))
            if variant==0:
                length=height if blade==8 else height*rng.uniform(.58,.94);width=rng.uniform(.07,.115);lean=rng.uniform(.12,.21)
            elif blade<3:length=height*rng.uniform(.25,.43);width=rng.uniform(.075,.09);lean=rng.uniform(.09,.15)
            else:length=height if blade==8 else height*rng.uniform(.62,.96);width=rng.uniform(.045,.066);lean=rng.uniform(.085,.18)
            leaf(base,a,length,width,lean,blade*.3)
    else:
        for blade in range(4):
            leaf(Vector((rng.uniform(-.025,.025),rng.uniform(-.025,.025),0)),blade*2.399963+.4,height*rng.uniform(.34,.56),rng.uniform(.04,.065),rng.uniform(.07,.13))
        top=Vector((.017,0,height-.006));stem_colour=(.52,.66,.41);w=.006
        for axis in (Vector((w,0,0)),Vector((0,w,0))):
            ids=[vertex(-axis,stem_colour),vertex(axis,stem_colour),vertex(top+axis,stem_colour),vertex(top-axis,stem_colour)];faces.extend([(ids[0],ids[1],ids[2]),(ids[0],ids[2],ids[3])])
        # One broad bract gives the flower a living stem silhouette.
        b=Vector((.008,0,height*.48));ids=[vertex(b,(.62,.76,.51)),vertex(b+Vector((-.06,.025,.015)),(.75,.86,.63)),vertex(b+Vector((-.095,0,.04)),(.80,.90,.70)),vertex(b+Vector((-.045,-.014,.01)),(.70,.81,.57))];faces.extend([(ids[0],ids[1],ids[2]),(ids[0],ids[2],ids[3])])
        petal=(.95,.89,.70) if variant==2 else (.92,.70,.30);pollen=(.62,.43,.12)
        for p in range(6):
            a=p*math.pi/3+variant*.2;radial=Vector((math.cos(a),math.sin(a),0));side=Vector((-math.sin(a),math.cos(a),0));origin=Vector((top.x,top.y,height-.005));length=.057 if variant==2 else .046;wide=.018 if variant==2 else .015
            ids=[vertex(origin+radial*.004,pollen,True),vertex(origin+radial*(length*.46)+side*wide,petal,True),vertex(origin+radial*length+Vector((0,0,-.004)),petal,True),vertex(origin+radial*(length*.46)-side*wide,petal,True),vertex(origin+radial*(length*.45)+Vector((0,0,.005)),petal,True)]
            faces.extend([(ids[0],ids[1],ids[4]),(ids[1],ids[2],ids[4]),(ids[2],ids[3],ids[4]),(ids[3],ids[0],ids[4])])
    mesh=bpy.data.meshes.new(cfg['name']+'_Native');mesh.from_pydata(verts,[],faces);mesh.update();mesh.materials.append(mat)
    uv=mesh.uv_layers.new(name='BendAndAccentUV');colour=mesh.color_attributes.new(name='MeadowColour',type='FLOAT_COLOR',domain='CORNER')
    for poly in mesh.polygons:
        poly.use_smooth=True
        for li in poly.loop_indices:
            vi=mesh.loops[li].vertex_index;uv.data[li].uv=uvs[vi];colour.data[li].color=colours[vi]
    ob=bpy.data.objects.new(cfg['name'],mesh);scene.collection.objects.link(ob);ob.location.x=variant*.85;objects.append(ob)
    ob['native_variant']=variant;ob['local_floor']=0;ob['kind']=cfg['kind'];ob['uv_u_above_1_5']='petal accent bypasses green instance tint'
    metric={'name':ob.name,'kind':cfg['kind'],'vertices':len(verts),'triangles':len(faces),'height':max(v[2] for v in verts),'minimumY':min(v[2] for v in verts),'radius':max(math.hypot(v[0],v[1]) for v in verts),'accentVertices':sum(u[0]>1.5 for u in uvs)}
    assert len(faces)==(90 if variant<2 else 70) and abs(metric['minimumY'])<1e-8 and abs(metric['height']-height)<1e-7,repr(metric)
    metrics.append(metric)
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
options={'filepath':str(OUT/'arrival-groundcover-v02.glb'),'export_format':'GLB','use_selection':True,'export_yup':True,'export_extras':True,'export_materials':'EXPORT'}
if 'export_all_vertex_colors' in bpy.ops.export_scene.gltf.get_rna_type().properties.keys():options['export_all_vertex_colors']=True
bpy.ops.export_scene.gltf(**options)
metadata=json.loads((ROOT/'assets/models/adventure/arrival-meadow-v01.json').read_text(encoding='utf-8'));metadata['source']='art/arrival-coherence/v01/groundcover-v02/arrival-groundcover-v02.blend';metadata['variants']=metrics;metadata['tufts']={**metadata.get('tufts',{}),'heights':[m['height'] for m in metrics],'source':'arrival-groundcover-v02','layeredKinds':True};metadata['placement']={**metadata.get('placement',{}),'flowerCandidateWeight':.095,'patchThreshold':.43};metadata['accentUV']='u>1.5 preserves authored petal colours; V is height-normalized bending';metadata['model']='arrival-groundcover-v02.glb'
metadata['tufts'].update({'maximumTrianglesPerVariant':90,'trianglesPerVariant':[90,90,70,70],'segmentsPerBlade':5,'bladesPerVariant':[9,9,4,4]})
metadata['placement'].update({'samplesPerCell':70,'maximumPerVariantHigh':[900,900,300,300],'maximumPerVariantMid':[900,900,300,300],'maximumTotal':2400,'horizontalAxisVariation':[.68,1.32]})
(OUT/'arrival-groundcover-v02.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
# Study-only material models the runtime green instance tint while preserving petals.
preview=mat.copy();preview.name='PreviewOnly_LayeredPlantTint';nodes=preview.node_tree.nodes;links=preview.node_tree.links;raw=nodes.get(vcol.name)
uvnode=nodes.new('ShaderNodeTexCoord');separate=nodes.new('ShaderNodeSeparateXYZ');links.new(uvnode.outputs['UV'],separate.inputs[0]);accent=nodes.new('ShaderNodeMath');accent.operation='GREATER_THAN';accent.inputs[1].default_value=1.5;links.new(separate.outputs['X'],accent.inputs[0])
green=nodes.new('ShaderNodeMixRGB');green.blend_type='MULTIPLY';green.inputs[0].default_value=1;green.inputs[2].default_value=(.27,.46,.16,1);links.new(raw.outputs['Color'],green.inputs[1]);mix=nodes.new('ShaderNodeMixRGB');links.new(accent.outputs[0],mix.inputs[0]);links.new(green.outputs[0],mix.inputs[1]);links.new(raw.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],nodes.get('Principled BSDF').inputs['Base Color'])
for ob in objects:ob.data.materials[0]=preview
bpy.ops.mesh.primitive_plane_add(size=20,location=(1.3,0,-.005));floor=bpy.context.object;floor.name='PreviewOnly_Ground';fm=bpy.data.materials.new('PreviewOnly_Soil');fm.diffuse_color=(.29,.25,.17,1);floor.data.materials.append(fm)
bpy.ops.object.light_add(type='AREA',location=(0,-3,4));light=bpy.context.object;light.data.energy=450;light.data.size=4
bpy.ops.object.camera_add(location=(1.27,-3.2,1.55));camera=bpy.context.object;camera.rotation_euler=(Vector((1.27,0,.14))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=3.35;scene.camera=camera;scene.render.filepath=str(ART/'blender-plant-study.png');bpy.ops.render.render(write_still=True)
for ob in objects:ob.data.materials[0]=mat
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
contract={'version':1,'meshes':4,'gameMaterials':1,'runtimeMaterials':4,'totalSourceTriangles':320,'localFloor':0,'variants':metrics,'source':str(SOURCE.relative_to(ROOT)).replace('\\','/'),'modelBytes':(OUT/'arrival-groundcover-v02.glb').stat().st_size}
(ART/'source-metrics.json').write_text(json.dumps(contract,indent=2),encoding='utf-8');print('LAYERED_PLANTS '+json.dumps(contract))
