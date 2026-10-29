const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),fixture=require('./field-meadow-fixture.cjs'),{A,B}=fixture;
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f)),base=read(B+'/baseline.json'),upgrade=process.argv.includes('--upgrade-uv');
for(const file of['checks/goal-normal.json','checks/validation-goal.json','blender-audit.json','expedition-goal/report.json','goal.json'])assert(read(B+'/'+file).pass,'Missing verified preview: '+file);
assert.equal(read(B+'/expedition-goal/report.json').checks.length,16);
const current={};function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.posix.join(dir,e.name);if(e.isDirectory())walk(f);else current[f]=hash(f);}}for(const d of['src','assets','vendor'])walk(d);for(const f of['index.html','fire-trial.html'])current[f]=hash(f);
if(upgrade)assert.deepEqual(current,read(B+'/installation.json').inventory,'Installed runtime changed before UV upgrade');else assert.deepEqual(current,base.inventory,'Runtime changed since baseline; preserve user work before installing');
const goals=fixture.hashes('goal');assert.deepEqual(read(B+'/goal.json').sources,goals,'Preview sources changed after24view capture');
if(upgrade){
 assert(read(B+'/checks/goal-poles.json').pass&&read(B+'/checks/validation-goal.json').results.length===8,'UV/pole controls are incomplete');
 const old=read(B+'/installation.json'),file='src/world/MeadowField.js';assert(!old.uvUpgrade,'UV upgrade is already installed; preserve the previous receipt');for(const f of base.files)assert.equal(hash(f),goals[f],'Only field coordinate preparation may change in this upgrade');
 for(const f of old.added.filter(f=>f.startsWith('assets/')))assert.equal(hash(f),hash(A+'/exports/'+path.basename(f)),'Authored assets changed after validation');
 fs.copyFileSync(B+'/installation.json',B+'/fragment-coordinate/installation.json');fs.copyFileSync(A+'/preview-src__world__MeadowField.js',file);current[file]=hash(file);assert.deepEqual(fixture.hashes('after'),goals);
 fs.writeFileSync(B+'/installation.json',JSON.stringify({...old,createdUtc:new Date().toISOString(),uvUpgrade:true,previousFieldSHA:old.inventory[file],inventory:current},null,2));console.log('PASS only field coordinate source upgraded;459runtime and all existing source/assets retained');process.exit(0);
}
const changed=[...base.files],added=['src/world/MeadowField.js',...['meadow-clusters-v01.glb','meadow-field-v01.png','meadow-kit-v01.json'].map(f=>'assets/models/adventure/'+f)];
for(const file of added)assert(!fs.existsSync(file),'Never replace an existing added asset: '+file);
const root=path.resolve('.'),targets=changed.concat(added);for(const f of targets)assert(path.resolve(f).startsWith(root+path.sep));
const plan={createdUtc:new Date().toISOString(),changed,added,preservedRuntime:Object.keys(current).filter(f=>!changed.includes(f)).length,sourceBefore:current,goalSources:goals};fs.writeFileSync(B+'/installation-plan.json',JSON.stringify(plan,null,2));
for(const f of changed.concat(added[0]))fs.copyFileSync(A+'/preview-'+f.replaceAll('/','__'),f);
for(const f of added.slice(1))fs.copyFileSync(A+'/exports/'+path.basename(f),f);
const after={};for(const f of Object.keys(current).concat(added))after[f]=hash(f);for(const f of Object.keys(current).filter(f=>!changed.includes(f)))assert.equal(after[f],current[f]);assert.equal(Object.keys(after).length,459);assert.deepEqual(fixture.hashes('after'),goals);
fs.writeFileSync(B+'/installation.json',JSON.stringify({createdUtc:new Date().toISOString(),pass:true,changed,added,inventory:after,preservedRuntime:plan.preservedRuntime},null,2));console.log(JSON.stringify({pass:true,changed:changed.length,added:added.length,preserved:plan.preservedRuntime,runtime:459}));
