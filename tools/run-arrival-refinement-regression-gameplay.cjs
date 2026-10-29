const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/run-arrival-dais-regression-gameplay.cjs'),source=fs.readFileSync(file,'utf8').replaceAll('arrival-dais','arrival-refinement');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
