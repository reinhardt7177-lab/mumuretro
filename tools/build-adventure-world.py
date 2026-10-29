"""Original six science portals and two shared low-cost field boulders.
Blender Z-up source -> glTF Y-up. New version; never overwrites heritage.
Run -- --previs before the detailed build to retain exact-scale design views.
"""
import bpy, bmesh, math, json, random, sys
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/adventure-world/v01';OUT=ROOT/'assets/models/adventure'
SPEC=json.loads((ART/'design-spec.json').read_text(encoding='utf8'))
PREVIS='--previs' in sys.argv
SKIP_RENDER='--skip-render' in sys.argv
ART.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8 if PREVIS else 16
scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world.color=(.32,.39,.44);scene.view_settings.view_transform='AgX'

def rgb(hex):return tuple(int(hex[i:i+2],16)/255 for i in(1,3,5))
def mat(name,colour,metal=0,rough=.78,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb(colour),1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=m.diffuse_color
    bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    if emission:bs.inputs['Emission Color'].default_value=m.diffuse_color;bs.inputs['Emission Strength'].default_value=emission
    return m

# Native generated 512px texture, not unsupported procedural glTF shader nodes.
n=SPEC['boulders']['textureSize'];yy,xx=np.mgrid[0:n,0:n].astype(np.float32)/n
grain=.5+.12*np.sin(xx*31+np.sin(yy*15)*2)+.07*np.cos(yy*73+xx*13)+.025*np.sin(xx*477+yy*311)
vein=np.exp(-((np.sin(xx*11+yy*15+np.sin(yy*8)*.8))/.09)**2)*.09
pixels=np.empty((n,n,4),dtype=np.float32)
for k,base in enumerate((.77,.79,.75)):pixels[:,:,k]=np.clip(base+(grain-.5)*.36+vein,.1,1)
pixels[:,:,3]=1
image=bpy.data.images.new('Mumu mineral grain 512',width=n,height=n,alpha=True);image.pixels.foreach_set(pixels.ravel());image.filepath_raw=str(ART/'mineral-grain.png');image.file_format='PNG';image.save();image.pack()
palette=SPEC['palette'];stone=mat('Mumu ivory limestone',palette['limestone']);ivory=mat('Mumu chisel edges',palette['ivory']);slate=mat('Mumu blue slate',palette['slate']);brass=mat('Mumu satin brass',palette['bronze'],.72,.36);dark=mat('Mumu recessed bronze',palette['dark'],.35,.65);ice=mat('Mumu layered glacier',palette['ice'],.12,.24)
for m in[stone,ivory,slate,ice]:
    node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    # Neutral stone colour is baked into the texture; vertex tint carries palette.
    m.node_tree.links.new(node.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

objects=[]
def finish(o,name,m):o.name=name;o.data.materials.append(m);objects.append(o);return o
def box(name,p,size,m,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=finish(bpy.context.object,name,m);o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel and not PREVIS:
        mod=o.modifiers.new('Cut stone arris','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def cylinder(name,p,r,depth,m,vertices=16,r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=depth,location=p);return finish(bpy.context.object,name,m)
def rod(name,a,b,r,m,vertices=8):
    a,b=Vector(a),Vector(b);d=b-a;o=cylinder(name,(a+b)*.5,r,d.length,m,vertices);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def mesh(name,vertices,faces,m):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);return finish(o,name,m)
def ring(name,p,r,tube,m,arc=2*math.pi,start=0,segments=48):
    # In the frontal XZ plane, not a flat horizontal ring.
    vertices=[];faces=[]
    for i in range(segments+1):
        a=start+arc*i/segments
        for j in range(6):
            b=j*math.pi/3;rr=r+tube*math.cos(b);vertices.append((p[0]+rr*math.cos(a),p[1]+tube*math.sin(b),p[2]+rr*math.sin(a)))
    for i in range(segments):
        for j in range(6):a=i*6+j;b=i*6+(j+1)%6;faces.append((a,b,b+6,a+6))
    return mesh(name,vertices,faces,m)
def annulus(name,z,r,thick,depth,m,segments=48):
    vertices=[]
    for dz in[-depth/2,depth/2]:
        for rr in[r-thick,r]:
            for i in range(segments):a=i*2*math.pi/segments;vertices.append((rr*math.cos(a),rr*math.sin(a),z+dz))
    faces=[]
    for i in range(segments):
        j=(i+1)%segments
        for a,b in[(0,segments),(segments,segments*3),(segments*3,segments*2),(segments*2,0)]:faces.append((a+i,a+j,b+j,b+i))
    return mesh(name,vertices,faces,m)
def blocks(x,height,wide=1.25):
    for i in range(math.ceil(height/.62)):
        h=min(.60,height-i*.62)
        if h>0:box('Laid stone course',(x,0,i*.62+h/2+.16),(wide,2.45,h),stone)
    box('Side footing',(x,0,.08),(1.82,2.9,.16),slate)
    box('Footing arris',(x,-.01,.18),(1.64,2.72,.12),ivory)
def arch(z=3.25,r=1.22,width=.32,m=ivory):
    for i in range(13):
        a=i*math.pi/13+.009;b=(i+1)*math.pi/13-.009
        v=[(rr*math.cos(t),y,z+rr*math.sin(t))for y in[-1.30,-.70]for rr in[r,r+width]for t in[a,b]]
        mesh('Keyed voussoir',v,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],m)
def seam(x,z,length=.7):box('Incised brass seam',(x,-1.255,z),(length,.018,.018),brass,0)

def build_gate(spec):
    global objects
    objects=[];kind=spec['id'];accent=mat('Mumu '+kind+' light',spec['accent'],.15,.4,.45)
    for x in[-2.05,2.05]:
        blocks(x,4.1 if kind!='strata' else 6.1)
        # Recessed channels and bands, following the built stone faces.
        for z in[.60,1.84,3.08]:
            seam(x,z,.98)
            if not PREVIS:
                for dx in[-.39,.39]:box('Carved edge channel',(x+dx,-1.257,z+.26),(.024,.022,.34),slate,0)
        box('Inner reveal',(x*.67,-1.20,1.85),(.16,.21,3.30),ivory)
        box('Low inset lamp',(x*.68,-1.32,1.10),(.055,.06,.65),accent,0)
    # No central plinth or stair: the planet surface remains the only floor.
    if kind not in['shadow','strata']:
        arch();box('Back lintel',(0,.60,3.76),(2.65,.65,.40),slate)
    if kind=='balance':
        for x in[-2.05,2.05]:
            for dx in[-.36,-.18,0,.18,.36]:rod('Fluted column rib',(x+dx,-1.32,.42),(x+dx,-1.32,4.35),.048,ivory,8)
            box('Column abacus',(x,0,4.40),(1.6,2.7,.25),ivory)
        for a,b in[((-3.1,-.2,4.64),(0,-.2,6.1)),((0,-.2,6.1),(3.1,-.2,4.64)),((-3.1,-.2,4.64),(3.1,-.2,4.64))]:rod('Pediment beam',a,b,.18,stone)
        rod('Balance arm',(-1.03,-1.43,4.89),(1.03,-1.43,4.89),.055,brass)
        ring('Balance fulcrum',(0,-1.44,4.89),.18,.045,brass,segments=24)
        rod('Fulcrum spindle',(0,-1.43,4.58),(0,-1.43,5.45),.045,brass)
        for x in[-.83,.83]:
            rod('Suspended cable',(x,-1.43,4.87),(x,-1.43,4.33),.018,brass,6)
            cylinder('Balance pan',(x,-1.43,4.30),.28,.10,brass,16,.18)
    elif kind=='shadow':
        for x,top in[(-2.20,6.6),(2.20,6.24)]:
            sign=1 if x>0 else -1
            mesh('Split slate fin',[(x-.47,-1.2,3.9),(x+.47,-1.2,3.9),(x+.47,-1.2,top-.45),(x-.47,-1.2,top),(x-.47,.75,3.9),(x+.47,.75,3.9),(x+.47,.75,top-.45),(x-.47,.75,top)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],slate)
            rod('Fin brass edge',(x-sign*.43,-1.23,3.9),(x-sign*.43,-1.23,top-.4),.026,brass,6)
        ring('Split lunette',(0,-.38,4.95),1.10,.065,brass,math.pi*1.72,math.pi*.14)
        for x in[-2.03,2.03]:
            ring('Sky mirror rim',(x,-1.34,3.08),.32,.04,brass,segments=32)
            o=cylinder('Mirror inset',(x,-1.35,3.08),.29,.035,accent,32);o.rotation_euler.x=math.pi/2
        rod('Lunette needle',(0,-.40,3.85),(0,-.40,6.4),.028,brass,6)
        for sign in[-1,1]:rod('Lunette cradle',(sign*1.65,-.38,4.18),(sign*.97,-.38,5.45),.065,brass)
    elif kind=='sift':
        box('Crown support',(0,0,4.18),(6.15,2.8,.28),ivory)
        for i,(z,r)in enumerate([(4.50,3.04),(5.05,2.77),(5.55,2.49)]):
            for o in[annulus('Sieve stone rim',z,r,.18,.16,stone),annulus('Sieve brass rim',z+.22,r-.07,.045,.045,brass)]:
                for v in o.data.vertices:v.co.y*=.46
            for j in range(32):
                a=j*math.pi/16;p=((r-.11)*math.cos(a),(r-.11)*math.sin(a),z+.13)
                o=box('Perforated screen rib',p,(.095,.13,.24),brass,0);o.rotation_euler.z=a;o.location.y*=.46
        for j in range(12):
            a=j*math.pi/6
            rod('Crown structural rib',(2.96*math.cos(a),2.96*.46*math.sin(a),4.24),(2.42*math.cos(a),2.42*.46*math.sin(a),5.75),.06,brass)
        for x in[-2.05,2.05]:
            for i in range(4):
                o=ring('Sediment tray relief',(x,-1.30,.9+i*.65),.35,.025,brass,math.pi,math.pi,20)
    elif kind=='water':
        for sign in[-1,1]:
            box('Wave spring capital',(sign*1.82,-.10,4.30),(1.28,2.5,.30),ivory)
            for i in range(5):
                x=sign*(1.90+i*.20);z=3.35+i*.59;y=.15+i*.12
                # Flat, planar ice strata; a prism, never a sphere/round shell.
                v=[(x-sign*.16,y-.52,0),(x+sign*.25,y-.52,.12),(x+sign*.34,y-.52,z+.4),(x-sign*.16,y-.52,z),
                   (x-sign*.16,y+.55,0),(x+sign*.25,y+.55,.12),(x+sign*.34,y+.55,z+.4),(x-sign*.16,y+.55,z)]
                mesh('Planar glacier blade',v,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],ice)
                for zz in[1.2,2.4,3.3]:rod('Ice sediment seam',(x-sign*.15,y-.54,zz),(x+sign*.23,y-.54,zz+.13),.015,ivory,6)
            rod('Wave pediment',(-1.6*sign,-.68,4.55),(0,-.68,6.5),.17,ivory)
        for z,r in[(3.25,1.32),(3.3,1.65)]:ring('Water ripple cornice',(0,-1.34,z),r,.032,brass,math.pi,0)
        o=cylinder('Water crest jewel',(0,-.87,5.62),.21,.10,accent,20);o.rotation_euler.x=math.pi/2
        rod('Crest jewel suspension',(0,-.87,5.62),(0,-.68,6.35),.032,brass,6)
    elif kind=='fire':
        box('Vented chimney',(0,.15,5.31),(.62,1.2,2.02),slate)
        for i in range(9):box('Chimney slot',(0,-.47,4.54+i*.18),(.31,.035,.063),accent,0)
        ring('Casting collar',(0,-.95,4.45),.92,.13,brass,segments=40)
        for sign in[-1,1]:
            rod('Furnace roof girder',(sign*2.8,.15,4.18),(0,.15,5.8),.18,slate)
            for i in range(5):
                a=(sign*(1.45+i*.23),-.45,4.65-i*.10);b=(sign*(1.0+i*.18),.7,5.25-i*.08)
                rod('Cooling fin',a,b,.11,brass)
            for z in[.85,1.16,1.47]:box('Side furnace slot',(sign*2.05,-1.28,z),(.54,.04,.065),accent,0)
            rod('Thermal inlay',(sign*2.5,-1.28,1.9),(sign*2.5,-1.28,3.55),.025,accent,6)
    else:
        for sign in[-1,1]:
            for i in range(9):
                x=sign*(2.0+(.10 if i%2 else -.08));z=.34+i*.69
                box('Sedimentary course',(x,0,z),(1.55,2.7,.58),ivory if i%3==1 else slate)
                if not PREVIS:
                    for j in range(4):seam(x+.08*math.sin(j*3+i),z-.18+j*.10,.81)
            box('Twin crown',(sign*2.02,0,6.55),(1.62,2.8,.30),stone)
        ring('Chronicle orbit',(0,-.12,5.6),.91,.045,brass,math.pi*1.9,.15,48)
        rod('Orbital arm',(-1.9,-.12,5.59),(1.9,-.12,5.59),.035,brass)
        cylinder('Chronicle spindle',(0,-.12,5.6),.18,.46,brass,16)
        for sign in[-1,1]:rod('Hourglass reveal',(sign*1.35,-1.28,3.4),(sign*.36,-1.28,4.5),.055,ivory)
    # Palette is kept in vertex colours, so one neutral mineral texture can be shared.
    joined=[]
    materials=list(dict.fromkeys(o.data.materials[0] for o in objects))
    groups={m:[o for o in objects if o.data.materials[0]==m] for m in materials}
    for m,group in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        if len(group)>1:bpy.ops.object.join()
        o=group[0];o.name=kind+'_'+m.name.replace(' ','_');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        tri=o.modifiers.new('Web triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
        if m in[stone,ivory,slate,ice]:
            tint=o.data.color_attributes.new(name='Tint',type='FLOAT_COLOR',domain='CORNER');base=m.diffuse_color
            for p in o.data.polygons:
                factor=.94+.06*math.sin(p.center.x*16+p.center.y*21+p.center.z*29)
                for li in p.loop_indices:tint.data[li].color=(*[base[k]*factor for k in range(3)],1)
        bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.01);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
        joined.append(o)
    bottom=min(v.co.z for o in joined for v in o.data.vertices);top=max(v.co.z for o in joined for v in o.data.vertices)
    minX=min(v.co.x for o in joined for v in o.data.vertices);maxX=max(v.co.x for o in joined for v in o.data.vertices)
    minY=min(v.co.y for o in joined for v in o.data.vertices);maxY=max(v.co.y for o in joined for v in o.data.vertices)
    for o in joined:
        for v in o.data.vertices:
            v.co.x=(v.co.x-(minX+maxX)/2)*SPEC['gate']['width']/(maxX-minX)
            v.co.y=(v.co.y-(minY+maxY)/2)*SPEC['gate']['depth']/(maxY-minY)
            v.co.z=(v.co.z-bottom)*spec['height']/(top-bottom)
    return joined

def export(parts,file):
    bpy.ops.object.select_all(action='DESELECT')
    visibility=[(o,o.hide_get(),o.hide_render)for o in parts]
    for o in parts:o.hide_set(False);o.hide_render=False;o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/file),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_vertex_color='NAME',export_vertex_color_name='Tint')
    for o,hidden,render in visibility:o.hide_set(hidden);o.hide_render=render
