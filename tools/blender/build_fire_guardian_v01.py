"""Basalt elder guardian, authored from guardian-reference.png. Editable original preserved."""
import bpy,bmesh,json,math,random,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];ART=ROOT/'art/fire-temple/sanctum-v01';OUT=ROOT/'assets/models/fire-temple'
ART.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True);random.seed(211026)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/fire-temple/v01/fire-temple-v01.blend'));scene=bpy.context.scene
parts={k:[] for k in ['static','guardian','eyes','orb']};camera=[];pillars=[]
def v(p):return Vector((p[0],-p[2],p[1]))
def bounds(o):
 p=[o.matrix_world@Vector(q) for q in o.bound_box];return {'min':[min(q.x for q in p),min(q.z for q in p),min(-q.y for q in p)],'max':[max(q.x for q in p),max(q.z for q in p),max(-q.y for q in p)]}
for o in list(scene.objects):
 if o.type not in ['MESH','CURVE']:continue
 b=bounds(o);x,y,z=[(a+c)/2 for a,c in zip(b['min'],b['max'])];n=o.name
 if not(abs(x)<15 and -58<z<-41) or n.startswith(('Guardian dais','Throne','Guardian halo','Halo architectural','South low parapet')):bpy.data.objects.remove(o,do_unlink=True);continue
 parts['static'].append(o)
 if n.startswith(('Wing side core','North wall core','Column shaft')):camera.append(b)
 if n.startswith('Column shaft'):pillars.append({'x':x,'z':z,'r':.91})
def mat(name,col,metal=0,rough=.65,emit=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*col,1);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emit:p.inputs['Emission Color'].default_value=m.diffuse_color;p.inputs['Emission Strength'].default_value=emit
 return m
stone=mat('Guardian basalt skin',(.095,.115,.13),.16,.64);robe=mat('Guardian charcoal robe',(.034,.046,.06),.18,.74);gold=mat('Guardian aged bronze',(.42,.245,.078),.78,.32);edge=mat('Guardian chased light bronze',(.68,.43,.14),.72,.3);black=mat('Guardian recessed dark',(.008,.012,.017),.1,.72);hair=mat('Guardian carved hair',(.043,.056,.065),.12,.6);amber=mat('Guardian amber light',(1,.37,.035),.25,.23,2);white=mat('Guardian eye stone',(.12,.14,.13),.2,.55)
group='guardian'
def add(o,n,m):o.name=n;o.data.materials.append(m);parts[group].append(o);return o
def smooth(o):
 for p in o.data.polygons:p.use_smooth=True
 return o
def mesh(n,verts,faces,m):
 d=bpy.data.meshes.new(n);d.from_pydata([v(p) for p in verts],[],faces);d.update();o=bpy.data.objects.new(n,d);scene.collection.objects.link(o);add(o,n,m)
 bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(d);bm.free();return smooth(o)
def surf(n,fn,nu,nv,m,thick=.012):
 verts=[fn(i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)];faces=[]
 for j in range(nv):
  for i in range(nu):k=j*(nu+1)+i;faces.append((k,k+1,k+nu+2,k+nu+1))
 o=mesh(n,verts,faces,m)
 if thick:s=o.modifiers.new('Sculpted material thickness','SOLIDIFY');s.thickness=thick
 return o
def ell(n,p,s,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=1,location=v(p));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return smooth(add(o,n,m))
def tube(n,points,r=.012,m=gold):
 d=bpy.data.curves.new(n,'CURVE');d.dimensions='3D';d.bevel_depth=r;d.bevel_resolution=2;d.resolution_u=2;s=d.splines.new('POLY');s.points.add(len(points)-1)
 for q,p in zip(s.points,points):q.co=(*v(p),1)
 o=bpy.data.objects.new(n,d);scene.collection.objects.link(o);return add(o,n,m)
def ring(n,p,r,t=.012,m=gold,plane='xy'):
 return tube(n,[(p[0]+r*math.cos(i*math.tau/64),p[1]+(r*math.sin(i*math.tau/64) if plane=='xy' else 0),p[2]+(r*math.sin(i*math.tau/64) if plane=='xz' else 0)) for i in range(65)],t,m)
def box(n,p,s,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=v(p));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);add(o,n,m);bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.bevel(bm,geom=list(bm.edges),offset=min(.04,min(s)*.2),segments=2,affect='EDGES');bm.to_mesh(o.data);bm.free();return o
# Grounded anatomy and substantial continuous vestments, 4.5m scale.
for side in [-1,1]:ell('Carved sandal',(side*.28,.10,.12),(.26,.10,.38),stone)
def radius(t):return .78*(1-t)**2+.39+.10*math.sin(t*math.pi)
def vest(u,t):
 a=u*math.tau;r=radius(t)+(.055+.03*(1-t))*math.cos(22*a+.8*t);return (r*math.sin(a),.03+2.78*t,r*.60*math.cos(a))
