const fs=require('node:fs'),{spawn}=require('node:child_process');
const B='reports/2026-10-24/evidence/chronicle-evidence',rows=[];
const jobs=[
 ['identity',['tools/check-chronicle-evidence.cjs','--fault=identity'],1,'fault-identity.json','four distinct geometries match all randomized core witnesses'],
 ['ground',['tools/check-chronicle-evidence.cjs','--fault=ground'],1,'fault-ground.json','four carried specimens rest on floor zero'],
 ['save',['tools/run-chronicle-view-case.cjs','check-app-progress.cjs',B+'/save'],0,'save/app-progress.json'],
 ['baseline-cost',['tools/capture-chronicle-evidence.cjs','baseline-cost'],0,'baseline-cost/report.json'],
 ['after',['tools/capture-chronicle-evidence.cjs','after'],0,'after/report.json'],
 ['review',['tools/review-chronicle-evidence.cjs'],0,'review-check.json'],
];
(async()=>{for(const[name,args,expected,file,failure]of jobs){const log=fs.openSync(B+'/'+name+'.log','w'),code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{stdio:['ignore',log,log],env:process.env});p.on('error',reject);p.on('exit',resolve);});fs.closeSync(log);const result=fs.existsSync(B+'/'+file)?JSON.parse(fs.readFileSync(B+'/'+file)):null;const pass=code===expected&&(failure?result?.pass===false&&result.checks.at(-1)?.name===failure&&!result.checks.at(-1)?.pass&&result.errors.length===0:result?.pass===true);rows.push({name,code,pass,file,failure:failure||null});fs.writeFileSync(B+'/finish.json',JSON.stringify({pass:rows.length===jobs.length&&rows.every(r=>r.pass),rows},null,2));console.log(JSON.stringify(rows.at(-1)));if(!pass){process.exitCode=1;break;}}})();
