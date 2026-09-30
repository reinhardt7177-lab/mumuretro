"""Low-cost nature kit for instanced spherical-world scenery, game metres."""
import bpy, math, os, sys, random
sys.path.insert(0, os.path.dirname(__file__))
from asset_detail_helpers import *
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
random.seed(7177)
os.makedirs(ROOT+'/art/planet-nature',exist_ok=True)
neutral=material('Nature neutral',(.88,.88,.83))
light=material('Leaf sun planes',(.88,.96,.77))
shade=material('Leaf under planes',(.56,.68,.47))
bark=material('Bark ridges',(.82,.69,.52))
moss=material('Moss crests',(.38,.53,.25))
rock=material('Weathered stone',(.76,.79,.78))
cut=material('Stone fracture',(.52,.57,.58))
gold=material('Survey brass',(.5,.31,.09),.6)
teal=material('Survey ceramic',(.04,.18,.19))
def group(name):
    g=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(g);return g
def lobe(name,pos,size,parent,seed):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=vec(pos))
    o=bpy.context.object;o.name=name;o.scale=(size[0],size[2],size[1]);o.parent=parent
    o.data.materials.append(light);o.data.materials.append(shade)
    for p in o.data.polygons:
        p.material_index=1 if p.normal.z<-.15 else 0
        p.use_smooth=True
    o.rotation_euler.z=seed*.57
g=group('trunk')
rod('Rooted trunk',(0,-.05,0),(.025,3.1,.025),.20,neutral,g,7)
for i in range(5):
    a=i*math.tau/5
    rod('Bark ridge',(.19*math.cos(a),.1,.19*math.sin(a)),(.15*math.cos(a),2.6,.15*math.sin(a)),.025,bark,g,5)
    rod('Root flare',(.23*math.cos(a),.03,.23*math.sin(a)),(.13*math.cos(a),.48,.13*math.sin(a)),.06,bark,g,5)
for i in range(3):
    a=i*math.tau/3
    rod('Forked branch',(0,2.30,0),(.64*math.cos(a),3.25,.64*math.sin(a)),.075,neutral,g,5)
for name,wide in [('canopyA',True),('canopyB',False)]:
    g=group(name)
    lobes=[(-.65,3.43,.12,1.04,.70,.90),(.63,3.67,-.18,1.04,.83,.91),
      (-.38,4.21,-.30,.95,.84,.86),(.40,4.36,.30,.96,.82,.78),
      (-.04,4.97,0,.84,.68,.77),(-.95,3.85,-.22,.62,.57,.63),(.88,4.12,.11,.66,.58,.64)]
    for i,(x,y,z,rx,ry,rz) in enumerate(lobes):
        lobe('Crown cluster',(x*(1 if wide else .75),y*(1 if wide else 1.02),z),(rx*(1 if wide else .85),ry,rz),g,i)
for name,seed in [('rockA',4),('rockB',19)]:
    g=group(name);bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
    o=bpy.context.object;o.name='Fractured moss boulder';o.parent=g
    for v in o.data.vertices:
        x,y,z=v.co;k=1+.13*math.sin(x*11+y*7+z*13+seed)
        v.co=(x*.44*k,y*.40*k,z*.26*k+.11)
    o.data.materials.append(rock);o.data.materials.append(cut);o.data.materials.append(moss)
    o.data.update()
    for p in o.data.polygons:
        avg=sum(o.data.vertices[i].co.z for i in p.vertices)/len(p.vertices)
        p.material_index=2 if avg>.19 and p.normal.z>.25 else (1 if p.index%5==0 else 0)
g=group('bush')
for i,(x,y,z,r) in enumerate([(0,.21,0,.34),(.22,.16,.1,.25),(-.2,.17,-.1,.26),(0,.32,-.08,.26)]):
    lobe('Low shrub crown',(x,y,z),(r,r*.7,r),g,i)
g=group('trail_stone')
for i in range(3):
    box('Dressed path stone',((i-1)*.27,.028,math.sin(i*2)*.065),(.25,.08,.27),rock,g,.028)
g=group('survey_base')
rod('Octagonal return rim',(0,-.08,0),(0,.02,0),2.55,rock,g,16)
for i in range(16):
    a=i*math.pi/8
    # The return pad remains low; clear central circle retains its glow effect.
    box('Return rim stone',(math.sin(a)*2.44,.09,math.cos(a)*2.44),(.32,.18,.32),rock,g,.045)
    rod('Compass index',(math.sin(a)*2.23,.045,math.cos(a)*2.23),(math.sin(a)*2.42,.045,math.cos(a)*2.42),.025,gold,g,6)
export('art/planet-nature/planet-nature-v01.blend','assets/models/planet-nature-v01.glb')
