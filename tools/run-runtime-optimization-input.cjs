// Reuse the established real keyboard/touch + isolated reload checks while
// keeping this run's evidence separate from completed historical reports.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const out='reports/2026-10-29/evidence/runtime-optimization/input';
fs.mkdirSync(out,{recursive:true});
const touch=process.argv.includes('--touch');
assert(!fs.existsSync(out+'/'+(touch?'touch':'pc')+'-input.json'),'Preserve completed input evidence');
const file=path.resolve('tools/check-landing-arrival-input.cjs');let source=fs.readFileSync(file,'utf8');
const target="require('./landing-arrival-fixture.cjs')";
assert(source.includes(target),'Expected existing controller fixture import');
source=source.replace(target,`({B:${JSON.stringify(out)},prepare:async page=>{await require('./arrival-coherence-fixture.cjs').prepare(page,'after','mid');await page.evaluate(()=>{window.arrival={T:window.T};game.landing.arrive();});}})`);
fs.writeFileSync(out+'/'+(touch?'touch':'pc')+'-executed.cjs',source);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
