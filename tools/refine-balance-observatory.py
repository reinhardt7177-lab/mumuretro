"""Editable barrel vaults, real roof lights and grounded weight gauges, layered on v07."""
import bpy,json,math,hashlib,sys,struct
from pathlib import Path
R=Path(__file__).resolve().parent.parent;A=R/'art/balance-observatory/v01';sys.path.insert(0,str(R/'tools/blender'))
from asset_detail_helpers import export
bpy.ops.wm.open_mainfile(filepath=str(R/'art/balance-portals/v01/balance-temple-v07.blend'))
def fingerprint(o):
 points=[tuple(v.co)for v in o.data.vertices]if o.type=='MESH'else[[tuple(p.co)for p in s.points]for s in o.data.splines]
 uv=[[tuple(v.uv)for v in l.data]for l in o.data.uv_layers]if o.type=='MESH'else[]
 return hashlib.sha256(repr((tuple(tuple(r)for r in o.matrix_world),points,uv,[m.name for m in o.data.materials])).encode()).hexdigest()
before={o.name:fingerprint(o)for o in bpy.context.scene.objects if o.type in ['MESH','CURVE']};removed=[];pieces=[];roofs=[]
for o in list(bpy.context.scene.objects):
 if o.name.startswith('Vault rib'):removed.append(o.name);bpy.data.objects.remove(o,do_unlink=True)
