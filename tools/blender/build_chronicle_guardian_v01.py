"""Build the final Chronicle Guardian from the saved production reference.
No Unity dependency, no edits to the original GrandGod or other Blender originals.
"""
import bpy,bmesh,json,math,random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];ART=ROOT/'art/chronicle-temple/v01';OUT=ROOT/'assets/models/chronicle-temple'
ART.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True);random.seed(211021)
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
parts={};group='body'
def V(p):return Vector((p[0],-p[2],p[1]))
def material(n,c,metal=0,rough=.65,emission=0,stone=False):
 m=bpy.data.materials.new(n);m.use_nodes=True;m.diffuse_color=(*c,1);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emission:p.inputs['Emission Color'].default_value=m.diffuse_color;p.inputs['Emission Strength'].default_value=emission
 if stone:
  m['stoneTint']=list(c);a=m.node_tree.nodes.new('ShaderNodeVertexColor');a.layer_name='StoneTint';m.node_tree.links.new(a.outputs['Color'],p.inputs['Base Color'])
 return m
stone=material('Chronicle violet basalt',(.105,.09,.135),.08,.77,stone=True);dark=material('Chronicle dark basalt',(.036,.044,.064),.1,.72,stone=True);band=material('Chronicle sandstone strata',(.19,.16,.16),.15,.68,stone=True)
bronze=material('Chronicle aged bronze',(.39,.245,.10),.72,.36);edge=material('Chronicle worn bronze edge',(.61,.41,.19),.7,.37);void=material('Chronicle recessed star void',(.002,.005,.014),.05,.9);starlight=material('Chronicle quiet stars',(.57,.65,.85),.1,.4,2)
def add(o,n,m):o.name=n;o.data.materials.append(m);parts.setdefault(group,[]).append(o);return o
def smooth(o):
 for p in o.data.polygons:p.use_smooth=True
 return o
def mesh(n,vs,fs,m):
 d=bpy.data.meshes.new(n);d.from_pydata([V(p) for p in vs],[],fs);d.update();o=bpy.data.objects.new(n,d);scene.collection.objects.link(o);add(o,n,m);b=bmesh.new();b.from_mesh(d);bmesh.ops.recalc_face_normals(b,faces=b.faces);b.to_mesh(d);b.free();return smooth(o)
def surface(n,fn,nu,nv,m,thick=0):
 vs=[fn(i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)];fs=[]
 for j in range(nv):
  for i in range(nu):k=j*(nu+1)+i;fs.append((k,k+1,k+nu+2,k+nu+1))
 o=mesh(n,vs,fs,m)
 if thick:s=o.modifiers.new('Solid sculpted cloth','SOLIDIFY');s.thickness=thick
 return o
def ell(n,p,s,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=1,location=V(p));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return smooth(add(o,n,m))
def tube(n,points,r,m):
 d=bpy.data.curves.new(n,'CURVE');d.dimensions='3D';d.bevel_depth=r;d.bevel_resolution=2;s=d.splines.new('POLY');s.points.add(len(points)-1)
 for q,p in zip(s.points,points):q.co=(*V(p),1)
 o=bpy.data.objects.new(n,d);scene.collection.objects.link(o);return add(o,n,m)
def ring(n,p,r,th,m,flat=False):return tube(n,[(p[0]+r*math.cos(i*math.tau/80),p[1]+(0 if flat else r*math.sin(i*math.tau/80)),p[2]+(r*math.sin(i*math.tau/80) if flat else 0)) for i in range(81)],th,m)
def box(n,p,s,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=V(p));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);add(o,n,m);b=bmesh.new();b.from_mesh(o.data);bmesh.ops.bevel(b,geom=list(b.edges),offset=min(.08,min(s)*.2),segments=2,affect='EDGES');b.to_mesh(o.data);b.free();return o
def cyl(n,p,r,h,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=80,radius=r,depth=h,location=V(p));o=bpy.context.object;add(o,n,m);b=bmesh.new();b.from_mesh(o.data);bmesh.ops.bevel(b,geom=list(b.edges),offset=min(.035,h*.12),segments=2,affect='EDGES');b.to_mesh(o.data);b.free();return o
for y,h,r in [(.18,.36,5.4),(.52,.32,5.12),(.83,.30,4.86)]:cyl('Grounded concentric stone dais',(0,y,0),r,h,band);ring('Dais bronze rim',(0,y+h/2-.015,0),r-.055,.015,bronze,True)
for i in range(24):
 a=i*math.tau/24;tube('Dais radial relief',[(math.sin(a)*4.9,.64,math.cos(a)*4.9),(math.sin(a)*5.1,.64,math.cos(a)*5.1)],.018,bronze)
box('Throne seat',(0,2.7,-.7),(5.5,3.4,4.2),dark);box('Throne high back',(0,6.1,-2.15),(5.7,10.0,.8),dark)
for side in [-1,1]:
 box('Throne side pier',(side*3.7,3.25,-.2),(1.0,4.6,3.0),band)
 for y in [1.1,2.3,4.6,5.5]:box('Throne stone band',(side*3.7,y,-.2),(1.12,.13,3.15),bronze)
 ell('Carved resting foot',(side*2.1,1.15,3.08),(.7,.18,1.0),stone)
 for j in range(4):tube('Stone toe separation',[(side*2.1+(j-1.5)*.17,1.27,3.5),(side*2.1+(j-1.5)*.17,1.22,3.91)],.012,dark)
