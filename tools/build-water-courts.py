"""Reference-led water masonry; current web puzzle coordinates remain authoritative."""
import bpy,bmesh,math,json,ast,sys,shutil
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import export_parts
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/water-courts/v01';ART.mkdir(parents=True,exist_ok=True)
BEFORE=json.loads((ROOT/'reports/2026-10-23/evidence/water-courts/before/report.json').read_text())
V=lambda p:Vector((p[0],-p[2],p[1]))
palette={'stone':[.27,.34,.36],'pale':[.56,.59,.53],'recess':[.075,.13,.17],'brass':[.48,.32,.12],'floor':[.37,.43,.43],'ice':[.15,.38,.49],'frost':[.48,.72,.76],'enamel':[.035,.23,.28]}
SPEC={'model':'assets/models/adventure/water-courts-v01.glb','palette':palette,'rooms':[],'budgets':{'triangles':90000,'bytes':9000000},'floorDatum':0,'originalRuntimeExecuted':False,'sourceReference':'art/glacier-water-temple/interior/v01/interior-reference.png'}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;M={};parts={};solids=[];collections={};images={}
for name in ['stone-albedo','stone-normal','floor-albedo','floor-normal']:
    shutil.copyfile(ROOT/'art/moon-sanctum/v01'/f'{name}.png',ART/f'{name}.png');im=bpy.data.images.load(str(ART/f'{name}.png'));im.colorspace_settings.name='Non-Color' if name.endswith('normal') else 'sRGB';images[name]=im
for name,color in palette.items():
    m=bpy.data.materials.new('Water courts '+name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=.62 if name=='brass' else .12 if name in ['ice','enamel'] else 0;bs.inputs['Roughness'].default_value=.37 if name=='brass' else .40 if name in ['ice','frost','enamel'] else .82
    if name in ['stone','pale','recess','floor']:
        texture=m.node_tree.nodes.new('ShaderNodeTexImage');texture.image=images['floor-albedo' if name=='floor' else 'stone-albedo'];mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1);m.node_tree.links.new(texture.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
        texture=m.node_tree.nodes.new('ShaderNodeTexImage');texture.image=images['floor-normal' if name=='floor' else 'stone-normal'];nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.24;m.node_tree.links.new(texture.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    M[name]=m
# Reuse the established masonry/UV/arch authoring methods, not the old room layout.
tree=ast.parse((ROOT/'tools/build-moon-courts.py').read_text(encoding='utf-8-sig'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['group','finish','box','poly','arc']],type_ignores=[]),'<existing-masonry-methods>','exec'))
def water_pier(x,z,parent,height=4.25,width=.72,depth=.82,base=0,side=0):
    foot=box('Grounded carved pedestal',[x,base+.16,z],[width+.32,.32,depth+.32],'recess',parent,.018,True)
    box('Pedestal limestone moulding',[x,base+.38,z],[width+.20,.12,depth+.20],'pale',parent,.014,True)
    box('Water pier shaft',[x,base+(height+.46)/2,z],[width,height-.46,depth],'stone',parent,.014,True)
    box('Supported capital',[x,base+height+.06,z],[width+.30,.24,depth+.26],'pale',parent,.014,True)
    box('Capital bronze lip',[x,base+height+.20,z],[width+.31,.036,depth+.27],'brass',parent,.002)
    if side:
        normal=-side;face=x+normal*(width/2+.023)
        box('Recessed enamel inscription',[face,base+2.65,z],[.035,1.55,.45],'enamel',parent,.008)
        # A raised closed droplet prism and shallow wave reliefs face the aisle.
        outline=[(0,.45),(.19,.10),(.20,-.10),(.11,-.24),(0,-.29),(-.11,-.24),(-.20,-.10),(-.19,.10)];pts=[(face+normal*d,base+2.80+y,z+u) for d in [.025,.060] for u,y in outline];n=len(outline)
        poly('Raised water droplet',pts,[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],'brass',parent)
        for row in range(3):
            pts=[]
            for i in range(17):
                u=-.18+i*.36/16;y=base+2.15+row*.14+.035*math.sin(i*.48)
                pts.extend([(face+normal*.055,y-.012,z+u),(face+normal*.055,y+.012,z+u)])
            poly('Carved flowing wave',pts,[(2*i,2*i+2,2*i+3,2*i+1) for i in range(16)],'pale',parent)
    return foot
