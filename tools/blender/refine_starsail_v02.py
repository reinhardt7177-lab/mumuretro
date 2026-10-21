"""Refine the editable v01, retaining the deck/collision envelope."""
import bpy, math, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from asset_detail_helpers import *

bpy.ops.wm.open_mainfile(filepath=ROOT+'/art/starsail/starsail-v01.blend')
wood=bpy.data.materials['Walnut hull']; brass=bpy.data.materials['Aged brass']
iron=bpy.data.materials['Forged iron']; rope=bpy.data.materials['Hemp rigging']
teal=bpy.data.materials['Blue green sail hem']; navy=bpy.data.materials['Midnight hull panels']
planks=[bpy.data.materials['Honey plank '+str(i)] for i in range(5)]

# Replace only the two original straight-sided barrel meshes and their hoops.
for o in list(bpy.data.objects):
    if o.name.startswith(('Storage barrel','Barrel iron hoop')):
        bpy.data.objects.remove(o, do_unlink=True)
for x,z in [(4.7,-10),(-4.7,-.8)]:
    levels=[(.05,.35),(.17,.405),(.55,.45),(.95,.405),(1.10,.35)]
    for i in range(16):
        a=(i+.025)*math.tau/16; b=(i+.975)*math.tau/16
        vs=[(x+r*math.cos(t),y,z+r*math.sin(t)) for y,r in levels for t in [a,b]]
        mesh('V02 bowed barrel stave',vs,[(j*2,j*2+2,j*2+3,j*2+1) for j in range(4)],planks[i%5])
    for y,r in [(.17,.412),(.55,.457),(.95,.412)]:
        ring('V02 iron cooper hoop',(x,y,z),r,.033,iron)
        for i in range(8):
            a=i*math.tau/8
            rod('V02 hoop nail',(x+r*math.cos(a),y,z+r*math.sin(a)),(x+(r+.022)*math.cos(a),y,z+(r+.022)*math.sin(a)),.023,brass,vertices=8)
    rod('V02 barrel lid',(x,1.07,z),(x,1.105,z),.344,planks[1],vertices=32)
    ring('V02 lid rim',(x,1.10,z),.35,.023,wood)
    for offset in [-.21,-.07,.07,.21]:
        half=math.sqrt(.328**2-offset**2)
        box('V02 lid joint',(x+offset,1.109,z),(.007,.004,half*2),wood,bevel=0)
    rod('V02 bung',(x+.08,1.105,z),(x+.08,1.13,z),.058,wood)

# Recessed cabin panels, brass corners and a compass rose on the front pediment.
cx,cz=-4.05,-10.5
for dx in [-1.15,1.15]:
    box('V02 cabin inset',(cx+dx,1.42,cz+1.916),(.43,2.16,.055),navy,bevel=.025)
    for edge in [-.225,.225]:
        box('V02 cabinet fillet',(cx+dx+edge,1.42,cz+1.956),(.026,2.23,.026),brass)
for x in [cx-.6,cx+.6]:
    box('V02 door casing',(x,1.12,cz+2.04),(.12,2.30,.16),wood,bevel=.035)
for y in [.06,2.25]:box('V02 door casing',(cx,y,cz+2.04),(1.30,.12,.16),brass,bevel=.025)
ring('V02 cabin compass',(cx,2.77,cz+2.17),.29,.026,brass,plane='xy')
for i in range(8):
    a=i*math.pi/4
    r=.23 if i%2==0 else .15
    rod('V02 compass ray',(cx,2.77,cz+2.18),(cx+math.sin(a)*r,2.77+math.cos(a)*r,cz+2.18),.018,brass)
for y in [.43,1.26]:
    box('V02 door hinge',(cx-.44,y,cz+2.08),(.27,.075,.036),iron)
    rod('V02 hinge pin',(cx-.55,y-.07,cz+2.12),(cx-.55,y+.07,cz+2.12),.025,brass)

# Rolled ropes stay within existing cargo obstacle radii.
for x,z in [(-4.5,6),(-4.7,-4),(5.25,-2.4)]:
    line('V02 tied cargo coil',[(x+(.07+.0017*i)*math.cos(i*.23),1.204,z+(.07+.0017*i)*math.sin(i*.23)) for i in range(100)],.016,rope)
    for side in [-1,1]:
        rod('V02 cargo corner nail',(x+side*.28,1.12,z+.405),(x+side*.28,1.12,z+.429),.03,brass,vertices=8)

# Porthole fasteners give the exterior readable construction at observation zoom.
profile=[(-14,4.8),(-12.5,6.25),(-8,6.6),(-3.5,6.35),(2.5,5.85),(7,5.4),(10.5,4.95),(13,2.8),(15,.15)]
def width(z):
    for (a,wa),(b,wb) in zip(profile,profile[1:]):
        if a<=z<=b:return wa+(wb-wa)*(z-a)/(b-a)
for side in [-1,1]:
    for z in [-10,-6,-2,2,6,10]:
        x=side*width(z)*.91
        for i in range(8):
            a=i*math.pi/4;y=-.96+math.sin(a)*.218;zz=z+math.cos(a)*.218
            rod('V02 porthole fastener',(x+side*.141,y,zz),(x+side*.17,y,zz),.024,iron,vertices=8)
        # A modest heraldic bracket; no luminous additions competing with the guide.
        for offset in [-.70,.70]:
            line('V02 hull scroll',[(x+side*.075,-1.10+math.sin(t*math.pi)*.25,z+offset+(t-.5)*.32) for t in [j/12 for j in range(13)]],.025,brass)

export('art/starsail/starsail-v02.blend','assets/models/starsail-v02.glb')
