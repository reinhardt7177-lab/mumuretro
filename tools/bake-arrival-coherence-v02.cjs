const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/bake-arrival-coherence.cjs');let source=fs.readFileSync(file,'utf8');
source=source.replaceAll('arrival-coherent-field-v01','arrival-coherent-field-v02').replaceAll('arrival-groundcover-v01','arrival-groundcover-v02');
source=source.replace("source=fs.readFileSync(file,'utf8');","source=fs.readFileSync(file,'utf8').replaceAll('surface-bake.json','surface-bake-v02.json');");
source=source.replace("B+'/bake-executed.cjs'","B+'/bake-v02-executed.cjs'");
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
