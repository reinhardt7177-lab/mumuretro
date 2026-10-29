const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve(__dirname,'check-chronicle-view-review.cjs'),m=new Module(file,module);
const source=fs.readFileSync(file,'utf8').replaceAll('chronicle-view','chronicle-framing').replaceAll('33','21');
m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(source,file);
