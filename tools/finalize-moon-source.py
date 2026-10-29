"""Open the real editable convex source, verify metadata and tidy viewport only."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'art/moon-sanctum/v01'
bpy.ops.wm.open_mainfile(filepath=str(ART/'moon-sanctum-v01.blend'));spec=json.loads((ART/'design-spec.json').read_text())
def digest():
    data=[]
    for o in sorted((o for o in bpy.data.objects if o.type=='MESH'),key=lambda o:o.name):data.append([o.name,[list(v.co) for v in o.data.vertices],list(sum((list(row) for row in o.matrix_world),[]))])
    return hashlib.sha256(json.dumps(data,separators=(',',':')).encode()).hexdigest()
before=digest();parts={}
for name in spec['parts']:
    p=bpy.data.objects[name];objects=[o for o in p.children_recursive if o.type=='MESH'];parts[name]={'sourcePieces':len(objects)}
    for o in objects:o.hide_set(name!='MoonGuardian');o.hide_render=name!='MoonGuardian'
for piece in spec['guardian']['casters']:
    o=bpy.data.objects[piece['name']];points=[o.matrix_world@v.co for v in o.data.vertices];actual=[(q.x,q.z,-q.y) for q in points];assert len(actual)==len(piece['vertices'])
    assert max(abs(a-b) for p,q in zip(actual,piece['vertices']) for a,b in zip(p,q))<1e-5
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_location=Vector((0,0,1.35));area.spaces.active.region_3d.view_distance=6.5
bpy.ops.file.make_paths_relative();bpy.ops.wm.save_mainfile();after=digest();assert before==after
textures=[{'name':im.name,'path':im.filepath,'size':list(im.size),'exists':Path(bpy.path.abspath(im.filepath)).is_file()} for im in bpy.data.images if im.source=='FILE']
assert len(textures)==4 and all(t['exists'] and t['path'].startswith('//') and t['size']==[512,512] for t in textures)
assert parts['MoonGuardian']['sourcePieces']==159 and sum(p['sourcePieces'] for p in parts.values())==739
(ART/'source-open.json').write_text(json.dumps({'pass':True,'parts':parts,'textures':textures,'geometryUnchanged':True,'geometrySha256':after,'viewportOnly':True,'projectionPiecesMatch':159},indent=2))
print('PASS native739-piece source,159 optical pieces,4 relative512px images; geometry unchanged')
