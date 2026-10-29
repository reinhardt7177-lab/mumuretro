const fs=require('node:fs'),assert=require('node:assert/strict'),{files,transform}=require('./arrival-groundcover-transforms.cjs');
const A='art/arrival-coherence/v01/groundcover',B='reports/2026-10-27/evidence/arrival-groundcover',base=JSON.parse(fs.readFileSync(B+'/baseline.json'));
const prepared=files.map(file=>({file,out:A+'/preview-'+file.replaceAll('/','__'),body:transform(file,fs.readFileSync(file,'utf8'))}));
for(const row of prepared)assert(!fs.existsSync(row.out),'Preserve existing preview');
for(const row of prepared){if(!base.files.includes(row.file)){fs.copyFileSync(row.file,B+'/before-'+row.file.replaceAll('/','__'));base.files.push(row.file);}fs.writeFileSync(row.out,row.body);}
fs.writeFileSync(B+'/baseline.json',JSON.stringify(base,null,2));console.log('Prepared4 rooted preview transforms plus the new layered meadow helper. Root466 untouched.');
