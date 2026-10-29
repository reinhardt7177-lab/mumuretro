require('./world-horizon-output-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),phase=process.argv[2]||'after',{B}=require('./world-horizon-fixture.cjs'),file=path.resolve('tools/run-field-meadow-expedition.cjs'),source=fs.readFileSync(file,'utf8').replaceAll('field-meadow','world-horizon');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
