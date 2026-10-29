const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const kind=process.argv[2],names={records:'check-strata-records.cjs',touch:'check-strata-records-touch.cjs',journey:'run-archive-hall-journey.cjs'};assert(names[kind]);
const file=path.resolve('tools',names[kind]);let s=fs.readFileSync(file,'utf8');
s=s.replaceAll('evidence/strata-records','evidence/sanctum-records/regressions/'+kind).replaceAll('evidence/archive-hall/regressions/journey','evidence/sanctum-records/regressions/journey');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
