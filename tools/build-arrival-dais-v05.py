"""A separate flat-plinth revision; v04/Root remain unchanged."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'tools/build-arrival-dais-v04.py').read_text(encoding='utf-8')
source=source.replace("A=ROOT/'art/arrival-dais/v04'","A=ROOT/'art/arrival-dais/v05'")
source=source.replace('arrival-dais-v04','arrival-dais-v05').replace('V04','V05').replace('v04','v05')
source=source.replace("radial=r.uniform(-.080,.016)","radial=r.uniform(-.018,.016)").replace("trim=r.uniform(.015,.040)","trim=r.uniform(.010,.025)")
source=source.replace("'inner':2.27,'outer':2.64,'changed':False","'inner':2.58,'outer':2.64,'edgeBevelWidth':.06,'changed':True,'foundationTopRingRadii':[2.58,2.60]")
source=source.replace("'runtimeConform':True,","'runtimeConform':True,'plinthContract':'flat source top .22, game walk .16, near-vertical 6cm perimeter bevel',")
source=source.replace("Keep existing bronze metalness clamp .30 and glass pulse; do not alter support, collision, footing or save keys","Keep existing bronze metalness clamp .30 and glass pulse; use v05 support height .16 inner2.58 outer2.64 plus parent step-up preview; preserve save keys")
source=source.replace('pieces=list(editable.objects);Z=.22;tau=math.tau',"""# Existing foundation rings are redistributed, without adding faces, so the
# 6cm physical edge bevel is not interpolated over the old 22cm radial span.
for ob in editable.objects:
    if not ob.name.startswith('Buried slate foundation'):continue
    for vertex in ob.data.vertices:
        radius=math.hypot(vertex.co.x,vertex.co.y)
        target=2.60 if abs(radius-2.4108333333)<.0001 else 2.58 if abs(radius-2.1936666667)<.0001 else None
        if target and abs(vertex.co.z-.202)<.0001:vertex.co.x*=target/radius;vertex.co.y*=target/radius
    ob.data.update()
pieces=list(editable.objects);Z=.22;tau=math.tau""")
exec(compile(source,str(ROOT/'tools/build-arrival-dais-v05.py'),'exec'))
