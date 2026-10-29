const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const B='reports/2026-10-24/evidence/strata-records',A='art/strata-records/v01',read=f=>JSON.parse(fs.readFileSync(f)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['check.json','reader-touch.json','fallback.json','gameplay/check.json','regressions/check-chronicle-evidence-touch/touch.json','regressions/journey/strata-journey.json','regressions/save/app-progress.json'];
const checks=files.map(file=>{const r=read(B+'/'+file);assert(r.pass&&r.checks.every(c=>c.pass),file);return{file,count:r.checks.length};});
const faults=['shell','hint'].map(name=>{const r=read(B+'/fault-'+name+'.json'),bad=r.checks.filter(c=>!c.pass);assert(!r.pass&&bad.length===1&&!r.errors.length);assert(bad[0].name.includes(name==='shell'?'every old shell':'hidden text'));return{name,detected:bad[0].name};});
const before=read(B+'/before/report.json'),after=read(B+'/after/report.json'),goal=read(A+'/goal/report.json');
for(const shot of after.shots)for(const group of [before,goal]){const match=group.shots.find(s=>s.id===shot.id);assert(match);for(const key of ['camera','quaternion','fov','aspect'])assert.deepEqual(shot[key],match[key],shot.id+' '+key);}
const release=read('dist/assets/release.json');for(const [file,expected] of Object.entries(release.files)){let content=fs.readFileSync(file);if(!file.startsWith('vendor/')&&/\.(html|js|css|json|svg|txt|md)$/.test(file))content=Buffer.from(content.toString().replace(/\r\n/g,'\n'));assert.equal(hash(content),expected,file);assert.equal(hash(fs.readFileSync('dist/'+file)),expected,file);}
const spec=read(A+'/design-spec.json'),assets=[spec.model,spec.source].map(file=>({file,bytes:fs.statSync(file).size,sha256:hash(fs.readFileSync(file))}));
assert(read(B+'/review-check.json').pass);
const r={pass:true,checks,total:checks.reduce((n,c)=>n+c.count,0),faults,matchingCameras:after.shots.length,buildFiles:Object.keys(release.files).length,records:after.shots[0].records,reusedAssets:assets,scope:'Local runtime and isolated browser validation; no deployment, student playtest or device FPS claim'};
fs.writeFileSync(B+'/summary.json',JSON.stringify(r,null,2));console.log(JSON.stringify({pass:r.pass,total:r.total,faults:faults.length,cameras:r.matchingCameras,build:r.buildFiles}));
