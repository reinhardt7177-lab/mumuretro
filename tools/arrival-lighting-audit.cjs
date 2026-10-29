const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A='art/arrival-coherence/v01/lighting',hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f));
const baseline=read(A+'/baseline.json'),previews=read(A+'/preview-files.json'),report={checkedUtc:new Date().toISOString(),rootPreserved:0,rootFivePreserved:0,previewModules:0,files:[]};
for(const row of baseline.runtimeFiles){assert.equal(hash(fs.readFileSync(row.file)),row.sha256,row.file);report.rootPreserved++;}
for(const row of baseline.rootFive){assert.equal(hash(fs.readFileSync(row.file)),row.sha256,row.file);report.rootFivePreserved++;}
for(const row of previews.files){const location=A+'/preview-'+row.file.replaceAll('/','__'),bytes=fs.readFileSync(location);assert.equal(hash(bytes),row.previewSha256);new vm.SourceTextModule(bytes.toString('utf8'),{identifier:location});report.previewModules++;report.files.push({...row,previewPath:location});}
report.pass=true;fs.writeFileSync(A+'/source-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,rootPreserved:report.rootPreserved,rootFivePreserved:report.rootFivePreserved,previewModules:report.previewModules}));
