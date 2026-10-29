const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const phase=process.argv[2]||'after',file=path.resolve('tools/diagnose-water-surface.cjs');let source=fs.readFileSync(file,'utf8');
source=source.replace("['before','no-shadow','bias','goal']",JSON.stringify([phase]));source=source.replace("B+'/diagnosis.json'","B+'/"+phase+".json'");
if(phase==='geometry-goal'){
 source=source.replace("p.on('pageerror'",`for(const kind of ['courts','devices'])await p.route('**/water-'+kind+'-v01.json',r=>r.fulfill({contentType:'application/json',body:fs.readFileSync('art/water-surface/v01/'+kind+'/water-'+kind+'-v02.json')}));p.on('pageerror'`);
 source=source.replaceAll("variant==='goal'","variant==='geometry-goal'").replaceAll("['bias','goal']","['geometry-goal']");
}else{
 const begin=source.indexOf("e.renderer.shadowMap.enabled=variant");const end=source.indexOf('refresh();',begin);assert(begin>0&&end>begin);source=source.slice(0,begin)+source.slice(end);
}
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
