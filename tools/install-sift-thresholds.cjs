const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),A='art/sift-thresholds/v01',B='reports/2026-10-25/evidence/sift-thresholds',read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),hash=raw=>crypto.createHash('sha256').update(raw).digest('hex'),text=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n'),baseline=read(B+'/baseline.json'),refresh=process.argv.includes('--refresh'),previous=refresh?read(B+'/installed.json'):null;
for(const file of['structure-preview.json','input-preview.json','records-preview.json','records-touch.json','record-resume-preview.json','orientation-control.json','source.json','source-control.json','faults-preview.json','fallbacks-preview.json','goal.json']){const r=read(B+'/'+file);assert(r.pass&&!r.errors?.length,'Preview not ready: '+file);}
if(refresh)for(const file of['shoulder-preview.json','margin-control.json','approach-control.json'])assert(read(B+'/'+file).pass,'Contact preview not ready '+file);
const goal=read(B+'/goal.json');assert.equal(goal.shots.length,16);const metrics=read(A+'/metrics.json');assert.equal(hash(fs.readFileSync(A+'/sift-thresholds-v01.glb')),metrics.sha256);
for(const f of baseline.files){const current=text(f),old=text(B+'/baseline-'+f.replaceAll('/','__')),next=text(A+'/preview-'+f.replaceAll('/','__'));assert(current===old||current===next,'User source changed during review '+f);assert.equal(hash(Buffer.from(next)),goal.sourceHashes[f]);}
const added={
 'assets/models/adventure/sift-thresholds-v01.glb':A+'/sift-thresholds-v01.glb',
 'assets/models/adventure/sift-thresholds-v01.json':A+'/design-spec.json',
 'src/shrine/SiftRecords.js':A+'/SiftRecords-preview.js',
 'src/shrine/SiftThresholds.js':A+'/SiftThresholds-preview.js',
};
for(const[target,source]of Object.entries(added)){if(fs.existsSync(target))assert(fs.readFileSync(target).equals(fs.readFileSync(source))||(refresh&&hash(fs.readFileSync(target))===previous.hashes[target]),'Existing target changed '+target);if(goal.sourceHashes[target])assert.equal(hash(Buffer.from(text(source))),goal.sourceHashes[target]);if(goal.assetHashes[target])assert.equal(hash(fs.readFileSync(source)),goal.assetHashes[target]);}
// Publish dependencies first; then atomically replace the four reviewed entry
// sources in dependency order. A normal refresh always finds imported modules.
function replace(f,source){const bytes=fs.readFileSync(source);if(fs.existsSync(f)&&fs.readFileSync(f).equals(bytes))return;const tmp=f+'.sift-install.tmp';assert(!fs.existsSync(tmp),'Unexpected installation temp '+tmp);fs.writeFileSync(tmp,bytes);fs.renameSync(tmp,f);}
for(const[target,source]of Object.entries(added))replace(target,source);
for(const f of['src/shrine/Signboard.js','src/shrine/StrataRecords.js','src/shrine/Room.js','src/boot.js'])replace(f,A+'/preview-'+f.replaceAll('/','__'));
const files=baseline.files,all=[...files,...Object.keys(added)];fs.writeFileSync(B+'/installed.json',JSON.stringify({createdAt:new Date().toISOString(),files,added:Object.keys(added),hashes:Object.fromEntries(all.map(f=>[f,hash(fs.readFileSync(f))]))},null,2));console.log('INSTALLED 4 reviewed source changes + 4 new files; original art and runtime assets retained');
