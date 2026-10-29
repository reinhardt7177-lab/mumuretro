const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/build-arrival-dais.cjs');let source=fs.readFileSync(file,'utf8').replace("require('./arrival-dais-fixture.cjs')","require('./arrival-refinement-fixture.cjs')").replaceAll('466','476');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
