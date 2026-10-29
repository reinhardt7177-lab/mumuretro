"""Independent source comparison, including protected paving UVs and packed image data."""
import bpy,json,hashlib
from pathlib import Path
R=Path(__file__).resolve().parent.parent;A=R/'art/balance-walls/v01';checks=[]
def check(name,passed,details):
    checks.append({'name':name,'pass':bool(passed),'details':details})
    assert passed,(name,details)
def state():
    objects={}
    for o in bpy.context.scene.objects:
        if o.type not in ['MESH','CURVE']:continue
        coords=[tuple(v.co)for v in o.data.vertices]if o.type=='MESH'else[[tuple(p.co)for p in s.points]for s in o.data.splines]
        uv=[[(round(p.uv.x,7),round(p.uv.y,7))for p in layer.data]for layer in o.data.uv_layers]if o.type=='MESH'else[]
        objects[o.name]=hashlib.sha256(repr((tuple(tuple(row)for row in o.matrix_world),coords,uv,[m.name for m in o.data.materials])).encode()).hexdigest()
    images={im.name:hashlib.sha256(bytes(im.packed_file.data)).hexdigest()for im in bpy.data.images if im.packed_file}
    return objects,images
bpy.ops.wm.open_mainfile(filepath=str(R/'art/balance-paving/v01/balance-temple-v05.blend'));old,oldImages=state()
bpy.ops.wm.open_mainfile(filepath=str(A/'balance-temple-v06.blend'));new,images=state();layout=json.loads((A/'layout.json').read_text());removed=set(layout['removed'])
check('2661 non-wall source objects preserve coordinates,UVs and materials',len(old)-len(removed)==2661 and all(new.get(n)==v for n,v in old.items()if n not in removed),{'objects':len(old)-len(removed)})
check('all former200 constellation strokes and10 wall cores are absent',len(removed)==210 and all(n not in bpy.data.objects for n in removed),{'removed':len(removed)})
check('all previously packed images retain identical bytes',all(images.get(n)==v for n,v in oldImages.items()),{'images':list(oldImages)})
bpy.context.view_layer.update();rows=[]
for g in layout['rooms']:
    walls=[o for o in bpy.data.objects[g['root']].children_recursive if o.name.startswith(('Wall ashlar ','Wall backing '))];points=[o.matrix_world@v.co for o in walls for v in o.data.vertices];bounds={'root':g['root'],'objects':len(walls),'bottom':min(p.z for p in points),'top':max(p.z for p in points),'minX':min(p.x for p in points),'maxX':max(p.x for p in points)}
    rows.append(bounds)
    assert abs(bounds['bottom'])<1e-5 and abs(bounds['top']-g['height'])<1e-5
    assert abs(bounds['minX']+g['width']/2+.37)<1e-5 and abs(bounds['maxX']-g['width']/2-.37)<1e-5
check('all five wall templates retain floor0,height and former outer footprint',len(rows)==5,rows)
tiles=[o for o in bpy.context.scene.objects if o.name.startswith('Balance paving hall_')];points=[o.matrix_world@v.co for o in tiles for v in o.data.vertices]
check('all324 existing paving meshes retain zero top',len(tiles)==324 and abs(max(p.z for p in points))<1e-5,{'tiles':len(tiles),'top':max(p.z for p in points)})
im=bpy.data.images.get('Balance wall mineral grain');check('new wall mineral image is packed at256px',im is not None and list(im.size)==[256,256]and im.packed_file is not None,{'size':list(im.size)if im else None})
out={'pass':all(c['pass']for c in checks),'checks':checks};(A/'source-audit.json').write_text(json.dumps(out,indent=2));print('BALANCE_WALLS_AUDIT',json.dumps({'pass':out['pass'],'checks':len(checks)}))
