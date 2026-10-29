const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),kind=process.argv[2],B='reports/2026-10-26/evidence/workspace-camera',table={
 input:['check-temple-camera-input.cjs','reports/2026-10-24/evidence/temple-camera'],
 sift:['check-separation-journey.cjs','reports/2026-10-22/evidence/separation-journey'],
 balance:['run-balance-observatory-case.cjs','reports/2026-10-25/evidence/balance-observatory'],
 coop:['run-balance-observatory-case.cjs','reports/2026-10-25/evidence/balance-observatory'],
 shadow:['check-twin-shadow.cjs','reports/2026-10-22/evidence/twin-shadow']
};if(!table[kind])throw Error('Unknown regression '+kind);const[name,from]=table[kind],dest=B+'/'+kind,file=path.resolve('tools/'+name);fs.mkdirSync(dest,{recursive:true});let source=fs.readFileSync(file,'utf8');if(!source.includes(from))throw Error('Original evidence marker missing: '+from);source=source.replaceAll(from,dest);if(['balance','coop'].includes(kind))process.argv=[process.execPath,file,kind];if(kind==='coop')source=source.replace("'tools/run-balance-observatory-coop-browser.cjs'","'tools/run-workspace-camera-coop-browser.cjs'");fs.writeFileSync(dest+'/adapter-source.cjs',source);const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
