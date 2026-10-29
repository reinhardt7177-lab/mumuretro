"""Original grounded offering cradles, carved tablet and metal-mounted memory orb."""
import bpy,bmesh,math,json,ast,sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from theatre_asset_utils import export_parts
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/sanctum-offerings/v01';ART.mkdir(parents=True,exist_ok=True)
V=lambda p:Vector((p[0],-p[2],p[1]))
palette={'stone':[.35,.40,.42],'pale':[.69,.65,.55],'recess':[.15,.22,.23],'bronze':[.57,.45,.27],'gem':[.54,.79,.80]}
SPEC={'model':'art/sanctum-offerings/v01/preview.glb','palette':palette,'parts':{},'orbRadius':.36,'glyphCentre':[0,2.28,-.335],'orbHomeY':1,'offeredY':1.7}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;M={};parts={};solids=[]
for key,c in palette.items():
 m=bpy.data.materials.new('Offering '+key);m.diffuse_color=(*c,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.32 if key=='gem' else .47 if key=='bronze' else .86;bs.inputs['Metallic'].default_value=.65 if key=='bronze' else .12 if key=='gem' else 0
 if key in ['stone','pale','recess']:
  im=bpy.data.images.load(str(ROOT/'art/strata-inlays/v01/limestone-albedo.png'),check_existing=True);tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 M[key]=m
tree=ast.parse((ROOT/'tools/build-moon-courts.py').read_text(encoding='utf-8-sig'));exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['group','finish','box','poly']],type_ignores=[]),'<shared masonry>','exec'))
def begin(name):
 global solids
 solids=[];p=group(name);SPEC['parts'][name]={'solids':solids};return p
def lathe(name,profile,key,parent,n=40):
 points=[(r*math.cos(i*math.tau/n),y,r*math.sin(i*math.tau/n))for r,y in profile for i in range(n)];faces=[]
 for k in range(len(profile)-1):
  for i in range(n):j=(i+1)%n;faces.append((k*n+i,k*n+j,(k+1)*n+j,(k+1)*n+i))
 o=poly(name,points,faces,key,parent)
 for f in o.data.polygons:f.use_smooth=True
 return o
cradle=begin('OrbCradle')
box('Grounded stepped foot',(0,.075,0),(1.1,.15,.90),'stone',cradle,.025,True)
box('Carved plinth',(0,.29,0),(.82,.28,.66),'pale',cradle,.025,True)
box('Inset top shelf',(0,.48,0),(1.0,.12,.80),'stone',cradle,.02,True)
box('Bronze seating plate',(0,.56,0),(.55,.04,.55),'bronze',cradle,.02)
lathe('Orb seat',[(0,.58),(.17,.58),(.17,.62),(.11,.64),(0,.64)],'recess',cradle)
SPEC['parts']['OrbCradle']['solids'].append({'name':'Orb seat','position':[0,.59,0],'size':[.55,.1,.55]})
for x in[-.32,.32]:box('Inset retaining corner',(x,.32,.338),(.06,.16,.028),'bronze',cradle,.005)
crown=begin('OfferingCrown')
box('Integrated tablet',(0,1.95,-.51),(1.32,1.4,.28),'pale',crown,.035,True)
box('Recessed symbol field',(0,2.26,-.357),(1.08,.60,.035),'recess',crown,.012)
for x in[-.55,.55]:box('Embedded bronze upright',(x,2.25,-.33),(.035,.66,.028),'bronze',crown,.005)
box('Tablet cap',(0,2.62,-.51),(1.4,.06,.34),'stone',crown,.02)
lathe('Offering socket',[(0,1.20),(.50,1.20),(.50,1.28),(.43,1.32),(.16,1.32),(.12,1.34),(0,1.34)],'bronze',crown)
box('State jewel housing',(0,.72,.97),(.30,.20,.04),'bronze',crown,.015)
box('State jewel',(0,.72,1.0),(.22,.12,.035),'gem',crown,.012)
orb=begin('MemoryOrb')
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,radius=.36);o=finish(bpy.context.object,'Polished memory stone','gem',orb)
for f in o.data.polygons:f.use_smooth=True
# Physical thin equatorial setting; no floating halo or light rings.
lathe('Equatorial metal setting',[(.354,-.025),(.363,-.020),(.363,.020),(.354,.025)],'bronze',orb)
for sy in[-1,1]:lathe('Polar mount',[(0,sy*.363),(.09,sy*.35),(.12,sy*.335)],'bronze',orb)
SPEC['parts']['MemoryOrb']['solids']=[]
metrics=export_parts(list(parts),SPEC,ART,'sanctum-offerings-v01','Offering ')
print('PASS',json.dumps(metrics),flush=True)
