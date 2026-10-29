require('./world-horizon-output-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/run-field-meadow-gameplay.cjs');let source=fs.readFileSync(file,'utf8').replaceAll('field-meadow','world-horizon');
if(process.argv[2]==='suite'){
 const old="if(kind==='suite')source=source.replaceAll",extra="if(kind==='suite')source=source.replace('await Promise.all([worker(),worker()]);','await worker();');\n";
 if(!source.includes(old))throw Error('Suite concurrency marker changed');source=source.replace(old,extra+old);
}
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
