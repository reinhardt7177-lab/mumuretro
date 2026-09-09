"""Original Starsail model. Run in Blender background; coordinates in game metres.
Editable source is saved before batching geometry for the GLB export.
"""
import bpy, math, random, os
from mathutils import Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
random.seed(7177)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def vec(p): return Vector((p[0], -p[2], p[1]))
def mat(name, rgb, metal=0, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=.66
    p.inputs['Emission Color'].default_value=(*rgb,1); p.inputs['Emission Strength'].default_value=emission
    return m
wood=mat('Walnut hull',(.19,.085,.035)); dark=mat('Tar seams',(.048,.032,.025))
planks=[mat('Honey plank '+str(i),(.34+i*.016,.19+i*.011,.085+i*.006)) for i in range(5)]
brass=mat('Aged brass',(.52,.32,.105),.68); iron=mat('Forged iron',(.07,.092,.105),.65)
cream=mat('Woven ivory sail',(.72,.66,.49)); teal=mat('Blue green sail hem',(.10,.26,.25))
rope=mat('Hemp rigging',(.30,.25,.14)); glass=mat('Amber lantern glass',(.95,.49,.13),0,2.5)
navy=mat('Midnight hull panels',(.035,.085,.13))
def mesh(name,verts,faces,m):
    data=bpy.data.meshes.new(name); data.from_pydata([vec(v) for v in verts],[],faces); data.update()
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.data.materials.append(m); return o
def box(name,p,scale,m,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=vec(p)); o=bpy.context.object; o.name=name
    o.scale=(scale[0],scale[2],scale[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if bevel:
        mod=o.modifiers.new('Worn edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def rod(name,a,b,r,m,vertices=10):
    av,bv=vec(a),vec(b);d=bv-av
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=(av+bv)/2)
    o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m);return o
def line(name,points,r,m):
    # Closed polygonal tube, bevelled by Blender, exported as triangles.
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=r;data.bevel_resolution=1;data.resolution_u=1
    s=data.splines.new('POLY');s.points.add(len(points)-1)
    for q,p in zip(s.points,points):q.co=(*vec(p),1)
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(m);return o
profile=[(-14,4.8),(-12.5,6.25),(-8,6.6),(-3.5,6.35),(2.5,5.85),(7,5.4),(10.5,4.95),(13,2.8),(15,.15)]
def width(z):
    for (a,wa),(b,wb) in zip(profile,profile[1:]):
        if a<=z<=b:return wa+(wb-wa)*(z-a)/(b-a)
    return profile[0][1] if z<profile[0][0] else profile[-1][1]
stations=[-14+i*.5 for i in range(59)]
# Curved hull, six distinct strakes with real small seams.
for side in [-1,1]:
    for band in range(6):
        t0=band/6+.007;t1=(band+1)/6-.007;vs=[]
        for z in stations:
            for t in [t0,t1]:
                h=-.10-3.4*t; w=width(z)*(1-.79*t*t)
                vs.append((side*w,h,z))
        fs=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(stations)-1)]
        if side==1:fs=[tuple(reversed(f)) for f in fs]
        mesh('Hull strake %s %s'%(side,band),vs,fs,planks[band%5] if band<2 else wood)
    for y,factor in [(-.1,1),(-1.35,.88),(-2.5,.61)]:
        line('Continuous brass hull rubbing rail',[(side*width(z)*factor,y,z) for z in stations],.085,brass)
# Deck timber runs with staggered butt joints; curved outer cuts follow hull.
for row in range(58):
    za=-14+row*.5;zb=za+.48;w=min(width(za),width(zb))-.08
    mesh('Deck timber %02d'%row,[(-w,-.015,za),(w,-.015,za),(w,-.015,zb),(-w,-.015,zb)],[(0,3,2,1)],planks[row%5])
    for x in [-w*.6,0,w*.6]:
        rod('Deck countersunk pin',(x,.003,za+.12),(x,.013,za+.12),.024,iron,6)
