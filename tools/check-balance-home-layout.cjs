const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const OUT=path.resolve('reports/2026-10-22/evidence/balance-onboarding');fs.mkdirSync(OUT,{recursive:true});
const fault=process.argv.includes('--fault=identity'),report={checks:[],fault:!!fault,rows:[]};
function check(name,pass,details){report.checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);assert(pass,name);}
(async()=>{try{
let source=fs.readFileSync('src/shrine/BalanceOrderHomes.js','utf8');if(fault){assert(source.includes('[result[0],result[1],result[2]] = [c,a,b]'));source=source.replace('[result[0],result[1],result[2]] = [c,a,b]','[result[0],result[1],result[2]] = [a,b,c]');}
const{mixedHomeRanks}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function perms(a){return a.length?a.flatMap((v,i)=>perms(a.filter((_,j)=>j!==i)).map(p=>[v,...p])):[[]];}
let unchanged=0;for(const before of perms([0,1,2,3,4])){const original=before.slice(),after=mixedHomeRanks(before);assert.deepEqual(before,original);assert.deepEqual(after.slice().sort(),[0,1,2,3,4]);assert.deepEqual(after.slice(3),before.slice(3));if(before.join()===after.join())unchanged++;for(const n of[3,4,5]){const row=after.slice(0,n).map((rank,id)=>({rank,id})).sort((a,b)=>a.rank-b.rank).map(v=>v.id);report.rows.push({before,n,after:row});}}
check('all120 permutations preserve input,unique ranks and other crate homes',report.rows.length===360&&unchanged>=80,{unchanged,repaired:120-unchanged});
check('all360 selected rows begin in neither ascending nor descending weight order',report.rows.every(r=>r.after.some((v,i)=>v!==i)&&r.after.some((v,i)=>v!==r.n-1-i)),{cases:report.rows.length});
let rejected=0;for(const bad of[null,[0,1,2],[0,1,2,3,3],[0,1,2,3,5],[0,1,2,3,4.5]])try{mixedHomeRanks(bad);}catch(e){if(e instanceof TypeError)rejected++;}
check('malformed home permutations are rejected',rejected===5);
const one=[4,0,3,1,2];check('layout repair consumes no random values',!source.includes('Math.random')&&!source.includes('shuffle(')&&mixedHomeRanks(one).join()===mixedHomeRanks(one).join());report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e.message);}finally{fs.writeFileSync(path.join(OUT,fault?'fault-home-layout.json':'home-layout.json'),JSON.stringify(report,null,2));}})();
