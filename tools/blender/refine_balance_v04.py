"""Architectural/interaction detail pass layered on the preserved v03 source."""
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from asset_detail_helpers import *
bpy.ops.wm.open_mainfile(filepath=ROOT+'/art/balance-temple/balance-temple-v03.blend')
pale=bpy.data.materials['Carved limestone'];gold=bpy.data.materials['Aged brass']
dark=bpy.data.materials['Midnight teal'];wood=bpy.data.materials['Walnut']
for name,w,length,h in [('hall_order',14,18,9),('hall_twin',14,16,9),('hall_lever',18,28,11),('hall_entry',6,12,8),('hall_corridor',5,4,8)]:
    g=bpy.data.objects[name]
    for side in [-1,1]:
        x=side*(w/2-.25)
        for z in [-length/2+1+i*4 for i in range(int((length-2)/4)+1)]:
            # Layered square capitals, bead moulding and recessed dark flutes.
            for y,size in [(.38,.94),(.68,.72),(h-.83,.71),(h-.43,.99)]:
                box('V04 carved abacus',(x,y,z),(size,.10,size),pale,g,.023)
            for y in [.76,h-.97]:ring('V04 column collar',(x,y,z),.285,.025,gold,g,segments=24)
            for i in range(8):
                a=i*math.pi/4
                rod('V04 shaft flute',(x+.271*math.cos(a),.84,z+.271*math.sin(a)),(x+.271*math.cos(a),h-1.04,z+.271*math.sin(a)),.013,dark,g,6)
            lx=side*(w/2-.6)
            for y in [2.07,2.45]:ring('V04 sanctuary lamp crown',(lx,y,z),.16,.018,gold,g,segments=16)
            for i in range(4):
                a=i*math.pi/2
                rod('V04 lamp cage',(lx+.16*math.cos(a),2.07,z+.16*math.sin(a)),(lx+.16*math.cos(a),2.45,z+.16*math.sin(a)),.012,gold,g,6)
    # Compass spokes are flat inlay, below the foot plane tolerance.
    if w>=10:
        for i in range(16):
            a=i*math.pi/8;r1=2.10 if i%2 else 1.70
            rod('V04 compass floor index',(r1*math.sin(a),.026,r1*math.cos(a)),(2.36*math.sin(a),.026,2.36*math.cos(a)),.017,gold,g,6)
g=bpy.data.objects['crate']
for side in [-1,1]:
    for offset in [-.17,0,.17]:
        box('V04 crate plank joint',(offset,.36,side*.364),(.008,.55,.006),dark,g,0)
        box('V04 crate side joint',(side*.364,.36,offset),(.006,.55,.008),dark,g,0)
    # Recessed hand grip within the existing .77 m box footprint.
    box('V04 handhold recess',(side*.371,.44,0),(.015,.10,.24),dark,g,.012)
    for z in [-.12,.12]:box('V04 grip frame',(side*.385,.44,z),(.018,.15,.025),gold,g,.005)
    box('V04 grip rail',(side*.385,.515,0),(.018,.025,.26),gold,g,.005)
    for x in [-.30,.30]:
        for y in [.09,.64]:rod('V04 crate corner rivet',(x,y,side*.389),(x,y,side*.404),.021,gold,g,8)
g=bpy.data.objects['fulcrum']
for side in [-1,1]:
    ring('V04 pivot journal',(0,.73,side*.22),.12,.023,gold,g,plane='xy',segments=24)
    rod('V04 fulcrum axle',(0,.73,side*.19),(0,.73,side*.27),.055,dark,g,12)
# Reusable entrance markers for the other five shrines. Symbols are geometry,
# not text textures, so they stay crisp at close range and share the same craft.
for kind in ['water','shadow','sift','fire','strata']:
    g=bpy.data.objects.new('waymark_'+kind,None);bpy.context.collection.objects.link(g)
    for y,w,d in [(.10,.72,.20),(.25,.57,.12),(2.15,.50,.12),(2.30,.62,.12)]:
        box('V04 marker dressed stone',(0,y,0),(w,d,w),pale,g,.04)
    rod('V04 marker shaft',(0,.3,0),(0,2.15,0),.22,pale,g,8)
    for y in [.40,1.95]:ring('V04 marker bead',(0,y,0),.23,.023,gold,g,segments=16)
    for x in [-.16,.16]:box('V04 marker flute',(x,1.16,.159),(.018,1.45,.018),dark,g,.004)
    box('V04 heraldic tablet',(0,2.64,0),(.64,.70,.18),dark,g,.04)
    ring('V04 heraldic rim',(0,2.64,.11),.29,.026,gold,g,plane='xy',segments=32)
    def glyph(points):line('V04 '+kind+' carving',[(x,y+2.64,.143) for x,y in points],.018,gold,g)
    if kind=='water':glyph([(0,.21),(-.13,.015),(-.14,-.08),(-.09,-.16),(0,-.18),(.09,-.16),(.14,-.08),(.13,.015),(0,.21)])
    elif kind=='fire':glyph([(0,-.18),(-.15,-.09),(-.13,.09),(-.045,.02),(.04,.21),(.16,.04),(.13,-.11),(0,-.18)])
    elif kind=='shadow':
        glyph([(math.cos(a)*.19,math.sin(a)*.19) for a in [math.pi*.4+i*math.pi*1.2/20 for i in range(21)]])
        glyph([(math.cos(a)*.12+.02,math.sin(a)*.19) for a in [math.pi*.4+i*math.pi*1.2/20 for i in range(21)]])
    elif kind=='sift':
        glyph([(-.18,.10),(.18,.10),(0,-.045),(-.18,.10)])
        for x in [-.10,0,.10]:rod('V04 sift grains',(x,2.49,.14),(x,2.49,.16),.022,gold,g,8)
    else:
        for y in [-.14,-.045,.05,.145]:glyph([(-.17,y),(-.07,y+.025),(.07,y-.018),(.17,y+.005)])
    rod('V04 marker crown',(0,3.015,0),(0,3.08,0),.15,gold,g,8)
export('art/balance-temple/balance-temple-v04.blend','assets/models/balance-temple-v04.glb')