# Gunwales, posts and individually fitted stanchions.
for side in [-1,1]:
    for z in [-13+i*1.4 for i in range(20)]:
        x=side*(width(z)-.15)
        rod('Rail stanchion',(x,0,z),(x,1.13,z),.075,wood)
        rod('Stanchion brass shoe',(x,.03,z),(x,.22,z),.115,brass)
    for y,r,m in [(1.15,.11,wood),(.52,.045,brass)]:
        line('Sweeping side rail',[(side*(width(z)-.15),y,z) for z in stations],r,m)
line('Stern rail',[(-4.7,1.15,-14),(0,1.15,-14),(4.7,1.15,-14)],.11,wood)
rod('Bow sprit',(0,.1,12),(0,1.2,18),.18,wood)
line('Bow brass tip',[(0,1.2,18),(0,1.4,18.4)],.15,brass)
# Brass-rimmed portholes and inset blue panels read from the exterior.
for side in [-1,1]:
    for z in [-10,-6,-2,2,6,10]:
        x=side*width(z)*.91
        box('Navy hull inset',(x,-1.02,z),(.08,.85,1.65),navy,.04)
        rod('Porthole brass rim',(x,-.96,z),(x+side*.14,-.96,z),.25,brass,16)
        rod('Porthole warm glass',(x+side*.145,-.96,z),(x+side*.16,-.96,z),.17,glass,16)
# Off-centre mast gives the central route room to breathe.
mx,mz=-3.0,2.8
rod('Main tapered mast',(mx,0,mz),(mx,13.7,mz),.20,wood,16)
for y in [.18,.52,4.8,8.8,12.7]:rod('Mast collar',(mx,y,mz),(mx,y+.16,mz),.24,brass,16)
rod('Main boom',(mx,6.3,mz),(5.3,6.3,mz),.13,wood)
# Belly-shaped triangular cloth surface with a blue-green perimeter stripe.
def sailpoint(u,v):return(mx+8.3*u*(1-v),6.4+6.9*v,mz+.85*math.sin(math.pi*u)*math.sin(math.pi*v))
vs=[];N=18
for j in range(N+1):
    for i in range(N+1):vs.append(sailpoint(i/N,j/N))
fs=[]
for j in range(N):
    for i in range(N):a=j*(N+1)+i;fs.append((a,a+1,a+N+2,a+N+1))
sail=mesh('Billowing ivory solar sail',vs,fs,cream)
mod=sail.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.012
bpy.context.view_layer.objects.active=sail;bpy.ops.object.modifier_apply(modifier=mod.name)
for v in [.08,.85]:line('Sail contrasting hem',[sailpoint(i/20,v) for i in range(21)],.052,teal)
for u in [.05,.95]:line('Sail vertical hem',[sailpoint(u,i/20) for i in range(21)],.048,teal)
for u in [.25,.5,.75]:line('Sail stitched panel',[sailpoint(u,i/20) for i in range(21)],.009,rope)
# Compass rose is real geometry on the sail rather than a franchise emblem.
sv=[sailpoint(.44,.40)]
for i in range(16):
    a=i*math.pi/8;r=.17 if i%2==0 else .055
    sv.append(sailpoint(.44+math.cos(a)*r,.40+math.sin(a)*r))
sv=[(x,y,z+.022)for x,y,z in sv]
mesh('Sail compass rose',sv,[(0,i+1,(i+1)%16+1)for i in range(16)],teal)
for side in [-1,1]:
    for z in [-3,7]:line('Standing rigging',[(mx,12.8,mz),(side*(width(z)-.2),1.05,z)],.033,rope)
# Compact stern cabin, rounded roof and individual framed panels.
cx,cz=-4.05,-10.5
box('Cabin body',(cx,1.45,cz),(3.15,2.9,3.8),wood,.08)
for x in [cx-1.48,cx+1.48]:box('Cabin corner post',(x,1.5,cz+1.96),(.13,3,.16),brass,.025)
for i in range(9):
    z=cz-2+i*.5
    line('Arched roof rib',[(cx+1.7*math.cos(a*math.pi/12),2.8+.75*math.sin(a*math.pi/12),z)for a in range(13)],.09,wood)
vs=[]
for z in [cz-2.15,cz+2.15]:
    for i in range(17):a=i*math.pi/16;vs.append((cx+1.72*math.cos(a),2.8+.78*math.sin(a),z))
