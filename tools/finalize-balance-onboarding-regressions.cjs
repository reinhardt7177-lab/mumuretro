// Reconcile only the two diagnosed failed cases, preserving the original batch.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base='reports/2026-10-22/evidence/balance-onboarding/',read=f=>JSON.parse(fs.readFileSync(base+f)),initial=read('initial-regressions.json');
assert.equal(initial.pass,false);assert.equal(initial.cases.length,16);
assert.deepEqual(initial.cases.filter(c=>!c.pass).map(c=>c.name).sort(),['classroom','legacy-balance']);
const sources=[];for(const[name,count]of[['legacy-balance',8],['classroom',1]]){
  const file='regressions/focused-'+name+'.json',r=read(file);assert(r.pass&&r.cases.length===1&&r.cases[0].name===name&&r.cases[0].code===0&&r.cases[0].checks===count&&r.cases[0].pass);
  initial.cases[initial.cases.findIndex(c=>c.name===name)]={...r.cases[0],retestedFrom:file};sources.push(file);
}
assert(initial.cases.every(c=>c.pass));initial.pass=true;initial.initialBatch='initial-regressions.json';initial.retests=sources;initial.reconciledAt=new Date().toISOString();
fs.writeFileSync(path.join(base,'regressions/report.json'),JSON.stringify(initial,null,2));console.log('PASS11 normal groups and5 designated art/save faults; original failed batch retained');
