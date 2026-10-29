// Run only once build and all other browser validation jobs have ended.
require('./world-horizon-output-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),file=path.resolve('tools/measure-field-meadow.cjs');
let source=fs.readFileSync(file,'utf8').replace("require('./field-meadow-fixture.cjs')","require('./world-horizon-fixture.cjs')");
if(!source.includes('&&p.calls===0'))throw Error('Performance comparison marker changed');
source=source.replace('&&p.calls===0','');
if(process.argv.includes('--reverse')){
 if(!source.includes("for(const phase of['before','after'])"))throw Error('Phase order marker changed');
 source=source.replace("for(const phase of['before','after'])","for(const phase of['after','before'])").replace("B+'/performance'+(tablet?'-tablet':'')+'.json'","B+'/performance-reverse'+(tablet?'-tablet':'')+'.json'");
}
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
