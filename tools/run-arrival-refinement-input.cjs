const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.resolve('tools/check-landing-arrival-input.cjs');let source=fs.readFileSync(file,'utf8');
if(!source.includes("require('./landing-arrival-fixture.cjs')"))throw Error('Control fixture changed');source=source.replace("require('./landing-arrival-fixture.cjs')","require('./arrival-refinement-controls-fixture.cjs')");
const B='reports/2026-10-27/evidence/arrival-refinement',phase=process.argv[2]||'goal';fs.writeFileSync(B+'/'+phase+'-input-executed.cjs',source);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
