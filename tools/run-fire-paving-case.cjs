// Preserve established traversal checks and write this phase's evidence separately.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const name=process.argv[2]||'adventure';if(!['adventure','fracture','foundry','steam','sanctum','migration'].includes(name))throw Error('Unknown fire case');
const file=path.resolve('tools/check-fire-'+name+'.cjs');let source=fs.readFileSync(file,'utf8');
source=source.replace(/reports\/2026-10-\d+\/evidence\/fire-[a-z]+/g,'reports/2026-10-24/evidence/fire-paving/'+name);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
