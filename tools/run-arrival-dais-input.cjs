const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/check-landing-arrival-input.cjs');let source=fs.readFileSync(file,'utf8');
if(!source.includes("require('./landing-arrival-fixture.cjs')"))throw Error('Control fixture changed');
source=source.replace("require('./landing-arrival-fixture.cjs')","require('./arrival-dais-controls-fixture.cjs')");
const phase=process.argv[2]||'goal';fs.writeFileSync('reports/2026-10-26/evidence/arrival-dais/'+phase+'-input-executed.cjs',source);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