surf('Continuous deeply pleated robe',vest,112,40,robe,.035)
for j in range(14):
 a=j*math.tau/14
 def panel(u,t,a=a):
  ang=a+(u-.5)*.38;r=radius(t)+.055+.035*math.sin(u*math.pi);return (r*math.sin(ang),.04+2.71*t+.13*math.sin(u*math.pi)*(1-t)**3,r*.61*math.cos(ang))
 surf('Layered robe panel',panel,8,35,robe,.025)
 for e in [0,1]:tube('Fine bronze robe seam',[panel(e,k/40) for k in range(41)],.009,edge)
 # A restrained branching fissure at hem, not luminous everywhere.
 if j%3==0:tube('Gilded cooled fissure',[panel(.25+random.random()*.35,k/18*.35) for k in range(15)],.006,gold)
surf('Anatomical robed chest',lambda u,t:(math.sin(u*math.tau)*(.44+.23*math.sin(t*math.pi*.8)),2.44+t*.81,math.cos(u*math.tau)*(.27+.09*math.sin(t*math.pi))),64,20,robe,.025)
ell('Solid neck',(0,3.29,.015),(.20,.28,.21),stone)
def stole(u,t):
 y=.22+2.98*t;width=.19+.10*math.sin(t*math.pi)+.40*max(0,(t-.80)/.20);return ((u-.5)*2*width,y,radius(min(1,(y-.03)/2.78))*.61+.075+.025*math.sin(u*math.pi))
surf('Long pointed ceremonial stole',stole,16,48,gold,.03)
for e in [0,1]:tube('Stole carved double edge',[stole(e,k/55) for k in range(56)],.014,edge)
for t in [.13,.33,.56,.73]:
 x,y,z=stole(.5,t);tube('Stole sun diamond',[(0,y+.15,z+.025),(.11,y,z+.025),(0,y-.15,z+.025),(-.11,y,z+.025),(0,y+.15,z+.025)],.011,edge)
ring('Belt sun centre',(0,2.53,.41),.18,.028,edge);ring('Belt inner',(0,2.53,.435),.11,.014,gold)
for side in [-1,1]:
 for layer in range(3):
  def shoulder(u,t,side=side,layer=layer):return (side*(.13+u*(.91-.05*layer)),3.28-.11*layer+.12*math.sin(u*math.pi)-.22*u*u-.25*t,.05+.36*math.sin(t*math.pi)-.12*u)
  surf('Overlapping engraved shoulder mantle',shoulder,22,12,gold,.045)
  tube('Shoulder chased lower border',[shoulder(i/35,1) for i in range(36)],.017,edge)
  for f in [.2,.5,.8]:
   x,y,z=shoulder(f,.5);ring('Shoulder rosette',(x,y,z+.025),.045,.006,edge)
 # Robed bent arms. Right blessing palm (viewer's left); left supports orb.
 elbow=(side*.90,2.72,.18);wrist=(side*.91,3.06 if side<0 else 2.59,.57)
 tube('Upper carved sleeve',[(side*.66,3.05,.02),elbow],.18,robe);tube('Forearm sleeve',[elbow,wrist],.15,robe)
 ell('Bronze cuff',wrist,(.17,.12,.14),gold)
 if side<0:
  palm=(-.94,3.29,.60);ell('Raised open blessing palm',palm,(.145,.18,.07),stone)
  for i in range(4):
   x=-.94+(i-1.5)*.073;y=3.41;top=3.73-abs(i-1.4)*.05;tube('Blessing finger',[(x,y,.60),(x,top-.10,.62),(x-.012,top,.60)],.032,stone)
   tube('Finger joint crease',[(x-.022,top-.13,.65),(x+.022,top-.13,.65)],.004,black)
  tube('Blessing opposed thumb',[(-.81,3.19,.60),(-.74,3.30,.64),(-.76,3.42,.62)],.041,stone)
 else:
  ell('Orb supporting palm',(.93,2.59,.66),(.18,.08,.16),stone)
  for i in range(4):tube('Orb curled finger',[(.80+i*.074,2.60,.69),(.80+i*.074,2.66,.84),(.80+i*.074,2.73,.84)],.028,stone)
  tube('Orb opposed thumb',[(.80,2.60,.60),(.73,2.70,.69),(.77,2.76,.73)],.035,stone)
