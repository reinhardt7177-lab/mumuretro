require('./forest-render-output-guard.cjs');
const fs=require('node:fs'),{spawnSync}=require('node:child_process'),{B}=require('./forest-render-fixture.cjs'),phase=process.argv[2]||'goal',extend=process.argv.includes('--extend'),rows=extend?JSON.parse(fs.readFileSync(B+'/fault-validation.json')).rows:[];
const cases=[['owner','static batches stay inside their original owning candidate or moving crate'],['camera','camera selection and actual rays retain the original pieces without aggregated obstacles'],['geometry','every merged world vertex normal UV and triangle retains its source material and shadow state'],['appearance','all fifteen fixed views preserve the original rendered appearance'],['visibility','hiding one harvested candidate suppresses its real submitted batches and source pieces'],['calls','the unchanged world view actually submits fewer draw calls']];
if(extend&&(rows.length!==2||rows[0].fault!=='owner'||rows[1].fault!=='camera'))throw Error('Extend is only for the original two-case receipt; do not rerun completed faults.');
for(const [fault,expected]of cases.slice(extend?2:0)){
 const child=spawnSync(process.execPath,['tools/check-forest-render.cjs',phase,'--fault='+fault],{encoding:'utf8',env:process.env});
 fs.writeFileSync(B+'/fault-'+fault+'.log',child.stdout+child.stderr);
 const report=JSON.parse(fs.readFileSync(B+'/check-'+phase+'-fault-'+fault+'.json'));
 const failures=report.checks.filter(c=>!c.pass),pass=child.status!==0&&!report.pass&&!report.errors.length&&failures.length===1&&failures[0].name===expected;
 rows.push({fault,pass,exit:child.status,expected});console.log((pass?'DETECTED ':'FAILED ')+fault);
 if(!pass)break;
}
const report={pass:rows.length===6&&rows.every(r=>r.pass),scope:'Browser-only injected source/render variants;installed product and personal saves untouched',rows};
fs.writeFileSync(B+'/fault-validation.json',JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
