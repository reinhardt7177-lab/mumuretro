const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {ROOT,A,read,json,sha}=require('./arrival-performance-prepare.cjs'),fixture=require('./arrival-performance-fixture.cjs');
function stats(values){assert(values.length);const s=[...values].sort((a,b)=>a-b),mean=s.reduce((n,v)=>n+v,0)/s.length,q=p=>s[Math.min(s.length-1,Math.ceil(p*s.length)-1)];return{count:s.length,min:s[0],mean,median:s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2,p95:q(.95),p99:q(.99),max:s.at(-1)};}
function schedule(m){return m.measurement.tiers.flatMap(tier=>m.measurement.views.flatMap(view=>m.measurement.order.map((phase,i)=>({tier,view,phase,replicate:i<2?1:2,order:i+1}))));}
function summarize(rows){return ['mid','min'].flatMap(tier=>['front','side','rear'].map(view=>{
 const pair={tier,view};for(const phase of['before','after']){const r=rows.filter(v=>v.tier===tier&&v.view===view&&v.phase===phase);assert.equal(r.length,2);assert.deepEqual(r[1].logicalBuffers,r[0].logicalBuffers,'Repeated logical geometry differs: '+tier+'/'+view+'/'+phase);const flat=r.flatMap(v=>v.samples);pair[phase]={replicateOrders:r.map(v=>v.order),replicateRafMeans:r.map(v=>stats(v.samples.map(s=>s.rafIntervalMs)).mean),replicateRendererResources:r.map(v=>v.rendererResources),replicateSubmittedCalls:r.map(v=>stats(v.samples.map(s=>s.submittedCalls))),replicateSubmittedTriangles:r.map(v=>stats(v.samples.map(s=>s.submittedTriangles))),...Object.fromEntries(['rafIntervalMs','stepWallMs','cameraLockMs','stepExcludingPoseLockMs','renderSubmitMs','frameWorkMs','submittedCalls','submittedTriangles','stepSubmittedCalls','stepSubmittedTriangles'].map(k=>[k,stats(flat.map(v=>v[k]))])),logicalBuffers:r[0].logicalBuffers,drawingBuffer:r[0].drawingBuffer};pair[phase].observedRafRate=1000/pair[phase].rafIntervalMs.mean;}
 for(const r of rows.filter(v=>v.tier===tier&&v.view===view))assert.deepEqual(r.drawingBuffer,pair.before.drawingBuffer,'Same-tier buffer mismatch');
 pair.afterMinusBefore=Object.fromEntries(['rafIntervalMs','stepWallMs','renderSubmitMs','submittedCalls','submittedTriangles'].map(k=>[k,pair.after[k].mean-pair.before[k].mean]));return pair;
}));}
async function measurePage(page,config){
 return page.evaluate(async({warmupFrames,sampleFrames,simulationDt})=>{
  const game=window.game,e=game.engine,r=e.renderer,probe=window.__arrivalPerf,c=e.camera,samples=[],warmup=[];
  const previousAuto=r.info.autoReset;r.info.autoReset=false;
  function buffers(root){
   const geometry=new Set(),arrays=new Set(),ranges=new Map();let attributes=0,indexBytes=0,instanceMatrixBytes=0,instanceColourBytes=0,morphBytes=0,geometryAttributeBytes=0,meshObjects=0;
   const add=(attribute,kind)=>{if(!attribute)return;const array=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array;if(!array||arrays.has(array))return;arrays.add(array);attributes++;const size=array.byteLength;if(kind==='index')indexBytes+=size;else if(kind==='matrix')instanceMatrixBytes+=size;else if(kind==='colour')instanceColourBytes+=size;else if(kind==='morph')morphBytes+=size;else geometryAttributeBytes+=size;let spans=ranges.get(array.buffer);if(!spans)ranges.set(array.buffer,spans=[]);spans.push([array.byteOffset,array.byteOffset+size]);};
   root.traverse(o=>{if(!o.geometry)return;meshObjects++;const g=o.geometry;if(!geometry.has(g)){geometry.add(g);for(const a of Object.values(g.attributes))add(a,'geometry');add(g.index,'index');for(const group of Object.values(g.morphAttributes||{}))for(const a of group)add(a,'morph');}add(o.instanceMatrix,'matrix');add(o.instanceColor,'colour');});
   let uniqueByteRanges=0;for(const spans of ranges.values()){spans.sort((a,b)=>a[0]-b[0]);let start=spans[0][0],end=spans[0][1];for(const [a,b]of spans.slice(1)){if(a>end){uniqueByteRanges+=end-start;start=a;end=b;}else end=Math.max(end,b);}uniqueByteRanges+=end-start;}
   return{scope:'Active planetary scene including hidden objects, shared geometry/typed arrays deduplicated; index/morph/instanceMatrix/instanceColor included. Excludes textures, render targets, driver allocations, other room scenes and CPU collision/index structures. Not GPU VRAM.',geometryCount:geometry.size,meshObjects,typedArrayViews:attributes,geometryAttributeBytes,indexBytes,morphBytes,instanceMatrixBytes,instanceColourBytes,logicalUniqueByteRanges:uniqueByteRanges,logicalTypedArrayBytes:geometryAttributeBytes+indexBytes+morphBytes+instanceMatrixBytes+instanceColourBytes};
  }
  const gl=r.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const environment={renderer:gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),vendor:gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL??gl.VENDOR),webglVersion:gl.getParameter(gl.VERSION),userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemoryGiB:navigator.deviceMemory??null,devicePixelRatio,visibility:document.visibilityState};
  let previous=null,n=0,maxCameraError=0,maxActorTravel=0,maxActorDisplacement=0,previousActor=game.player.position.clone();const actorStart=previousActor.clone();
  try{
   await new Promise((resolve,reject)=>{function frame(now){try{
    if(document.visibilityState!=='visible')throw Error('Measurement page became hidden');
    r.info.reset();probe.lockMs=0;const start=performance.now();game.step(simulationDt);const stepped=performance.now(),stepCalls=r.info.render.calls,stepTriangles=r.info.render.triangles;e.render();const end=performance.now();
    const rafIntervalMs=previous===null?null:now-previous;previous=now;
    const row={rafIntervalMs,stepWallMs:stepped-start,cameraLockMs:probe.lockMs,stepExcludingPoseLockMs:Math.max(0,stepped-start-probe.lockMs),renderSubmitMs:end-stepped,frameWorkMs:end-start,submittedCalls:r.info.render.calls,submittedTriangles:r.info.render.triangles,stepSubmittedCalls:stepCalls,stepSubmittedTriangles:stepTriangles};
    maxCameraError=Math.max(maxCameraError,...c.position.toArray().map((v,i)=>Math.abs(v-probe.pose.camera[i])),...c.quaternion.toArray().map((v,i)=>Math.abs(v-probe.pose.quaternion[i])),...c.up.toArray().map((v,i)=>Math.abs(v-probe.pose.up[i])),Math.abs(c.fov-probe.pose.fov));
    maxActorTravel=Math.max(maxActorTravel,game.player.position.distanceTo(previousActor));maxActorDisplacement=Math.max(maxActorDisplacement,game.player.position.distanceTo(actorStart));previousActor.copy(game.player.position);
    if(n>=warmupFrames)samples.push(row);else warmup.push(row);
    if(++n===warmupFrames+sampleFrames)resolve();else requestAnimationFrame(frame);
   }catch(error){reject(error);}}requestAnimationFrame(frame);});
   return{samples,warmup,actualRaf:true,fixedStepSeconds:simulationDt,maxCameraError,maxActorTravel,maxActorDisplacement,actorStart:actorStart.toArray(),actor:game.player.position.toArray(),camera:{camera:c.position.toArray(),quaternion:c.quaternion.toArray(),up:c.up.toArray(),fov:c.fov,aspect:c.aspect},quality:{name:probe.quality.name,forced:probe.quality.forced,settings:probe.quality.all},drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],pixelRatio:r.getPixelRatio(),logicalBuffers:buffers(e.scene),terrainTriangles:(game.planet.mesh.geometry.index?.count||game.planet.mesh.geometry.attributes.position.count)/3,rendererResources:{...r.info.memory,programs:r.info.programs?.length??null},jsHeapBytes:performance.memory?.usedJSHeapSize??null,field:game.meadowField,environment,mode:game.mode};
  }finally{r.info.autoReset=previousAuto;e.updateCamera=probe.originalCameraUpdate;game.loop.stop();}
 },config);
}
async function run(){
 assert(process.argv.includes('--other-jobs-ended'),'Parent must confirm other validation/Blender jobs ended before measurement');
 const receipt=fixture.installedReceipt(),{m,c}=receipt,runName=process.argv.find(v=>v.startsWith('--name='))?.slice(7)||new Date().toISOString().replace(/[:.]/g,'-');
 assert(/^[a-zA-Z0-9_-]+$/.test(runName),'Invalid run name');
 const resumeName=process.argv.find(v=>v.startsWith('--resume='))?.slice(9);let reused=[],resume=null;
 if(resumeName){
  assert(/^[a-zA-Z0-9_-]+$/.test(resumeName),'Invalid resume name');
  const source='reports/2026-10-27/evidence/arrival-performance/'+resumeName+'/report.json',prior=json(source),complete=Math.floor(prior.rows.length/4)*4;
  assert(complete>0&&complete<24,'Require a partial prior run with complete ABBA blocks');
  assert.equal(prior.beforeManifestSha256,sha(read(A+'/manifest.json')));assert.equal(prior.combinedManifestSha256,receipt.combinedManifestSha256);assert.deepEqual(prior.installed,receipt.files);assert.deepEqual(prior.measurement,m.measurement);
  const core=text=>text.slice(text.indexOf('async function measurePage('),text.indexOf('\nasync function run('));
  assert.equal(core(read('tools/arrival-performance.cjs').toString()),core(read(A+'/collector-initial/arrival-performance.cjs').toString()),'Measurement core changed; previous timings cannot be reused');
  const oldFixture=json(A+'/preparation-audit.json').files.find(r=>r.file==='tools/arrival-performance-fixture.cjs');assert.equal(sha(read(oldFixture.file)),oldFixture.sha256,'Preparation/input fixture changed');
  const ordered=schedule(m);for(let i=0;i<complete;i++){const row=prior.rows[i];for(const key of['tier','view','phase','replicate','order'])assert.equal(row[key],ordered[i][key]);assert.equal(row.samples.length,m.measurement.sampleFrames);assert.equal(row.maxCameraError,0);assert.equal(row.quality.name,row.tier);assert(row.quality.forced);const pose=c.views.find(v=>v.view===row.view);for(const key of['camera','quaternion','up','fov','aspect'])assert.deepEqual(row.camera[key],pose[key]);}
  reused=prior.rows.slice(0,complete).map(row=>({...row,reusedFrom:source}));resume={source,sourceSha256:sha(read(source)),reusedCompleteRows:complete,preservedIncompleteRows:prior.rows.length-complete,nextJob:ordered[complete],measurementCoreUnchanged:true,fixtureUnchanged:true,rootCandidateAndCameraHashesUnchanged:true,scope:'Completed ABBA blocks retained. Incomplete block is restarted in a new sequential browser after a collector-only cleanup fix; no measurements are mixed across the interruption within an ABBA block.'};
 }
 const B='reports/2026-10-27/evidence/arrival-performance/'+runName,out=path.join(ROOT,B);assert(!fs.existsSync(out),'Preserve previous performance run');fs.mkdirSync(out,{recursive:true});
 const report={status:'running',scope:'Current local PC, isolated headless Edge, prepared stationary three-camera planetary scene. ABBA is a package comparison, not an isolated cause attribution or student-device/whole-game FPS result. PMREM regeneration after an 8 degree direction change and moving-camera/streaming spikes are outside this stationary run.',measurement:m.measurement,runName,createdUtc:new Date().toISOString(),beforeManifestSha256:sha(read(A+'/manifest.json')),installed:receipt.files,combinedManifestSha256:receipt.combinedManifestSha256,resume,rows:reused,errors:[]};
 const checkpoint=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');checkpoint();
 let browser;
 try{
  const {chromium}=require(path.join(process.env.AUDIT_NODE_MODULES,'playwright'));browser=await chromium.launch({channel:'msedge',headless:true});report.browserVersion=browser.version();
  for(const job of schedule(m).slice(reused.length)){
   const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,reducedMotion:'no-preference'}),page=await context.newPage(),errors=[],responses=[];
   const expected=new Map((job.phase==='before'?m.files.map(r=>({file:r.file,sha256:r.beforeSha256})):receipt.files).map(r=>[r.file,r.sha256]));
   // Capture the actual original fetch response bytes before the game consumes
   // them. No extra request or asset replacement: this avoids dependence on
   // DevTools retaining a large streamed GLB body for Network.getResponseBody.
   await page.addInitScript(files=>{
    const required=new Set(files),nativeFetch=window.fetch.bind(window),audit={pending:[],rows:[]};window.__arrivalNativeFetchAudit=audit;
    window.fetch=async function(...args){const response=await nativeFetch(...args),file=new URL(response.url,location.href).pathname.slice(1);if(required.has(file)){const copy=response.clone(),status=response.status;const pending=copy.arrayBuffer().then(async bytes=>{const digest=await crypto.subtle.digest('SHA-256',bytes);audit.rows.push({file,status,bytes:bytes.byteLength,sha256:Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join(''),method:'original native fetch response.clone + WebCrypto; no extra request'});}).catch(error=>{audit.rows.push({file,status,bodyReadError:error.message,method:'original native fetch response.clone'});});audit.pending.push(pending);}return response;};
   },[...expected.keys()]);
   page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error'&&/shader|WebGL|THREE/i.test(message.text()))errors.push(message.text());});
   // Every body promise has its own rejection handler immediately. Stop observing
   // before closing the context so a late response cannot escape the run's finally.
   const observeResponse=response=>{const file=new URL(response.url()).pathname.slice(1);if(expected.has(file))responses.push((async()=>{try{return{file,status:response.status(),sha256:sha(await response.body())};}catch(error){return{file,status:response.status(),bodyReadError:error.message};}})());};
   page.on('response',observeResponse);
   try{
    await fixture.prepare(page,job.phase,job.tier,job.view,c);
    const fetchAudit=await page.evaluate(async()=>{const a=window.__arrivalNativeFetchAudit;await Promise.all(a.pending);return a.rows;});page.off('response',observeResponse);const network=[...await Promise.all(responses),...fetchAudit];report.activeJob={...job,network,errors};checkpoint();
    for(const [file,hash]of expected)assert(network.some(r=>r.file===file&&r.status===200&&r.sha256===hash),'Native response mismatch: '+job.phase+' '+file);
    const data=await measurePage(page,m.measurement);assert.equal(data.samples.length,m.measurement.sampleFrames);assert.equal(data.maxCameraError,0,'Camera changed during fixed-view run');assert(data.maxActorDisplacement<.01,'Stationary actor moved over 1cm');assert(data.samples.every(v=>Number.isFinite(v.rafIntervalMs)&&v.rafIntervalMs>0));assert.equal(data.mode,'planet');assert.equal(data.quality.name,job.tier);assert.equal(data.quality.forced,true);assert.equal(data.environment.devicePixelRatio,1);assert.deepEqual(data.drawingBuffer,job.tier==='mid'?[1280,800]:[1024,640]);assert.equal(data.camera.aspect,1.6);
    assert.deepEqual(errors,[],'Browser errors');
    if(job.phase==='after'){assert(data.field.loaded,'Installed baked field not loaded');assert.equal(data.terrainTriangles,179440,'Unexpected installed terrain candidate');}
    const row={...job,...data,network,duplicateBodyErrors:network.filter(v=>v.bodyReadError),errors};report.rows.push(row);delete report.activeJob;
    if(job.replicate===1)await page.screenshot({path:path.join(out,job.phase+'-'+job.tier+'-'+job.view+'.png')});
    checkpoint();console.log(JSON.stringify({completed:report.rows.length,total:24,...job,rafMeanMs:stats(data.samples.map(v=>v.rafIntervalMs)).mean,stepMs:stats(data.samples.map(v=>v.stepWallMs)).mean,renderSubmitMs:stats(data.samples.map(v=>v.renderSubmitMs)).mean}));
   }finally{page.off('response',observeResponse);await Promise.all(responses);await context.close();}
  }
  report.comparisons=summarize(report.rows);assert.equal(sha(read('art/arrival-coherence/v01/combined/manifest.json')),receipt.combinedManifestSha256,'Candidate manifest changed during measurement');
  const ending=fixture.installedReceipt();assert.deepEqual(ending.files,receipt.files,'Installed sources/assets changed during measurement');
  report.pass=report.rows.length===24;report.status='measured';report.endedUtc=new Date().toISOString();
 }catch(error){report.pass=false;report.status='failed; partial evidence retained';report.failure=error.stack;console.error(error);process.exitCode=1;}
 finally{checkpoint();if(browser)await browser.close();}
}
if(require.main===module){if(process.argv.includes('--run-after-install'))run().catch(error=>{console.error(error);process.exitCode=1;});else{const {m}=fixture.checkSnapshot();assert.equal(schedule(m).length,24);assert.equal(stats([1,2,3,4]).median,2.5);assert.equal(stats([1,2,3,4]).p95,4);console.log(JSON.stringify({pass:true,status:'offline preparation audit only',beforeOriginals:m.files.length,newAbsent:m.absentBefore.length,jobs:schedule(m).length,browserStarted:false}));}}
module.exports={stats,schedule,summarize};
