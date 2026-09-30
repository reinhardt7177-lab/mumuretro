"""Leather stitchwork and optics; preserve both animated prop roots and Cover."""
import bpy, math, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import asset_detail_helpers as H
from asset_detail_helpers import *
H.NATIVE=True
bpy.ops.wm.open_mainfile(filepath=ROOT+'/art/sky-navigator/navigator-props-v01.blend')
leather=bpy.data.materials['Cognac leather'];gold=bpy.data.materials['Satin brass']
paper=bpy.data.materials['Ivory pages'];glass=bpy.data.materials['Blue lens']
thread=material('Flax saddle stitch',(.58,.39,.19),roughness=.9)
dark=material('Optical interior',(.008,.017,.024),roughness=.82)
book=bpy.data.objects['notebook'];cover=bpy.data.objects['Cover'];scope=bpy.data.objects['telescope']
bpy.context.view_layer.update()
# Existing ornamentation must travel with the opening cover, not float over pages.
for o in list(book.children):
    if o.name.startswith(('Corner','Star','Clasp')):
        matrix=o.matrix_world.copy();o.parent=cover;o.matrix_world=matrix
for x in [-.061,.061]:
    for i in range(15):
        z=-.086+i*.012
        rod('V02 saddle stitch',(x,-.007,z),(x,-.007,z+.005),.00085,thread,cover,6)
for z in [-.09,.09]:
    for i in range(10):
        x=-.054+i*.012
        rod('V02 saddle stitch',(x,-.007,z),(x+.005,-.007,z),.00085,thread,cover,6)
for z in [-.062,0,.062]:
    box('V02 raised spine band',(-.080,0,z),(.006,.055,.011),gold,book,.002)
for y in [-.01,-.005,0,.005,.01]:
    box('V02 page fore-edge',(.068,y,0),(.001,.0008,.171),thread,book,0)
box('V02 woven bookmark',(.025,.001,-.113),(.013,.003,.033),leather,book,.001)
for x in [-.038,.038]:
    rod('V02 clasp rivet',(x,-.009,.06),(x,-.014,.06),.003,gold,cover,8)

# Telescope still has its original x=.4 offset inside the translated root.
for z,r in [(-.068,.028),(-.04,.028),(.04,.028),(.070,.029),(.132,.024)]:
    ring('V02 turned brass collar',(.4,0,z),r,.0024,gold,scope,plane='xy',segments=24)
for i in range(16):
    a=i*math.tau/16
    rod('V02 focus ring knurl',(.4+.025*math.cos(a),.025*math.sin(a),.090),(.4+.025*math.cos(a),.025*math.sin(a),.103),.0015,gold,scope,6)
rod('V02 recessed objective seat',(.4,0,.153),(.4,0,.158),.0205,dark,scope,24)
rod('V02 recessed objective',(.4,0,.158),(.4,0,.159),.016,glass,scope,24)
ring('V02 lens lip',(.4,0,.160),.020,.002,gold,scope,plane='xy',segments=24)
ring('V02 ocular rubber edge',(.4,0,-.098),.029,.004,leather,scope,plane='xy',segments=24)
for i in range(10):
    z=-.055+i*.012
    rod('V02 telescope leather seam',(.398,-.028,z),(.402,-.028,z+.004),.0008,thread,scope,6)
export('art/sky-navigator/navigator-props-v02.blend','assets/characters/sky-navigator/props-v02.glb',protected=('Cover',))
