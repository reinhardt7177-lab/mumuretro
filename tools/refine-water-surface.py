"""Separate intersecting authored surfaces; preserve v01 and every gameplay contract."""
import bpy,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;A=ROOT/'art/water-surface/v01';sys.path.insert(0,str(ROOT/'tools'))
from theatre_asset_utils import export_parts
results=[]
for kind in ['courts','devices']:
 old=ROOT/f'art/water-{kind}/v01';out=A/kind;out.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.open_mainfile(filepath=str(old/f'water-{kind}-v01.blend'))
 spec=json.loads((old/'design-spec.json').read_text());spec['model']=f'art/water-surface/v01/{kind}/water-{kind}-v02.glb'
 for c in bpy.data.collections:c.hide_viewport=c.hide_render=False
 for o in bpy.context.scene.objects:o.hide_set(False)
 parts=[n for r in spec['rooms'] for n in [r['shell'],r['floor'],r['glacier']]] if kind=='courts' else list(spec['parts'])
 for name in parts:bpy.data.objects[name].location=(0,0,0)
 changed=[]
 for name in parts:
  for o in bpy.data.objects[name].children:
   o.hide_render=False
   if kind=='courts' and o.name.startswith('Paving continuous foundation'):
    lo=min(v.co.z for v in o.data.vertices);hi=max(v.co.z for v in o.data.vertices)
    # Upper mortar surface below the 9mm stone bevel. Keep the foundation bottom.
    delta=.0115
    for v in o.data.vertices:v.co.z=lo+(v.co.z-lo)*(hi-lo-delta)/(hi-lo)
    o.data.update();changed.append(dict(name=o.name,oldTop=hi+o.location.z,newTop=hi-delta+o.location.z,bottom=lo+o.location.z))
   if kind=='devices' and o.name.startswith('Inset bracelet resting surface'):
    o.location.z+=.005;changed.append(dict(name=o.name,delta=.005))
 spec['surfaceRevision']=2
 if kind=='courts':spec['floorGroutOffset']=.012
 # The device source includes an unused file-image with no path. Do not pass a
 # directory to the existing exporter; preserve any actually used packed image.
 for im in list(bpy.data.images):
  if im.source!='FILE' or Path(bpy.path.abspath(im.filepath)).is_file():continue
  if not im.users:bpy.data.images.remove(im);continue
  assert im.packed_file,('Missing used texture',im.name)
  target=out/(im.name+'.png');target.write_bytes(bytes(im.packed_file.data));im.filepath=str(target)
 originals={o for name in parts for o in bpy.data.objects[name].children}
 metrics=export_parts(parts,spec,out,f'water-{kind}-v02',f'Water {kind} ')
 for name in parts:
  for o in list(bpy.data.objects[name].children):
   if o not in originals:bpy.data.objects.remove(o,do_unlink=True)
   else:o.hide_set(False);o.hide_render=False
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/f'water-{kind}-v02.blend'))
 assert len(changed)==(6 if kind=='courts' else 1),(kind,changed)
 results.append(dict(kind=kind,changed=changed,metrics=metrics))
(A/'geometry-changes.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print('WATER_SURFACES_READY',flush=True)