def interp(t,values):
 x=t*(len(values)-1);i=min(len(values)-2,int(x));return values[i]+(values[i+1]-values[i])*(x-i)
def robe(u,t):
 a=u*math.tau;r=interp(t,[4.2,3.8,3.25,2.7,2.45]);f=interp(t,[3.7,3.65,2.7,1.65,.65]);fold=(.13-.055*t)*math.cos(26*a+.65*t);x=(r+fold)*math.sin(a);y=.98+7.65*t+.16*math.sin(a*2)**2*(1-t);z=-.15+math.cos(a)*(f+fold if math.cos(a)>0 else 2.0+fold);return x,y,z
surface('Continuous seated draped robes',robe,144,72,stone,.075)
for i in range(22):
 a=(i+.5)/22;tube('Subtle gilded robe edge',[robe(a,k/64) for k in range(65)],.014,bronze)
surface('Ceremonial central stole',lambda u,t:((u-.5)*1.1,.99+7.0*t,interp(t,[3.84,3.8,2.86,1.92,.99])+.025*math.sin(u*math.pi)),18,64,dark,.055)
for side in [-1,1]:
 for layer in range(3):
  def mantle(u,t,side=side,layer=layer):return side*(.16+u*(3.10-layer*.10)),8.95-layer*.33-.20*u-.38*t+.22*math.sin(u*math.pi),-.35+1.85*math.sin(t*math.pi/2)-.08*u
  surface('Layered broad mantle',mantle,30,14,band,.10);tube('Mantle carved bronze edge',[mantle(i/45,1) for i in range(46)],.025,bronze)
 tube('Sculpted upper sleeve',[(side*2.4,8.35,-.1),(side*3.1,7.2,.0),(side*3.5,6.2,.65)],.64,stone)
 tube('Sculpted bent forearm',[(side*3.5,6.2,.65),(side*3.2,5.4,1.7),(side*2.8,5.05,2.75)],.56,stone)
 ell('Resting anatomical palm',(side*2.76,4.93,2.96),(.55,.20,.64),stone)
 for j in range(4):
  x=side*2.76+(j-1.5)*.24;end=3.98-abs(j-1.5)*.11;tube('Resting curled finger',[(x,4.96,3.10),(x,4.90,3.46),(x,4.69,end)],.102,stone)
 tube('Opposed resting thumb',[(side*2.38,4.99,2.84),(side*2.18,4.8,3.25),(side*2.24,4.63,3.48)],.13,stone)
 for j in range(8):
  def drape(u,t,side=side,j=j):
   x=side*(2.36+.12*j+.12*math.sin(u*math.pi));return x,1.02+4.13*t,2.85*(1-t)+1.7*t+.22*math.sin(t*math.pi)+.18*math.sin(u*math.pi)
  surface('Sleeve-to-dais falling folds',drape,6,30,stone,.035)
for y,z in [(2.0,3.9),(3.4,3.7),(5.8,2.35),(7.2,1.66)]:tube('Stole engraved diamond',[(0,y+.2,z),(.16,y,z),(0,y-.2,z),(-.16,y,z),(0,y+.2,z)],.018,bronze)
# Closed back and open front: the face is a recessed void, never a flat painted mask.
edge_points=[(0,8.5,1.32),(-1.15,9.0,1.2),(-1.64,10.0,1.12),(-1.48,11.35,.65),(-.65,12.3,.35),(0,12.85,.22),(.65,12.3,.35),(1.48,11.35,.65),(1.64,10.0,1.12),(1.15,9.0,1.2)]
def hood_edge(u):
 n=len(edge_points);x=u*n;i=int(x)%n;t=x-int(x);p=[Vector(edge_points[(i+k)%n]) for k in [-1,0,1,2]];return .5*((2*p[1])+(-p[0]+p[2])*t+(2*p[0]-5*p[1]+4*p[2]-p[3])*t*t+(-p[0]+3*p[1]-3*p[2]+p[3])*t*t*t)
def hood(u,t):
 p=hood_edge(u);k=(1-t)**.6;return p.x*k,10.5+(p.y-10.5)*k,p.z-3.0*math.sin(t*math.pi/2)
surface('Deep continuous hood',hood,120,40,stone,.13);tube('Hood chased bronze hem',[hood_edge(i/160) for i in range(161)],.028,bronze)
surface('Recessed concave cosmic face',lambda u,t:(hood_edge(u).x*t*.94,10.5+(hood_edge(u).y-10.5)*t*.94,-.18+.07*t*t),100,20,void)
for i in range(90):
 y=random.uniform(8.85,12.3);width=min((y-8.5)*.8,(12.85-y)*.9,1.22);x=random.uniform(-width,width);r=random.uniform(.009,.025);ell('Inset quiet constellation',(x,y,random.uniform(-.04,.18)),(r,r,r),starlight)
