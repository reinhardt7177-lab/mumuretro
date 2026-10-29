import bpy,json,math,hashlib,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import ROOT,V,export_parts
from mathutils import Vector
OLD=ROOT/'art/moon-courts/v02';ART=ROOT/'art/moon-courts/v03';original=OLD/'moon-courts-v02.blend';digest=hashlib.sha256(original.read_bytes()).hexdigest();spec=json.loads((OLD/'design-spec.json').read_text());spec['model']='assets/models/adventure/moon-courts-v03.glb';spec['revision'].update({'frontPierCentre':4.4,'frontSource':'v02','opticsAndWalkwayUnchanged':True})
bpy.ops.wm.open_mainfile(filepath=str(original));bpy.context.view_layer.update();changed=[]
for o in bpy.data.objects['PanelCourt'].children:
    matrix=o.matrix_world.copy();inverse=matrix.inverted();points=[matrix@v.co for v in o.data.vertices];center=sum(points,Vector())/len(points)
    if -center.y<5.65 or abs(center.x)>6.5:continue
    name=o.name;sign=1 if center.x>0 else -1
    if name.startswith(('Threshold carved arch','Recessed brass arch')):
        for v in o.data.vertices:
            p=matrix@v.co;x=p.x;y=p.z-4.05;radius=math.hypot(x,y);p.x=x*(radius+1.75)/radius;p.z=4.05+y*(radius+1.75)/radius;v.co=inverse@p
    elif name.startswith('Threshold keystone'):o.location+=V((0,1.75,0))
    elif name.startswith(('End wing stone','End wing sill')):
        width=4.31 if name.startswith('End wing stone') else 4.38;new=2.56 if name.startswith('End wing stone') else 2.63
        for v in o.data.vertices:
            p=matrix@v.co;p.x=(p.x-sign*4.825)*new/width+sign*5.7;v.co=inverse@p
    elif abs(abs(center.x)-2.65)<.3:o.location+=V((sign*1.75,0,0))
    else:raise RuntimeError('Unclassified front piece '+name)
    changed.append(name)
count=0
for v in spec['rooms'][2]['solids']:
    if abs(v['position'][2]-6.1)>1e-5:continue
    sign=1 if v['position'][0]>0 else -1
    if v['name'].startswith('End wing'):v['position'][0]=sign*5.7;v['size'][0]=2.56 if v['name']=='End wing stone' else 2.63
    else:v['position'][0]+=sign*1.75
    count+=1
assert count==10
metrics=export_parts([n for r in spec['rooms'] for n in[r['shell'],r['floor']]],spec,ART,'moon-courts-v03','Courts ')
assert sum(v['triangles'] for v in metrics.values() if isinstance(v,dict))==32234
assert digest==hashlib.sha256(original.read_bytes()).hexdigest()
(ART/'correction.json').write_text(json.dumps({'pass':True,'sourceSha256':digest,'sourceUnchanged':True,'frontPierCentre':4.4,'changedSourceObjects':changed,'changedSolidBoxes':count,'rearCorrectionPreserved':True},indent=2));print('PASS widened front portal '+json.dumps(metrics))
