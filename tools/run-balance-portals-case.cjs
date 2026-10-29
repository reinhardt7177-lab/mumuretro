// Reuse established actual gameplay assertions; write this phase's own evidence.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const B='reports/2026-10-25/evidence/balance-portals';let file,source;
if(process.argv[2]==='balance'){
 file=path.resolve('tools/run-balance-onboarding-case.cjs');source=fs.readFileSync(file,'utf8');process.argv=[process.execPath,file,'check-balance-journey.cjs',B+'/balance'];
 const marker="fs.writeFileSync(path.join(dest,'executed-check.cjs'),s);";
 if(!source.includes(marker))throw Error('Missing journey adapter marker');
 const patches=[['for(const[slot,index]of observedBalanceOrder.entries()){const h=g.stock[index].home;bj.walk(5.5,3.5);','for(const[slot,index]of observedBalanceOrder.entries()){const h=g.stock[index].home;bj.walk(5.5,game.roomActor.position.z);bj.walk(5.5,3.5);','Existing return aisle around the solid placed answer crates.'],['bj.walk(5.5,-10.8);bj.walk(0,-10.8);','bj.walk(5.5,-10);bj.walk(0,-10);','Exit along the clear front of the first deep portal; the old -10.8 crossing intersects its stone pocket. All15 gameplay assertions retained.'],['bj.walk(5.5,-30.8);bj.walk(0,-30.8);','bj.walk(5.5,-30);bj.walk(0,-30);','Use the same clear front aisle at the second deep portal. No collider or puzzle assertion is bypassed.']];
 source=source.replace(marker,patches.map(p=>'replace('+p.map(v=>JSON.stringify(v)).join(',')+');').join('')+marker);
}else{file=path.resolve('tools/run-balance-paving-case.cjs');source=fs.readFileSync(file,'utf8').replaceAll('reports/2026-10-24/evidence/balance-paving',B);}
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
