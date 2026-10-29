const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const B='reports/2026-10-24/evidence/fire-camera/other-room';fs.mkdirSync(B,{recursive:true});
const file=path.resolve('tools/check-moon-camera-motion.cjs');let s=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-22/evidence/moon-sanctum',B);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
