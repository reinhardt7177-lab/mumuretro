"""Vendor the pinned Three.js runtime and its imported addons from an npm tarball.

Usage: python tools/vendor_three.py tmp/three-0.160.0.tgz
Only explicitly selected members are read; archive paths are never extracted.
"""
import hashlib
import json
import posixpath
import re
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'vendor' / 'three'
ARCHIVE = Path(sys.argv[1])
ENTRIES = [
    'build/three.module.js', 'LICENSE',
    'examples/jsm/effects/OutlineEffect.js',
    'examples/jsm/postprocessing/EffectComposer.js',
    'examples/jsm/postprocessing/UnrealBloomPass.js',
    'examples/jsm/postprocessing/OutputPass.js',
    'examples/jsm/loaders/GLTFLoader.js',
    'examples/jsm/loaders/DRACOLoader.js',
    'examples/jsm/libs/meshopt_decoder.module.js',
    'examples/jsm/libs/draco/gltf/draco_decoder.js',
    'examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js',
    'examples/jsm/libs/draco/gltf/draco_decoder.wasm',
]
written = {}
with tarfile.open(ARCHIVE, 'r:gz') as archive:
    manifest = json.load(archive.extractfile('package/package.json'))
    assert manifest['name'] == 'three' and manifest['version'] == '0.160.0'
    queue = ENTRIES.copy()
    while queue:
        path = queue.pop()
        if path in written:
            continue
        assert not path.startswith('/') and '..' not in Path(path).parts
        data = archive.extractfile('package/' + path).read()
        target = DEST / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        written[path] = hashlib.sha256(data).hexdigest()
        if path.endswith('.js'):
            for dep in re.findall(r"(?:from\s*|import\s*\()\s*['\"]([^'\"]+)['\"]", data.decode()):
                if dep.startswith('.'):
                    queue.append(posixpath.normpath(posixpath.join(posixpath.dirname(path), dep)))
(DEST / 'manifest.json').write_text(json.dumps({
    'package': 'three', 'version': '0.160.0',
    'source': 'https://registry.npmjs.org/three/-/three-0.160.0.tgz',
    'archiveSha256': hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
    'files': dict(sorted(written.items())),
}, indent=2) + '\n', encoding='utf-8')
print(f'Vendored {len(written)} files into {DEST}')
