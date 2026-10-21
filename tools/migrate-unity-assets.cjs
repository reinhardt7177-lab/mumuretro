// Preserve reusable source data, then export engine-independent glTF 2.0 models.
// No Unity runtime, scene, Library or build output is copied. This tool never deletes.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'unity/MumuPlanet/Assets/Mumu');
const PRESERVED = path.join(ROOT, 'art/engine-transfer');
const MODELS = path.join(PRESERVED, 'model-data');
const OUTPUT = path.join(ROOT, 'assets/models/heritage');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const records = fs.existsSync(path.join(PRESERVED, 'preservation.json'))
  ? JSON.parse(fs.readFileSync(path.join(PRESERVED, 'preservation.json'))).files : [];
function preserveFile(a, b) {
  if (!fs.existsSync(a)) return;
  fs.mkdirSync(path.dirname(b), { recursive: true });
  const data = fs.readFileSync(a), sha256 = hash(data);
  if (fs.existsSync(b)) assert.equal(hash(fs.readFileSync(b)), sha256, `Preserved source differs: ${b}`);
  else fs.copyFileSync(a, b);
  assert.equal(hash(fs.readFileSync(b)), sha256, `Copy mismatch: ${b}`);
  const record = { source: path.relative(ROOT, a).replaceAll('\\', '/'), preserved: path.relative(ROOT, b).replaceAll('\\', '/'), bytes: data.length, sha256 };
  const index = records.findIndex(r => r.preserved === record.preserved);
  if (index < 0) records.push(record); else records[index] = record;
}
function preserveTree(from, to) {
  if (!fs.existsSync(from)) return;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name.endsWith('.meta') || entry.name.endsWith('.fbm')) continue;
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isDirectory()) { preserveTree(a, b); continue; }
    preserveFile(a, b);
  }
}
preserveTree(path.join(SOURCE, 'Models'), MODELS);
preserveTree(path.join(SOURCE, 'Runtime'), path.join(PRESERVED, 'logic-reference/Runtime'));
preserveTree(path.join(SOURCE, 'Editor'), path.join(PRESERVED, 'logic-reference/Editor'));
preserveTree(path.join(SOURCE, 'Shaders'), path.join(PRESERVED, 'logic-reference/Shaders'));
preserveTree(path.join(SOURCE, 'Source'), path.join(PRESERVED, 'logic-reference/Source'));
preserveTree(path.join(SOURCE, 'Fonts'), path.join(PRESERVED, 'fonts'));
preserveTree(path.join(ROOT, 'unity/MumuPlanet/Docs'), path.join(PRESERVED, 'logic-reference/Docs'));
preserveTree(path.join(ROOT, 'unity/legacy'), path.join(PRESERVED, 'logic-reference/legacy'));
preserveTree(path.join(SOURCE, 'Scenes'), path.join(PRESERVED, 'layout-reference'));
preserveTree(path.join(ROOT, 'unity/MumuPlanet/Assets/Settings'), path.join(PRESERVED, 'render-reference/Settings'));
preserveTree(path.join(ROOT, 'unity/MumuPlanet/ProjectSettings'), path.join(PRESERVED, 'render-reference/ProjectSettings'));
for (const file of ['Navigator.controller', 'NavigatorIdle.anim', 'WaterGateCeremony/WaterGateOpen.wav'])
  preserveFile(path.join(SOURCE, 'Generated', file), path.join(PRESERVED, 'animation-audio-reference', file));
preserveFile(path.join(ROOT, 'unity/MumuPlanet/Assets/InputSystem_Actions.inputactions'), path.join(PRESERVED, 'logic-reference/InputSystem_Actions.inputactions'));
// Portable font and original ceremony sound; no engine-side import artifacts.
preserveFile(path.join(SOURCE, 'Fonts/NanumGothic-Regular.ttf'), path.join(ROOT, 'assets/fonts/NanumGothic-Regular.ttf'));
preserveFile(path.join(SOURCE, 'Fonts/OFL.txt'), path.join(ROOT, 'assets/fonts/NanumGothic-OFL.txt'));
preserveFile(path.join(SOURCE, 'Generated/WaterGateCeremony/WaterGateOpen.wav'), path.join(ROOT, 'assets/audio/heritage/water-gate-open.wav'));

fs.mkdirSync(OUTPUT, { recursive: true });

