// Freeze this phase's evidence and current build. Never completes the whole Goal.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),BASE='reports/2026-10-22/evidence/moon-sanctum/',ART='art/moon-sanctum/v01/',DEST=BASE+'verified/',reports=[];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8')),hash=f=>sha(fs.readFileSync(path.join(ROOT,f)));
fs.mkdirSync(path.join(ROOT,DEST),{recursive:true});
function copy(name,file){const archive=DEST+name+'.json';fs.copyFileSync(path.join(ROOT,file),path.join(ROOT,archive));reports.push({name,source:file,archive,sha256:hash(archive)});return read(file);}
function checks(r,n,label){assert(r.pass!==false&&r.checks.length===n&&r.checks.every(c=>c.pass)&&!r.errors?.length,label);}
const main=copy('sanctum',BASE+'sanctum.json');checks(main,11,'native sanctum');
assert.deepEqual(main.checks[0].details,{loaded:true,models:3,colliders:43,parts:161,hidden:true,statue:true,track:true});
assert(main.checks[1].details.rows.length===18&&main.checks[1].details.lit);
assert(Math.abs(main.checks[1].details.bounds[0]+.2)<1e-5&&main.checks[1].details.bounds[1]===0);
assert(main.checks[2].details.rows.length===13&&main.checks[2].details.overlaps===0&&main.checks[2].details.rows.every(r=>Math.abs(r.gap-.28)<1e-4));
assert(main.checks[3].details.rows.length===2&&main.checks[3].details.rows.every(r=>r.frontVisible&&r.material));
assert.deepEqual(main.checks[4].details,{count:11,all:true,floorExcluded:true,oldExcluded:true});
assert(main.checks[5].details.ok&&main.checks[5].details.same&&main.checks[5].details.version===2);
assert.deepEqual([...main.checks[5].details.keys].sort(),['ai','eyes','hi','solved']);
const live=main.checks[6].details,contours=main.checks[7].details,camera=main.checks[8].details;
assert(live.length===24&&live.every(r=>r.physicalMismatch===0)&&live.reduce((s,r)=>s+r.count,0)===14616);
assert(contours.length===24&&contours.every(r=>r.boundaryMismatch===0&&r.targetMissing===0)&&contours.reduce((s,r)=>s+r.edges,0)===4100);
assert(camera.rows.length===96&&camera.full===96&&camera.worse.length===0&&camera.rows.filter(r=>r.after>r.before).length===5);
const optical=copy('optical-source',BASE+'optical-source.json');checks(optical,5,'source optics');
assert.deepEqual(Object.fromEntries(Object.entries(optical.checks[0].details).filter(([k])=>k!=='bounds')),{sourcePieces:159,renderMeshes:5,actualVertices:15376,pieceVertices:4267,unrepresentedActual:0,unrepresentedPieces:0});
assert(optical.optics.length===24&&optical.optics.every(r=>r.mismatch===0&&r.bounded)&&optical.optics.reduce((s,r)=>s+r.count,0)===54720);
const offset=copy('fault-optical-source',BASE+'fault-optical-source.json');assert(offset.pass===false&&offset.checks.length===1&&offset.checks[0].pass===false&&offset.checks[0].name.startsWith('every merged render vertex'));
const motion=copy('camera-motion',BASE+'camera-motion.json');assert(motion.pass&&motion.preparedControlStart&&motion.actualMovement&&motion.rows.length===45&&Math.abs(motion.metres-1.215)<1e-8&&motion.maxCameraStep<.08&&motion.minVisible===3&&motion.rows.every(r=>r.blocked===0&&r.yaw===Math.PI));
const boundary=copy('boundary-precision',BASE+'boundary-precision-diagnostic.json');assert(boundary.rows.length===24&&boundary.rows.every(r=>r.bad===0));
const batch=copy('regressions',BASE+'regressions/report.json');assert(batch.pass&&batch.strongerApproachVerified&&batch.wholeGoalComplete===false&&batch.cases.length===25&&batch.cases.every(c=>c.pass));
assert(batch.cases.filter(c=>c.code===0).length===16&&batch.cases.filter(c=>c.code===1).length===9);
const normal={journey:['journey.json',13],guardian:['report.json',21],shade:['report.json',16],mirror:['report.json',18],silhouette:['report.json',20],'device-camera':['readability.json',9],actions:['input-report.json',12],'app-save':['app-progress.json',7],'balance-native':['mechanisms.json',12],'balance-start':['onboarding.json',13],sift:['architecture.json',15],water:['report.json',21],fire:['report.json',27],strata:['strata-journey.json',14],notebook:['notebook-pages.json',19]};
let journey;const adaptationFiles=[];
for(const[name,[file,n]]of Object.entries(normal)){const r=copy('regression-'+name,BASE+'regressions/'+name+'/'+file);checks(r,n,name);assert.equal(batch.cases.find(c=>c.name===name).code,0);if(name==='journey')journey=r;}
const route=journey.checks[3].details,walkMetres=route.reduce((s,r)=>s+r.metres,0);assert(route.length===14&&walkMetres>151.8&&route.every(r=>r.remaining<.36));
assert(journey.checks[4].details.native&&journey.checks[4].details.prompt.startsWith('E —')&&journey.checks[4].details.mode==='room');
assert(journey.checks[9].details.solved&&journey.checks[9].details.awake===1&&journey.checks[9].details.drop===1);
assert(journey.checks[10].details.taken&&!journey.checks[10].details.duplicate&&journey.checks[10].details.mode==='planet');
assert(journey.checks[11].details.final&&journey.checks[11].details.taken&&journey.checks[11].details.cleared===1);
const classroom=copy('classroom',BASE+'regressions/classroom/classroom-browser.json');assert(classroom.pass&&classroom.clients===3&&classroom.checks.length===5&&classroom.separatePhysicalStudentDevices===false);
const coop=copy('classroom-actual-choice',BASE+'regressions/classroom/actual-choice.json');assert(coop.pass&&coop.actualInput&&coop.clients===3);assert.deepEqual(coop.selected.map(s=>s.count),[4,3]);assert(coop.selected.every(s=>s.reach&&s.frames>0)&&coop.sharedHomes.length===3&&coop.sharedHomes.every(h=>JSON.stringify(h)===JSON.stringify(coop.sharedHomes[0])));
const expected={model:'native guardian,arcade',projection:'all24 live shadows',registration:'all eleven new solid',floor:'visible paving',body:'thirteen shared piers',eyes:'original awakening eyes',cache:'all24 live shadows',boundary:'all24 target contours',camera:'final court camera survey'};
for(const[name,prefix]of Object.entries(expected)){const r=copy('fault-'+name,BASE+'regressions/fault-'+name+'/fault-'+name+'.json'),c=batch.cases.find(c=>c.name==='fault-'+name);assert(r.pass===false&&r.checks.at(-1).pass===false&&r.checks.at(-1).name.startsWith(prefix)&&c.code===1&&c.terminal===r.checks.at(-1).name);}
for(const c of batch.cases){const dir=BASE+'regressions/'+c.name+'/',r=copy('adaptation-'+c.name,dir+'adaptations.json');assert.equal(r.assertionsWeakened,false);adaptationFiles.push(dir+'executed-check.cjs',dir+'adaptations.json');}
const focus=copy('focused-journey',BASE+'regressions/focused-journey.json');assert(focus.pass&&focus.cases.length===1&&focus.cases[0].code===0&&focus.cases[0].checks===13);
copy('initial-staged-batch',BASE+'regressions-before-approach.json');
for(const name of['initial-fine-boundary-failure','initial-precision-boundary-failure','initial-planet-fixture-readiness-failure','initial-camera94','boundary-diagnostic','camera-diagnostic'])copy(name,BASE+name+'.json');
const views=['before','after'].map(p=>copy('staged-'+p,BASE+p+'/report.json'));assert(views.every(v=>v.pass&&v.staged&&v.shots.length===6&&!v.errors.length));
for(let i=0;i<6;i++)for(const key of['id','actor','target','camera','fov','angle','height','answer'])assert.deepEqual(views[0].shots[i][key],views[1].shots[i][key],key+' fixed');
const comparison=copy('comparison',ART+'comparison-metrics.json');assert(comparison.pass&&comparison.fixedPairs===6&&comparison.nativeGoals===6&&comparison.nativePartViews===9&&comparison.actualScreens===5&&comparison.galleryImages===33);
const ui=copy('review-ui',BASE+'review-ui.json');assert(ui.pass&&ui.rows.length===2&&ui.rows.every(r=>r.images===33&&r.noOverflow));
const model=copy('model',ART+'model-metrics.json'),source=copy('source-open',ART+'source-open.json'),material=copy('material-export',ART+'material-export.json');
const parts=['MoonGuardian','LunarArcade','LunarFloor'];assert(parts.reduce((s,k)=>s+model[k].triangles,0)===23938&&parts.reduce((s,k)=>s+model[k].meshes,0)===11&&parts.reduce((s,k)=>s+model[k].sourcePieces,0)===739&&model.glbBytes===3707668&&model.convexPieces===159);
assert(source.pass&&source.geometryUnchanged&&source.viewportOnly&&source.projectionPiecesMatch===159&&parts.every(k=>source.parts[k].sourcePieces===model[k].sourcePieces));
assert(source.textures.length===4&&source.textures.every(t=>t.exists&&t.path.startsWith('//')&&t.size.join()==='512,512'));
assert.deepEqual(read(ART+'design-spec.json'),read('assets/models/adventure/moon-sanctum-v01.json'));
const glb=fs.readFileSync(path.join(ROOT,'assets/models/adventure/moon-sanctum-v01.glb'));assert(material.pass&&material.geometryAndImageChunkUnchanged&&material.materials.length===6&&glb.length===model.glbBytes);assert.equal(sha(glb.subarray(20+glb.readUInt32LE(12))),material.binaryChunkSha256);
const preserved=[];
for(const[receipt,files]of [
 ['reports/2026-10-22/evidence/balance-onboarding/verification-index.json',['assets/models/adventure/balance-onboarding-v01.glb','assets/models/adventure/balance-onboarding-v01.json','assets/models/adventure/balance-mechanisms-v01.glb','assets/models/balance-temple-v04.glb','assets/models/heritage/balance-deity.glb','src/render/StaticRaycastTree.js','src/sphere/CarryPresentation.js','src/shrine/BalanceArt.js']],
 ['reports/2026-10-22/evidence/sift-architecture/verification-index.json',['assets/models/adventure/sift-architecture-v01.glb','assets/models/adventure/sift-architecture-v01.json']]
]){const old=read(receipt);for(const f of files){assert.equal(hash(f),old.sourceHashes[f],f+' preserved');preserved.push(f);}}
const perf=copy('performance',BASE+'performance.json');assert(perf.pass&&!perf.errors.length&&perf.rows.length===4&&perf.rows.every(r=>r.native&&r.averageFps>0&&Number.isFinite(r.p95FrameMs)&&r.gpuBytes===null));
for(const name of['source','save','audio']){const f=BASE+'basic-'+name+'.log',s=fs.readFileSync(path.join(ROOT,f),'utf8');assert(name==='audio'?JSON.parse(s).pass:s.includes('PASS '));fs.copyFileSync(path.join(ROOT,f),path.join(ROOT,DEST+'basic-'+name+'.log'));}
assert(fs.readFileSync(path.join(ROOT,BASE+'build.log'),'utf8').includes('Built 365 runtime files'));
const release=read('dist/assets/release.json');assert.equal(Object.keys(release.files).length,365);
for(const[f,expectedHash]of Object.entries(release.files)){let bytes=fs.readFileSync(path.join(ROOT,f));if(!f.startsWith('vendor/')&&/\.(?:html|js|css|json|svg|txt|md)$/.test(f))bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));assert.equal(sha(bytes),expectedHash,f+' canonical source');assert.equal(hash('dist/'+f),expectedHash,f+' build');}
const files=[...preserved,...adaptationFiles,'src/shrine/MoonSanctum.js','src/shrine/ShadowSanctum.js','src/shrine/SanctumOptics.js','src/shrine/Room.js','src/shrine/RoomActor.js','src/render/SubjectCamera.js','assets/models/adventure/moon-sanctum-v01.glb','assets/models/adventure/moon-sanctum-v01.json',ART+'moon-sanctum-v01.blend',ART+'DESIGN.md',ART+'design-spec.json',ART+'blueprint.svg',ART+'review.html','reports/2026-10-22/MOON_SANCTUM.md','reports/2026-10-22/ADVENTURE_RECONSTRUCTION.md','SECOND_BRAIN.md','README.md','tools/TESTING.md',BASE+'initial-staged-journey/executed-check.cjs',BASE+'initial-staged-journey/adaptations.json',BASE+'build.log','dist/assets/release.json','reports/2026-10-22/evidence/architecture-reference/source.json','reports/2026-10-22/evidence/architecture-reference/official-shrines-page26.png','reports/2026-09-08/reference/shadow-court-v01.png'];
for(const n of fs.readdirSync(path.join(ROOT,'tools')).filter(n=>/moon/.test(n)&&/\.(?:cjs|py)$/.test(n)))files.push('tools/'+n);
for(const n of['stone-albedo','stone-normal','floor-albedo','floor-normal'])files.push(ART+n+'.png');
for(const part of parts)for(const view of['front','side','rear'])files.push(ART+part+'-'+view+'.png');
for(const shot of views[0].shots){files.push(ART+'goal-'+shot.id+'.png');for(const p of['before','after'])files.push(BASE+p+'/'+shot.id+'.png');}
for(const id of['exterior','first-door','second-door','third-door','guardian'])files.push(BASE+'regressions/journey/actual-'+id+'.png');
for(const n of['guardian-front','court-front'])files.push(BASE+'initial-flat-floor/'+n+'.png');
for(const n of['initial-square-mask/model-metrics.json','initial-square-mask/guardian.png','initial-square-mask/court.png','initial-overlapping-piers/model-metrics.json'])files.push(ART+n);
for(const n of['review-1440.png','review-390.png','basic-source.log','basic-save.log','basic-audio.log'])files.push(BASE+n);
const index={pass:true,created:new Date().toISOString(),wholeGoalComplete:false,publicReleaseUpdated:false,studentPhysicalDevicesVerified:false,originalRuntimeExecuted:false,reaBinaryAnalysis:false,
 checks:{native:11,opticalSource:5,sourceRaySamples:54720,liveRaySamples:14616,renderedTargetEdges:4100,opticalStates:24,sourceConvexPieces:159,liveOpticalPieces:161,sharedPiers:13,bodyBoxes:43,cameraViews:96,cameraClear:96,cameraImproved:5,cameraWorse:0,actualCameraFrames:45,continuousInput:13,planetRouteMetres:walkMetres,regressionGroups:16,designatedFaults:10,fixedPairs:6,nativeGoals:6,nativePartViews:9,actualScreens:5,galleryImages:33,runtimeFiles:365,canonicalSourceAndBuildHashesMatch:true},
 models:{sourcePieces:739,triangles:23938,meshes:11,bytes:3707668,materials:6,images:4,sourceGeometrySha256:source.geometrySha256},
 progress:{finalVersion:2,fields:['ai','hi','solved','eyes'],puzzleAnswersUnchanged:true,personalSaveKeyUnchanged:true},
 averageFpsRange:[Math.min(...perf.rows.map(r=>r.averageFps)),Math.max(...perf.rows.map(r=>r.averageFps))],
 limitations:['Official/own observations, no original runtime or REA code/parameter recovery.','Goals omit old rail,lamp,controls,hero,orb,UI and actual lighting.','Short camera input and planned solver-assisted route are not student understanding or fun.','Three browser contexts are not three student devices or a verified classroom LAN.','Protected boxes are not exact ornament contact or rigid-body support.','First three large rooms,rail/control art and hand actions,third-task repetition,other spaces/guardians,notebook and ending remain.','One-PC prepared current performance is not an A/B improvement or school/all-scene FPS.'],
 normalization:'non-vendor LF text;vendor/binary exact',reports,sourceHashes:Object.fromEntries([...new Set(files)].map(f=>[f,hash(f)]))};
fs.writeFileSync(path.join(ROOT,BASE+'verification-index.json'),JSON.stringify(index,null,2));
console.log('PASS Moon receipt:11 native,5 source,24 optics,96 cameras,13 input,16 groups,10 faults,365 runtime hashes; whole Goal incomplete');
