require('./world-horizon-output-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{B}=require('./world-horizon-fixture.cjs'),file=path.resolve('tools/run-camera-cost-coop-browser.cjs'),source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-26/evidence/camera-cost',B+'/gameplay');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
