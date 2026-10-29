const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/run-field-meadow-gameplay.cjs');let source=fs.readFileSync(file,'utf8').replace("require('./field-meadow-output-guard.cjs');",'').replaceAll('field-meadow','arrival-dais-regression');
if(process.argv[2]==='suite'){const marker="if(kind==='suite')source=source.replaceAll";if(!source.includes(marker))throw Error('Suite concurrency changed');source=source.replace(marker,"if(kind==='suite')source=source.replace('await Promise.all([worker(),worker()]);','await worker();');\n"+marker);}
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
