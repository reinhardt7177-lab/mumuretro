// No-build development server. node tools/serve-local.cjs [port]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mime = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };
http.createServer((req, res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname.replace(/\/$/, '/index.html'))); }
  catch { res.writeHead(400); res.end(); return; }
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
}).listen(Number(process.argv[2] || 5500), '127.0.0.1', function () {
  console.log('Mumu Planet: http://127.0.0.1:' + this.address().port);
});
