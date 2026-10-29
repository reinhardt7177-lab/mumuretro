require('./field-meadow-output-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{B}=require('./field-meadow-fixture.cjs'),kind=process.argv[2],file=path.resolve('tools/'+(kind==='suite'?'validate-camera-cost-gameplay.cjs':kind==='controls'?'run-camera-cost-case.cjs':'run-camera-cost-regression.cjs'));let source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-26/evidence/camera-cost',B+'/gameplay');
if(kind==='suite')source=source.replaceAll("['tools/run-camera-cost-case.cjs','controls']","['tools/run-field-meadow-gameplay.cjs','controls']").replaceAll("['tools/run-camera-cost-regression.cjs',kind]","['tools/run-field-meadow-gameplay.cjs',kind]");
else if(kind==='controls'){
 source=source.replaceAll("require('./camera-cost-fixture.cjs')","require('./field-meadow-controls-fixture.cjs')");
 process.argv=[process.execPath,file,'controls',...process.argv.slice(3)];
}
else{source=source.replaceAll('tools/run-camera-cost-coop-browser.cjs','tools/run-field-meadow-coop-browser.cjs');process.argv=[process.execPath,file,kind==='controls'?'controls':kind,...process.argv.slice(3)];}
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
