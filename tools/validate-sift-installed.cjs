const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),B='reports/2026-10-25/evidence/sift-thresholds',jobs=[
 ['structure',['tools/check-sift-thresholds.cjs'],'structure.json'],
 ['input',['tools/check-sift-threshold-input.cjs'],'input.json'],
 ['records',['tools/check-sift-records.cjs'],'records.json'],
 ['touch',['tools/check-sift-records.cjs','--touch'],'records-touch.json'],
 ['resume',['tools/check-sift-record-resume.cjs'],'record-resume.json'],
 ['shoulder',['tools/check-sift-threshold-shoulder.cjs'],'shoulder.json'],
 ['journey',['tools/run-sift-thresholds-case.cjs','journey'],'journey/journey.json'],
 ['strata',['tools/run-sift-thresholds-case.cjs','strata'],'strata/check.json'],
 ['strata-touch',['tools/run-sift-thresholds-case.cjs','strata-touch'],'strata-touch/reader-touch.json'],
 ['balance',['tools/run-sift-thresholds-case.cjs','balance'],'balance/balance/journey.json'],
 ['coop',['tools/run-sift-thresholds-case.cjs','coop'],'coop/classroom/classroom-browser.json'],
];
const selection=process.argv.slice(2),selected=selection.length?jobs.filter(v=>selection.includes(v[0])):jobs,report={jobs:[]},tmp=path.resolve('tmp/browser-validation');fs.mkdirSync(tmp,{recursive:true});let next=0;
async function worker(){while(next<selected.length){const[name,args,file]=selected[next++],started=Date.now();let log='';const exit=await new Promise(resolve=>{const child=cp.spawn(process.execPath,args,{env:{...process.env,TEMP:tmp,TMP:tmp},stdio:['ignore','pipe','pipe']});child.stdout.on('data',v=>log+=v);child.stderr.on('data',v=>log+=v);child.on('exit',resolve);});fs.writeFileSync(B+'/installed-'+name+'.log',log);let data,fresh=false;try{data=JSON.parse(fs.readFileSync(B+'/'+file));fresh=fs.statSync(B+'/'+file).mtimeMs>=started;}catch(e){data={pass:false,failure:e.message};}const pass=exit===0&&fresh&&data.pass&&!data.errors?.length;report.jobs.push({name,exit,pass,fresh,file,checks:data.checks?.length,failure:data.failure});fs.writeFileSync(B+'/installed-validation'+(selection.length?'-'+selection.join('-'):'')+'.json',JSON.stringify(report,null,2));console.log((pass?'PASS ':'FAIL ')+name+(data.failure?' '+data.failure.split('\n')[0]:''));}}
(async()=>{await Promise.all([worker(),worker()]);report.pass=report.jobs.length===selected.length&&report.jobs.every(v=>v.pass);fs.writeFileSync(B+'/installed-validation'+(selection.length?'-'+selection.join('-'):'')+'.json',JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;})();
