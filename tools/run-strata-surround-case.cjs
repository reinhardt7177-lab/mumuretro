const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const which=process.argv[2],file=path.resolve('tools/'+(which==='play'?'check-strata-inlays.cjs':'run-strata-inlays-case.cjs'));
if(!['play','touch'].includes(which))throw Error('Expected play or touch');
let code=fs.readFileSync(file,'utf8').replaceAll('evidence/strata-inlays','evidence/strata-surround');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(code,file);
