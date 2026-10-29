require('./forest-render-output-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),preview=process.argv.includes('--preview'),reverse=process.argv.includes('--reverse'),file=path.resolve('tools/measure-field-meadow.cjs');
let source=fs.readFileSync(file,'utf8').replace("require('./field-meadow-fixture.cjs')","require('./forest-render-fixture.cjs')");
if(!source.includes('&&p.calls===0'))throw Error('Original comparison marker changed');source=source.replace('&&p.calls===0','');
if(preview)source=source.replaceAll("fixture.hashes('after')","fixture.hashes('goal')").replace("for(const phase of['before','after'])","for(const phase of['before','goal'])").replaceAll("r.phase==='after'","r.phase==='goal'");
if(reverse)source=source.replace(preview?"for(const phase of['before','goal'])":"for(const phase of['before','after'])",preview?"for(const phase of['goal','before'])":"for(const phase of['after','before'])");
source=source.replaceAll("B+'/performance'+(tablet?'-tablet':'')+'.json'","B+'/performance"+(preview?'-goal':'')+(reverse?'-reverse':'')+"'+(tablet?'-tablet':'')+'.json'");
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
