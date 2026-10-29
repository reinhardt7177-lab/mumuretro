const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{spawnSync}=require('node:child_process');
const B='reports/2026-10-24/evidence/chronicle-framing/';
function execute(name){const file=path.resolve(__dirname,name),m=new Module(file,module);let source=fs.readFileSync(file,'utf8');if(!source.includes('reports/2026-10-24/evidence/chronicle-view/'))throw Error('Missing output redirect');source=source.replaceAll('reports/2026-10-24/evidence/chronicle-view/',B);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(source,file);}
if(process.argv[2]==='view')execute('check-chronicle-view.cjs');
else if(process.argv[2]==='existing')execute('run-chronicle-view-regressions.cjs');
else if(process.argv[2]==='faults'){
 const expected={aspect:'touch overview frames full guardian and feet 390',facing:'real sideways look preserves yaw and returns to readable traveller',tree:'guardian accelerated triangles match original Mesh raycast'},rows=[];
 for(const[fault,name]of Object.entries(expected)){const p=spawnSync(process.execPath,['tools/check-chronicle-framing.cjs','--fault='+fault],{env:process.env,encoding:'utf8',timeout:180000});fs.writeFileSync(B+'fault-'+fault+'.log',p.stdout+p.stderr);const r=JSON.parse(fs.readFileSync(B+'fault-'+fault+'.json')),last=r.checks.at(-1);const row={fault,exitCode:p.status,failure:last?.name,pass:p.status===1&&r.pass===false&&!r.errors.length&&last?.name===name&&!last.pass};rows.push(row);console.log(JSON.stringify(row));if(!row.pass)break;}
 fs.writeFileSync(B+'faults.json',JSON.stringify(rows,null,2));if(rows.length!==3||rows.some(r=>!r.pass))process.exitCode=1;
}else throw Error('Choose view, existing, or faults');
