const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const A='art/arrival-dais/v01',B='reports/2026-10-26/evidence/arrival-dais',read=f=>JSON.parse(fs.readFileSync(f)),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
assert(!fs.existsSync(B+'/installation.json'),'Do not reinstall a completed stage');
const base=read(B+'/baseline.json');for(const [file,expected]of Object.entries(base.inventory))assert.equal(hash(file),expected,'Current root changed: '+file);
const normal=read(B+'/check-goal.json');assert(normal.pass&&normal.checks.length===6&&normal.checks.every(c=>c.pass));
const variants=read(B+'/variants-goal.json');assert(variants.pass);const tiers=variants.checks[0].details;assert.deepEqual(tiers.map(t=>t.actualTier),['high','mid','low','min']);assert(tiers.every(t=>t.accepted));
assert(read(B+'/blender-audit.json').pass);
for(const [name,expected]of [['contact','visible floor follows native walking support without soil or grass covering it'],['surface','baked surface matches physical levelled patch and new route signature']]){
 const fault=read(B+'/check-goal-fault-'+name+'.json');assert(!fault.pass&&!fault.errors.length);const failed=fault.checks.filter(c=>!c.pass);assert.equal(failed.length,1);assert.equal(failed[0].name,expected);
}
assert(read(B+'/goal-input/pc-input.json').pass);
const changed=base.files.filter(file=>fs.existsSync(A+'/preview-'+file.replaceAll('/','__'))&&hash(file)!==hash(A+'/preview-'+file.replaceAll('/','__')));assert.equal(changed.length,5);
const assets=['arrival-dais-v03.glb','arrival-field-v01.png','arrival-meadow-v01.json'];for(const file of assets)assert(!fs.existsSync('assets/models/adventure/'+file),'Preserve existing asset '+file);
for(const file of assets)fs.copyFileSync(A+'/exports/'+file,'assets/models/adventure/'+file);
for(const file of changed)fs.copyFileSync(A+'/preview-'+file.replaceAll('/','__'),file);
const inventory=Object.fromEntries([...Object.keys(base.inventory),...assets.map(f=>'assets/models/adventure/'+f)].map(f=>[f,hash(f)]));
const preserved=Object.keys(base.inventory).filter(f=>!changed.includes(f));assert(preserved.every(f=>hash(f)===base.inventory[f]));
const receipt={installedUtc:new Date().toISOString(),runtimeFiles:Object.keys(inventory).length,changed,assets,preservedFiles:preserved.length,preservedOldAssets:preserved.filter(f=>f.startsWith('assets/')).length,inventory,scope:'Local actual game source and three new assets; final product validation remains. No public deployment or personal save reset.'};
fs.writeFileSync(B+'/installation.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify({...receipt,inventory:undefined}));
