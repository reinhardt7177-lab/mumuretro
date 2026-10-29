const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/world-horizon-output-guard.cjs');
const source=fs.readFileSync(file,'utf8').replaceAll('world-horizon','forest-render').replaceAll('Horizon validation','Forest-render validation');
const guarded=new Module(file,module);guarded.filename=file;guarded.paths=Module._nodeModulePaths(path.dirname(file));guarded._compile(source,file);module.exports=guarded.exports;
