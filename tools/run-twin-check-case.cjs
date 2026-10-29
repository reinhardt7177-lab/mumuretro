// Compose earlier readiness/geometry fixes without rewriting archived check files.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const file=path.join(__dirname,'run-moon-courts-case.cjs');let wrapper=fs.readFileSync(file,'utf8');
const marker='wrapper=wrapper.replace(marker,insert+marker);';assert(wrapper.includes(marker));
const insert="source=require("+JSON.stringify(path.join(__dirname,'adapt-twin-check.cjs'))+")(name,source,adaptations);\n";
wrapper=wrapper.replace(marker,'wrapper=wrapper.replace(marker,insert+'+JSON.stringify(insert)+'+marker);');
const current=new Module(file,module);current.filename=file;current.paths=Module._nodeModulePaths(path.dirname(file));current._compile(wrapper,file);
