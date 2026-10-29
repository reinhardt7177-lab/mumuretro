"""Refine only five floor templates; retain original authoring file and all other parts."""
import bpy,json,math,random,hashlib,struct,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent;A=R/'art/balance-paving/v01';A.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(R/'tools/blender'))
from asset_detail_helpers import box,material,export
bpy.ops.wm.open_mainfile(filepath=str(R/'art/balance-temple/balance-temple-v04.blend'))
def signatures():
    out={}
    for o in bpy.context.scene.objects:
        if o.type not in ['MESH','CURVE']:continue
        geometry=[list(v.co) for v in o.data.vertices] if o.type=='MESH' else [[list(p.co) for p in s.points] for s in o.data.splines]
        value={'matrix':[v for row in o.matrix_world for v in row],'geometry':geometry,'materials':[m.name if m else None for m in o.data.materials]}
        out[o.name]=hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
    return out
before=signatures();rng=random.Random(20261025)
def h(x,y):return ((x*374761393+y*668265263+20261025)^((x+y)*1274126177))%65536/65535-.5
def noise(x,y,s):
    x/=s;y/=s;ix=math.floor(x);iy=math.floor(y);a=x-ix;b=y-iy;a=a*a*(3-2*a);b=b*b*(3-2*b)
    return (h(ix,iy)*(1-a)+h(ix+1,iy)*a)*(1-b)+(h(ix,iy+1)*(1-a)+h(ix+1,iy+1)*a)*b
im=bpy.data.images.new('Balance paving fine limestone',256,256);pixels=[]
for y in range(256):
    for x in range(256):
        q=noise(x,y,41)*.035+noise(x,y,9)*.018+rng.uniform(-.006,.006)
        pixels.extend([.52+q,.51+q,.46+q,1])
im.pixels=pixels;im.filepath_raw=str(A/'limestone-grain.png');im.file_format='PNG';im.save();im.pack()
floor=material('Balance paving limestone',(1,1,1),roughness=.93)
node=floor.node_tree.nodes.new('ShaderNodeTexImage');node.image=im;floor.node_tree.links.new(node.outputs['Color'],floor.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
bed=material('Balance paving bed',(.25,.27,.25),roughness=.98)
layouts=[];removed=[]
for name,w,length in [('hall_order',14,18),('hall_twin',14,16),('hall_lever',18,28),('hall_entry',6,12),('hall_corridor',5,4)]:
    root=bpy.data.objects[name];old=[o for o in root.children_recursive if o.name.startswith(('Floor tessera','Floor medallion','Path inlay','V04 compass floor index'))]
    removed.extend(o.name for o in old)
    for o in old:bpy.data.objects.remove(o,do_unlink=True)
    foundation=box('Paving foundation '+name,(0,-.1725,0),(w+.6,.255,length),bed,root,0)
    # Round halves up: Python round(2.5) rounds to2 and underfills the entry/corridor design.
    columns=max(1,math.floor(w/2.4+.5));rows=max(1,math.floor(length/1.6+.5));sx=w/columns;sz=length/rows;stones=[]
    for row in range(rows):
        cuts=sorted(set([-w/2,w/2]+[-w/2+(i+(.5 if row%2 else 0))*sx for i in range(columns+1) if -w/2+.001<-w/2+(i+(.5 if row%2 else 0))*sx<w/2-.001]))
        for col,(lo,hi) in enumerate(zip(cuts,cuts[1:])):
            x0,x1=lo+.01,hi-.01;z0=-length/2+row*sz+.01;z1=-length/2+(row+1)*sz-.01
            o=box('Balance paving '+name+' row '+str(row)+' stone '+str(col),((x0+x1)/2,-.045,(z0+z1)/2),(x1-x0,.09,z1-z0),floor,root,.008)
            for layer in list(o.data.uv_layers):o.data.uv_layers.remove(layer)
            uv=o.data.uv_layers.new(name='Paving UV');ox,oy=rng.random()*4,rng.random()*4
            for loop in o.data.loops:
                p=o.matrix_world@o.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(p.x*.35+ox,p.y*.35+oy)
            stones.append({'name':o.name,'x0':x0,'x1':x1,'z0':z0,'z1':z1,'top':0,'bottom':-.09})
    layouts.append({'root':name,'width':w,'length':length,'columns':columns,'rows':rows,'stones':stones,'foundation':foundation.name,'removed':[o for o in removed if o in before and o not in {n for g in layouts for n in g['removed']}]})
    print('PAVING_ROOM',name,'rows',rows,'columns',columns,'stones',len(stones),flush=True)
after=signatures();untouched={n:s for n,s in before.items() if n not in removed};assert all(after.get(n)==s for n,s in untouched.items())
assert len(removed)==331 and sum(len(g['stones']) for g in layouts)==324, (len(removed),[len(g['stones']) for g in layouts])
(A/'layout.json').write_text(json.dumps({'rooms':layouts,'datum':{'top':0,'tileBottom':-.09,'foundationTop':-.045,'foundationBottom':-.3}},indent=2))
preserved={'pass':True,'count':len(untouched),'sha256':hashlib.sha256(json.dumps(untouched,sort_keys=True).encode()).hexdigest()}
bpy.context.scene['paving']='v05; local walking floor zero; reference DESIGN.md'
export('art/balance-paving/v01/balance-temple-v05.blend','art/balance-paving/v01/balance-temple-v05.glb')
raw=(A/'balance-temple-v05.glb').read_bytes();n=struct.unpack_from('<I',raw,12)[0];gltf=json.loads(raw[20:20+n]);primitives=[p for m in gltf['meshes'] for p in m['primitives']]
metrics={'pass':True,'removedSourceObjects':len(removed),'removedDecorationObjects':64,'removedTiles':267,'newTiles':324,'roots':len(layouts),'preservedObjects':preserved,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'meshes':len(gltf['meshes']),'primitives':len(primitives),'materials':len(gltf['materials']),'triangles':sum(gltf['accessors'][p['indices']]['count']//3 for p in primitives),'removedNames':removed}
(A/'metrics.json').write_text(json.dumps(metrics,indent=2));print('BALANCE_PAVING_READY',json.dumps({k:v for k,v in metrics.items() if k not in ['removedNames','preservedObjects']}))
