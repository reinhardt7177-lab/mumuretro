// Keep original assertions and fixtures; isolate output from earlier evidence.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),kind=process.argv[2],B='reports/2026-10-25/evidence/sift-thresholds',table={
 journey:['check-separation-journey.cjs','reports/2026-10-22/evidence/separation-journey',B+'/journey'],
 strata:['check-strata-records.cjs','reports/2026-10-24/evidence/strata-records',B+'/strata'],
 'strata-touch':['check-strata-records-touch.cjs','reports/2026-10-24/evidence/strata-records',B+'/strata-touch'],
 balance:['run-balance-observatory-case.cjs','reports/2026-10-25/evidence/balance-observatory',B+'/balance'],
 coop:['run-balance-observatory-case.cjs','reports/2026-10-25/evidence/balance-observatory',B+'/coop'],
};
if(!table[kind])throw Error('Unknown regression case '+kind);const[name,from,dest]=table[kind],file=path.resolve('tools/'+name);fs.mkdirSync(dest,{recursive:true});let source=fs.readFileSync(file,'utf8');if(!source.includes(from))throw Error('Regression evidence marker missing');source=source.replaceAll(from,dest);
if(kind==='balance'||kind==='coop')process.argv=[process.execPath,file,kind];
if(kind==='coop')source=source.replace("'tools/run-balance-observatory-coop-browser.cjs'","'tools/run-sift-thresholds-coop-browser.cjs'");
fs.writeFileSync(dest+'/adapter-source.cjs',source);const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
