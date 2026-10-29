// Only replace the two documented shape-fixture failures with successful reruns.
const fs=require('fs'),assert=require('assert/strict'),BASE='reports/2026-10-22/evidence/moon-courts/';
const read=f=>JSON.parse(fs.readFileSync(BASE+f)),initial=read('initial-regressions.json'),report=JSON.parse(JSON.stringify(initial));assert(initial.pass===false&&initial.cases.length===24);
const expected={journey:{checks:13,file:'journey.json',failure:'No timed shadow route'},shade:{checks:16,file:'report.json',failure:'Invalid camera fixture'}};
assert.deepEqual(initial.cases.filter(v=>!v.pass).map(v=>v.name).sort(),Object.keys(expected).sort());
for(const[name,{checks,file,failure}]of Object.entries(expected)){
  assert(fs.readFileSync(BASE+'initial-'+name+'/failure.log','utf8').includes(failure));
  const focused=read('regressions/focused-'+name+'.json'),r=read('regressions/'+name+'/'+file);assert(focused.pass&&focused.cases.length===1&&focused.cases[0].code===0&&focused.cases[0].checks===checks&&r.checks.length===checks&&r.checks.every(v=>v.pass)&&!r.errors?.length);
  const i=report.cases.findIndex(v=>v.name===name);report.cases[i]={...focused.cases[0],verifiedFrom:'regressions/focused-'+name+'.json'};
}
report.initialBatch='initial-regressions.json';report.shapeAwareFixturesVerified=true;report.pass=report.cases.every(v=>v.pass);assert(report.pass);fs.writeFileSync(BASE+'regressions/report.json',JSON.stringify(report,null,2));console.log('PASS18 normal groups and6 designated faults; original two fixture failures retained');
