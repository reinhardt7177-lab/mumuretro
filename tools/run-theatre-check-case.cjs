const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const file=path.join(__dirname,'run-moon-courts-case.cjs');let wrapper=fs.readFileSync(file,'utf8');const marker='wrapper=wrapper.replace(marker,insert+marker);';assert(wrapper.includes(marker));
const insert=['adapt-twin-check.cjs','adapt-theatre-check.cjs'].map(f=>'source=require('+JSON.stringify(path.join(__dirname,f))+')(name,source,adaptations);\n').join('');
wrapper=wrapper.replace(marker,'wrapper=wrapper.replace(marker,insert+'+JSON.stringify(insert)+'+marker);');const current=new Module(file,module);current.filename=file;current.paths=Module._nodeModulePaths(path.dirname(file));current._compile(wrapper,file);
