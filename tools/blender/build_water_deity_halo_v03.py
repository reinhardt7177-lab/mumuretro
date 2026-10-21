"""Editable separate halo and offering droplet; dimensions in game Y-up metres."""
import bpy, bmesh, math, os, sys, json, ast
sys.path.insert(0,os.path.dirname(__file__))
from asset_detail_helpers import ROOT,vec,material,mesh,ring,line
ART=os.path.join(ROOT,'art/water-sanctuary/v03')
OUT=os.path.join(ROOT,'art/engine-transfer/model-data/WaterInterior')
os.makedirs(ART,exist_ok=True)
tree=ast.parse(open(os.path.join(ROOT,'tools/blender/build_water_interior_v02.py'),encoding='utf-8-sig').read())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='export'],type_ignores=[]),'<shared-export>','exec'))
bpy.ops.wm.read_factory_settings(use_empty=True)
gold=material('Deity halo V03 gold',(.50,.30,.09),.8,.25)
gold.diffuse_color=(.50,.30,.09,1)
gem=material('Deity halo V03 aquamarine',(.025,.44,.58),.45,.18)
gem.diffuse_color=(.025,.44,.58,1)
center=(0,2.64,.42)
for radius,tube in [(.80,.018),(.86,.023)]:ring('Chased halo ring',center,radius,tube,gold,plane='xy',segments=192)
for i in range(16):
    a=i*math.tau/16;points=[]
    for j in range(37):
        t=j/36;angle=a+t*.32;r=.83+.016*math.sin(t*math.tau)
        points.append((r*math.sin(angle),2.64+r*math.cos(angle),.41))
    line('Continuous wave filigree',points,.006,gold)
    for sign in [-1,1]:
        points=[]
        for j in range(25):
            t=j/24;angle=a+.14+sign*.05*math.sin(t*math.pi);r=.80+.06*t
            points.append((r*math.sin(angle),2.64+r*math.cos(angle),.399))
        line('Paired leaf engraving',points,.004,gold)
def drop(name,p,r):
    vertices=[];faces=[];nu=40;nv=32
    for j in range(nv+1):
        v=j/nv;radius=r*math.sin(v*math.pi)*(1-.55*v)
        for i in range(nu):
            a=i/nu*math.tau;vertices.append((p[0]+radius*math.cos(a),p[1]+r*(2*v-1),p[2]+radius*.7*math.sin(a)))
    for j in range(nv):
        for i in range(nu):
            a=j*nu+i;b=j*nu+(i+1)%nu;faces.append((a,b,b+nu,a+nu))
    return mesh(name,vertices,faces,gem)
drop('Halo zenith water jewel',(0,3.53,.42),.095)
export('water-deity-halo-v03')
drop('Suspended offering droplet',(0,0,0),.13)
export('water-deity-droplet-v03')
