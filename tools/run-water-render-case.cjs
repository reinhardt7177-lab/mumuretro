const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
if(['check-water-courts.cjs','check-water-courts-camera.cjs'].includes(path.basename(process.argv[2]))){
  const target=path.resolve(__dirname,process.argv[2]),dest=path.resolve(process.argv[3]);fs.mkdirSync(dest,{recursive:true});const marker="'reports/2026-10-23/evidence/water-courts/'";let code=fs.readFileSync(target,'utf8');assert(code.includes(marker));code=code.replace(marker,JSON.stringify(dest.replaceAll('\\','/')+'/'));const current=new Module(target,module);current.filename=target;current.paths=Module._nodeModulePaths(__dirname);current._compile(code,target);
}else{
const file=path.join(__dirname,'run-water-courts-case.cjs');let source=fs.readFileSync(file,'utf8');const marker="'adapt-water-courts-check.cjs']";assert(source.includes(marker));source=source.replace(marker,"'adapt-water-courts-check.cjs','adapt-water-render-check.cjs']");const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(source,file);
}
