"""Continuous folded glacial walls; replaces only named ice scenery in preserved v04."""
import bpy,bmesh,os,sys,json,ast,math,random
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,material,mesh,line
ART=os.path.join(ROOT,'art/glacier-water-temple/interior/v07');OUT=os.path.join(ROOT,'unity/MumuPlanet/Assets/Mumu/Models/WaterInterior')
os.makedirs(ART,exist_ok=True)
source=open(os.path.join(ROOT,'tools/blender/build_water_interior_v02.py'),encoding='utf-8-sig').read()
source=source.replace('p=ob.matrix_world@geo.vertices[vi].co;', 'normal=(nm@geo.vertices[vi].normal).normalized() if ob.name.startswith("Cast bronze") else (nm@tri.normal).normalized();p=ob.matrix_world@geo.vertices[vi].co;')
tree=ast.parse(source);exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='export'],type_ignores=[]),'<export>','exec'))

def wall(name,u0,u1,transform,seed):
    rng=random.Random(seed);count=48;rows=23;verts=[]
    # Unequal longitudinal strata, with long vertical folds rather than random triangle colours.
    peaks=[rng.uniform(.3,1.4) for i in range(count+1)]
    def depth(u,y,i):
        return .22+peaks[i]*(.55+.45*math.sin(i*1.31)**2)+.18*math.sin(y*.55+u*.19)+.13*math.sin(y*1.3+u*.42)
    for j in range(rows+1):
        y=-3.8+j*.72
        for i in range(count+1):
            u=u0+(u1-u0)*i/count+.13*math.sin(y*.3+i*.9)
            verts.append(transform(u,y,depth(u,y,i)))
    faces=[]
    for j in range(rows):
        for i in range(count):
            a=j*(count+1)+i;faces.append((a,a+count+1,a+count+2,a+1))
    o=mesh(name,verts,faces,ice)
    o.data.materials.append(deep)
    for p in o.data.polygons:
        # Dark strata are continuous seams, not disconnected polygon patches.
        if p.index%count in [7,19,32,41]:p.material_index=1
    # Faceted overlapping shelves are attached to the wall and extend down into its base.
    for k in range(11):
        u=u0+(u1-u0)*(k+.5)/11;w=rng.uniform(.65,1.1);h=rng.uniform(6.8,11.5)
        v=[transform(u-w,-3.8,.9),transform(u+w,-3.8,1.15),transform(u+w,h-.8,1.15),transform(u-w,h,.9),
           transform(u-w*.65,-3.8,.06),transform(u+w*.55,-3.8,.12),transform(u+w*.55,h-.8,.12),transform(u-w*.65,h,.06)]
        shelf=mesh('Attached glacial fracture slab',v,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)],ice)
        shelf.data.materials.append(frost);shelf.data.polygons[3].material_index=1
        # A thin cap follows the actual slab edge, so frost cannot float away from it.
        line('Frosted fracture crest',[v[7],v[6],v[2]],.025,frost)

for kind in ['ice','collection']:
    bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art/glacier-water-temple/interior/v04',kind+'-hall-v04.blend'))
    for o in list(bpy.context.scene.objects):
        if o.name.startswith(('Continuous fractured glacier','Glacier compression vein','Back glacial fracture','Angular glacial buttress')):bpy.data.objects.remove(o,do_unlink=True)
    ice=material('Interior glacial strata',(.17,.40,.52),.1,.3)
    deep=material('Interior glacial depths',(.035,.12,.18),0,.5)
    frost=material('Interior frost crest',(.45,.69,.75),.1,.4)
    width=7.25 if kind=='ice' else 9.12
    for side in [-1,1]:wall('Folded glacier side',-7.5,12.4 if kind=='ice' else 14.2,lambda u,y,d,s=side:(s*(width+d),y,u),700+side)
    if kind=='ice':wall('Folded glacier rear',-8,8,lambda u,y,d:(u,y,12.55+d),707)
    export(kind+'-hall-v07')
