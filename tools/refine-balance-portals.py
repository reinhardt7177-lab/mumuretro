"""Versioned door pockets/stone portals; preserve all unrelated v06 source objects."""
import bpy,bmesh,json,hashlib,math,struct,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent;A=R/'art/balance-portals/v01';sys.path.insert(0,str(R/'tools/blender'))
from asset_detail_helpers import export
bpy.ops.wm.open_mainfile(filepath=str(R/'art/balance-walls/v01/balance-temple-v06.blend'))
def signature(o):
 points=[tuple(v.co) for v in o.data.vertices] if o.type=='MESH' else [[tuple(p.co) for p in s.points] for s in o.data.splines]
 uv=[[tuple(p.uv)for p in layer.data]for layer in o.data.uv_layers] if o.type=='MESH' else []
 return hashlib.sha256(repr((tuple(tuple(row)for row in o.matrix_world),points,uv,[m.name for m in o.data.materials])).encode()).hexdigest()
before={o.name:signature(o)for o in bpy.context.scene.objects if o.type in ['MESH','CURVE']};trimmed=[];removed=[]
# The pocket's back plane is -1.13 from the door. Corridors are centred -1.85 behind it.
# Keep source corridor local game Z <= .72 so their front meets the portal back.
limit=.72
for o in list(bpy.data.objects['hall_corridor'].children_recursive):
 if not o.name.startswith(('Wall ashlar','Wall backing','Wall cornice','Upper cornice')):continue
 world=o.matrix_world.copy();inv=world.inverted();points=[world@v.co for v in o.data.vertices]
 if min(v.y for v in points)>=-limit-.000001:continue
 name=o.name;bm=bmesh.new();bm.from_mesh(o.data)
 for v in bm.verts:v.co=world@v.co
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,-limit,0),plane_no=(0,1,0),clear_inner=True,clear_outer=False)
 boundary=[e for e in bm.edges if e.is_boundary and all(abs(v.co.y+limit)<.00001 for v in e.verts)]
 if boundary:bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
 for v in bm.verts:v.co=inv@v.co
 if not bm.faces:removed.append(name);bm.free();bpy.data.objects.remove(o,do_unlink=True);continue
 bm.to_mesh(o.data);bm.free();o.data.update();trimmed.append(name)
stone=bpy.data.materials['Balance paving limestone'].copy();stone.name='Balance portal limestone'
wall=bpy.data.materials['Balance wall ashlar'];bed=bpy.data.materials['Balance wall backing']
pieces=[];solids={}
def box(name,p,size,mat,parent,bevel=.014):
 x,y,z=p[0],-p[2],p[1];w,d,h=size[0]/2,size[2]/2,size[1]/2
 vertices=[(x-w,y-d,z-h),(x+w,y-d,z-h),(x+w,y+d,z-h),(x-w,y+d,z-h),(x-w,y-d,z+h),(x+w,y-d,z+h),(x+w,y+d,z+h),(x-w,y+d,z+h)]
 faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
 data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.parent=parent;data.materials.append(mat)
 if bevel:mod=o.modifiers.new('Dressed portal chamfer','BEVEL');mod.width=bevel;mod.segments=1
 uv=data.uv_layers.new(name='Portal mineral UV')
 for face in data.polygons:
  for i in face.loop_indices:
   v=data.vertices[data.loops[i].vertex_index].co;axis=max(range(3),key=lambda i:abs(face.normal[i]));u,vv=(v.y,v.z)if axis==0 else(v.x,v.z)if axis==1 else(v.x,v.y);uv.data[i].uv=(u*.32,vv*.32)
 pieces.append({'name':name,'root':parent.name,'position':p,'size':size,'material':mat.name,'bevel':bevel});return o