# A single anatomical surface. Facial masses are not stacked spheres.
def gauss(x,c,w):return math.exp(-((x-c)/w)**2)
def facial_relief(x,y):
 return (.125*gauss(x,0,.052)*gauss(y,3.80,.12)
  +.035*sum(gauss(x,k,.105) for k in [-.13,.13])*gauss(y,3.986,.032)
  -.030*sum(gauss(x,k,.082) for k in [-.13,.13])*gauss(y,3.916,.042)
  +.018*sum(gauss(x,k,.08) for k in [-.20,.20])*gauss(y,3.765,.09)
  +.025*gauss(x,0,.11)*gauss(y,3.625,.055)
  +.014*gauss(x,0,.15)*gauss(y,3.52,.075))
def front(x,y):return .28*math.sqrt(max(.001,1-(x/.325)**2-((y-3.83)/.49)**2))+facial_relief(x,y)
def head(u,t):
 a=u*math.tau;phi=t*math.pi;y=3.83+.49*math.cos(phi);x=.325*math.sin(phi)*math.sin(a);z=.28*math.sin(phi)*math.cos(a)
 z+=max(0,math.cos(a))**8*facial_relief(x,y)
 return (x,y,z)
surf('Continuous sculpted elder face',head,160,112,stone,0)
for side in [-1,1]:
 ell('Ear',(side*.315,3.79,.015),(.055,.125,.055),stone)
 tube('Ear carved helix',[(side*.338,3.70,.065),(side*.36,3.79,.07),(side*.335,3.89,.05)],.009,hair)
 x=side*.13;y=3.914;z=front(x,y)
 ell('Recessed almond socket',(x,y,z+.002),(.090,.030,.007),black)
 ell('Carved eye stone',(x,y,z+.008),(.073,.019,.005),white)
 group='eyes';ell('Amber iris',(x,y,z+.016),(.017,.020,.006),amber);ell('Iris dark centre',(x,y,z+.022),(.006,.014,.003),black);group='guardian'
 upper=[(side*k,3.914+.025*math.sin(j*math.pi/16),front(side*k,3.914+.025*math.sin(j*math.pi/16))+.010) for j,k in enumerate([.045+.17*i/16 for i in range(17)])]
 lower=[(side*k,3.914-.022*math.sin(j*math.pi/16),front(side*k,3.914-.022*math.sin(j*math.pi/16))+.009) for j,k in enumerate([.045+.17*i/16 for i in range(17)])]
 tube('Sculpted upper eyelid',upper,.012,stone);tube('Sculpted lower eyelid',lower,.008,stone)
 brow=[(side*k,3.993+.015*math.sin(j*math.pi/20),front(side*k,3.993+.015*math.sin(j*math.pi/20))+.010) for j,k in enumerate([.045+.18*i/20 for i in range(21)])]
 tube('Swept carved eyebrow',brow,.017,hair)
 tube('Thin bronze brow inlay',[(x,y+.009,z+.008) for x,y,z in brow],.005,gold)
 # Small underside recesses rather than bulbous nostril alae.
 x=side*.045;y=3.744;ell('Nostril recess',(x,y,front(x,y)+.006),(.016,.009,.005),black)
# Narrow lip separation and lower lip relief follow the continuous front surface.
for n,y,r,m in [('Upper lip',3.642,.009,stone),('Mouth separation',3.628,.003,black),('Lower lip',3.615,.010,stone)]:
 pts=[(x,y+.006*math.cos(x/.1*math.pi),front(x,y)+.008) for x in [-.09,-.06,-.03,0,.03,.06,.09]];tube(n,pts,r,m)
for y in [4.09,4.15]:tube('Forehead subtle furrow',[(x,y,front(x,y)+.001) for x in [-.14,-.10,-.05,0,.05,.10,.14]],.002,hair)
# Swept crown hair and tapered beard locks with actual pointed geometry.
def lock(n,a,b,width,depth):
 a,b=Vector(a),Vector(b)
 def fn(u,t):
  p=a.lerp(b,t);w=width*(.15+.85*math.sin(math.pi*(.08+.92*t)))**.65;return(p.x+(u-.5)*2*w,p.y,p.z+depth*math.sin(math.pi*u)*(1-t)+.018*math.sin(t*math.pi))
 return surf(n,fn,8,20,hair,.015)
for i in range(17):
 a=(i-8)*.038;lock('Swept crown hair',(a,4.08,.21),(a*.68,4.31,-.11),.034,.045)
for side in [-1,1]:
 for i in range(4):lock('Temple swept lock',(side*(.23+i*.018),4.04,.16),(side*.29,3.58,-.05-i*.025),.035,.055)
 for i in range(4):lock('Moustache',(side*.025,3.69,.35),(side*(.12+i*.018),3.57,.32),.025,.025)
