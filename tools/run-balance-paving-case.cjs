// Reuse established behavior checks without overwriting their earlier evidence.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const kind=process.argv[2],base='reports/2026-10-24/evidence/balance-paving',map={input:'check-temple-camera-input.cjs',crate:'check-balance-crate-contact.cjs',coop:'check-temple-camera-coop.cjs'};
let file,source;
if(kind==='counts'){
 file=path.resolve('tools/run-balance-onboarding-case.cjs');source=fs.readFileSync(file,'utf8');process.argv=[process.execPath,file,'check-balance-order-counts.cjs',base+'/counts'];
 const marker="fs.writeFileSync(path.join(dest,'executed-check.cjs'),s);",from='for(let i=0;i<count;i++){const h=g.stock[i].home;t.walk(5.5,3.5);',to='for(let i=0;i<count;i++){const h=g.stock[i].home;t.walk(5.5,game.roomActor.position.z);t.walk(5.5,3.5);';
 if(!source.includes(marker))throw Error('Missing count adapter marker');
 source=source.replace(marker,'replace('+JSON.stringify(from)+','+JSON.stringify(to)+',"Return via the previously validated side aisle around solid answer crates; keep all3/4/5 doorway and restore assertions.");'+marker);
}
else if(map[kind]){file=path.resolve('tools/'+map[kind]);source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-24/evidence/temple-camera',base);}
else if(kind==='balance'){file=path.resolve('tools/run-temple-camera-case.cjs');source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-24/evidence/temple-camera',base);}
else throw Error('Unknown balance paving regression');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
