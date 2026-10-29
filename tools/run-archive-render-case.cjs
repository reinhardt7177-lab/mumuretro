const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const kind=process.argv[2],names={play:'check-archive-hall.cjs',touch:'check-archive-hall-touch.cjs',journey:'run-archive-hall-journey.cjs',light:'check-chronicle-light.cjs'};
assert(names[kind]);const file=path.resolve('tools',names[kind]);let source=fs.readFileSync(file,'utf8');
source=source.replaceAll('evidence/archive-hall','evidence/archive-render/regressions/'+kind).replaceAll('evidence/chronicle-light','evidence/archive-render/regressions/light');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