def glacier(parent,half,length,height,base):
    # Shared edges make each side a continuous faceted wall, never floating pebbles.
    for side in [-1,1]:
        steps=max(10,round(length/1.25));pts=[];levels=[base,1.1,3.5,5.9,height+.7]
        for row,y in enumerate(levels):
            for j in range(steps+1):
                z=-length/2-.6+j*(length+1.2)/steps;x=side*(half+1.55+.30*math.sin(j*.85+row*.35)+.12*math.sin(j*1.9));pts.append((x,y+(.18*math.sin(j*1.1) if row>0 else 0),z))
        faces=[]
        for row in range(len(levels)-1):
            for j in range(steps):
                a=row*(steps+1)+j;faces.append((a,a+1,a+steps+2,a+steps+1))
        poly('Continuous striated glacier',pts,faces,'ice',parent)
        for j in range(1,steps,3):
            strip=[]
            for row in range(1,len(levels)):
                p=Vector(pts[row*(steps+1)+j]);p.x-=side*.018;strip.extend([tuple(p+Vector((0,0,-.022))),tuple(p+Vector((0,0,.022)))])
            poly('Attached frost fissure',strip,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(levels)-2)],'frost',parent)
        # Connect the lowest ice edge to a supported perimeter footing.
        box('Glacial retaining foundation',[side*(half+1.35),base-.13,0],[1.3,.26,length+1.25],'recess',parent,.01)
def paving(parent,area):
    x0,x1,z0,z1,y=area;nx=max(1,round((x1-x0)/1.7));nz=max(1,round((z1-z0)/1.65));w=(x1-x0)/nx;d=(z1-z0)/nz
    box('Paving continuous foundation',[(x0+x1)/2,y-.16525,(z0+z1)/2],[x1-x0,.3295,z1-z0],'recess',parent,0)
    for i in range(nx):
        for j in range(nz):box('Fitted limestone flagstone',[x0+(i+.5)*w,y-.065,z0+(j+.5)*d],[w-.018,.13,d-.018],'floor' if (i+j)%7 else 'pale',parent,.009)

