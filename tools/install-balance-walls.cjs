// Apply exactly the reviewed virtual patches after checking every input before writing.
const fs=require('node:fs'),assert=require('node:assert/strict');
const A='art/balance-walls/v01',patches=JSON.parse(fs.readFileSync(A+'/patches.json')),files=new Map();
for(const p of patches){const source=files.get(p.file)??fs.readFileSync(p.file,'utf8');assert(source.includes(p.from),p.file+' marker changed');files.set(p.file,source.replace(p.from,p.to));}
for(const file of ['src/shrine/BalanceRecords.js','assets/models/balance-temple-v06.glb'])assert(!fs.existsSync(file),'Preserve unexpected existing '+file);
for(const[file,source]of files)fs.writeFileSync(file,source);
fs.copyFileSync(A+'/BalanceRecords-preview.js','src/shrine/BalanceRecords.js');fs.copyFileSync(A+'/balance-temple-v06.glb','assets/models/balance-temple-v06.glb');
console.log('Connected reviewed model and record module; changed',files.size,'existing source files');
