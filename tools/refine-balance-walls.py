"""Replace only repetitive constellation strokes and wall cores in the preserved v05 source."""
import bpy,json,hashlib,random,math,struct,sys
from pathlib import Path
R=Path(__file__).resolve().parent.parent;A=R/'art/balance-walls/v01';A.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(R/'tools/blender'))
from asset_detail_helpers import material,export
bpy.ops.wm.open_mainfile(filepath=str(R/'art/balance-paving/v01/balance-temple-v05.blend'))
def fingerprints():
    result={}
    for o in bpy.context.scene.objects:
        if o.type not in ['MESH','CURVE']:continue
        points=[tuple(v.co) for v in o.data.vertices] if o.type=='MESH' else [[tuple(p.co) for p in s.points] for s in o.data.splines]
        result[o.name]=hashlib.sha256(repr((tuple(tuple(row) for row in o.matrix_world),points,[m.name for m in o.data.materials])).encode()).hexdigest()
    return result
before=fingerprints();rng=random.Random(20261025)
grids={step:[[rng.uniform(-1,1) for x in range(256//step+2)]for y in range(256//step+2)]for step in [32,8]}
def noise(x,y,step):
    g=grids[step];u=x/step;v=y/step;i=int(u);j=int(v);u-=i;v-=j;u=u*u*(3-2*u);v=v*v*(3-2*v)
    return(g[j][i]*(1-u)+g[j][i+1]*u)*(1-v)+(g[j+1][i]*(1-u)+g[j+1][i+1]*u)*v
im=bpy.data.images.new('Balance wall mineral grain',256,256);pixels=[]
def srgb(v):return v*12.92 if v<=.0031308 else 1.055*v**(1/2.4)-.055
for y in range(256):
    for x in range(256):
        q=noise(x,y,32)*.004+noise(x,y,8)*.002+rng.uniform(-.0015,.0015)
        # Generated PNG channels are stored as given; encode desired linear stone colors.
        pixels.extend([srgb(.065+q),srgb(.105+q),srgb(.11+q),1])
im.pixels=pixels;im.filepath_raw=str(A/'wall-mineral.png');im.file_format='PNG';im.save();im.pack()
stone=material('Balance wall ashlar',(1,1,1),roughness=.95);node=stone.node_tree.nodes.new('ShaderNodeTexImage');node.image=im;stone.node_tree.links.new(node.outputs['Color'],stone.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
bed=material('Balance wall backing',(.055,.08,.08),roughness=.98)
def box(name,pos,size,mat,parent,bevel=0):
    # Data API avoids repeated whole-scene dependency updates for hundreds of blocks.
    x,y,z=pos[0],-pos[2],pos[1];w,d,h=size[0]/2,size[2]/2,size[1]/2
    vertices=[(x-w,y-d,z-h),(x+w,y-d,z-h),(x+w,y+d,z-h),(x-w,y+d,z-h),(x-w,y-d,z+h),(x+w,y-d,z+h),(x+w,y+d,z+h),(x-w,y+d,z+h)]
    faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.parent=parent;data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Dressed stone chamfer','BEVEL');mod.width=bevel;mod.segments=1
    uv=data.uv_layers.new(name='Wall grain UV');ox,oy=rng.random()*3,rng.random()*3
    for loop in data.loops:
        p=data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(p.y*.3+ox,p.z*.3+oy)
    return o
removed=[];layouts=[]
for name,w,length,h in [('hall_order',14,18,9),('hall_twin',14,16,9),('hall_lever',18,28,11),('hall_entry',6,12,8),('hall_corridor',5,4,8)]:
    root=bpy.data.objects[name];old=[o for o in root.children_recursive if o.name.startswith(('Constellation','Recessed wall'))]
    removed.extend(o.name for o in old)
    for o in old:bpy.data.objects.remove(o,do_unlink=True)
    rows=math.floor(h/1.45+.5);cols=max(1,math.floor(length/2.8+.5));dz=length/cols;dy=h/rows;blocks=[]
    for side in [-1,1]:
        box('Wall backing '+name+str(side),(side*(w/2+.24),h/2,0),(.26,h,length),bed,root)
        for row in range(rows):
            cuts=sorted(set([-length/2,length/2]+[-length/2+(i+(.5 if row%2 else 0))*dz for i in range(cols+1) if -length/2+.001<-length/2+(i+(.5 if row%2 else 0))*dz<length/2-.001]))
            for col,(lo,hi) in enumerate(zip(cuts,cuts[1:])):
                y0=row*dy+.006;y1=(row+1)*dy-.006;z0=lo+.006;z1=hi-.006
                o=box('Wall ashlar '+name+' '+str(side)+' '+str(row)+' '+str(col),(side*(w/2+.05),(y0+y1)/2,(z0+z1)/2),(.12,y1-y0,z1-z0),stone,root,.012)
                blocks.append({'name':o.name,'side':side,'y0':y0,'y1':y1,'z0':z0,'z1':z1,'frontX':side*(w/2-.01)})
    layouts.append({'root':name,'width':w,'length':length,'height':h,'rows':rows,'columns':cols,'blocks':blocks,'removed':[o.name for o in []]})
    print('WALL_ROOM',name,len(blocks),flush=True)
after=fingerprints();untouched={n:v for n,v in before.items() if n not in removed};assert all(after.get(n)==v for n,v in untouched.items())
assert len(removed)==210,(len(removed),[n for n in removed if not n.startswith('Constellation')])
(A/'layout.json').write_text(json.dumps({'rooms':layouts,'removed':removed,'datum':0},indent=2))
export('art/balance-walls/v01/balance-temple-v06.blend','art/balance-walls/v01/balance-temple-v06.glb')
raw=(A/'balance-temple-v06.glb').read_bytes();g=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]]);primitives=[p for m in g['meshes']for p in m['primitives']]
metrics={'pass':True,'removedObjects':len(removed),'removedConstellations':sum(n.startswith('Constellation')for n in removed),'blocks':sum(len(r['blocks'])for r in layouts),'preservedSourceObjects':len(untouched),'preservedHash':hashlib.sha256(json.dumps(untouched,sort_keys=True).encode()).hexdigest(),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'meshes':len(g['meshes']),'materials':len(g['materials']),'triangles':sum(g['accessors'][p['indices']]['count']//3 for p in primitives)}
(A/'metrics.json').write_text(json.dumps(metrics,indent=2));print('BALANCE_WALLS_READY',json.dumps(metrics),flush=True)