assert len(removed)==960
def copy_mat(source,name):m=bpy.data.materials[source].copy();m.name=name;return m
lining=copy_mat('Balance paving limestone','Balance vault lining');lining.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.96
ribmat=copy_mat('Balance portal limestone','Balance vault rib');backing=bpy.data.materials['Balance wall backing'];stone=bpy.data.materials['Balance portal limestone'];bronze=bpy.data.materials['Aged brass'];dark=bpy.data.materials['Midnight teal'];light=bpy.data.materials['Turquoise inlay']
def mesh(name,verts,faces,mat,parent,bevel=0):
 data=bpy.data.meshes.new(name);data.from_pydata([(x,-z,y)for x,y,z in verts],[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.parent=parent;data.materials.append(mat)
 if bevel:mod=o.modifiers.new('Stone arris','BEVEL');mod.width=bevel;mod.segments=1
 uv=data.uv_layers.new(name='Architectural mineral UV')
 for face in data.polygons:
  axis=max(range(3),key=lambda i:abs(face.normal[i]))
  for i in face.loop_indices:
   v=data.vertices[data.loops[i].vertex_index].co;u,vv=(v.y,v.z)if axis==0 else(v.x,v.z)if axis==1 else(v.x,v.y);uv.data[i].uv=(u*.32,vv*.32)
 pieces.append({'name':name,'root':parent.name,'material':mat.name});return o
def box(name,p,size,mat,parent,bevel=.012):
 x,y,z=p;w,h,d=[v/2 for v in size]
 return mesh(name,[(x-w,y-h,z-d),(x+w,y-h,z-d),(x+w,y+h,z-d),(x-w,y+h,z-d),(x-w,y-h,z+d),(x+w,y-h,z+d),(x+w,y+h,z+d),(x-w,y+h,z+d)],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,parent,bevel)
def strip(name,a,b,z0,z1,half,spring,rise,lo,hi,mat,parent,bevel=0,segments=None):
 n=segments or max(1,math.ceil((b-a)/(math.pi/36)));verts=[]
 for k in range(n+1):
  theta=a+(b-a)*k/n;x=half*math.sin(theta);y=spring+rise*math.cos(theta)
  verts.extend([(x,y+lo,z0),(x,y+lo,z1),(x,y+hi,z0),(x,y+hi,z1)])
 faces=[]
 for k in range(n):
  i=k*4;j=i+4;faces.extend([(i,j,j+1,i+1),(i+2,i+3,j+3,j+2),(i,i+2,j+2,j),(i+1,j+1,j+3,i+3)])
 faces.extend([(0,1,3,2),(4*n,4*n+2,4*n+3,4*n+1)])
 return mesh(name,verts,faces,mat,parent,bevel)
for name,w,length,h,rise,ribs in [('hall_order',14,18,9,3,[-8,0,8]),('hall_twin',14,16,9,3,[-7,5]),('hall_lever',18,28,11,3.8,[-13,-1,11]),('hall_entry',6,12,8,1.5,[-5,3]),('hall_corridor',5,4,8,1.2,[-1])]:
 root=bpy.data.objects[name];half=w/2;spring=h-.45;z0=-length/2;z1=.72 if name=='hall_corridor'else length/2
 opening=[1.8*w/14,4.7*w/14];angles=[math.asin(v/half)for v in opening]
 for i,(a,b)in enumerate([(-math.pi/2,angles[0]),(angles[1],math.pi/2)]):
  strip('Vault lining '+name+str(i),a,b,z0,z1,half,spring,rise,0,.06,lining,root)
  strip('Vault backing '+name+str(i),a,b,z0,z1,half,spring,rise,.18,.40,backing,root)
 # The opening kerbs have real depth; no transparent plane or volume beam.
 for i,a in enumerate(angles):strip('Roof light kerb '+name+str(i),a-.012,a+.012,z0,z1,half,spring,rise,-.025,.24,ribmat,root,segments=1)
 for z in ribs:
  for k in range(24):
   a=-math.pi/2+k*math.pi/24+.001;b=-math.pi/2+(k+1)*math.pi/24-.001
   strip('Vault voussoir '+name+' '+str(z)+' '+str(k),a,b,z-.18,z+.18,half,spring,rise,-.22,.012,ribmat,root,.008,segments=1)
 # Close the curved space above a room end while leaving all old walking openings intact.
 ends=[z0,z1]if name!='hall_corridor'else[z0]
 if name=='hall_lever':ends.append(-4)
 bottom=h-.35
 for end in ends:
  for k in range(36):
   edge=math.acos((bottom-spring)/rise);a=max(-edge,-math.pi/2+k*math.pi/36);b=min(edge,-math.pi/2+(k+1)*math.pi/36)
   if b-a<.000001:continue
   xa,xb=half*math.sin(a),half*math.sin(b);ya,yb=spring+rise*math.cos(a),spring+rise*math.cos(b);poly=[]
   for p in [(xa,bottom),(xb,bottom),(xb,yb),(xa,ya)]:
    if not poly or math.dist(poly[-1],p)>.0000001:poly.append(p)
   if math.dist(poly[0],poly[-1])<.0000001:poly.pop()
   n=len(poly);verts=[(x,y,end+z)for z in[-.12,.12]for x,y in poly];faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
   mesh('Vault end stone '+name+' '+str(end)+' '+str(k),verts,faces,ribmat,root)
 roofs.append({'root':name,'width':w,'length':length,'spring':spring,'rise':rise,'crown':spring+rise,'z0':z0,'z1':z1,'openingX':opening,'ribs':ribs,'endPanels':ends,'liningToBacking':.18})
# Frames have grounded feet;20 cells are a separately reusable bottom-anchored component.
frame=bpy.data.objects.new('GaugeFrame',None);bpy.context.collection.objects.link(frame)
box('Gauge stone foot',(0,.12,0),(1.05,.24,.80),stone,frame,.025)
box('Gauge upright backing',(0,1.32,-.19),(.8,2.16,.14),stone,frame,.018)
box('Gauge recessed back',(0,1.335,-.125),(.64,2.07,.10),dark,frame,.01)
for side in [-1,1]:box('Gauge bronze stile '+str(side),(side*.35,1.34,.105),(.055,2.12,.13),bronze,frame,.008)
for y in [.295,2.385]:box('Gauge bronze crosspiece '+str(y),(0,y,.105),(.755,.06,.13),bronze,frame,.008)
box('Gauge label mount',(0,2.56,0),(.96,.32,.66),stone,frame,.018)
box('Gauge label recess',(0,2.535,.335),(.79,.25,.025),dark,frame,.006)
cell=bpy.data.objects.new('GaugeCell',None);bpy.context.collection.objects.link(cell);box('Gauge luminous cell',(0,.065,0),(.55,.13,.12),light,cell,.012)
apron=bpy.data.objects.new('TrayPlaqueMount',None);bpy.context.collection.objects.link(apron)
box('Tray attached plaque',(0,.22,0),(1.30,.44,.08),bronze,apron,.012)
box('Tray plaque recess',(0,.22,.047),(1.20,.36,.016),dark,apron,.006)
for side in [-1,1]:box('Tray plaque attachment '+str(side),(side*.51,.405,-.035),(.09,.10,.10),bronze,apron,.008)
bpy.context.view_layer.update();preserved={n:v for n,v in before.items()if n not in set(removed)};assert all(n in bpy.data.objects and fingerprint(bpy.data.objects[n])==v for n,v in preserved.items())
layout={'datum':0,'roofs':roofs,'removedRibObjects':removed,'pieces':pieces,'preservedSourceObjects':len(preserved),'preservedHash':hashlib.sha256(json.dumps(preserved,sort_keys=True).encode()).hexdigest(),'gauge':{'part':'GaugeFrame','cell':'GaugeCell','positions':[[-4.6,0,-28.65],[4.6,0,-28.65]],'panRelativeZ':-1.65,'cellCount':10,'cellBottom':.335,'cellStep':.2,'cellZ':.05,'labelPosition':[0,2.535,.353],'labelSize':[.75,.23],'body':[{'position':[0,.12,0],'size':[1.05,.24,.8]},{'position':[0,1.32,-.03],'size':[.8,2.16,.46]},{'position':[0,2.56,0],'size':[.96,.32,.66]}]},'trayPlaque':{'part':'TrayPlaqueMount','position':[0,-2.50,.76],'labelPosition':[0,-2.28,.827],'labelSize':[1.18,.35],'minimumGroundClearance':.05}}
layout['trayPlaque']['position'][1]=-2.485;layout['trayPlaque']['labelPosition'][1]=-2.265
(A/'layout.json').write_text(json.dumps(layout,indent=2));export('art/balance-observatory/v01/balance-temple-v08.blend','art/balance-observatory/v01/balance-temple-v08.glb')
raw=(A/'balance-temple-v08.glb').read_bytes();g=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]]);prim=[p for m in g['meshes']for p in m['primitives']]
metrics={'pass':True,'removedRibObjects':len(removed),'newEditablePieces':len(pieces),'preservedSourceObjects':len(preserved),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'meshes':len(g['meshes']),'materials':len(g['materials']),'triangles':sum(g['accessors'][p['indices']]['count']//3 for p in prim)}
(A/'metrics.json').write_text(json.dumps(metrics,indent=2));print('BALANCE_OBSERVATORY_READY',json.dumps(metrics),flush=True)
