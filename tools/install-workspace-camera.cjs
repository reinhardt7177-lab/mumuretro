const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),A='art/workspace-camera/v01',B='reports/2026-10-26/evidence/workspace-camera',hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),base=JSON.parse(fs.readFileSync(B+'/baseline.json')),added=['src/shrine/WorkspaceViews.js','src/render/WorkspaceFraming.js'],files=[...base.files,...added];
for(const phase of['goal','goal-portrait','goal-landscape']){
 const checks=JSON.parse(fs.readFileSync(B+'/'+phase+'-checks.json')),capture=JSON.parse(fs.readFileSync(B+'/'+phase+'.json'));if(!checks.pass)throw Error('Preview quality gates not passed: '+phase);
 for(const f of files)if(capture.previewHashes?.[f]!==hash(A+'/preview-'+f.replaceAll('/','__')))throw Error('Preview changed since verified capture: '+phase+' '+f);
}
const previous=process.argv.includes('--update')?JSON.parse(fs.readFileSync(B+'/installation.json')):null;
for(const[f,h]of Object.entries(previous?.inventory||base.inventory))if(!fs.existsSync(f)||hash(f)!==h)throw Error('Preserve newer worktree changes: '+f);
for(const f of added)if(fs.existsSync(f)&&!previous)throw Error('New module already exists: '+f);
if(previous)fs.writeFileSync(B+'/installation-first.json',JSON.stringify(previous,null,2));
for(const f of[...added,...base.files.filter(f=>f!=='src/shrine/Room.js'),'src/shrine/Room.js'])fs.copyFileSync(A+'/preview-'+f.replaceAll('/','__'),f);
const inventory={};function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.posix.join(dir,e.name);if(e.isDirectory())walk(p);else inventory[p]=hash(p);}}for(const dir of['src','assets','vendor'])walk(dir);for(const f of['index.html','fire-trial.html'])inventory[f]=hash(f);
const changed=Object.keys(base.inventory).filter(f=>inventory[f]!==base.inventory[f]),unexpected=changed.filter(f=>!base.files.includes(f)),assets=Object.keys(base.inventory).filter(f=>f.startsWith('assets/'));
const report={pass:unexpected.length===0&&changed.length===base.files.length,installedUtc:new Date().toISOString(),changed,added,preservedOriginalFiles:Object.keys(base.inventory).length-changed.length,preservedAssets:assets.length,runtimeFiles:Object.keys(inventory).length,unexpected,inventory};fs.writeFileSync(B+'/installation.json',JSON.stringify(report,null,2));if(!report.pass)throw Error('Unexpected runtime changes');console.log(JSON.stringify({...report,inventory:undefined}));
