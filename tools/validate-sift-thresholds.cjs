const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),B='reports/2026-10-25/evidence/sift-thresholds',preview=process.argv.includes('--preview'),mode=process.argv[2]||'faults';
const jobs=mode==='faults'?[
 ['check-sift-thresholds.cjs','seam','structure-fault-seam.json','closed leaves cover all63'],
 ['check-sift-thresholds.cjs','sweep','structure-fault-sweep.json','swept moving leaves never'],
 ['check-sift-thresholds.cjs','shell','structure-fault-shell.json','all old black shells'],
 ['check-sift-thresholds.cjs','batch','structure-fault-batch.json','six static and five moving'],
 ['check-sift-records.cjs','hint','records-fault-hint.json','locked hint remains locked'],
 ['check-sift-records.cjs','carrying','records-fault-carrying.json','carried sieve keeps its return'],
 ['check-sift-records.cjs','camera','records-fault-camera.json','actual120update record orbit'],
 ['check-sift-threshold-input.cjs','save','input-fault-save.json','unsolved close approach saves'],
 ['check-sift-threshold-input.cjs','camera','input-fault-camera.json','camera'],
]:mode==='fallbacks'?[
 ['check-sift-thresholds.cjs','model','structure-fault-model.json',null],
 ['check-sift-thresholds.cjs','records','structure-fault-records.json',null],
]:[];
if(!jobs.length)throw Error('Use faults or fallbacks');
const report={mode,preview,jobs:[]},tmp=path.resolve('tmp/browser-validation');fs.mkdirSync(tmp,{recursive:true});let next=0;
async function worker(){while(next<jobs.length){const[file,fault,output,target]=jobs[next++],args=['tools/'+file,...preview?['--preview']:[],'--fault='+fault];let stdout='',stderr='';const exit=await new Promise(resolve=>{const child=cp.spawn(process.execPath,args,{env:{...process.env,TEMP:tmp,TMP:tmp},stdio:['ignore','pipe','pipe']});child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);child.on('exit',resolve);});fs.writeFileSync(B+'/'+output.replace('.json','.log'),stdout+stderr);const data=JSON.parse(fs.readFileSync(B+'/'+output)),failed=data.checks.filter(v=>!v.pass).map(v=>v.name),pass=target?exit===1&&!data.pass&&!data.errors.length&&!data.failure?.includes('Timeout')&&failed.some(name=>name.toLowerCase().includes(target.toLowerCase())):exit===0&&data.pass&&!data.errors.length;report.jobs.push({file,fault,exit,pass,expectedFailure:target,failed,output});console.log((pass?'PASS ':'FAIL ')+fault+' '+failed.join('; '));}}
(async()=>{await Promise.all([worker(),worker()]);report.pass=report.jobs.length===jobs.length&&report.jobs.every(v=>v.pass);fs.writeFileSync(B+'/'+mode+(preview?'-preview':'')+'.json',JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;})();