def metrics(parts):
    vertices=[o.matrix_world@v.co for o in parts for v in o.data.vertices]
    return {'meshes':len(parts),'materials':len({m for o in parts for m in o.data.materials}),'triangles':sum(len(p.vertices)-2 for o in parts for p in o.data.polygons),'min':[min(v[i] for v in vertices)for i in range(3)],'max':[max(v[i] for v in vertices)for i in range(3)]}

gates={};stats={}
for spec in SPEC['temples']:
    parts=build_gate(spec);gates[spec['id']]=parts;stats[spec['id']]=metrics(parts)
    assert stats[spec['id']]['triangles']<=SPEC['gate']['maximumTriangles'],stats[spec['id']]
    assert stats[spec['id']]['meshes']<=SPEC['gate']['maximumMeshes']
    if not PREVIS:export(parts,'portal-'+spec['id']+'-v01.glb')
    for o in parts:o.hide_render=True;o.hide_set(True)

# Low-cost field boulders: same size/placement as the existing scatter, new silhouette.
boulders=[];rockMat=mat('Mumu field granite','#ffffff')
node=rockMat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;rockMat.node_tree.links.new(node.outputs['Color'],rockMat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for variant in range(SPEC['boulders']['variants']):
    rng=random.Random(612+variant);N=SPEC['boulders']['ringVertices'];height=SPEC['boulders']['height'][variant];verts=[]
    for ringIndex,(z,radius) in enumerate([(0,.78),(.14,1),(.40,.96),(.78,.73),(1,.33)]):
        for j in range(N):
            angle=j*2*math.pi/N;rr=SPEC['boulders']['radius']*radius*(.87+rng.random()*.10)
            verts.append((math.cos(angle)*rr,math.sin(angle)*rr*(.94 if variant else 1),z*height+(rng.random()-.5)*.035*(0 if not ringIndex else 1)))
    faces=[]
    for k in range(4):
        for j in range(N):faces.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
    faces.extend([tuple(reversed(range(N))),tuple(4*N+j for j in range(N))]);o=mesh('field_rock_'+str(variant),verts,faces,rockMat)
    top=max(v.co.z for v in o.data.vertices)
    for v in o.data.vertices:v.co.z*=height/top
    tri=o.modifiers.new('Web triangles','TRIANGULATE');bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=tri.name)
    uv=o.data.uv_layers.new(name='UVMap')
    for polygon in o.data.polygons:
        axis=max(range(3),key=lambda k:abs(polygon.normal[k]));a,b=[k for k in range(3)if k!=axis]
        for li in polygon.loop_indices:v=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(v[a]*1.2,v[b]*1.2)
    boulders.append(o);o.hide_render=True;o.hide_set(True)
