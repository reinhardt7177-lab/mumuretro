const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'reports/2026-10-22/evidence/twin-shadow/regressions'),report={cases:[],wholeGoalComplete:false};fs.mkdirSync(OUT,{recursive:true});
async function run(name,file,args=[],env={}){
 console.log('START '+name);const wrapper=['check-balance-mechanisms.cjs','check-coop-room-browser.cjs'].includes(file)?'run-balance-onboarding-case.cjs':'run-twin-check-case.cjs',dest=path.join(OUT,name);let log='';
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--experimental-vm-modules','tools/'+wrapper,file,dest,...args],{cwd:ROOT,env:{...process.env,...env},windowsHide:true});child.on('error',reject);child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('close',resolve);});
 fs.writeFileSync(path.join(OUT,name+'.log'),log);const row={name,file,args,code,checks:(log.match(/^PASS /gm)||[]).length,pass:code===0};report.cases.push(row);console.log((row.pass?'PASS ':'FAIL ')+name+' checks '+row.checks);return row;
}
(async()=>{
 const single=process.argv.find(v=>v.startsWith('--case='))?.slice(7);
 const tests=[['native','check-moon-courts.cjs'],['sanctum','check-moon-sanctum.cjs'],['journey','check-shadow-journey.cjs'],['guardian','check-shadow-sanctum.cjs'],['shade','check-shade-court.cjs'],['mirror','check-mirror-gallery.cjs'],['silhouette','check-silhouette-court.cjs'],['device-camera','check-shadow-readability.cjs'],['actions','check-adventure-actions.cjs'],['app-save','check-app-progress.cjs'],['balance-native','check-balance-mechanisms.cjs'],['balance-start','check-balance-onboarding.cjs'],['sift','check-sift-architecture.cjs'],['water','check-water-adventure.cjs'],['fire','check-fire-adventure.cjs'],['strata','check-strata-journey.cjs'],['notebook','check-notebook-pages.cjs'],['interiors','check-adventure-interiors.cjs']].filter(([n])=>!single||n===single);
 let i=0;await Promise.all([0,1].map(async()=>{while(i<tests.length){const[n,f]=tests[i++];await run(n,f);}}));
 if(!single||single==='classroom'){
  const{createAppServer}=require('../server/app.cjs'),server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{await run('classroom','check-coop-room-browser.cjs',[],{AUDIT_URL:'http://127.0.0.1:'+server.address().port});}finally{await new Promise(r=>server.close(r));}
 }
 report.pass=report.cases.length>0&&report.cases.every(c=>c.pass);fs.writeFileSync(path.join(OUT,single?'focused-'+single+'.json':'report.json'),JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
})().catch(e=>{report.pass=false;report.failure=e.stack;fs.writeFileSync(path.join(OUT,'runner-failure.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;});
