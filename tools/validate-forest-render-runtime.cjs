require('./forest-render-output-guard.cjs');
const fs=require('node:fs'),{spawn}=require('node:child_process'),{B}=require('./forest-render-fixture.cjs'),rows=[];
const jobs=[['normal',['tools/check-forest-render.cjs','after'],'check-after.json'],['input',['tools/check-forest-render-input.cjs','after'],'input-after.json'],['variants',['tools/check-forest-render-variants.cjs','after'],'variants-after.json'],['capture',['tools/capture-forest-render.cjs','after'],'after.json'],['gameplay',['tools/run-forest-render-gameplay.cjs','suite'],'gameplay/gameplay-validation.json']];
fs.mkdirSync(B+'/runtime-logs',{recursive:true});
(async()=>{for(const[name,args,file]of jobs){
 const log=fs.createWriteStream(B+'/runtime-logs/'+name+'.log'),child=spawn(process.execPath,args,{env:process.env,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
 fs.writeFileSync(B+'/runtime-progress.json',JSON.stringify({name,pid:child.pid,startedUtc:new Date().toISOString(),finished:rows},null,2));console.log('START '+name+' PID '+child.pid);
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});log.end();const result=JSON.parse(fs.readFileSync(B+'/'+file)),pass=code===0&&result.pass;
 rows.push({name,pass,exit:code,file,checks:result.checks?.length});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error('Installed runtime validation failed: '+name);
}fs.writeFileSync(B+'/runtime-validation.json',JSON.stringify({pass:true,finishedUtc:new Date().toISOString(),rows},null,2));
})().catch(error=>{fs.writeFileSync(B+'/runtime-validation.json',JSON.stringify({pass:false,rows,error:error.stack},null,2));console.error(error);process.exitCode=1;});
