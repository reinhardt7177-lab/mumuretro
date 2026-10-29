// The original batch passed; replace its staged-entry journey only with stronger actual approach evidence.
const fs=require('node:fs'),assert=require('node:assert/strict');const base='reports/2026-10-22/evidence/moon-sanctum/',read=f=>JSON.parse(fs.readFileSync(base+f));
const original=read('regressions-before-approach.json'),focused=read('regressions/focused-journey.json'),journey=read('regressions/journey/journey.json');
assert(original.pass&&original.cases.length===25&&original.cases.every(r=>r.pass));assert(focused.pass&&focused.cases.length===1&&focused.cases[0].name==='journey'&&focused.cases[0].code===0&&focused.cases[0].checks===13);
assert(journey.pass&&journey.checks.length===13&&journey.checks.every(c=>c.pass));const path=journey.checks.find(c=>c.name.startsWith('actual planet walking')).details,entry=journey.checks.find(c=>c.name.startsWith('visible E enters')).details;
assert(path.every(r=>r.remaining<.36)&&path.reduce((s,r)=>s+r.metres,0)>10&&entry.native&&entry.id==='shadow');
const i=original.cases.findIndex(c=>c.name==='journey');assert(original.cases[i].checks===11);original.previousStagedJourney=original.cases[i];original.cases[i]={...focused.cases[0],verifiedFrom:'regressions/focused-journey.json'};original.strongerApproachVerified=true;original.initialBatch='regressions-before-approach.json';
fs.writeFileSync(base+'regressions/report.json',JSON.stringify(original,null,2));console.log('PASS16 normal groups,9 faults; continuous journey now13 including actual planet approach');
