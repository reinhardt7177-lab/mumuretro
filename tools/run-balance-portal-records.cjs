const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/'+(process.argv[2]==='landscape'?'check-balance-record-landscape.cjs':'check-balance-records.cjs')),source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-25/evidence/balance-walls','reports/2026-10-25/evidence/balance-portals');
// Retains the real keyboard/touch read, hint, carry0, jump, orbit and save assertions.
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
