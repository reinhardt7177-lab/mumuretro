const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),B='reports/2026-10-26/evidence/camera-cost',mode=process.argv[2]||'normal',phase=process.env.CAMERA_COST_PHASE||'after',directory=B+'/tests-'+phase;
fs.mkdirSync(directory,{recursive:true});const jobs=[],add=(name,args,file,expectedFailure)=>jobs.push({name,args,file,expectedFailure});
if(mode==='normal'){
 add('scene',['run-camera-cost-case.cjs','scene'],'scene/scene.json');add('any',['run-camera-cost-case.cjs','any'],'any/anyhit.json');
 add('math',['check-camera-cost-math.cjs'],'math.json');add('callback',['check-camera-cost-invalidation.cjs'],phase+'-callback.json');
 add('closest',['check-camera-closest.cjs'],phase+'-closest.json');add('forecast',['check-forecast-visibility-score.cjs'],phase+'-forecast-score.json');
}else if(mode==='faults'){
 for(const fault of['inside','stale','range','scale'])add('math-'+fault,['check-camera-cost-math.cjs','--fault='+fault],'fault-math-'+fault+'.json','100000 finite normalized');
 add('callback',['check-camera-cost-invalidation.cjs','--fault'],phase+'-callback-fault.json','callback changing origin');
 for(const[fault,failure]of[['far','1500 nearest results'],['order','equal-distance faces'],['fallback','custom fallback']])add('closest-'+fault,['check-camera-closest.cjs','--fault='+fault],phase+'-closest-fault-'+fault+'.json',failure);
 for(const[fault,failure]of[['remaining','140000 thresholds'],['consecutive','20000 complete ranks'],['disable','provably losing forecast']])add('forecast-'+fault,['check-forecast-visibility-score.cjs','--fault='+fault],phase+'-forecast-score-fault-'+fault+'.json',failure);
 for(const fault of['bounds','stale','membership','instances','inside','order','fallback','vertices','identity'])add('scene-'+fault,['run-camera-cost-case.cjs','scene','--fault='+fault],'scene/fault-scene-'+fault+'.json',({bounds:'spatial candidates',stale:'direct instance',membership:'membership duplicates',instances:'direct instance',inside:'inside-node',order:'membership duplicates',fallback:'custom morph',vertices:'raw vertex edits',identity:'raw vertex edits'})[fault]);
 for(const fault of['any','far','layers','range','transform','stale'])add('any-'+fault,['run-camera-cost-case.cjs','any','--fault='+fault],'any/fault-anyhit-'+fault+'.json',({any:'any-hit equals',far:'near far',layers:'near far',range:'draw ranges',transform:'any-hit equals',stale:'moving instanced geometry'})[fault]);
 for(const[fault,failure]of[['pose','controller poses'],['mask','ten rendered views']])add('view-'+fault,['check-camera-cost-views.cjs',phase,'--fault='+fault],phase+'-equivalence-fault-'+fault+'.json',failure);
}else throw Error('Unknown validation mode');
const results=[];for(const job of jobs){
 const command=['--experimental-vm-modules',path.join('tools',job.args[0]),...job.args.slice(1)],run=spawnSync(process.execPath,command,{encoding:'utf8',env:{...process.env,CAMERA_COST_PHASE:phase,TEMP:path.resolve('tmp/browser-validation'),TMP:path.resolve('tmp/browser-validation')},maxBuffer:8*1024*1024});
 fs.writeFileSync(directory+'/'+mode+'-'+job.name+'.log',run.stdout+'\n'+run.stderr);let r;try{r=JSON.parse(fs.readFileSync(B+'/'+job.file));}catch{}
 const failed=r?.checks?.filter(c=>!c.pass).map(c=>c.name)||[],pass=mode==='normal'?run.status===0&&r?.pass&&r.checks.length>0&&failed.length===0:run.status===1&&r?.pass===false&&failed.some(n=>n.includes(job.expectedFailure));
 const row={name:job.name,pass:!!pass,exit:run.status,file:job.file,checks:r?.checks?.length,expectedFailure:job.expectedFailure,failed,error:run.error?.message};results.push(row);console.log((pass?'PASS ':'FAIL ')+JSON.stringify(row));
}
const result={phase,mode,pass:results.every(v=>v.pass),finishedUtc:new Date().toISOString(),results};fs.writeFileSync(B+'/'+phase+'-'+mode+'-validation.json',JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
