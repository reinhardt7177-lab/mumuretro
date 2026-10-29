const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'reports/2026-10-22/evidence/adventure-interiors');
fs.mkdirSync(path.join(OUT,'logs'),{recursive:true});
const tests=[
 ['balance','check-balance-temple.cjs'],['balance-counts','check-balance-order-counts.cjs'],
 ['water','check-water-adventure.cjs'],['fire','check-fire-adventure.cjs'],
 ['shadow','check-shadow-sanctum.cjs'],['sift','check-sift-sanctum.cjs'],
 ['strata-ending','check-strata-journey.cjs'],['ship-common','check-starsail.cjs'],['opening-save-ui','quality-check.cjs']
];
const faults=[['environment','ship environment assigned'],['glyph','balance actual Blender glyphs instanced'],['clearance','balance physical geometry keeps passage clear'],['witness-collision','actual input stops at witness'],['signal','actual E carrying solves and lights'],['twilight','twilight front fill remains separate from star count']];
const report={started:new Date().toISOString(),cases:[],separatePhysicalStudentDevices:false};
async function run(name,file,args=[],env={}){const started=Date.now();console.log('START '+name);
const stream=fs.createWriteStream(path.join(OUT,'logs',name+'.log'));let log='';
const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(ROOT,'tools',file),...args],{cwd:ROOT,env:{...process.env,...env},windowsHide:true});child.on('error',reject);child.stdout.on('data',b=>{stream.write(b);log+=b.toString();});child.stderr.on('data',b=>{stream.write(b);log+=b.toString();});child.on('close',resolve);});
await new Promise(resolve=>stream.end(resolve));
const result={name,file,args,code,pass:code===0,passLines:(log.match(/^PASS /gm)||[]).length,wallSeconds:(Date.now()-started)/1000};report.cases.push(result);console.log((result.pass?'PASS ':'FAIL ')+name+' exit '+code+' checks '+result.passLines);return result;}
(async()=>{
let index=0;await Promise.all([0,1].map(async()=>{while(index<tests.length){const [name,file]=tests[index++];await run(name,file);}}));
// Faults have distinct expected terminal checks; a crash or unrelated failure is not a successful negative test.
let fi=0;await Promise.all([0,1].map(async()=>{while(fi<faults.length){const [name,expected]=faults[fi++],result=await run('fault-'+name,'check-adventure-interiors.cjs',['--break-'+name]);const evidence=JSON.parse(fs.readFileSync(path.join(OUT,'break-'+name+'.json')));const last=evidence.checks.at(-1);result.expectedFailure=expected;result.pass=result.code===1&&last?.pass===false&&last.name.includes(expected);result.terminalCheck=last?.name;console.log((result.pass?'EXPECTED FAILURE ':'UNEXPECTED FAILURE ')+name);}}));
// Only this owned ephemeral server and three independent browser contexts.
const {createAppServer}=require('../server/app.cjs');const server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{await run('classroom','check-coop-room-browser.cjs',[],{AUDIT_URL:'http://127.0.0.1:'+server.address().port});}finally{await new Promise(r=>server.close(r));}
report.finished=new Date().toISOString();report.pass=report.cases.every(c=>c.pass);fs.writeFileSync(path.join(OUT,'regressions.json'),JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
})().catch(e=>{report.error=e.stack;report.pass=false;fs.writeFileSync(path.join(OUT,'regressions.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;});