for index,seg in enumerate(BEFORE['segments']):
    name=['Carry','Flow','Cycle','Sanctum'][index];w=seg['x1']-seg['x0'];length=seg['z1']-seg['z0'];half=w/2;h=seg['h'];bays=max(3,round(length/4.6));span=(length-.9)/bays;side_x=half+.62;spring=4.25 if index!=3 else 4.8;base=-5.0 if index==2 else 0
    shell=group(name+'Shell');floor=group(name+'Floor');ice=group(name+'Glacier');solids=[];piers=[]
    for side in [-1,1]:
        x=side*side_x
        if index==2:box('Deep supported side pier foundation',[x,-2.5,0],[.86,5,length+.4],'recess',shell,.01,True)
        box('Sill masonry backing',[x,.56,0],[.72,1.12,length+.6],'recess',shell,0,True)
        for row in range(3):
            for j in range(bays*2):box('Coursed wall sill',[x,.18+row*.36,-length/2+(j+.5)*length/(bays*2)],[.76,.335,length/(bays*2)-.024],'stone' if (row+j)%5 else 'pale',shell,.012)
        box('Deep carved window sill',[x,1.20,0],[1.02,.16,length+.7],'pale',shell,.016,True)
        for j in range(bays+1):
            z=-length/2+.45+j*span;water_pier(x,z,shell,spring,side=side);piers.append([x,z])
        for j in range(bays):arc('Carved water arcade',x,-length/2+.45+(j+.5)*span,(span-.75)/2,spring,.75,shell,True)
        box('Upper supported cornice',[x,spring+(span-.75)/2+.39,0],[.95,.20,length+.7],'pale',shell,.014,True)
    for end in [-1,1]:
        z=end*(length/2-.12);center=2.92
        for side in [-1,1]:
            water_pier(side*center,z,shell,3.9,.70,.82)
            wing=(w-2*center)/2;box('Portal wing backing',[side*(center+wing/2),.59,z],[wing-.04,1.18,.64],'stone',shell,.014,True)
            box('Portal wing sill',[side*(center+wing/2),1.24,z],[wing+.03,.12,.90],'pale',shell,.012,True)
        arc('Layered water portal',0,z,center-.40,3.9,.75,shell)
        box('Portal water keystone',[0,6.35,z],[.40,.62,.88],'pale',shell,.018)
    areas=[[-half,half,-length/2,length/2,0]] if index!=2 else [[-half,half,3.3,length/2,0],[-half,half,-length/2,-3.3,0],[-half,half,-3.3,3.3,-5.0]]
    for a in areas:paving(floor,a)
    glacier(ice,half,length,h,base)
    SPEC['rooms'].append({'id':seg['id'],'index':index,'width':w,'length':length,'height':h,'shell':shell.name,'floor':floor.name,'glacier':ice.name,'piers':piers,'solids':solids,'floorAreas':[dict(zip(['x0','x1','z0','z1','y'],a)) for a in areas],'foundationBottom':base-.33,'portalClearWidth':5.04})
    collection=bpy.data.collections.new('Water '+name);scene.collection.children.link(collection);collections[name]=collection
    for p in [shell,floor,ice]:
        for o in [p,*p.children]:
            for old in list(o.users_collection):old.objects.unlink(o)
            collection.objects.link(o)

scene.view_settings.view_transform='AgX';scene.world=bpy.data.worlds.new('Glacial studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.14,.20,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
lights=[]
for pos,power,size in [((3,-4,10),2500,8),((-6,3,7),1700,7)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler();lights.append(o)
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.sensor_fit='VERTICAL';cam.data.lens_unit='FOV';scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.render.resolution_percentage=100
originals=[o for p in parts.values() for o in p.children];metrics=export_parts(list(parts),SPEC,ART,'water-courts-v01','Water courts ')
assert sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))<=SPEC['budgets']['triangles'];assert metrics['glbBytes']<=SPEC['budgets']['bytes']
exports=[o for p in parts.values() for o in p.children if o not in originals]
for shot in BEFORE['shots']:
    item=SPEC['rooms'][shot['index']];seg=BEFORE['segments'][shot['index']];cz=(seg['z0']+seg['z1'])/2;names=[item['shell'],item['floor'],item['glacier']]
    for name,p in parts.items():p.location=V((0,0,cz)) if name in names else Vector((0,0,0))
    for o in exports:o.hide_render=o.parent.name not in names
    for i,o in enumerate(lights):o.location=V((3 if i==0 else -6,10 if i==0 else 7,cz+4 if i==0 else cz-3))
    cam.location=V(shot['camera']);cam.rotation_euler=(V(shot['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(shot['fov']);scene.render.filepath=str(ART/('goal-'+shot['id']+'.png'));bpy.ops.render.render(write_still=True)
# Leave a useful editable file: original pieces only, first court visible, others
# in named collections that can be toggled without overlapping the first court.
for o in exports:bpy.data.objects.remove(o,do_unlink=True)
for p in parts.values():p.location=(0,0,0)
for o in originals:o.hide_set(False);o.hide_render=False
for name,c in collections.items():c.hide_viewport=c.hide_render=name!='Carry'
cam.location=V((7,8,11));cam.rotation_euler=(V((0,2,0))-cam.location).to_track_quat('-Z','Y').to_euler()
for i,o in enumerate(lights):o.location=V((3 if i==0 else -6,10 if i==0 else 7,4 if i==0 else -3))
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_as_mainfile(filepath=str(ART/'water-courts-v01.blend'))
print('WATER_COURTS '+json.dumps(metrics))
