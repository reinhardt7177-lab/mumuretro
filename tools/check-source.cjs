// Syntax, local module paths, pinned vendor integrity and scene music files.
// node --experimental-vm-modules tools/check-source.cjs
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
  ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const files = walk(path.join(root, 'src')).filter(p => p.endsWith('.js'));
let imports = 0;
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8'); new vm.SourceTextModule(code, { identifier: file });
  for (const [, spec] of code.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
    const target = spec === 'three' ? path.join(root, 'vendor/three/build/three.module.js')
      : spec.startsWith('three/addons/') ? path.join(root, 'vendor/three/examples/jsm', spec.slice(13))
        : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null;
    if (target) { assert.ok(fs.existsSync(target), `${file}: missing ${spec}`); imports++; }
  }
}
const vendor = path.join(root, 'vendor/three');
const manifest = JSON.parse(fs.readFileSync(path.join(vendor, 'manifest.json'), 'utf8'));
for (const [file, expected] of Object.entries(manifest.files)) {
  const data = fs.readFileSync(path.join(vendor, file));
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'), expected, file);
}
const music = fs.readFileSync(path.join(root, 'src/data/music.js'), 'utf8');
for (const [file] of music.matchAll(/assets\/audio\/bgm\/[a-z]+\.mp3/g)) assert.ok(fs.existsSync(path.join(root, file)), file);
console.log(`PASS ${files.length} source modules, ${imports} local imports, ${Object.keys(manifest.files).length} vendor hashes, music paths`);
