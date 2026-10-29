const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),A='art/arrival-coherence/v01/performance',COMBINED='art/arrival-coherence/v01/combined/manifest.json';
const read=f=>fs.readFileSync(path.join(ROOT,f)),json=f=>JSON.parse(read(f)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function prepare(){
 assert(!fs.existsSync(path.join(ROOT,A,'manifest.json')),'Preserve existing performance snapshot; do not run prepare twice');
 const raw=read(COMBINED),m=JSON.parse(raw),files=[],absent=[];
 // Check every original before writing anything. A stale combined baseline cannot become A.
 for(const row of m.files){
  if(row.beforeSha256){assert.equal(sha(read(row.file)),row.beforeSha256,'Root original changed: '+row.file);}
  else {assert(!fs.existsSync(path.join(ROOT,row.file)),'New candidate is already installed: '+row.file);absent.push(row.file);}
 }
 const drift=m.baseInventory.filter(r=>!fs.existsSync(path.join(ROOT,r.file))||sha(read(r.file))!==r.sha256).map(r=>r.file);
 assert.deepEqual(drift,[],'Root baseline inventory changed before snapshot');
 const poses=json('reports/2026-10-27/evidence/arrival-coherence/final-mid.json');assert(poses.pass&&poses.shots.length===3,'Require current final native three-view camera receipt');
 const landing=json('reports/2026-10-26/evidence/world-horizon/sites.json').find(s=>s.id==='landing');assert(landing);
 for(const row of m.files.filter(r=>r.beforeSha256)){
  const target=A+'/before/'+row.file;fs.mkdirSync(path.dirname(path.join(ROOT,target)),{recursive:true});fs.copyFileSync(path.join(ROOT,row.file),path.join(ROOT,target));
  files.push({file:row.file,snapshot:target,beforeSha256:row.beforeSha256,snapshotSha256:sha(read(target)),bytes:read(target).length});
 }
 fs.writeFileSync(path.join(ROOT,A,'combined-at-prepare.json'),raw);
 const cameras={source:'reports/2026-10-27/evidence/arrival-coherence/final-mid.json',sourceSha256:sha(read('reports/2026-10-27/evidence/arrival-coherence/final-mid.json')),scope:'Camera data only. All A source files are current Root 466 originals, never old forest/camera sources.',landing,views:poses.shots.map(({view,camera,quaternion,up,fov,aspect})=>({view,camera,quaternion,up,fov,aspect}))};
 fs.writeFileSync(path.join(ROOT,A,'cameras.json'),JSON.stringify(cameras,null,2)+'\n');
 const out={version:1,status:'prepared; browser performance has not been measured',createdUtc:new Date().toISOString(),rootLabel:'Root466 before integration',combinedManifest:COMBINED,combinedManifestSha256:sha(raw),rootBaselineEntries:m.baseInventory.length,baseInventory:m.baseInventory,files,absentBefore:absent,camerasSha256:sha(read(A+'/cameras.json')),measurement:{viewport:[1280,800],deviceScaleFactor:1,tiers:['mid','min'],views:cameras.views.map(s=>s.view),order:['before','after','after','before'],warmupFrames:90,sampleFrames:240,simulationDt:1/60,browser:'one isolated headless Microsoft Edge process; contexts opened and closed serially',requires:'Parent signals installation finished and all other validation/Blender jobs ended before --run-after-install.'}};
 fs.writeFileSync(path.join(ROOT,A,'manifest.json'),JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify({pass:true,existingOriginals:files.length,newAbsent:absent.length,rootBaselineEntries:m.baseInventory.length,beforeFiles:A+'/before',browserStarted:false}));
}
if(require.main===module)prepare();module.exports={ROOT,A,COMBINED,read,json,sha};