mesh('Curved cabin roof',vs,[(i,i+1,i+18,i+17)for i in range(16)],wood)
for z in [cz-1.8,cz-.6,cz+.6,cz+1.8]:
    line('Roof brass strap',[(cx+1.74*math.cos(i*math.pi/20),2.8+.80*math.sin(i*math.pi/20),z)for i in range(21)],.045,brass)
box('Cabin door',(cx,1.1,cz+1.96),(1.05,2.2,.09),planks[0],.03)
for x in [-.34,0,.34]:box('Door plank seam',(cx+x,1.08,cz+2.02),(.018,2.04,.02),dark)
rod('Round door window',(cx,1.62,cz+2.03),(cx,1.62,cz+2.08),.30,brass,24)
rod('Warm cabin window',(cx,1.62,cz+2.085),(cx,1.62,cz+2.09),.245,glass,24)
rod('Door handle',(cx+.36,.88,cz+2.06),(cx+.36,.88,cz+2.18),.06,brass)
# Lamps: emissive panes, not one dynamic shadow light per lamp.
def lantern(x,y,z):
    box('Lantern glass',(x,y,z),(.22,.4,.22),glass,.01)
    for dy in [-.25,.25]:box('Lantern cap',(x,y+dy,z),(.36,.10,.36),brass,.035)
    for dx in [-.145,.145]:
        for dz in [-.145,.145]:rod('Lantern cage',(x+dx,y-.22,z+dz),(x+dx,y+.22,z+dz),.018,iron,6)
    line('Lantern hook',[(x,y+.3,z),(x,y+.6,z),(x-.3,y+.7,z)],.035,brass)
for p in [(-5.7,1.8,-8),(5.7,1.8,-8),(-4.8,1.8,7),(4.8,1.8,7),(-2.7,2.4,-8.5)]:lantern(*p)
# Retrieval winch on starboard, visible handle, cable drum and pulley.
wx,wz=4.3,4
box('Winch plinth',(wx,.4,wz),(1.05,.8,.85),wood,.06)
rod('Cable drum',(wx-.55,1.03,wz),(wx+.55,1.03,wz),.29,brass,20)
for i in range(14):
    a=i*math.pi/7
    line('Coiled rope on drum',[(wx-.42+k*.055,1.03+.30*math.cos(a+k*.5),wz+.30*math.sin(a+k*.5))for k in range(17)],.018,rope)
rod('Crank axle',(wx-.7,1.03,wz),(wx-.9,1.03,wz),.06,iron)
rod('Winch crank',(wx-.9,1.03,wz),(wx-.9,1.45,wz),.05,brass)
rod('Crank grip',(wx-.9,1.45,wz),(wx-1.15,1.45,wz),.08,wood)
line('Retrieval davit',[(wx,.5,wz),(wx,2.4,wz),(wx+1.2,3,wz)],.1,brass)
# Tied cargo at the perimeter, ribbed barrels and rope coils.
for x,z in [(-4.5,6),(-4.7,-4),(5.25,-2.4)]:
    for y in [.3,.9]:
        box('Travel crate',(x,y,z),(.85,.56,.8),planks[1],.035)
        for dx in [-.28,.28]:box('Crate strap',(x+dx,y,z),(.07,.59,.83),iron)
for x,z in [(4.7,-10),(-4.7,-.8)]:
    rod('Storage barrel',(x,.05,z),(x,1.1,z),.43,planks[2],12)
    for y in [.18,.58,1.0]:rod('Barrel iron hoop',(x,y,z),(x,y+.06,z),.45,iron,12)
# Save editable source, then batch only export objects by material to limit draw calls.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art/starsail/starsail-v01.blend'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.convert(target='MESH')
groups={}
for o in list(bpy.context.scene.objects):
    if o.type=='MESH':groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=name
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'assets/models/starsail-v01.glb'),export_format='GLB',use_selection=True,export_yup=True)
print('STARSAIL_EXPORT',sum(len(o.data.polygons)for o in bpy.context.scene.objects if o.type=='MESH'),'polygons',len(groups),'materials')
