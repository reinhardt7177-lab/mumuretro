// Preserve the earlier visual inventory and capture the current authoritative app.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/capture-app-landscape.cjs');let source=fs.readFileSync(file,'utf8');
source=source.replaceAll('reports/2026-10-23/evidence/app-landscape/','reports/2026-10-24/evidence/app-landscape-v02/').replaceAll('art/app-landscape/v01/','art/app-landscape/v02/').replaceAll('Current395','Current426').replaceAll('395소스','426소스').replaceAll('reports/2026-10-23/APP_LANDSCAPE.md','reports/2026-10-24/APP_LANDSCAPE_V02.md');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
