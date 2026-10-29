// Current runtime/build and retained evidence for this phase, not whole-Goal completion.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const ROOT=path.resolve(__dirname,'..'),BASE='reports/2026-10-22/evidence/moon-courts/',ART='art/moon-courts/v01/',DEST=BASE+'verified/',reports=[];
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),hash=f=>sha(fs.readFileSync(path.join(ROOT,f)));
fs.mkdirSync(path.join(ROOT,DEST),{recursive:true});
function copy(name,file){const archive=DEST+name+'.json';fs.copyFileSync(path.join(ROOT,file),path.join(ROOT,archive));reports.push({name,source:file,archive,sha256:hash(archive)});return read(file);}
function checks(r,n,name){assert(r.pass!==false&&r.checks.length===n&&r.checks.every(v=>v.pass)&&!r.errors?.length,name);}
const primary=copy('courts',BASE+'courts.json');checks(primary,10,'native courts');
assert.deepEqual(primary.checks[0].details,{loaded:true,models:6,colliders:150,camera:12,hidden:true,courts:3});
assert(primary.checks[1].details.length===41&&primary.checks[2].details.length===38);
assert(primary.checks[2].details.every(v=>v.overlaps===0&&v.gap>.27&&v.gap<.33));
assert(primary.checks[3].details.safe.length>0&&primary.checks[3].details.safe.every(Boolean)&&primary.checks[3].details.track&&primary.checks[3].details.floor);
assert(primary.checks[5].details.every(v=>v.version===2&&v.same&&v.valid));
const camera=primary.checks[6].details;assert(camera.rows.length===216&&camera.full===216&&!camera.worse.length&&camera.rows.filter(v=>v.after>v.before).length===36);
assert(camera.rows.filter(v=>Math.abs(v.actual[0]-v.x)>.0001).every(v=>v.x===-7.8&&Math.abs(v.actual[0]+8.14)<1e-6));
assert(primary.checks[7].details.length===3&&primary.checks[7].details.every(v=>!v.open&&v.visible&&v.z>v.boundary));
const batch=copy('regressions',BASE+'regressions/report.json');assert(batch.pass&&batch.wholeGoalComplete===false&&batch.shapeAwareFixturesVerified&&batch.cases.length===24&&batch.cases.every(v=>v.pass));
assert(batch.cases.filter(v=>v.code===0).length===18&&batch.cases.filter(v=>v.code===1).length===6);
const normal={native:['courts.json',10],sanctum:['sanctum.json',11],journey:['journey.json',13],guardian:['report.json',21],shade:['report.json',16],mirror:['report.json',18],silhouette:['report.json',20],'device-camera':['readability.json',9],actions:['input-report.json',12],'app-save':['app-progress.json',7],'balance-native':['mechanisms.json',12],'balance-start':['onboarding.json',13],sift:['architecture.json',15],water:['report.json',21],fire:['report.json',27],strata:['strata-journey.json',14],notebook:['notebook-pages.json',19]};
let journey,sanctum;for(const[name,[file,n]]of Object.entries(normal)){const r=copy('regression-'+name,BASE+'regressions/'+name+'/'+file);checks(r,n,name);assert.equal(batch.cases.find(v=>v.name===name).code,0);if(name==='journey')journey=r;if(name==='sanctum')sanctum=r;}
assert.deepEqual(primary,read(BASE+'regressions/native/courts.json'));
assert(sanctum.checks[6].details.length===24&&sanctum.checks[6].details.every(v=>v.physicalMismatch===0));
assert(sanctum.checks[7].details.every(v=>v.boundaryMismatch===0&&v.targetMissing===0)&&sanctum.checks[8].details.full===96);
const route=journey.checks[3].details,metres=route.reduce((s,v)=>s+v.metres,0);assert(route.length===14&&metres>151.8&&route.every(v=>v.remaining<.36));
assert(journey.checks[4].details.native&&journey.checks[4].details.prompt.startsWith('E —')&&journey.checks[10].details.taken&&!journey.checks[10].details.duplicate&&journey.checks[11].details.final);
const classroom=copy('classroom',BASE+'regressions/classroom/classroom-browser.json');assert(classroom.pass&&classroom.clients===3&&classroom.checks.length===5&&classroom.separatePhysicalStudentDevices===false);
const cooperative=copy('cooperative-choice',BASE+'regressions/classroom/actual-choice.json');assert(cooperative.pass&&cooperative.actualInput&&cooperative.clients===3);assert.deepEqual(cooperative.selected.map(v=>v.count),[4,3]);assert(cooperative.selected.every(v=>v.reach&&v.frames>0)&&cooperative.sharedHomes.length===3&&cooperative.sharedHomes.every(v=>JSON.stringify(v)===JSON.stringify(cooperative.sharedHomes[0])));
const faults={model:'native three courts',floor:'all38 pier feet',body:'nonoverlapping shared piers',registration:'new camera meshes',signals:'safety patches',camera:'three court camera surveys'};
for(const[name,prefix]of Object.entries(faults)){const r=copy('fault-'+name,BASE+'regressions/fault-'+name+'/fault-'+name+'.json'),c=batch.cases.find(v=>v.name==='fault-'+name);assert(r.pass===false&&r.checks.at(-1).pass===false&&r.checks.at(-1).name.startsWith(prefix)&&c.code===1&&c.terminal===r.checks.at(-1).name);}
const adaptationFiles=[];for(const c of batch.cases){const dir=BASE+'regressions/'+c.name+'/',r=copy('adaptation-'+c.name,dir+'adaptations.json');assert.equal(r.assertionsWeakened,false);adaptationFiles.push(dir+'executed-check.cjs',dir+'adaptations.json');}
const initial=copy('initial-regressions',BASE+'initial-regressions.json');assert(!initial.pass&&initial.cases.filter(v=>!v.pass).length===2);
for(const name of['journey','shade']){const r=copy('focused-'+name,BASE+'regressions/focused-'+name+'.json');assert(r.pass&&r.cases.length===1&&r.cases[0].code===0);copy('initial-'+name,BASE+'initial-'+name+'/'+(name==='journey'?'journey.json':'report.json'));}
for(const name of['initial-safety-fixture','initial-camera204','initial-camera213'])copy(name,BASE+name+'.json');copy('camera-diagnostic',BASE+'camera-diagnostic.json');
const views=['before','after'].map(p=>copy('staged-'+p,BASE+p+'/report.json'));assert(views.every(v=>v.pass&&v.staged&&v.shots.length===9&&!v.errors.length));
for(let i=0;i<9;i++)for(const k of['actor','target','camera','fov'])assert.deepEqual(views[0].shots[i][k],views[1].shots[i][k]);
const comparison=copy('comparison',ART+'comparison-metrics.json');assert(comparison.pass&&comparison.fixedPairs===9&&comparison.nativeGoals===9&&comparison.nativePartViews===6&&comparison.actualScreens===5&&comparison.galleryImages===39);
const ui=copy('review-ui',BASE+'review-ui.json');assert(ui.pass&&ui.rows.length===2&&ui.rows.every(v=>v.images===39&&v.noOverflow));
const model=copy('model',ART+'model-metrics.json'),source=copy('source-open',ART+'source-open.json'),material=copy('material-export',ART+'material-export.json'),spec=read(ART+'design-spec.json');
const parts=spec.rooms.flatMap(v=>[v.shell,v.floor]);assert(parts.length===6&&parts.reduce((s,k)=>s+model[k].sourcePieces,0)===1472&&parts.reduce((s,k)=>s+model[k].meshes,0)===18&&parts.reduce((s,k)=>s+model[k].triangles,0)===32234&&model.glbBytes===4558212);
assert(source.pass&&!source.sourceModified&&parts.every(k=>source.parts[k].sourcePieces===model[k].sourcePieces)&&source.sourceSha256===hash(ART+'moon-courts-v01.blend'));
assert(source.textures.length===4&&source.textures.every(v=>v.exists&&v.path.startsWith('//')&&v.size.join()==='512,512'));
assert(spec.rooms.reduce((s,v)=>s+v.solids.length,0)===150&&spec.rooms.reduce((s,v)=>s+v.solids.filter(o=>o.name==='Grounded pier foot').length,0)===38);
assert.deepEqual(spec,read('assets/models/adventure/moon-courts-v01.json'));
const glb=fs.readFileSync(path.join(ROOT,'assets/models/adventure/moon-courts-v01.glb')),length=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+length));
assert(glb.length===4558212&&material.pass&&material.geometryAndImageChunkUnchanged&&material.materials.length===5&&gltf.materials.length===5&&gltf.images.length===4);assert.equal(sha(glb.subarray(20+length)),material.binaryChunkSha256);
const old=read('reports/2026-10-22/evidence/moon-sanctum/verification-index.json'),preserved=['assets/models/adventure/moon-sanctum-v01.glb','assets/models/adventure/moon-sanctum-v01.json','src/shrine/MoonSanctum.js','src/shrine/ShadowSanctum.js','src/shrine/SanctumOptics.js','src/render/SubjectCamera.js','src/shrine/RoomActor.js','src/render/StaticRaycastTree.js','src/sphere/CarryPresentation.js','assets/models/adventure/balance-onboarding-v01.glb','assets/models/adventure/balance-mechanisms-v01.glb','assets/models/adventure/sift-architecture-v01.glb'];
for(const f of preserved)assert.equal(hash(f),old.sourceHashes[f],f+' preserved');
const perf=copy('performance',BASE+'performance.json');assert(perf.pass&&!perf.errors.length&&perf.rows.length===6&&perf.rows.every(v=>v.native&&v.averageFps>0&&v.gpuBytes===null&&Number.isFinite(v.p95FrameMs)));
for(const name of['source','save','audio']){const f=BASE+'basic-'+name+'.log',s=fs.readFileSync(path.join(ROOT,f),'utf8');assert(name==='audio'?JSON.parse(s).pass:s.includes('PASS '));fs.copyFileSync(path.join(ROOT,f),path.join(ROOT,DEST+'basic-'+name+'.log'));}
assert(fs.readFileSync(path.join(ROOT,BASE+'build.log'),'utf8').includes('Built 368 runtime files'));
const release=read('dist/assets/release.json');assert.equal(Object.keys(release.files).length,368);
for(const[f,h]of Object.entries(release.files)){let b=fs.readFileSync(path.join(ROOT,f));if(!f.startsWith('vendor/')&&/\.(?:html|js|css|json|svg|txt|md)$/.test(f))b=Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'));assert.equal(sha(b),h,f+' canonical source');assert.equal(hash('dist/'+f),h,f+' build');}
const files=[...preserved,...adaptationFiles,'src/shrine/MoonCourts.js','src/shrine/Room.js','src/shrine/ShadeCourt.js','src/shrine/MirrorGallery.js','src/shrine/SilhouetteCourt.js','assets/models/adventure/moon-courts-v01.glb','assets/models/adventure/moon-courts-v01.json',ART+'moon-courts-v01.blend',ART+'DESIGN.md',ART+'design-spec.json',ART+'review.html',ART+'blueprint.svg','README.md','SECOND_BRAIN.md','tools/TESTING.md','reports/2026-10-22/ADVENTURE_RECONSTRUCTION.md','reports/2026-10-22/MOON_COURTS.md',BASE+'build.log','dist/assets/release.json','reports/2026-10-22/evidence/architecture-reference/source.json','reports/2026-10-22/evidence/architecture-reference/official-shrines-page26.png','reports/2026-09-08/reference/shadow-court-v01.png'];
for(const name of fs.readdirSync(path.join(ROOT,'tools')).filter(v=>/moon-courts/.test(v)&&/\.(?:cjs|py)$/.test(v)))files.push('tools/'+name);
for(const name of['journey','shade'])for(const file of['executed-check.cjs','adaptations.json','failure.log'])files.push(BASE+'initial-'+name+'/'+file);
for(const part of parts)files.push(ART+part+'.png');for(const name of['stone-albedo','stone-normal','floor-albedo','floor-normal'])files.push(ART+name+'.png');
for(const shot of views[0].shots){files.push(ART+'goal-'+shot.id+'.png');for(const phase of['before','after'])files.push(BASE+phase+'/'+shot.id+'.png');}
for(const id of['exterior','first-door','second-door','third-door','guardian'])files.push(BASE+'regressions/journey/actual-'+id+'.png');
for(const name of['review-1440.png','review-390.png','basic-source.log','basic-save.log','basic-audio.log'])files.push(BASE+name);
const index={pass:true,created:new Date().toISOString(),wholeGoalComplete:false,publicReleaseUpdated:false,studentPhysicalDevicesVerified:false,originalRuntimeExecuted:false,reaBinaryAnalysis:false,
checks:{native:10,bodyFeet:38,bodyBoxes:150,cameraMeshes:12,cameraViews:216,cameraClear:216,cameraImproved:36,cameraWorse:0,continuousInput:13,planetRouteMetres:metres,regressionGroups:18,designatedFaults:6,fixedPairs:9,nativeGoals:9,nativePartViews:6,actualScreens:5,galleryImages:39,runtimeFiles:368,canonicalSourceAndBuildHashesMatch:true},
models:{sourcePieces:1472,renderMeshes:18,triangles:32234,bytes:4558212,materials:5,images:4},
progress:{deviceVersions:[2,2,2],finalVersion:2,personalSaveKeyUnchanged:true,puzzleAnswersUnchanged:true},
averageFpsRange:[Math.min(...perf.rows.map(v=>v.averageFps)),Math.max(...perf.rows.map(v=>v.averageFps))],
limitations:['No original game runtime or REA internal code/parameter recovery.','Goals omit devices,rail/lamp/supports,safety/projections,veils,witnesses,hero,UI and actual lighting.','Camera survey is prepared static,with actual body resolution for an initially invalid emitter-side position.','Planned solver-assisted actual inputs are not student first understanding or fun.','Protected boxes are not full detailed foot/hand/rigid-body support.','Old rail/support/control art and contact,third-task repetition,boards,other spaces/guardians,notebook and ending remain.','Three browser contexts are not physical student devices or verified classroom LAN.','One-PC prepared current-entry performance is not an A/B improvement or school/all-scene FPS.'],
normalization:'non-vendor LF text;vendor/binary exact',reports,sourceHashes:Object.fromEntries([...new Set(files)].map(f=>[f,hash(f)]))};
fs.writeFileSync(path.join(ROOT,BASE+'verification-index.json'),JSON.stringify(index,null,2));console.log('PASS Moon courts receipt:10 native,216 views,13 input,18 groups,6 faults,368 runtime hashes; whole Goal incomplete');