for i in range(11):
 x=(i-5)*.033;lock('Long elder beard',(x,3.56,.30),(x*.43,3.20+abs(i-5)*.028,.35),.033,.045)
ell('Crown tied hair',(0,4.34,-.04),(.115,.12,.12),hair);ring('Crown hair bronze band',(0,4.35,-.04),.119,.014,gold,plane='xz')
# Sun/caldera halo with engraved rings and pointed rays, separated from head.
for r,t in [(.72,.028),(.88,.042),(.94,.016)]:ring('Caldera halo',(0,3.96,-.25),r,t,gold)
for i in range(18):
 a=i*math.tau/18;r=.89;tip=1.02 if i%2 else 1.10;tube('Forged halo ray',[(r*math.cos(a),3.96+r*math.sin(a),-.25),(tip*math.cos(a+.025),3.96+tip*math.sin(a+.025),-.25)],.019,edge)
 for rr in [.78,.84]:ell('Halo tiny chased rivet',(rr*math.cos(a),3.96+rr*math.sin(a),-.215),(.012,.012,.009),edge)
group='orb';ell('Wisdom amber orb',(.93,2.91,.72),(.25,.25,.25),amber)
for i in range(3):ring('Orb orbit',(.93,2.91,.72),.26+i*.015,.006,edge,plane='xy' if i%2 else 'xz')
# Stage: floor remains 3.2, the sculpture's own hem touches its authored y=0.
group='static'
for r in [2.2,3.4,5.5]:ring('Sanctum radial floor inlay',(0,3.214,-50),r,.016,gold,plane='xz')
for i in range(24):
 a=i*math.tau/24;tube('Floor radial engraving',[(math.cos(a)*2.2,3.214,-50+math.sin(a)*2.2),(math.cos(a)*5.5,3.214,-50+math.sin(a)*5.5)],.009,gold)
for x in [-4.8,4.8]:
 box('Guardian backdrop grounded pier',(x,6.7,-55),(1.0,7,1),robe);box('Guardian pier base',(x,3.4,-55),(1.4,.4,1.4),gold)
 for z in [-44,-49,-54]:box('Sanctum lamp plinth',(x,3.55,z),(.7,.7,.7),robe);ell('Sanctum amber lamp',(x,4.0,z),(.12,.22,.12),amber)
for x in [-2.8,0,2.8]:ring('Three trial seal frame',(x,6.7,-56.55),.65,.045,gold)
for side in [-1,1]:box('Sanctum entry jamb',(side*3.5,5.6,-41),(1,4.8,1.0),robe)
box('Sanctum entry high lintel',(0,8,-41),(8,.5,1),gold)
deps=bpy.context.evaluated_depsgraph_get()
metrics={'guardianLocalBase':min(bounds(o)['min'][1] for o in parts['guardian']),'guardianTop':max(bounds(o)['max'][1] for o in parts['guardian']),'floor':3.2,'faceEyes':2,'fingerChains':10,'parts':{k:len(a) for k,a in parts.items()}}
# Sandals and robe start exactly at y=0.
assert abs(metrics['guardianLocalBase'])<.005,metrics
scene['reference']='guardian-reference.png';scene['status']='Basalt elder statue and grounded sanctum, not a generated texture billboard';bpy.ops.wm.save_as_mainfile(filepath=str(ART/'sanctum-v01.blend'))
for key,targets in parts.items():
 batches={}
 for source in targets:
  ev=source.evaluated_get(deps);me=bpy.data.meshes.new_from_object(ev);o=bpy.data.objects.new('Export '+source.name,me);scene.collection.objects.link(o);o.matrix_world=source.matrix_world.copy();batches.setdefault(o.data.materials[0].name,[]).append(o)
 merged=[];tris=0
 for m,items in batches.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in items:o.select_set(True)
  bpy.context.view_layer.objects.active=items[0]
  if len(items)>1:bpy.ops.object.join()
  o=items[0];o.name='Sanctum '+m;o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles);merged.append(o)
 bpy.ops.object.select_all(action='DESELECT')
 for o in merged:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/('sanctum-'+key+'-v01.glb')),export_format='GLB',use_selection=True,export_lights=False,export_cameras=False)
 for o in merged:bpy.data.objects.remove(o,do_unlink=True)
 metrics[key+'Triangles']=tris;print('SANCTUM_EXPORT',key,tris,flush=True)
(OUT/'sanctum-manifest.json').write_text(json.dumps({'version':1,'cameraOccluders':camera,'pillars':pillars,'metrics':metrics},indent=2),encoding='utf-8');(ART/'geometry-check.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8');print('SANCTUM_READY',json.dumps(metrics),flush=True)
