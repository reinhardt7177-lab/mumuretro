const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),kind=process.argv[2],B='reports/2026-10-26/evidence/camera-cost';let file,source;
if(['water','safety','chronicle'].includes(kind)){
 file=path.resolve('tools/run-temple-camera-case.cjs');source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-24/evidence/temple-camera',B);
}else if(['fire','fire-camera'].includes(kind)){
 file=path.resolve('tools/check-'+(kind==='fire'?'fire-adventure':'fire-camera')+'.cjs');source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-21/evidence/fire-adventure',B+'/fire').replaceAll('reports/2026-10-24/evidence/fire-camera',B+'/fire-camera');
 process.argv=[process.execPath,file,...process.argv.slice(3)];
}else{
 file=path.resolve('tools/run-workspace-camera-case.cjs');source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-26/evidence/workspace-camera',B).replaceAll('tools/run-workspace-camera-coop-browser.cjs','tools/run-camera-cost-coop-browser.cjs');
}
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
