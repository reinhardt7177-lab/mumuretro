"""Fit passage slabs to the reviewed hub; export preserved architecture with one owner."""
import bpy,json,math,hashlib
from pathlib import Path
R=Path(__file__).resolve().parent.parent;A=R/'art/fire-junctions/v01';A.mkdir(parents=True,exist_ok=True)
file=R/'tools/refine-fire-masonry.py';text=file.read_text();scope={'__file__':str(file)}
exec(compile(text[:text.index("for kind in ['fracture','foundry','steam','sanctum']:")].replace("stem=kind+'-static-v03'","stem=kind+'-static-v04'"),str(file),'exec'),scope)
scope['A']=A;prior=json.loads((R/'art/fire-masonry/v01/metrics.json').read_text());results={}
for kind in ['fracture','foundry']:
    # Use the prior export membership exactly, including the rebuilt wall pieces.
    base=scope['open_static'](kind);names=set(o.name for o in base)
    for g in prior[kind]['groups']:
        names.difference_update(g['removed']);names.update(g['stones'])
    bpy.ops.wm.open_mainfile(filepath=str(R/('art/fire-masonry/v01/'+kind+'-static-v03.blend')))
    assert all(n in bpy.data.objects for n in names);targets=[bpy.data.objects[n] for n in sorted(names)];assert len(targets)==prior[kind]['sourcePieces']
    before=scope['signatures'](targets);removed=[];trimmed=[]
    if kind=='fracture':
        for o in list(targets):
            if o.name.startswith('east passage'):
                removed.append(o.name);targets.remove(o);bpy.data.objects.remove(o,do_unlink=True)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=12,depth=4,location=(0,0,0))
    cutter=bpy.context.object;cutter.name='Hub boundary cutting tool';cutter.hide_render=True
    prefix='west passage' if kind=='fracture' else 'east passage'
    for o in list(targets):
        if not o.name.startswith(prefix):continue
        name=o.name;old=scope['bounds'](o);bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Fit passage to hub rim','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        if not len(o.data.polygons):targets.remove(o);removed.append(name);bpy.data.objects.remove(o,do_unlink=True);continue
        # The cutter has no render material; keep cut faces on the slab's stone.
        mat=next(m for m in o.data.materials if m is not None);o.data.materials.clear();o.data.materials.append(mat)
        for face in o.data.polygons:face.material_index=0
        trimmed.append({'name':name,'before':old,'after':scope['bounds'](o),'vertices':len(o.data.vertices)})
    bpy.data.objects.remove(cutter,do_unlink=True);bpy.context.view_layer.update()
    changed={r['name'] for r in trimmed}|set(removed);untouched={n:h for n,h in before.items() if n not in changed};after=scope['signatures'](targets);assert all(after[n]==h for n,h in untouched.items())
    metrics=scope['export'](kind,targets,[]);metrics.update({'removed':removed,'trimmed':trimmed,'unchangedGeometry':{'pass':True,'count':len(untouched),'sha256':hashlib.sha256(json.dumps(untouched,sort_keys=True).encode()).hexdigest()}});results[kind]=metrics
    print('JUNCTION_EXPORT',kind,len(removed),len(trimmed),flush=True)
(A/'metrics.json').write_text(json.dumps(results,indent=2));print('FIRE_JUNCTIONS_READY',flush=True)