for i,x in enumerate([-.43,.43]):
 group='eye'+str(i);ell('AuthoredChronicleEye'+str(i),(x,10.65,.23),(.075,.085,.06),material('Chronicle eye '+str(i),(1,.55,.13),0,.3,5));group='body'
for radius,th in [(2.66,.045),(3.05,.06),(3.25,.028)]:ring('Chronicle astronomical halo',(0,10.76,-2.2),radius,th,bronze)
for i in range(12):
 a=i*math.tau/12;x=3.05*math.sin(a);y=10.76+3.05*math.cos(a);ring('Halo engraved disc',(x,y,-2.10),.13,.025,edge)
for i in range(5):
 x=(i-2)*1.03;y=8.26-.10*abs(i-2);z=1.66;ring('Five memory seal frame',(x,y,z),.43,.045,bronze)
 group='seal'+str(i);disc=cyl('AuthoredChronicleSeal'+str(i),(0,0,0),.37,.045,material('Chronicle dormant seal '+str(i),(.014,.016,.022),.08,.66));disc.rotation_euler.x=math.pi/2;disc.location=V((x,y,z));group='body'
 # Raised dark marks sit on the glowing face, not below it in the robe's folds.
 group='glyph'+str(i);yy=y;zz=z+.07
 if i==0:box('Balance mark',(x,yy,zz),(.50,.10,.04),void)
 elif i==1:ring('Shadow mark',(x,yy,zz),.22,.032,void)
 elif i==2:
  tube('Sift ellipse',[(x+.26*math.cos(k*math.tau/48),yy+.11*math.sin(k*math.tau/48),zz) for k in range(49)],.03,void)
 elif i==3:tube('Water diamond',[(x,yy+.25,zz),(x+.23,yy,zz),(x,yy-.25,zz),(x-.23,yy,zz),(x,yy+.25,zz)],.03,void)
 else:tube('Fire triangle',[(x,yy+.25,zz),(x+.25,yy-.18,zz),(x-.25,yy-.18,zz),(x,yy+.25,zz)],.03,void)
 group='body'
# Vertex stone variation is exported as actual COLOR_0; no unsupported Blender-only shader.
deps=bpy.context.evaluated_depsgraph_get();exported=[];counts={}
for key,objects in parts.items():
 batches={}
 for source in objects:
  d=bpy.data.meshes.new_from_object(source.evaluated_get(deps));o=bpy.data.objects.new('Export '+source.name,d);scene.collection.objects.link(o);o.matrix_world=source.matrix_world.copy()
  if d.materials[0].get('stoneTint'):
   layer=d.color_attributes.new(name='StoneTint',type='FLOAT_COLOR',domain='CORNER');c=d.materials[0]['stoneTint']
   for loop in d.loops:
    p=o.matrix_world@d.vertices[loop.vertex_index].co;n=.88+.08*math.sin(p.z*5.4+.9*math.sin(p.x*2))+.035*math.sin(p.x*79+p.y*53+p.z*61);layer.data[loop.index].color=(*[max(0,min(1,v*n)) for v in c],1)
  batches.setdefault(d.materials[0].name,[]).append(o)
 for name,items in batches.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in items:o.select_set(True)
  bpy.context.view_layer.objects.active=items[0]
  if len(items)>1:bpy.ops.object.join()
  o=items[0];o.name=('Chronicle'+key.title()) if key!='body' else name;o.data.calc_loop_triangles();counts[key]=counts.get(key,0)+len(o.data.loop_triangles);exported.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in exported:o.select_set(True)
bounds=[o.matrix_world@Vector(p) for o in exported for p in o.bound_box];metric={'base':min(p.z for p in bounds),'top':max(p.z for p in bounds),'width':max(p.x for p in bounds)-min(p.x for p in bounds),'depth':max(p.y for p in bounds)-min(p.y for p in bounds),'triangles':counts,'drawMeshes':len(exported)}
assert abs(metric['base'])<.005 and metric['top']<15 and metric['width']<11,metric
bpy.ops.export_scene.gltf(filepath=str(OUT/'guardian-v01.glb'),export_format='GLB',use_selection=True,export_lights=False,export_cameras=False)
for objects in parts.values():
 for o in objects:o.hide_render=True;o.hide_set(True)
scene['reference']='guardian-reference.png';scene['floor']='local y=0, final chamber placement uses existing gz';bpy.ops.wm.save_as_mainfile(filepath=str(ART/'chronicle-guardian-v01.blend'))
(ART/'geometry-check.json').write_text(json.dumps(metric,indent=2),encoding='utf-8');(OUT/'manifest.json').write_text(json.dumps({'version':1,'metrics':metric,'parts':['ChronicleEye0','ChronicleEye1']+['ChronicleSeal'+str(i) for i in range(5)]+['ChronicleGlyph'+str(i) for i in range(5)]},indent=2),encoding='utf-8');print('CHRONICLE_READY',json.dumps(metric),flush=True)
