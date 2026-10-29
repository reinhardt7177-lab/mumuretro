import bpy,json,math,shutil,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import ROOT,V,export_parts
ART=ROOT/'art/panel-workshop/v01';ART.mkdir(parents=True,exist_ok=True);palette={'stone':[.40,.43,.42],'pale':[.71,.68,.57],'dark':[.10,.14,.18],'brass':[.62,.44,.17],'steel':[.48,.54,.55]}
SPEC={'model':'assets/models/adventure/panel-workshop-v01.glb','parts':['RailBed','PanelCarriage','Drawbar','PushBar','ObservationPlaque'],'palette':palette,'railLength':9.1,'railTop':.055,'cartZ':-.12,'wheelRadius':.14,'wheelCentreY':.195,'pushHeight':.75,'pushHalfSpan':.12,'pushFaceDepth':.035,'handGap':.33,'plaque':{'width':2.4,'height':.9,'labelPosition':[0,1.35,.111],'left':[-5.5,0,56/15],'right':[5.5,0,56/15],'yaw':.48},'budgets':{'triangles':22000,'bytes':3500000},'opticalPanelAndStemUnchanged':True}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;M={}
for key,color in palette.items():
    m=bpy.data.materials.new('Workshop '+key);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=.6 if key in['brass','steel'] else 0;bs.inputs['Roughness'].default_value=.44 if key=='brass' else .82
    if key in['stone','pale']:
        for name in['stone-albedo','stone-normal']:
            target=ART/(name+'.png');shutil.copyfile(ROOT/'art/moon-sanctum/v01'/(name+'.png'),target);im=bpy.data.images.get(name+'.png') or bpy.data.images.load(str(target));im.colorspace_settings.name='Non-Color' if name.endswith('normal') else 'sRGB';tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
            if name.endswith('normal'):
                normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.2;m.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
            else:
                mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
    M[key]=m
def group(name):
    p=bpy.data.objects.new(name,None);scene.collection.objects.link(p);return p
def finish(o,name,key,parent):
    o.name=name;o.parent=parent;o.data.materials.append(M[key]);bpy.context.view_layer.update()
    if not o.data.uv_layers:o.data.uv_layers.new(name='WorkshopUV')
    return o
def box(name,pos,size,key,parent,bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=V(pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Crafted edge','BEVEL');b.width=bevel;b.segments=1;bpy.ops.object.modifier_apply(modifier=b.name)
    return finish(o,name,key,parent)
def rod(name,start,end,r,key,parent):
    a,b=V(start),V(end);d=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,key,parent)
p=group('RailBed')
for z in[-4.4+i*.55 for i in range(17)]:
    box('Grounded stone sleeper',(0,.016,z),(1.04,.032,.17),'stone',p,.006)
    for side in[-1,1]:box('Rail chair',(side*.32,.033,z),(.15,.025,.13),'brass',p,.004)
for side in[-1,1]:
    box('Continuous steel rail',(side*.32,.0435,0),(.055,.023,9.1),'steel',p,.003)
    for z in[-4.4+i*.55 for i in range(17)]:box('Equal observation notch',(side*.66,.009,z),(.12,.018,.028),'brass',p,.002)
p=group('PanelCarriage');box('Trolley iron frame',(0,.35,0),(.90,.18,.69),'dark',p,.018);box('Trolley top plate',(0,.452,0),(.72,.024,.58),'brass',p,.008)
box('Lower optical stem support',(0,.482,.09),(.09,.036,.06),'brass',p,.003)
for z in[-.22,.22]:
    rod('Through axle',(-.42,.195,z),(.42,.195,z),.035,'steel',p)
    for side in[-1,1]:
        rod('Rail roller',(side*.32-.0525,.195,z),(side*.32+.0525,.195,z),.14,'steel',p)
        rod('Roller bronze hub',(side*.32-.058,.195,z),(side*.32+.058,.195,z),.058,'brass',p)
for x in[-.32,.32]:
    for z in[-.22,.22]:rod('Trolley rivet',(x,.465,z),(x,.481,z),.018,'brass',p)
p=group('Drawbar');box('Telescopic iron arm',(.5,0,0),(1,.06,.06),'dark',p,.004);box('Arm upper strip',(.5,.032,0),(.96,.008,.04),'brass',p,.001)
p=group('PushBar');box('Palm contact bar',(0,0,0),(.38,.06,.07),'dark',p,.004)
for side in[-1,1]:
    box('Pushbar brass cap',(side*.19,0,0),(.025,.068,.078),'brass',p,.003)
    box('Equal palm mark',(side*.12,.031,0),(.04,.006,.045),'brass',p,.001)
box('Pushbar low neck',(0,-.07,0),(.06,.14,.06),'steel',p,.004)
p['leftGrip']=[-.12,0,.035];p['rightGrip']=[.12,0,.035]
p=group('ObservationPlaque');box('Grounded plaque foot',(0,.09,-.03),(.82,.18,.64),'stone',p,.014);box('Plaque foot lip',(0,.20,-.03),(.66,.05,.48),'brass',p,.006);box('Plaque stone stem',(0,.57,-.06),(.24,.70,.24),'stone',p,.012)
box('Plaque backing',(0,1.35,0),(2.62,1.10,.16),'dark',p,.016);box('Plaque pale inset',(0,1.35,.085),(2.44,.94,.03),'pale',p,.006)
for side in[-1,1]:
    box('Plaque vertical moulding',(side*1.28,1.35,.10),(.065,1.05,.06),'brass',p,.004);box('Plaque horizontal moulding',(0,1.35+side*.515,.10),(2.59,.065,.06),'brass',p,.004)
    for x in[-1.24,1.24]:rod('Plaque corner rivet',(x,1.35+side*.47,.12),(x,1.35+side*.47,.14),.019,'brass',p)
p['labelPosition']=SPEC['plaque']['labelPosition'];metrics=export_parts(SPEC['parts'],SPEC,ART,'panel-workshop-v01','Workshop ')
assert sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))<=SPEC['budgets']['triangles'];assert metrics['PushBar']['webMax'][1]<=.04;print('PASS panel workshop '+json.dumps(metrics))
