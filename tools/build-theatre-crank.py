import bpy,json,math,hashlib,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import ROOT,V,export_parts
OLD=ROOT/'art/twin-shadow/v01';ART=ROOT/'art/twin-shadow/v02';original=OLD/'twin-shadow-v01.blend';digest=hashlib.sha256(original.read_bytes()).hexdigest();spec=json.loads((OLD/'design-spec.json').read_text());spec['model']='assets/models/adventure/twin-shadow-v02.glb';spec['wheelGrip']=[.24,0,.26];spec['wheelCap']={'halfWidth':.292,'back':-.08,'front':.27,'minY':.758,'maxY':1.342};spec['revision']={'source':'v01','crankDepth':.26,'unchangedSkeletonAndWheelCentre':True}
bpy.ops.wm.open_mainfile(filepath=str(original));p=bpy.data.objects['LampWheel'];brass=bpy.data.materials['Twin brass'];dark=bpy.data.materials['Twin dark']
def rod(name,start,end,r,material):
    a,b=V(start),V(end);d=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.name=name;o.parent=p;o.data.materials.append(material)
rod('Forward crank spindle',(.24,0,.025),(.24,0,.22),.025,brass)
rod('Grounded hand crank grip',(.24,0,.18),(.24,0,.26),.045,dark)
bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=8,location=V((.24,0,.22)),major_radius=.045,minor_radius=.007);o=bpy.context.object;o.rotation_euler.x=math.pi/2;o.name='Crank grip retaining ring';o.parent=p;o.data.materials.append(brass)
metrics=export_parts(spec['parts'],spec,ART,'twin-shadow-v02','Twin ');assert sum(v['sourcePieces'] for v in metrics.values() if isinstance(v,dict))==43
assert digest==hashlib.sha256(original.read_bytes()).hexdigest();(ART/'correction.json').write_text(json.dumps({'pass':True,'sourceSha256':digest,'sourceUnchanged':True,'wheelGrip':spec['wheelGrip'],'addedPieces':3},indent=2));print('PASS forward hand crank '+json.dumps(metrics))
