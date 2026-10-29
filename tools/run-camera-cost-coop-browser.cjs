const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),file=path.resolve('tools/run-workspace-camera-coop-browser.cjs');
const source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-26/evidence/workspace-camera','reports/2026-10-26/evidence/camera-cost');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