stats['boulders']=metrics(boulders)
if not PREVIS:
    export(boulders,'field-boulders-v01.glb')
    (OUT/'world-art-v01.json').write_text(json.dumps(SPEC,ensure_ascii=False,indent=2),encoding='utf8')

# Neutral mineral texture and vertex palette are exported above. The source
# inspection lights use the same palette as base colour, with packed texture
# nodes retained for editing; this studio render is not a WebGL screenshot.
for m in[stone,ivory,slate,ice]:
    socket=m.node_tree.nodes.get('Principled BSDF').inputs['Base Color']
    for link in list(socket.links):m.node_tree.links.remove(link)
    socket.default_value=m.diffuse_color

# Same exact orthographic cameras, before integration and after final modelling.
bpy.ops.object.camera_add(location=(9,-15,8));camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=8.7
def aim(point):camera.rotation_euler=(Vector(point)-camera.location).to_track_quat('-Z','Y').to_euler()
for location,power,size in[((-5,-8,10),1800,8),((5,4,7),1400,7)]:
    bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
floor=box('Studio ground',(0,0,-.12),(200,200,.24),mat('Studio','#aeb5a7'),0)
for kind,parts in gates.items():
    for o in parts:o.hide_render=False;o.hide_set(False)
    for label,position in [('front',(0,-16,3.5)),('side',(16,0,3.5)),('back',(0,16,3.5))]:
        if not PREVIS and label!='front':continue
        camera.location=position;aim((0,0,3.35));scene.render.filepath=str(ART/(('plan-' if PREVIS else 'built-')+kind+'-'+label+'.png'))
        if not SKIP_RENDER:bpy.ops.render.render(write_still=True)
    for o in parts:o.hide_render=True;o.hide_set(True)
floor.hide_render=True;floor.hide_set(True)
# Preserve the six gates in one editable scene, arranged with ample working space.
for i,(kind,parts)in enumerate(gates.items()):
    for o in parts:o.hide_render=False;o.hide_set(False);o.location.x=(i%3)*8;o.location.y=(i//3)*10
for i,o in enumerate(boulders):o.hide_render=False;o.hide_set(False);o.location=(i*1.5,-4,0)
bpy.ops.wm.save_as_mainfile(filepath=str(ART/('world-previs-v01.blend' if PREVIS else 'world-portals-v01.blend')))
(ART/('plan-metrics.json' if PREVIS else 'model-metrics.json')).write_text(json.dumps(stats,indent=2),encoding='utf8')
print('MUMU_WORLD_ART_COMPLETE',json.dumps(stats))
