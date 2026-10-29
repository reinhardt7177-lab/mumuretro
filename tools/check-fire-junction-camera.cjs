// Existing camera assertions, now including the actual v04 floor geometry.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/check-fire-camera.cjs');let s=fs.readFileSync(file,'utf8');
s=s.replaceAll("evidence/fire-camera'","evidence/fire-junctions/camera'").replaceAll('-static-v03','-static-v0[34]');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
