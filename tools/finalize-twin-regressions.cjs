const fs=require('node:fs'),assert=require('node:assert/strict');const BASE='reports/2026-10-22/evidence/twin-shadow/',read=f=>JSON.parse(fs.readFileSync(BASE+f,'utf8'));
const initial=read('initial-regressions.json'),focused=read('regressions/focused-interiors.json'),failed=read('initial-interiors/report.json'),fresh=read('regressions/interiors/report.json');
assert(initial.cases.length===19&&initial.cases.filter(v=>!v.pass).length===1&&initial.cases.find(v=>!v.pass).name==='interiors');
assert(!failed.pass&&failed.checks.length===8&&failed.failure.includes('actual walk blocked -1.4,4.2'));
assert(focused.pass&&focused.cases.length===1&&focused.cases[0].name==='interiors'&&focused.cases[0].code===0&&fresh.pass&&fresh.checks.length===38&&fresh.checks.every(v=>v.pass));
const report={...initial,cases:initial.cases.map(v=>v.name==='interiors'?{...focused.cases[0],supersedes:'initial-interiors/report.json',reason:'Old selection approach4.2 lay inside the native pedestal; actual front5.2 plus right-side walking passes all38 original assertions.'}:v),pass:true,initialFailurePreserved:true};
fs.writeFileSync(BASE+'regressions/report.json',JSON.stringify(report,null,2));console.log('PASS19 groups; only the preserved8-check pedestal-fixture failure is superseded by the complete38-check actual-input run');