for name,width,height in [('portal14',14.74,8.95),('portal18',18.74,10.60)]:
 root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root);solids[name]=[];half=width/2
 def solid(p,size):solids[name].append({'position':p,'size':size})
 # Continuous pockets behind two dressed facades. The animated leaf occupies |z| <= .482.
 for side in [-1,1]:
  left,right=(2.5,half)if side>0 else(-half,-2.5);span=right-left;cx=(left+right)/2
  for front in [-1,1]:
   # Backing stops at .96; the ashlar front at1.13 must not share its plane.
   box(name+' pocket shell '+str(side)+' '+str(front),(cx,2.9,front*.765),(span,5.8,.39),bed,root,.005)
   rows=4
   for row in range(rows):
    cols=2;cuts=sorted(set([left,right]+[left+(k+(.5 if row%2 else 0))*span/cols for k in range(cols+1)if left+.01<left+(k+(.5 if row%2 else 0))*span/cols<right-.01]))
    for k,(a,b)in enumerate(zip(cuts,cuts[1:])):
     box(name+' wing ashlar '+str(side)+' '+str(front)+' '+str(row)+' '+str(k),((a+b)/2,(row+.5)*1.45,front*1.045),(b-a-.012,1.438,.17),wall,root,.012)
   # Door jambs sit only in front/back shells; the moving door has a real hollow pocket.
   for row in range(5):
    box(name+' jamb '+str(side)+' '+str(front)+' '+str(row),(side*2.80,(row+.5)*1.02,front*1.15),(.6,1.008,.30),stone,root,.018)
   box(name+' jamb foot '+str(side)+' '+str(front),(side*2.86,.16,front*1.19),(.72,.32,.38),stone,root,.018)
   box(name+' jamb capital '+str(side)+' '+str(front),(side*2.86,4.96,front*1.18),(.72,.28,.36),stone,root,.018)
  box(name+' pocket end '+str(side),(side*(half-.12),2.9,0),(.24,5.8,2.26),bed,root,.008)
  solid((cx,2.55,0),(span,5.1,2.6))
 # Flat lintel/upper wall carries the load; no new arbitrary circles, rails or floating trim.
 box(name+' load lintel',(0,5.36,0),(6.44,.52,2.60),stone,root,.025)
 box(name+' lintel crown',(0,5.71,0),(6.80,.18,2.68),stone,root,.018)
 box(name+' upper backing',(0,(5.8+height-.25)/2,0),(width,height-.25-5.8,2.26),bed,root,.005)
 upperH=height-.25-5.8;rows=max(2,round(upperH/1.3))
 for front in [-1,1]:
  for row in range(rows):
   cols=5 if width<16 else 6;cuts=sorted(set([-half,half]+[-half+(k+(.5 if row%2 else 0))*width/cols for k in range(cols+1)if -half+.01<-half+(k+(.5 if row%2 else 0))*width/cols<half-.01]))
   for k,(a,b)in enumerate(zip(cuts,cuts[1:])):
    box(name+' crown ashlar '+str(front)+' '+str(row)+' '+str(k),((a+b)/2,5.8+(row+.5)*upperH/rows,front*1.155),(b-a-.012,upperH/rows-.012,.10),wall,root,.012)
 box(name+' coping',(0,height-.125,0),(width,.25,2.40),stone,root,.02)
 solid((0,(5.1+height)/2,0),(width,height-5.1,2.68))
 assert all(p['position'][1]-p['size'][1]/2>=-.000001 for p in pieces if p['root']==name)
bpy.context.view_layer.update();changed=set(trimmed+removed);untouched={n:v for n,v in before.items()if n not in changed};assert all(n in bpy.data.objects and signature(bpy.data.objects[n])==v for n,v in untouched.items())
layout={'datum':0,'openingWidth':5,'openingHeight':5.1,'leafWidth':2.5,'leafSourceWidth':2.45,'leafTravel':2.7,'duration':1.1,'pocketInnerZ':.57,'corridorFrontZ':limit,'parts':{'portal14':{'width':14.74,'height':8.95,'solids':solids['portal14']},'portal18':{'width':18.74,'height':10.6,'solids':solids['portal18']}},'placements':[{'part':'portal14','door':'r1','z':-12.15},{'part':'portal14','door':'r2','z':-32.15},{'part':'portal18','door':'shrine','z':-54}],'pieces':pieces,'trimmed':trimmed,'removed':removed,'preservedSourceObjects':len(untouched),'preservedHash':hashlib.sha256(json.dumps(untouched,sort_keys=True).encode()).hexdigest()}
(A/'layout.json').write_text(json.dumps(layout,indent=2));export('art/balance-portals/v01/balance-temple-v07.blend','art/balance-portals/v01/balance-temple-v07.glb')
raw=(A/'balance-temple-v07.glb').read_bytes();g=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]]);primitives=[p for m in g['meshes']for p in m['primitives']]
metrics={'pass':True,'pieces':len(pieces),'trimmed':len(trimmed),'removed':len(removed),'preservedSourceObjects':len(untouched),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'meshes':len(g['meshes']),'materials':len(g['materials']),'triangles':sum(g['accessors'][p['indices']]['count']//3 for p in primitives)}
(A/'metrics.json').write_text(json.dumps(metrics,indent=2));print('BALANCE_PORTALS_READY',json.dumps(metrics),flush=True)