const selected = [
  ['balance-deity', 'BalanceDeity/deity-v01.json', '균형의 신'],
  ['weight-exterior', 'TempleExterior/exterior-v02.json', '무게 신전 · 양개문'],
  ['explorer-notebook', 'Notebook/notebook-v01.json', '탐사 수첩 · 넘김 페이지'],
  ['glacier-temple', 'WaterMountain/glacier-temple-v03.json', '빙하에 갇힌 물 신전'],
  ['glacier-seal', 'WaterMountain/glacier-seal-v03.json', '입구 얼음 봉인'],
  ['water-mountain', 'WaterMountain/water-mountain-v05.json', '층리 돌산 · 최종 조형'],
  ['solar-altar', 'WaterMountain/solar-altar-v04.json', '돌산 정상 · 태양 제단'],
  ['solar-mirror', 'WaterMountain/solar-mirror-v04.json', '태양의 거울 · 조작 부품'],
  ['water-deity', 'WaterDeityV03/water-deity-v03.json', '물의 신 · 최종 노멀맵'],
  ...['ice-hall-v07', 'collection-hall-v07', 'cycle-hall-v09', 'ice-gate-detail-v06', 'collector-detail-v02', 'return-bridge-detail-v02', 'water-sanctuary-v01', 'water-deity-halo-v03', 'water-deity-droplet-v03'].map(n => [n, `WaterInterior/${n}.json`, n]),
  ...fs.readdirSync(path.join(MODELS, 'ShadowTemple')).filter(n => n.endsWith('.json')).map(n => [n.slice(0, -5), `ShadowTemple/${n}`, n.slice(0, -5)]),
];
const manifest = { version: 1, date: '2026-10-02', coordinateSystem: 'right-handed, Y-up (original Blender export)', sourceRoot: 'art/engine-transfer/model-data', models: [], data: ['Meadow/leaf-profiles.json'] };
function glb(id, input, label) {
  const file = path.join(MODELS, input), data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data.meshes) || !data.meshes.length) { manifest.data.push(input); return; }
  const doc = { asset: { version: '2.0', generator: 'Mumu engine-independent asset transfer' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: id, children: [] }], meshes: [], materials: [], buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [], extras: { source: input, ...(data.anchors ? { anchors: data.anchors } : {}) } };
  const chunks = []; let bytes = 0, triangles = 0;
  const extensions = new Set();
  function view(buffer, target) {
    const pad = (4 - bytes % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); bytes += pad; }
    const n = doc.bufferViews.length; doc.bufferViews.push({ buffer: 0, byteOffset: bytes, byteLength: buffer.length, ...(target ? { target } : {}) });
    chunks.push(buffer); bytes += buffer.length; return n;
  }
  function accessor(values, size, componentType = 5126, bounds = false) {
    assert(values.every(Number.isFinite), `${id}: nonfinite vertex data`);
    const typed = componentType === 5126 ? new Float32Array(values) : componentType === 5123 ? new Uint16Array(values) : new Uint32Array(values);
    const a = { bufferView: view(Buffer.from(typed.buffer), size === 1 ? 34963 : 34962), componentType, count: values.length / size, type: { 1: 'SCALAR', 2: 'VEC2', 3: 'VEC3' }[size] };
    if (bounds) { a.min = Array(size).fill(Infinity); a.max = Array(size).fill(-Infinity); values.forEach((v, i) => { a.min[i % size] = Math.min(a.min[i % size], v); a.max[i % size] = Math.max(a.max[i % size], v); }); }
    doc.accessors.push(a); return doc.accessors.length - 1;
  }
  const imageCache = new Map();
  function texture(name) {
    const source = path.join(id === 'water-deity' ? path.join(OUTPUT, 'textures') : path.dirname(file), name);
    if (imageCache.has(source)) return imageCache.get(source);
    assert(fs.existsSync(source), `Missing texture ${source}`);
    doc.images ||= []; doc.textures ||= [];
    const image = doc.images.length; doc.images.push({ bufferView: view(fs.readFileSync(source)), mimeType: /\.jpe?g$/i.test(name) ? 'image/jpeg' : 'image/png' });
    const index = doc.textures.length; doc.textures.push({ source: image }); imageCache.set(source, index); return index;
  }
  const materialIds = new Map();
  for (const m of data.materials) {
    const factor = m.color || [1, 1, 1, 1], alpha = factor[3] ?? 1;
    const pbr = { baseColorFactor: [...factor.slice(0, 3), alpha], metallicFactor: m.metal ?? 0, roughnessFactor: m.roughness ?? 0.72 };
    const material = { name: m.name, pbrMetallicRoughness: pbr, doubleSided: /paper|leaf|ice|glass/i.test(m.name) };
    if (alpha < 1) material.alphaMode = 'BLEND';
    if (m.emission > 0) { material.emissiveFactor = factor.slice(0, 3); if (m.emission > 1) { material.extensions = { KHR_materials_emissive_strength: { emissiveStrength: m.emission } }; extensions.add('KHR_materials_emissive_strength'); } }
    if (id === 'water-deity') {
      pbr.baseColorTexture = { index: texture('water-deity-albedo.jpg') };
      pbr.metallicRoughnessTexture = { index: texture('water-deity-orm.jpg') };
      material.occlusionTexture = { index: pbr.metallicRoughnessTexture.index };
      material.normalTexture = { index: texture('water-deity-normal.png'), scale: 1 };
    }
    materialIds.set(m.name, doc.materials.length); doc.materials.push(material);
  }
  const parts = new Map();
  for (const [i, mesh] of data.meshes.entries()) {
    const count = mesh.vertices.length / 3;
    assert(Number.isInteger(count) && mesh.normals.length === mesh.vertices.length, `${id}: vertex/normal mismatch`);
    assert(mesh.triangles.length % 3 === 0 && mesh.triangles.every(n => Number.isInteger(n) && n >= 0 && n < count), `${id}: invalid indices`);
    const attributes = { POSITION: accessor(mesh.vertices, 3, 5126, true), NORMAL: accessor(mesh.normals, 3) };
    if (mesh.uv?.length) { assert.equal(mesh.uv.length, count * 2); attributes.TEXCOORD_0 = accessor(mesh.uv.map((v, j) => j % 2 ? 1 - v : v), 2); }
    const primitive = { attributes, indices: accessor(mesh.triangles, 1, count <= 65535 ? 5123 : 5125), material: materialIds.get(mesh.material) };
    assert.notEqual(primitive.material, undefined, `${id}: material missing`);
    const mi = doc.meshes.length; doc.meshes.push({ name: mesh.name || `${mesh.material} ${i}`, primitives: [primitive] });
    const ni = doc.nodes.length; doc.nodes.push({ name: mesh.name || `${mesh.material} ${i}`, mesh: mi, extras: { part: mesh.part || 'Static' } });
    const part = mesh.part || 'Static';
    if (!parts.has(part)) {
      const n = doc.nodes.length;
      doc.nodes.push({ name: part, children: [], ...(id === 'weight-exterior' && part !== 'Static' ? { translation: [part === 'Left' ? -1.28 : 1.28, 0, 1.55] } : {}) });
      doc.nodes[0].children.push(n); parts.set(part, n);
    }
    doc.nodes[parts.get(part)].children.push(ni); triangles += mesh.triangles.length / 3;
  }
  if (extensions.size) doc.extensionsUsed = [...extensions];
  const tail = (4 - bytes % 4) % 4; if (tail) { chunks.push(Buffer.alloc(tail)); bytes += tail; }
  doc.buffers[0].byteLength = bytes;
  const raw = Buffer.from(JSON.stringify(doc)), json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(json);
  const binary = Buffer.concat(chunks); const result = Buffer.alloc(12 + 8 + json.length + 8 + binary.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(json.length, 12); result.writeUInt32LE(0x4e4f534a, 16); json.copy(result, 20);
  const offset = 20 + json.length; result.writeUInt32LE(binary.length, offset); result.writeUInt32LE(0x004e4942, offset + 4); binary.copy(result, offset + 8);
  fs.writeFileSync(path.join(OUTPUT, id + '.glb'), result);
  manifest.models.push({ id, label, file: `assets/models/heritage/${id}.glb`, source: input, triangles, materials: doc.materials.length, bytes: result.length, sha256: hash(result), parts: [...parts.keys()] });
  console.log(`EXPORTED ${id}: ${triangles} triangles, ${(result.length / 1048576).toFixed(2)} MiB`);
}
if (process.argv.includes('--preserve-only')) {
  fs.writeFileSync(path.join(PRESERVED, 'preservation.json'), JSON.stringify({ date: '2026-10-02', files: records }, null, 2));
  console.log(`PRESERVED ${records.length} files with matching SHA-256`);
} else {
  for (const [id, input, label] of selected) glb(id, input, label);
  fs.copyFileSync(path.join(MODELS, 'Meadow/leaf-profiles.json'), path.join(OUTPUT, 'leaf-profiles.json'));
  fs.writeFileSync(path.join(OUTPUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  if (records.length) fs.writeFileSync(path.join(PRESERVED, 'preservation.json'), JSON.stringify({ date: '2026-10-02', files: records }, null, 2));
  console.log(`READY ${manifest.models.length} GLBs, ${manifest.models.reduce((n, m) => n + m.bytes, 0)} bytes`);
}
