"""Make the already authored kit convenient to reopen; do not change export geometry."""
import bpy, json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
art = root / 'art/sift-architecture/v01'
target = art / 'sift-architecture-v01.blend'
bpy.ops.wm.open_mainfile(filepath=str(target))
parts = ['WorkHall', 'HallFloor', 'ThresholdArch', 'SiftGuardian']
record = {}
for name in parts:
    group = bpy.data.objects[name]
    for obj in group.children:
        obj.hide_set(name not in ['WorkHall', 'HallFloor'])
        obj.hide_render = name not in ['WorkHall', 'HallFloor']
    record[name] = {'meshes': len(group.children), 'visibleOnOpen': name in ['WorkHall', 'HallFloor']}
bpy.ops.file.make_paths_relative()
bpy.ops.wm.save_as_mainfile(filepath=str(target))
textures = [{'name': im.name, 'path': im.filepath, 'exists': Path(bpy.path.abspath(im.filepath)).is_file()} for im in bpy.data.images if im.source == 'FILE']
assert len(textures) == 4 and all(t['exists'] and t['path'].startswith('//') for t in textures)
(art / 'source-open.json').write_text(json.dumps({'pass': True, 'parts': record, 'textures': textures, 'exportGeometryChanged': False}, indent=2), encoding='utf8')
print('PASS editable kit opens with hall and floor; four relative texture paths resolve')
